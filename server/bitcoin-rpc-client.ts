/**
 * Bitcoin Core JSON-RPC & Local Node Integration Client
 * For mlaframboisemm-dotcom/unified
 * Connects directly to local Bitcoin Core (bitcoind) via JSON-RPC.
 */

export interface BitcoinRpcConfig {
  url: string;
  rpcUser: string;
  rpcPassword: string;
}

export function getBitcoinRpcConfig(): BitcoinRpcConfig {
  return {
    url: process.env.BITCOIN_RPC_URL || 'http://127.0.0.1:8332',
    rpcUser: process.env.BITCOIN_RPC_USER || 'bitcoinrpc',
    rpcPassword: process.env.BITCOIN_RPC_PASSWORD || 'local_secure_rpc_pass',
  };
}

export async function callBitcoinRpc(method: string, params: any[] = []): Promise<any> {
  const config = getBitcoinRpcConfig();
  const credentials = Buffer.from(`${config.rpcUser}:${config.rpcPassword}`).toString('base64');

  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
    },
    body: JSON.stringify({
      jsonrpc: '1.0',
      id: `unified-btc-${Date.now()}`,
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`Bitcoin RPC HTTP error! status: ${res.status} ${res.statusText}`);
  }

  const json = await res.json() as any;
  if (json.error) {
    throw new Error(`Bitcoin RPC Error: ${json.error.message} (code ${json.error.code})`);
  }

  return json.result;
}

export async function getLocalBitcoinBlockchainInfo() {
  try {
    const info = await callBitcoinRpc('getblockchaininfo', []);
    return {
      connected: true,
      chain: info.chain,
      blocks: info.blocks,
      headers: info.headers,
      verificationprogress: info.verificationprogress,
      pruned: info.pruned,
    };
  } catch (e: any) {
    return {
      connected: false,
      error: e.message,
    };
  }
}
