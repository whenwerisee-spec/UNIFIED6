# Transak Integration Findings

## Official onboarding

Transak’s official partner documentation states that a Partner Dashboard account is the starting point. A staging API key is available after account creation, while a production API key requires KYB approval. The documented signup entry point is https://dashboard.transak.com/ and the documented KYB route is https://forms.transak.com/kyb.

## Whitelabel API requirements

Transak’s Whitelabel API documentation states that partners must request Whitelabel API enablement, share public backend IP addresses for allowlisting, and call the API only from a backend. Frontend-direct API calls are not supported. Production use also requires Transak terms to be incorporated into the user journey.

## Product capability

The documentation describes lookup APIs, KYC flows, on-ramp order creation and status tracking, webhooks, and WebSockets. The current Whitelabel API page states that off-ramp operations are not supported via API in the documented limitations, so off-ramp must not be represented as available until Transak confirms otherwise for the partner account.

## Official sources

- Partner onboarding: https://docs.transak.com/guides/how-to-create-partner-dashboard-account
- Whitelabel API: https://docs.transak.com/integration/api
- Partner dashboard: https://dashboard.transak.com/
- KYB application: https://forms.transak.com/kyb
- Webhooks: https://docs.transak.com/features/webhooks
