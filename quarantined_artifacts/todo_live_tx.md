# Live Transaction UAT & Execution Matrix

- [x] Phase 1: Enumerate the exact supported token and network matrix, configured source and destination addresses, signers, token decimals, and gas reserves
- [ ] Phase 2: Run live read-only checks for balances, ownership, chain IDs, token metadata, gas estimates, provider health, and destination validity
- [ ] Phase 3: Prepare the $1-equivalent transaction matrix and stop any route that lacks a verified destination, signer, gas reserve, or supported live provider
- [ ] Phase 4: Broadcast only the exact confirmed live test transactions, then verify explorer receipts, balances, ledger reconciliation, alerts, and recovery
- [ ] Phase 5: Deliver a transaction-by-transaction evidence report with hashes, receipts, fees, reconciliation results, blocked routes, and no GitHub push
