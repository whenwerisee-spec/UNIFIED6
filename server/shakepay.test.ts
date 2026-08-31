import { describe, it, expect } from 'vitest';
import { fetchShakepayStatus, verifyShakepayIntegrationReady } from './shakepay-integration.js';

describe('Shakepay Integration & Status API', () => {
  it('verifies static integration capabilities', () => {
    const info = verifyShakepayIntegrationReady();
    expect(info.status).toBe('operational');
    expect(info.supportedRails.length).toBeGreaterThan(0);
    expect(info.supportedRails).toContain('Bitcoin & Lightning Network');
  });

  it('fetches live Shakepay status from status.shakepay.com API', async () => {
    const summary = await fetchShakepayStatus();
    expect(summary).toBeDefined();
    expect(summary.status).toBeDefined();
    expect(Array.isArray(summary.components)).toBe(true);
    expect(summary.lastChecked).toBeTypeOf('number');
  });
});
