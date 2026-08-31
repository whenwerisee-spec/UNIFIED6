import crypto from 'crypto';
import * as bitcoin from 'bitcoinjs-lib';
import * as tinysecp from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import QRCode from 'qrcode';

bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

export interface BitcoinInvoiceRecord {
  orderId: string;
  amountBTC: number;
  address: string;
  createdAt: number;
  expiresAt: number;
  status?: 'pending' | 'paid';
  amountReceived?: number;
  paidAt?: number;
}

export interface BitcoinInvoiceResult {
  invoice: BitcoinInvoiceRecord;
  qr: string;
  uri: string;
}

export interface MempoolAddressStats {
  chain_stats?: {
    funded_txo_count?: number;
    funded_txo_sum?: number;
  };
}

const SATOSHIS_PER_BTC = 100_000_000;
const orders = new Map<string, BitcoinInvoiceRecord>();

export function createOrder(orderId: string, amountBTC: number, address: string): BitcoinInvoiceRecord {
  const record: BitcoinInvoiceRecord = {
    orderId,
    amountBTC,
    address,
    createdAt: Date.now(),
    expiresAt: Date.now() + (30 * 60 * 1000),
    status: 'pending'
  };

  orders.set(orderId, record);
  return record;
}

export function markPaid(orderId: string, amountReceived: number): BitcoinInvoiceRecord | undefined {
  const order = orders.get(orderId);
  if (!order) {
    return undefined;
  }

  order.status = 'paid';
  order.amountReceived = Number(amountReceived.toFixed(8));
  order.paidAt = Date.now();
  orders.set(orderId, order);
  return order;
}

export function getOrder(orderId: string): BitcoinInvoiceRecord | undefined {
  return orders.get(orderId);
}

export async function createBitcoinInvoice(amountBtc: number, addressOverride?: string): Promise<BitcoinInvoiceResult> {
  const amount = Number(amountBtc);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Bitcoin invoice amount must be a positive number.');
  }

  const network = bitcoin.networks.bitcoin;
  const keyPair = ECPair.makeRandom({ network });
  const payment = bitcoin.payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network
  });

  if (!payment.address) {
    throw new Error('Failed to generate a Bitcoin receiving address for the invoice.');
  }

  const address = addressOverride || payment.address;
  const createdAt = Date.now();
  const expiresAt = createdAt + (30 * 60 * 1000);
  const orderId = crypto.randomUUID();

  const invoice: BitcoinInvoiceRecord = {
    orderId,
    amountBTC: Number(amount.toFixed(8)),
    address,
    createdAt,
    expiresAt,
    status: 'pending'
  };

  orders.set(orderId, invoice);

  const uri = `bitcoin:${address}?amount=${invoice.amountBTC.toFixed(8).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '')}`;
  const qr = await QRCode.toDataURL(uri);

  return { invoice, qr, uri };
}

export async function checkBitcoinInvoiceConfirmation(
  address: string,
  expectedAmount: number,
  statsOverride?: MempoolAddressStats
): Promise<{ confirmed: boolean; amountReceived: number; address: string; expectedAmount: number; }> {
  const normalizedAddress = String(address || '').trim();
  const normalizedExpected = Number(expectedAmount || 0);

  if (!normalizedAddress) {
    return {
      confirmed: false,
      amountReceived: 0,
      address: '',
      expectedAmount: normalizedExpected
    };
  }

  let stats: MempoolAddressStats;

  if (statsOverride) {
    stats = statsOverride;
  } else {
    const response = await fetch(`https://mempool.space/api/address/${encodeURIComponent(normalizedAddress)}`);
    if (!response.ok) {
      throw new Error(`Mempool API error: ${response.status}`);
    }
    stats = await response.json() as MempoolAddressStats;
  }

  const fundedSats = Number(stats?.chain_stats?.funded_txo_sum ?? 0);
  const amountReceived = fundedSats / SATOSHIS_PER_BTC;

  return {
    confirmed: amountReceived >= normalizedExpected,
    amountReceived,
    address: normalizedAddress,
    expectedAmount: normalizedExpected
  };
}

export async function checkBTCConfirmation(address: string, expectedAmount: number): Promise<{ confirmed: boolean; amountReceived: number }> {
  const result = await checkBitcoinInvoiceConfirmation(address, expectedAmount);
  return {
    confirmed: result.confirmed,
    amountReceived: result.amountReceived
  };
}

export function pollBitcoinInvoice(
  address: string,
  amount: number,
  orderId: string,
  onStatus: (data: any) => void,
  onConfirmed?: (data: any) => void
): number {
  const interval = window.setInterval(async () => {
    try {
      const response = await fetch(`/api/confirm?address=${encodeURIComponent(address)}&amount=${encodeURIComponent(String(amount))}&orderId=${encodeURIComponent(orderId)}`);
      const data = await response.json();
      onStatus(data);

      if (data?.confirmed) {
        onConfirmed?.(data);
        window.clearInterval(interval);
      }
    } catch (error) {
      console.error('[BTC-POLL] Failed to confirm BTC invoice.', error);
    }
  }, 5000);

  return interval;
}
