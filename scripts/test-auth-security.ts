import assert from 'assert';
import crypto from 'crypto';
import { generateSessionId, signSessionToken, verifyPassword, verifySessionToken, verifyTotpCode, generateTotpCode } from '../src/lib/auth-security.js';

function run() {
  console.log('Running auth security tests...');

  const password = 'S3curePass!123';
  const salt = 'ledger_test_salt';
  const hash1000 = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  const hash100000 = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

  assert.equal(verifyPassword(password, salt, hash1000), true, 'Password verification should support legacy 1000-round hashes');
  assert.equal(verifyPassword(password, salt, hash100000), true, 'Password verification should support hardened 100000-round hashes');
  assert.equal(verifyPassword('wrong-password', salt, hash100000), false, 'Password verification should reject invalid credentials');

  const secret = '0123456789abcdef0123456789abcdef';
  const sid = generateSessionId();
  const token = signSessionToken(
    { sub: 'user-1', email: 'user@example.com', sid, mfa: true, name: 'User One' },
    secret,
    60
  );

  const claims = verifySessionToken(token, secret);
  assert.ok(claims, 'Signed token must verify');
  assert.equal(claims?.sub, 'user-1', 'Token subject should match');
  assert.equal(claims?.mfa, true, 'MFA claim should be preserved');
  assert.equal(verifySessionToken(token, 'wrong-secret'), null, 'Token must fail with wrong signing secret');

  const totpSecret = 'NY3XGZLDNFSXGZLD';
  const now = Date.now();
  const currentCode = generateTotpCode(totpSecret, now);
  assert.equal(verifyTotpCode(totpSecret, currentCode), true, 'Current TOTP code should verify');

  const oldCode = generateTotpCode(totpSecret, now - 2 * 60 * 1000);
  assert.equal(verifyTotpCode(totpSecret, oldCode), false, 'Stale TOTP code outside window must fail');

  console.log('Auth security tests passed.');
}

run();
