/**
 * Visão geral — resumo do dia, ao vivo.
 *
 * Dados lidos:
 * - quadras e config/quadras (ao vivo)
 * - fila (ao vivo)
 * - solicitacoes (ao vivo, só a contagem de pendentes)
 * - historico (uma leitura, só o dia de hoje)
 */

import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { calcularDiaChave, diaLocalISO, fbToArray, fbPushToArray, escHtml } from "../utils.js";
import {
  icon, courtCard, estadoQuadra, quadraAtiva, nomesDe, detalhesDe, ordenarFila,
  tipoBadge, emptyState, loading, errorBox, esperaDesde, minutosEntre, duracaoCurta,
} from "../ui.js";

const MAX_PARTIDAS = 8;
const MAX_FILA = 6;

export async function render(container, { db }) {
  const hoje = calcularDiaChave();
  const dataExtenso = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo',
  });

  container.innerHTML = `
    <div class="page">
      <header class="page-head">
        <div>
          <h1 class="page-title">Visão geral</h1>
          <p class="page-desc"><span class="cap" style="display:inline-block">${escHtml(dataExtenso)}</span> · atualiza sozinho enquanto a página estiver aberta</p>
        </div>
      </header>

      <section class="panel kpis" aria-label="Resumo do dia">
        ${kpi('quadras', 'court', 'Quadras em uso')}
        ${kpi('fila', 'queue', 'Na fila agora')}
        ${kpi('hoje', 'history', 'Partidas hoje')}
        ${kpi('pend', 'inbox', 'Cadastros pendentes')}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2 class="panel-title">Quadras agora</h2>
          <span class="panel-meta" id="dash-courts-meta"></span>
          <span class="spacer"></span>
          <a class="panel-link" href="#fila">Acompanhar ao vivo ${icon('arrowRight', 14)}</a>
        </div>
        <div class="panel-body">
          <div class="courts" id="dash-courts">${loading()}</div>
        </div>
      </section>

      <div class="grid grid-main">
        <section class="panel panel-flush">
          <div class="panel-head">
            <h2 class="panel-title">Partidas de hoje</h2>
            <span class="panel-meta" id="dash-hoje-meta"></span>
            <span class="spacer"></span>
            <a class="panel-link" href="#historico">Histórico completo ${icon('arrowRight', 14)}</a>
          </div>
          <div id="dash-hoje">${loading()}</div>
        </section>

        <section class="panel panel-flush">
          <div class="panel-head">
            <h2 class="panel-title">Próximos da fila</h2>
            <span class="panel-meta" id="dash-fila-meta"></span>
          </div>
          <div id="dash-fila">${loading()}</div>
        </section>
      </div>
    </div>`;

  const unsubscribers = [];
  let quadras = null;
  let cfgQuadras = null;

  // ── Quadras + configuração (ao vivo) ───────────────────
  unsubscribers.push(onValue(ref(db, 'config/quadras'), snap => {
    cfgQuadras = snap.val() || {};
    renderCourts();
  }));
  unsubscribers.push(onValue(ref(db, 'quadras'), snap => {
    quadras = fbToArray(snap.val());
    renderCourts();
  }));
  const tick = setInterval(renderCourts, 1000);

  function renderCourts() {
    const el = document.getElementById('dash-courts');
    if (!el || quadras === null || cfgQuadras === null) return;
    const porId = {};
    quadras.forEach((q, i) => { if (q) porId[q.id || i + 1] = q; });

    let ativas = 0, emJogo = 0, chamadas = 0;
    const cards = [1, 2, 3, 4, 5].map(n => {
      const ativa = quadraAtiva(cfgQuadras, n);
      const st = estadoQuadra(porId[n], ativa);
      if (ativa) ativas++;
      if (st.estado === 'jogando' || st.estado === 'pausada') emJogo++;
      if (st.estado === 'chamada') chamadas++;
      return courtCard(n, st);
    });
    el.innerHTML = cards.join('');

    const ocupadas = emJogo + chamadas;
    setKpi('quadras', `${ocupadas}<small>de ${ativas}</small>`,
      chamadas ? `${chamadas} aguardando o grupo chegar` : ocupadas ? 'Todas com jogo em andamento' : 'Todas livres');
    document.getElementById('dash-courts-meta').textContent =
      `${ativas} ${ativas === 1 ? 'ativa' : 'ativas'} · ${5 - ativas} ${5 - ativas === 1 ? 'desativada' : 'desativadas'}`;
  }

  // ── Fila (ao vivo) ─────────────────────────────────────
  unsubscribers.push(onValue(ref(db, 'fila'), snap => {
    const items = ordenarFila(fbPushToArray(snap.val()));
    const primeiro = items[0];
    setKpi('fila', `${items.length}<small>${items.length === 1 ? 'grupo' : 'grupos'}</small>`,
      primeiro?.criadoEmTs ? `1º aguarda há ${esperaDesde(primeiro.criadoEmTs)}` : items.length ? '' : 'Ninguém aguardando');
    renderFila(items);
  }));

  // ── Solicitações pendentes (ao vivo) ───────────────────
  unsubscribers.push(onValue(ref(db, 'solicitacoes'), snap => {
    const pendentes = fbPushToArray(snap.val()).filter(s => s.status === 'pendente').length;
    setKpi('pend', String(pendentes),
      pendentes ? `<a href="#solicitacoes">Revisar ${pendentes === 1 ? 'pedido' : 'pedidos'} →</a>` : 'Nenhum pedido aguardando');
    const badge = document.getElementById('badge-solicitacoes');
    if (badge) { badge.hidden = pendentes === 0; badge.textContent = pendentes; }
  }));

  // ── Histórico de hoje (uma leitura) ────────────────────
  try {
    const histSnap = await get(ref(db, 'historico'));
    const deHoje = fbToArray(histSnap.val())
      .filter(h => h && diaLocalISO(h.data) === hoje)
      .sort((a, b) => String(b.t || '').localeCompare(String(a.t || '')));
    const simples = deHoje.filter(h => Number(h.duracao) !== 60).length;
    const duplas = deHoje.length - simples;
    setKpi('hoje', String(deHoje.length),
      deHoje.length ? `${simples} simples · ${duplas} duplas` : 'Nenhuma encerrada ainda');
    renderHoje(deHoje);
  } catch (err) {
    setKpi('hoje', '—', 'Sem acesso ao histórico');
    const el = document.getElementById('dash-hoje');
    if (el) el.innerHTML = errorBox(err);
  }

  return () => {
    clearInterval(tick);
    unsubscribers.forEach(u => u());
  };
}

