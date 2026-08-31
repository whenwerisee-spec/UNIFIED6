# Server-Side Truthfulness & Hardening TODO

- [x] Remove client-side seeded balances, treasury addresses, and simulated staking/RWA execution fallbacks
- [ ] Remove server-side hardcoded fallback holdings maps and static balance expectations in server.ts
- [ ] Replace hardcoded treasury default address with dynamic verification
- [ ] Run unified TypeScript validation and yield routing tests
- [ ] Commit and push verified server-side hardening changes to mlaframboisemm-dotcom/unified

- [ ] Remove hardcoded Wise profile, test-card, account-number, and holder defaults from live card routes
- [ ] Replace synthetic Wise KYC/SCA/card responses with provider-confirmed results only
- [ ] Verify Stripe and Wise live card creation paths using Render runtime credentials without logging secrets
- [ ] Run provider-boundary and security regression tests before any live card request
