/**
 * Critical Operations Enforcement Layer
 * 
 * Prevents marking success on financial, blockchain, payment, and messaging operations
 * without external verification.
 */

import {
  ProofObject,
  TestResult,
  createTestResult,
  verifyBlockchainTx,
  verifyExchangeOrder,
  verifyEmailDelivery,
  verifySmsPing,
  verifyBankPayment,
  verifyAtmVoucher,
} from './external-verification.js';

export interface CriticalOperationConfig {
  operationType: 'blockchain' | 'exchange' | 'payment' | 'sms' | 'email' | 'bank' | 'atm';
  requireExternalProof: boolean;
  timeout?: number; // milliseconds to wait for verification
}

export interface CriticalOperationsEnforcementState {
  requiresVerifiedExternalProof: boolean;
  moneyMovingOperationsBlockedUntilVerified: boolean;
}

const enforcementState: CriticalOperationsEnforcementState = {
  requiresVerifiedExternalProof: true,
  moneyMovingOperationsBlockedUntilVerified: true,
};

export function getCriticalOperationsEnforcementState(): CriticalOperationsEnforcementState {
  return { ...enforcementState };
}

/**
 * Enforces external verification for critical operations
 */
export class CriticalOperationEnforcer {
  private config: CriticalOperationConfig;

  constructor(config: CriticalOperationConfig) {
    this.config = { ...config, requireExternalProof: config.requireExternalProof ?? true };
  }

  /**
   * Execute blockchain operation with mandatory external verification
   */
  async executeBlockchainTransfer(
    chain: string,
    txHash: string,
    amount: string,
    recipient: string,
    userId: string,
  ): Promise<TestResult> {
    // Step 1: Internal validation
    if (!userId || !String(userId).trim()) {
      return createTestResult(
        false,
        { error: 'Missing authenticated userId' },
        null,
        'Internal validation failed - missing user identity',
      );
    }

    if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
      return createTestResult(
        false,
        { error: 'Invalid transaction hash format' },
        null,
        'Internal validation failed - invalid hash',
      );
    }

    // Step 2: Wait for external proof
    let externalProof: ProofObject | null = null;

    if (this.config.requireExternalProof) {
      try {
        externalProof = await verifyBlockchainTx(chain, txHash);
      } catch (error: any) {
        return createTestResult(
          false,
          { error: 'Failed to obtain external verification' },
          {
            type: 'blockchain',
            status: 'failed',
            referenceId: txHash,
            rawResponse: { error: error.message },
            timestamp: new Date().toISOString(),
          },
          'External verification failed',
        );
      }
    }

