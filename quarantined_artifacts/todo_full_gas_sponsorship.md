# Full Application Gas Sponsorship & Institutional Features TODO

- [x] Phase 1: Inventory the full application and map every transaction-producing module, supported asset/network, wallet signer, gas path, provider, and deployment secret contract
- [x] Phase 2: Design the sponsorship policy by network and feature, distinguishing EVM paymasters, Solana fee payers, Bitcoin fee relays, card/payment fees, and unsupported cases
- [x] Phase 3: Implement a secure sponsorship abstraction with funded-provider checks, per-user and per-transaction limits, allowlists, replay protection, treasury safeguards, fallback behavior, alerts, and audit records
- [x] Phase 4: Run local and live read-only verification for every route, including provider health, sponsor funding, network support, fee estimates, signing policy, and failure handling
- [x] Phase 5: Execute a controlled sponsored transaction on each eligible network only after exact parameters are shown, then verify fee payer, explorer receipt, ledger reconciliation, alerts, and recovery
- [x] Phase 6: Deliver a full application gas-sponsorship report with feature-by-feature pass, fail, blocked, and unverified status, exact secret requirements, and an unpushed diff for approval
