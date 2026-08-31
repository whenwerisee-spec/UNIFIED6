import crypto from 'crypto';

/**
 * External Verification System
 * 
 * Enforces actual external proof for all critical operations.
 * No test can pass without verifiable external evidence.
 */

export type ProofType = 'none' | 'blockchain' | 'exchange' | 'payment' | 'sms' | 'email' | 'bank' | 'atm';
export type VerificationStatus = 'verified' | 'failed' | 'pending' | 'unavailable';
export type TestVerdict = 'PASS' | 'FAIL' | 'INCOMPLETE';

export interface ProofObject {
  type: ProofType;
  status: VerificationStatus;
  referenceId: string;
  rawResponse: any;
  timestamp: string;
  externalSource?: string;
  confirmations?: number;
  messageId?: string;
}

export interface TestResult {
  internalResult: {
    success: boolean;
    data: any;
    error?: string;
  };
  externalProof: ProofObject | null;
  verdict: TestVerdict;
  reason?: string;
}

/**
 * STRICT PASS RULE:
 * A test is ONLY PASS if BOTH:
 * 1. internalResult.success === true
 * 2. externalProof.status === "verified"
 */
export function determineVerdict(
  internalSuccess: boolean,
  externalProofStatus: VerificationStatus | null,
): TestVerdict {
  if (!internalSuccess) return 'FAIL';
  
  if (!externalProofStatus) {
    return 'INCOMPLETE';
  }

  if (externalProofStatus === 'verified') {
    return 'PASS';
  }

  if (externalProofStatus === 'pending') {
    return 'INCOMPLETE';
  }

  return 'FAIL';
}

/**
 * Safety wrapper - throws if trying to pass without external proof
 */
export function validateTestState(result: TestResult): TestResult {
  if (result.verdict === 'PASS' && !result.externalProof) {
    throw new Error(
      'INVALID TEST STATE: EXTERNAL VERIFICATION REQUIRED\n' +
      'A test cannot PASS without externalProof verification.\n' +
      'If external system is unavailable, verdict must be INCOMPLETE.'
    );
  }

  if (result.verdict === 'PASS' && result.externalProof?.status !== 'verified') {
    throw new Error(
      'INVALID TEST STATE: External proof status must be "verified" for PASS verdict.\n' +
      `Current status: ${result.externalProof?.status}`
    );
  }

  return result;
}

// ============================================================================
// EXTERNAL API VERIFIERS
// ============================================================================

/**
 * Verify blockchain transaction on actual block explorer or RPC node
 */
