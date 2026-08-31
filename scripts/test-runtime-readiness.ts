import assert from 'assert';
import { getCriticalOperationsEnforcementState } from '../src/lib/critical-operations-enforcer.js';
import { buildRuntimeReadinessReport } from '../src/lib/runtime-readiness.js';

async function main() {
  const baseEnv = {
  NODE_ENV: 'production',
  SOVEREIGN_ENCRYPTION_KEY: '01234567890123456789012345678901',
  JWT_SECRET: '01234567890123456789012345678901',
  MARSHALL_WALLET_PRIVATE_KEY: '0x1234567890abcdef',
  COINBASE_API_KEY_ID: 'coinbase-key',
  COINBASE_API_SECRET_RAW: 'coinbase-secret',
  SOVEREIGN_ADMIN_EMAILS: 'admin@example.com',
  MAILERSEND_API_KEY: 'mailersend-key'
};

  const enforcementState = getCriticalOperationsEnforcementState();
  assert.equal(enforcementState.requiresVerifiedExternalProof, true);
  assert.equal(enforcementState.moneyMovingOperationsBlockedUntilVerified, true);

  const ready = await buildRuntimeReadinessReport(baseEnv as NodeJS.ProcessEnv);
  assert.equal(ready.isReady, true);
  assert.deepEqual(ready.missingConfig, []);
  assert.ok(ready.checks.some((check) => check.name === 'Financial proof enforcement' && check.status === 'safe'));

  const incomplete = await buildRuntimeReadinessReport({
    ...baseEnv,
    COINBASE_API_KEY_ID: '',
    COINBASE_API_SECRET_RAW: '',
    MAILERSEND_API_KEY: ''
  } as NodeJS.ProcessEnv);
  assert.equal(incomplete.isReady, false);
  assert.ok(incomplete.missingConfig.includes('Coinbase or Kraken exchange API credentials'));
  assert.ok(incomplete.missingConfig.includes('MAILERSEND_API_KEY or SMTP credentials'));

  console.log('runtime readiness tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
