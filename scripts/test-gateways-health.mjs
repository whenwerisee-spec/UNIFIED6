import { checkAllNonStripeGateways } from '../server/non-stripe-gateways-health.ts';

async function run() {
  console.log('[TEST] Checking health and connectivity for all non-Stripe production gateways...');
  const health = await checkAllNonStripeGateways();
  console.log(` - Total gateways audited: ${health.length}`);
  for (const h of health) {
    console.log(`   * [${h.category}] ${h.gateway} (${h.endpoint}): ${h.status}`);
  }
  console.log('[SUCCESS] Non-Stripe gateways health audit passed successfully.');
}

run().catch((err) => {
  console.error('[FAILED] Gateway health test error:', err);
  process.exit(1);
});
