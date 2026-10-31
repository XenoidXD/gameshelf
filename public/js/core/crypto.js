// Password hashing with the Web Crypto API (PBKDF2 + SHA-256 + random salt).
// Works in browsers and in Node.js 20+. Passwords are never stored as plain text.

const encoder = new TextEncoder();

const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((byte) => parseInt(byte, 16)));

export function randomSalt() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashPassword(password, saltHex, iterations = 100000) {
  const key = await globalThis.crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
    key,
    256
  );
  return toHex(bits);
}

// Compare two hex strings without bailing out at the first difference.
export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
