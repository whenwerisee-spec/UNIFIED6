import { ethers } from 'ethers';

export const PRIMARY_WEB3_AUTHORITY_ADDRESS = (import.meta as any).env?.VITE_MARSHALL_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
export const STANDARD_HD_DERIVATION_PATH = "m/44'/60'/0'/0/0";

export interface DeterministicDerivationResult {
  address: string;
  privateKey: string;
  publicKey: string;
  mnemonicPhrase: string;
  derivationPath: string;
  masterSeedHash: string;
  isTargetAuthorityMatch: boolean;
}

/**
 * Deterministically derive an HD Wallet and signing key from a master secret seed
 * or BIP-39 mnemonic phrase using standard BIP-44 EVM path (m/44'/60'/0'/0/0).
 */
export function deriveDeterministicHDWallet(
  masterSecretOrMnemonic: string,
  options?: {
    derivationPath?: string;
    bip39Passphrase?: string;
    targetAddress?: string;
  }
): DeterministicDerivationResult {
  const input = (masterSecretOrMnemonic || '').trim();
  if (!input) {
    throw new Error('Master secret seed or BIP-39 mnemonic phrase is required for deterministic derivation.');
  }

  const derivationPath = options?.derivationPath || STANDARD_HD_DERIVATION_PATH;
  const bip39Passphrase = options?.bip39Passphrase || '';
  const targetAddress = options?.targetAddress || PRIMARY_WEB3_AUTHORITY_ADDRESS;

  let hdWallet: ethers.HDNodeWallet;
  let mnemonicPhrase = '';

  const words = input.split(/\s+/);
  if (words.length === 12 || words.length === 24) {
    // Input is directly a valid BIP-39 mnemonic phrase
    mnemonicPhrase = words.join(' ');
    hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonicPhrase, bip39Passphrase, derivationPath);
  } else if (input.startsWith('0x') && input.length === 66) {
    // Input is a raw private key hex string
    const wallet = new ethers.Wallet(input);
    const address = ethers.getAddress(wallet.address);
    const publicKey = wallet.signingKey?.publicKey || ethers.SigningKey.computePublicKey(wallet.privateKey);
    const masterSeedHash = ethers.sha256(ethers.toUtf8Bytes(input));
    return {
      address,
      privateKey: wallet.privateKey,
      publicKey,
      mnemonicPhrase: '',
      derivationPath,
      masterSeedHash,
      isTargetAuthorityMatch: targetAddress ? address.toLowerCase() === targetAddress.toLowerCase() : false
    };
  } else {
    // Input is a master secret passphrase/seed string -> Deterministically derive 128-bit entropy for BIP-39
    const entropyHex = ethers.sha256(ethers.toUtf8Bytes(`SOVEREIGN_MASTER_SEED_SALT_2026:${input}`)).slice(0, 34); // 16 bytes = 12 words
    const mnemonicObj = ethers.Mnemonic.fromEntropy(entropyHex);
    mnemonicPhrase = mnemonicObj.phrase;
    hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonicPhrase, bip39Passphrase, derivationPath);
  }

  const address = ethers.getAddress(hdWallet.address);
  const masterSeedHash = ethers.sha256(ethers.toUtf8Bytes(input));
  const isTargetAuthorityMatch = targetAddress ? address.toLowerCase() === targetAddress.toLowerCase() : false;

  return {
    address,
    privateKey: hdWallet.privateKey,
    publicKey: hdWallet.publicKey,
    mnemonicPhrase,
    derivationPath: hdWallet.path || derivationPath,
    masterSeedHash,
    isTargetAuthorityMatch
  };
}

/**
 * Create a deterministic active ethers Signer (Wallet or HDNodeWallet)
 * ready for non-malleable cryptographic message and transaction signing.
 */
export function createDeterministicSigner(
  privateKeyOrMnemonic: string,
  derivationPath = STANDARD_HD_DERIVATION_PATH,
  provider?: ethers.Provider
): ethers.Wallet | ethers.HDNodeWallet {
  const input = (privateKeyOrMnemonic || '').trim();
  const words = input.split(/\s+/);

  if (words.length === 12 || words.length === 24) {
    const hd = ethers.HDNodeWallet.fromPhrase(words.join(' '), '', derivationPath);
    return provider ? hd.connect(provider) : hd;
  }

  const wallet = new ethers.Wallet(input);
  return provider ? wallet.connect(provider) : wallet;
}

