/**
 * Advanced Web Worker Core for Portfolio Performance
 * Handles heavy deterministic math, balance reductions, and local caching away from the main UI thread.
 */
import { computeUnifiedPortfolioState, PortfolioState } from './portfolio-sync';

// Lightweight IndexedDB utility for persistent SWR local storage
const CACHE_DB_NAME = 'core_portfolio_cache';
const STORE_NAME = 'state_history';

function saveStateToDisk(state: PortfolioState) {
  try {
    if (typeof indexedDB === 'undefined') return;
    const request = indexedDB.open(CACHE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      try {
        const db = request.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(state, 'latest_portfolio');
      } catch (e) {
        console.warn('[Worker] Failed to write portfolio state to IndexedDB:', e);
      }
    };
  } catch (err) {
    console.warn('[Worker] IndexedDB access error in worker thread:', err);
  }
}

// In-worker event loop listening to incoming chain data updates
self.onmessage = async (event: MessageEvent) => {
  const { type, rawHoldings, activeAddresses, customPrices, payloads } = event.data;

  if (type === 'EXECUTE_DETERMINISTIC_SYNC') {
    try {
      // Execute the balance reductions and calculations in an isolated thread
      const fullyComputedState = computeUnifiedPortfolioState(rawHoldings, activeAddresses, customPrices);
      
      // Persist to local disk cache immediately for instant subsequent loads
      saveStateToDisk(fullyComputedState);

      // Ship the completed result back to the main UI store atomically
      self.postMessage({ type: 'SYNC_SUCCESS', state: fullyComputedState });
    } catch (error: any) {
      self.postMessage({ type: 'SYNC_ERROR', message: error?.message || 'Unknown deterministic sync error' });
    }
  } else if (type === 'INGEST_AGGREGATED_GATEWAY_DATA') {
    try {
      // Process interbank and Web3 aggregated gateway payloads off the main thread
      self.postMessage({ type: 'GATEWAY_PAYLOAD_READY', payloads });
    } catch (error: any) {
      self.postMessage({ type: 'SYNC_ERROR', message: error?.message || 'Gateway payload parsing error' });
    }
  }
};
