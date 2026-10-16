/**
 * Monta as gravações do painel (caminho → valor) para um update() de uma vez só.
 * Sem Firebase e sem tela: dá para testar com Node (tests/test-escritas.mjs).
 * Os formatos são os mesmos do app do titular (usuario.js) e do fiscal (admin.js),
 * e precisam passar nas regras do banco (database.rules.json).
 */

import { normalizarNome } from "./utils.js";

export const LIMITE_PESSOAS = 12;

const TIPOS = ['morador', 'locatario'];
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** "05-03" → "05/03", como o fiscal escreve na auditoria. */
export function unidadeFmt(id) {
  return String(id || '').replace('-', '/');
}

/** Adicionar pessoa a uma casa. Retorna { erro } ou { updates, pessoa }. */
export function montarNovaPessoa({ unidadeId, unidade, pessoasAtuais, nome, tipo, inicio, fim, adminUid, novoId, agora }) {
  const nomeLimpo = String(nome || '').trim().replace(/\s+/g, ' ');
  if (!nomeLimpo) return { erro: 'Informe o nome.' };
  if (nomeLimpo.length > 80) return { erro: 'O nome pode ter no máximo 80 letras.' };
  if (!TIPOS.includes(tipo)) return { erro: 'Tipo de pessoa inválido.' };
  if (!unidade?.quadra || !unidade?.lotePrincipal) return { erro: 'Unidade sem quadra e lote cadastrados.' };

  const atuais = Object.values(pessoasAtuais || {}).filter(Boolean);
  if (atuais.length >= LIMITE_PESSOAS) return { erro: `Limite de ${LIMITE_PESSOAS} pessoas por unidade.` };
  const busca = normalizarNome(nomeLimpo);
  if (atuais.some(p => normalizarNome(p.nome) === busca)) return { erro: 'Já existe uma pessoa com esse nome nesta casa.' };

  const pessoa = { nome: nomeLimpo, tipo, criadoEm: agora, criadoPorUid: adminUid };
  if (tipo === 'locatario') {
    if (!DIA.test(inicio || '') || !DIA.test(fim || '')) return { erro: 'Informe o período de autorização do locatário.' };
    if (inicio > fim) return { erro: 'A data inicial não pode ser depois da data final.' };
    pessoa.autorizacaoInicio = inicio;
    pessoa.autorizacaoFim = fim;
    // Mesmo fuso fixo do app do titular: é contra esses números que a regra
    // do banco compara o horário do servidor para liberar a inscrição na fila.
    pessoa.autorizacaoFimTs = Date.parse(`${fim}T23:59:59-03:00`);
    pessoa.autorizacaoInicioTs = Date.parse(`${inicio}T00:00:00-03:00`);
  }

  return {
    pessoa,
    updates: {
      [`pessoas/${unidadeId}/${novoId}`]: pessoa,
      [`jogadoresPublicos/${novoId}`]: {
        nome: nomeLimpo,
        nomeBusca: busca,
        quadra: unidade.quadra,
        lote: unidade.lotePrincipal,
        unidadeId,
      },
    },
  };
}

/** Remover pessoa de uma casa. Retorna { erro } ou { updates }. */
export function montarRemocaoPessoa({ unidadeId, pessoaId, pessoa }) {
  if (!pessoa) return { erro: 'Pessoa não encontrada.' };
  if (pessoa.titular) {
    return { erro: 'O titular não pode ser removido. Para trocar o responsável pela casa, use a transferência de titularidade.' };
  }
  const updates = {
    [`pessoas/${unidadeId}/${pessoaId}`]: null,
    [`jogadoresPublicos/${pessoaId}`]: null,
  };
  if (pessoa.codigoAcesso) updates[`codigosAcesso/${pessoa.codigoAcesso}`] = null;
  if (pessoa.criadoPorUid) updates[`pessoasCriadasPor/${unidadeId}/${pessoa.criadoPorUid}/${pessoaId}`] = null;
  return { updates };
}

/**
 * Aprovar pedido de cadastro — as mesmas gravações do fiscal: pessoa na casa,
 * busca de jogadores, conta vinculada à unidade, unidade confirmada e pedido
 * decidido. Casa sem titular: a pessoa entra como responsável.
 */
export function montarAprovacao({ uid, solicitacao, unidade, pessoasDaUnidade, adminUid, adminNome, novoId, agora }) {
  if (!solicitacao) return { erro: 'Pedido não encontrado.' };
  if (solicitacao.status !== 'pendente') return { erro: 'Este pedido já foi decidido.' };
  const unidadeId = solicitacao.unidadeId;
  if (!unidade) return { erro: `A unidade ${unidadeFmt(unidadeId)} não está cadastrada. Cadastre antes de aprovar.` };

  const jaTemTitular = Object.values(pessoasDaUnidade || {}).some(p => p && p.titular);
  const nome = solicitacao.nome;
  return {
    jaTemTitular,
    updates: {
      [`pessoas/${unidadeId}/${novoId}`]: { nome, tipo: 'morador', criadoEm: agora, criadoPorUid: adminUid, titular: !jaTemTitular },
      [`jogadoresPublicos/${novoId}`]: { nome, nomeBusca: normalizarNome(nome), quadra: unidade.quadra, lote: unidade.lotePrincipal, unidadeId },
      [`usuarios/${uid}`]: jaTemTitular
        ? { unidadeId, pessoaId: novoId, criadoEm: agora }
        : { unidadeId, criadoEm: agora },
      [`unidades/${unidadeId}/status`]: 'confirmada',
      [`solicitacoes/${uid}/status`]: 'aprovada',
      [`solicitacoes/${uid}/decididoEm`]: agora,
      [`solicitacoes/${uid}/decididoPor`]: adminNome,
    },
  };
}

/** Entrada da auditoria no formato do fiscal (registrarAuditoria em admin.js). */
export function montarAuditoria({ adminUid, adminNome, acao, detalhes, agora }) {
  return {
    ts: agora,
    adminUid: adminUid || null,
    adminNome: adminNome || 'Administrador',
    acao,
    detalhes: detalhes || '',
  };
}
