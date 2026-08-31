import { useEffect, useRef, useCallback } from 'react';

type StorageType = 'localStorage' | 'sessionStorage';

interface PendingWrite {
  storageType: StorageType;
  key: string;
  value: string;
  timerId: ReturnType<typeof setTimeout>;
}

/**
 * StorageSyncManager
 * 
 * Debounces writes to localStorage / sessionStorage to eliminate redundant,
 * synchronous disk I/O when state (e.g. account balances, holdings, transactions)
 * updates rapidly in short bursts.
 */
class StorageSyncManager {
  private pendingWrites = new Map<string, PendingWrite>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flushAll());
      window.addEventListener('pagehide', () => this.flushAll());
    }
  }

  private getCompositeKey(storageType: StorageType, key: string): string {
    return `${storageType}:${key}`;
  }

  /**
   * Schedule a debounced write to storage.
   */
  public setItemDebounced(
    key: string,
    value: string,
    delayMs: number = 300,
    storageType: StorageType = 'localStorage'
  ): void {
    if (typeof window === 'undefined') return;

    const compositeKey = this.getCompositeKey(storageType, key);
    const existing = this.pendingWrites.get(compositeKey);

    if (existing) {
      clearTimeout(existing.timerId);
    }

    const timerId = setTimeout(() => {
      this.flushKey(compositeKey);
    }, delayMs);

    this.pendingWrites.set(compositeKey, {
      storageType,
      key,
      value,
      timerId
    });
  }

  /**
   * Flush a specific pending key write immediately.
   */
  public flushKey(compositeKey: string): void {
    const pending = this.pendingWrites.get(compositeKey);
    if (!pending) return;

    clearTimeout(pending.timerId);
    this.pendingWrites.delete(compositeKey);

    try {
      const storage = pending.storageType === 'sessionStorage' ? window.sessionStorage : window.localStorage;
      storage.setItem(pending.key, pending.value);
    } catch (err) {
      console.warn(`[StorageSyncManager] Failed to write key "${pending.key}":`, err);
    }
  }

  /**
   * Immediately flush all pending storage writes synchronously.
   */
  public flushAll(): void {
    const keys = Array.from(this.pendingWrites.keys());
    for (const compositeKey of keys) {
      this.flushKey(compositeKey);
    }
  }

  /**
   * Read the latest value, checking pending in-memory writes first before falling back to Storage.getItem.
   */
  public getItemLatest(key: string, storageType: StorageType = 'localStorage'): string | null {
    if (typeof window === 'undefined') return null;

    const compositeKey = this.getCompositeKey(storageType, key);
    const pending = this.pendingWrites.get(compositeKey);

    if (pending) {
      return pending.value;
    }

    try {
      const storage = storageType === 'sessionStorage' ? window.sessionStorage : window.localStorage;
      return storage.getItem(key);
    } catch {
      return null;
    }
  }
}

export const storageSyncManager = new StorageSyncManager();

/**
 * Helper function for direct debounced storage writes without hook requirements
 */
export function debouncedStorageSetItem(
  key: string,
  value: string,
  delayMs: number = 300,
  storageType: StorageType = 'localStorage'
): void {
  storageSyncManager.setItemDebounced(key, value, delayMs, storageType);
}

/**
 * React Hook for debounced state persistence to storage.
 */
export function useDebouncedStorageSync<T>(
  key: string,
  value: T,
  delayMs: number = 300,
  enabled: boolean = true,
  serializer: (val: T) => string = (v) => (typeof v === 'string' ? v : JSON.stringify(v)),
  storageType: StorageType = 'localStorage'
): void {
  const isFirstRender = useRef(true);

  const sync = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;
    try {
      const serialized = serializer(value);
      storageSyncManager.setItemDebounced(key, serialized, delayMs, storageType);
    } catch (err) {
      console.warn(`[useDebouncedStorageSync] Serialization error for key ${key}:`, err);
    }
  }, [key, value, delayMs, enabled, serializer, storageType]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
    sync();
  }, [sync]);

  useEffect(() => {
    return () => {
      storageSyncManager.flushAll();
    };
  }, []);
}
