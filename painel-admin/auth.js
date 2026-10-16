/**
 * Módulo de autenticação do painel administrativo.
 *
 * Fluxo:
 * 1. Usuário entra com username (sem @admin.local) + senha
 * 2. Firebase Auth autentica com username@admin.local
 * 3. Lemos admins/{uid} no Realtime Database
 * 4. Se não for admin → signOut imediato + erro
 * 5. Se for admin → resolvemos a Promise com o user + dados
 *
 * O nome da instância Firebase (APP_NAME) garante que esta sessão não
 * conflita com o app do morador que roda em paralelo no mesmo navegador.
 */

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { get, ref } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { ADMIN_DOMAIN } from "./firebase-config.js";

const LEMBRAR_KEY = "adminPainelLembrar";

// auth e db são injetados pelo app.js após init do Firebase
let _auth = null;
let _db   = null;

export function initAuth(auth, db) {
  _auth = auth;
  _db   = db;
}

/** Checa se o UID tem entrada válida em admins/{uid}. */
async function isAdmin(uid) {
  const snap = await get(ref(_db, `admins/${uid}`));
  if (!snap.exists()) return false;
  const val = snap.val();
  return val === true || val?.ativo === true;
}

/**
 * Faz login com username + senha.
 * @returns {Promise<{user, displayName}>}
 * @throws se credenciais inválidas ou usuário não for admin
 */
export async function login(username, password, lembrar = false) {
  const email = username.includes('@') ? username : `${username}${ADMIN_DOMAIN}`;

  await setPersistence(
    _auth,
    lembrar ? browserLocalPersistence : inMemoryPersistence
  );
  localStorage.setItem(LEMBRAR_KEY, lembrar ? "sim" : "nao");

  const cred = await signInWithEmailAndPassword(_auth, email, password);
  const { user } = cred;

  const ok = await isAdmin(user.uid);
  if (!ok) {
    await fbSignOut(_auth);
    throw new Error("Usuário não tem permissão de administrador.");
  }

  return { user, displayName: username };
}

/** Encerra a sessão. */
export async function logout() {
  if (_auth) await fbSignOut(_auth);
}

/**
 * Restaura preferência de persistência na inicialização.
 * Deve ser chamado antes de onAuthStateChanged.
 */
export async function restorePersistence() {
  if (!_auth) return;
  const lembrar = localStorage.getItem(LEMBRAR_KEY) !== "nao";
  await setPersistence(
    _auth,
    lembrar ? browserLocalPersistence : inMemoryPersistence
  );
}

/**
 * Observa mudanças de estado de autenticação.
 * Chama onAdmin(user) quando o usuário logado for admin,
 * onLogout() quando não houver sessão admin válida.
 *
 * @returns {Function} unsubscribe
 */
export function observeAuth(onAdmin, onLogout) {
  return onAuthStateChanged(_auth, async (user) => {
    if (!user || user.isAnonymous) {
      onLogout();
      return;
    }
    try {
      const ok = await isAdmin(user.uid);
      if (ok) {
        onAdmin(user);
      } else {
        await fbSignOut(_auth);
        onLogout();
      }
    } catch {
      onLogout();
    }
  });
}

/** Retorna o usuário atual ou null. */
export function currentUser() {
  return _auth?.currentUser ?? null;
}
