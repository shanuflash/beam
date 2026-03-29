export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function importKey(b64url: string): Promise<CryptoKey> {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw",
    raw.buffer as ArrayBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Prepends a random 12-byte IV to the ciphertext: [IV (12)] [ciphertext]
export async function encryptChunk(
  key: CryptoKey,
  chunk: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    chunk
  );
  const result = new Uint8Array(new ArrayBuffer(12 + ciphertext.byteLength));
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), 12);
  return result;
}

export async function decryptChunk(
  key: CryptoKey,
  data: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = new Uint8Array(data.buffer, 0, 12);
  const ciphertext = new Uint8Array(data.buffer, 12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new Uint8Array(plaintext);
}
