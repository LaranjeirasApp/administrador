/**
 * Histórico de partidas — filtros, paginação e exportação Excel.
 *
 * Lê historico[] uma vez (dados históricos não mudam com a página aberta).
 * Toda filtragem e paginação é feita no cliente.
 * Exportação usa a mesma biblioteca xlsx-js-style do painel atual.
 */

import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import {
  fbToArray, filtrarPorPeriodo, formatDate, formatTime,
  formatDuration, escHtml, normalizarNome, calcularDiaChave
} from "../utils.js";
import {
  icon, nomesDe, detalhesDe, tipoBadge, origemBadge, emptyState, loading, errorBox,
  pagerHtml, minutosEntre, duracaoCurta, diaSemanaCurto,
} from "../ui.js";

const PER_PAGE = 15;
const PRESETS = { '7': 7, '30': 30, '90': 90 };

export async function render(container, { db, showToast }) {
  container.innerHTML = `
    <div class="page">
      <header class="page-head">
        <div>
          <h1 class="page-title">Histórico</h1>
          <p class="page-desc">Todas as partidas encerradas pelo fiscal, com horário, quadra e jogadores.</p>
        </div>
        <div class="page-actions">
          <button id="hist-export-btn" class="btn btn-secondary">${icon('download', 16)}Exportar Excel</button>
        </div>
      </header>

      <section class="panel panel-flush">
        <div class="toolbar">
          <div class="tb-group tb-group-main">
            <div class="input-icon grow">
              ${icon('search', 16)}
              <input id="hist-search" type="search" class="input" placeholder="Buscar jogador pelo nome" aria-label="Buscar jogador">
            </div>
            <select id="hist-tipo" class="select select-auto" aria-label="Tipo">
              <option value="">Simples e duplas</option>
              <option value="45">Só simples</option>
              <option value="60">Só duplas</option>
            </select>
            <select id="hist-quadra" class="select select-auto" aria-label="Quadra">
              <option value="">Todas as quadras</option>
              ${[1, 2, 3, 4, 5].map(n => `<option value="${n}">Quadra ${n}</option>`).join('')}
            </select>
          </div>
          <div class="tb-group">
            <div class="seg" role="group" aria-label="Período">
              <button type="button" data-preset="7">7 dias</button>
              <button type="button" data-preset="30">30 dias</button>
              <button type="button" data-preset="90">90 dias</button>
              <button type="button" data-preset="tudo">Tudo</button>
            </div>
            <div class="date-range" title="Período personalizado">
              <input id="hist-de" type="date" class="input" aria-label="De">
              <span class="sep">até</span>
              <input id="hist-ate" type="date" class="input" aria-label="Até">
            </div>
            <button id="hist-clear" class="btn btn-ghost">Limpar</button>
          </div>
        </div>
        <div class="toolbar-summary" id="hist-summary">Carregando…</div>
        <div id="hist-table">${loading()}</div>
        <div id="hist-pagination"></div>
      </section>
    </div>`;

  const hoje = calcularDiaChave();
  const diasAtras = n => calcularDiaChave(new Date(Date.now() - n * 86400000));
  const trinta = diasAtras(30);
  const $ = id => document.getElementById(id);
  $('hist-de').value  = trinta;
  $('hist-ate').value = hoje;

  let allData = [];
  let filtered = [];
  let page = 1;

  try {
    const snap = await get(ref(db, 'historico'));
    // mais recente primeiro, independente da ordem gravada no banco
    allData = fbToArray(snap.val()).filter(Boolean)
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  } catch (err) {
    $('hist-summary').hidden = true;
    $('hist-table').innerHTML = errorBox(err);
    return null;
  }

  applyFilters();
  setupEventListeners();

  function marcarPreset() {
    const de = $('hist-de').value, ate = $('hist-ate').value;
    let ativo = null;
    if (!de && !ate) ativo = 'tudo';
    else if (ate === hoje) ativo = Object.keys(PRESETS).find(k => de === diasAtras(PRESETS[k])) || null;
    document.querySelectorAll('[data-preset]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.preset === ativo));
    });
  }

  function applyFilters() {
    page = 1;
    const q = normalizarNome($('hist-search').value);
    const de  = $('hist-de').value;
    const ate = $('hist-ate').value;
    const tipo = $('hist-tipo').value;
    const quadra = $('hist-quadra').value;

    filtered = filtrarPorPeriodo(allData, de || null, ate || null);

    if (q) {
      filtered = filtered.filter(h => {
        const nomes = normalizarNome(h.n || h.nomes || '');
        const jNomes = (h.jogadores || []).map(j => normalizarNome(j.nome || j)).join(' ');
        return nomes.includes(q) || jNomes.includes(q);
      });
    }
    if (tipo) filtered = filtered.filter(h => String(h.duracao) === tipo);
    if (quadra) filtered = filtered.filter(h => String(h.q) === quadra);

    marcarPreset();
    renderSummary();
    renderTable();
  }

  function renderSummary() {
    const el = $('hist-summary');
    el.hidden = !allData.length;
    if (!filtered.length) { el.innerHTML = '<span>Nenhuma partida com estes filtros.</span>'; return; }
    const duplas = filtered.filter(h => Number(h.duracao) === 60).length;
    const minutos = filtered.reduce((s, h) => s + (minutosEntre(h.t, h.f) ?? 0), 0);
    el.innerHTML = `
      <span><b>${filtered.length}</b> ${filtered.length === 1 ? 'partida' : 'partidas'}</span>
      <span><b>${filtered.length - duplas}</b> simples</span>
      <span><b>${duplas}</b> duplas</span>
      <span><b>${duracaoCurta(minutos)}</b> de quadra ocupada</span>`;
  }

  function renderTable() {
    const tableEl = $('hist-table');
    const pagEl = $('hist-pagination');

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    page = Math.min(page, totalPages);
    const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    if (!pageItems.length) {
      const semNada = !allData.length;
      tableEl.innerHTML = semNada
        ? emptyState('history', 'Ainda não há partidas registradas', 'Cada jogo encerrado pelo fiscal entra aqui automaticamente.')
        : emptyState('filter', 'Nenhuma partida encontrada', 'Tente ampliar o período ou remover algum filtro.',
            '<button class="btn btn-secondary btn-sm" data-action="limpar">Limpar filtros</button>');
      pagEl.innerHTML = '';
      return;
    }

    tableEl.innerHTML = `
      <div class="table-scroll">
        <table class="table table-stack table-compact">
          <thead>
            <tr><th>Data</th><th>Horário</th><th>Quadra</th><th>Tipo</th><th>Jogadores</th><th>Origem</th></tr>
          </thead>
          <tbody>
            ${pageItems.map(h => `
              <tr>
                <td data-label="Data" class="nowrap"><span><span class="num">${escHtml(formatDate(h.data))}</span> <span class="muted">${escHtml(diaSemanaCurto(h.data))}</span></span></td>
                <td data-label="Horário" class="cell-time">${escHtml(h.t || formatTime(h.data))}–${escHtml(h.f || '—')}</td>
                <td data-label="Quadra"><span class="tag">Q${escHtml(h.q)}</span></td>
                <td data-label="Tipo">${tipoBadge(h.duracao)}</td>
                <td data-label="Jogadores" class="td-lead">
                  <div class="cell-main">${escHtml(nomesDe(h))}</div>
                  ${detalhesDe(h) ? `<div class="cell-sub mono">${escHtml(detalhesDe(h))}</div>` : ''}
                </td>
                <td data-label="Origem">${origemBadge(h.origem)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    pagEl.innerHTML = pagerHtml(page, totalPages, total, PER_PAGE, total === 1 ? 'partida' : 'partidas');
  }

  function limpar() {
    $('hist-search').value = '';
    $('hist-de').value = trinta;
    $('hist-ate').value = hoje;
    $('hist-tipo').value = '';
    $('hist-quadra').value = '';
    applyFilters();
  }

  function setupEventListeners() {
    $('hist-search').addEventListener('input', applyFilters);
    ['hist-de', 'hist-ate', 'hist-tipo', 'hist-quadra'].forEach(id => $(id).addEventListener('change', applyFilters));
    document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      const p = b.dataset.preset;
      $('hist-de').value = p === 'tudo' ? '' : diasAtras(PRESETS[p]);
      $('hist-ate').value = p === 'tudo' ? '' : hoje;
      applyFilters();
    }));
    $('hist-clear').addEventListener('click', limpar);
    $('hist-table').addEventListener('click', e => { if (e.target.closest('[data-action="limpar"]')) limpar(); });
    $('hist-pagination').addEventListener('click', e => {
      const p = e.target.closest('[data-p]');
      if (p && !p.disabled) { page = Number(p.dataset.p); renderTable(); $('hist-table').scrollIntoView({ block: 'nearest' }); }
    });
    $('hist-export-btn').addEventListener('click', () => exportarExcel(filtered, showToast));
  }

  return null;
}

