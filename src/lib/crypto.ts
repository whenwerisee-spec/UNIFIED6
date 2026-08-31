/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Helper to convert array buffer to hex string
function bufToHex(buffer: ArrayBuffer | Uint8Array): string {
  return Array.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper to convert hex string to array buffer
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Derive a 256-bit AES-GCM key from password and salt using PBKDF2
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string using a password/PIN.
 * Returns { ciphertext, salt, iv } as hex strings.
 */
export async function encryptData(plaintext: string, passwordHex: string): Promise<{
  ciphertext: string;
  salt: string;
  iv: string;
}> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(passwordHex, salt);
  const enc = new TextEncoder();
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  
  return {
    ciphertext: bufToHex(encrypted),
    salt: bufToHex(salt),
    iv: bufToHex(iv)
  };
}

/**
 * Decrypt an AES-GCM encrypted hex string using a password/PIN.
 */
export async function decryptData(
  ciphertextHex: string,
  passwordHex: string,
  saltHex: string,
  ivHex: string
): Promise<string> {
  const salt = hexToBuf(saltHex);
  const iv = hexToBuf(ivHex);
  const ciphertext = hexToBuf(ciphertextHex);
  
  const key = await deriveKey(passwordHex, salt);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

/**
 * Hash a PIN using SHA-256.
 */
export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(pin);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
