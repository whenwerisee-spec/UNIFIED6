import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { LedgerMutex } from './ledger-mutex.js';

// token-store abstraction. If VAULT_URL set, this will POST tokens to VAULT_URL
// Otherwise it will store encrypted JSON locally under backups/token_store.json

const VAULT_URL = process.env.TOKEN_VAULT_URL || '';

export async function storeTokens(transferId, tokenPayload) {
  if (VAULT_URL) {
    try {
      const res = await fetch(VAULT_URL + '/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transferId, tokens: tokenPayload })
      });
      if (!res.ok) {
        throw new Error('Vault store failed: ' + (await res.text()));
      }
      return true;
    } catch (e) {
      console.error('Vault token store failed, falling back to file store:', e.message || e);
    }
  }

  const tokenStorePath = path.join(process.cwd(), 'backups', 'token_store.json');
  let existing = {};
  try {
    if (fs.existsSync(tokenStorePath)) {
      try { existing = LedgerMutex.decryptLedgerData(fs.readFileSync(tokenStorePath, 'utf8')); } catch (_) { existing = {}; }
    }
  } catch (e) {
    existing = {};
  }
  existing[transferId] = { storedAt: new Date().toISOString(), ...tokenPayload };
  const encrypted = LedgerMutex.encryptLedgerData(existing);
  fs.mkdirSync(path.dirname(tokenStorePath), { recursive: true });
  fs.writeFileSync(tokenStorePath + '.tmp', encrypted, 'utf8');
  fs.renameSync(tokenStorePath + '.tmp', tokenStorePath);
  return true;
}

export default { storeTokens };
