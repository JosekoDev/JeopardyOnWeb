import { getServerUrl } from './serverUrl';

const STORAGE_KEY = 'jm_auth_v1';

function getStorage() {
  try {
    return window.localStorage;
  } catch (err) {
    return null;
  }
}

export function readAuth() {
  if (typeof window === 'undefined') return null;
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user?.username) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

export function writeAuth(auth) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
}

export async function apiFetch(path, options = {}, requireAuth = false) {
  const auth = readAuth();
  const headers = new Headers(options.headers || {});
  if (auth?.token) headers.set('Authorization', `Bearer ${auth.token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const base = getServerUrl();
  const res = await fetch(`${base}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    if (requireAuth) throw new Error('Please sign in to continue');
  }
  return res;
}

