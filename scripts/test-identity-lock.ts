import assert from 'assert';
import { db } from '../src/db/ledger.js';

const email = `identity-lock-${Date.now()}@example.com`;
const userId = `user_${Date.now()}`;

db.execute(
  'INSERT INTO users (id, name, email, passwordHash, salt, twoFactorSecret, twoFactorEnabled, kycLevel, citizenship) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  [userId, 'Identity Lock Test', email, 'hash', 'salt', '', false, 3, 'US']
);

const createdUser = (db as any).state.users.find((u: any) => u.id === userId);
assert(createdUser, 'Expected the newly created user to exist.');
assert.strictEqual(createdUser.identityLocked, true, 'New accounts should be identity-locked by default.');
assert.strictEqual(createdUser.productionMode, 'live', 'New accounts should default to live production mode.');
assert.strictEqual(createdUser.blockchainLinked, true, 'New accounts should be marked as blockchain-linked by default.');

console.log('identity-lock-test:ok');
