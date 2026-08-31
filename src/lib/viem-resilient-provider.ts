import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type Hex,
  parseGwei,
  type Hash,
  type TransactionReceipt,
  type Chain
} from 'viem';
import { mainnet, polygon, arbitrum, optimism, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { AppGuardrailEngine, DEFAULT_GUARDRAIL_CONFIG, type GuardrailConfig } from './guardrail-engine';
import { LedgerAuditor, type AuditReport } from './ledger-auditor';
import { nodeAlertManager } from './node-alert-manager';

export { AppGuardrailEngine, DEFAULT_GUARDRAIL_CONFIG, type GuardrailConfig };
export { LedgerAuditor, type AuditReport };

/**
 * 1. Multi-provider RPC pool with fallback & latency optimization.
 */
export const DEFAULT_MAINNET_RPC_POOL = [
  'https://ethereum-rpc.publicnode.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
  'https://eth.llamarpc.com'
];

export const CHAIN_RPC_POOLS: Record<number, string[]> = {
  1: DEFAULT_MAINNET_RPC_POOL,
  137: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon', 'https://polygon-bor-rpc.publicnode.com'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum', 'https://arbitrum-one-rpc.publicnode.com'],
  10: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism', 'https://optimism-rpc.publicnode.com'],
  8453: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com', 'https://rpc.ankr.com/base']
};

/**
 * Get Chain configuration by Chain ID.
 */
export function getChainConfig(chainId: number = 1): Chain {
  const map: Record<number, Chain> = {
    1: mainnet,
    137: polygon,
    42161: arbitrum,
    10: optimism,
    8453: base
  };
  return map[chainId] || mainnet;
}

/**
 * Create a multi-node resilient public client for any supported chain.
 */
export function createResilientPublicClient(
  chainId: number = 1,
  customRpcPool?: string[]
) {
  const rpcPool = customRpcPool && customRpcPool.length > 0
    ? customRpcPool
    : (CHAIN_RPC_POOLS[chainId] || DEFAULT_MAINNET_RPC_POOL);

  const chain = getChainConfig(chainId);

  const transport = fallback(
    rpcPool.map((url) => http(url, { timeout: 3500 })),
    {
      rank: {
        interval: 30_000,
        sampleCount: 5,
        timeout: 2_000,
      },
      retryCount: 3,
      retryDelay: 150,
    }
  );

  return createPublicClient({
    chain,
    transport
  });
}

/**
 * Create a multi-node resilient wallet client for any supported chain.
 */
export function createResilientWalletClient(
  privateKey: Hex,
  chainId: number = 1,
  customRpcPool?: string[]
) {
  const rpcPool = customRpcPool && customRpcPool.length > 0
    ? customRpcPool
    : (CHAIN_RPC_POOLS[chainId] || DEFAULT_MAINNET_RPC_POOL);

  const chain = getChainConfig(chainId);
  const account = privateKeyToAccount(privateKey);

  const transport = fallback(
    rpcPool.map((url) => http(url, { timeout: 3500 })),
    {
      rank: {
        interval: 30_000,
        sampleCount: 5,
        timeout: 2_000,
      },
      retryCount: 3,
      retryDelay: 150,
    }
  );

  return createWalletClient({
    account,
    chain,
    transport
  });
}

/**
 * 2. High-Performance Transaction Broadcaster & Escalator
 * Guarantees confirmation by blasting resilient RPC nodes and dynamically bumping gas if stuck.
 */
export async function sendEscalatingTransaction(params: {
  privateKey: Hex;
  to: Hex;
  valueInWei: bigint;
  data?: Hex;
  chainId?: number;
  rpcPool?: string[];
  maxAttempts?: number;
  blocksToWait?: number;
  guardrailConfig?: Partial<GuardrailConfig>;
}): Promise<TransactionReceipt> {
  const {
    privateKey,
    to,
    valueInWei,
    data,
    chainId = 1,
    rpcPool,
    maxAttempts = 5,
    blocksToWait = 2,
    guardrailConfig
  } = params;

  const account = privateKeyToAccount(privateKey);
  const publicClient = createResilientPublicClient(chainId, rpcPool);
  const walletClient = createResilientWalletClient(privateKey, chainId, rpcPool);

  console.log(`[🚀] Initializing transaction from ${account.address} to ${to}...`);

  // Fetch live network baseline via eth_feeHistory
  const feeHistory = await publicClient.getFeeHistory({
    blockCount: 4,
    rewardPercentiles: [25, 50, 75],
    blockTag: 'latest'
  });

  // Calculate safe starting EIP-1559 premiums
  const baseFee = feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1] ?? 0n;
  const lastRewardArray = feeHistory.reward?.[feeHistory.reward.length - 1];
  let priorityFee = lastRewardArray?.[1] ?? parseGwei('1.5');
  let maxFee = (baseFee * 2n) + priorityFee;

  // 1. Guardrail Pre-Flight Verification
  const engine = new AppGuardrailEngine(publicClient, account.address, {
    ...DEFAULT_GUARDRAIL_CONFIG,
    ...guardrailConfig
  });

  const estimatedGasUnits = 21000n;
  const projectedMaxFee = maxFee * estimatedGasUnits;
  const preflightCheck = await engine.verifyPreFlightGuardrails(valueInWei, projectedMaxFee);
  if (!preflightCheck.safe) {
    throw new Error(`Guardrail Pre-Flight Blocked: ${preflightCheck.reason}`);
  }

  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  let txHash: Hash;

  try {
    // Construct signed raw transaction payload
    txHash = await walletClient.sendTransaction({
      to,
      value: valueInWei,
      data,
      maxPriorityFeePerGas: priorityFee,
      maxFeePerGas: maxFee,
      nonce
    } as any);
    console.log(`[📡] Broadcasted initial tx. Hash: ${txHash}. Monitoring confirmation...`);
  } catch (error) {
    const errorMsg = (error as Error).message;
    nodeAlertManager.notifyNodeDemoted({
      nodeUrl: (CHAIN_RPC_POOLS[chainId] || DEFAULT_MAINNET_RPC_POOL)[0] || 'RPC_POOL',
      chainId,
      reason: `Initial broadcast failed: ${errorMsg}`,
      timestamp: new Date().toISOString(),
      severity: 'WARNING'
    }).catch(() => {});
    throw new Error(`Initial transaction broadcast failed: ${errorMsg}`);
  }

  // 3. Monitor mempool lifecycle with an escalation loop
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Race condition monitoring for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: blocksToWait * 12_000, // Average block time 12 seconds
      });

      console.log(`[✅] Transaction successfully included in block ${receipt.blockNumber}!`);
      return receipt;
    } catch (error) {
      console.warn(`[⚠️] Transaction ${txHash} not confirmed within ${blocksToWait} blocks. Escalating gas fees...`);

      // Bump priority fee by 20% minimum to fulfill replacement protocols (Geth/Nethermind replacement rule)
      priorityFee = (priorityFee * 120n) / 100n;

      // Refresh current basefee
      const newGasEstimate = await publicClient.estimateFeesPerGas();
      const estimatedMaxFee = (newGasEstimate.maxFeePerGas ?? maxFee) * 120n / 100n;
      maxFee = estimatedMaxFee > (maxFee * 120n / 100n) ? estimatedMaxFee : (maxFee * 120n / 100n);

      console.log(`[🔄] Attempting replacement tx ${attempt}/${maxAttempts} with Nonce: ${nonce}. New Priority Fee: ${priorityFee.toString()} wei`);

      try {
        // Broadcast the speed-up transaction with identical nonce
        txHash = await walletClient.sendTransaction({
          to,
          value: valueInWei,
          data,
          maxPriorityFeePerGas: priorityFee,
          maxFeePerGas: maxFee,
          nonce
        } as any);
        console.log(`[📡] Replacement transaction broadcasted. New Hash: ${txHash}`);
      } catch (broadcastError: unknown) {
        const errorMsg = broadcastError instanceof Error ? broadcastError.message : String(broadcastError);
        // If a previous broadcast actually succeeded while trying to replace, handle gracefully
        if (errorMsg.includes('nonce too low') || errorMsg.includes('already known')) {
          console.log('[ℹ️] Original transaction mined during escalation window process.');
          continue;
        }
        throw broadcastError;
      }
    }
  }

  throw new Error(`Transaction remained unconfirmed after ${maxAttempts} gas escalations.`);
}

