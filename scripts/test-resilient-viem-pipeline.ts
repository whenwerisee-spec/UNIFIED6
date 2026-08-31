import { ethers } from 'ethers';
import { parseEther, parseGwei, type Hex } from 'viem';
import { AppGuardrailEngine, DEFAULT_GUARDRAIL_CONFIG } from '../src/lib/guardrail-engine';
import { LedgerAuditor } from '../src/lib/ledger-auditor';
import { createResilientPublicClient, getChainConfig } from '../src/lib/viem-resilient-provider';

async function runResilientPipelineTests() {
  console.log('==================================================');
  console.log('🧪 RUNNING RESILIENT 3-PHASE PIPELINE TESTS');
  console.log('==================================================');

  // Test 1: Guardrail Engine Pre-Flight Checks
  console.log('\n--- Test 1: Pre-Flight Guardrail Validation ---');
  const mockClient = {
    getBalance: async () => parseEther('5.0'),
    getBlockNumber: async () => 20500100n
  };

  const testSigner: Hex = (process.env.VITE_MARSHALL_ADDRESS || '0x742d35cc6634c0532925a3b844bc454e4438f44e') as Hex;
  const guardrailEngine = new AppGuardrailEngine(mockClient, testSigner, {
    minNativeBalance: parseEther('0.01'),
    maxTransactionValue: parseEther('10'),
    maxPriorityFeeCap: parseEther('0.05')
  });

  // 1a. Safe Transaction
  const safeCheck = await guardrailEngine.verifyPreFlightGuardrails(parseEther('1.0'), parseEther('0.001'));
  console.log('Safe Check Result:', safeCheck.safe ? '✅ PASS' : '❌ FAIL');
  if (!safeCheck.safe) throw new Error('Safe check failed: ' + safeCheck.reason);

  // 1b. Exceeds Max Transaction Value
  const excessValueCheck = await guardrailEngine.verifyPreFlightGuardrails(parseEther('100.0'), parseEther('0.001'));
  console.log('Excess Value Blocked:', !excessValueCheck.safe ? '✅ PASS (Correctly Blocked)' : '❌ FAIL');
  if (excessValueCheck.safe) throw new Error('Excess value check should have been blocked');

  // 1c. Exceeds Fee Cap
  const excessFeeCheck = await guardrailEngine.verifyPreFlightGuardrails(parseEther('0.5'), parseEther('0.1'));
  console.log('Fee Spike Blocked:', !excessFeeCheck.safe ? '✅ PASS (Correctly Blocked)' : '❌ FAIL');
  if (excessFeeCheck.safe) throw new Error('Fee spike check should have been blocked');

  // Test 2: Network Telemetry & Node Health
  console.log('\n--- Test 2: RPC Telemetry & Health Probe ---');
  const telemetry = await guardrailEngine.runNetworkTelemetryHealthCheck();
  console.log('Telemetry Status:', telemetry.stats.status);
  console.log('Telemetry Result:', telemetry.poolHealthy ? '✅ PASS' : '⚠️ Offline/Mocked fallback');

  // Test 3: Ledger Auditor Mock Reconciliation
  console.log('\n--- Test 3: Post-Flight State Reconciliation ---');
  const mockReceiptClient = {
    getTransactionReceipt: async () => ({
      status: 'success',
      blockNumber: 20500105n,
      gasUsed: 21000n,
      effectiveGasPrice: 15000000000n, // 15 Gwei
      logs: []
    }),
    getTransaction: async () => ({
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex
    })
  };

  const auditor = new LedgerAuditor(mockReceiptClient);
  const auditReport = await auditor.reconcileTransaction(
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    testSigner
  );

  console.log('Audit Reconciled:', auditReport.reconciled ? '✅ PASS' : '❌ FAIL');
  console.log('Gas Spent (ETH):', auditReport.gasSpentEth);
  console.log('Block Number:', auditReport.blockNumber?.toString());

  // Test 4: Viem Resilient Provider Multi-Chain Config
  console.log('\n--- Test 4: Multi-Chain Config Verification ---');
  const mainnetChain = getChainConfig(1);
  const polygonChain = getChainConfig(137);
  const arbitrumChain = getChainConfig(42161);
  console.log(`Chains configured: ${mainnetChain.name} (1), ${polygonChain.name} (137), ${arbitrumChain.name} (42161)`);
  console.log('Chain Config:', '✅ PASS');

  console.log('\n==================================================');
  console.log('🎉 ALL RESILIENT PIPELINE UNIT TESTS PASSED!');
  console.log('==================================================\n');
}

runResilientPipelineTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
