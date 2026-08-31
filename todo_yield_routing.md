# Yield Routing TODO

- [x] Inventory each existing yield source, claim contract or provider API, supported network, owner account, and currently configured reward destination. Audit result: the yield UI is browser-local and simulated; no provider claim contract, custody account, or live reward destination is currently connected.
- [ ] Remove every simulated yield balance, fabricated history or transaction hash, random destination address, local-only success state, and unsupported auto-yield claim from the production interface.
- [ ] Identify the configured provider or custody API that can issue or attest each new permanent destination address without exposing secrets, then bind each real address to its matching live yield source and network.
- [ ] Route collected rewards only through verified live claim or withdrawal paths, persist real provider and chain references, and retain the resulting address and reward history in the authenticated user account.
- [ ] Remove simulated reward accrual, synthetic transaction hashes, random address generation, and browser-local-only collection flows from live yield actions.
- [ ] Define a tenant-isolated yield routing record with source identity, network, asset, permanent destination address, verified ownership proof, recovery reference, collection mode, emergency pause state, and audit trail.
- [ ] Implement secure permanent destination address registration only through a verified user-controlled wallet or approved custody provider; do not generate or persist plaintext seed phrases or private keys in the client or repository.
- [ ] Implement provider-specific claim preparation and a user-confirmed Collect Yield action that displays source, asset, amount, destination, network, gas, and irreversible consequences before signing or broadcasting.
- [ ] Implement optional collection automation only where the provider supports it, with a user-configured allowlist, amount or gas caps, idempotency, pause control, and alerting.
- [ ] Add database migration, backend authorization, tenant-isolation tests, integration tests, secret scans, and live read-only provider checks.
- [ ] Commit and push only verified code and truthful operational documentation after user approval of the exact change set.
