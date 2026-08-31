import { getKilnBridge } from '../server/kiln-bridge';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const requestedMode = args.find((arg) => arg.startsWith('--mode='))?.split('=')[1];

  if (requestedMode) {
    process.env.SOVEREIGN_KILN_MODE = requestedMode;
  }

  const mode = (process.env.SOVEREIGN_KILN_MODE || 'shim').toLowerCase();
  console.log(`[KILN] Checking bridge mode: ${mode}`);

  try {
    const bridge = getKilnBridge();
    const kid = bridge.getKid ? bridge.getKid() : undefined;
    const payload = 'bridge-check:' + Date.now();
    const signature = await bridge.signPayload(payload);

    console.log(`[KILN] Bridge ready: signature length=${signature.length}`);
    if (kid) {
      console.log(`[KILN] Kid=${kid}`);
    }
    if (verbose) {
      console.log(`[KILN] Payload=${payload}`);
      console.log(`[KILN] Signature=${signature}`);
    }
  } catch (error: any) {
    console.error(`[KILN] Bridge check failed: ${error?.message || String(error)}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
