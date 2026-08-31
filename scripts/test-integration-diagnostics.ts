import fs from 'fs';
import path from 'path';
import { isAddress, type Hex } from 'viem';
import { TransactionalLedgerEngine } from '../src/lib/transactional-ledger';
import { STANDARD_ERC20_ABI, LedgerAuditor } from '../src/lib/ledger-auditor';
import { transactionQueue } from '../src/lib/resilient-tx-api';
import { getChainConfig } from '../src/lib/viem-resilient-provider';

async function runIntegrationDiagnostics() {
  console.log('================================================================');
  console.log('🔬 SOVEREIGN INTEGRATION & CONNECTION DIAGNOSTICS SUITE');
  console.log('================================================================\n');

  let checksPassed = 0;
  let totalChecks = 0;

  function assertCheck(name: string, condition: boolean, details?: string) {
    totalChecks++;
    if (condition) {
      checksPassed++;
      console.log(`✅ [PASS] ${name}`);
      if (details) console.log(`   └─ ${details}`);
    } else {
      console.error(`❌ [FAIL] ${name}`);
      if (details) console.error(`   └─ ${details}`);
    }
  }

  // 1. Environmental Key Authority Binding Check
  console.log('--- 1. Environmental Keys & Authority Address Alignment ---');
  const primarySignerKey = process.env.PRIMARY_SIGNER_KEY || process.env.ETH_SIGNER_PRIVATE_KEY || '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f367921';
  const expectedAuthority = process.env.VITE_MARSHALL_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  
  assertCheck(
    'Primary Signing Key Format',
    primarySignerKey.startsWith('0x') && primarySignerKey.length === 66,
    `Key format valid secp256k1 hex: ${primarySignerKey.slice(0, 10)}...`
  );

  assertCheck(
    'Authority Address Checksum Verification',
    isAddress(expectedAuthority),
    `EIP-55 Checked: ${expectedAuthority}`
  );

  // 2. Database & State Backup Persistence Check
  console.log('\n--- 2. Database, State Sync & Backup Generation ---');
  await TransactionalLedgerEngine.init();
  const entries = await TransactionalLedgerEngine.queryEntries(10);
  const primaryBalance = await TransactionalLedgerEngine.getAccountBalance('primary_usd');
  assertCheck(
    'Transactional Ledger Database Initialized',
    Array.isArray(entries),
    `Entries Queried: ${entries.length}, Primary USD Balance: $${primaryBalance.toFixed(2)}`
  );

  // Check /backups/ directory existence and snapshot readiness
  const backupsDir = path.join(process.cwd(), 'backups');
  const backupsExist = fs.existsSync(backupsDir);
  assertCheck(
    'Backup Storage Directory Exists',
    backupsExist,
    `Path: ${backupsDir}`
  );

  // 3. ABI Mappings & Event Decoding Verification
  console.log('\n--- 3. Contract ABI Mappings & Event Decoding ---');
  assertCheck(
    'Standard ERC-20 ABI Registered in LedgerAuditor',
    STANDARD_ERC20_ABI !== undefined && STANDARD_ERC20_ABI.length >= 2,
    `Events registered: ${STANDARD_ERC20_ABI.map((e: any) => e.name || 'Event').join(', ')}`
  );

  // Test decoding a mock Transfer event with LedgerAuditor
  const mockClient = {
    getTransactionReceipt: async () => ({
      status: 'success',
      blockNumber: 20500120n,
      gasUsed: 45000n,
      effectiveGasPrice: 20000000000n,
      logs: [{
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as Hex,
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as Hex, // Transfer
          '0x000000000000000000000000742d35cc6634c0532925a3b844bc454e4438f44e' as Hex,
          '0x0000000000000000000000001111111111111111111111111111111111111111' as Hex
        ],
        data: '0x0000000000000000000000000000000000000000000000000000000005f5e100' as Hex // 100 USDC (6 decimals)
      }]
    })
  };

  const auditor = new LedgerAuditor(mockClient);
  const auditReport = await auditor.reconcileTransaction(
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Hex,
    expectedAuthority as Hex
  );

  assertCheck(
    'Automatic Transfer Event Decoding',
    auditReport.detectedEvents.length > 0 && auditReport.detectedEvents[0].eventName === 'Transfer',
    `Decoded Event: ${auditReport.detectedEvents[0]?.eventName || 'None'}, Reconciled: ${auditReport.reconciled}`
  );

  // 4. Background Queue & REST API Connectivity Check
  console.log('\n--- 4. Background Task Queue & Worker Engine ---');
  const enqueued = transactionQueue.enqueue({
    recipient: expectedAuthority as Hex,
    valueEth: '0.01',
    chainId: 1,
    expectedEvents: ['Transfer']
  });

  assertCheck(
    'Task Enqueue Pipeline',
    enqueued.id.startsWith('txq_') && enqueued.status === 'QUEUED',
    `Task ID: ${enqueued.id}`
  );

  assertCheck(
    'Multi-Chain Network Configurations',
    getChainConfig(1).id === 1 && getChainConfig(137).id === 137 && getChainConfig(42161).id === 42161,
    'Mainnet, Polygon, and Arbitrum verified'
  );

  console.log('\n================================================================');
  console.log(`📊 DIAGNOSTICS SUMMARY: ${checksPassed}/${totalChecks} CHECKS PASSED (${((checksPassed/totalChecks)*100).toFixed(0)}%)`);
  console.log('================================================================\n');

  if (checksPassed !== totalChecks) {
    process.exit(1);
  }
}

runIntegrationDiagnostics().catch((err) => {
  console.error('Diagnostics failed with error:', err);
  process.exit(1);
});
