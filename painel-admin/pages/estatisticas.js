/**
 * Estatísticas — métricas e gráficos calculados a partir do histórico real.
 *
 * Chart.js é carregado sob demanda (só nesta página). Os totais básicos vêm de
 * utils.calcularEstatisticas() (testado em Node.js); as distribuições por
 * horário, dia da semana e origem são contagens diretas dos mesmos registros.
 */

import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import {
  fbToArray, filtrarPorPeriodo, calcularEstatisticas, calcularDiaChave, diaLocalISO, escHtml,
} from "../utils.js";
import {
  icon, emptyState, loading, errorBox, minutosEntre, cssVar, onThemeChange,
} from "../ui.js";

const CHARTJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
const PRESETS = { '7': 7, '30': 30, '90': 90 };
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];
let chartInstances = [];

export async function render(container, { db }) {
  container.innerHTML = `
    <div class="page">
      <header class="page-head">
        <div>
          <h1 class="page-title">Estatísticas</h1>
          <p class="page-desc">Uso das quadras no período escolhido, calculado a partir das partidas registradas.</p>
        </div>
        <div class="page-actions">
          <div class="seg" role="group" aria-label="Período">
            <button type="button" data-preset="7">7 dias</button>
            <button type="button" data-preset="30">30 dias</button>
            <button type="button" data-preset="90">90 dias</button>
            <button type="button" data-preset="tudo">Tudo</button>
          </div>
          <div class="date-range" title="Período personalizado">
            <input id="est-de" type="date" class="input" aria-label="De">
            <span class="sep">até</span>
            <input id="est-ate" type="date" class="input" aria-label="Até">
          </div>
        </div>
      </header>

      <section class="panel kpis" id="est-kpis" aria-label="Resumo do período">${loading()}</section>
      <div id="est-body" class="stack">${loading('Carregando histórico…')}</div>
    </div>`;

  const $ = id => document.getElementById(id);
  const hoje = calcularDiaChave();
  const diasAtras = n => calcularDiaChave(new Date(Date.now() - n * 86400000));
  $('est-de').value  = diasAtras(30);
  $('est-ate').value = hoje;

  let allData;
  try {
    const snap = await get(ref(db, 'historico'));
    allData = fbToArray(snap.val()).filter(Boolean);
  } catch (err) {
    $('est-kpis').hidden = true;
    $('est-body').innerHTML = `<div class="panel">${errorBox(err)}</div>`;
    return null;
  }

  try {
    await loadChartJS();
  } catch (err) {
    $('est-body').innerHTML = `<div class="panel">${errorBox(err)}</div>`;
  }

  function marcarPreset() {
    const de = $('est-de').value, ate = $('est-ate').value;
    let ativo = null;
    if (!de && !ate) ativo = 'tudo';
    else if (ate === hoje) ativo = Object.keys(PRESETS).find(k => de === diasAtras(PRESETS[k])) || null;
    document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === ativo)));
  }

  function update() {
    const de  = $('est-de').value || null;
    const ate = $('est-ate').value || null;
    marcarPreset();

    const dados = filtrarPorPeriodo(allData, de, ate);
    const atual = analisar(dados);

    // Comparação só faz sentido com período fechado e dados no período anterior.
    let anterior = null, rotuloAnterior = '';
    if (de && ate) {
      const len = diffDias(de, ate) + 1;
      const prevAte = somaDias(de, -1);
      const prevDe = somaDias(de, -len);
      const prev = filtrarPorPeriodo(allData, prevDe, prevAte);
      if (prev.length) { anterior = analisar(prev); rotuloAnterior = `vs. ${len} dias anteriores`; }
    }

    renderKpis(atual, anterior, rotuloAnterior);
    renderBody(atual, de, ate);
  }

  update();

  $('est-de').addEventListener('change', update);
  $('est-ate').addEventListener('change', update);
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.preset;
    $('est-de').value  = p === 'tudo' ? '' : diasAtras(PRESETS[p]);
    $('est-ate').value = p === 'tudo' ? '' : hoje;
    update();
  }));
  const offTheme = onThemeChange(update);

  return () => {
    offTheme();
    destroyCharts();
  };
}

// ── Cálculos ─────────────────────────────────────────────