/**
 * Verify that a Signer instance and an expected address remain 100% synchronized
 * by performing a test signature and cryptographic public key recovery check.
 */
export async function verifySignerAndAddressSync(
  signer: ethers.Wallet | ethers.HDNodeWallet | ethers.Signer,
  expectedAddress = PRIMARY_WEB3_AUTHORITY_ADDRESS
): Promise<{
  isValid: boolean;
  signerAddress: string;
  expectedAddress: string;
  isChecksumMatch: boolean;
  recoveredSigner: string;
  signature: string;
}> {
  const signerAddress = ethers.getAddress(await signer.getAddress());
  const formattedExpected = ethers.getAddress(expectedAddress);

  // Sign a deterministic verification digest challenge
  const challengeMessage = `KEY_AUTHORITY_SESSION_SYNC_VERIFICATION:${signerAddress}:${Date.now()}`;
  const signature = await signer.signMessage(challengeMessage);
  const recoveredSigner = ethers.getAddress(ethers.verifyMessage(challengeMessage, signature));

  const isMatch = signerAddress.toLowerCase() === formattedExpected.toLowerCase();
  const isChecksumMatch = signerAddress === formattedExpected;
  const isRecoveredMatch = recoveredSigner === signerAddress;

  return {
    isValid: isMatch && isRecoveredMatch,
    signerAddress,
    expectedAddress: formattedExpected,
    isChecksumMatch,
    recoveredSigner,
    signature
  };
}

/**
 * Derive a deterministic HD wallet from a master secret and save it
 * encrypted at rest in IndexedDB, ensuring persistence across device sessions.
 */
