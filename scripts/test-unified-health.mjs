import { runUnifiedGatewayHealthAudit } from '../server/unified-gateway-health-check.ts';

async function run() {
  await runUnifiedGatewayHealthAudit();
}

run().catch((err) => {
  console.error('[FAILED] Unified health audit error:', err);
  process.exit(1);
});
