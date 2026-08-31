import { describe, it, expect } from 'vitest';
import { checkAllNonStripeGateways } from './non-stripe-gateways-health.js';

describe('Non-Stripe Gateways Health & Integration Audit', () => {
  it('returns health status for all non-Stripe production integrations', async () => {
    const health = await checkAllNonStripeGateways();
    expect(health.length).toBeGreaterThanOrEqual(12);
    
    const shakepayHealth = health.find(h => h.gateway === 'shakepay');
    expect(shakepayHealth).toBeDefined();
    expect(shakepayHealth?.status).toBe('operational');

    const plaidHealth = health.find(h => h.gateway === 'plaid');
    expect(plaidHealth).toBeDefined();
    expect(plaidHealth?.status).toBe('connected');
  });
});
