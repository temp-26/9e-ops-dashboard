// Browser-side decryption of src/data/data.enc.json.
// Format (written by scripts/update-data.mjs): AES-256-GCM, key from PBKDF2-SHA256.
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

export async function deriveKey(password, enc) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, true, ['decrypt'],
  );
}

export async function decryptWithKey(key, enc) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

export const exportKey = async (key) => toB64(await crypto.subtle.exportKey('raw', key));
export const importKey = (b) => crypto.subtle.importKey('raw', b64(b), 'AES-GCM', true, ['decrypt']);
