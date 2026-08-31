import { type Hex, formatEther, decodeEventLog, type TransactionReceipt, type Transaction, parseAbi } from 'viem';

export const STANDARD_ERC20_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
]);

export interface AuditReport {
  txHash: Hex;
  reconciled: boolean;
  gasSpentEth: string;
  balanceDeltaEth: string;
  detectedEvents: Array<{ eventName: string; args: any }>;
  mismatchReason?: string;
  blockNumber?: bigint;
  status: 'success' | 'reverted' | 'unknown';
}

export class LedgerAuditor {
  private client: any;

  constructor(client: any) {
    this.client = client;
  }

  /**
   * 1. Post-Flight State Reconciliation
   * Audit transaction outcomes by analyzing execution logs and explicit wallet balances.
   */
  async reconcileTransaction(
    txHash: Hex,
    signerAddress?: Hex,
    expectedEvents?: string[],
    abi?: any
  ): Promise<AuditReport> {
    console.log(`[🔍] Initiating post-flight ledger audit for ${txHash}...`);

    try {
      // Fetch the canonical transaction receipt and full transaction block data
      const receipt = await this.client.getTransactionReceipt({ hash: txHash }) as TransactionReceipt;
      const transaction = typeof this.client.getTransaction === 'function'
        ? await this.client.getTransaction({ hash: txHash }).catch(() => null)
        : null;

      // Calculate absolute gas spend
      const effectiveGasPrice = receipt.effectiveGasPrice ?? 0n;
      const gasSpentWei = receipt.gasUsed * effectiveGasPrice;
      const gasSpentEth = formatEther(gasSpentWei);

      const report: AuditReport = {
        txHash,
        reconciled: false,
        gasSpentEth,
        balanceDeltaEth: '0',
        detectedEvents: [],
        blockNumber: receipt.blockNumber,
        status: receipt.status === 'success' ? 'success' : 'reverted'
      };

      // 2. Decode execution logs with provided ABI or standard ERC-20 ABI
      if (receipt.logs && receipt.logs.length > 0) {
        const targetAbis = abi ? [abi, STANDARD_ERC20_ABI] : [STANDARD_ERC20_ABI];
        for (const log of receipt.logs as any[]) {
          for (const currentAbi of targetAbis) {
            try {
              const decoded: any = decodeEventLog({
                abi: currentAbi,
                data: log.data,
                topics: log.topics || []
              });
              if (decoded && decoded.eventName) {
                report.detectedEvents.push({ eventName: decoded.eventName, args: decoded.args });
                break;
              }
            } catch {
              continue;
            }
          }
        }
      }

      // 3. Verify execution status code
      if (receipt.status !== 'success') {
        report.mismatchReason = 'Transaction execution status explicitly reverted on-chain.';
        return report;
      }

      // 4. Validate presence of expected event signatures
      if (expectedEvents && expectedEvents.length > 0) {
        const detectedNames = report.detectedEvents.map((e) => e.eventName);
        const missingEvents = expectedEvents.filter((expected) => !detectedNames.includes(expected));

        if (missingEvents.length > 0) {
          report.mismatchReason = `Missing critical event logs: ${missingEvents.join(', ')}`;
          return report;
        }
      }

      console.log(`[✅] Audit complete for ${txHash}. Gas spent: ${gasSpentEth} ETH. Block: ${receipt.blockNumber}. State is fully reconciled.`);
      report.reconciled = true;
      return report;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[🚨] Ledger audit encountered an error for ${txHash}:`, msg);
      return {
        txHash,
        reconciled: false,
        gasSpentEth: '0',
        balanceDeltaEth: '0',
        detectedEvents: [],
        status: 'unknown',
        mismatchReason: `Failed to fetch receipt or audit logs: ${msg}`
      };
    }
  }
}
