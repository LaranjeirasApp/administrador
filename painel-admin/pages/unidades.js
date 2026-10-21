/**
 * Unidades — casas do condomínio, convites de acesso e moradores.
 *
 * Escritas (mesmas do painel anterior):
 * - Criar unidade: set(unidades/{id}) + espelho em unidadesPublicas
 * - Ativar/desativar: update(unidades/{id}.ativo) + espelho
 * - Gerar convite: set(convites/{token}) + update(unidades/{id}.conviteAtual)
 * - Revogar convite: update(convites/{token}.revogado = true)
 * - Adicionar/remover pessoa: montado em escritas.js (mesmo formato do app do
 *   titular), num update() só, com registro em auditoria/
 *
 * pessoas/ e convites/ não podem ser lidos inteiros (regras de privacidade);
 * são lidos por unidade, ao abrir o detalhe.
 */

import { ref, get, set, update, remove, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { escHtml, normalizarNome, formatDate, linkConvite, ordenarLista } from "../utils.js";
import { icon, emptyState, loading, errorBox, confirmDialog, iniciais, trapFocus, ocupado, thOrdenavel } from "../ui.js";
import { LIMITE_PESSOAS, montarNovaPessoa, montarRemocaoPessoa, montarAuditoria, unidadeFmt } from "../escritas.js";

const CONVITE_VALIDADE_MS = 86400000;

// valor usado para ordenar cada coluna
const CAMPOS = {
  id: u => u.id,
  status: u => u.status === 'confirmada' ? '1' : u.status === 'rascunho' ? '2' : (u.status || ''),
  convite: u => u.conviteAtual ? 'gerado' : '',
  criadoEm: u => u.criadoEm || null,
  acesso: u => u.ativo !== false ? '1' : '2',
};

export async function render(container, { db, user, showToast }) {
  const adminUid = user?.uid || null;
  const adminNome = user?.email?.replace(/@admin\.local$/, '') || 'Administrador';

  async function registrar(acao, detalhes) {
    try {
      await push(ref(db, 'auditoria'), montarAuditoria({ adminUid, adminNome, acao, detalhes, agora: Date.now() }));
    } catch (err) {
      console.warn('auditoria não gravada:', err);
    }
  }

  container.innerHTML = `
    <div class="page" id="un-page">
      <header class="page-head">
        <div>
          <h1 class="page-title">Unidades</h1>
          <p class="page-desc">Casas cadastradas no sistema, com situação do cadastro, convite de acesso do titular e moradores.</p>
        </div>
        <div class="page-actions">
          <button id="un-btn-nova" class="btn btn-primary">${icon('plus', 16)}Nova unidade</button>
        </div>
      </header>

      <section class="panel panel-flush">
        <div class="tabs" role="tablist" aria-label="Filtrar unidades">
          ${tab('ativas', 'Ativas', true)}
          ${tab('confirmada', 'Confirmadas')}
          ${tab('rascunho', 'Rascunho')}
          ${tab('inativas', 'Inativas')}
        </div>
        <div class="toolbar">
          <div class="input-icon grow">
            ${icon('search', 16)}
            <input id="un-search" type="search" class="input" placeholder="Buscar por quadra e lote, ex.: 05-03" aria-label="Buscar unidade">
          </div>
          <select id="un-quadra" class="select select-auto" aria-label="Quadra">
            <option value="">Todas as quadras</option>
          </select>
        </div>
        <div id="un-table">${loading()}</div>
      </section>

      <div id="un-modal-nova" class="modal-backdrop" hidden>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="un-nova-title">
          <div class="modal-header">
            <h2 class="modal-title" id="un-nova-title">Nova unidade</h2>
            <button class="icon-btn" id="un-nova-close" aria-label="Fechar">${icon('x', 18)}</button>
          </div>
          <div class="modal-body">
            <p style="color:var(--text-2);font-size:13.5px">A unidade é identificada por quadra e lote. Use a quadra <span class="tag">99</span> para unidades internas do condomínio.</p>
            <div class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
              <div class="field">
                <label class="label" for="un-nova-quadra">Quadra</label>
                <input id="un-nova-quadra" class="input" inputmode="numeric" maxlength="2" placeholder="05" autocomplete="off">
              </div>
              <div class="field">
                <label class="label" for="un-nova-lote">Lote</label>
                <input id="un-nova-lote" class="input" inputmode="numeric" maxlength="3" placeholder="03" autocomplete="off">
              </div>
            </div>
            <div class="hint" id="un-nova-preview">Código da unidade: <span class="tag">—</span></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="un-nova-cancelar">Cancelar</button>
            <button class="btn btn-primary" id="un-nova-criar">Criar unidade</button>
          </div>
        </div>
      </div>
    </div>`;

  const $ = id => document.getElementById(id);
  let allUnidades = null;
  let aba = 'ativas';
  let ordem = { chave: 'id', dir: 'asc' };
  let soltarDrawer = null;
  let soltarNova = null;

  const unsub = onValue(ref(db, 'unidades'), snap => {
    allUnidades = snap.val() || {};
    preencherQuadras();
    renderTable();
  }, err => {
    $('un-table').innerHTML = errorBox(err);
  });

  function lista() {
    return Object.entries(allUnidades || {}).map(([id, v]) => ({ id, ...v }));
  }

  function preencherQuadras() {
    const sel = $('un-quadra');
    const atual = sel.value;
    const quadras = [...new Set(lista().map(u => u.id.split('-')[0]))].sort();
    sel.innerHTML = '<option value="">Todas as quadras</option>' +
      quadras.map(q => `<option value="${escHtml(q)}">${q === '99' ? 'Quadra 99 · internas' : `Quadra ${escHtml(q)}`}</option>`).join('');
    sel.value = quadras.includes(atual) ? atual : '';
  }

  function renderTable() {
    if (allUnidades === null) return;
    const todas = lista();
    const ativas = todas.filter(u => u.ativo !== false);
    const contagem = {
      ativas: ativas.length,
      confirmada: ativas.filter(u => u.status === 'confirmada').length,
      rascunho: ativas.filter(u => u.status === 'rascunho').length,
      inativas: todas.length - ativas.length,
    };
    Object.entries(contagem).forEach(([k, v]) => { const c = $(`un-c-${k}`); if (c) c.textContent = v; });

    let items = aba === 'inativas' ? todas.filter(u => u.ativo === false)
      : aba === 'ativas' ? ativas
      : ativas.filter(u => u.status === aba);

    const quadra = $('un-quadra').value;
    if (quadra) items = items.filter(u => u.id.startsWith(quadra + '-'));
    const q = normalizarNome($('un-search').value);
    if (q) {
      const dig = q.replace(/\D/g, '');
      items = items.filter(u => normalizarNome(u.id).includes(q) || (dig && u.id.replace(/\D/g, '').includes(dig)));
    }
    // ordem pelo código desempata as outras colunas
    items = ordenarLista(ordenarLista(items, CAMPOS.id, 'asc'), CAMPOS[ordem.chave], ordem.dir);
    const agrupar = ordem.chave === 'id';

    const el = $('un-table');
    if (!todas.length) {
      el.innerHTML = emptyState('home', 'Nenhuma unidade cadastrada',
        'Cadastre as casas do condomínio para poder gerar os convites de acesso dos titulares.',
        `<button class="btn btn-primary btn-sm" data-action="nova">${icon('plus', 16)}Nova unidade</button>`);
      return;
    }
    if (!items.length) {
      el.innerHTML = emptyState('search', 'Nenhuma unidade encontrada',
        q || quadra ? 'Nenhuma unidade corresponde à busca nesta aba.' : 'Não há unidades nesta situação.');
      return;
    }

    // ordem pelo código: agrupa por quadra; outra coluna: lista corrida
    const grupos = new Map();
    items.forEach(u => {
      const g = agrupar ? u.id.split('-')[0] : '';
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(u);
    });

    el.innerHTML = `
      <div class="table-scroll">
        <table class="table table-stack table-compact">
          <thead>
            <tr>
              ${thOrdenavel('id', 'Unidade', ordem)}
              ${thOrdenavel('status', 'Cadastro', ordem)}
              ${thOrdenavel('convite', 'Convite', ordem)}
              ${thOrdenavel('criadoEm', 'Criada em', ordem)}
              ${thOrdenavel('acesso', 'Acesso', ordem)}
              <th class="w-1"><span class="sr-only">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            ${[...grupos.entries()].map(([g, us]) => `
              ${agrupar ? `<tr class="group-row"><td colspan="6">${g === '99' ? 'Quadra 99 · unidades internas' : `Quadra ${escHtml(g)}`} · ${us.length} ${us.length === 1 ? 'unidade' : 'unidades'}</td></tr>` : ''}
              ${us.map(u => `
                <tr class="row-link" data-ver="${escHtml(u.id)}">
                  <td data-label="Unidade" class="td-lead"><span class="tag">${escHtml(u.id)}</span></td>
                  <td data-label="Cadastro">${statusBadge(u.status)}</td>
                  <td data-label="Convite" class="${u.conviteAtual ? '' : 'm-hide'}">${u.conviteAtual
                    ? '<span class="badge badge-dot badge-primary"><span class="d-only">Gerado</span><span class="m-only">Convite gerado</span></span>'
                    : '<span class="muted">Nenhum</span>'}</td>
                  <td data-label="Criada em" class="num nowrap"><span><span class="m-only muted">criada em </span>${u.criadoEm ? escHtml(formatDate(new Date(u.criadoEm).toISOString())) : '—'}</span></td>
                  <td data-label="Acesso">${acessoBadge(u.ativo)}</td>
                  <td class="w-1 td-bare"><button class="icon-btn" data-ver="${escHtml(u.id)}" aria-label="Abrir unidade ${escHtml(u.id)}">${icon('chevronRight', 18)}</button></td>
                </tr>`).join('')}`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // ── Detalhe (painel lateral) ───────────────────────────
  function fecharDrawer() {
    const d = $('un-drawer');
    if (!d) return;
    d.remove();
    soltarDrawer?.();
    soltarDrawer = null;
  }

  async function abrirDetalhe(id) {
    fecharDrawer();
    const u = { id, ...(allUnidades?.[id] || {}) };
    const [q, l] = id.split('-');

    const wrap = document.createElement('div');
    wrap.className = 'drawer-backdrop';
    wrap.id = 'un-drawer';
    wrap.innerHTML = `
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="un-dr-title" tabindex="-1">
        <div class="drawer-head">
          <span class="tag tag-lg">${escHtml(id)}</span>
          <div style="flex:1;min-width:0">
            <div class="drawer-title" id="un-dr-title">Quadra ${escHtml(q)} · Lote ${escHtml(u.lotePrincipal || l || '—')}</div>
            <div class="drawer-sub" id="un-dr-badges">${cabecalhoBadges(u)}</div>
          </div>
          <button class="icon-btn" data-close aria-label="Fechar">${icon('x', 18)}</button>
        </div>
        <div class="drawer-body" id="un-dr-body">${loading()}</div>
      </aside>`;
    $('un-page').appendChild(wrap);
    soltarDrawer = trapFocus(wrap);
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('[data-close]')) fecharDrawer();
    });
    wrap.querySelector('.drawer').focus();

    let pessoas = {}, convite = null;
    try {
      const [pessoasSnap, conviteSnap] = await Promise.all([
        get(ref(db, `pessoas/${id}`)),
        u.conviteAtual ? get(ref(db, `convites/${u.conviteAtual}`)) : Promise.resolve(null),
      ]);
      pessoas = pessoasSnap.val() || {};
      convite = conviteSnap?.val() || null;
    } catch (err) {
      const body = $('un-dr-body');
      if (body) body.innerHTML = errorBox(err);
      return;
    }
    if (!$('un-drawer')) return;
    renderDetalhe(u, pessoas, convite);
  }

  function renderDetalhe(u, pessoas, convite) {
    const body = $('un-dr-body');
    if (!body) return;
    const agora = Date.now();
    const expira = convite ? convite.criadoEm + CONVITE_VALIDADE_MS : 0;
    const convAtivo = convite && !convite.revogado && !convite.usadoPorUid && expira > agora;
    const podeGerar = u.status === 'confirmada';
    const url = linkConvite(location.origin, u.conviteAtual);
    const listaPessoas = Object.entries(pessoas);

    let conviteHtml;
    if (convAtivo) {
      conviteHtml = `
        <div class="link-box">
          <input class="input" id="un-convite-url" readonly value="${escHtml(url)}" aria-label="Link do convite">
          <button class="btn btn-secondary" id="un-convite-copiar">${icon('copy', 16)}Copiar</button>
        </div>
        <div class="hint" style="margin-top:8px">Uso único · válido até ${escHtml(dataHora(expira))}</div>
        <div style="margin-top:14px">
          <button class="btn btn-danger-soft btn-sm" id="un-convite-revogar">${icon('ban', 16)}Revogar convite</button>
        </div>`;
    } else {
      const motivo = convite?.usadoPorUid
        ? `${icon('checkCircle', 18)}<span>Convite já utilizado. A conta do titular está vinculada a esta unidade.</span>`
        : convite?.revogado
        ? `${icon('ban', 18)}<span>O último convite foi revogado e não funciona mais.</span>`
        : convite
        ? `${icon('clock', 18)}<span>O último convite expirou em ${escHtml(dataHora(expira))}.</span>`
        : `${icon('link', 18)}<span>Nenhum convite gerado para esta unidade.</span>`;
      conviteHtml = `
        <div class="state-line">${motivo}</div>
        <div style="margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="un-convite-gerar" ${podeGerar ? '' : 'disabled'}>${icon('link', 16)}Gerar convite</button>
          ${podeGerar ? '' : '<span class="hint">Disponível depois que a unidade for confirmada.</span>'}
        </div>`;
    }

    body.innerHTML = `
      <section class="drawer-section">
        <div class="row-toggle" style="padding:0">
          <div>
            <div class="row-title">Unidade ativa</div>
            <div class="row-desc">Unidades inativas saem da lista do formulário de cadastro.</div>
          </div>
          <label class="toggle"><input type="checkbox" id="un-det-ativo" ${u.ativo !== false ? 'checked' : ''} aria-label="Unidade ativa"><span class="toggle-slider"></span></label>
        </div>
      </section>

      <section class="drawer-section">
        <div class="drawer-section-head">
          <h3 class="drawer-section-title">Convite de acesso do titular</h3>
          ${convAtivo ? '<span class="badge badge-dot badge-ok">Ativo</span>' : ''}
        </div>
        ${conviteHtml}
      </section>

      <section class="drawer-section">
        <div class="drawer-section-head">
          <h3 class="drawer-section-title">Moradores <span class="panel-meta" style="font-family:var(--ff-body);font-weight:400">· ${listaPessoas.length} ${listaPessoas.length === 1 ? 'pessoa' : 'pessoas'}</span></h3>
          ${listaPessoas.length < LIMITE_PESSOAS
            ? `<button class="btn btn-secondary btn-sm" id="un-add-abrir">${icon('plus', 16)}Adicionar pessoa</button>`
            : `<span class="hint">Limite de ${LIMITE_PESSOAS} pessoas</span>`}
        </div>

        <form class="add-person" id="un-add-form" hidden novalidate>
          <div class="field">
            <label class="label" for="un-add-nome">Nome completo</label>
            <input id="un-add-nome" class="input" maxlength="80" autocomplete="off" placeholder="Ex.: Renata Ribeiro">
          </div>
          <div class="field">
            <span class="label" id="un-add-tipo-lbl">Tipo</span>
            <div class="seg" role="group" aria-labelledby="un-add-tipo-lbl">
              <button type="button" data-tipo="morador" aria-pressed="true">Morador</button>
              <button type="button" data-tipo="locatario" aria-pressed="false">Locatário</button>
            </div>
          </div>
          <div class="add-person-periodo" id="un-add-periodo" hidden>
            <div class="field">
              <label class="label" for="un-add-inicio">Autorizado de</label>
              <input type="date" id="un-add-inicio" class="input">
            </div>
            <div class="field">
              <label class="label" for="un-add-fim">até</label>
              <input type="date" id="un-add-fim" class="input">
            </div>
            <p class="hint" style="grid-column:1 / -1">Fora desse período o locatário não consegue entrar na fila.</p>
          </div>
          <div class="form-error" id="un-add-erro" role="alert" hidden></div>
          <div class="add-person-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="un-add-cancelar">Cancelar</button>
            <button type="submit" class="btn btn-primary btn-sm" id="un-add-salvar">Adicionar à casa</button>
          </div>
        </form>

        ${listaPessoas.length ? `
          <ul class="people">
            ${listaPessoas
              .sort(([, a], [, b]) => (b.titular ? 1 : 0) - (a.titular ? 1 : 0) || String(a.nome).localeCompare(String(b.nome)))
              .map(([pid, p]) => `
              <li class="person">
                <span class="avatar avatar-sm ${p.titular ? '' : 'avatar-primary'}">${escHtml(iniciais(p.nome))}</span>
                <div style="min-width:0">
                  <div class="person-name">${escHtml(p.nome || '—')}</div>
                  <div class="person-meta">
                    <span>${p.tipo === 'locatario' ? 'Locatário' : 'Morador'}</span>
                    ${p.tipo === 'locatario' && p.autorizacaoInicio ? `<span>autorizado de ${escHtml(formatDate(p.autorizacaoInicio))} a ${escHtml(formatDate(p.autorizacaoFim))}</span>` : ''}
                  </div>
                </div>
                <div class="person-side">
                  ${p.titular ? '<span class="badge badge-clay">Titular</span>' : ''}
                  ${p.codigoAcesso ? `<span class="tag" title="Código de acesso">${escHtml(p.codigoAcesso)}</span>` : ''}
                  ${p.titular ? '' : `<button class="icon-btn icon-btn-danger" data-remover="${escHtml(pid)}" title="Remover da casa" aria-label="Remover ${escHtml(p.nome || '')} da casa">${icon('trash', 17)}</button>`}
                </div>
              </li>`).join('')}
          </ul>
          ${listaPessoas.some(([, p]) => p.titular) ? '<p class="hint" style="margin-top:10px">O titular não pode ser removido por aqui. Para trocar o responsável pela casa será preciso a transferência de titularidade.</p>' : ''}`
        : emptyState('users', 'Nenhuma pessoa cadastrada', 'Adicione os moradores aqui, ou o titular cadastra pelo app depois de entrar com o convite.', '', true)}
      </section>`;

    $('un-det-ativo')?.addEventListener('change', async e => {
      const el = e.target;
      const ativo = el.checked;
      if (!ativo) {
        const ok = await confirmDialog({
          title: `Desativar a unidade ${u.id}?`,
          message: 'Ela sai da lista de casas do formulário de cadastro até você ativar de novo.',
          confirmLabel: 'Desativar unidade',
          tone: 'danger',
        });
        if (!ok) { el.checked = true; el.focus(); return; }
      }
      el.disabled = true;
      try {
        await update(ref(db, `unidades/${u.id}`), { ativo });
        await syncUnidadesPublicas(db, u.id, ativo);
        u.ativo = ativo;
        const badges = $('un-dr-badges');
        if (badges) badges.innerHTML = cabecalhoBadges(u);
        showToast?.(ativo ? `Unidade ${u.id} ativada.` : `Unidade ${u.id} desativada.`, 'ok');
      } catch (err) {
        el.checked = !ativo;
        showToast?.('Erro: ' + err.message, 'err');
      } finally {
        el.disabled = false;
        el.focus({ preventScroll: true });
      }
    });

    $('un-convite-gerar')?.addEventListener('click', e => gerarConvite(u.id, e.currentTarget));

    $('un-convite-copiar')?.addEventListener('click', () => {
      const input = $('un-convite-url');
      navigator.clipboard.writeText(url)
        .then(() => showToast?.('Link copiado.', 'ok'))
        .catch(() => { input?.select(); showToast?.('Selecionei o link: use Ctrl+C para copiar.'); });
    });

    $('un-convite-revogar')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Revogar este convite?',
        message: 'O link deixa de funcionar imediatamente. Você pode gerar um novo depois.',
        confirmLabel: 'Revogar',
        tone: 'danger',
      });
      if (!ok) return;
      const soltar = ocupado($('un-convite-revogar'), 'Revogando…');
      try {
        await update(ref(db, `convites/${u.conviteAtual}`), { revogado: true });
        showToast?.('Convite revogado.', 'ok');
        abrirDetalhe(u.id);
      } catch (err) {
        soltar();
        showToast?.('Erro: ' + err.message, 'err');
      }
    });

    // ── Adicionar pessoa ─────────────────────────────────
    const form = $('un-add-form');
    let tipo = 'morador';
    const erroEl = $('un-add-erro');
    const mostrarErro = msg => { erroEl.textContent = msg; erroEl.hidden = !msg; };

    $('un-add-abrir')?.addEventListener('click', () => {
      form.hidden = false;
      $('un-add-abrir').hidden = true;
      $('un-add-nome').focus();
    });
    $('un-add-cancelar')?.addEventListener('click', () => renderDetalhe(u, pessoas, convite));
    form?.querySelectorAll('[data-tipo]').forEach(b => b.addEventListener('click', () => {
      tipo = b.dataset.tipo;
      form.querySelectorAll('[data-tipo]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $('un-add-periodo').hidden = tipo !== 'locatario';
    }));
    form?.addEventListener('submit', async e => {
      e.preventDefault();
      mostrarErro('');
      const novoId = push(ref(db, `pessoas/${u.id}`)).key;
      const r = montarNovaPessoa({
        unidadeId: u.id, unidade: u, pessoasAtuais: pessoas,
        nome: $('un-add-nome').value, tipo,
        inicio: $('un-add-inicio').value, fim: $('un-add-fim').value,
        adminUid, novoId, agora: Date.now(),
      });
      if (r.erro) return mostrarErro(r.erro);
      const soltar = ocupado($('un-add-salvar'), 'Adicionando…');
      try {
        await update(ref(db), r.updates);
        pessoas[novoId] = r.pessoa;
        const extra = r.pessoa.tipo === 'locatario' ? ` (locatário até ${formatDate(r.pessoa.autorizacaoFim)})` : '';
        await registrar('Pessoa adicionada', `${r.pessoa.nome} — unidade ${unidadeFmt(u.id)}${extra}`);
        showToast?.(`${r.pessoa.nome} entrou na unidade ${u.id}.`, 'ok');
        renderDetalhe(u, pessoas, convite);
      } catch (err) {
        soltar();
        mostrarErro('Não foi possível adicionar: ' + err.message);
      }
    });

    // ── Remover pessoa ───────────────────────────────────
    body.querySelectorAll('[data-remover]').forEach(b => b.addEventListener('click', async () => {
      const pid = b.dataset.remover;
      const p = pessoas[pid];
      const r = montarRemocaoPessoa({ unidadeId: u.id, pessoaId: pid, pessoa: p });
      if (r.erro) return showToast?.(r.erro, 'err');
      const ok = await confirmDialog({
        title: `Remover ${p.nome} da unidade ${u.id}?`,
        message: [
          'A pessoa sai da casa e deixa de aparecer na busca de jogadores.',
          p.codigoAcesso ? `O código de acesso ${p.codigoAcesso} para de funcionar.` : '',
          'As partidas antigas continuam no histórico.',
        ].filter(Boolean).join('\n'),
        confirmLabel: 'Remover',
        tone: 'danger',
      });
      if (!ok) return;
      b.disabled = true;
      b.setAttribute('aria-busy', 'true');
      try {
        await update(ref(db), r.updates);
        delete pessoas[pid];
        await registrar('Pessoa removida', `${p.nome} — unidade ${unidadeFmt(u.id)}`);
        showToast?.(`${p.nome} saiu da unidade ${u.id}.`, 'ok');
        renderDetalhe(u, pessoas, convite);
      } catch (err) {
        b.disabled = false;
        b.removeAttribute('aria-busy');
        showToast?.('Não foi possível remover: ' + err.message, 'err');
      }
    }));
  }

  async function gerarConvite(unidadeId, btn) {
    const token = gerarToken();
    const soltar = ocupado(btn, 'Gerando…');
    try {
      await set(ref(db, `convites/${token}`), {
        unidadeId,
        usadoPorUid: '',
        revogado: false,
        criadoEm: Date.now(),
      });
      await update(ref(db, `unidades/${unidadeId}`), { conviteAtual: token });
      if (allUnidades?.[unidadeId]) allUnidades[unidadeId].conviteAtual = token;
      showToast?.('Convite gerado.', 'ok');
      abrirDetalhe(unidadeId);
    } catch (err) {
      soltar();
      showToast?.('Erro: ' + err.message, 'err');
    }
  }

  // ── Nova unidade ───────────────────────────────────────
  function abrirNova() {
    $('un-nova-quadra').value = '';
    $('un-nova-lote').value = '';
    atualizarPreview();
    $('un-modal-nova').hidden = false;
    soltarNova = trapFocus($('un-modal-nova'));
    $('un-nova-quadra').focus();
  }
  function fecharNova() {
    if ($('un-modal-nova').hidden) return;
    $('un-modal-nova').hidden = true;
    soltarNova?.();
    soltarNova = null;
  }

  function codigoDigitado() {
    const q = $('un-nova-quadra').value.replace(/\D/g, '');
    const l = $('un-nova-lote').value.replace(/\D/g, '');
    if (!q || !l) return null;
    return `${q.padStart(2, '0')}-${l.padStart(2, '0')}`;
  }
  function atualizarPreview() {
    const id = codigoDigitado();
    const existe = id && allUnidades?.[id];
    $('un-nova-preview').innerHTML = `Código da unidade: <span class="tag">${id ? escHtml(id) : '—'}</span>${existe ? ' <span class="badge badge-warn">já existe</span>' : ''}`;
  }

  $('un-btn-nova').addEventListener('click', abrirNova);
  $('un-nova-close').addEventListener('click', fecharNova);
  $('un-nova-cancelar').addEventListener('click', fecharNova);
  $('un-modal-nova').addEventListener('click', e => { if (e.target === $('un-modal-nova')) fecharNova(); });
  $('un-nova-quadra').addEventListener('input', atualizarPreview);
  $('un-nova-lote').addEventListener('input', atualizarPreview);
  $('un-nova-criar').addEventListener('click', async e => {
    const id = codigoDigitado();
    if (!id) { showToast?.('Preencha quadra e lote com números.', 'err'); return; }
    if (allUnidades?.[id]) { showToast?.(`A unidade ${id} já existe.`, 'err'); return; }
    const [q, l] = id.split('-');
    const soltar = ocupado(e.currentTarget, 'Criando…');
    try {
      await set(ref(db, `unidades/${id}`), {
        quadra: q, lotePrincipal: l,
        status: 'rascunho', ativo: true,
        criadoEm: Date.now(),
      });
      await syncUnidadesPublicas(db, id, true);
      soltar();
      fecharNova();
      showToast?.(`Unidade ${id} criada.`, 'ok');
    } catch (err) {
      soltar();
      showToast?.('Erro: ' + err.message, 'err');
    }
  });

  // ── Filtros e cliques ──────────────────────────────────
  document.querySelectorAll('#un-page [data-tab]').forEach(b => b.addEventListener('click', () => {
    aba = b.dataset.tab;
    document.querySelectorAll('#un-page [data-tab]').forEach(t => t.setAttribute('aria-selected', String(t === b)));
    renderTable();
  }));
  $('un-search').addEventListener('input', renderTable);
  $('un-quadra').addEventListener('change', renderTable);
  $('un-table').addEventListener('click', e => {
    if (e.target.closest('[data-action="nova"]')) return abrirNova();
    const s = e.target.closest('[data-sort]');
    if (s) {
      const k = s.dataset.sort;
      ordem = ordem.chave === k
        ? { chave: k, dir: ordem.dir === 'asc' ? 'desc' : 'asc' }
        : { chave: k, dir: k === 'criadoEm' ? 'desc' : 'asc' };
      renderTable();
      $('un-table').querySelector(`[data-sort="${k}"]`)?.focus();
      return;
    }
    const row = e.target.closest('[data-ver]');
    if (row) abrirDetalhe(row.dataset.ver);
  });

  const onKey = e => {
    if (e.key !== 'Escape') return;
    if ($('un-drawer')) fecharDrawer();
    else if (!$('un-modal-nova').hidden) fecharNova();
  };
  document.addEventListener('keydown', onKey);

  return () => {
    unsub();
    document.removeEventListener('keydown', onKey);
    fecharDrawer();
    fecharNova();
  };
}

// ── Helpers ──────────────────────────────────────────────

function tab(id, label, selected = false) {
  return `<button class="tab" role="tab" data-tab="${id}" aria-selected="${selected}">${label}<span class="count" id="un-c-${id}">0</span></button>`;
}

function statusBadge(status) {
  if (status === 'confirmada') return '<span class="badge badge-ok">Confirmada</span>';
  if (status === 'rascunho')   return '<span class="badge badge-warn">Rascunho</span>';
  return `<span class="badge badge-neutral">${escHtml(status || '—')}</span>`;
}

function acessoBadge(ativo) {
  return ativo !== false
    ? '<span class="badge badge-dot badge-ok">Ativa</span>'
    : '<span class="badge badge-dot badge-neutral">Inativa</span>';
}

function cabecalhoBadges(u) {
  return `${statusBadge(u.status)}${acessoBadge(u.ativo)}${u.id.startsWith('99-') ? '<span class="badge badge-info">Interna</span>' : ''}`;
}

function dataHora(ts) {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
}

function gerarToken() {
  // Mesmo alfabeto do painel atual (sem 0, O, 1, I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint32Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => chars[n % chars.length]).join('');
}

async function syncUnidadesPublicas(db, id, ativo) {
  if (id.startsWith('99-')) return;
  if (ativo) await set(ref(db, `unidadesPublicas/${id}`), true);
  else await remove(ref(db, `unidadesPublicas/${id}`));
}
