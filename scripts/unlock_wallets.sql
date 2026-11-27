-- SAFETY HOLD: this historical script is intentionally read-only.
-- The prior UPDATE removed identity-lock metadata for a hard-coded email that
-- does not match the supplied ledger snapshots. Do not use it to make balances
-- appear spendable. Unlocking identity/KYC controls requires verified owner
-- authorization and a separate compliance review.
SELECT id, user_id, asset_symbol, balance, identityLocked, lockedToEmail, lockedAt
FROM wallets
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'whenwerisee@gmail.com'
);