// ── Exportação Excel ─────────────────────────────────────

function exportarExcel(dados, showToast) {
  if (typeof XLSX === 'undefined') {
    showToast?.('Biblioteca de exportação não carregada.', 'err');
    return;
  }
  if (!dados.length) {
    showToast?.('Nenhum dado para exportar.', 'err');
    return;
  }

  try {
    const wb = XLSX.utils.book_new();

    const linhas = [
      ['Data', 'Início', 'Fim', 'Quadra', 'Tipo', 'Duração', 'Jogadores', 'Origem'],
      ...dados.map(h => [
        formatDate(h.data),
        h.t || formatTime(h.data),
        h.f || '—',
        `Q${h.q}`,
        h.duracao === 60 ? 'Duplas' : 'Simples',
        formatDuration(h.duracao),
        nomesDe(h),
        h.origem === 'usuario' ? 'App' : h.origem === 'admin' ? 'Painel' : '—',
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Histórico');

    const linhasP = [['Data', 'Quadra', 'Tipo', 'Nome', 'Quadra/Lote', 'pessoaId']];
    dados.forEach(h => {
      (h.jogadores || []).forEach(j => {
        linhasP.push([
          formatDate(h.data),
          `Q${h.q}`,
          h.duracao === 60 ? 'Duplas' : 'Simples',
          j.nome || j || '—',
          j.quadra && j.lote ? `${j.quadra}/${j.lote}` : '—',
          j.pessoaId || '—',
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhasP), 'Participantes');

    XLSX.writeFile(wb, `Historico_Laranjeiras_${calcularDiaChave().replace(/-/g, '')}.xlsx`);
    showToast?.('Planilha exportada.', 'ok');
  } catch (err) {
    console.error('exportarExcel:', err);
    showToast?.('Erro ao exportar: ' + err.message, 'err');
  }
}
