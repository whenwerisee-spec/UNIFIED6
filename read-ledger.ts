import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const credentialsPath = path.join(process.cwd(), 'config', '.env.credentials');
if (fs.existsSync(credentialsPath)) {
  dotenv.config({ path: credentialsPath, override: true });
}

import { db } from './src/db/ledger.js';

// Get all users
const users = db.execute('SELECT * FROM users WHERE email = ?', ['mlaframboisemm@gmail.com']);
console.log('\n=== USER ===');
users.forEach((u: any) => {
  console.log(`ID: ${u.id}`);
  console.log(`Email: ${u.email}`);
  console.log(`KYC: ${u.kycLevel}`);
  console.log(`Mode: ${u.productionMode}`);
});

// Get all wallets
const wallets = db.execute('SELECT * FROM wallets', []);
console.log('\n=== WALLETS ===');
wallets.forEach((w: any) => {
  console.log(`Asset: ${w.assetSymbol} | Balance: ${w.balance} | UserID: ${w.userId}`);
});

// Get transactions for this user
if (users.length > 0) {
  const userId = users[0].id;
  const txns = db.execute('SELECT * FROM transactions WHERE user_id = ?', [userId]);
  console.log(`\n=== TRANSACTIONS (${txns.length} total) ===`);
  txns.slice(0, 20).forEach((t: any) => {
    console.log(`${t.type} | $${t.amount} ${t.currency} | ${t.status} | ${t.createdAt}`);
  });
}
