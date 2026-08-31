import * as bitcoin from 'bitcoinjs-lib';
import * as tinysecp from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

type BitcoinNetworkName = 'mainnet' | 'testnet';

interface BitcoinUtxo {
  txid: string;
  vout: number;
  valueSats: number;
}

export interface BitcoinSendRequest {
  amountBtc: number;
  recipientAddress: string;
  requestId: string;
}

export interface BitcoinSendResult {
  txid: string;
  sourceAddress: string;
  recipientAddress: string;
  amountBtc: number;
  feeSats: number;
  network: BitcoinNetworkName;
}

export interface BitcoinTransactionStatus {
  confirmed: boolean;
  blockHeight?: number;
  blockHash?: string;
  blockTime?: number;
}

function getNetwork(): bitcoin.Network {
  return process.env.BTC_NETWORK === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
}

function getNetworkName(): BitcoinNetworkName {
  return process.env.BTC_NETWORK === 'testnet' ? 'testnet' : 'mainnet';
}

function getEsploraBaseUrl(): string {
  return getNetworkName() === 'testnet' 
    ? 'https://mempool.space/testnet/api' 
    : 'https://mempool.space/api';
}

async function getFeeRateSatsPerVbyte(): Promise<number> {
  const configuredFeeRate = String(process.env.BTC_FEE_RATE_SAT_VB || '').trim();
  const feeRate = Number(configuredFeeRate);
  if (!configuredFeeRate) {
    try {
      const response = await fetch(`${getEsploraBaseUrl().replace(/\/api$/, '')}/api/v1/fees/recommended`);
      if (response.ok) {
        const payload = await response.json() as { halfHourFee?: number; hourFee?: number };
        const recommendedFee = Number(payload.halfHourFee ?? payload.hourFee);
        if (Number.isFinite(recommendedFee) && recommendedFee > 0 && recommendedFee <= 10_000) {
          return recommendedFee;
        }
      }
    } catch {
      // Use the conservative local fallback when the public fee service is unavailable.
    }
  }
  if (!Number.isFinite(feeRate) || feeRate <= 0 || feeRate > 10_000) {
    return 5;
  }
  return feeRate;
}

export async function getBitcoinTransactionStatus(txid: string): Promise<BitcoinTransactionStatus> {
  if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
    throw new Error('Invalid Bitcoin transaction ID.');
  }

  const response = await fetch(`${getEsploraBaseUrl()}/tx/${txid}/status`);
  if (!response.ok) {
    throw new Error(`Failed to query Bitcoin transaction status (HTTP ${response.status}).`);
  }

  const status = await response.json() as {
    confirmed?: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  return {
    confirmed: status.confirmed === true,
    ...(typeof status.block_height === 'number' ? { blockHeight: status.block_height } : {}),
    ...(typeof status.block_hash === 'string' ? { blockHash: status.block_hash } : {}),
    ...(typeof status.block_time === 'number' ? { blockTime: status.block_time } : {})
  };
}

function btcToSats(amountBtc: number): number {
  if (!Number.isFinite(amountBtc) || amountBtc <= 0) throw new Error('BTC amount must be greater than zero.');
  const sats = Math.round(amountBtc * 100_000_000);
  if (sats <= 0) throw new Error('BTC amount is below one satoshi.');
  return sats;
}

/**
 * Fetch spendable UTXOs for a SegWit address via RPC or public Esplora API
 */
async function fetchUtxos(address: string): Promise<BitcoinUtxo[]> {
  const rpcUrl = String(process.env.BTC_RPC_URL || '').trim();
  if (rpcUrl) {
    try {
      const user = process.env.BTC_RPC_USER;
      const password = process.env.BTC_RPC_PASSWORD;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user && password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
      }
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '1.0', id: `utxo-${Date.now()}`, method: 'listunspent', params: [1, 9999999, [address]] })
      });
      if (response.ok) {
        const payload = await response.json() as any;
        if (payload?.result && Array.isArray(payload.result)) {
          return payload.result
            .filter((u: any) => u.spendable !== false && u.amount > 0)
            .map((u: any) => ({
              txid: u.txid,
              vout: u.vout,
              valueSats: Math.round(u.amount * 100_000_000)
            }));
        }
      }
    } catch (e) {
      console.warn('[BTC_RPC] RPC listunspent failed, falling back to public Esplora API:', e);
    }
  }

  // Public Esplora fallback (zero setup required)
  const esploraUrl = `${getEsploraBaseUrl()}/address/${address}/utxo`;
  const res = await fetch(esploraUrl);
  if (!res.ok) {
    throw new Error(`Failed to query Bitcoin UTXOs (HTTP ${res.status}).`);
  }
  const utxos = await res.json() as any[];
  return (utxos || [])
    .filter((u) => u.status?.confirmed && u.value > 0)
    .map((u) => ({
      txid: u.txid,
      vout: u.vout,
      valueSats: u.value
    }));
}

/**
 * Broadcast signed raw transaction hex to Bitcoin network via RPC or public broadcast relays
 */
