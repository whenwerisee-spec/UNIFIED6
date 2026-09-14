import { Router } from 'express';
import { globalLedger } from '../../ledger/accounting';

export const ledgerRouter = Router();

// GET /api/v1/ledger/journal - Immutable double-entry general ledger
ledgerRouter.get('/journal', (req, res) => {
  const journal = globalLedger.getJournal();
  res.json({
    success: true,
    data: journal
  });
});

// GET /api/v1/ledger/balance-sheet - Chart of accounts & balances
ledgerRouter.get('/balance-sheet', (req, res) => {
  const balances = globalLedger.getBalances();
  const integrity = globalLedger.verifyIntegrity();
  res.json({
    success: true,
    data: {
      balances,
      integrity
    }
  });
});

// POST /api/v1/ledger/verify - Verify ledger integrity
ledgerRouter.post('/verify', (req, res) => {
  const result = globalLedger.verifyIntegrity();
  res.json({
    success: true,
    data: result
  });
});
