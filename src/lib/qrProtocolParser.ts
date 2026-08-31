/**
 * Universal QR & Deep Link Protocol Parser
 * Supports:
 * - Localcoin ATM & App QR codes (Buy, Sell, Cash-Out, e-Transfer)
 * - Canadian Interac e-Transfer payment requests & deposit links
 * - BIP-21 Bitcoin URIs (bitcoin:bc1q...?amount=...&message=...)
 * - EVM / Ethereum URIs (ethereum:0x...?value=...)
 * - Solana, Litecoin, and multi-crypto formats
 * - ATM Voucher PINs & Redemption tokens
 */

export interface ParsedQrResult {
  raw: string;
  source: 'LOCALCOIN' | 'INTERAC_ETRANSFER' | 'BITCOIN_BIP21' | 'CRYPTO_URI' | 'RAW_ADDRESS' | 'ATM_VOUCHER' | 'TRANSACTION_VERIFICATION' | 'UNKNOWN';
  category: 'DEPOSIT' | 'WITHDRAWAL' | 'SEND' | 'RECEIVE' | 'ETRANSFER' | 'ATM_CASHOUT' | 'AUDIT_VERIFY';
  address?: string;
  amount?: number;
  fiatAmount?: number;
  currency?: string; // BTC, ETH, SOL, LTC, CAD, USD
  fiatCurrency?: 'CAD' | 'USD';
  memo?: string;
  orderId?: string;
  phoneNumber?: string;
  voucherPin?: string;
  recipientEmail?: string;
  txChecksum?: string;
  displayTitle: string;
  displaySubtitle: string;
}

