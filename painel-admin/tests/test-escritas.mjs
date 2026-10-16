/**
 * Testes das gravações do painel — rodar com: node tests/test-escritas.mjs
 * Cada função só MONTA o que vai para o banco; nada aqui fala com o Firebase.
 * Os formatos copiam o app do titular (usuario.js) e o do fiscal (admin.js).
 */
import {
  LIMITE_PESSOAS, montarNovaPessoa, montarRemocaoPessoa, montarAprovacao, montarAuditoria,
} from '../escritas.js';

let passed = 0, failed = 0;
function assert(desc, val, expected) {
  const v = JSON.stringify(val), e = JSON.stringify(expected);
  if (v === e) { console.log(`  ✓ ${desc}`); passed++; }
  else { console.error(`  ✗ ${desc}\n    expected: ${e}\n    got:      ${v}`); failed++; }
}
function section(name) { console.log(`\n${name}`); }

const AGORA = Date.parse('2026-10-16T12:00:00-03:00');
const UNIDADE = { quadra: '05', lotePrincipal: '03', status: 'confirmada', ativo: true, criadoEm: 1 };
const base = { unidadeId: '05-03', unidade: UNIDADE, pessoasAtuais: {}, adminUid: 'adm1', novoId: 'pNovo', agora: AGORA };

// ── adicionar pessoa ────────────────────────────────────
section('montarNovaPessoa — morador');
const m = montarNovaPessoa({ ...base, nome: '  Renata Ribeiro ', tipo: 'morador' });
assert('sem erro', m.erro, undefined);
assert('grava a pessoa na casa', m.updates['pessoas/05-03/pNovo'],
  { nome: 'Renata Ribeiro', tipo: 'morador', criadoEm: AGORA, criadoPorUid: 'adm1' });
assert('grava na busca de jogadores', m.updates['jogadoresPublicos/pNovo'],
  { nome: 'Renata Ribeiro', nomeBusca: 'renata ribeiro', quadra: '05', lote: '03', unidadeId: '05-03' });
assert('só esses dois caminhos', Object.keys(m.updates).sort(), ['jogadoresPublicos/pNovo', 'pessoas/05-03/pNovo']);
assert('nunca vira titular por aqui', 'titular' in m.updates['pessoas/05-03/pNovo'], false);
assert('busca sem acento', montarNovaPessoa({ ...base, nome: 'José Conceição', tipo: 'morador' }).updates['jogadoresPublicos/pNovo'].nomeBusca, 'jose conceicao');

section('montarNovaPessoa — locatário');
const l = montarNovaPessoa({ ...base, nome: 'Larissa Moreira', tipo: 'locatario', inicio: '2026-10-01', fim: '2026-12-31' });
const pl = l.updates['pessoas/05-03/pNovo'];
assert('tipo locatário', pl.tipo, 'locatario');
assert('período em texto', [pl.autorizacaoInicio, pl.autorizacaoFim], ['2026-10-01', '2026-12-31']);
assert('fim = 23:59:59 de Brasília do último dia', pl.autorizacaoFimTs, Date.parse('2026-12-31T23:59:59-03:00'));
assert('início = 00:00 de Brasília do primeiro dia', pl.autorizacaoInicioTs, Date.parse('2026-10-01T00:00:00-03:00'));
assert('sem período dá erro', montarNovaPessoa({ ...base, nome: 'X', tipo: 'locatario', inicio: '', fim: '' }).erro, 'Informe o período de autorização do locatário.');
assert('início depois do fim dá erro', montarNovaPessoa({ ...base, nome: 'X', tipo: 'locatario', inicio: '2026-12-01', fim: '2026-11-01' }).erro, 'A data inicial não pode ser depois da data final.');
assert('morador ignora datas digitadas', 'autorizacaoInicio' in montarNovaPessoa({ ...base, nome: 'Y', tipo: 'morador', inicio: '2026-10-01', fim: '2026-12-31' }).updates['pessoas/05-03/pNovo'], false);

section('montarNovaPessoa — recusas');
assert('nome vazio', montarNovaPessoa({ ...base, nome: '   ', tipo: 'morador' }).erro, 'Informe o nome.');
assert('nome acima de 80 letras', montarNovaPessoa({ ...base, nome: 'a'.repeat(81), tipo: 'morador' }).erro, 'O nome pode ter no máximo 80 letras.');
assert('tipo desconhecido', montarNovaPessoa({ ...base, nome: 'Z', tipo: 'visitante' }).erro, 'Tipo de pessoa inválido.');
const cheia = Object.fromEntries(Array.from({ length: LIMITE_PESSOAS }, (_, i) => [`p${i}`, { nome: `P${i}` }]));
assert(`casa com ${LIMITE_PESSOAS} pessoas`, montarNovaPessoa({ ...base, pessoasAtuais: cheia, nome: 'Z', tipo: 'morador' }).erro, `Limite de ${LIMITE_PESSOAS} pessoas por unidade.`);
assert('mesmo nome já na casa (sem acento/maiúscula)', montarNovaPessoa({ ...base, pessoasAtuais: { a: { nome: 'José Silva' } }, nome: 'jose silva', tipo: 'morador' }).erro, 'Já existe uma pessoa com esse nome nesta casa.');
assert('unidade sem quadra/lote', montarNovaPessoa({ ...base, unidade: {}, nome: 'Z', tipo: 'morador' }).erro, 'Unidade sem quadra e lote cadastrados.');

