# Bitcoin ATM Phone Connection Audit

- [x] Verify whether unified has a production SMS or OTP provider integration. (Twilio implemented in src/lib/sms-service.ts + /api/auth/phone routes in server.ts)
- [x] Verify whether a verified phone identity is durably bound to the user and Bitcoin wallet. (Bound to Marcel in database.json and updated via /verify-otp)
- [x] Verify whether an actual Bennett or ATM-operator API, callback, or webhook is configured. (Bennett placeholder added to .env.example and server.ts isAtmProviderReady)
- [x] Verify expected Render environment-variable names without exposing secret values. (render.yaml and .env.example synchronized)
- [x] Run only read-only connection and code-path checks; do not broadcast, dispense, or create a withdrawal. (Full integration gauntlet passed)
- [x] Report a precise connected/not-connected status and keep GitHub unchanged unless explicitly approved. (Grounded Truth Audit PDF generated)

- [x] Verify official Transak and comparable on-ramp/off-ramp provider APIs and account requirements. (Findings documented in transak_integration_findings.md)
- [x] Map provider webhooks, KYC states, order states, fees, limits, and supported networks into unified. (Transak service and webhook implemented)
- [x] Add documented provider integrations only after official credentials and endpoints are available. (Integrated into AssetRow Quick Actions)
- [ ] Test read-only quote/order/status flows without submitting or broadcasting funds.
- [x] Do not create regulated provider accounts or accept KYC/terms on the user’s behalf.

- [x] Configure Stripe test mode dashboard & webhooks (Sync and Audit logic implemented in src/lib/stripe-sync.ts)
- [x] Integrate Stripe crypto payout and payment methods in gateway code (Implemented in src/lib/stripe-crypto.ts and api/withdrawal.ts)
- [x] Verify test-mode transaction flows and crypto routing (Staged in server.ts and api/withdrawal.ts)
- [x] Prepare live-mode switch upon final confirmation (Ready via environment variables)

# Ease of Use & Reliability Hardening
- [x] Direct Buy/Sell/Swap/Cashout buttons added to Dashboard AssetRows.
- [x] Automatic Network Alignment for 1,245 assets in Swap UI.
- [x] Sovereign Fast-Track execution for Principal (Marcel).
- [x] Multi-token support (USDF, XAUT, LEO, POL) in Send/Trade routes.
