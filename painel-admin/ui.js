/**
 * Componentes visuais compartilhados entre as páginas.
 * Só apresentação: nada aqui lê ou grava no Firebase.
 */

import { escHtml } from "./utils.js";

// ── Ícones (traço 1.8, grade 24) ─────────────────────────
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/>',
  court: '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M12 4v16"/><path d="M2.5 8h19M2.5 16h19"/><path d="M7 8v8M17 8v8M7 12h10"/>',
  queue: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.64-6.36L3 8.3"/><path d="M3 3.5v4.8h4.8"/><path d="M12 7.5V12l3.2 2"/>',
  chart: '<path d="M3.5 3.5v17h17"/><path d="M8 16v-4M12.5 16V7M17 16v-6.5"/>',
  home: '<path d="M3.5 10.2 12 3.5l8.5 6.7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  inbox: '<path d="M21.5 13h-5.5l-1.8 2.5H9.8L8 13H2.5"/><path d="M5.6 5.2 2.5 13v5a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-5l-3.1-7.8A2 2 0 0 0 16.5 4h-9a2 2 0 0 0-1.9 1.2z"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  shield: '<path d="M12 21.5s8-3.8 8-9.8V5.2L12 2.5 4 5.2v6.5c0 6 8 9.8 8 9.8z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
  download: '<path d="M12 3.5v11.5"/><path d="m7 10.5 5 5 5-5"/><path d="M4 20.5h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.7 6.7 0 0 0 10.7 10.7z"/>',
  logout: '<path d="M9.5 20.5H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h4.5"/><path d="m16 16.5 4.5-4.5L16 7.5"/><path d="M20.5 12H9.5"/>',
  menu: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowRight: '<path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  check: '<path d="M20 6.5 9.5 17 4 11.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.2 12.2 2.6 2.6 5-5.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  users: '<path d="M16.5 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.2a3.7 3.7 0 0 0-3.7 3.7v1.8"/><circle cx="9.5" cy="7.5" r="3.7"/><path d="M21.5 20.5v-1.8a3.7 3.7 0 0 0-2.8-3.6M15.8 3.9a3.7 3.7 0 0 1 0 7.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  link: '<path d="M10 13.5a4.5 4.5 0 0 0 6.8.5l2.7-2.7a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5"/><path d="M14 10.5a4.5 4.5 0 0 0-6.8-.5l-2.7 2.7a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5"/>',
  alert: '<path d="M10.3 4 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16.5v-5M12 8h.01"/>',
  pin: '<path d="M19.5 10c0 5.5-7.5 11.5-7.5 11.5S4.5 15.5 4.5 10a7.5 7.5 0 0 1 15 0z"/><circle cx="12" cy="10" r="2.6"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  external: '<path d="M14 3.5h6.5V10"/><path d="M20.5 3.5 11 13"/><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/>',
  filter: '<path d="M3.5 5h17l-6.5 8v6l-4 1.5V13z"/>',
  trash: '<path d="M4 6.5h16"/><path d="M9.5 6.5V4h5v2.5"/><path d="M6.2 6.5 7.2 20h9.6l1-13.5"/><path d="M10 10.5v6M14 10.5v6"/>',
  sortNone: '<path d="m7.5 15 4.5 4.5 4.5-4.5"/><path d="m7.5 9 4.5-4.5L16.5 9"/>',
  sortAsc: '<path d="M12 19V5.5"/><path d="m6 11.5 6-6 6 6"/>',
  sortDesc: '<path d="M12 5v13.5"/><path d="m18 12.5-6 6-6-6"/>',
};

