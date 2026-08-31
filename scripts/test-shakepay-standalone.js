import { fetchShakepayStatus, verifyShakepayIntegrationReady } from '../server/shakepay-integration.js';

async function runTest() {
  console.log('[TEST] Verifying Shakepay static capabilities...');
  const caps = verifyShakepayIntegrationReady();
  console.log(' - Status:', caps.status);
  console.log(' - Rails:', caps.supportedRails.join(', '));

  console.log('[TEST] Fetching live Shakepay status API from https://status.shakepay.com/api/v2/summary.json...');
  const summary = await fetchShakepayStatus();
  console.log(' - Indicator:', summary.status.indicator);
  console.log(' - Description:', summary.status.description);
  console.log(' - Components tracked:', summary.components.length);
  for (const c of summary.components.slice(0, 5)) {
    console.log(`   * ${c.name}: ${c.status}`);
  }
  console.log('[SUCCESS] Shakepay live status integration verified successfully.');
}

runTest().catch((err) => {
  console.error('[FAILED] Shakepay test error:', err);
  process.exit(1);
});
