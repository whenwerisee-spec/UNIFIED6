import { useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePortfolioStore } from '../store/portfolio-store';

/**
 * Hook to continuously or periodically poll on-chain balances from active providers
 * (e.g. window.ethereum / EIP-1193) and pump raw balances into the centralized usePortfolioStore.
 */
export function useLivePortfolioSync(pollIntervalMs: number = 30000) {
  const syncBalances = usePortfolioStore((state) => state.syncBalances);
  const setSyncing = usePortfolioStore((state) => state.setSyncing);
  const activeAddresses = usePortfolioStore((state) => state.activeAddresses);
  const rawHoldings = usePortfolioStore((state) => state.rawHoldings);
  const bootFromLocalDiskCache = usePortfolioStore((state) => state.bootFromLocalDiskCache);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // SWR Instant Local Disk Cache Hydration
  useEffect(() => {
    bootFromLocalDiskCache();
  }, [bootFromLocalDiskCache]);

  const fetchLiveBalances = useCallback(async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      return;
    }

    try {
      setSyncing(true);
      const provider = new ethers.BrowserProvider((window as any).ethereum);

      const targetAddress = activeAddresses.connectedWallet || activeAddresses.selectedVault || (import.meta as any).env?.VITE_MARSHALL_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
      if (targetAddress && ethers.isAddress(targetAddress)) {
        const bal = await provider.getBalance(targetAddress);
        const ethFormatted = parseFloat(ethers.formatEther(bal));

        const ERC20_ABI = [
          'function balanceOf(address account) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ];

        const tokensToSync = [
          { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
          { symbol: 'USDF', address: '0x32F7159c940E20D5aD0C92233f001716962A562B' }, // USDF Placeholder
          { symbol: 'XAUT', address: '0x68749665e9333944b33c378e9060000000000000' } // XAUT Placeholder
        ];

        const tokenResults: Record<string, { amount: number; depositAddress: string }> = {
          ETH: {
            amount: ethFormatted,
            depositAddress: targetAddress
          }
        };

        for (const token of tokensToSync) {
          try {
            const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const [balance, decimals] = await Promise.all([
              contract.balanceOf(targetAddress),
              contract.decimals()
            ]);
            tokenResults[token.symbol] = {
              amount: parseFloat(ethers.formatUnits(balance, decimals)),
              depositAddress: targetAddress
            };
          } catch (e) {
            // Silently skip if token contract check fails
          }
        }

        // Sync into unified store
        syncBalances(tokenResults);
      }
    } catch (err) {
      console.warn('Silent live portfolio balance sync skip:', err);
    } finally {
      setSyncing(false);
    }
  }, [activeAddresses.connectedWallet, activeAddresses.selectedVault, setSyncing, syncBalances]);

  useEffect(() => {
    fetchLiveBalances();

    timerRef.current = setInterval(fetchLiveBalances, pollIntervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchLiveBalances, pollIntervalMs]);

  return {
    refetchNow: fetchLiveBalances
  };
}