/**
 * 3. Unified Strategic Transaction Lifecycle Executor
 * Combines Pre-Flight Guardrails, In-Flight Multi-Node Resilient Escalation, and Post-Flight Ledger Auditing.
 */
export async function executeUnifiedTransactionWithAudit(params: {
  privateKey: Hex;
  to: Hex;
  valueInWei: bigint;
  data?: Hex;
  chainId?: number;
  rpcPool?: string[];
  guardrailConfig?: Partial<GuardrailConfig>;
  expectedEvents?: string[];
  abi?: any;
}): Promise<{ receipt: TransactionReceipt; audit: AuditReport }> {
  const {
    privateKey,
    to,
    valueInWei,
    data,
    chainId = 1,
    rpcPool,
    guardrailConfig,
    expectedEvents,
    abi
  } = params;

  const publicClient = createResilientPublicClient(chainId, rpcPool);
  const account = privateKeyToAccount(privateKey);

  // Phase 1: Pre-Flight Guardrail Verification
  const engine = new AppGuardrailEngine(publicClient, account.address, {
    ...DEFAULT_GUARDRAIL_CONFIG,
    ...guardrailConfig
  });

  const baseFeeEstimate = await publicClient.estimateFeesPerGas().catch(() => ({
    maxFeePerGas: parseGwei('30'),
    maxPriorityFeePerGas: parseGwei('2')
  }));
  const projectedMaxFee = (baseFeeEstimate.maxFeePerGas ?? parseGwei('30')) * 21000n;

  const preflight = await engine.verifyPreFlightGuardrails(valueInWei, projectedMaxFee);
  if (!preflight.safe) {
    throw new Error(`[Pre-Flight Guardrail Blocked]: ${preflight.reason}`);
  }

  // Phase 2: In-Flight Multi-Node Resilient Broadcast & Escalation
  const receipt = await sendEscalatingTransaction({
    privateKey,
    to,
    valueInWei,
    data,
    chainId,
    rpcPool,
    guardrailConfig
  });

  // Phase 3: Post-Flight State & Event Reconciliation Audit
  const auditor = new LedgerAuditor(publicClient);
  const audit = await auditor.reconcileTransaction(
    receipt.transactionHash,
    account.address,
    expectedEvents,
    abi
  );

  return { receipt, audit };
}

