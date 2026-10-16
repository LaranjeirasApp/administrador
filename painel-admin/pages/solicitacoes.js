/**
 * Solicitações de cadastro — aprovar ou recusar pedidos do link /cadastro.
 *
 * Escritas (mesmas do app do fiscal):
 * - Aprovar: pessoa na casa + busca de jogadores + conta vinculada + unidade
 *   confirmada + pedido decidido, num update() só (montado em escritas.js)
 * - Recusar: update(solicitacoes/{uid}) com status "recusada" e motivo opcional
 * As duas ficam registradas em auditoria/.
 */

import { ref, onValue, update, get, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { fbPushToArray, escHtml, tempoRelativo } from "../utils.js";
import { icon, emptyState, loading, errorBox, confirmDialog, iniciais } from "../ui.js";
import { montarAprovacao, montarAuditoria, unidadeFmt } from "../escritas.js";

const ABAS = [
  { id: 'pendente', label: 'Pendentes' },
  { id: 'aprovada', label: 'Aprovadas' },
  { id: 'recusada', label: 'Recusadas' },
  { id: 'todas',    label: 'Todas' },
];

export async function render(container, { db, user, showToast }) {
  container.innerHTML = `
    <div class="page" id="sol-page">
      <header class="page-head">
        <div>
          <h1 class="page-title">Solicitações de cadastro</h1>
          <p class="page-desc">Pedidos enviados pelo link de cadastro, agrupados por unidade. Aprovar cadastra a pessoa na casa e libera o acesso dela ao app.</p>
        </div>
      </header>

      <section class="panel panel-flush">
        <div class="tabs" role="tablist" aria-label="Situação">
          ${ABAS.map((a, i) => `<button class="tab" role="tab" data-tab="${a.id}" aria-selected="${i === 0}">${a.label}<span class="count" id="sol-c-${a.id}">0</span></button>`).join('')}
        </div>
        <div class="toolbar">
          <span id="sol-resumo" class="grow" style="font-size:13px;color:var(--text-2)"></span>
          <select id="sol-filtro-quadra" class="select select-auto" aria-label="Quadra">
            <option value="">Todas as quadras</option>
          </select>
        </div>
        <div id="sol-list">${loading()}</div>
      </section>

      <div id="sol-modal-recusa" class="modal-backdrop" hidden>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sol-recusa-title">
          <div class="modal-header">
            <h2 class="modal-title" id="sol-recusa-title">Recusar solicitação</h2>
            <button class="icon-btn" id="sol-modal-close" aria-label="Fechar">${icon('x', 18)}</button>
          </div>
          <div class="modal-body">
            <p id="sol-recusa-quem" style="color:var(--text-2);font-size:13.5px"></p>
            <div class="field">
              <label class="label" for="sol-motivo">Motivo <span class="muted">(opcional)</span></label>
              <textarea id="sol-motivo" class="textarea" rows="3" maxlength="200"
                placeholder="Ex.: unidade informada não confere com o cadastro do condomínio"></textarea>
              <span class="hint">A pessoa vê este texto e pode enviar um novo pedido.</span>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="sol-modal-cancelar">Cancelar</button>
            <button class="btn btn-danger" id="sol-modal-confirmar">Recusar pedido</button>
          </div>
        </div>
      </div>
    </div>`;

  const $ = id => document.getElementById(id);
  let allData = null;
  let aba = 'pendente';
  let recusandoUid = null;
  const decididoPor = () => user?.email?.replace(/@admin\.local$/, '') || 'admin';

  async function registrar(acao, detalhes) {
    try {
      await push(ref(db, 'auditoria'), montarAuditoria({ adminUid: user?.uid, adminNome: decididoPor(), acao, detalhes, agora: Date.now() }));
    } catch (err) {
      console.warn('auditoria não gravada:', err);
    }
  }

  const unsubscribe = onValue(ref(db, 'solicitacoes'), snap => {
    allData = fbPushToArray(snap.val()).sort((a, b) => {
      if (a.status === 'pendente' && b.status !== 'pendente') return -1;
      if (a.status !== 'pendente' && b.status === 'pendente') return 1;
      return (b.criadoEm || 0) - (a.criadoEm || 0);
    });
    preencherQuadras();
    renderList();
  }, err => {
    $('sol-list').innerHTML = errorBox(err);
  });

  function preencherQuadras() {
    const sel = $('sol-filtro-quadra');
    const atual = sel.value;
    const quadras = [...new Set(allData.map(s => String(s.unidadeId || '').split('-')[0]).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">Todas as quadras</option>' +
      quadras.map(q => `<option value="${escHtml(q)}">Quadra ${escHtml(q)}</option>`).join('');
    sel.value = quadras.includes(atual) ? atual : '';
  }

  function renderList() {
    if (allData === null) return;
    const cont = { pendente: 0, aprovada: 0, recusada: 0, todas: allData.length };
    allData.forEach(s => { if (cont[s.status] != null) cont[s.status]++; });
    ABAS.forEach(a => { const c = $(`sol-c-${a.id}`); if (c) c.textContent = cont[a.id]; });

    const badge = $('badge-solicitacoes');
    if (badge) { badge.hidden = cont.pendente === 0; badge.textContent = cont.pendente; }

    let items = aba === 'todas' ? allData : allData.filter(s => s.status === aba);
    const quadra = $('sol-filtro-quadra').value;
    if (quadra) items = items.filter(s => s.unidadeId?.startsWith(quadra + '-'));

    const resumo = $('sol-resumo');
    if (resumo) {
      const unidades = new Set(items.map(s => s.unidadeId)).size;
      const maisAntigo = aba === 'pendente' && items.length
        ? Math.min(...items.map(s => s.criadoEm || Date.now())) : null;
      resumo.textContent = !items.length ? ''
        : `${items.length} ${items.length === 1 ? 'pedido' : 'pedidos'} em ${unidades} ${unidades === 1 ? 'unidade' : 'unidades'}`
          + (maisAntigo ? ` · o mais antigo foi enviado ${tempoRelativo(maisAntigo).toLowerCase()}` : '');
    }

    const el = $('sol-list');
    if (!items.length) {
      el.innerHTML = aba === 'pendente'
        ? emptyState('checkCircle', 'Nenhum pedido aguardando',
            quadra ? 'Não há pedidos pendentes nesta quadra.' : 'Quando alguém preencher o formulário de cadastro, o pedido aparece aqui para aprovação.')
        : emptyState('inbox', 'Nada por aqui', 'Não há solicitações nesta situação.');
      return;
    }

    const grupos = new Map();
    items.forEach(s => {
      const g = s.unidadeId || 'Sem unidade';
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(s);
    });

    el.innerHTML = [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([uid, sols]) => `
        <div class="log-day" style="display:flex;align-items:center;gap:10px">
          <span class="tag">${escHtml(uid)}</span>
          <span>${sols.length} ${sols.length === 1 ? 'pedido' : 'pedidos'}</span>
        </div>
        ${sols.map(solRow).join('')}`).join('');
  }

  function solRow(s) {
    const pendente = s.status === 'pendente';
    const enviado = s.criadoEm ? new Date(s.criadoEm) : null;
    const quando = enviado
      ? `<span title="${escHtml(enviado.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}">enviado ${escHtml(tempoRelativo(s.criadoEm).toLowerCase())}</span>`
      : '';
    return `
      <div class="req">
        <span class="avatar">${escHtml(iniciais(s.nome || s.email))}</span>
        <div style="min-width:0">
          <div class="person-name">${escHtml(s.nome || '—')}</div>
          <div class="person-meta">
            <span class="truncate" style="max-width:100%">${escHtml(s.email || '—')}</span>
            ${s.emailVerificado ? `<span class="badge badge-ok">${icon('check', 12)}E-mail confirmado</span>` : '<span class="badge badge-neutral">E-mail não confirmado</span>'}
            ${quando}
          </div>
        </div>
        ${pendente ? `
          <div class="req-actions">
            <button class="btn btn-secondary btn-sm" data-recusar="${escHtml(s._key)}">Recusar</button>
            <button class="btn btn-primary btn-sm" data-aprovar="${escHtml(s._key)}">${icon('check', 16)}Aprovar</button>
          </div>` : `
          <div class="req-decision">
            ${statusBadge(s.status)}
            <div>${s.decididoEm ? escHtml(new Date(s.decididoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })) : ''}${s.decididoPor ? ` · por ${escHtml(s.decididoPor)}` : ''}</div>
            ${s.motivo ? `<div class="req-motivo">“${escHtml(s.motivo)}”</div>` : ''}
          </div>`}
      </div>`;
  }

  function statusBadge(status) {
    if (status === 'pendente') return '<span class="badge badge-dot badge-warn">Pendente</span>';
    if (status === 'aprovada') return '<span class="badge badge-dot badge-ok">Aprovada</span>';
    if (status === 'recusada') return '<span class="badge badge-dot badge-err">Recusada</span>';
    return `<span class="badge badge-neutral">${escHtml(status)}</span>`;
  }

  async function aprovar(uid) {
    const sol = allData.find(s => s._key === uid);
    if (!sol || sol.status !== 'pendente') return;
    const fmt = unidadeFmt(sol.unidadeId);

    // relê unidade e moradores na hora de decidir, como o fiscal faz
    let unidade, pessoasDaUnidade;
    try {
      const [uSnap, pSnap] = await Promise.all([
        get(ref(db, `unidades/${sol.unidadeId}`)),
        get(ref(db, `pessoas/${sol.unidadeId}`)),
      ]);
      unidade = uSnap.val();
      pessoasDaUnidade = pSnap.val() || {};
    } catch (err) {
      return showToast?.('Não consegui ler a unidade: ' + err.message, 'err');
    }

    const novoId = push(ref(db, `pessoas/${sol.unidadeId}`)).key;
    const r = montarAprovacao({
      uid, solicitacao: sol, unidade, pessoasDaUnidade,
      adminUid: user?.uid, adminNome: decididoPor(), novoId, agora: Date.now(),
    });
    if (r.erro) return showToast?.(r.erro, 'err');

    const ok = await confirmDialog({
      title: `Aprovar ${sol.nome}?`,
      message: r.jaTemTitular
        ? `A unidade ${fmt} já tem responsável, então ${sol.nome} entra como morador (sem administrar a unidade).\nA conta passa a ter acesso ao app.`
        : `${sol.nome} entra como responsável pela unidade ${fmt}.\nA conta passa a ter acesso ao app.`,
      confirmLabel: 'Aprovar',
    });
    if (!ok) return;
    try {
      await update(ref(db), r.updates);
      await registrar('Cadastro aprovado', `${sol.nome} — unidade ${fmt}${r.jaTemTitular ? ' (morador)' : ' (responsável)'}`);
      showToast?.(`Cadastro de ${sol.nome} aprovado.`, 'ok');
    } catch (err) {
      showToast?.('Não foi possível aprovar: ' + err.message, 'err');
    }
  }

  function abrirModalRecusa(uid) {
    const sol = allData.find(s => s._key === uid);
    recusandoUid = uid;
    $('sol-motivo').value = '';
    $('sol-recusa-quem').textContent = sol ? `${sol.nome || sol.email} · unidade ${sol.unidadeId}` : '';
    $('sol-modal-recusa').hidden = false;
    $('sol-motivo').focus();
  }

  function fecharModal() {
    $('sol-modal-recusa').hidden = true;
    recusandoUid = null;
  }

  $('sol-list').addEventListener('click', e => {
    const ap = e.target.closest('[data-aprovar]');
    if (ap) return aprovar(ap.dataset.aprovar);
    const rc = e.target.closest('[data-recusar]');
    if (rc) abrirModalRecusa(rc.dataset.recusar);
  });
  $('sol-modal-close').addEventListener('click', fecharModal);
  $('sol-modal-cancelar').addEventListener('click', fecharModal);
  $('sol-modal-recusa').addEventListener('click', e => { if (e.target === $('sol-modal-recusa')) fecharModal(); });
  $('sol-modal-confirmar').addEventListener('click', async () => {
    if (!recusandoUid) return;
    const motivo = $('sol-motivo').value.trim();
    const sol = allData.find(s => s._key === recusandoUid);
    try {
      const updates = { status: 'recusada', decididoEm: Date.now(), decididoPor: decididoPor() };
      if (motivo) updates.motivo = motivo;
      await update(ref(db, 'solicitacoes/' + recusandoUid), updates);
      fecharModal();
      await registrar('Cadastro recusado', `${sol?.nome || '—'} — unidade ${unidadeFmt(sol?.unidadeId)}${motivo ? ` — ${motivo}` : ''}`);
      showToast?.(`${sol?.nome || 'Solicitação'} recusada.`, 'ok');
    } catch (err) {
      showToast?.('Erro: ' + err.message, 'err');
    }
  });

  document.querySelectorAll('#sol-page [data-tab]').forEach(b => b.addEventListener('click', () => {
    aba = b.dataset.tab;
    document.querySelectorAll('#sol-page [data-tab]').forEach(t => t.setAttribute('aria-selected', String(t === b)));
    renderList();
  }));
  $('sol-filtro-quadra').addEventListener('change', renderList);

  const onKey = e => { if (e.key === 'Escape' && !$('sol-modal-recusa').hidden) fecharModal(); };
  document.addEventListener('keydown', onKey);

  return () => {
    unsubscribe();
    document.removeEventListener('keydown', onKey);
  };
}