// ── Helpers ──────────────────────────────────────────────

function kpi(id, ico, label) {
  return `
    <div class="kpi">
      <div class="kpi-label">${icon(ico, 16)}${label}</div>
      <div class="kpi-value" id="dash-k-${id}"><span class="skel">00</span></div>
      <div class="kpi-meta" id="dash-k-${id}-meta"></div>
    </div>`;
}

function setKpi(id, valueHtml, metaHtml) {
  const v = document.getElementById(`dash-k-${id}`);
  const m = document.getElementById(`dash-k-${id}-meta`);
  if (v) v.innerHTML = valueHtml;
  if (m) m.innerHTML = metaHtml || '';
}

function renderHoje(items) {
  const el = document.getElementById('dash-hoje');
  const meta = document.getElementById('dash-hoje-meta');
  if (!el) return;

  const minutos = items.reduce((s, h) => s + (minutosEntre(h.t, h.f) ?? 0), 0);
  if (meta) meta.textContent = items.length ? `${duracaoCurta(minutos)} de quadra` : '';

  if (!items.length) {
    el.innerHTML = emptyState('history', 'Nenhuma partida encerrada hoje',
      'As partidas aparecem aqui assim que o fiscal encerra o jogo na quadra.', '', true);
    return;
  }

  const lista = items.slice(0, MAX_PARTIDAS);
  el.innerHTML = `
    <div class="table-scroll">
      <table class="table table-stack table-compact">
        <thead><tr><th>Horário</th><th>Quadra</th><th>Tipo</th><th>Jogadores</th></tr></thead>
        <tbody>
          ${lista.map(h => `
            <tr>
              <td data-label="Horário" class="cell-time">${escHtml(h.t || '—')}–${escHtml(h.f || '—')}</td>
              <td data-label="Quadra"><span class="tag">Q${escHtml(h.q)}</span></td>
              <td data-label="Tipo">${tipoBadge(h.duracao)}</td>
              <td data-label="Jogadores" class="td-lead">
                <div class="cell-main">${escHtml(nomesDe(h))}</div>
                ${detalhesDe(h) ? `<div class="cell-sub mono">${escHtml(detalhesDe(h))}</div>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${items.length > MAX_PARTIDAS ? `<div class="panel-foot"><span>Mostrando as ${MAX_PARTIDAS} mais recentes de ${items.length}</span><a class="panel-link" href="#historico">Ver todas ${icon('arrowRight', 14)}</a></div>` : ''}`;
}

function renderFila(items) {
  const el = document.getElementById('dash-fila');
  const meta = document.getElementById('dash-fila-meta');
  if (!el) return;
  if (meta) meta.textContent = items.length ? `${items.length} ${items.length === 1 ? 'grupo' : 'grupos'}` : '';

  if (!items.length) {
    el.innerHTML = emptyState('queue', 'Fila vazia',
      'Quando alguém se inscrever pelo app ou pelo fiscal, aparece aqui na ordem de chegada.', '', true);
    return;
  }

  el.innerHTML = `
    <ol class="qlist">
      ${items.slice(0, MAX_FILA).map((item, i) => `
        <li class="qitem">
          <span class="pos ${i === 0 ? 'pos-first' : ''}">${i + 1}</span>
          <div style="min-width:0">
            <div class="qnames">${escHtml(nomesDe(item))}</div>
            <div class="qmeta">${tipoBadge(item.duracao)}${detalhesDe(item) ? `<span class="mono">${escHtml(detalhesDe(item))}</span>` : ''}</div>
          </div>
          <div class="qwait">
            ${item.criadoEmTs
              ? `<div class="qwait-val">${esperaDesde(item.criadoEmTs)}</div><div class="qwait-lbl">esperando</div>`
              : `<div class="qwait-val">${escHtml(item.chegada || '—')}</div><div class="qwait-lbl">chegada</div>`}
          </div>
        </li>`).join('')}
    </ol>
    <div class="panel-foot">
      <span>${items.length > MAX_FILA ? `+ ${items.length - MAX_FILA} na fila` : 'Fila completa'}</span>
      <a class="panel-link" href="#fila">Abrir fila ao vivo ${icon('arrowRight', 14)}</a>
    </div>`;
}