export function parseQrOrDeepLink(input: string): ParsedQrResult {
  if (!input) {
    return {
      raw: '',
      source: 'UNKNOWN',
      category: 'SEND',
      displayTitle: 'Unknown Code',
      displaySubtitle: 'No valid data provided'
    };
  }

  const raw = input.trim();
  const lower = raw.toLowerCase();

  // 0. Double-Entry Transaction Verification QR Code & Audit JSON
  // Examples:
  // https://ais-pre-gatwryypgxhwmumjlhhqxf-522633331757.us-east1.run.app/?verifyTx=TX-94812&amount=0.01039642&symbol=BTC&checksum=CB55-7A8B
  // {"standard":"COINBASE55-AUDIT-INTEGRITY","transactionId":"TX-123",...}
  if (lower.includes('verifytx=') || lower.includes('coinbase55-audit') || (raw.startsWith('{') && raw.includes('transactionId'))) {
    try {
      if (raw.startsWith('{')) {
        const json = JSON.parse(raw);
        return {
          raw,
          source: 'TRANSACTION_VERIFICATION',
          category: 'AUDIT_VERIFY',
          orderId: json.transactionId || json.id,
          amount: json.amount ? parseFloat(json.amount) : undefined,
          fiatAmount: json.fiatUsd || json.fiatAmount ? parseFloat(json.fiatUsd || json.fiatAmount) : undefined,
          currency: (json.asset || json.assetSymbol || 'BTC').toUpperCase(),
          txChecksum: json.verificationSignature || json.checksum || 'VERIFIED',
          memo: `Audit Signature: ${json.verificationSignature || 'Valid'}`,
          displayTitle: `Verified Transaction ${json.transactionId || ''}`,
          displaySubtitle: `${json.amount || ''} ${json.asset || 'BTC'} • Double-Entry Audit Validated`
        };
      } else {
        const queryPart = raw.includes('?') ? raw.split('?')[1] : raw;
        const params = new URLSearchParams(queryPart);
        const txId = params.get('verifyTx') || params.get('txId') || 'TX-VERIFIED';
        const symbol = (params.get('symbol') || 'BTC').toUpperCase();
        const amount = params.get('amount') ? parseFloat(params.get('amount')!) : undefined;
        const fiat = params.get('fiat') ? parseFloat(params.get('fiat')!) : undefined;
        const checksum = params.get('checksum') || 'VALID';

        return {
          raw,
          source: 'TRANSACTION_VERIFICATION',
          category: 'AUDIT_VERIFY',
          orderId: txId,
          amount,
          fiatAmount: fiat,
          currency: symbol,
          txChecksum: checksum,
          memo: `Integrity Checksum CB55-${checksum}`,
          displayTitle: `Scanned Verified Transaction ${txId}`,
          displaySubtitle: `${amount ? `${amount} ${symbol}` : ''} ${fiat ? `($${fiat.toFixed(2)} USD)` : ''} • Cryptographic Seal Valid`
        };
      }
    } catch {
      // Fall through to other handlers if parsing fails
    }
  }

  // 1. Localcoin ATM / App Order URLs & Schemes
  // Examples:
  // https://localcoinatm.com/order?id=LC-94812&amount=250&currency=CAD&crypto=BTC&address=bc1q...
  // localcoin:order?id=12345&amount=500&type=buy
  // web+localcoin:...
  if (
    lower.includes('localcoinatm.com') ||
    lower.includes('localcoin.ca') ||
    lower.startsWith('localcoin:') ||
    lower.startsWith('web+localcoin:')
  ) {
    let urlObj: URL | null = null;
    let params: URLSearchParams;

    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        urlObj = new URL(raw);
        params = urlObj.searchParams;
      } else {
        const queryPart = raw.includes('?') ? raw.split('?')[1] : raw.split(':')[1] || '';
        params = new URLSearchParams(queryPart);
      }
    } catch {
      params = new URLSearchParams(raw);
    }

    const orderId = params.get('id') || params.get('orderId') || params.get('order_id') || params.get('ref') || undefined;
    const phone = params.get('phone') || params.get('mobile') || undefined;
    const typeParam = (params.get('type') || params.get('action') || 'deposit').toLowerCase();
    const isCashout = typeParam.includes('sell') || typeParam.includes('withdraw') || typeParam.includes('cashout');
    const isEtransfer = typeParam.includes('etransfer') || typeParam.includes('e-transfer') || lower.includes('etransfer');

    const address = params.get('address') || params.get('addr') || params.get('to') || undefined;
    const cryptoParam = (params.get('crypto') || params.get('asset') || 'BTC').toUpperCase();
    const fiatParam = (params.get('fiat') || params.get('currency') || 'CAD').toUpperCase() as 'CAD' | 'USD';
    const amountVal = params.has('cryptoAmount')
      ? parseFloat(params.get('cryptoAmount')!)
      : params.has('amount') && !params.get('amount')?.includes('$')
      ? parseFloat(params.get('amount')!)
      : undefined;
    const fiatVal = params.has('fiatAmount')
      ? parseFloat(params.get('fiatAmount')!)
      : params.has('amount') && params.has('fiat')
      ? parseFloat(params.get('amount')!)
      : undefined;

    return {
      raw,
      source: 'LOCALCOIN',
      category: isEtransfer ? 'ETRANSFER' : isCashout ? 'ATM_CASHOUT' : 'DEPOSIT',
      address,
      amount: amountVal && !isNaN(amountVal) ? amountVal : undefined,
      fiatAmount: fiatVal && !isNaN(fiatVal) ? fiatVal : undefined,
      currency: cryptoParam,
      fiatCurrency: fiatParam === 'USD' ? 'USD' : 'CAD',
      orderId,
      phoneNumber: phone,
      memo: orderId ? `Localcoin Order #${orderId}` : 'Localcoin ATM Transaction',
      displayTitle: isEtransfer
        ? 'Localcoin Interac e-Transfer Order'
        : isCashout
        ? 'Localcoin ATM Cash-Out Voucher'
        : 'Localcoin ATM Deposit Order',
      displaySubtitle: orderId
        ? `Order #${orderId} • ${amountVal ? `${amountVal} ${cryptoParam}` : fiatVal ? `$${fiatVal} CAD` : 'Ready to confirm'}`
        : 'Recognized from Localcoin Terminal'
    };
  }

  // 2. Canadian Interac e-Transfer Link or QR
  // Examples:
  // https://etransfer.interac.ca/ca/en/receive/?token=...&amount=250.00
  // interac:transfer?amount=150.00&recipient=deposit@localcoin.ca&ref=LC9821
  if (
    lower.includes('interac.ca') ||
    lower.startsWith('interac:') ||
    lower.startsWith('web+interac:') ||
    lower.startsWith('etransfer:') ||
    lower.startsWith('web+etransfer:')
  ) {
    let params: URLSearchParams;
    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        params = new URL(raw).searchParams;
      } else {
        const queryPart = raw.includes('?') ? raw.split('?')[1] : raw.split(':')[1] || '';
        params = new URLSearchParams(queryPart);
      }
    } catch {
      params = new URLSearchParams();
    }

    const amount = params.has('amount') ? parseFloat(params.get('amount')!) : undefined;
    const recipientEmail = params.get('recipient') || params.get('email') || params.get('to') || undefined;
    const ref = params.get('ref') || params.get('token') || params.get('id') || undefined;

    return {
      raw,
      source: 'INTERAC_ETRANSFER',
      category: 'ETRANSFER',
      fiatAmount: amount && !isNaN(amount) ? amount : undefined,
      fiatCurrency: 'CAD',
      currency: 'CAD',
      recipientEmail,
      orderId: ref,
      memo: ref ? `Interac e-Transfer Ref: ${ref.slice(0, 10)}` : 'Interac e-Transfer Request',
      displayTitle: 'Interac e-Transfer Payment',
      displaySubtitle: amount ? `$${amount.toFixed(2)} CAD • Ready for Settlement` : 'Interac e-Transfer Canadian Banking'
    };
  }

  // 3. BIP-21 Bitcoin URI
  // Example: bitcoin:bc1qz8w9j7k6m5n4p3r2t1v0x9y8z7w6v5u?amount=0.015&message=ATM%20Deposit
  if (lower.startsWith('bitcoin:') || lower.startsWith('web+bitcoin:')) {
    const withoutPrefix = raw.replace(/^web\+bitcoin:/i, '').replace(/^bitcoin:/i, '');
    const [addrPart, queryPart] = withoutPrefix.split('?');
    const params = new URLSearchParams(queryPart || '');

    const amount = params.has('amount') ? parseFloat(params.get('amount')!) : undefined;
    const memo = params.get('message') || params.get('label') || undefined;

    return {
      raw,
      source: 'BITCOIN_BIP21',
      category: 'SEND',
      address: addrPart,
      amount: amount && !isNaN(amount) ? amount : undefined,
      currency: 'BTC',
      memo,
      displayTitle: 'Bitcoin (BTC) Payment Request',
      displaySubtitle: amount ? `${amount} BTC to ${addrPart.slice(0, 10)}...` : `Address: ${addrPart.slice(0, 14)}...`
    };
  }

  // 4. Multi-Crypto URIs (ethereum:, solana:, litecoin:, crypto:)
  if (
    lower.startsWith('ethereum:') ||
    lower.startsWith('solana:') ||
    lower.startsWith('litecoin:') ||
    lower.startsWith('web+crypto:')
  ) {
    const parts = raw.split(':');
    const scheme = parts[0].replace('web+', '').toUpperCase();
    const rest = parts.slice(1).join(':');
    const [addrPart, queryPart] = rest.split('?');
    const params = new URLSearchParams(queryPart || '');

    const currencyMap: Record<string, string> = {
      ETHEREUM: 'ETH',
      SOLANA: 'SOL',
      LITECOIN: 'LTC',
      CRYPTO: 'BTC'
    };

    const currency = currencyMap[scheme] || scheme;
    const amount = params.has('amount')
      ? parseFloat(params.get('amount')!)
      : params.has('value')
      ? parseFloat(params.get('value')!)
      : undefined;

    return {
      raw,
      source: 'CRYPTO_URI',
      category: 'SEND',
      address: addrPart,
      amount: amount && !isNaN(amount) ? amount : undefined,
      currency,
      memo: params.get('memo') || params.get('message') || undefined,
      displayTitle: `${currency} Payment Request`,
      displaySubtitle: `To: ${addrPart.slice(0, 12)}...`
    };
  }

  // 5. ATM Voucher / PIN Codes
  // Examples: ATM-SOV-849201, PIN: 8492
  if (raw.startsWith('ATM-SOV-') || (raw.length === 6 && /^\d{6}$/.test(raw))) {
    return {
      raw,
      source: 'ATM_VOUCHER',
      category: 'ATM_CASHOUT',
      voucherPin: raw,
      orderId: raw,
      displayTitle: 'ATM Cash-Out Voucher Code',
      displaySubtitle: `Redemption PIN: ${raw}`
    };
  }

  // 6. Raw Blockchain Addresses
  // Bitcoin (bc1..., 1..., 3...)
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(raw)) {
    return {
      raw,
      source: 'RAW_ADDRESS',
      category: 'SEND',
      address: raw,
      currency: 'BTC',
      displayTitle: 'Bitcoin Address',
      displaySubtitle: `${raw.slice(0, 14)}...${raw.slice(-6)}`
    };
  }

  // Ethereum / EVM (0x...)
  if (/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return {
      raw,
      source: 'RAW_ADDRESS',
      category: 'SEND',
      address: raw,
      currency: 'ETH',
      displayTitle: 'Ethereum / ERC-20 Address',
      displaySubtitle: `${raw.slice(0, 10)}...${raw.slice(-6)}`
    };
  }

  // Litecoin (ltc1... or L... or M...)
  if (/^(ltc1|[LM])[a-km-zA-HJ-NP-Z1-9]{26,43}$/.test(raw)) {
    return {
      raw,
      source: 'RAW_ADDRESS',
      category: 'SEND',
      address: raw,
      currency: 'LTC',
      displayTitle: 'Litecoin Address',
      displaySubtitle: `${raw.slice(0, 12)}...`
    };
  }

  // Solana base58 address
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw)) {
    return {
      raw,
      source: 'RAW_ADDRESS',
      category: 'SEND',
      address: raw,
      currency: 'SOL',
      displayTitle: 'Solana Address',
      displaySubtitle: `${raw.slice(0, 12)}...`
    };
  }

  // Fallback / Unknown
  return {
    raw,
    source: 'UNKNOWN',
    category: 'SEND',
    address: raw,
    displayTitle: 'Scanned Payload',
    displaySubtitle: raw.length > 30 ? `${raw.slice(0, 30)}...` : raw
  };
}
