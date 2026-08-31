import { useCallback, useState } from 'react';
import { ethers } from 'ethers';
import { usePortfolioStore } from '../store/portfolio-store';

export interface StandardTransferParams {
  toAddress: string;
  amountEth: string;
}

export interface WormholeBridgeParams {
  sourceNetwork: string;
  targetNetwork: string;
  symbol: string;
  amount: number | string;
}

export function useTransactionExecutor(refetchBalancesNow: () => Promise<void>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTxHash, setActiveTxHash] = useState<string | null>(null);

  const trackBridge = usePortfolioStore((state) => state.trackBridgeTransaction);
  const updateBridgeStatus = usePortfolioStore((state) => state.updateBridgeTransactionStatus);
  const dispatchOptimisticBridge = usePortfolioStore((state) => state.dispatchOptimisticBridge);

  /**
   * Pipeline 1: Native EIP-1193 Standard EVM Asset Transfers
   */
  const executeStandardTransfer = useCallback(async (params: StandardTransferParams) => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error("No EIP-1193 Web3 provider interface detected.");
    }
    
    setIsProcessing(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      // Submit native standard transfer transaction payload
      const txResponse = await signer.sendTransaction({
        to: params.toAddress,
        value: ethers.parseEther(params.amountEth),
      });

      setActiveTxHash(txResponse.hash);

      // Await network block confirmation 
      await txResponse.wait(1);

      // Trigger instant app-wide data refresh to reflect new balances
      await refetchBalancesNow();
      return txResponse.hash;
    } catch (error) {
      console.error("Standard asset transfer execution halted:", error);
      throw error;
    } finally {
      setIsProcessing(false);
      setActiveTxHash(null);
    }
  }, [refetchBalancesNow]);

  /**
   * Pipeline 2: Interoperable Wormhole L2 Cross-Chain Bridges
   */
  const executeCrossChainBridge = useCallback(async (params: WormholeBridgeParams) => {
    throw new Error("Wormhole cross-chain bridge provider is not yet configured for live production execution. Simulated bridging is disabled.");
  }, []);

  return {
    executeStandardTransfer,
    executeCrossChainBridge,
    isProcessing,
    activeTxHash
  };
}