export function icon(name, size = 18, cls = '') {
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// ── Pequenos formatos ────────────────────────────────────
export function iniciais(nome) {
  const partes = String(nome || '').trim().split(/[\s.@_-]+/).filter(Boolean);
  if (!partes.length) return '?';
  const a = partes[0][0] || '';
  const b = partes.length > 1 ? partes[partes.length - 1][0] : (partes[0][1] || '');
  return (a + b).toUpperCase();
}

export function mmss(segundos) {
  const s = Math.max(0, Math.round(segundos || 0));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Minutos entre "HH:MM" e "HH:MM" (vira a meia-noite se precisar). null se inválido. */
export function minutosEntre(t, f) {
  const re = /^(\d{1,2}):(\d{2})/;
  const a = re.exec(String(t || '')), b = re.exec(String(f || ''));
  if (!a || !b) return null;
  let d = (Number(b[1]) * 60 + Number(b[2])) - (Number(a[1]) * 60 + Number(a[2]));
  if (d < 0) d += 1440;
  return d > 0 && d <= 300 ? d : null;
}

/** "1 h 05" / "42 min" */
export function duracaoCurta(min) {
  if (min == null) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Tempo decorrido desde um timestamp, em texto curto ("18 min", "1 h 05"). */
export function esperaDesde(ts) {
  if (!ts) return '';
  const min = Math.max(0, Math.floor((Date.now() - Number(ts)) / 60000));
  return min < 1 ? 'agora' : duracaoCurta(min);
}

/** Rótulo de dia a partir de "AAAA-MM-DD": "Hoje", "Ontem" ou "qua., 12 de out.". */
export function rotuloDia(diaISO, hojeISO) {
  if (diaISO === hojeISO) return 'Hoje';
  const ontem = new Date(new Date(hojeISO + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
  if (diaISO === ontem) return 'Ontem';
  return new Date(diaISO + 'T12:00:00Z').toLocaleDateString('pt-BR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

export function diaSemanaCurto(isoOuDia) {
  const s = String(isoOuDia || '');
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00Z') : new Date(s);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(s) ? 'UTC' : 'America/Sao_Paulo' }).replace('.', '');
}

// ── Jogadores / fila ─────────────────────────────────────
export function nomesDe(item) {
  if (!item) return '—';
  if (item.n) return item.n;
  if (item.nomes) return item.nomes;
  if (item.jogadores?.length) return item.jogadores.map(j => j?.nome || j).filter(Boolean).join(' • ');
  return '—';
}

export function detalhesDe(item) {
  if (!item) return '';
  if (item.detalhes) return item.detalhes;
  if (item.qls?.length) return item.qls.filter(Boolean).join(' · ');
  return '';
}

/** Mesma ordem do app do fiscal: carimbo do servidor; sem carimbo vai na frente, pela chave. */
export function ordenarFila(items) {
  return [...items].sort((a, b) => {
    const ta = a?.criadoEmTs, tb = b?.criadoEmTs;
    if (typeof ta === 'number' && typeof tb === 'number') return ta - tb;
    if (typeof ta === 'number') return 1;
    if (typeof tb === 'number') return -1;
    return String(a._key) < String(b._key) ? -1 : String(a._key) > String(b._key) ? 1 : 0;
  });
}

export function tipoBadge(duracao) {
  return Number(duracao) === 60
    ? '<span class="badge badge-clay">Duplas</span>'
    : '<span class="badge badge-neutral">Simples</span>';
}

export function origemBadge(origem) {
  if (origem === 'usuario') return '<span class="badge badge-dot badge-primary">App</span>';
  if (origem === 'admin') return '<span class="badge badge-dot badge-neutral">Fiscal</span>';
  return '<span class="muted">—</span>';
}

// ── Quadras ──────────────────────────────────────────────
/** Mesma regra do app do fiscal: sem configuração, 1–3 ativas e 4–5 desativadas. */
export function quadraAtiva(cfgQuadras, n) {
  const v = cfgQuadras?.[n]?.ativa;
  return typeof v === 'boolean' ? v : n <= 3;
}

/** Estado de exibição de uma quadra a partir do nó quadras/{i}. */
export function estadoQuadra(q, ativa = true) {
  if (!q?.ocupada) return { estado: ativa ? 'livre' : 'off' };
  const jogo = q.jogo || {};
  const base = {
    nomes: nomesDe(jogo),
    detalhes: detalhesDe(jogo),
    duracao: jogo.duracao || 45,
    inicio: q.hEntrada || '',
    fim: q.hSaida || '',
  };
  if (q.pausada) {
    return { ...base, estado: 'pausada', restante: Math.max(0, q.tempoRestante || 0) };
  }
  if (q.rodando) {
    // "tempoRestante" é uma fotografia antiga; o término absoluto não envelhece.
    const restante = q.horaTerminoAbsoluta
      ? Math.max(0, Math.round((q.horaTerminoAbsoluta - Date.now()) / 1000))
      : Math.max(0, q.tempoRestante || 0);
    const total = base.duracao * 60;
    return { ...base, estado: 'jogando', restante, progresso: Math.min(1, Math.max(0, 1 - restante / total)) };
  }
  const prazo = q.checkinPrazo ? Math.max(0, Math.round((q.checkinPrazo - Date.now()) / 1000)) : null;
  return { ...base, estado: 'chamada', prazo, chamadoEm: q.chamadoEm || null };
}

const ESTADO_ROTULO = {
  livre:   '<span class="badge badge-dot badge-ok">Livre</span>',
  jogando: '<span class="badge badge-dot badge-primary">Em jogo</span>',
  chamada: '<span class="badge badge-dot badge-warn">Chamada</span>',
  pausada: '<span class="badge badge-dot badge-neutral">Pausada</span>',
  off:     '<span class="badge badge-neutral">Desativada</span>',
};

export function courtSvg() {
  return `<svg class="court-svg" viewBox="0 0 120 56" aria-hidden="true">
    <rect x="1" y="1" width="118" height="54" rx="4" class="cs-fill"/>
    <g class="cs-lines" fill="none">
      <rect x="6" y="6" width="108" height="44"/>
      <path d="M6 11.5h108M6 44.5h108M31 11.5v33M89 11.5v33M31 28h58"/>
    </g>
    <path d="M60 3v50" class="cs-net"/>
  </svg>`;
}

function horaDe(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

/** Cartão de quadra. `st` vem de estadoQuadra(). */
export function courtCard(n, st) {
  const e = st.estado;
  let corpo = '';
  if (e === 'livre') {
    corpo = `<div class="court-idle">Disponível para a próxima chamada</div>`;
  } else if (e === 'off') {
    corpo = `<div class="court-idle">Fora do formulário de inscrição</div>`;
  } else {
    corpo = `
      <div class="court-who">
        <div class="court-players">${escHtml(st.nomes)}</div>
        ${st.detalhes ? `<div class="court-ql">${escHtml(st.detalhes)}</div>` : ''}
      </div>`;
    if (e === 'jogando') {
      corpo += `
        <div class="court-time">
          <span class="court-clock">${mmss(st.restante)}</span>
          <span class="court-clock-label">${st.fim ? `até ${escHtml(st.fim)}` : 'restantes'}</span>
        </div>
        <div class="court-progress" aria-hidden="true"><span style="width:${Math.round(st.progresso * 100)}%"></span></div>`;
    } else if (e === 'chamada') {
      const esgotou = st.prazo === 0;
      corpo += `
        <div class="court-time">
          <span class="court-clock ${esgotou ? 'is-late' : ''}">${st.prazo == null ? '—' : mmss(st.prazo)}</span>
          <span class="court-clock-label">${esgotou ? 'tolerância esgotada' : 'para chegar'}${st.chamadoEm ? ` · chamada ${horaDe(st.chamadoEm)}` : ''}</span>
        </div>`;
    } else if (e === 'pausada') {
      corpo += `
        <div class="court-time">
          <span class="court-clock">${mmss(st.restante)}</span>
          <span class="court-clock-label">restantes · pausado</span>
        </div>`;
    }
  }
  return `
    <article class="court is-${e}" aria-label="Quadra ${n}">
      <div class="court-head">
        <span class="court-name">Quadra ${n}</span>
        ${ESTADO_ROTULO[e]}
      </div>
      ${courtSvg()}
      ${corpo}
    </article>`;
}

// ── Estados vazios / carregando ──────────────────────────
export function emptyState(iconName, title, desc = '', extra = '', small = false) {
  return `
    <div class="empty${small ? ' empty-sm' : ''}">
      <div class="empty-icon">${icon(iconName, 22)}</div>
      <div class="empty-title">${title}</div>
      ${desc ? `<div class="empty-desc">${desc}</div>` : ''}
      ${extra}
    </div>`;
}

export function loading(text = 'Carregando…') {
  return `<div class="loading"><span class="spinner"></span>${text}</div>`;
}

export function errorBox(err) {
  const msg = String(err?.message || '');
  const texto = /permission/i.test(msg)
    ? '<strong>Sem permissão para ler estes dados.</strong><div class="muted">A conta conectada não tem acesso a este conteúdo nas regras do banco.</div>'
    : `<strong>Não foi possível carregar os dados.</strong>${msg ? `<div class="muted">${escHtml(msg)}</div>` : ''}`;
  return `<div class="callout callout-err" style="margin:16px">${icon('alert', 18)}<div>${texto}</div></div>`;
}

// ── Paginação ────────────────────────────────────────────
export function pagerHtml(page, totalPages, total, perPage, noun = 'registros') {
  const ini = total ? (page - 1) * perPage + 1 : 0;
  const fim = Math.min(total, page * perPage);
  let btns = '';
  if (totalPages > 1) {
    btns += `<button class="page-btn" ${page === 1 ? 'disabled' : ''} data-p="${page - 1}" aria-label="Página anterior">${icon('chevronLeft', 16)}</button>`;
    const de = Math.max(1, Math.min(page - 2, totalPages - 4));
    const ate = Math.min(totalPages, de + 4);
    for (let p = de; p <= ate; p++) {
      btns += `<button class="page-btn ${p === page ? 'active' : ''}" data-p="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`;
    }
    btns += `<button class="page-btn" ${page === totalPages ? 'disabled' : ''} data-p="${page + 1}" aria-label="Próxima página">${icon('chevronRight', 16)}</button>`;
  }
  return `
    <div class="pager">
      <span class="pager-info">Mostrando <b>${ini}–${fim}</b> de <b>${total}</b> ${noun}</span>
      <div class="pager-btns">${btns}</div>
    </div>`;
}

// ── Foco preso em janelas abertas ────────────────────────
// Enquanto uma janela (diálogo, painel lateral) está aberta, o Tab circula só
// dentro dela. Pilha: a confirmação aberta por cima do painel lateral manda.
const FOCAVEIS = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const pilhaFoco = [];

document.addEventListener('keydown', e => {
  const root = pilhaFoco[pilhaFoco.length - 1];
  if (e.key !== 'Tab' || !root) return;
  const els = [...root.querySelectorAll(FOCAVEIS)].filter(el => el.offsetParent !== null);
  if (!els.length) { e.preventDefault(); return; }
  const first = els[0], last = els[els.length - 1], atual = document.activeElement;
  if (e.shiftKey && (atual === first || !root.contains(atual))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (atual === last || !root.contains(atual))) { e.preventDefault(); first.focus(); }
});

/** Prende o Tab em root. Retorna a função que solta e devolve o foco a quem abriu. */
export function trapFocus(root) {
  const anterior = document.activeElement;
  pilhaFoco.push(root);
  return () => {
    const i = pilhaFoco.lastIndexOf(root);
    if (i >= 0) pilhaFoco.splice(i, 1);
    if (anterior && document.contains(anterior) && typeof anterior.focus === 'function') anterior.focus({ preventScroll: true });
  };
}

// ── Botão ocupado ────────────────────────────────────────
/** Trava o botão com um texto de espera ("Salvando…"). Retorna a função que destrava. */
export function ocupado(btn, texto = 'Salvando…') {
  if (!btn) return () => {};
  const html = btn.innerHTML;
  const largura = btn.offsetWidth;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  if (largura) btn.style.minWidth = largura + 'px';
  btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${escHtml(texto)}`;
  return () => {
    if (!document.contains(btn)) return;
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.style.minWidth = '';
    btn.innerHTML = html;
  };
}

// ── Cabeçalho de coluna ordenável ────────────────────────
/** <th> com botão de ordenar. estado = { chave, dir }. */
export function thOrdenavel(chave, rotulo, estado, extraClass = '') {
  const ativo = estado?.chave === chave;
  const dir = ativo ? estado.dir : null;
  const aria = dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none';
  const ico = dir === 'asc' ? 'sortAsc' : dir === 'desc' ? 'sortDesc' : 'sortNone';
  return `<th class="sortable ${extraClass}" aria-sort="${aria}"><button type="button" class="th-sort" data-sort="${chave}">${rotulo}${icon(ico, 14)}</button></th>`;
}

// ── Diálogo de confirmação ───────────────────────────────
export function confirmDialog({ title, message = '', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'primary' }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="cd-title">
        <div class="modal-body">
          <div class="dialog-title" id="cd-title">${escHtml(title)}</div>
          ${message ? `<div class="dialog-text">${escHtml(message)}</div>` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-r="0">${escHtml(cancelLabel)}</button>
          <button class="btn btn-${tone}" data-r="1">${escHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const soltar = trapFocus(wrap);
    const done = v => { wrap.remove(); document.removeEventListener('keydown', onKey, true); soltar(); resolve(v); };
    // captura: o Esc fecha só a confirmação, não o painel lateral que está embaixo
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', e => {
      if (e.target === wrap) return done(false);
      const b = e.target.closest('[data-r]');
      if (b) done(b.dataset.r === '1');
    });
    wrap.querySelector('[data-r="1"]').focus();
  });
}

// ── Tema ─────────────────────────────────────────────────
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Chama fn sempre que o tema mudar. Retorna função para cancelar. */
export function onThemeChange(fn) {
  window.addEventListener('painel:theme', fn);
  return () => window.removeEventListener('painel:theme', fn);
}