export async function verifyBlockchainTx(
  chain: string,
  txHash: string,
): Promise<ProofObject> {
  try {
    const explorers: Record<string, string> = {
      ethereum: `https://api.etherscan.io/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}`,
      polygon: `https://api.polygonscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}`,
      base: `https://api.basescan.org/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}`,
      bnb: `https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}`,
    };

    const url = explorers[chain.toLowerCase()];
    if (!url) {
      return {
        type: 'blockchain',
        status: 'unavailable',
        referenceId: txHash,
        rawResponse: { error: 'Explorer not configured for this chain' },
        timestamp: new Date().toISOString(),
      };
    }

    const response = await fetch(url);
    const data = await response.json();

    // Etherscan returns status=1 for success
    const isVerified = data.status === '1' && data.result?.status === '1';

    return {
      type: 'blockchain',
      status: isVerified ? 'verified' : 'failed',
      referenceId: txHash,
      rawResponse: data,
      timestamp: new Date().toISOString(),
      externalSource: `${chain} Block Explorer`,
      confirmations: data.result?.confirmations || 0,
    };
  } catch (error: any) {
    return {
      type: 'blockchain',
      status: 'failed',
      referenceId: txHash,
      rawResponse: { error: error.message },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Cryptographic helper to generate Coinbase Advanced Trade API v3 JWTs.
 */
function generateCoinbaseJWT(keyId: string, secretRaw: string, path: string): string {
  const kid = keyId;
  const alg = 'ES256';
  
  const header = {
    alg,
    kid,
    nonce: crypto.randomBytes(16).toString('hex'),
    typ: 'JWT'
  };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'coinbase-cloud',
    nbf: nowSeconds - 10,
    exp: nowSeconds + 110,
    sub: kid,
    aud: ['direct']
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  let pemKey = secretRaw;
  if (!pemKey.includes('-----BEGIN PRIVATE KEY-----')) {
    pemKey = pemKey.replace(/\\n/g, '\n');
  }

  try {
    const sign = crypto.createSign('SHA256');
    sign.update(unsignedToken);
    sign.end();
    const signatureB64 = sign.sign(pemKey, 'base64url');
    return `${unsignedToken}.${signatureB64}`;
  } catch (err: any) {
    throw new Error(`COINBASE_JWT_SIGNING_FAILED: ${err.message}`);
  }
}

/**
 * Cryptographic helper to generate Kraken private API Signatures (API-Sign).
 */
function generateKrakenSignature(urlPath: string, nonce: string, postData: string, apiSecret: string): string {
  try {
    const secretBuffer = Buffer.from(apiSecret, 'base64');
    const sha256Hash = crypto.createHash('sha256').update(nonce + postData).digest();
    const hmac = crypto.createHmac('sha512', secretBuffer);
    
    hmac.update(urlPath);
    hmac.update(sha256Hash);
    
    return hmac.digest('base64');
  } catch (err) {
    return 'hmac_signature_calculation_error';
  }
}

/**
 * Verify exchange order execution via real API
 */
export async function verifyExchangeOrder(
  exchange: string,
  orderId: string,
  apiKey: string,
  apiSecret: string,
): Promise<ProofObject> {
  try {
    // Coinbase API verification
    if (exchange.toLowerCase() === 'coinbase') {
      const path = `/api/v3/brokerage/orders/historical/${orderId}`;
      const jwt = generateCoinbaseJWT(apiKey, apiSecret, path);
      const response = await fetch(`https://api.coinbase.com${path}`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      });

      const data = await response.json() as any;
      const isVerified = response.ok && (data.order?.order_id === orderId || data.order_id === orderId || data.order?.id === orderId);

      return {
        type: 'exchange',
        status: isVerified ? 'verified' : 'failed',
        referenceId: orderId,
        rawResponse: data,
        timestamp: new Date().toISOString(),
        externalSource: 'Coinbase Advanced Trade API',
      };
    }

    // Kraken API verification
    if (exchange.toLowerCase() === 'kraken') {
      const nonce = Date.now().toString();
      const path = '/0/private/QueryOrders';
      const postData = `nonce=${nonce}&txid=${orderId}`;
      const signature = generateKrakenSignature(path, nonce, postData, apiSecret);

      const response = await fetch(`https://api.kraken.com${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'API-Key': apiKey,
          'API-Sign': signature
        },
        body: postData
      });

      if (response.ok) {
        const data = await response.json() as any;
        const isVerified = data.result && data.result[orderId] !== undefined;
        return {
          type: 'exchange',
          status: isVerified ? 'verified' : 'failed',
          referenceId: orderId,
          rawResponse: data,
          timestamp: new Date().toISOString(),
          externalSource: 'Kraken Private API',
        };
      } else {
        const errText = await response.text();
        return {
          type: 'exchange',
          status: 'failed',
          referenceId: orderId,
          rawResponse: { error: errText },
          timestamp: new Date().toISOString(),
          externalSource: 'Kraken Private API',
        };
      }
    }

    return {
      type: 'exchange',
      status: 'unavailable',
      referenceId: orderId,
      rawResponse: { error: `Exchange ${exchange} verification not configured` },
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      type: 'exchange',
      status: 'failed',
      referenceId: orderId,
      rawResponse: { error: error.message },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Verify email delivery via provider message ID
 */
export async function verifyEmailDelivery(
  messageId: string,
  provider: string,
): Promise<ProofObject> {
  try {
    // MailerSend API verification
    if (provider.toLowerCase() === 'mailersend') {
      const apiKey = process.env.MAILERSEND_API_KEY;
      if (!apiKey) {
        return {
          type: 'email',
          status: 'unavailable',
          referenceId: messageId,
          rawResponse: { error: 'MailerSend API key not configured' },
          timestamp: new Date().toISOString(),
        };
      }

      const response = await fetch(`https://api.mailersend.com/v1/activity?message_id=${messageId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();
      const isVerified = response.ok && data.data && data.data.length > 0;

      return {
        type: 'email',
        status: isVerified ? 'verified' : 'pending',
        referenceId: messageId,
        rawResponse: data,
        timestamp: new Date().toISOString(),
        externalSource: 'MailerSend Activity API',
        messageId,
      };
    }

    // SMTP fallback (limited verification)
    if (provider.toLowerCase() === 'smtp') {
      return {
        type: 'email',
        status: 'pending',
        referenceId: messageId,
        rawResponse: { message: 'SMTP email sent - delivery verification requires external confirmation' },
        timestamp: new Date().toISOString(),
        externalSource: 'SMTP Server',
        messageId,
      };
    }

    return {
      type: 'email',
      status: 'unavailable',
      referenceId: messageId,
      rawResponse: { error: `Provider ${provider} verification not configured` },
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      type: 'email',
      status: 'failed',
      referenceId: messageId,
      rawResponse: { error: error.message },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Verify SMS delivery via Twilio or MailerSend
 */
export async function verifySmsPing(
  messageId: string,
  provider: string,
): Promise<ProofObject> {
  try {
    // Twilio API verification
    if (provider.toLowerCase() === 'twilio') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        return {
          type: 'sms',
          status: 'unavailable',
          referenceId: messageId,
          rawResponse: { error: 'Twilio credentials not configured' },
          timestamp: new Date().toISOString(),
        };
      }

      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageId}.json`,
        {
          headers: { 'Authorization': `Basic ${auth}` },
        },
      );

      const data = await response.json();
      const isVerified = response.ok && data.sid === messageId;

      return {
        type: 'sms',
        status: isVerified ? 'verified' : 'pending',
        referenceId: messageId,
        rawResponse: data,
        timestamp: new Date().toISOString(),
        externalSource: 'Twilio SMS API',
        messageId,
      };
    }

    // MailerSend SMS
    if (provider.toLowerCase() === 'mailersend') {
      return {
        type: 'sms',
        status: 'pending',
        referenceId: messageId,
        rawResponse: { message: 'MailerSend SMS sent - verification in progress' },
        timestamp: new Date().toISOString(),
        externalSource: 'MailerSend SMS API',
        messageId,
      };
    }

    return {
      type: 'sms',
      status: 'unavailable',
      referenceId: messageId,
      rawResponse: { error: `Provider ${provider} verification not configured` },
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      type: 'sms',
      status: 'failed',
      referenceId: messageId,
      rawResponse: { error: error.message },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Verify bank payment via reference ID only
 * (External processor reference is the only verification available)
 */
export async function verifyBankPayment(
  processorReferenceId: string,
  processor: string,
): Promise<ProofObject> {
  // For banking, we can only return the external processor reference
  // Actual verification would require access to bank systems
  return {
    type: 'bank',
    status: processorReferenceId ? 'pending' : 'failed',
    referenceId: processorReferenceId,
    rawResponse: { processor, message: 'Bank payment reference recorded - external processor verification required' },
    timestamp: new Date().toISOString(),
    externalSource: processor,
  };
}

/**
 * Verify ATM voucher via reference code
 */
export async function verifyAtmVoucher(
  voucherRef: string,
  voucherPin: string,
): Promise<ProofObject> {
  // ATM vouchers are verified through ATM network
  // This records the reference for external verification
  return {
    type: 'atm',
    status: 'pending',
    referenceId: voucherRef,
    rawResponse: { voucherRef, pinProvided: !!voucherPin, message: 'ATM voucher issued - redeemable at ATM network' },
    timestamp: new Date().toISOString(),
    externalSource: 'ATM Network',
  };
}

/**
 * Create a test result with validation
 */
export function createTestResult(
  internalSuccess: boolean,
  internalData: any,
  externalProof: ProofObject | null,
  reason?: string,
): TestResult {
  const result: TestResult = {
    internalResult: {
      success: internalSuccess,
      data: internalData,
    },
    externalProof,
    verdict: determineVerdict(internalSuccess, externalProof?.status || null),
    reason,
  };

  return validateTestState(result);
}
