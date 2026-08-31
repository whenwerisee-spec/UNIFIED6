/**
 * Validation Schemas for All API Endpoints
 * Centralized request body validation definitions
 */

import { ValidationSchema } from './input-validator.js';

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

export const AuthRegisterSchema: ValidationSchema = {
  email: {
    type: 'email',
    required: true,
    max: 254
  },
  password: {
    type: 'string',
    required: true,
    min: 8,
    max: 128,
    customValidator: (value: string) => {
      // At least one uppercase, one lowercase, one number
      return /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);
    }
  },
  firstName: {
    type: 'string',
    required: true,
    min: 2,
    max: 100
  },
  lastName: {
    type: 'string',
    required: true,
    min: 2,
    max: 100
  },
  citizenship: {
    type: 'string',
    required: false,
    enum: ['US', 'CA']
  }
};

export const AuthLoginSchema: ValidationSchema = {
  email: {
    type: 'email',
    required: true
  },
  password: {
    type: 'string',
    required: true,
    min: 1,
    max: 128
  },
  mfaCode: {
    type: 'string',
    required: false,
    pattern: /^\d{6}$/
  }
};

export const AuthMfaVerifySchema: ValidationSchema = {
  mfaCode: {
    type: 'string',
    required: true,
    pattern: /^\d{6}$/
  }
};

export const AuthResendVerificationSchema: ValidationSchema = {
  email: {
    type: 'email',
    required: true
  }
};

// ============================================================================
// TRANSACTION SCHEMAS
// ============================================================================

export const TradeSchema: ValidationSchema = {
  assetSymbol: {
    type: 'string',
    required: true,
    enum: ['BTC', 'ETH', 'USDC', 'USDT', 'SOL', 'ADA', 'XRP', 'DOT'],
    max: 10
  },
  amount: {
    type: 'decimal',
    required: true,
    customValidator: (value: string) => {
      const num = parseFloat(value);
      return num > 0 && num <= 1000000;
    }
  },
  side: {
    type: 'string',
    required: true,
    enum: ['BUY', 'SELL']
  },
  orderType: {
    type: 'string',
    required: false,
    enum: ['MARKET', 'LIMIT']
  },
  limitPrice: {
    type: 'decimal',
    required: false,
    customValidator: (value: string) => {
      if (!value) return true;
      const num = parseFloat(value);
      return num > 0;
    }
  }
};

export const SwapSchema: ValidationSchema = {
  fromAsset: {
    type: 'string',
    required: true,
    enum: ['BTC', 'ETH', 'USDC', 'USDT', 'SOL', 'ADA', 'XRP', 'DOT', 'CAD'],
    max: 10
  },
  toAsset: {
    type: 'string',
    required: true,
    enum: ['BTC', 'ETH', 'USDC', 'USDT', 'SOL', 'ADA', 'XRP', 'DOT', 'CAD'],
    max: 10
  },
  amount: {
    type: 'decimal',
    required: true,
    customValidator: (value: string) => {
      const num = parseFloat(value);
      return num > 0 && num <= 1000000;
    }
  }
};

export const WalletSendSchema: ValidationSchema = {
  recipientAddress: {
    type: 'address',
    required: true
  },
  assetSymbol: {
    type: 'string',
    required: true,
    enum: ['BTC', 'ETH', 'USDC'],
    max: 10
  },
  amount: {
    type: 'decimal',
    required: true,
    customValidator: (value: string) => {
      const num = parseFloat(value);
      return num > 0 && num <= 1000000;
    }
  },
  memo: {
    type: 'string',
    required: false,
    max: 200
  }
};

// ============================================================================
// WITHDRAWAL & SETTLEMENT SCHEMAS
// ============================================================================

export const WithdrawalInitiateSchema: ValidationSchema = {
  amount: {
    type: 'decimal',
    required: true,
    customValidator: (value: string) => {
      const num = parseFloat(value);
      return num > 0 && num <= 100000; // Max $100k per withdrawal
    }
  },
  destinationEmail: {
    type: 'email',
    required: true
  },
  destinationBank: {
    type: 'string',
    required: true,
    enum: ['td', 'rbc', 'scotia', 'bmo', 'cibc', 'desjardins', 'tangerine', 'simplii'],
    max: 20
  },
  accountName: {
    type: 'string',
    required: true,
    min: 2,
    max: 100
  },
  securityQuestion: {
    type: 'string',
    required: true,
    min: 5,
    max: 200
  },
  securityAnswer: {
    type: 'string',
    required: true,
    min: 1,
    max: 100
  }
};

