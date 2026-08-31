import { db } from '../db/ledger.js';
import { DEFAULT_USD_CAD_RATE } from './financial-hardening.js';
import { isUsableStripeKey } from './api-key-sanitizer.js';
import crypto from 'crypto';

export let GLOBAL_STRIPE_BALANCE = {
  available: 0,
  pending: 0,
  lastUpdated: new Date().toISOString()
};

export async function syncAllStripeBalances() {
  const stripeKeyRaw = process.env.STRIPE_SECRET_KEY;
  if (!isUsableStripeKey(stripeKeyRaw)) return;
  const stripeKey = stripeKeyRaw!.trim();

  try {
    let totalAvailable = 0;
    let totalPending = 0;

    // 1. Fetch primary platform account balance with strict timeout
    try {
      const primaryRes = await fetch('https://api.stripe.com/v1/balance', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(3500)
      });

      if (primaryRes.ok) {
        const primaryJson = await primaryRes.json() as any;
        for (const item of primaryJson.available || []) {
          const amt = item.amount || 0;
          const curr = (item.currency || 'usd').toLowerCase();
          totalAvailable += curr === 'cad' ? (amt / DEFAULT_USD_CAD_RATE) : amt;
        }
        for (const item of primaryJson.pending || []) {
          const amt = item.amount || 0;
          const curr = (item.currency || 'usd').toLowerCase();
          totalPending += curr === 'cad' ? (amt / DEFAULT_USD_CAD_RATE) : amt;
        }
      }
    } catch (primaryErr) {
      // Offline/timeout fallback: continue without blocking
    }

    // 2. Fetch connected accounts with strict timeout
    try {
      const accountsRes = await fetch('https://api.stripe.com/v1/accounts?limit=100', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(3500)
      });

      if (accountsRes.ok) {
        const accountsJson = await accountsRes.json() as any;
        const connectedAccounts = accountsJson.data || [];

        for (const account of connectedAccounts) {
          if (!account.id) continue;
          try {
            const balanceRes = await fetch('https://api.stripe.com/v1/balance', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${stripeKey}`,
                'Stripe-Account': account.id,
                'Accept': 'application/json'
              },
              signal: AbortSignal.timeout(3000)
            });

            if (balanceRes.ok) {
              const balanceJson = await balanceRes.json() as any;
              for (const item of balanceJson.available || []) {
                const amt = item.amount || 0;
                const curr = (item.currency || 'usd').toLowerCase();
                totalAvailable += curr === 'cad' ? (amt / DEFAULT_USD_CAD_RATE) : amt;
              }
              for (const item of balanceJson.pending || []) {
                const amt = item.amount || 0;
                const curr = (item.currency || 'usd').toLowerCase();
                totalPending += curr === 'cad' ? (amt / DEFAULT_USD_CAD_RATE) : amt;
              }
            }
          } catch (accountErr) {
            // Non-fatal per-account timeout
          }
        }
      }
    } catch (accountsErr) {
      // Non-fatal accounts query error
    }

    if (totalAvailable > 0 || totalPending > 0) {
      GLOBAL_STRIPE_BALANCE.available = totalAvailable / 100;
      GLOBAL_STRIPE_BALANCE.pending = totalPending / 100;
    }
    GLOBAL_STRIPE_BALANCE.lastUpdated = new Date().toISOString();
  } catch (error) {
    // Non-blocking sync error
  }
}

export async function runAsymmetricForensicAudit() {
  const stripeKeyRaw = process.env.STRIPE_SECRET_KEY;
  if (!isUsableStripeKey(stripeKeyRaw)) return;
  const stripeKey = stripeKeyRaw!.trim();

  try {
    const txRes = await fetch('https://api.stripe.com/v1/balance_transactions?limit=100', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(3500)
    });

    if (!txRes.ok) {
      return;
    }

    const txJson = await txRes.json() as any;
    const stripeTransactions = txJson.data || [];
    const ledgerTransactions = db.execute('SELECT * FROM transactions') as any[];

    let driftCount = 0;
    const discrepancies: string[] = [];

    for (const st of stripeTransactions) {
      const sourceId = st.source;
      const refTx = ledgerTransactions.find(t => 
        (t.details && t.details.includes(sourceId)) || 
        (t.referenceNotes && t.referenceNotes.includes(sourceId)) ||
        (t.id && t.id.includes(sourceId))
      );

      if (!refTx) {
        driftCount++;
        discrepancies.push(`Missing Ledger Entry: Stripe transaction ${st.id} (Source: ${sourceId}, Amount: $${(st.amount / 100).toFixed(2)} ${st.currency.toUpperCase()}) was not found in database ledger.`);
      } else {
        const stripeAmount = Math.abs(st.amount / 100);
        const ledgerAmount = Math.abs(refTx.fiatAmount || refTx.amount);
        if (Math.abs(stripeAmount - ledgerAmount) > 0.01) {
          driftCount++;
          discrepancies.push(`Amount Mismatch: Stripe transaction ${st.id} amount ($${stripeAmount.toFixed(2)}) does not match internal ledger record ($${ledgerAmount.toFixed(2)}) for transaction ID ${refTx.id}.`);
        }
      }
    }

    if (driftCount > 0) {
      console.warn(`[RECONCILIATION ENGINE] Audit complete. Detected ${driftCount} reconciliation discrepancies!`);
      db.execute(
        'INSERT INTO audit_logs (id, user_id, action, timestamp, ip_address, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          `audit_${crypto.randomUUID()}`,
          'system',
          'RECONCILIATION_AUDIT_FAILURE',
          Date.now(),
          '127.0.0.1',
          'failure',
          `Reconciliation audit failed. Detected discrepancies:\n${discrepancies.join('\n')}`
        ]
      );
    } else {
      console.log('[RECONCILIATION ENGINE] Audit complete. Ledger matches Stripe records perfectly with zero drift.');
      db.execute(
        'INSERT INTO audit_logs (id, user_id, action, timestamp, ip_address, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          `audit_${crypto.randomUUID()}`,
          'system',
          'RECONCILIATION_AUDIT_SUCCESS',
          Date.now(),
          '127.0.0.1',
          'success',
          'Reconciliation audit succeeded. All queried Stripe transactions match internal database records perfectly.'
        ]
      );
    }
  } catch (error: any) {
    console.error('[RECONCILIATION ENGINE] Reconciliation audit failed with error:', error);
  }
}
