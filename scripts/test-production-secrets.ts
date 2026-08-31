import assert from 'assert';
import { validateProductionSecrets, validateLiveOperationConfig } from '../src/lib/production-config.js';

function run() {
  const missingCore = validateProductionSecrets({
    NODE_ENV: 'production',
    SOVEREIGN_ENCRYPTION_KEY: '',
    JWT_SECRET: 'short',
    SOVEREIGN_ADMIN_EMAILS: 'ops@example.com'
  });
  assert.equal(missingCore.ok, false);
  assert.match(missingCore.errors.join('\n'), /SOVEREIGN_ENCRYPTION_KEY/);
  assert.match(missingCore.errors.join('\n'), /JWT_SECRET/);

  const exchangeOk = validateProductionSecrets({
    NODE_ENV: 'production',
    SOVEREIGN_ENCRYPTION_KEY: 'a'.repeat(64),
    JWT_SECRET: 'b'.repeat(64),
    SOVEREIGN_ADMIN_EMAILS: 'ops@example.com',
    COINBASE_API_KEY_ID: 'cb-key-1234',
    COINBASE_API_SECRET_RAW: 'cb-secret-1234'
  }, { requireProviderSecrets: true, operation: 'exchange' });
  assert.equal(exchangeOk.ok, true);

  const exchangeMissing = validateProductionSecrets({
    NODE_ENV: 'production',
    SOVEREIGN_ENCRYPTION_KEY: 'a'.repeat(64),
    JWT_SECRET: 'b'.repeat(64),
    SOVEREIGN_ADMIN_EMAILS: 'ops@example.com'
  }, { requireProviderSecrets: true, operation: 'exchange' });
  assert.equal(exchangeMissing.ok, false);
  assert.match(exchangeMissing.errors.join('\n'), /exchange provider/i);

  const walletMissing = validateLiveOperationConfig({
    NODE_ENV: 'production',
    SOVEREIGN_ENCRYPTION_KEY: 'a'.repeat(64),
    JWT_SECRET: 'b'.repeat(64),
    SOVEREIGN_ADMIN_EMAILS: 'ops@example.com'
  }, 'wallet');
  assert.equal(walletMissing.ok, false);
  assert.match(walletMissing.errors.join('\n'), /MARSHALL_WALLET_PRIVATE_KEY/i);

  const walletOk = validateLiveOperationConfig({
    NODE_ENV: 'production',
    SOVEREIGN_ENCRYPTION_KEY: 'a'.repeat(64),
    JWT_SECRET: 'b'.repeat(64),
    SOVEREIGN_ADMIN_EMAILS: 'ops@example.com',
    MARSHALL_WALLET_PRIVATE_KEY: 'c'.repeat(64)
  }, 'wallet');
  assert.equal(walletOk.ok, true);

  console.log('production secret validation tests passed');
}

run();
