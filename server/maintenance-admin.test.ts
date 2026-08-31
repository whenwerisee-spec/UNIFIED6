import { describe, it, expect } from 'vitest';
import {
  getMaintenanceStatus,
  setMaintenanceMode,
  submitAdminChangeRequest,
  approveAndExecuteChangeRequest,
  getAuditLogs
} from './maintenance-admin.js';

describe('Safe Maintenance Mode & Approval Admin API', () => {
  it('toggles maintenance mode safely with audit trail', () => {
    const statusBefore = getMaintenanceStatus();
    expect(statusBefore.enabled).toBe(false);

    const statusAfter = setMaintenanceMode(true, 'Performing scheduled database & Stripe sync hardening', 'admin_user');
    expect(statusAfter.enabled).toBe(true);
    expect(statusAfter.reason).toContain('Stripe sync hardening');

    // Revert
    setMaintenanceMode(false, 'Resuming normal traffic', 'admin_user');
  });

  it('enforces provider allowlists and approval workflow for config changes', () => {
    // Submit valid request for Stripe
    const req = submitAdminChangeRequest('stripe', 'update_webhook_endpoint', { url: 'https://api.example.com/webhook' });
    expect(req.requestId).toBeDefined();
    expect(req.status).toBe('pending_approval');
    expect(req.dryRunResult.status).toBe('dry_run_passed');

    // Execute with user confirmation
    const executed = approveAndExecuteChangeRequest(req.requestId, true);
    expect(executed.status).toBe('executed');

    // Attempt invalid provider
    expect(() => {
      submitAdminChangeRequest('unsupported_exchange', 'hack_system', {});
    }).toThrowError(/not allowed/);
  });
});
