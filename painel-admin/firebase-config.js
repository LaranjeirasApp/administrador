/**
 * Configuração pública do Firebase SDK.
 * Estas chaves são públicas por design (são enviadas ao navegador pelo
 * Firebase official docs). A segurança real é feita pelas Realtime
 * Database Security Rules, não por manter as chaves em segredo.
 *
 * Não adicionar chaves de conta de serviço, tokens privados ou segredos
 * de Functions aqui — esses NUNCA vão para o frontend.
 */
export const firebaseConfig = {
  apiKey:            "AIzaSyBKDqCKiV2OzqDUMYTU1BJLNG9oFAGpMeU",
  authDomain:        "controlequadras-95e02.firebaseapp.com",
  databaseURL:       "https://controlequadras-95e02-default-rtdb.firebaseio.com",
  projectId:         "controlequadras-95e02",
  storageBucket:     "controlequadras-95e02.firebasestorage.app",
  messagingSenderId: "548582626548",
  appId:             "1:548582626548:web:0858affd903b39c6743aa1",
};

/**
 * Nome da instância Firebase para este painel.
 * Usar nome distinto evita conflito de sessão de auth com o app do morador
 * (que usa "[DEFAULT]"). Sem nome, entrar como morador derruba o admin e
 * vice-versa — bug já documentado no admin.js original.
 */
export const APP_NAME = "painel-admin-v2";

/** Domínio fictício que o painel usa para login de admin. */
export const ADMIN_DOMAIN = "@admin.local";
