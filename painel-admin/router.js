/**
 * Roteador baseado em hash (#dashboard, #historico, etc.).
 *
 * Cada página é um módulo ES com export async render(container, ctx) e
 * opcionalmente export function destroy() para limpar listeners.
 *
 * O contexto {db, auth, user, showToast} é injetado pelo app.js e
 * repassado a cada página na chamada de render().
 */

const PAGES = {
  dashboard:     () => import('./pages/dashboard.js'),
  historico:     () => import('./pages/historico.js'),
  estatisticas:  () => import('./pages/estatisticas.js'),
  fila:          () => import('./pages/fila.js'),
  unidades:      () => import('./pages/unidades.js'),
  solicitacoes:  () => import('./pages/solicitacoes.js'),
  configuracoes: () => import('./pages/configuracoes.js'),
  auditoria:     () => import('./pages/auditoria.js'),
};

const PAGE_TITLES = {
  dashboard:     'Visão geral',
  historico:     'Histórico',
  estatisticas:  'Estatísticas',
  fila:          'Fila ao vivo',
  unidades:      'Unidades',
  solicitacoes:  'Solicitações',
  configuracoes: 'Configurações',
  auditoria:     'Auditoria',
};

const PAGE_GROUPS = {
  dashboard: 'Operação', fila: 'Operação',
  historico: 'Análise', estatisticas: 'Análise',
  unidades: 'Cadastro', solicitacoes: 'Cadastro',
  configuracoes: 'Sistema', auditoria: 'Sistema',
};

let _ctx = {};
let _currentDestroy = null;
let _container = null;

/** Inicializa o roteador. ctx = {db, auth, user, showToast}. */
export function initRouter(container, ctx) {
  _container = container;
  _ctx = ctx;
  window.addEventListener('hashchange', handleHash);
  handleHash();
}

/** Navega para uma rota sem recarregar a página. */
export function navigate(route) {
  window.location.hash = route;
}

function currentRoute() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  return PAGES[hash] ? hash : 'dashboard';
}

async function handleHash() {
  const route = currentRoute();

  // Destroi a página atual
  if (_currentDestroy) {
    try { _currentDestroy(); } catch {}
    _currentDestroy = null;
  }

  // Atualiza links ativos na sidebar
  document.querySelectorAll('.nav-link[data-route]').forEach(el => {
    el.classList.toggle('active', el.dataset.route === route);
  });

  // Caminho na barra superior
  const pageTitle = document.getElementById('mobile-page-title');
  if (pageTitle) pageTitle.textContent = PAGE_TITLES[route] || '';
  const groupTitle = document.getElementById('topbar-group');
  if (groupTitle) groupTitle.textContent = PAGE_GROUPS[route] || '';
  document.title = `${PAGE_TITLES[route] || 'Painel'} · Laranjeiras`;

  window.scrollTo(0, 0);
  _container.innerHTML = `<div class="loading"><span class="spinner"></span>Carregando…</div>`;

  try {
    const mod = await PAGES[route]();
    _currentDestroy = await mod.render(_container, _ctx) ?? null;
    focarTitulo();
  } catch (err) {
    console.error('Erro ao carregar página:', err);
    const msg = String(err?.message || '').replace(/[<>&"]/g, '');
    const semPermissao = /permission/i.test(msg);
    _container.innerHTML = `
      <div class="page">
        <div class="callout callout-err">
          <div><strong>${semPermissao ? 'Sem permissão para ler estes dados.' : 'Não foi possível carregar esta página.'}</strong>
          <div class="muted" style="margin-top:2px">${semPermissao ? 'A conta conectada não tem acesso a este conteúdo nas regras do banco.' : msg}</div></div>
        </div>
      </div>`;
  }
}

/** Leva o foco ao título da página (troca de página e atalho "pular para o conteúdo"). */
export function focarTitulo() {
  const h1 = _container?.querySelector('h1');
  if (!h1) return;
  h1.setAttribute('tabindex', '-1');
  h1.focus({ preventScroll: true });
}

/** Recarrega a rota atual (útil após operações de escrita). */
export function reloadPage() {
  handleHash();
}
