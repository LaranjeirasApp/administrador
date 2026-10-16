/**
 * Fila ao vivo — monitoramento em tempo real.
 * Somente leitura: chamar, iniciar e encerrar continuam no app do fiscal.
 */

import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { fbToArray, fbPushToArray, escHtml } from "../utils.js";
import {
  courtCard, estadoQuadra, quadraAtiva, nomesDe, detalhesDe, ordenarFila,
  tipoBadge, origemBadge, emptyState, loading, esperaDesde,
} from "../ui.js";

export async function render(container, { db }) {
  container.innerHTML = `
    <div class="page">
      <header class="page-head">
        <div>
          <h1 class="page-title">Fila ao vivo</h1>
          <p class="page-desc">Estado das quadras e ordem de espera, atualizados em tempo real. Chamar, iniciar e encerrar partidas continua sendo feito pelo app do fiscal.</p>
        </div>
      </header>

      <section class="courts courts-lg" id="fila-courts" aria-label="Quadras">${loading()}</section>

      <section class="panel panel-flush">
        <div class="panel-head">
          <h2 class="panel-title">Ordem de espera</h2>
          <span class="panel-meta" id="fila-meta"></span>
        </div>
        <div id="fila-list">${loading()}</div>
      </section>
    </div>`;

  const unsubscribers = [];
  let quadras = null;
  let cfgQuadras = null;
  let fila = null;

  unsubscribers.push(onValue(ref(db, 'config/quadras'), snap => { cfgQuadras = snap.val() || {}; renderCourts(); }));
  unsubscribers.push(onValue(ref(db, 'quadras'), snap => { quadras = fbToArray(snap.val()); renderCourts(); }));
  unsubscribers.push(onValue(ref(db, 'fila'), snap => { fila = ordenarFila(fbPushToArray(snap.val())); renderFila(); }));

  // relógio das quadras a cada segundo; tempo de espera da fila a cada 30 s
  let segundos = 0;
  const tick = setInterval(() => {
    renderCourts();
    if (++segundos % 30 === 0) renderFila();
  }, 1000);

  function renderCourts() {
    const el = document.getElementById('fila-courts');
    if (!el || quadras === null || cfgQuadras === null) return;
    const porId = {};
    quadras.forEach((q, i) => { if (q) porId[q.id || i + 1] = q; });
    el.innerHTML = [1, 2, 3, 4, 5]
      .map(n => courtCard(n, estadoQuadra(porId[n], quadraAtiva(cfgQuadras, n))))
      .join('');
  }

  function renderFila() {
    const el = document.getElementById('fila-list');
    const meta = document.getElementById('fila-meta');
    if (!el || fila === null) return;

    const duplas = fila.filter(i => Number(i.duracao) === 60).length;
    if (meta) meta.textContent = fila.length
      ? `${fila.length} ${fila.length === 1 ? 'grupo' : 'grupos'} · ${fila.length - duplas} simples · ${duplas} duplas`
      : '';

    if (!fila.length) {
      el.innerHTML = emptyState('queue', 'Ninguém aguardando',
        'As inscrições feitas pelo app do morador ou pelo fiscal aparecem aqui, na ordem em que chegaram.');
      return;
    }

    el.innerHTML = `
      <div class="table-scroll">
        <table class="table table-stack table-compact">
          <thead>
            <tr><th class="w-1">#</th><th>Jogadores</th><th>Tipo</th><th>Inscrição</th><th>Esperando</th><th>Origem</th></tr>
          </thead>
          <tbody>
            ${fila.map((item, idx) => `
              <tr>
                <td data-label="Posição" class="w-1 td-pos"><span class="pos ${idx === 0 ? 'pos-first' : ''}">${idx + 1}</span></td>
                <td data-label="Jogadores" class="td-lead">
                  <div class="cell-main">${escHtml(nomesDe(item))}</div>
                  ${detalhesDe(item) ? `<div class="cell-sub mono">${escHtml(detalhesDe(item))}</div>` : ''}
                </td>
                <td data-label="Tipo">${tipoBadge(item.duracao)}</td>
                <td data-label="Inscrição" class="cell-time"><span><span class="m-only muted" style="font-family:var(--ff-body)">inscrito às </span>${escHtml(item.chegada || '—')}</span></td>
                <td data-label="Esperando" class="num">${item.criadoEmTs ? `<span><span class="m-only muted">esperando </span>${esperaDesde(item.criadoEmTs)}</span>` : '<span class="muted">—</span>'}</td>
                <td data-label="Origem">${origemBadge(item.origem)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  return () => {
    clearInterval(tick);
    unsubscribers.forEach(u => u());
  };
}
