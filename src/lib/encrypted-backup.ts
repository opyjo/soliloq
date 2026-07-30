const ITERATIONS = 310_000;

type EncryptedBackup = {
  format: "still-encrypted-backup";
  version: 1;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function fromBase64(value: string) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackup(value: unknown, password: string) {
  if (password.length < 10) {
    throw new Error("Use at least 10 characters for an encrypted backup.");
  }
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  const payload: EncryptedBackup = {
    format: "still-encrypted-backup",
    version: 1,
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(payload);
}

export async function decryptBackup(contents: string, password: string) {
  let payload: EncryptedBackup;
  try {
    payload = JSON.parse(contents) as EncryptedBackup;
  } catch {
    throw new Error("This is not a valid encrypted Still backup.");
  }
  if (
    payload.format !== "still-encrypted-backup" ||
    payload.version !== 1 ||
    !payload.salt ||
    !payload.iv ||
    !payload.ciphertext
  ) {
    throw new Error("This encrypted backup format is not supported.");
  }
  try {
    const salt = fromBase64(payload.salt);
    const key = await deriveKey(password, salt, payload.iterations);
    const plaintext = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
  } catch {
    throw new Error("The password is incorrect or the backup is damaged.");
  }
}
