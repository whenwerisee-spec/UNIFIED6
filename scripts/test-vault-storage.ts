/**
 * Verification test for the SubtleCrypto Vault Storage layer
 */
import { encryptSecrets, decryptSecrets, VaultSecrets } from '../src/lib/vault-storage';

async function runVaultTests() {
  console.log('--- Testing SubtleCrypto Vault Storage Layer ---');

  const testSecrets: VaultSecrets = {
    privateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    mnemonic: 'witch collapse practice feed shame open despair creek road again ice least',
    customFields: {
      accountIndex: '0',
      derivationPath: "m/44'/60'/0'/0/0"
    }
  };

  const passphrase = 'SuperSecurePassphrase123!';

  console.log('1. Testing Encryption with PBKDF2 + AES-GCM-256...');
  const encrypted = await encryptSecrets(testSecrets, passphrase);
  if (!encrypted.ciphertextHex || !encrypted.saltHex || !encrypted.ivHex) {
    throw new Error('Encryption failed to return required ciphertext, salt, or IV.');
  }
  console.log('✓ Encrypted successfully. Salt length:', encrypted.saltHex.length, 'IV length:', encrypted.ivHex.length);

  console.log('2. Testing Decryption with valid passphrase...');
  const decrypted = await decryptSecrets(
    encrypted.ciphertextHex,
    encrypted.saltHex,
    encrypted.ivHex,
    passphrase
  );

  if (decrypted.privateKey !== testSecrets.privateKey) {
    throw new Error('Decrypted private key does not match original.');
  }
  if (decrypted.mnemonic !== testSecrets.mnemonic) {
    throw new Error('Decrypted mnemonic phrase does not match original.');
  }
  console.log('✓ Decryption succeeded and verified exact match.');

  console.log('3. Testing Decryption with wrong passphrase (must fail)...');
  let caughtWrongPassword = false;
  try {
    await decryptSecrets(
      encrypted.ciphertextHex,
      encrypted.saltHex,
      encrypted.ivHex,
      'WrongPassword456!'
    );
  } catch (err: any) {
    caughtWrongPassword = true;
    console.log('✓ Correctly rejected wrong passphrase with error:', err.message);
  }
  if (!caughtWrongPassword) {
    throw new Error('Vault failed to reject incorrect passphrase!');
  }

  console.log('4. Testing Tampered Ciphertext detection (must fail)...');
  let caughtTampering = false;
  try {
    // Flip characters in ciphertext
    const tamperedCiphertext =
      (encrypted.ciphertextHex[0] === 'a' ? 'b' : 'a') + encrypted.ciphertextHex.slice(1);
    await decryptSecrets(
      tamperedCiphertext,
      encrypted.saltHex,
      encrypted.ivHex,
      passphrase
    );
  } catch (err: any) {
    caughtTampering = true;
    console.log('✓ Correctly detected tampered ciphertext with error:', err.message);
  }
  if (!caughtTampering) {
    throw new Error('Vault failed to detect tampered ciphertext!');
  }

  console.log('\nAll SubtleCrypto Vault Storage tests passed successfully!');
}

runVaultTests().catch((err) => {
  console.error('Vault tests failed:', err);
  process.exit(1);
});
