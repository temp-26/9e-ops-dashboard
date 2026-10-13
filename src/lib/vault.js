// Encryption shared by the browser and scripts/update-data.mjs.
//
// How it works
//   • The workforce data is encrypted with a random AES-256 key (the "data key").
//   • The data key is itself encrypted with a key made from the dashboard password
//     (PBKDF2-SHA256, 600,000 rounds) and stored in public/key.json.
//   • The data file (public/data.enc.json) is fetched fresh by the browser, so
//     "Refresh data" picks up a new upload without reloading the page.

const subtle = globalThis.crypto.subtle;
const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const te = new TextEncoder();
const td = new TextDecoder();
export const PBKDF2_ITER = 600000;

// ---------- base64 (works in browsers and Node) ----------
export function b64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(s) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

const aesKey = (raw, usage) => subtle.importKey('raw', raw, 'AES-GCM', false, [usage]);
async function seal(raw, bytes) {
  const iv = rand(12);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(raw, 'encrypt'), bytes);
  return { iv: b64(iv), data: b64(ct) };
}
async function open(raw, blob) {
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, await aesKey(raw, 'decrypt'), unb64(blob.data)));
}

export const newDataKey = () => rand(32);
export const sealJson = async (raw, obj) => ({ format: '9e-aes-gcm-v3', ...(await seal(raw, te.encode(JSON.stringify(obj)))) });
export const openJson = async (raw, blob) => JSON.parse(td.decode(await open(raw, blob)));

/** The key made from the password (raw bytes, so a signed-in tab can keep it for Refresh). */
export async function passwordKey(password, saltB64, iter = PBKDF2_ITER) {
  const base = await subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', salt: unb64(saltB64), iterations: iter, hash: 'SHA-256' }, base, 256));
}

/** Makes key.json: the data key locked with the password. */
export async function makeKeyFile(password, dataKey) {
  const salt = b64(rand(16));
  const pk = await passwordKey(password, salt);
  return { format: '9e-key-v3', kdf: 'PBKDF2-SHA256', iter: PBKDF2_ITER, salt, key: await seal(pk, dataKey), updatedAt: new Date().toISOString() };
}

/** Opens key.json with the password key. Throws if the password is wrong. */
export const unlockDataKey = (pwKey, keyFile) => open(pwKey, keyFile.key);
