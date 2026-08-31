import assert from 'node:assert/strict';
import { validateBankWithdrawalRequest } from '../src/lib/withdrawal-hardening.js';
import { createPkcePair, buildAuthorizationUrl } from '../src/lib/withdrawal-redirect.js';

const registry = {
  rbc: { issuer: 'https://fapi.rbc.com' },
  td: { issuer: 'https://fapi.td.com' },
  scotiabank: { issuer: 'https://fapi.scotiabank.com' }
};

const valid = validateBankWithdrawalRequest({ amount: 125.5, bankId: 'rbc', operationType: 'WITHDRAWAL' }, registry);
assert.equal(valid.valid, true, 'valid withdrawal request should pass');

const invalidAmount = validateBankWithdrawalRequest({ amount: 0, bankId: 'rbc', operationType: 'WITHDRAWAL' }, registry);
assert.equal(invalidAmount.valid, false, 'zero amount should be rejected');
assert.equal(invalidAmount.error, 'INVALID_AMOUNT');

const invalidBank = validateBankWithdrawalRequest({ amount: 50, bankId: 'fake-bank', operationType: 'WITHDRAWAL' }, registry);
assert.equal(invalidBank.valid, false, 'unknown bank should be rejected');
assert.equal(invalidBank.error, 'UNKNOWN_BANK');

const invalidOperation = validateBankWithdrawalRequest({ amount: 50, bankId: 'td', operationType: 'TRANSFER' }, registry);
assert.equal(invalidOperation.valid, false, 'unsupported operation should be rejected');
assert.equal(invalidOperation.error, 'INVALID_OPERATION');

console.log('withdrawal hardening checks passed');

// PKCE checks
const pkce = createPkcePair();
assert.ok(pkce.verifier && pkce.challenge, 'PKCE pair should include verifier and challenge');
assert.equal(typeof pkce.verifier, 'string');
assert.equal(typeof pkce.challenge, 'string');

// Build a mock auth URL
const mockBank = { authUrl: 'https://auth.example.com/authorize' };
const authUrl = buildAuthorizationUrl(mockBank, { response_type: 'code', client_id: 'x', state: 's' });
assert.ok(authUrl.startsWith('https://auth.example.com/authorize'), 'authorization URL should be built');

console.log('PKCE and redirect URL checks passed');
