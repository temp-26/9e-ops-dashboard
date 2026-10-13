// Fetches the encrypted files from the website and opens them with the password key.
// Files are fetched fresh every time (no browser cache), so "Refresh data" sees new uploads.
import * as V from './vault.js';
import { loadRaw } from './data.js';
import { rebuild } from './model.js';

async function fetchJson(file) {
  const res = await fetch(`./${file}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Couldn't load ${file} (${res.status}).`);
  return res.json();
}

export class AccessError extends Error {}

async function loadOnce(pwKey) {
  const keyFile = await fetchJson('key.json');
  let dataKey;
  try { dataKey = await V.unlockDataKey(pwKey, keyFile); } catch {
    throw new AccessError('The dashboard password has changed. Please sign in again.');
  }
  return V.openJson(dataKey, await fetchJson('data.enc.json'));
}

/** Loads (or reloads) the data and rebuilds every figure. */
export async function loadWith(pwKey) {
  let raw;
  try {
    raw = await loadOnce(pwKey);
  } catch (e) {
    if (e instanceof AccessError) throw e;
    // The site may have been mid-update (files from two versions) — wait and try once more.
    await new Promise((r) => setTimeout(r, 1500));
    raw = await loadOnce(pwKey);
  }
  loadRaw(raw);
  rebuild();
  return raw;
}

export async function signIn(password) {
  const keyFile = await fetchJson('key.json');
  const pwKey = await V.passwordKey(password, keyFile.salt, keyFile.iter);
  try { await V.unlockDataKey(pwKey, keyFile); } catch { throw new AccessError('Wrong password.'); }
  const raw = await loadWith(pwKey);
  return { pwKey, raw };
}