    // Step 3: Determine verdict
    const internalSuccess = !!txHash;
    return createTestResult(
      internalSuccess,
      { txHash, chain, amount, recipient, userId, confirmed: externalProof?.status === 'verified' },
      externalProof,
    );
  }

  /**
   * Execute exchange order with mandatory external verification
   */
  async executeExchangeTrade(
    exchange: string,
    orderId: string,
    asset: string,
    amount: string,
    action: 'buy' | 'sell',
    userId: string,
  ): Promise<TestResult> {
    // Step 1: Internal validation
    if (!userId || !String(userId).trim()) {
      return createTestResult(
        false,
        { error: 'Missing authenticated userId' },
        null,
        'Internal validation failed - missing user identity',
      );
    }

    if (!orderId) {
      return createTestResult(
        false,
        { error: 'Order ID is required' },
        null,
        'Internal validation failed - no order ID',
      );
    }

    // Step 2: Wait for external proof
    let externalProof: ProofObject | null = null;

    if (this.config.requireExternalProof) {
      const apiKey = exchange.toLowerCase() === 'coinbase' 
        ? process.env.COINBASE_API_KEY_ID 
        : process.env.KRAKEN_API_KEY;
      const apiSecret = exchange.toLowerCase() === 'coinbase' 
        ? process.env.COINBASE_API_SECRET_RAW 
        : process.env.KRAKEN_API_SECRET;

      if (!apiKey || !apiSecret) {
        return createTestResult(
          true, // Internal succeeded
          { orderId, asset, amount, action },
          {
            type: 'exchange',
            status: 'unavailable',
            referenceId: orderId,
            rawResponse: { error: `${exchange} API credentials not configured` },
            timestamp: new Date().toISOString(),
          },
          `Cannot verify with external exchange API - credentials missing`,
        );
      }

      try {
        externalProof = await verifyExchangeOrder(exchange, orderId, apiKey, apiSecret);
      } catch (error: any) {
        return createTestResult(
          true, // Internal succeeded
          { orderId, asset, amount, action },
          {
            type: 'exchange',
            status: 'failed',
            referenceId: orderId,
            rawResponse: { error: error.message },
            timestamp: new Date().toISOString(),
          },
          `Exchange verification failed: ${error.message}`,
        );
      }
    }

    return createTestResult(
      true,
      { orderId, exchange, asset, amount, action, userId },
      externalProof || { type: 'exchange', status: 'pending', referenceId: orderId, rawResponse: {}, timestamp: new Date().toISOString() },
    );
  }

  /**
   * Send email with mandatory delivery verification
   */
  async sendEmailWithVerification(
    recipient: string,
    subject: string,
    messageId: string,
    provider: string,
  ): Promise<TestResult> {
    // Step 1: Internal validation
    if (!recipient || !recipient.includes('@')) {
      return createTestResult(
        false,
        { error: 'Invalid recipient email' },
        null,
        'Internal validation failed - invalid email',
      );
    }

    // Step 2: Wait for external proof
    let externalProof: ProofObject | null = null;

    if (this.config.requireExternalProof && messageId) {
      try {
        externalProof = await verifyEmailDelivery(messageId, provider);
      } catch (error: any) {
        return createTestResult(
          true, // Email sent internally
          { recipient, subject, messageId },
          {
            type: 'email',
            status: 'failed',
            referenceId: messageId,
            rawResponse: { error: error.message },
            timestamp: new Date().toISOString(),
          },
          `Email delivery verification failed`,
        );
      }
    }

    return createTestResult(
      true,
      { recipient, subject, messageId },
      externalProof || { 
        type: 'email', 
        status: 'pending', 
        referenceId: messageId, 
        rawResponse: {}, 
        timestamp: new Date().toISOString() 
      },
    );
  }

  /**
   * Send SMS with mandatory delivery verification
   */
  async sendSmsWithVerification(
    phone: string,
    message: string,
    messageId: string,
    provider: string,
  ): Promise<TestResult> {
    // Step 1: Internal validation
    if (!phone || phone.length < 10) {
      return createTestResult(
        false,
        { error: 'Invalid phone number' },
        null,
        'Internal validation failed - invalid phone',
      );
    }

    // Step 2: Wait for external proof
    let externalProof: ProofObject | null = null;

    if (this.config.requireExternalProof && messageId) {
      try {
        externalProof = await verifySmsPing(messageId, provider);
      } catch (error: any) {
        return createTestResult(
          true, // SMS sent internally
          { phone, message, messageId },
          {
            type: 'sms',
            status: 'failed',
            referenceId: messageId,
            rawResponse: { error: error.message },
            timestamp: new Date().toISOString(),
          },
          `SMS delivery verification failed`,
        );
      }
    }

    return createTestResult(
      true,
      { phone, message, messageId },
      externalProof || { 
        type: 'sms', 
        status: 'pending', 
        referenceId: messageId, 
        rawResponse: {}, 
        timestamp: new Date().toISOString() 
      },
    );
  }

  /**
   * Process payment with mandatory external processor reference
   */
  async processPaymentWithVerification(
    amount: string,
    currency: string,
    recipient: string,
    processor: string,
    processorRefId: string,
  ): Promise<TestResult> {
    // Step 1: Internal validation
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return createTestResult(
        false,
        { error: 'Invalid payment amount' },
        null,
        'Internal validation failed - invalid amount',
      );
    }

    // Step 2: Require external processor reference
    if (!processorRefId) {
      return createTestResult(
        false,
        { error: 'Payment processor returned no reference ID' },
        null,
        'No external processor reference - payment may not have been submitted',
      );
    }

    // Step 3: Create proof with processor reference
    const externalProof: ProofObject = {
      type: 'payment',
      status: 'pending',
      referenceId: processorRefId,
      rawResponse: { processor, message: 'Payment sent - external processor verification required' },
      timestamp: new Date().toISOString(),
      externalSource: processor,
    };

    return createTestResult(
      true,
      { amount, currency, recipient, processor, processorRefId },
      externalProof,
      'Awaiting external processor confirmation',
    );
  }

  /**
   * Issue ATM voucher with external reference tracking
   */
  async issueAtmVoucherWithTracking(
    amount: string,
    currency: string,
    voucherRef: string,
    voucherPin: string,
  ): Promise<TestResult> {
    // Step 1: Internal validation
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return createTestResult(
        false,
        { error: 'Invalid voucher amount' },
        null,
        'Internal validation failed - invalid amount',
      );
    }

    if (!voucherRef || !voucherPin) {
      return createTestResult(
        false,
        { error: 'Failed to generate voucher' },
        null,
        'ATM voucher generation failed',
      );
    }

    // Step 2: Create proof for ATM network
    const externalProof: ProofObject = {
      type: 'atm',
      status: 'pending',
      referenceId: voucherRef,
      rawResponse: { 
        voucherRef, 
        pinProvided: true, 
        message: 'Voucher redeemable at ATM network' 
      },
      timestamp: new Date().toISOString(),
      externalSource: 'ATM Network',
    };

    return createTestResult(
      true,
      { amount, currency, voucherRef, voucherPin },
      externalProof,
      'ATM voucher issued - redeemable through ATM network',
    );
  }
}

/**
 * Factory for creating operation enforcers
 */
export function createEnforcer(operationType: CriticalOperationConfig['operationType']): CriticalOperationEnforcer {
  return new CriticalOperationEnforcer({
    operationType,
    requireExternalProof: true,
  });
}

/**
 * Global safety check - prevents any code from marking success without proof
 */
export function enforceExternalProofRequirement(result: TestResult): void {
  if (result.verdict === 'PASS' && !result.externalProof) {
    throw new Error(
      'SAFETY VIOLATION: Cannot mark test as PASS without external proof.\n' +
      `Result: ${JSON.stringify(result, null, 2)}\n` +
      'This indicates the test infrastructure is misconfigured. ' +
      'Verify that external verification is being performed.'
    );
  }

  if (result.verdict === 'PASS' && result.externalProof?.status !== 'verified') {
    throw new Error(
      'SAFETY VIOLATION: Cannot mark test as PASS when external proof status is not "verified".\n' +
      `Current status: ${result.externalProof?.status}\n` +
      `Result: ${JSON.stringify(result, null, 2)}`
    );
  }
}

export function isFinancialOperationVerified(result: TestResult): boolean {
  return result.internalResult.success === true && result.externalProof?.status === 'verified';
}
