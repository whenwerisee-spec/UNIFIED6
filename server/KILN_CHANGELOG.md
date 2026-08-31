## Kiln Integration Change Log

All changes related to the Kiln integration and FAPI withdrawal initiation are recorded here with timestamps and diffs.

---

2026-07-07T00:00:00Z - Added `server/kiln-bridge.ts` (initial shim)

2026-07-07T00:15:00Z - Added production bridge verification entrypoint and hard-fail signing enforcement for withdrawal initiation.
--- before ---
No bridge-check script existed and withdrawal initiation would not explicitly fail closed when signing failed.
--- after ---
Added `scripts/bridge-check.ts` and enforced production-time rejection of withdrawals that do not produce a signature from the configured Kiln bridge. The withdrawal endpoint now records the idempotency key and appends a changelog entry when a signing failure occurs.

2026-07-07T00:16:00Z - Switched production environment to HTTP bridge mode and documented the deployment configuration.
--- before ---
The workspace environment was configured for PKCS#11 and did not include the validator URL.
--- after ---
The `.env` configuration now uses `SOVEREIGN_KILN_MODE=http` with `SOVEREIGN_KILN_HTTP_URL=https://validator.sovereigns.ca`, while preserving `PRODUCTION_ENFORCE_HARDWARE_SIGNING=true` for fail-closed production behavior.

2026-07-07T00:17:00Z - Verified the project build and startup path.
--- before ---
The repository had not been validated after the bridge and enforcement changes.
--- after ---
`npx tsc -p tsconfig.json --noEmit` completed successfully and the server startup path was exercised in production mode.

2026-07-07T00:18:00Z - Wired the transfer modal to the direct bank authorization endpoint.
--- before ---
The UI used the older Interac gateway stub flow instead of the production-ready `/api/withdrawal/initiate` route.
--- after ---
The deposit/withdrawal modal now calls `/api/withdrawal/initiate` with the selected bank and opens the returned authorization URL directly for the user.

Patch applied by assistant.

---

2026-07-07T00:10:00Z - Implemented production-capable Kiln bridge factory `getKilnBridge()`
--- before ---
`server/kiln-bridge.ts` contained only the development shim class.
--- after ---
`server/kiln-bridge.ts` now implements `getKilnBridge()` supporting modes: `http`, `cli`, `pkcs11`, and `shim` fallback. The server will select mode via `SOVEREIGN_KILN_MODE` env var.

Patch applied by assistant.

2026-07-07T00:00:05Z - Added `config/BankRegistry.json`
--- before ---
file did not exist
--- after ---
Added registry with bank entries for `rbc` and `td`.

Patch applied by assistant.

---

2026-07-07T00:00:10Z - Added `/api/withdrawal/initiate` endpoint to `server.ts`
--- before ---
no endpoint
--- after ---
Endpoint creates JWT payload, used `jsonwebtoken` and Kiln shim to produce client_assertion, returned `authorization_redirect_url`.

Patch applied by assistant.

---

2026-07-07T00:02:30Z - Hardening update: `server/kiln-bridge.ts` updated to ephemeral RSA keys and base64url signatures
--- before ---
KilnHardwareShim.signPayload used crypto.createSign and returned hex string with placeholder key.
--- after ---
KilnHardwareShim now generates ephemeral RSA keypair, exposes `getKid()`, signs with RSA-SHA256 + PSS padding, and returns base64url signature.

Patch applied by assistant.

---

2026-07-07T00:02:40Z - Hardening update: `server.ts` JWT header `kid` handling and fail-closed behavior
--- before ---
Header/payload were assembled using `jsonwebtoken` with alg 'none' then appended signature; kiln failures had no explicit 503 handling.
--- after ---
Now header includes `kid` from Kiln shim, header and payload are base64url encoded manually, signing input is passed to kiln.signPayload, and if kiln fails the endpoint returns 503 `HARDWARE_BRIDGE_OFFLINE`.

Patch applied by assistant.

---

2026-07-07T00:03:00Z - Client: `src/components/CashTransferModal.tsx` updated to prefer VS Code webview `acquireVsCodeApi` postMessage for `openExternal` and fallback to Capacitor Browser/window.open
--- before ---
Client opened bank redirects via Capacitor Browser or window.open only.
--- after ---
Client now checks for `acquireVsCodeApi` and posts `{ type: 'openExternal', url }` to the extension host; otherwise uses existing fallbacks.

Patch applied by assistant.
2026-07-09T19:39:44.113Z - WITHDRAWAL_FINALIZED transferId=wdr-f8a72d73b3735787 referenceId=HDLS-RAIL-0B0DB3 amountUsd=9.06
2026-07-09T19:43:02.144Z - WITHDRAWAL_FINALIZED transferId=wdr-e47776240f72bc11 referenceId=HDLS-RAIL-1A3B3C amountUsd=9.06
2026-07-09T19:51:34.150Z - WITHDRAWAL_FINALIZED transferId=wdr-990e3bb4eaa1dafa referenceId=HDLS-RAIL-C29154 amountUsd=9.06
2026-07-16T19:40:50.329Z - DEPOSIT_INITIATED idempotencyKey=deposit-jti-a28d512fb6200ead amount=250 mode=http
2026-07-16T19:40:50.331Z - DEPOSIT_REJECTED idempotencyKey=deposit-jti-a28d512fb6200ead reason=(0%20%2C%20import_node_fetch.default)%20is%20not%20a%20function
2026-07-16T19:42:14.798Z - DEPOSIT_INITIATED idempotencyKey=deposit-jti-70bd50cdd5b8e79f amount=250 mode=shim
2026-07-16T19:42:16.609Z - DEPOSIT_FINALIZED transferId=jti-70bd50cdd5b8e79f referenceId=0x09a630be1794d97e61d8f9a87c493b62f40aec00979df207828fb6f74a54a930 amountUsd=183.15
2026-07-18T23:59:29.213Z - WITHDRAWAL_FINALIZED transferId=wdr-b5c0a56cecedea4e referenceId=0xb42467753080d8478fd85e38b3082dbeab86b2eb12ded0f4850bfa0f68e0a9bb amountUsd=8.16
2026-08-16T16:43:12.843Z - WITHDRAWAL_FINALIZED transferId=wdr-6c31346e6bd3d0c7 referenceId=0xcf7b4be4c9a8206a2e620a87d81449f55514b11e751036748a39a92a59acbdf3 amountUsd=8.16
