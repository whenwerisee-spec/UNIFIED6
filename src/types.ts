export interface Coin {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  color: string;
  description: string;
  circulatingSupply: string;
  allTimeHigh: number;
  popularity: number;
  sparkline: number[]; // Last 24 hours trend
  history1D: number[];
  history1W: number[];
  history1M: number[];
  history1Y: number[];
}

export interface Holding {
  symbol: string;
  amount: number;
  avgBuyPrice: number;
}

export interface StakedAssetPosition {
  id: string;
  symbol: string;
  name: string;
  stakedAmount: number;
  unclaimedRewards: number;
  apy: number;
  lockupDays: number;
  validator: string;
  slashingProtected: boolean;
  autoCompound: boolean;
  lastCompoundedAt?: number;
  liquidityType: 'Liquid' | 'Epoch-Bound' | 'Flexible' | 'Fixed';
}

export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL' | 'CONVERT' | 'EARN' | 'SEND' | 'RECEIVE';
  assetSymbol: string;
  amount: number;
  fiatAmount: number;
  timestamp: number;
  details: string;
  hash?: string;
  status?: 'pending' | 'completed' | 'failed' | 'processing' | 'settled';
  blockHeight?: number;
  fromAddress?: string;
  toAddress?: string;
  ledgerDebit?: string; // e.g. "Asset Holding Account (BTC)"
  ledgerCredit?: string; // e.g. "Cash Vault Account (USD)"
  progressPercent?: number;
  stage?: 'INITIATED' | 'MEMPOOL_BROADCAST' | 'CONFIRMING' | 'SETTLED' | 'FAILED';
  stageLabel?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  estimatedCompletionTime?: number;
  lastPolledAt?: number;
  network?: string;
}

export type TimeFrame = '1H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';

export type ChainType = 'Ethereum' | 'Polygon' | 'Base' | 'BNB Chain' | 'Solana' | 'Bitcoin';

export interface ChainConfig {
  name: ChainType;
  symbol: string;
  decimals: number;
  rpcUrl: string;
  explorerUrl: string;
  icon: string;
  color: string;
}

export interface BlockchainTransaction {
  txId: string;
  hash: string;
  chain: ChainType;
  type: 'send' | 'receive';
  fromAddress: string;
  toAddress: string;
  amount: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
}

export type OperationType =
  | 'read'
  | 'write'
  | 'create'
  | 'update'
  | 'delete'
  | 'query'
  | 'transaction';

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | null;
    email: string | null;
    emailVerified: boolean | null;
    isAnonymous: boolean | null;
  };
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  rewardAmount: number;
  rewardSymbol: string;
  questions: QuizQuestion[];
  completed: boolean;
}

export interface LedgerAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  description: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountId: string;
  category: string;
  source: string;
  sourceId: string;
  cleared: boolean;
}

export interface LedgerTransaction {
  id: string;
  date: string;
  description: string;
  source: string;
  sourceId: string;
  entries: LedgerEntry[];
}

export interface ExternalTransaction {
  id: string;
  source: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  raw?: any;
  imported: boolean;
  ledgerTransactionId?: string;
}

export interface IntegrationsState {
  stripe: {
    apiKeySet: boolean;
    connected: boolean;
    mode?: string;
    lastSyncedAt?: string;
  };
  plaid: {
    apiKeySet: boolean;
    connected: boolean;
    mode?: string;
    lastSyncedAt?: string;
  };
  wise: {
    apiKeySet: boolean;
    connected: boolean;
    mode?: string;
    lastSyncedAt?: string;
  };
  coinbase55?: {
    apiKeySet: boolean;
    connected: boolean;
    mode?: string;
    lastSyncedAt?: string;
    error?: string | null;
  };
}

