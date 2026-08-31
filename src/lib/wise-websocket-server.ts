import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { getWiseTotalCashUSD } from './wise-live-integration.js';

interface WiseClientConnection {
  ws: WebSocket;
  ip: string;
  connectedAt: Date;
  isAlive: boolean;
}

const connectedClients = new Set<WiseClientConnection>();
let wssInstance: WebSocketServer | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

export async function fetchFormattedWiseBalances() {
  try {
    const result = await getWiseTotalCashUSD();
    return {
      success: true,
      source: 'wise_live_ws',
      profileName: 'Marcel laframboise',
      businessName: result.businessName || 'sovereigns',
      profileId: result.profileId || 101924589,
      accountNumber: result.accountNumber || '176576596814061',
      routingNumber: result.routingNumber || '084009519',
      bankName: result.bankName || 'Wise US Inc (Wilmington, DE, USA)',
      cadBalance: result.cadBalance,
      usdBalance: result.usdBalance,
      totalUSD: result.totalUSD,
      cadToUsdRate: result.cadRate,
      balances: result.balances || [],
      fetchedAt: new Date().toISOString()
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'WISE_WS_FETCH_FAILED',
      message: err.message || 'Failed to fetch live Wise balances',
      fetchedAt: new Date().toISOString()
    };
  }
}

export function broadcastWiseBalanceUpdate(data?: any) {
  if (connectedClients.size === 0) return;

  const prepareAndSend = async () => {
    const payload = data || (await fetchFormattedWiseBalances());
    const message = JSON.stringify({
      type: 'WISE_BALANCES_UPDATE',
      data: payload,
      clientCount: connectedClients.size,
      timestamp: new Date().toISOString()
    });

    for (const client of connectedClients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  };

  prepareAndSend().catch(e => console.warn('[WiseWS] Broadcast error:', e));
}

export function initWiseWebSocketServer(server: HttpServer) {
  if (wssInstance) {
    console.log('[WiseWS] Server already initialized.');
    return wssInstance;
  }

  wssInstance = new WebSocketServer({
    server,
    path: '/api/ws/wise'
  });

  console.log('[WiseWS] Real-Time Wise WebSocket Server mounted at /api/ws/wise');

  wssInstance.on('connection', async (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    const client: WiseClientConnection = {
      ws,
      ip: clientIp,
      connectedAt: new Date(),
      isAlive: true
    };

    connectedClients.add(client);
    console.log(`[WiseWS] Client connected from ${clientIp}. Total active listeners: ${connectedClients.size}`);

    // Ping / Pong handling
    ws.on('pong', () => {
      client.isAlive = true;
    });

    // Send initial snapshot immediately upon connection
    try {
      const initialBalances = await fetchFormattedWiseBalances();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'INITIAL_WISE_BALANCES',
          data: initialBalances,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (err) {
      console.warn('[WiseWS] Failed to send initial balance snapshot:', err);
    }

    // Handle incoming client messages
    ws.on('message', async (rawMsg: string | Buffer) => {
      try {
        const parsed = JSON.parse(rawMsg.toString());
        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        } else if (parsed.type === 'REFRESH' || parsed.type === 'REQUEST_WISE_BALANCES') {
          const freshData = await fetchFormattedWiseBalances();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'WISE_BALANCES_UPDATE',
              data: freshData,
              timestamp: new Date().toISOString()
            }));
          }
        }
      } catch (err) {
        // invalid json ignored
      }
    });

    ws.on('close', () => {
      connectedClients.delete(client);
      console.log(`[WiseWS] Client disconnected. Total active listeners: ${connectedClients.size}`);
    });

    ws.on('error', (err) => {
      console.warn('[WiseWS] Socket error:', err.message);
      connectedClients.delete(client);
    });
  });

  // Heartbeat ping interval every 30 seconds
  heartbeatTimer = setInterval(() => {
    for (const client of connectedClients) {
      if (!client.isAlive) {
        client.ws.terminate();
        connectedClients.delete(client);
        continue;
      }
      client.isAlive = false;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    }
  }, 30000);

  // Background polling timer every 10 seconds to keep connected clients fresh
  pollTimer = setInterval(async () => {
    if (connectedClients.size > 0) {
      await broadcastWiseBalanceUpdate();
    }
  }, 10000);

  return wssInstance;
}

export function stopWiseWebSocketServer() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (pollTimer) clearInterval(pollTimer);
  if (wssInstance) {
    wssInstance.close();
    wssInstance = null;
  }
  connectedClients.clear();
}
