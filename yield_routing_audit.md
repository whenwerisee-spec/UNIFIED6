# Yield Routing Audit Notes

## Production-access check

On 2026-08-18, the available browser session remained on the Render sign-in page after the user reported signing in. No production dashboard, environment variable value, service configuration, or credential was accessed or exposed from this session. Local workspace checks show the relevant integration variable names in source code but none declared in the sandbox workspace.

## Current yield-flow facts

The existing yield and destination-address user interface is not connected to a provider claim or custody API. It uses browser-local state, hardcoded yield positions, time-based reward accrual, random address construction, and fabricated transaction-history behavior. The production replacement must rely on authenticated provider or custody paths and must report a route as unavailable until the required capability is verified.

The ledger bootstrap layer also contains hardcoded wallet balances and non-verified address strings. These are not suitable as live custody records and cannot be used as yield destinations. They must be removed from the production bootstrap path or replaced with reconciled provider and chain data before the app can claim a live-only ledger.

## Provider capability evidence

Kiln's documented Rewards API exposes historical Ethereum staking reward data through `GET https://api.kiln.fi/v1/eth/rewards` using bearer authentication and permits filtering by account identifier, validator, wallet, proxy, withdrawal credential, or validator index. This is appropriate for read-only reconciliation once the configured account identifiers are verified. Ethereum validator withdrawal and skimming rewards are paid by the consensus protocol to the validator's preconfigured execution-layer withdrawal credential; this application must therefore verify the existing withdrawal credential and provider-supported amendment process before claiming that it can reroute native validator rewards to a newly created address. No assumption may be made that an external payout address can be changed post-deposit.

References: https://docs.api.kiln.fi/reference/getethrewards and https://www.kiln.fi/post/how-ethereum-staking-withdrawals-will-work

## Local verification result

The unified application started locally on 2026-08-18 and TypeScript validation passed. The available browser session did not retain the local page after navigation, so visual browser verification could not be completed in this session. No production or local live claim operation was performed.
