import { useState, useEffect, useCallback } from 'react';

/**
 * Wise Card & Google Pay Pass Synchronization Service Layer
 * 
 * Coordinates real-time synchronization between:
 * 1. Wise Multi-Currency Account & Wise Physical/Digital Card engine
 * 2. Google Pay & Google Wallet Pass JWT generation + QR code
 * 3. Sovereign Ledger Account Hub (wallets database table & portfolio valuation)
 */

export interface WiseCardSyncState {
  cardStatus: 'ACTIVE' | 'FROZEN' | 'BLOCKED';
  cardholderName: string;
  maskedPan: string;
  limits: {
    dailyContactlessUsd: number;
    monthlyContactlessUsd: number;
    dailyAtmUsd: number;
    monthlyAtmUsd: number;
    perTransactionCapUsd: number;
  };
  balances: {
    usd: number;
    cad: number;
    eur: number;
    totalUSD: number;
  };
  sourceAccount: string;
  isLiveConnected: boolean;
  lastSyncedAt: string;
}

export interface GooglePayPassSyncState {
  objectId: string;
  classId: string;
  merchantId: string;
  merchantName: string;
  passJwt: string;
  addToWalletUrl: string;
  qrDataUrl: string;
  passStatus: 'SYNCHRONIZED' | 'ACTIVE' | 'PENDING';
  lastSyncedAt: string;
}

export interface AccountHubSyncStatus {
  success: boolean;
  userId: string;
  userEmail: string;
  userName: string;
  usdBalance: number;
  cadBalance: number;
  totalPortfolioUsd: number;
  walletAddress: string;
  wiseCard: WiseCardSyncState;
  googlePayPass: GooglePayPassSyncState;
  syncedAt: string;
  isLiveConnected: boolean;
}

/**
 * Service Layer class for server-side & client-side synchronization orchestration
 */
export class WiseGooglePassSyncService {
  private static debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static pendingResolvers: Array<{
    resolve: (val: AccountHubSyncStatus) => void;
    reject: (err: any) => void;
  }> = [];
  private static activeSyncPromise: Promise<AccountHubSyncStatus> | null = null;

  /**
   * Helper to format USD currency consistently
   */
  public static formatUsd(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Helper to format CAD currency consistently
   */
  public static formatCad(amount: number): string {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Perform client-side request to trigger full synchronization across Wise Card,
   * Google Wallet Pass, and Account Hub.
   */
  public static async requestSync(): Promise<AccountHubSyncStatus> {
    const sessionToken = typeof window !== 'undefined'
      ? (sessionStorage.getItem('cb_auth_jwt_token') || localStorage.getItem('cb_auth_jwt_token'))
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    const response = await fetch('/api/sovereign/sync-pass-hub', {
      method: 'POST',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Account Hub Synchronization failed [${response.status}]: ${errorText.substring(0, 150)}`);
    }

    return response.json();
  }

  /**
   * Request synchronization with debouncing to prevent excessive API calls
   * when multiple pass updates or balance state changes trigger rapidly.
   */
  public static requestDebouncedSync(delayMs: number = 300): Promise<AccountHubSyncStatus> {
    if (this.activeSyncPromise) {
      return this.activeSyncPromise;
    }

    return new Promise<AccountHubSyncStatus>((resolve, reject) => {
      this.pendingResolvers.push({ resolve, reject });

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        this.debounceTimer = null;
        const resolvers = [...this.pendingResolvers];
        this.pendingResolvers = [];

        try {
          this.activeSyncPromise = this.requestSync();
          const result = await this.activeSyncPromise;
          resolvers.forEach(r => r.resolve(result));
        } catch (err) {
          resolvers.forEach(r => r.reject(err));
        } finally {
          this.activeSyncPromise = null;
        }
      }, delayMs);
    });
  }
}

/**
 * Custom React Hook to consume the Wise Card & Google Pay Pass Sync Service
 */
export function useWiseGooglePassSync(autoSyncIntervalMs: number = 60000) {
  const [syncState, setSyncState] = useState<AccountHubSyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const performSync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const data = await WiseGooglePassSyncService.requestSync();
      setSyncState(data);
      return data;
    } catch (err: any) {
      console.warn('[useWiseGooglePassSync] Sync warning:', err.message || err);
      setError(err.message || 'Synchronization failed');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const performDebouncedSync = useCallback((delayMs: number = 300) => {
    setIsSyncing(true);
    setError(null);
    return WiseGooglePassSyncService.requestDebouncedSync(delayMs)
      .then((data) => {
        setSyncState(data);
        return data;
      })
      .catch((err: any) => {
        console.warn('[useWiseGooglePassSync] Debounced sync warning:', err.message || err);
        setError(err.message || 'Synchronization failed');
        return null;
      })
      .finally(() => {
        setIsSyncing(false);
      });
  }, []);

  useEffect(() => {
    performSync();

    if (autoSyncIntervalMs > 0) {
      const timer = setInterval(() => {
        performSync();
      }, autoSyncIntervalMs);
      return () => clearInterval(timer);
    }
  }, [performSync, autoSyncIntervalMs]);

  return {
    syncState,
    isSyncing,
    error,
    syncNow: performSync,
    syncNowDebounced: performDebouncedSync
  };
}

