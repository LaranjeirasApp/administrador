/**
 * Testes para utils.js — rodar com: node tests/test-utils.mjs
 * Todos os testes devem passar após implementar utils.js.
 */
import {
  formatDate,
  formatTime,
  formatDuration,
  normalizarNome,
  calcularDiaChave,
  diaLocalISO,
  filtrarPorPeriodo,
  agruparPorDia,
  calcularEstatisticas,
  formatarWhatsapp,
  pluralize,
  linkConvite,
} from '../utils.js';

let passed = 0, failed = 0;

function assert(desc, val, expected) {
  const v = JSON.stringify(val), e = JSON.stringify(expected);
  if (v === e) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ ${desc}\n    expected: ${e}\n    got:      ${v}`);
    failed++;
  }
}
function section(name) { console.log(`\n${name}`); }

// ── formatDate ──────────────────────────────────────────
section('formatDate');
assert('ISO com offset', formatDate('2026-10-15T14:30:00-03:00'), '15/10/2026');
assert('ISO sem offset', formatDate('2026-01-05T00:00:00'), '05/01/2026');
assert('string "YYYY-MM-DD"', formatDate('2026-10-15'), '15/10/2026');
assert('null/undefined retorna —', formatDate(null), '—');
assert('string vazia retorna —', formatDate(''), '—');

// ── formatTime ──────────────────────────────────────────
section('formatTime');
assert('"HH:MM" passthrough', formatTime('14:30'), '14:30');
assert('ISO string', formatTime('2026-10-15T14:30:00'), '14:30');
assert('null retorna —', formatTime(null), '—');

// ── formatDuration ──────────────────────────────────────
section('formatDuration');
assert('45 → "45 min"', formatDuration(45), '45 min');
assert('60 → "60 min"', formatDuration(60), '60 min');
assert('undefined → "—"', formatDuration(undefined), '—');

// ── normalizarNome ──────────────────────────────────────
section('normalizarNome');
assert('remove acentos e minuscula', normalizarNome('José'), 'jose');
assert('maiusculo', normalizarNome('CARLOS'), 'carlos');
assert('cedilha', normalizarNome('Conceição'), 'conceicao');
assert('trim', normalizarNome('  Ana  '), 'ana');
assert('string vazia', normalizarNome(''), '');

// ── calcularDiaChave ────────────────────────────────────
section('calcularDiaChave');
// UTC-3: 2026-10-15T02:00:00Z = 2026-10-14T23:00:00-03:00
assert('UTC-3 antes da meia-noite', calcularDiaChave(new Date('2026-10-15T02:00:00Z')), '2026-10-14');
// UTC-3: 2026-10-15T10:00:00Z = 2026-10-15T07:00:00-03:00
assert('UTC-3 depois da meia-noite', calcularDiaChave(new Date('2026-10-15T10:00:00Z')), '2026-10-15');

// ── filtrarPorPeriodo ───────────────────────────────────
section('filtrarPorPeriodo');
const items = [
  { data: '2026-10-10T12:00:00' },
  { data: '2026-10-15T12:00:00' },
  { data: '2026-10-20T12:00:00' },
];
assert('filtra por período', filtrarPorPeriodo(items, '2026-10-11', '2026-10-16').length, 1);
assert('inclui extremos', filtrarPorPeriodo(items, '2026-10-10', '2026-10-10').length, 1);
assert('periodo vazio retorna todos', filtrarPorPeriodo(items, null, null).length, 3);
assert('array vazio', filtrarPorPeriodo([], '2026-10-01', '2026-10-31').length, 0);

// ── agruparPorDia ───────────────────────────────────────
section('agruparPorDia');
const hist = [
  { data: '2026-10-15T10:00:00', n: 'A' },
  { data: '2026-10-15T11:00:00', n: 'B' },
  { data: '2026-10-16T10:00:00', n: 'C' },
];
const grupos = agruparPorDia(hist);
assert('dias distintos', Object.keys(grupos).length, 2);
assert('contagem por dia', grupos['2026-10-15'].length, 2);
assert('array vazio', Object.keys(agruparPorDia([])).length, 0);

// ── calcularEstatisticas ────────────────────────────────
section('calcularEstatisticas');
const historico = [
  { duracao: 45, jogadores: [{pessoaId:'p1'},{pessoaId:'p2'}], data: '2026-10-15T10:00:00', q:1 },
  { duracao: 60, jogadores: [{pessoaId:'p1'},{pessoaId:'p3'},{pessoaId:'p4'},{pessoaId:'p5'}], data: '2026-10-15T12:00:00', q:2 },
  { duracao: 45, jogadores: [{nome:'Carlos'},{nome:'Ana'}], data: '2026-10-16T10:00:00', q:1 },
];
const stats = calcularEstatisticas(historico);
assert('total partidas', stats.total, 3);
assert('simples', stats.simples, 2);
assert('duplas', stats.duplas, 1);
assert('participantes distintos (ids + nomes)', stats.participantes >= 5, true);

// ── formatarWhatsapp ────────────────────────────────────
section('formatarWhatsapp');
assert('só números', formatarWhatsapp('11999887766'), '(11) 99988-7766');
assert('com formatação', formatarWhatsapp('(11) 9 9988-7766'), '(11) 99988-7766');
assert('com 55', formatarWhatsapp('5511999887766'), '(11) 99988-7766');
assert('vazio', formatarWhatsapp(''), '');

// ── pluralize ───────────────────────────────────────────
section('pluralize');
assert('singular', pluralize(1, 'partida', 'partidas'), '1 partida');
assert('plural', pluralize(3, 'partida', 'partidas'), '3 partidas');
assert('zero é plural', pluralize(0, 'partida', 'partidas'), '0 partidas');

// ── linkConvite ─────────────────────────────────────────
// Mesmo formato do painel do fiscal (admin.js): o app do morador só entende
// /convite/{token} (o Firebase Hosting redireciona esse caminho para usuario/).
section('linkConvite');
assert('formato /convite/{token}', linkConvite('https://laranjeiras.web.app', 'K7MPQ2XRTN4H'), 'https://laranjeiras.web.app/convite/K7MPQ2XRTN4H');
assert('origem com barra no fim', linkConvite('https://laranjeiras.web.app/', 'ABC'), 'https://laranjeiras.web.app/convite/ABC');
assert('token sem convite', linkConvite('https://laranjeiras.web.app', ''), '');

// ── Dia de Brasília, qualquer que seja o fuso do computador ──
// Fica no fim do arquivo porque troca o fuso do processo (process.env.TZ).
// Horários escolhidos nas faixas que já deram errado: 00h–03h (virava
// "ontem") e jogos encerrados depois das 21h (contavam no dia seguinte).
for (const tz of ['America/Sao_Paulo', 'UTC', 'Asia/Tokyo']) {
  process.env.TZ = tz;
  section(`dia de Brasília (computador em ${tz})`);
  assert('01:00 de Brasília já é o dia novo', calcularDiaChave(new Date('2026-10-16T04:00:00Z')), '2026-10-16');
  assert('00:00 de Brasília já é o dia novo', calcularDiaChave(new Date('2026-10-16T03:00:00Z')), '2026-10-16');
  assert('23:59 de Brasília ainda é o dia anterior', calcularDiaChave(new Date('2026-10-16T02:59:00Z')), '2026-10-15');
  assert('jogo encerrado 22:30 conta no dia dele', diaLocalISO('2026-10-16T01:30:00.000Z'), '2026-10-15');
  assert('data sem horário fica como está', diaLocalISO('2026-10-15'), '2026-10-15');
  const tarde = [{ data: '2026-10-16T01:30:00.000Z', duracao: 45, q: 1 }];
  assert('filtro do dia 15 inclui o jogo das 22:30', filtrarPorPeriodo(tarde, '2026-10-15', '2026-10-15').length, 1);
  assert('filtro do dia 16 não inclui o jogo das 22:30', filtrarPorPeriodo(tarde, '2026-10-16', '2026-10-16').length, 0);
  assert('estatística por dia usa o dia de Brasília', Object.keys(calcularEstatisticas(tarde).porDia), ['2026-10-15']);
}

// ── Resultado ──────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passou, ${failed} falhou`);
if (failed > 0) process.exit(1);