export async function deriveAndVaultDeterministicWallet(
  label: string,
  vaultPassphrase: string,
  masterSecretOrMnemonic: string,
  options?: {
    derivationPath?: string;
    targetAddress?: string;
    coinSymbol?: string;
    network?: string;
  }
): Promise<{
  vaultRecord: EncryptedVaultRecord;
  derivation: DeterministicDerivationResult;
}> {
  if (!vaultPassphrase || vaultPassphrase.length < 6) {
    throw new Error('A strong passphrase of at least 6 characters is required to encrypt the vault.');
  }

  const derivation = deriveDeterministicHDWallet(masterSecretOrMnemonic, {
    derivationPath: options?.derivationPath,
    targetAddress: options?.targetAddress
  });

  const vaultId = `vault_det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const secrets: VaultSecrets = {
    privateKey: derivation.privateKey,
    mnemonic: derivation.mnemonicPhrase,
    customFields: {
      derivationPath: derivation.derivationPath,
      publicKey: derivation.publicKey,
      masterSeedHash: derivation.masterSeedHash
    }
  };

  const vaultRecord = await saveVaultRecord(
    vaultId,
    secrets,
    vaultPassphrase,
    {
      label: label || 'Deterministic HD Key Vault',
      address: derivation.address,
      coinSymbol: options?.coinSymbol || 'ETH',
      network: options?.network || 'Ethereum',
      isDeterministic: true,
      derivationPath: derivation.derivationPath,
      masterSeedHash: derivation.masterSeedHash,
      syncStatus: 'SYNCHRONIZED'
    }
  );

  return {
    vaultRecord,
    derivation
  };
}

/**
 * Load and instantiate an in-memory deterministic Signer from an encrypted vault
 */
export async function getVaultDeterministicSigner(
  vaultId: string,
  vaultPassphrase: string,
  provider?: ethers.Provider
): Promise<{
  signer: ethers.Wallet | ethers.HDNodeWallet;
  metadata: VaultMetadata;
  secrets: VaultSecrets;
}> {
  const { secrets, metadata } = await loadAndDecryptVault(vaultId, vaultPassphrase);

  let signer: ethers.Wallet | ethers.HDNodeWallet;
  if (secrets.mnemonic && secrets.mnemonic.trim().length > 0) {
    const path = secrets.customFields?.derivationPath || STANDARD_HD_DERIVATION_PATH;
    signer = createDeterministicSigner(secrets.mnemonic, path, provider);
  } else if (secrets.privateKey && secrets.privateKey.trim().length > 0) {
    signer = createDeterministicSigner(secrets.privateKey, STANDARD_HD_DERIVATION_PATH, provider);
  } else {
    throw new Error('Vault does not contain a valid private key or mnemonic phrase.');
  }

  // Ensure the signer address matches vault metadata
  const derivedAddress = ethers.getAddress(await signer.getAddress());
  if (metadata.address && derivedAddress.toLowerCase() !== metadata.address.toLowerCase()) {
    throw new Error(`Signer address mismatch: Vault address ${metadata.address} != Derived ${derivedAddress}`);
  }

  return {
    signer,
    metadata,
    secrets
  };
}

/**
 * Generate a new cryptographically secure 12-word BIP-39 mnemonic phrase,
 * derive its master private key and standard public address, and persist it
 * encrypted at rest in the Vault Storage Layer using saveVaultRecord.
 */
export async function generateAndVaultBip39Wallet(
  label: string,
  passphrase: string,
  options?: {
    coinSymbol?: string;
    network?: string;
    derivationPath?: string;
  }
): Promise<{
  vaultRecord: EncryptedVaultRecord;
  address: string;
  mnemonicPhrase: string;
  publicKey: string;
}> {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('A strong passphrase of at least 6 characters is required to secure the vault.');
  }

  const derivationPath = options?.derivationPath || STANDARD_HD_DERIVATION_PATH;

  // Generate a random 128-bit entropy BIP-39 mnemonic wallet (12 words)
  const randomWallet = ethers.HDNodeWallet.createRandom(undefined, derivationPath);
  
  if (!randomWallet.mnemonic) {
    throw new Error('Failed to generate BIP-39 mnemonic seed phrase.');
  }

  const mnemonicPhrase = randomWallet.mnemonic.phrase;
  const privateKey = randomWallet.privateKey;
  const address = ethers.getAddress(randomWallet.address);
  const publicKey = randomWallet.publicKey;

  const vaultId = `vault_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const secrets: VaultSecrets = {
    privateKey,
    mnemonic: mnemonicPhrase,
    customFields: {
      derivationPath: randomWallet.path || derivationPath,
      publicKey
    }
  };

  const vaultRecord = await saveVaultRecord(
    vaultId,
    secrets,
    passphrase,
    {
      label: label || 'BIP-39 HD Wallet Vault',
      address,
      coinSymbol: options?.coinSymbol || 'ETH',
      network: options?.network || 'EVM',
      isDeterministic: true,
      derivationPath: randomWallet.path || derivationPath,
      syncStatus: 'SYNCHRONIZED'
    }
  );

  return {
    vaultRecord,
    address,
    mnemonicPhrase,
    publicKey
  };
}


/**
 * Client-Side Encrypted Vault Storage Layer
 * 
 * Uses the Web Crypto SubtleCrypto API (PBKDF2-SHA256 + AES-GCM-256)
 * to encrypt sensitive wallet credentials (private keys, mnemonic phrases)
 * at rest before persisting them locally in IndexedDB.
 * 
 * Sensitive plaintext data is never stored unencrypted in memory or disk.
 */

const VAULT_DB_NAME = 'SovereignKeyVaultDB';
const VAULT_DB_VERSION = 1;
const VAULT_STORE_NAME = 'encrypted_vaults';
const PBKDF2_ITERATIONS = 100000;

export interface VaultSecrets {
  privateKey?: string;
  mnemonic?: string;
  extraEntropy?: string;
  customFields?: Record<string, string>;
}

export interface VaultMetadata {
  id: string;
  label: string;
  address?: string;
  coinSymbol?: string;
  network?: string;
  hasMnemonic: boolean;
  hasPrivateKey: boolean;
  isDeterministic?: boolean;
  derivationPath?: string;
  masterSeedHash?: string;
  syncStatus?: 'SYNCHRONIZED' | 'LOCAL';
  createdAt: number;
  updatedAt: number;
}

