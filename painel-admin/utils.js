/**
 * Funções utilitárias puras — sem dependências de browser ou Firebase.
 * Podem ser testadas com Node.js (node tests/test-utils.mjs).
 */

// ── Formatação de datas ──────────────────────────────────

/**
 * Formata uma data ISO (ou "YYYY-MM-DD") como "DD/MM/YYYY".
 * Retorna "—" para valores nulos ou inválidos.
 */
export function formatDate(value) {
  if (!value) return '—';
  // Se for só "YYYY-MM-DD", parseia como data local para evitar off-by-one de TZ
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Retorna o horário de uma string "HH:MM" ou ISO como "HH:MM".
 * Retorna "—" para valores inválidos.
 */
export function formatTime(value) {
  if (!value) return '—';
  const s = String(value).trim();
  // Passthrough: já é "HH:MM" ou "HH:MM:SS"
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit'
  });
}

/** Formata duração em minutos como "45 min". Retorna "—" se inválido. */
export function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return '—';
  return `${minutes} min`;
}

// ── Normalização de texto ────────────────────────────────

/**
 * Converte para lowercase sem acentos — usado para busca prefix-insensitive.
 * Replica a lógica do campo nomeBusca do Firebase (jogadoresPublicos).
 */
export function normalizarNome(nome) {
  if (!nome) return '';
  return String(nome)
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// ── Datas no fuso de Brasília ────────────────────────────

// Pergunta o dia direto ao fuso de São Paulo: não depende do fuso do computador.
const DIA_BRASILIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Retorna "YYYY-MM-DD" do dia em Brasília para o instante dado. */
export function calcularDiaChave(date = new Date()) {
  const p = {};
  DIA_BRASILIA.formatToParts(new Date(date)).forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}

const SEM_FUSO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/;

/**
 * Dia em Brasília de um registro (campo data). Texto sem fuso ("YYYY-MM-DD"
 * ou "YYYY-MM-DDTHH:MM") já é horário de Brasília e fica como está; texto com
 * fuso (o ISO em UTC que o fiscal grava, terminado em Z) é convertido.
 */
export function diaLocalISO(isoStr) {
  if (!isoStr) return '';
  const s = String(isoStr).trim();
  if (SEM_FUSO.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : calcularDiaChave(d);
}

// ── Filtragem e agrupamento ──────────────────────────────

/**
 * Filtra um array de registros com campo `data` (ISO string)
 * pelo período [inicio, fim] (strings "YYYY-MM-DD", inclusivo).
 * Se inicio/fim forem null/undefined, retorna todos.
 */
export function filtrarPorPeriodo(items, inicio, fim) {
  if (!items?.length) return [];
  if (!inicio && !fim) return items;
  return items.filter(item => {
    const dia = diaLocalISO(item.data);
    if (!dia) return false;
    if (inicio && dia < inicio) return false;
    if (fim && dia > fim) return false;
    return true;
  });
}

/**
 * Agrupa um array de registros (campo `data`) por dia "YYYY-MM-DD".
 * Retorna { "YYYY-MM-DD": [item, ...], ... }.
 */
export function agruparPorDia(items) {
  const result = {};
  (items || []).forEach(item => {
    const dia = diaLocalISO(item.data);
    if (!dia) return;
    if (!result[dia]) result[dia] = [];
    result[dia].push(item);
  });
  return result;
}

// ── Estatísticas ─────────────────────────────────────────

/**
 * Calcula estatísticas básicas a partir de um array de registros do histórico.
 * Retorna um objeto com totais e contagens de participantes distintos.
 */
export function calcularEstatisticas(historico) {
  const stats = {
    total: 0,
    simples: 0,   // duracao === 45
    duplas: 0,    // duracao === 60
    participantes: 0,
    porDia: {},   // { "YYYY-MM-DD": count }
    porQuadra: {}, // { "1": count, ... }
  };
  if (!historico?.length) return stats;

  const pessoaIds = new Set();
  const nomes = new Set();

  historico.forEach(h => {
    stats.total++;
    if (h.duracao === 45) stats.simples++;
    else if (h.duracao === 60) stats.duplas++;

    const dia = diaLocalISO(h.data);
    if (dia) stats.porDia[dia] = (stats.porDia[dia] || 0) + 1;

    const q = String(h.q || '?');
    stats.porQuadra[q] = (stats.porQuadra[q] || 0) + 1;

    // Participantes distintos
    (h.jogadores || []).forEach(j => {
      if (j?.pessoaId) pessoaIds.add(j.pessoaId);
      else if (j?.nome) nomes.add(normalizarNome(j.nome));
    });
    // Suporte a registros antigos com campo `n` (string de nomes)
    if (!h.jogadores && h.n) {
      h.n.split(/[•,]/).forEach(n => {
        const t = normalizarNome(n.trim());
        if (t) nomes.add(t);
      });
    }
  });

  stats.participantes = pessoaIds.size + nomes.size;
  return stats;
}

// ── Utilitários de telefone ──────────────────────────────

/**
 * Formata um número de WhatsApp como "(11) 99988-7766".
 * Remove o código 55 se presente, aceita formatações variadas.
 */
export function formatarWhatsapp(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  // Remove DDI 55 se presente e resultado tiver 11 ou 10 dígitos
  const num = digits.startsWith('55') && (digits.length === 13 || digits.length === 12)
    ? digits.slice(2) : digits;
  if (num.length === 11) {
    return `(${num.slice(0,2)}) ${num.slice(2,7)}-${num.slice(7)}`;
  }
  if (num.length === 10) {
    return `(${num.slice(0,2)}) ${num.slice(2,6)}-${num.slice(6)}`;
  }
  return raw; // Devolve como veio se não reconhecer
}

// ── Utilitários gerais ───────────────────────────────────

/**
 * Link do convite do titular — mesmo formato do painel do fiscal. O app do
 * morador lê o token do caminho /convite/{token}.
 */
export function linkConvite(origin, token) {
  if (!token) return '';
  return `${String(origin || '').replace(/\/+$/, '')}/convite/${encodeURIComponent(token)}`;
}

/** "1 partida" ou "3 partidas" */
export function pluralize(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Abrevia nome longo: "Carlos Eduardo" → "Carlos E." */
export function abreviarNome(nome) {
  if (!nome) return '';
  const partes = String(nome).trim().split(/\s+/);
  if (partes.length <= 1) return nome;
  return partes[0] + ' ' + partes.slice(1).map(p => p[0] + '.').join(' ');
}

/**
 * Converte um objeto Firebase (que pode ser array ou objeto com chaves numéricas)
 * para array. Funciona para `historico`, `quadras` e similares.
 */
export function fbToArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return Object.values(val);
}

/**
 * Converte um objeto Firebase de push-keys em array de {_key, ...dados}.
 * Útil para `fila`, `solicitacoes`, `auditoria`, etc.
 */
export function fbPushToArray(val) {
  if (!val) return [];
  return Object.entries(val).map(([k, v]) => ({ ...v, _key: k }));
}

/** Escapa HTML para evitar XSS ao inserir em innerHTML. */
export function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Retorna "Há 2 min", "Há 1h", "Ontem" etc. para timestamps recentes. */
export function tempoRelativo(ts) {
  if (!ts) return '';
  const diff = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'Agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `Há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Ontem';
  return `Há ${d} dias`;
}
