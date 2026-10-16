/**
 * Ponto de entrada do painel administrativo.
 *
 * - Inicializa Firebase com instância nomeada (sem conflito com app do morador)
 * - Observa autenticação e alterna login ↔ app
 * - Inicializa o roteador após login confirmado
 * - Cuida do tema, do indicador de conexão e das notificações
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { firebaseConfig, APP_NAME } from "./firebase-config.js";
import { initAuth, login, logout, observeAuth, restorePersistence } from "./auth.js";
import { initRouter } from "./router.js";
import { icon, iniciais } from "./ui.js";

// ── Tema ─────────────────────────────────────────────────
const THEME_KEY = 'painel-theme';

function temaAtual() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function aplicarTema(tema, salvar = true) {
  document.documentElement.setAttribute('data-theme', tema);
  if (salvar) { try { localStorage.setItem(THEME_KEY, tema); } catch {} }
  document.querySelectorAll('[data-set-theme]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.setTheme === tema));
  });
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', tema === 'dark' ? '#11151D' : '#F3F4F7');
  window.dispatchEvent(new CustomEvent('painel:theme', { detail: tema }));
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-set-theme]');
  if (b && b.dataset.setTheme !== temaAtual()) aplicarTema(b.dataset.setTheme);
});
aplicarTema(temaAtual(), false);

// ── Firebase ─────────────────────────────────────────────
const app  = initializeApp(firebaseConfig, APP_NAME);
const db   = getDatabase(app);
const auth = getAuth(app);

initAuth(auth, db);
await restorePersistence();

// ── Elementos ────────────────────────────────────────────
const screenLogin    = document.getElementById('login-screen');
const screenApp      = document.getElementById('app');
const loginForm      = document.getElementById('login-form');
const loginError     = document.getElementById('login-error');
const loginBtn       = document.getElementById('login-btn');
const btnLogout      = document.getElementById('btn-logout');
const pageRoot       = document.getElementById('page-root');
const sidebarEl      = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnMenuOpen    = document.getElementById('btn-menu-open');
const btnMenuClose   = document.getElementById('btn-menu-close');
const userNameEl     = document.getElementById('sidebar-user-name');
const avatarEl       = document.getElementById('sidebar-avatar');
const toastContainer = document.getElementById('toast-container');
const connPill       = document.getElementById('conn-pill');

// ── Notificações ─────────────────────────────────────────
const TOAST_ICON = { ok: 'checkCircle', err: 'alert', warn: 'alert' };

function showToast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast${type ? ' toast-' + type : ''}`;
  el.setAttribute('role', type === 'err' ? 'alert' : 'status');
  el.innerHTML = `${icon(TOAST_ICON[type] || 'info', 18)}<span></span>`;
  el.querySelector('span').textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 6000 : 3500);
}

// ── Conexão com o banco ──────────────────────────────────
onValue(ref(db, '.info/connected'), snap => {
  const on = snap.val() === true;
  connPill.dataset.state = on ? 'on' : 'off';
  connPill.querySelector('.conn-label').textContent = on ? 'Ao vivo' : 'Sem conexão';
});

// ── Sessão ───────────────────────────────────────────────
let routerInited = false;

observeAuth(
  (user) => {
    screenLogin.hidden = true;
    screenApp.hidden   = false;
    loginError.classList.remove('visible');

    const username = user.email?.replace(/@admin\.local$/, '') ?? user.email;
    if (userNameEl) userNameEl.textContent = username;
    if (avatarEl) avatarEl.textContent = iniciais(username);

    if (!routerInited) {
      routerInited = true;
      initRouter(pageRoot, { db, auth, user, showToast });
    }
  },
  () => {
    screenLogin.hidden = false;
    screenApp.hidden   = true;
    routerInited = false;
  }
);

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.remove('visible');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Entrando…';

  const username = loginForm.username.value.trim();
  const password = loginForm.password.value;
  const lembrar  = loginForm.lembrar?.checked ?? false;

  try {
    await login(username, password, lembrar);
  } catch (err) {
    loginError.innerHTML = `${icon('alert', 18)}<span></span>`;
    loginError.querySelector('span').textContent = traduzirErro(err);
    loginError.classList.add('visible');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Entrar';
  }
});

function traduzirErro(err) {
  if (!err?.code) return err?.message ?? 'Erro desconhecido.';
  switch (err.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Usuário ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'auth/network-request-failed':
      return 'Erro de conexão. Verifique a internet.';
    default:
      return err.message ?? 'Erro ao entrar.';
  }
}

btnLogout?.addEventListener('click', async () => {
  await logout();
});

// ── Menu lateral no celular/tablet ───────────────────────
const MENU_GAVETA_MAX = 1024;

function openSidebar() {
  sidebarEl?.classList.add('open');
  sidebarOverlay?.classList.add('open');
}
function closeSidebar() {
  sidebarEl?.classList.remove('open');
  sidebarOverlay?.classList.remove('open');
}
btnMenuOpen?.addEventListener('click', openSidebar);
btnMenuClose?.addEventListener('click', closeSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);
document.addEventListener('click', (e) => {
  if (e.target.closest('.nav-link[data-route]') && window.innerWidth <= MENU_GAVETA_MAX) closeSidebar();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
