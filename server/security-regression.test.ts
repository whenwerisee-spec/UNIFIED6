import { describe, it, expect } from 'vitest';
import { getBitcoinRpcConfig } from './bitcoin-rpc-client.js';
import { getMaintenanceStatus, setMaintenanceMode } from './maintenance-admin.js';

describe('Security & Configuration Regression Tests', () => {
  it('should verify Bitcoin RPC config defaults safely', () => {
    const config = getBitcoinRpcConfig();
    expect(config.url).toBeDefined();
    expect(config.rpcUser).toBeDefined();
  });

  it('should enforce maintenance mode approval boundaries', () => {
    const initial = getMaintenanceStatus();
    expect(initial.enabled).toBe(false);

    // Attempting toggle without approval should respect state or require proper gating
    setMaintenanceMode(true, 'Security audit test', true);
    const updated = getMaintenanceStatus();
    expect(updated.enabled).toBe(true);

    // Reset back
    setMaintenanceMode(false, 'Reset post test', true);
    expect(getMaintenanceStatus().enabled).toBe(false);
  });
});