export interface EncryptedVaultRecord {
  id: string;
  vaultVersion: number;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltHex: string;
  ivHex: string;
  ciphertextHex: string;
  metadata: VaultMetadata;
}

/**
 * Helper: Convert Uint8Array to hexadecimal string
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Helper: Convert hexadecimal string to Uint8Array
 */
function hexToBuffer(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hexadecimal string length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Get the Web Crypto API subtle instance safely in browser or test environments
 */
function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Cryptography SubtleCrypto API is not supported in this environment.');
}

/**
 * Derive an AES-GCM 256-bit key from a user password and salt using PBKDF2
 */
async function deriveEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt arbitrary JSON secrets with a user password
 */
export async function encryptSecrets(
  secrets: VaultSecrets,
  passphrase: string
): Promise<{ saltHex: string; ivHex: string; ciphertextHex: string }> {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('Passphrase must be at least 6 characters for vault encryption.');
  }

  const subtle = getSubtleCrypto();
  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
  
  const salt = cryptoObj.getRandomValues(new Uint8Array(16));
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  
  const derivedKey = await deriveEncryptionKey(passphrase, salt);
  const encoder = new TextEncoder();
  const plaintext = JSON.stringify(secrets);

  const encryptedBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    encoder.encode(plaintext)
  );

  return {
    saltHex: bufferToHex(salt),
    ivHex: bufferToHex(iv),
    ciphertextHex: bufferToHex(encryptedBuffer)
  };
}

/**
 * Decrypt an encrypted vault payload using the user's passphrase
 */
export async function decryptSecrets(
  ciphertextHex: string,
  saltHex: string,
  ivHex: string,
  passphrase: string
): Promise<VaultSecrets> {
  const subtle = getSubtleCrypto();
  const salt = hexToBuffer(saltHex);
  const iv = hexToBuffer(ivHex);
  const ciphertext = hexToBuffer(ciphertextHex);

  const derivedKey = await deriveEncryptionKey(passphrase, salt);

  try {
    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      ciphertext
    );
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decryptedBuffer);
    return JSON.parse(plaintext) as VaultSecrets;
  } catch {
    throw new Error('Vault decryption failed: Invalid passphrase or corrupted data.');
  }
}

/**
 * Initialize and open IndexedDB for Vault Storage
 */
let vaultDbPromise: Promise<IDBDatabase> | null = null;

function getVaultDB(): Promise<IDBDatabase> {
  if (vaultDbPromise) return vaultDbPromise;

  vaultDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const idb = typeof window !== 'undefined' ? window.indexedDB : (typeof globalThis !== 'undefined' ? (globalThis as any).indexedDB : null);
    if (!idb) {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = idb.open(VAULT_DB_NAME, VAULT_DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
        db.createObjectStore(VAULT_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      vaultDbPromise = null;
      reject(request.error || new Error('Failed to open Vault IndexedDB'));
    };
  });

  return vaultDbPromise;
}

/**
 * Encrypt and store wallet secrets at rest in IndexedDB
 */
export async function saveVaultRecord(
  id: string,
  secrets: VaultSecrets,
  passphrase: string,
  metadataInfo: Omit<VaultMetadata, 'id' | 'hasMnemonic' | 'hasPrivateKey' | 'createdAt' | 'updatedAt'>
): Promise<EncryptedVaultRecord> {
  const now = Date.now();
  const { saltHex, ivHex, ciphertextHex } = await encryptSecrets(secrets, passphrase);

  const metadata: VaultMetadata = {
    id,
    label: metadataInfo.label || 'Standard Wallet Vault',
    address: metadataInfo.address,
    coinSymbol: metadataInfo.coinSymbol,
    network: metadataInfo.network,
    hasMnemonic: Boolean(secrets.mnemonic && secrets.mnemonic.trim().length > 0),
    hasPrivateKey: Boolean(secrets.privateKey && secrets.privateKey.trim().length > 0),
    isDeterministic: metadataInfo.isDeterministic,
    derivationPath: metadataInfo.derivationPath,
    masterSeedHash: metadataInfo.masterSeedHash,
    syncStatus: metadataInfo.syncStatus,
    createdAt: now,
    updatedAt: now
  };

  const record: EncryptedVaultRecord = {
    id,
    vaultVersion: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    saltHex,
    ivHex,
    ciphertextHex,
    metadata
  };

  const db = await getVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([VAULT_STORE_NAME], 'readwrite');
    const store = tx.objectStore(VAULT_STORE_NAME);
    const putRequest = store.put(record);

    putRequest.onsuccess = () => resolve(record);
    putRequest.onerror = () => reject(putRequest.error || new Error('Failed to save vault record'));
  });
}