function analisar(dados) {
  const s = calcularEstatisticas(dados);
  let minutos = 0;
  const porHora = Array(24).fill(0);
  const porSemana = Array(7).fill(0);
  const porDiaTipo = {};
  const origem = { usuario: 0, admin: 0, sem: 0 };

  dados.forEach(h => {
    minutos += minutosEntre(h.t, h.f) ?? 0;
    const hh = /^(\d{1,2}):/.exec(String(h.t || ''));
    if (hh && Number(hh[1]) < 24) porHora[Number(hh[1])]++;
    const dia = diaLocalISO(h.data);
    if (dia) {
      porSemana[new Date(dia + 'T12:00:00Z').getUTCDay()]++;
      const d = porDiaTipo[dia] || (porDiaTipo[dia] = { s: 0, d: 0 });
      if (Number(h.duracao) === 60) d.d++; else d.s++;
    }
    if (h.origem === 'usuario') origem.usuario++;
    else if (h.origem === 'admin') origem.admin++;
    else origem.sem++;
  });

  return { ...s, minutos, porHora, porSemana, porDiaTipo, origem, diasComJogo: Object.keys(s.porDia).length };
}

function diffDias(a, b) {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
}
function somaDias(dia, n) {
  return new Date(Date.parse(dia + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}
function fmtDecimal(n) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function pct(parte, total) {
  return total ? Math.round(parte / total * 100) : 0;
}
function horasHtml(min) {
  if (!min) return '0<small>h</small>';
  if (min < 60) return `${min}<small>min</small>`;
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}<small>h${m ? ` ${String(m).padStart(2, '0')}` : ''}</small>`;
}

// ── Indicadores ──────────────────────────────────────────

function deltaChip(atual, anterior) {
  if (anterior == null) return '';
  if (anterior === 0) return '';
  const d = Math.round((atual - anterior) / anterior * 100);
  const cls = d > 0 ? 'delta-up' : d < 0 ? 'delta-down' : 'delta-flat';
  return `<span class="delta ${cls}">${d > 0 ? '+' : ''}${d}%</span>`;
}

function renderKpis(a, p, rotulo) {
  const el = document.getElementById('est-kpis');
  if (!el) return;
  const comp = (v, pv) => p ? `${deltaChip(v, pv)}<span>${rotulo}</span>` : '';
  const media = a.diasComJogo ? a.total / a.diasComJogo : 0;
  el.innerHTML = `
    <div class="kpi">
      <div class="kpi-label">${icon('history', 16)}Partidas</div>
      <div class="kpi-value">${a.total}</div>
      <div class="kpi-meta">${comp(a.total, p?.total) || (a.total ? `${a.simples} simples · ${a.duplas} duplas` : 'Nenhuma no período')}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">${icon('users', 16)}Jogadores diferentes</div>
      <div class="kpi-value">${a.participantes}</div>
      <div class="kpi-meta">${comp(a.participantes, p?.participantes) || 'por cadastro ou nome'}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">${icon('clock', 16)}Quadra ocupada</div>
      <div class="kpi-value">${horasHtml(a.minutos)}</div>
      <div class="kpi-meta">${comp(a.minutos, p?.minutos) || 'soma do início ao fim de cada partida'}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">${icon('calendar', 16)}Média por dia de jogo</div>
      <div class="kpi-value">${a.diasComJogo ? fmtDecimal(media) : '0'}<small>partidas</small></div>
      <div class="kpi-meta">${a.diasComJogo} ${a.diasComJogo === 1 ? 'dia' : 'dias'} com partidas</div>
    </div>`;
}

// ── Corpo da página ──────────────────────────────────────

function renderBody(a, de, ate) {
  const body = document.getElementById('est-body');
  if (!body) return;
  destroyCharts();

  if (!a.total) {
    body.innerHTML = `<section class="panel">${emptyState('chart', 'Nenhuma partida neste período',
      'Escolha um período maior ou "Tudo" para ver o uso das quadras.')}</section>`;
    return;
  }

  const serie = montarSerie(a.porDiaTipo, de, ate);
  const horas = faixaHoras(a.porHora);

  body.innerHTML = `
    <div class="grid grid-main">
      <section class="panel panel-fill">
        <div class="panel-head">
          <h2 class="panel-title">${serie.semanal ? 'Partidas por semana' : 'Partidas por dia'}</h2>
          <span class="spacer"></span>
          <div class="legend"><span><i style="background:var(--primary)"></i>Simples</span><span><i style="background:var(--clay)"></i>Duplas</span></div>
        </div>
        <div class="panel-body"><div class="chart-box"><canvas id="chart-por-dia" aria-label="Partidas por período" role="img"></canvas></div></div>
      </section>

      <div class="stack">
        <section class="panel">
          <div class="panel-head"><h2 class="panel-title">Simples e duplas</h2></div>
          <div class="panel-body">
            <div class="split" aria-hidden="true">
              <span style="width:${pct(a.total - a.duplas, a.total)}%;background:var(--primary)"></span>
              <span style="width:${pct(a.duplas, a.total)}%;background:var(--clay)"></span>
            </div>
            <div class="split-figures">
              <div>
                <div class="split-fig-label"><i style="background:var(--primary)"></i>Simples · 45 min</div>
                <div class="split-fig-value">${a.total - a.duplas}<small>${pct(a.total - a.duplas, a.total)}%</small></div>
              </div>
              <div>
                <div class="split-fig-label"><i style="background:var(--clay)"></i>Duplas · 60 min</div>
                <div class="split-fig-value">${a.duplas}<small>${pct(a.duplas, a.total)}%</small></div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2 class="panel-title">Uso por quadra</h2></div>
          <div class="panel-body">${barras([1, 2, 3, 4, 5].map(n => ({ label: `Quadra ${n}`, valor: a.porQuadra[String(n)] || 0 })), a.total)}</div>
        </section>
      </div>
    </div>

    <div class="grid grid-main">
      <section class="panel panel-fill">
        <div class="panel-head">
          <h2 class="panel-title">Horário de início</h2>
          <span class="panel-meta">${horaPico(a.porHora)}</span>
        </div>
        <div class="panel-body"><div class="chart-box chart-box-sm"><canvas id="chart-hora" aria-label="Partidas por horário de início" role="img"></canvas></div></div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2 class="panel-title">Dia da semana</h2></div>
        <div class="panel-body">${barras(ORDEM_SEMANA.map(i => ({ label: SEMANA[i], valor: a.porSemana[i] })), a.total)}</div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Origem das inscrições</h2>
        <span class="panel-meta">quem colocou o grupo na fila</span>
      </div>
      <div class="panel-body">
        <div class="split" aria-hidden="true">
          <span style="width:${pct(a.origem.usuario, a.total)}%;background:var(--primary)"></span>
          <span style="width:${pct(a.origem.admin, a.total)}%;background:var(--text-3)"></span>
          <span style="width:${pct(a.origem.sem, a.total)}%;background:var(--border-strong)"></span>
        </div>
        <div class="split-figures">
          ${figura('Pelo app do morador', a.origem.usuario, a.total, 'var(--primary)')}
          ${figura('Pelo fiscal', a.origem.admin, a.total, 'var(--text-3)')}
          ${a.origem.sem ? figura('Sem registro', a.origem.sem, a.total, 'var(--border-strong)') : ''}
        </div>
      </div>
      ${a.origem.sem ? `<div class="panel-foot"><span>${a.origem.sem} ${a.origem.sem === 1 ? 'partida deste período foi registrada' : 'partidas deste período foram registradas'} antes de o sistema passar a gravar a origem da inscrição.</span></div>` : ''}
    </section>`;

  if (window.Chart) {
    desenharSerie(serie);
    desenharHoras(horas);
  }
}

function barras(itens, total) {
  const max = Math.max(1, ...itens.map(i => i.valor));
  return `<div class="bars">${itens.map(i => `
    <div class="bar-row">
      <span class="bar-label">${escHtml(i.label)}</span>
      <span class="bar-track"><span class="bar-fill${i.muted ? ' is-muted' : ''}" style="width:${(i.valor / max * 100).toFixed(1)}%"></span></span>
      <span class="bar-val">${i.valor}<small>${pct(i.valor, total)}%</small></span>
    </div>`).join('')}</div>`;
}

function figura(label, valor, total, cor) {
  return `
    <div>
      <div class="split-fig-label"><i style="background:${cor}"></i>${escHtml(label)}</div>
      <div class="split-fig-value">${valor}<small>${pct(valor, total)}%</small></div>
    </div>`;
}

function horaPico(porHora) {
  const max = Math.max(...porHora);
  if (!max) return '';
  const h = porHora.indexOf(max);
  return `Pico: ${String(h).padStart(2, '0')}h às ${String(h + 1).padStart(2, '0')}h`;
}

/** Dias corridos do período (inclusive os sem partida). Acima de 120 dias, agrupa por semana. */
function montarSerie(porDiaTipo, de, ate) {
  const dias = Object.keys(porDiaTipo).sort();
  const ini = de || dias[0];
  const fim = ate || dias[dias.length - 1];
  const total = diffDias(ini, fim) + 1;
  const semanal = total > 120;
  const buckets = new Map();
  for (let i = 0; i < total; i++) {
    const dia = somaDias(ini, i);
    let chave = dia;
    if (semanal) {
      const wd = new Date(dia + 'T12:00:00Z').getUTCDay();
      chave = somaDias(dia, -((wd + 6) % 7)); // segunda-feira
    }
    const b = buckets.get(chave) || { s: 0, d: 0 };
    const v = porDiaTipo[dia];
    if (v) { b.s += v.s; b.d += v.d; }
    buckets.set(chave, b);
  }
  const chaves = [...buckets.keys()];
  return {
    semanal,
    labels: chaves.map(k => `${k.slice(8, 10)}/${k.slice(5, 7)}`),
    simples: chaves.map(k => buckets.get(k).s),
    duplas: chaves.map(k => buckets.get(k).d),
  };
}

function faixaHoras(porHora) {
  let ini = 7, fim = 22;
  porHora.forEach((v, h) => { if (v) { ini = Math.min(ini, h); fim = Math.max(fim, h); } });
  const horas = [];
  for (let h = ini; h <= fim; h++) horas.push(h);
  return { labels: horas.map(h => `${h}h`), valores: horas.map(h => porHora[h]) };
}

// ── Gráficos ─────────────────────────────────────────────

function cores() {
  return {
    primary: cssVar('--primary'),
    clay: cssVar('--clay'),
    grid: cssVar('--chart-grid'),
    tick: cssVar('--text-3'),
    text: cssVar('--text'),
    text2: cssVar('--text-2'),
    surface: cssVar('--surface'),
    border: cssVar('--border'),
  };
}

function baseOpts(c, { stacked = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.surface,
        borderColor: c.border,
        borderWidth: 1,
        titleColor: c.text,
        bodyColor: c.text2,
        padding: 10,
        cornerRadius: 8,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { family: 'Inter', weight: '600', size: 12.5 },
        bodyFont: { family: 'Inter', size: 12.5 },
      },
    },
    scales: {
      x: {
        stacked,
        grid: { display: false },
        border: { color: c.border },
        ticks: { color: c.tick, font: { family: 'Inter', size: 11.5 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 12 },
      },
      y: {
        stacked,
        beginAtZero: true,
        grid: { color: c.grid },
        border: { display: false },
        ticks: { color: c.tick, font: { family: 'Inter', size: 11.5 }, precision: 0, padding: 6 },
      },
    },
  };
}

function desenharSerie(serie) {
  const el = document.getElementById('chart-por-dia');
  if (!el) return;
  const c = cores();
  const bar = { borderRadius: 3, borderSkipped: false, maxBarThickness: 26, categoryPercentage: .78, barPercentage: .9 };
  chartInstances.push(new Chart(el, {
    type: 'bar',
    data: {
      labels: serie.labels,
      datasets: [
        { label: 'Simples', data: serie.simples, backgroundColor: c.primary, ...bar },
        { label: 'Duplas', data: serie.duplas, backgroundColor: c.clay, ...bar },
      ],
    },
    options: baseOpts(c, { stacked: true }),
  }));
}

function desenharHoras(horas) {
  const el = document.getElementById('chart-hora');
  if (!el) return;
  const c = cores();
  const opts = baseOpts(c);
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.raw} ${ctx.raw === 1 ? 'partida' : 'partidas'}` };
  chartInstances.push(new Chart(el, {
    type: 'bar',
    data: {
      labels: horas.labels,
      datasets: [{ label: 'Partidas', data: horas.valores, backgroundColor: c.primary, borderRadius: 3, maxBarThickness: 22 }],
    },
    options: opts,
  }));
}

function destroyCharts() {
  chartInstances.forEach(ch => { try { ch.destroy(); } catch {} });
  chartInstances = [];
}

async function loadChartJS() {
  if (window.Chart) return;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CHARTJS_CDN;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Falha ao carregar a biblioteca de gráficos.'));
    document.head.appendChild(s);
  });
}
