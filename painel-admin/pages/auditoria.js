/**
 * Auditoria — registro de ações administrativas (auditoria/, só admin).
 * Filtros por texto e período, linha do tempo por dia e exportação CSV.
 */

import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { fbPushToArray, filtrarPorPeriodo, formatDate, formatTime, calcularDiaChave, escHtml } from "../utils.js";
import { icon, emptyState, loading, errorBox, pagerHtml, rotuloDia, iniciais } from "../ui.js";

const PER_PAGE = 20;

export async function render(container, { db, showToast }) {
  container.innerHTML = `
    <div class="page">
      <header class="page-head">
        <div>
          <h1 class="page-title">Auditoria</h1>
          <p class="page-desc">Registro das ações administrativas: quem fez, o quê e quando. Este painel não edita nem apaga entradas.</p>
        </div>
        <div class="page-actions">
          <button id="aud-export-btn" class="btn btn-secondary">${icon('download', 16)}Exportar CSV</button>
        </div>
      </header>

      <section class="panel panel-flush">
        <div class="toolbar">
          <div class="input-icon grow">
            ${icon('search', 16)}
            <input id="aud-search" type="search" class="input" placeholder="Buscar por ação, detalhe ou responsável" aria-label="Buscar">
          </div>
          <div class="date-range">
            <input id="aud-de" type="date" class="input" aria-label="De">
            <span class="sep">até</span>
            <input id="aud-ate" type="date" class="input" aria-label="Até">
          </div>
          <button id="aud-clear" class="btn btn-ghost">Limpar</button>
        </div>
        <div class="toolbar-summary" id="aud-count">Carregando…</div>
        <div id="aud-table">${loading()}</div>
        <div id="aud-pagination"></div>
      </section>
    </div>`;

  const $ = id => document.getElementById(id);
  const hoje   = calcularDiaChave();
  const trinta = calcularDiaChave(new Date(Date.now() - 30 * 86400000));
  $('aud-de').value  = trinta;
  $('aud-ate').value = hoje;

  let allData = [];
  let filtered = [];
  let page = 1;

  try {
    const snap = await get(ref(db, 'auditoria'));
    allData = fbPushToArray(snap.val())
      .map(item => ({ ...item, data: item.ts ? new Date(item.ts).toISOString() : '' }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  } catch (err) {
    $('aud-count').hidden = true;
    $('aud-table').innerHTML = errorBox(err);
    return null;
  }

  applyFilters();
  setupListeners();

  function applyFilters() {
    page = 1;
    const q = ($('aud-search').value || '').toLowerCase();
    filtered = filtrarPorPeriodo(allData, $('aud-de').value || null, $('aud-ate').value || null);
    if (q) {
      filtered = filtered.filter(item =>
        (item.acao || '').toLowerCase().includes(q) ||
        (item.adminNome || '').toLowerCase().includes(q) ||
        (item.detalhes || '').toLowerCase().includes(q)
      );
    }
    renderTable();
  }

  function renderTable() {
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    page = Math.min(page, totalPages);
    const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const responsaveis = new Set(filtered.map(i => i.adminNome || i.adminUid).filter(Boolean)).size;
    $('aud-count').innerHTML = total
      ? `<span><b>${total}</b> ${total === 1 ? 'registro' : 'registros'}</span><span><b>${responsaveis}</b> ${responsaveis === 1 ? 'responsável' : 'responsáveis'}</span>`
      : '<span>Nenhum registro com estes filtros.</span>';

    if (!pageItems.length) {
      $('aud-table').innerHTML = !allData.length
        ? emptyState('shield', 'Nenhuma ação registrada ainda', 'Ações administrativas registradas aparecem aqui com data, hora e responsável.')
        : emptyState('filter', 'Nenhum registro no período', 'Amplie o período ou limpe a busca.',
            '<button class="btn btn-secondary btn-sm" data-action="limpar">Limpar filtros</button>');
      $('aud-pagination').innerHTML = '';
      return;
    }

    let html = '';
    let diaAtual = null;
    pageItems.forEach(item => {
      const dia = item.ts ? calcularDiaChave(new Date(item.ts)) : '';
      if (dia !== diaAtual) {
        diaAtual = dia;
        html += `<div class="log-day">${dia ? escHtml(rotuloDia(dia, hoje)) + (dia === hoje ? '' : ` · ${escHtml(formatDate(dia))}`) : 'Sem data'}</div>`;
      }
      html += `
        <div class="log-row">
          <span class="log-time">${escHtml(formatTime(item.data))}</span>
          <div style="min-width:0">
            <div class="log-action">${escHtml(item.acao || '—')}</div>
            ${item.detalhes ? `<div class="log-detail">${escHtml(item.detalhes)}</div>` : ''}
          </div>
          <span class="log-who"><span class="avatar avatar-sm avatar-primary">${escHtml(iniciais(item.adminNome || '?'))}</span>${escHtml(item.adminNome || '—')}</span>
        </div>`;
    });
    $('aud-table').innerHTML = html;
    $('aud-pagination').innerHTML = pagerHtml(page, totalPages, total, PER_PAGE, total === 1 ? 'registro' : 'registros');
  }

  function limpar() {
    $('aud-search').value = '';
    $('aud-de').value = trinta;
    $('aud-ate').value = hoje;
    applyFilters();
  }

  function setupListeners() {
    $('aud-search').addEventListener('input', applyFilters);
    $('aud-de').addEventListener('change', applyFilters);
    $('aud-ate').addEventListener('change', applyFilters);
    $('aud-clear').addEventListener('click', limpar);
    $('aud-table').addEventListener('click', e => { if (e.target.closest('[data-action="limpar"]')) limpar(); });
    $('aud-pagination').addEventListener('click', e => {
      const p = e.target.closest('[data-p]');
      if (p && !p.disabled) { page = Number(p.dataset.p); renderTable(); }
    });
    $('aud-export-btn').addEventListener('click', () => exportCSV(filtered, showToast));
  }

  return null;
}

function exportCSV(dados, showToast) {
  if (!dados.length) { showToast?.('Nenhum dado para exportar.', 'err'); return; }
  const header = ['Data', 'Hora', 'Admin UID', 'Admin Nome', 'Ação', 'Detalhes'];
  const rows = dados.map(item => [
    formatDate(item.data),
    formatTime(item.ts ? new Date(item.ts).toISOString() : ''),
    item.adminUid || '—',
    item.adminNome || '—',
    item.acao || '—',
    item.detalhes || '—',
  ]);
  const csv = [header, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria_${calcularDiaChave().replace(/-/g, '')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast?.('CSV exportado.', 'ok');
}
