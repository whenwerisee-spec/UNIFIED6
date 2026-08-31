/**
 * Wise API Direct Debit / Pay-In Engine
 * Handles direct bank debits into Wise Business Account balance
 * Uses personal API token authentication for SMB account automation
 */

import crypto from 'crypto';
import { createStructuredLogger } from './structured-logger.js';
import WiseAuthProvider from './wise-auth-provider.js';

const logger = createStructuredLogger('wise-api-engine');

function isWiseScaRejected(response: Response): { required: boolean; oneTimeToken?: string } {
  const approvalResult = String(response.headers.get('x-2fa-approval-result') || '').toUpperCase();
  const oneTimeToken = String(response.headers.get('x-2fa-approval') || '').trim();
  if (response.status === 403 && approvalResult === 'REJECTED') {
    return {
      required: true,
      oneTimeToken: oneTimeToken || undefined
    };
  }
  return { required: false };
}

function normalizeTransferReference(reference: string | undefined, fallback: string): string {
  const value = String(reference || '').trim();
  const base = value.length > 0 ? value : fallback;
  // Keep the descriptor predictable and bank-safe (no control/special chars).
  return base
    .replace(/[^A-Za-z0-9 ._\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export interface WiseRecipientPayload {
  amount: number;
  currency: string;
  recipientName: string;
  routingNumber: string;
  accountNumber: string;
  accountType?: 'CHECKING' | 'SAVINGS';
  address?: {
    country: string;
    city: string;
    postCode: string;
    firstLine: string;
    state: string;
  };
}

export interface WiseTransferStatus {
  id: string;
  status: 'incoming_payment_waiting' | 'processing' | 'outgoing_payment_sent' | 'cancelled' | 'rejected';
  amount: number;
  currency: string;
  createdAt: string;
}

export interface WiseConversionQuote {
  quoteId: string;
  profileId: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate?: number;
}

export interface WiseExecutionResult {
  transferId: string;
  payInMethod: string;
}

interface WisePaymentOption {
  payIn?: string;
  disabled?: boolean;
  [key: string]: any;
}

/**
 * Pure API Wise Connector
 * Interacts directly with Wise REST API for profile identification,
 * recipient creation, transfer routing, and active polling
 */
export class WiseApiEngine {
  private baseUrl: string;
  private baseHeaders: Record<string, string>;
  private isSandbox: boolean;
  private authProvider: WiseAuthProvider;

  private static headersToRecord(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {};
    if (headers instanceof Headers) {
      const out: Record<string, string> = {};
      headers.forEach((value, key) => {
        out[key] = value;
      });
      return out;
    }
    if (Array.isArray(headers)) {
      return headers.reduce((acc: Record<string, string>, [key, value]) => {
        acc[String(key)] = String(value);
        return acc;
      }, {});
    }
    const out: Record<string, string> = {};
    Object.entries(headers).forEach(([key, value]) => {
      out[key] = String(value);
    });
    return out;
  }

  private static extractEnabledPayInMethods(quote: any): string[] {
    const options = Array.isArray(quote?.paymentOptions)
      ? (quote.paymentOptions as WisePaymentOption[])
      : [];
    return options
      .filter((option) => option && option.disabled === false)
      .map((option) => String(option.payIn || '').trim().toUpperCase())
      .filter((value) => value.length > 0);
  }

  private static pickPayInMethod(
    enabledMethods: string[],
    preferredOrder: string[]
  ): string | null {
    if (enabledMethods.length === 0) {
      return null;
    }

    const enabledSet = new Set(enabledMethods.map((value) => String(value).toUpperCase()));
    for (const preferred of preferredOrder) {
      const normalized = String(preferred || '').toUpperCase();
      if (enabledSet.has(normalized)) {
        return normalized;
      }
    }

    return enabledMethods[0];
  }

  private static orderPayInMethods(enabledMethods: string[], preferredOrder: string[]): string[] {
    const uniqueEnabled = Array.from(new Set(enabledMethods.map((value) => String(value).toUpperCase())));
    const ordered: string[] = [];
    for (const preferred of preferredOrder) {
      const normalized = String(preferred || '').toUpperCase();
      if (uniqueEnabled.includes(normalized) && !ordered.includes(normalized)) {
        ordered.push(normalized);
      }
    }
    for (const method of uniqueEnabled) {
      if (!ordered.includes(method)) {
        ordered.push(method);
      }
    }
    return ordered;
  }

  private static isLikelyInvalidTokenBody(bodyText: string): boolean {
    const normalized = String(bodyText || '').toLowerCase();
    return normalized.includes('invalid_token')
      || normalized.includes('unauthorized')
      || normalized.includes('invalid_grant')
      || normalized.includes('invalid_client');
  }

  private async wiseFetch(apiPath: string, init: RequestInit = {}, allowRetry = true): Promise<Response> {
    const accessToken = await this.authProvider.getAccessToken(false);
    const requestHeaders = {
      ...this.baseHeaders,
      ...WiseApiEngine.headersToRecord(init.headers),
      Authorization: `Bearer ${accessToken}`
    };

    const response = await fetch(`${this.baseUrl}${apiPath}`, {
      ...init,
      headers: requestHeaders
    });

    if (!allowRetry || response.status !== 401 || !this.authProvider.canRefresh()) {
      return response;
    }

    const bodyText = await response.clone().text();
    if (!WiseApiEngine.isLikelyInvalidTokenBody(bodyText)) {
      return response;
    }

    logger.warn('Wise request received invalid token response, refreshing and retrying once', {
      apiPath
    });

    await this.authProvider.getAccessToken(true);
    const refreshedToken = await this.authProvider.getAccessToken(false);
    const retryHeaders = {
      ...this.baseHeaders,
      ...WiseApiEngine.headersToRecord(init.headers),
      Authorization: `Bearer ${refreshedToken}`
    };

    return fetch(`${this.baseUrl}${apiPath}`, {
      ...init,
      headers: retryHeaders
    });
  }

  /**
   * @param {string} apiToken - Your Wise personal API token
   * @param {boolean} isSandbox - Toggle between Wise sandbox or live money URLs
   */
  constructor(apiToken: string, isSandbox: boolean = true) {
    this.isSandbox = isSandbox;
    this.baseUrl = isSandbox
      ? 'https://api.sandbox.wise.com'
      : 'https://api.wise.com';
    this.authProvider = new WiseAuthProvider(apiToken, isSandbox);

    this.baseHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'SovereignsWiseIntegration/1.0'
    };

    logger.info('Wise API Engine initialized', {
      mode: isSandbox ? 'sandbox' : 'production',
      baseUrl: this.baseUrl
    });
  }

  /**
   * Fetches the corporate profile container ID from your token account
   * @returns Profile ID for use in subsequent API calls
   */
  async getProfileId(): Promise<string> {
    logger.debug('Fetching Wise profile ID');

    try {
      const response = await this.wiseFetch('/v1/profiles', {
        method: 'GET',
        headers: this.baseHeaders
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error('Failed to fetch profiles', {
          status: response.status,
          error
        });
        const tokenError = String(error?.error || '').toLowerCase();
        if (response.status === 401 && (tokenError === 'invalid_token' || tokenError === 'unauthorized' || tokenError === 'invalid_grant')) {
          throw new Error('WISE_TOKEN_INVALID: Wise access token is invalid, expired, revoked, or replaced');
        }
        if (response.status === 429) {
          throw new Error('WISE_RATE_LIMITED: Wise API rate limit exceeded while fetching profile');
        }
        throw new Error(`Wise profiles fetch failed: ${error.message || response.statusText}`);
      }

      const profiles = await response.json();

      // Find business profile
      const business = profiles.find((p: any) => p.type === 'business');
      if (!business) {
        logger.error('No business profile found', { profileCount: profiles.length });
        throw new Error('No active Business Profile linked to this token');
      }

      logger.debug('Business profile found', { profileId: business.id });
      return business.id;
    } catch (err: any) {
      logger.error('Error fetching profile ID', { error: err.message });
      throw err;
    }
  }

  /**
   * Creates a recipient bank account entry in Wise
   * @param profileId - Your Wise profile ID
   * @param payload - Recipient bank details
   * @returns Recipient ID for use in transfer routing
   */
  async createRecipient(profileId: string, payload: WiseRecipientPayload): Promise<string> {
    logger.debug('Creating Wise recipient', {
      currency: payload.currency,
      accountType: payload.accountType || 'CHECKING'
    });

    try {
      const recipientPayload = {
        profile: profileId,
        currency: payload.currency,
        type: 'aba', // US ACH routing
        accountHolderName: payload.recipientName,
        details: {
          abartn: payload.routingNumber,
          accountNumber: payload.accountNumber,
          accountType: payload.accountType || 'CHECKING',
          ...(payload.address ? { address: payload.address } : {})
        }
      };

      const response = await this.wiseFetch('/v1/accounts', {
        method: 'POST',
        headers: this.baseHeaders,
        body: JSON.stringify(recipientPayload)
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error('Recipient creation failed', {
          status: response.status,
          error
        });
        throw new Error(`Recipient creation rejected: ${error.message || response.statusText}`);
      }

      const data = await response.json();
      logger.debug('Recipient created successfully', { recipientId: data.id });
      return data.id;
    } catch (err: any) {
      logger.error('Error creating recipient', { error: err.message });
      throw err;
    }
  }

  /**
   * Executes a complete direct debit transaction
   * Pulls funds from external account and deposits into your Wise balance
   * @param ledgerId - Your ledger transaction ID (for audit trail)
   * @param payload - Transaction details with recipient bank info
   * @returns Wise transfer ID for status tracking
   */
  async executeDirectDebit(ledgerId: string, payload: WiseRecipientPayload): Promise<WiseExecutionResult> {
    logger.info('Executing direct debit transaction', {
      ledgerId,
      amount: payload.amount,
      currency: payload.currency
    });

    try {
      // Step 1: Get profile ID
      const profileId = await this.getProfileId();

      // Step 2: Create recipient entry
      const recipientId = await this.createRecipient(profileId, payload);

      // Step 3: Generate inbound funding quote
      logger.debug('Generating funding quote');
      const quoteResponse = await this.wiseFetch(`/v3/profiles/${profileId}/quotes`, {
        method: 'POST',
        headers: this.baseHeaders,
        body: JSON.stringify({
          sourceCurrency: payload.currency,
          targetCurrency: payload.currency,
          targetAmount: payload.amount,
          profile: profileId
        })
      });

      if (!quoteResponse.ok) {
        const error = await quoteResponse.json();
        logger.error('Quote generation failed', { error });
        throw new Error(`Quote generation failed: ${error.message || quoteResponse.statusText}`);
      }

      const quote = await quoteResponse.json();
      const enabledPayInMethods = WiseApiEngine.extractEnabledPayInMethods(quote);
      const selectedPayInMethod = WiseApiEngine.pickPayInMethod(enabledPayInMethods, [
        'DIRECT_DEBIT',
        'BALANCE',
        'BANK_TRANSFER'
      ]);
      const payInCandidates = WiseApiEngine.orderPayInMethods(enabledPayInMethods, [
        'DIRECT_DEBIT',
        'BALANCE',
        'BANK_TRANSFER'
      ]);

      if (!selectedPayInMethod) {
        throw new Error('DIRECT_DEBIT_UNAVAILABLE: No enabled Wise payment option found for this quote');
      }

      logger.debug('Quote generated', { quoteId: quote.id, rate: quote.rate });

      // Step 4: Create transfer object
      logger.debug('Creating transfer object');
      const transferReference = normalizeTransferReference(
        (payload as any)?.reference,
        `Ledger direct debit ${ledgerId}`
      );

      const transferResponse = await this.wiseFetch('/v1/transfers', {
        method: 'POST',
        headers: this.baseHeaders,
        body: JSON.stringify({
          targetAccount: recipientId,
          quoteUuid: quote.id,
          customerTransactionId: crypto.randomUUID(), // Enforces idempotency
          details: {
            reference: transferReference
          }
        })
      });

      if (!transferResponse.ok) {
        const error = await transferResponse.json();
        logger.error('Transfer creation failed', { error });
        throw new Error(`Transfer creation failed: ${error.message || transferResponse.statusText}`);
      }

      const transfer = await transferResponse.json();
      logger.debug('Transfer created', { transferId: transfer.id });

      // Step 5: Fund using available rails in preferred order.
      let fundedWith = selectedPayInMethod;
      const fundingErrors: string[] = [];

      for (const candidateMethod of payInCandidates) {
        logger.debug('Funding transfer attempt', {
          transferId: transfer.id,
          payInMethod: candidateMethod
        });

        const fundingPayload: Record<string, any> = {
          type: candidateMethod
        };

        if (candidateMethod === 'DIRECT_DEBIT') {
          fundingPayload.paymentMethodDetails = {
            routingNumber: payload.routingNumber,
            accountNumber: payload.accountNumber,
            accountHolderName: payload.recipientName,
            accountType: payload.accountType || 'CHECKING'
          };
        }

        const fundResponse = await this.wiseFetch(
          `/v3/profiles/${profileId}/transfers/${transfer.id}/payments`,
          {
            method: 'POST',
            headers: this.baseHeaders,
            body: JSON.stringify(fundingPayload)
          }
        );

        if (fundResponse.ok) {
          fundedWith = candidateMethod;
          break;
        }

        const sca = isWiseScaRejected(fundResponse);
        if (sca.required) {
          throw new Error(`WISE_SCA_REQUIRED:${sca.oneTimeToken || ''}`);
        }

        const rawError = await fundResponse.text();
        let error: any = rawError;
        try {
          error = JSON.parse(rawError);
        } catch {
          // Wise sometimes returns plain-text error codes (e.g. "invalid.request").
        }

        const reason = (typeof error === 'object' && error?.message)
          ? String(error.message)
          : String(error || fundResponse.statusText || 'unknown funding error');
        fundingErrors.push(`${candidateMethod}: ${reason}`);

        logger.warn('Funding rail attempt failed', {
          transferId: transfer.id,
          payInMethod: candidateMethod,
          error
        });
      }

      if (fundingErrors.length === payInCandidates.length) {
        throw new Error(`DIRECT_DEBIT_UNAVAILABLE: No enabled Wise pay-in rail could fund transfer (${fundingErrors.join(' | ')})`);
      }

      logger.info('Direct debit transaction initiated successfully', {
        ledgerId,
        transferId: transfer.id,
        payInMethod: fundedWith,
        amount: payload.amount
      });

      return {
        transferId: String(transfer.id),
        payInMethod: fundedWith
      };
    } catch (err: any) {
      logger.error('Direct debit execution failed', {
        ledgerId,
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Creates an outbound recipient (for sending money OUT)
   * Supports global bank accounts and multiple currencies
   * @param profileId - Your Wise profile ID
   * @param recipientName - Name on the bank account
   * @param currency - Target currency
   * @param bankDetails - Bank account routing/account info (varies by country)
   * @returns Recipient ID for outbound transfers
   */
  async createOutboundRecipient(
    profileId: string,
    recipientName: string,
    currency: string,
    bankDetails: Record<string, any>
  ): Promise<string> {
    logger.debug('Creating outbound recipient', {
      currency,
      recipientName
    });

    try {
      const { routingNumber, ...restBankDetails } = bankDetails || {};
      const recipientPayload = {
        profile: profileId,
        currency,
        type: 'aba', // Default to US ABA, can be extended for other formats
        accountHolderName: recipientName,
        details: {
          ...restBankDetails,
          // Wise expects ABA routing under "abartn" for US accounts.
          ...(routingNumber && !restBankDetails?.abartn
            ? { abartn: routingNumber }
            : {})
        }
      };

      const response = await this.wiseFetch('/v1/accounts', {
        method: 'POST',
        headers: this.baseHeaders,
        body: JSON.stringify(recipientPayload)
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error('Outbound recipient creation failed', {
          status: response.status,
          error
        });
        const validationMessages = Array.isArray(error?.errors)
          ? error.errors
              .map((item: any) => String(item?.message || '').trim())
              .filter((msg: string) => msg.length > 0)
          : [];
        const detail = validationMessages.length > 0
          ? validationMessages.join('; ')
          : String(error?.message || response.statusText || 'Unprocessable Entity');
        throw new Error(`OUTBOUND_RECIPIENT_INVALID: ${detail}`);
      }

      const data = await response.json();
      logger.debug('Outbound recipient created', { recipientId: data.id });
      return data.id;
    } catch (err: any) {
      logger.error('Error creating outbound recipient', { error: err.message });
      throw err;
    }
  }

  /**
   * Executes a complete outbound transfer
   * Sends funds FROM your Wise balance TO a recipient bank account
   * Supports global recipients and multi-currency
   * @param ledgerId - Your ledger transaction ID (for audit trail)
   * @param amount - Amount to send
   * @param sourceCurrency - Currency in your Wise balance
   * @param targetCurrency - Currency the recipient receives
   * @param recipientName - Recipient bank account name
   * @param bankDetails - Bank routing/account details
   * @returns Wise transfer ID for tracking
   */
  async executeOutboundTransfer(
    ledgerId: string,
    amount: number,
    sourceCurrency: string,
    targetCurrency: string,
    recipientName: string,
    bankDetails: Record<string, any>,
    transferReference?: string
  ): Promise<WiseExecutionResult> {
    logger.info('Executing outbound transfer', {
      ledgerId,
      amount,
      sourceCurrency,
      targetCurrency,
      recipientName
    });

    try {
      // Step 1: Get profile ID
      const profileId = await this.getProfileId();

      // Step 2: Create outbound recipient
      const recipientId = await this.createOutboundRecipient(
        profileId,
        recipientName,
        targetCurrency,
        bankDetails
      );

      // Step 3: Get outbound transfer quote
      logger.debug('Getting outbound transfer quote');
      const quoteResponse = await this.wiseFetch(`/v3/profiles/${profileId}/quotes`, {
        method: 'POST',
        headers: this.baseHeaders,
        body: JSON.stringify({
          sourceCurrency,
          targetCurrency,
          sourceAmount: amount,
          profile: profileId
        })
      });

      if (!quoteResponse.ok) {
        const error = await quoteResponse.json();
        logger.error('Outbound quote generation failed', { error });
        throw new Error(`Quote generation failed: ${error.message || quoteResponse.statusText}`);
      }

      const quote = await quoteResponse.json();
      const enabledPayInMethods = WiseApiEngine.extractEnabledPayInMethods(quote);
      const selectedPayInMethod = WiseApiEngine.pickPayInMethod(enabledPayInMethods, [
        'BALANCE',
        'DIRECT_DEBIT',
        'BANK_TRANSFER'
      ]);
      const payInCandidates = WiseApiEngine.orderPayInMethods(enabledPayInMethods, [
        'BALANCE',
        'DIRECT_DEBIT',
        'BANK_TRANSFER'
      ]);

      if (!selectedPayInMethod) {
        throw new Error('OUTBOUND_BALANCE_UNAVAILABLE: No enabled Wise payment option found for this transfer quote');
      }

      logger.debug('Outbound quote generated', {
        quoteId: quote.id,
        rate: quote.rate,
        targetAmount: quote.targetAmount,
        fee: quote.fee
      });

      // Step 4: Create outbound transfer
      logger.debug('Creating outbound transfer');
      const resolvedReference = normalizeTransferReference(
        transferReference,
        `Ledger withdrawal ${ledgerId}`
      );

      const transferResponse = await this.wiseFetch('/v1/transfers', {
        method: 'POST',
        headers: this.baseHeaders,
        body: JSON.stringify({
          targetAccount: recipientId,
          quoteUuid: quote.id,
          customerTransactionId: crypto.randomUUID(),
          details: {
            reference: resolvedReference
          }
        })
      });

      if (!transferResponse.ok) {
        const error = await transferResponse.json();
        logger.error('Outbound transfer creation failed', { error });
        throw new Error(`Transfer creation failed: ${error.message || transferResponse.statusText}`);
      }

      const transfer = await transferResponse.json();
      logger.debug('Outbound transfer created', { transferId: transfer.id });

      // Step 5: Fund using available rails in preferred order.
      let fundedWith = selectedPayInMethod;
      const fundingErrors: string[] = [];

      for (const candidateMethod of payInCandidates) {
        logger.debug('Funding outbound transfer attempt', {
          transferId: transfer.id,
          payInMethod: candidateMethod
        });

        const fundResponse = await this.wiseFetch(
          `/v3/profiles/${profileId}/transfers/${transfer.id}/payments`,
          {
            method: 'POST',
            headers: this.baseHeaders,
            body: JSON.stringify({
              type: candidateMethod
            })
          }
        );

        if (fundResponse.ok) {
          fundedWith = candidateMethod;
          break;
        }

        const sca = isWiseScaRejected(fundResponse);
        if (sca.required) {
          throw new Error(`WISE_SCA_REQUIRED:${sca.oneTimeToken || ''}`);
        }

        const rawError = await fundResponse.text();
        let error: any = rawError;
        try {
          error = JSON.parse(rawError);
        } catch {
          // Wise may return string errors in some flows.
        }

        const reason = (typeof error === 'object' && error?.message)
          ? String(error.message)
          : String(error || fundResponse.statusText || 'unknown funding error');
        fundingErrors.push(`${candidateMethod}: ${reason}`);

        logger.warn('Outbound funding rail attempt failed', {
          transferId: transfer.id,
          payInMethod: candidateMethod,
          error
        });
      }

      if (fundingErrors.length === payInCandidates.length) {
        throw new Error(`OUTBOUND_FUNDING_UNAVAILABLE: No enabled Wise pay-in rail could fund transfer (${fundingErrors.join(' | ')})`);
      }

      logger.info('Outbound transfer initiated successfully', {
        ledgerId,
        transferId: transfer.id,
        payInMethod: fundedWith,
        amount,
        sourceCurrency,
        targetCurrency
      });

      return {
        transferId: String(transfer.id),
        payInMethod: fundedWith
      };
    } catch (err: any) {
      logger.error('Outbound transfer execution failed', {
        ledgerId,
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Creates a Wise FX quote that can be used for CAD-normalized payout routing.
   */
  async getConversionQuote(sourceCurrency: string, targetCurrency: string, sourceAmount: number): Promise<WiseConversionQuote> {
    const normalizedSource = String(sourceCurrency || '').trim().toUpperCase();
    const normalizedTarget = String(targetCurrency || '').trim().toUpperCase();
    const normalizedAmount = Number(sourceAmount || 0);

    if (!normalizedSource || !normalizedTarget || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error('WISE_CONVERSION_INPUT_INVALID: sourceCurrency, targetCurrency, and sourceAmount>0 are required');
    }

    const profileId = await this.getProfileId();
    const quoteResponse = await this.wiseFetch(`/v3/profiles/${profileId}/quotes`, {
      method: 'POST',
      headers: this.baseHeaders,
      body: JSON.stringify({
        sourceCurrency: normalizedSource,
        targetCurrency: normalizedTarget,
        sourceAmount: normalizedAmount,
        profile: profileId
      })
    });

    if (!quoteResponse.ok) {
      const text = await quoteResponse.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      const message = String(json?.message || json?.error || quoteResponse.statusText || 'Unable to create Wise conversion quote');
      throw new Error(`WISE_CONVERSION_UNAVAILABLE: ${message}`);
    }

    const quote = await quoteResponse.json() as any;
    return {
      quoteId: String(quote?.id || ''),
      profileId,
      sourceCurrency: normalizedSource,
      targetCurrency: normalizedTarget,
      sourceAmount: Number(quote?.sourceAmount || normalizedAmount),
      targetAmount: Number(quote?.targetAmount || 0),
      rate: Number.isFinite(Number(quote?.rate)) ? Number(quote?.rate) : undefined
    };
  }

  /**
   * Polls the live status of an active transfer
   * @param transferId - Wise transfer ID to check
   * @returns Current transfer status
   */
  async checkTransferStatus(transferId: string): Promise<WiseTransferStatus> {
    logger.debug('Checking transfer status', { transferId });

    try {
      const response = await this.wiseFetch(`/v1/transfers/${transferId}`, {
        method: 'GET',
        headers: this.baseHeaders
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error('Transfer status check failed', {
          transferId,
          status: response.status,
          error
        });
        throw new Error(`Transfer status check failed: ${error.message || response.statusText}`);
      }

      const transferDetails = await response.json();

      logger.debug('Transfer status retrieved', {
        transferId,
        status: transferDetails.status
      });

      return {
        id: transferDetails.id,
        status: transferDetails.status,
        amount: transferDetails.amount,
        currency: transferDetails.currency,
        createdAt: transferDetails.createdAt
      };
    } catch (err: any) {
      logger.error('Error checking transfer status', {
        transferId,
        error: err.message
      });
      throw err;
    }
  }

  getAuthHealth(): {
    mode: string;
    tokenShape: string;
    hasToken: boolean;
    hasCachedToken: boolean;
    expiresAt: string | null;
    expiresInSeconds: number | null;
    refreshInFlight: boolean;
  } {
    return this.authProvider.getHealthSnapshot();
  }

  /**
   * Fetches real live Wise account balances for profile
   */
  async getProfileBalances(customProfileId?: string): Promise<any[]> {
    try {
      const profileId = customProfileId || await this.getProfileId();
      const response = await this.wiseFetch(`/v4/profiles/${profileId}/balances?types=STANDARD`, {
        method: 'GET',
        headers: this.baseHeaders
      });

      if (!response.ok) {
        // Fall back to v1 borderless-accounts
        const altRes = await this.wiseFetch(`/v1/borderless-accounts?profileId=${profileId}`, {
          method: 'GET',
          headers: this.baseHeaders
        });
        if (altRes.ok) {
          const accounts = await altRes.json();
          if (Array.isArray(accounts) && accounts.length > 0 && accounts[0].balances) {
            return accounts[0].balances;
          }
        }
        return [];
      }

      const balances = await response.json();
      return Array.isArray(balances) ? balances : [];
    } catch (err: any) {
      logger.warn('Could not fetch live Wise balances directly from Wise API endpoint', { error: err.message });
      return [];
    }
  }
}

export default WiseApiEngine;
