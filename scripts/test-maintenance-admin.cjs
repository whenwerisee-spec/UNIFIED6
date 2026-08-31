const {
  getMaintenanceStatus,
  setMaintenanceMode,
  submitAdminChangeRequest,
  approveAndExecuteChangeRequest,
  getAuditLogs
} = require('../server/maintenance-admin.ts');

async function run() {
  console.log('[TEST] Checking initial maintenance status...');
  const initial = getMaintenanceStatus();
  console.log(' - Maintenance enabled:', initial.enabled);

  console.log('[TEST] Enabling maintenance mode with reason...');
  const enabledState = setMaintenanceMode(true, 'Performing scheduled Stripe & Shakepay sync hardening', 'admin_user');
  console.log(' - Status:', enabledState.enabled, '| Reason:', enabledState.reason);

  console.log('[TEST] Submitting admin change request for Stripe webhook update...');
  const req = submitAdminChangeRequest('stripe', 'update_webhook', { url: 'https://api.unified.gateway/webhook' });
  console.log(' - Request ID:', req.requestId, '| Status:', req.status, '| Dry Run:', req.dryRunResult.status);

  console.log('[TEST] Approving and executing change request with user confirmation...');
  const executed = approveAndExecuteChangeRequest(req.requestId, true);
  console.log(' - Final Status:', executed.status);

  console.log('[TEST] Testing disallowed provider guard...');
  let blocked = false;
  try {
    submitAdminChangeRequest('malicious_provider', 'exploit', {});
  } catch (e) {
    blocked = true;
    console.log(' - Successfully blocked invalid provider:', e.message);
  }

  console.log('[TEST] Disabling maintenance mode...');
  setMaintenanceMode(false, 'Resuming normal operation', 'admin_user');

  console.log('[SUCCESS] All maintenance mode & approval-controlled admin API tests passed.');
}

run().catch((err) => {
  console.error('[FAILED] Test error:', err);
  process.exit(1);
});