// ── remover pessoa ──────────────────────────────────────
section('montarRemocaoPessoa');
const r = montarRemocaoPessoa({ unidadeId: '05-03', pessoaId: 'p2', pessoa: { nome: 'Caio', tipo: 'morador', criadoPorUid: 'tit1', codigoAcesso: 'RB7T15' } });
assert('apaga da casa, da busca, o código e o índice de quem cadastrou', r.updates, {
  'pessoas/05-03/p2': null,
  'jogadoresPublicos/p2': null,
  'codigosAcesso/RB7T15': null,
  'pessoasCriadasPor/05-03/tit1/p2': null,
});
const r2 = montarRemocaoPessoa({ unidadeId: '05-03', pessoaId: 'p3', pessoa: { nome: 'Ana', tipo: 'morador' } });
assert('sem código e sem criador: só casa e busca', Object.keys(r2.updates).sort(), ['jogadoresPublicos/p3', 'pessoas/05-03/p3']);
assert('titular não sai', montarRemocaoPessoa({ unidadeId: '05-03', pessoaId: 'p1', pessoa: { nome: 'Marcelo', titular: true } }).erro,
  'O titular não pode ser removido. Para trocar o responsável pela casa, use a transferência de titularidade.');
assert('pessoa inexistente', montarRemocaoPessoa({ unidadeId: '05-03', pessoaId: 'x', pessoa: null }).erro, 'Pessoa não encontrada.');

// ── aprovar solicitação (igual ao fiscal) ───────────────
section('montarAprovacao');
const sol = { nome: 'Beatriz Gomes', email: 'b@x.com', unidadeId: '05-03', status: 'pendente', criadoEm: 1 };
const ap = montarAprovacao({ uid: 'uA', solicitacao: sol, unidade: UNIDADE, pessoasDaUnidade: {}, adminUid: 'adm1', adminNome: 'vinicius', novoId: 'pN', agora: AGORA });
assert('casa sem titular: entra como responsável', ap.jaTemTitular, false);
assert('todas as gravações do fiscal', ap.updates, {
  'pessoas/05-03/pN': { nome: 'Beatriz Gomes', tipo: 'morador', criadoEm: AGORA, criadoPorUid: 'adm1', titular: true },
  'jogadoresPublicos/pN': { nome: 'Beatriz Gomes', nomeBusca: 'beatriz gomes', quadra: '05', lote: '03', unidadeId: '05-03' },
  'usuarios/uA': { unidadeId: '05-03', criadoEm: AGORA },
  'unidades/05-03/status': 'confirmada',
  'solicitacoes/uA/status': 'aprovada',
  'solicitacoes/uA/decididoEm': AGORA,
  'solicitacoes/uA/decididoPor': 'vinicius',
});
const ap2 = montarAprovacao({ uid: 'uB', solicitacao: { ...sol, nome: 'Henrique' }, unidade: UNIDADE, pessoasDaUnidade: { p1: { nome: 'Marcelo', titular: true } }, adminUid: 'adm1', adminNome: 'vinicius', novoId: 'pM', agora: AGORA });
assert('casa com titular: entra como morador', ap2.jaTemTitular, true);
assert('morador não é titular', ap2.updates['pessoas/05-03/pM'].titular, false);
assert('conta do morador aponta para a pessoa', ap2.updates['usuarios/uB'], { unidadeId: '05-03', pessoaId: 'pM', criadoEm: AGORA });
assert('pedido já decidido', montarAprovacao({ uid: 'uA', solicitacao: { ...sol, status: 'aprovada' }, unidade: UNIDADE, pessoasDaUnidade: {}, adminUid: 'a', adminNome: 'v', novoId: 'p', agora: 1 }).erro, 'Este pedido já foi decidido.');
assert('unidade não cadastrada', montarAprovacao({ uid: 'uA', solicitacao: sol, unidade: null, pessoasDaUnidade: {}, adminUid: 'a', adminNome: 'v', novoId: 'p', agora: 1 }).erro, 'A unidade 05/03 não está cadastrada. Cadastre antes de aprovar.');

// ── auditoria (formato do fiscal) ───────────────────────
section('montarAuditoria');
assert('mesmos campos do fiscal', montarAuditoria({ adminUid: 'adm1', adminNome: 'vinicius', acao: 'Pessoa removida', detalhes: 'Caio — unidade 05/03', agora: AGORA }),
  { ts: AGORA, adminUid: 'adm1', adminNome: 'vinicius', acao: 'Pessoa removida', detalhes: 'Caio — unidade 05/03' });
assert('sem nome vira "Administrador"', montarAuditoria({ adminUid: 'adm1', adminNome: '', acao: 'X', agora: 1 }).adminNome, 'Administrador');
assert('sem detalhes vira texto vazio', montarAuditoria({ adminUid: 'adm1', adminNome: 'v', acao: 'X', agora: 1 }).detalhes, '');

console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passou, ${failed} falhou`);
if (failed > 0) process.exit(1);
