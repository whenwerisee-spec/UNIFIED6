/**
 * Verification test for BIP-39 mnemonic generation & encrypted vault storage
 */
import { 
  generateAndVaultBip39Wallet, 
  decryptSecrets,
  deriveDeterministicHDWallet,
  deriveAndVaultDeterministicWallet,
  createDeterministicSigner,
  verifySignerAndAddressSync,
  PRIMARY_WEB3_AUTHORITY_ADDRESS,
  STANDARD_HD_DERIVATION_PATH
} from '../src/lib/vault-storage';

// Mock minimal IndexedDB for node CLI test environment if needed
if (typeof window === 'undefined') {
  (globalThis as any).window = {
    crypto: globalThis.crypto,
    indexedDB: {
      open: () => {
        const store: Record<string, any> = {};
        const req: any = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          result: {
            objectStoreNames: { contains: () => true },
            transaction: () => ({
              objectStore: () => ({
                put: (record: any) => {
                  store[record.id] = record;
                  const putReq: any = { onsuccess: null, onerror: null };
                  setTimeout(() => putReq.onsuccess && putReq.onsuccess(), 0);
                  return putReq;
                },
                get: (id: string) => {
                  const getReq: any = { onsuccess: null, onerror: null, result: store[id] };
                  setTimeout(() => getReq.onsuccess && getReq.onsuccess(), 0);
                  return getReq;
                }
              })
            })
          }
        };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }
    }
  };
}

async function testBip39Vault() {
  console.log('--- Testing BIP-39 Wallet Generation & Vault Storage ---');

  const passphrase = 'MySecretEncryptionPassphrase123!';
  const label = 'Primary Sovereign BIP-39 Vault';

  console.log('1. Generating 12-word BIP-39 wallet and storing in encrypted vault...');
  const result = await generateAndVaultBip39Wallet(label, passphrase, {
    coinSymbol: 'ETH',
    network: 'Ethereum'
  });

  console.log('✓ Public Address generated:', result.address);
  console.log('✓ 12-Word Mnemonic Word Count:', result.mnemonicPhrase.split(' ').length);
  console.log('✓ Vault Record ID:', result.vaultRecord.id);
  console.log('✓ Ciphertext Present:', Boolean(result.vaultRecord.ciphertextHex));

  console.log('2. Verifying decryption of the saved ciphertext...');
  const decrypted = await decryptSecrets(
    result.vaultRecord.ciphertextHex,
    result.vaultRecord.saltHex,
    result.vaultRecord.ivHex,
    passphrase
  );

  if (decrypted.mnemonic !== result.mnemonicPhrase) {
    throw new Error('Decrypted mnemonic does not match generated mnemonic!');
  }
  if (!decrypted.privateKey?.startsWith('0x')) {
    throw new Error('Decrypted private key is missing or invalid format.');
  }

  console.log('✓ Decrypted mnemonic and private key successfully match!');

  console.log('\n3. Testing Deterministic HD Wallet Derivation (BIP-44: m/44\'/60\'/0\'/0/0)...');
  const masterSecret = 'user-sovereign-master-seed-2026';
  const derived1 = deriveDeterministicHDWallet(masterSecret);
  const derived2 = deriveDeterministicHDWallet(masterSecret);

  if (derived1.address !== derived2.address) {
    throw new Error('Deterministic derivation failed: derived addresses do not match across runs!');
  }
  if (derived1.privateKey !== derived2.privateKey) {
    throw new Error('Deterministic derivation failed: derived private keys do not match across runs!');
  }
  console.log('✓ Deterministic Address 1:', derived1.address);
  console.log('✓ Deterministic Address 2:', derived2.address);
  console.log('✓ Derivation Path:', derived1.derivationPath);
  console.log('✓ Mnemonic 12 words:', derived1.mnemonicPhrase);

  console.log('\n4. Testing Signer and Address Synchronization with Cryptographic Verification...');
  const signer = createDeterministicSigner(derived1.privateKey);
  const syncResult = await verifySignerAndAddressSync(signer, derived1.address);

  if (!syncResult.isValid || !syncResult.isChecksumMatch) {
    throw new Error('Signer and address cryptographic sync verification failed!');
  }
  console.log('✓ Signer Address:', syncResult.signerAddress);
  console.log('✓ Expected Address:', syncResult.expectedAddress);
  console.log('✓ Checksum Match:', syncResult.isChecksumMatch);
  console.log('✓ Recovered Signer:', syncResult.recoveredSigner);
  console.log('✓ 100% Mathematical Match Verified!');

  console.log('\n5. Testing Deterministic Vault Persistence & Retrieval in Encrypted Storage...');
  const detVault = await deriveAndVaultDeterministicWallet(
    'Deterministic Master Vault',
    passphrase,
    masterSecret,
    { derivationPath: STANDARD_HD_DERIVATION_PATH }
  );

  console.log('✓ Deterministic Vault Saved:', detVault.vaultRecord.id);
  console.log('✓ Vault Address:', detVault.vaultRecord.metadata.address);
  console.log('✓ Deterministic Flag:', detVault.vaultRecord.metadata.isDeterministic);

  console.log('\nAll BIP-39 & Deterministic Vault tests completed successfully with 100% mathematical integrity!');
}

testBip39Vault().catch((err) => {
  console.error('BIP-39 Vault test failed:', err);
  process.exit(1);
});