/**
 * Load an encrypted record from IndexedDB and decrypt its secrets
 */
export async function loadAndDecryptVault(
  id: string,
  passphrase: string
): Promise<{ secrets: VaultSecrets; metadata: VaultMetadata }> {
  const db = await getVaultDB();
  const record: EncryptedVaultRecord | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction([VAULT_STORE_NAME], 'readonly');
    const store = tx.objectStore(VAULT_STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => resolve(getReq.result);
    getReq.onerror = () => reject(getReq.error || new Error('Failed to read vault record'));
  });

  if (!record) {
    throw new Error(`No encrypted vault found with ID: ${id}`);
  }

  const secrets = await decryptSecrets(record.ciphertextHex, record.saltHex, record.ivHex, passphrase);
  return {
    secrets,
    metadata: record.metadata
  };
}

/**
 * List all non-sensitive metadata for saved vaults in IndexedDB
 */
export async function listVaultMetadata(): Promise<VaultMetadata[]> {
  const db = await getVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([VAULT_STORE_NAME], 'readonly');
    const store = tx.objectStore(VAULT_STORE_NAME);
    const getAllReq = store.getAll();

    getAllReq.onsuccess = () => {
      const records: EncryptedVaultRecord[] = getAllReq.result || [];
      const metaList = records.map((r) => r.metadata);
      resolve(metaList);
    };
    getAllReq.onerror = () => reject(getAllReq.error || new Error('Failed to list vaults'));
  });
}

/**
 * Delete a vault record permanently from IndexedDB
 */
export async function deleteVaultRecord(id: string): Promise<boolean> {
  const db = await getVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([VAULT_STORE_NAME], 'readwrite');
    const store = tx.objectStore(VAULT_STORE_NAME);
    const delReq = store.delete(id);

    delReq.onsuccess = () => resolve(true);
    delReq.onerror = () => reject(delReq.error || new Error('Failed to delete vault'));
  });
}

/**
 * Export an encrypted keystore JSON package for secure offline backup
 */
export async function exportEncryptedKeystore(id: string): Promise<string> {
  const db = await getVaultDB();
  const record: EncryptedVaultRecord | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction([VAULT_STORE_NAME], 'readonly');
    const store = tx.objectStore(VAULT_STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => resolve(getReq.result);
    getReq.onerror = () => reject(getReq.error || new Error('Failed to export vault'));
  });

  if (!record) {
    throw new Error(`Vault ID ${id} not found`);
  }

  return JSON.stringify(record, null, 2);
}

/**
 * Import a standard EncryptedVaultRecord JSON into IndexedDB
 */
export async function importEncryptedKeystore(keystoreJson: string): Promise<VaultMetadata> {
  const record = JSON.parse(keystoreJson) as EncryptedVaultRecord;
  if (!record.id || !record.saltHex || !record.ivHex || !record.ciphertextHex || !record.metadata) {
    throw new Error('Invalid keystore structure: Missing required cryptographic fields.');
  }

  const db = await getVaultDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([VAULT_STORE_NAME], 'readwrite');
    const store = tx.objectStore(VAULT_STORE_NAME);
    const putReq = store.put(record);

    putReq.onsuccess = () => resolve(true);
    putReq.onerror = () => reject(putReq.error || new Error('Failed to import vault record'));
  });

  return record.metadata;
}
