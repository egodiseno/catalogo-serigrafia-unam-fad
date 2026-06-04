/**
 * config.js — Supabase Client (vanilla JS, sin bundler)
 * Fase 1.A
 */

// ── Verificar CDN ──────────────────────────────────────────
if (!window.supabase) {
  throw new Error('Supabase JS client no está cargado. Verifica el CDN en index.html.');
}

// ── Credenciales (anon key — segura en frontend) ───────────
const SUPABASE_URL     = 'https://kfvjansfmhamkrnbxmgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

// ── Crear cliente ──────────────────────────────────────────
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase_client = supabaseClient;

console.log('✅ Supabase client inicializado');

// ── Utilidades de Auth ─────────────────────────────────────

async function getCurrentUser() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error) { console.error('getCurrentUser:', error); return null; }
  return user;
}

async function getSession() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) { console.error('getSession:', error); return null; }
  return session;
}

async function loginWithEmail(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { console.error('loginWithEmail:', error); return { success: false, error }; }
  return { success: true, user: data.user };
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) { console.error('logout:', error); return false; }
  return true;
}

function onAuthStateChange(callback) {
  return supabaseClient.auth.onAuthStateChange((event, session) => callback(event, session));
}

// ── Namespace global ───────────────────────────────────────
window.supabaseConfig = {
  client: supabaseClient,
  getCurrentUser,
  getSession,
  loginWithEmail,
  logout,
  onAuthStateChange,
};