export const ETransferSchema: ValidationSchema = {
  amount: {
    type: 'decimal',
    required: true,
    customValidator: (value: string) => {
      const num = parseFloat(value);
      return num > 0 && num <= 100000;
    }
  },
  recipientEmail: {
    type: 'email',
    required: true
  },
  depositMethod: {
    type: 'string',
    required: true,
    enum: ['DEPOSIT', 'CLAIM'],
    max: 20
  }
};

export const SettleBroadcastSchema: ValidationSchema = {
  transactionHash: {
    type: 'string',
    required: true,
    pattern: /^0x[a-fA-F0-9]{64}$/,
    max: 70
  },
  amount: {
    type: 'decimal',
    required: true,
    customValidator: (value: string) => {
      const num = parseFloat(value);
      return num > 0;
    }
  },
  assetSymbol: {
    type: 'string',
    required: true,
    enum: ['BTC', 'ETH', 'USDC'],
    max: 10
  }
};

// ============================================================================
// EMAIL & MESSAGING SCHEMAS
// ============================================================================

export const SendEmailSchema: ValidationSchema = {
  to: {
    type: 'email',
    required: true
  },
  subject: {
    type: 'string',
    required: true,
    min: 1,
    max: 200
  },
  body: {
    type: 'string',
    required: true,
    min: 1,
    max: 5000
  },
  htmlBody: {
    type: 'string',
    required: false,
    max: 10000
  }
};

export const SendSmsSchema: ValidationSchema = {
  phoneNumber: {
    type: 'string',
    required: true,
    pattern: /^\+?1?\d{10,14}$/,
    max: 20
  },
  message: {
    type: 'string',
    required: true,
    min: 1,
    max: 160
  }
};

// ============================================================================
// KYC & VERIFICATION SCHEMAS
// ============================================================================

export const KycUpdateSchema: ValidationSchema = {
  firstName: {
    type: 'string',
    required: true,
    min: 1,
    max: 50
  },
  lastName: {
    type: 'string',
    required: true,
    min: 1,
    max: 50
  },
  dateOfBirth: {
    type: 'string',
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/
  },
  citizenship: {
    type: 'string',
    required: true,
    min: 2,
    max: 2 // ISO country code
  },
  address: {
    type: 'string',
    required: true,
    min: 5,
    max: 200
  }
};

// ============================================================================
// ADMIN & MAINTENANCE SCHEMAS
// ============================================================================

export const AdminLedgerMaintenanceSchema: ValidationSchema = {
  action: {
    type: 'string',
    required: true,
    enum: ['reset', 'backup', 'verify', 'rotate'],
    max: 20
  },
  confirmDestructiveReset: {
    type: 'boolean',
    required: false
  }
};

export const AdminRotateKeysSchema: ValidationSchema = {
  newEncryptionKey: {
    type: 'string',
    required: true,
    min: 32,
    max: 256
  },
  confirm: {
    type: 'boolean',
    required: true,
    customValidator: (value: boolean) => value === true
  }
};

// ============================================================================
// MARKETPLACE/EXCHANGE SCHEMAS
// ============================================================================

export const ExchangeSyncSchema: ValidationSchema = {
  provider: {
    type: 'string',
    required: true,
    enum: ['coinbase', 'kraken'],
    max: 20
  },
  forceRefresh: {
    type: 'boolean',
    required: false
  }
};

export const CoinbaseConfigSchema: ValidationSchema = {
  apiKeyId: {
    type: 'string',
    required: true,
    min: 8,
    max: 256
  },
  apiSecret: {
    type: 'string',
    required: true,
    min: 8,
    max: 1024
  }
};

// ============================================================================
// ATM SCHEMAS
// ============================================================================

export const AtmConnectSchema: ValidationSchema = {
  atmId: {
    type: 'string',
    required: true,
    min: 5,
    max: 50
  },
  location: {
    type: 'string',
    required: true,
    min: 5,
    max: 200
  }
};

export const AtmWithdrawSchema: ValidationSchema = {
  atmId: {
    type: 'string',
    required: true,
    min: 5,
    max: 50
  },
  amount: {
    type: 'decimal',
    required: true,
    customValidator: (value: string) => {
      const num = parseFloat(value);
      return num > 0 && num <= 5000; // ATM max withdrawal
    }
  },
  currency: {
    type: 'string',
    required: true,
    enum: ['CAD', 'USD'],
    max: 3
  }
};

export const AtmDepositSchema: ValidationSchema = {
  atmId: {
    type: 'string',
    required: true,
    min: 5,
    max: 50
  },
  amount: {
    type: 'decimal',
    required: true,
    customValidator: (value: string) => {
      const num = parseFloat(value);
      return num > 0 && num <= 5000;
    }
  },
  currency: {
    type: 'string',
    required: true,
    enum: ['CAD', 'USD'],
    max: 3
  },
  denomination: {
    type: 'string',
    required: true,
    enum: ['5', '10', '20', '50', '100'],
    max: 3
  }
};
