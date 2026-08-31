/**
 * Transak Integration Service
 * Handles on-ramp, KYC states, and webhook mapping for the Unified Finance Hub.
 */

export interface TransakOrder {
  id: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  walletAddress: string;
  fiatAmount: number;
  fiatCurrency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  network: string;
  userId: string;
}

export interface TransakKycStatus {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  reason?: string;
  level: number;
}

/**
 * Maps Transak webhook events to internal system events.
 */
export function mapTransakEventToInternal(eventType: string, payload: any) {
  switch (eventType) {
    case 'ORDER_COMPLETED':
      return {
        type: 'TRANSACTION_SUCCESS',
        details: `Transak On-Ramp Completed: ${payload.cryptoAmount} ${payload.cryptoCurrency}`
      };
    case 'ORDER_FAILED':
      return {
        type: 'TRANSACTION_FAILURE',
        details: `Transak On-Ramp Failed: ${payload.statusReason || 'Unknown error'}`
      };
    case 'KYC_COMPLETED':
      return {
        type: 'IDENTITY_UPGRADE',
        details: `Transak KYC Approved for level ${payload.level || 1}`
      };
    default:
      return {
        type: 'EXTERNAL_SERVICE_EVENT',
        details: `Transak Event: ${eventType}`
      };
  }
}

/**
 * Generates the Transak Widget URL for on-ramping.
 */
export function getTransakWidgetUrl(params: {
  userId: string;
  walletAddress: string;
  fiatAmount?: number;
  defaultCrypto?: string;
  network?: string;
}) {
  const apiKey = process.env.TRANSAK_API_KEY || 'staging-key';
  const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'STAGING';
  const baseUrl = environment === 'PRODUCTION'
    ? 'https://global.transak.com'
    : 'https://staging-global.transak.com';

  const url = new URL(baseUrl);
  url.searchParams.append('apiKey', apiKey);
  url.searchParams.append('partnerCustomerId', params.userId);
  url.searchParams.append('walletAddress', params.walletAddress);

  if (params.fiatAmount) url.searchParams.append('fiatAmount', params.fiatAmount.toString());
  if (params.defaultCrypto) url.searchParams.append('defaultCryptoCurrency', params.defaultCrypto);
  if (params.network) url.searchParams.append('network', params.network);

  url.searchParams.append('themeColor', '0f172a'); // Sovereign Dark

  return url.toString();
}