async function broadcastRawTx(rawTxHex: string): Promise<string> {
  const rpcUrl = String(process.env.BTC_RPC_URL || '').trim();
  if (rpcUrl) {
    try {
      const user = process.env.BTC_RPC_USER;
      const password = process.env.BTC_RPC_PASSWORD;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user && password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
      }
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '1.0', id: `send-${Date.now()}`, method: 'sendrawtransaction', params: [rawTxHex] })
      });
      if (response.ok) {
        const payload = await response.json() as any;
        if (payload?.result && typeof payload.result === 'string') {
          return payload.result;
        }
      }
    } catch (e) {
      console.warn('[BTC_RPC] RPC broadcast failed, attempting public network broadcast:', e);
    }
  }

  // Fallback 1: Mempool.space / Esplora public broadcast
  const broadcastUrl = `${getEsploraBaseUrl()}/tx`;
  const postRes = await fetch(broadcastUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: rawTxHex
  });

  if (postRes.ok) {
    const txid = (await postRes.text()).trim();
    if (txid && txid.length === 64) {
      return txid;
    }
  }

  // Fallback 2: Blockstream API public broadcast
  const blockstreamUrl = getNetworkName() === 'testnet'
    ? 'https://blockstream.info/testnet/api/tx'
    : 'https://blockstream.info/api/tx';
  const bsRes = await fetch(blockstreamUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: rawTxHex
  });
  if (bsRes.ok) {
    const txid = (await bsRes.text()).trim();
    if (txid && txid.length === 64) {
      return txid;
    }
  }

  throw new Error('Bitcoin broadcast failed across all configured RPC and public endpoints.');
}

export async function sendBitcoinNative(request: BitcoinSendRequest): Promise<BitcoinSendResult> {
  if (process.env.BTC_ENABLE_BROADCAST !== 'true') {
    throw new Error('Bitcoin broadcast is disabled. Set BTC_ENABLE_BROADCAST=true in environment.');
  }

  const wif = String(process.env.BTC_SIGNING_WIF || '').trim();
  const sourceAddress = String(process.env.BTC_SOURCE_ADDRESS || '').trim();
  if (!wif || !sourceAddress) {
    throw new Error('BTC_SIGNING_WIF and BTC_SOURCE_ADDRESS are required.');
  }

  const network = getNetwork();
  const networkName = getNetworkName();
  const keyPair = ECPair.fromWIF(wif, network);
  const derivedPayment = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey), network });
  if (!derivedPayment.address || derivedPayment.address !== sourceAddress) {
    throw new Error('BTC_SOURCE_ADDRESS does not match configured BTC_SIGNING_WIF.');
  }

  try {
    const recipientScript = bitcoin.address.toOutputScript(request.recipientAddress, network);
    if (!recipientScript.length) throw new Error('Bitcoin recipient address produced an empty script.');
  } catch {
    throw new Error('Invalid Bitcoin recipient address for configured network.');
  }

  const targetSats = btcToSats(request.amountBtc);
  const feeRate = await getFeeRateSatsPerVbyte();
  const utxos = await fetchUtxos(sourceAddress);
  if (!utxos || utxos.length === 0) {
    throw new Error('No confirmed spendable BTC UTXOs were found for BTC_SOURCE_ADDRESS.');
  }

  let selected: BitcoinUtxo[] = [];
  let selectedSats = 0;
  let feeSats = 0;
  for (const utxo of utxos.sort((a, b) => b.valueSats - a.valueSats)) {
    selected.push(utxo);
    selectedSats += utxo.valueSats;
    const outputCount = 2;
    const estimatedVbytes = 10 + selected.length * 68 + outputCount * 31;
    feeSats = Math.ceil(estimatedVbytes * feeRate);
    if (selectedSats >= targetSats + feeSats) break;
  }
  if (selectedSats < targetSats + feeSats) {
    throw new Error(`Insufficient confirmed BTC UTXOs. Required ${targetSats + feeSats} sats, available ${selectedSats} sats.`);
  }

  const psbt = new bitcoin.Psbt({ network });
  for (const utxo of selected) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: derivedPayment.output!,
        value: BigInt(utxo.valueSats)
      }
    });
  }

  psbt.addOutput({ address: request.recipientAddress, value: BigInt(targetSats) });
  const changeSats = selectedSats - targetSats - feeSats;
  if (changeSats >= 546) {
    psbt.addOutput({ address: sourceAddress, value: BigInt(changeSats) });
  } else {
    feeSats += Math.max(0, changeSats);
  }

  for (let i = 0; i < selected.length; i++) {
    psbt.signInput(i, keyPair);
  }
  psbt.finalizeAllInputs();
  const rawTransactionHex = psbt.extractTransaction().toHex();
  const txid = await broadcastRawTx(rawTransactionHex);

  return {
    txid,
    sourceAddress,
    recipientAddress: request.recipientAddress,
    amountBtc: targetSats / 100_000_000,
    feeSats,
    network: networkName
  };
}
