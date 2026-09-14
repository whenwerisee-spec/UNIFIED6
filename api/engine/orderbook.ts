import { OrderBook, OrderBookEntry, TradeTapeItem, Candlestick, AdvancedOrder } from '../../src/types';

export class OrderBookEngine {
  private basePrices: Record<string, number> = {
    'BTC-USD': 64230.50,
    'ETH-USD': 3450.25,
    'SOL-USD': 148.80,
    'AVAX-USD': 28.40,
    'DOGE-USD': 0.125,
    'OP-USD': 1.65,
    'ARB-USD': 0.85,
    'USDF-USD': 1.00,
    'XAUT-USD': 2350.00,
    'LEO-USD': 5.85,
    'POL-USD': 0.52,
    'USDC-USD': 1.00
  };

  private tradeTapes: Record<string, TradeTapeItem[]> = {};
  private activeOrders: AdvancedOrder[] = [];

  constructor() {
    this.seedInitialTrades();
  }

  private seedInitialTrades() {
    for (const [symbol, price] of Object.entries(this.basePrices)) {
      const trades: TradeTapeItem[] = [];
      for (let i = 0; i < 20; i++) {
        const offset = (Math.random() - 0.5) * (price * 0.002);
        const tradePrice = parseFloat((price + offset).toFixed(2));
        const size = parseFloat((Math.random() * (symbol.startsWith('BTC') ? 1.5 : 8)).toFixed(4));
        trades.push({
          id: `tr-${Date.now()}-${i}`,
          price: tradePrice,
          size,
          side: Math.random() > 0.48 ? 'BUY' : 'SELL',
          timestamp: Date.now() - (20 - i) * 8000
        });
      }
      this.tradeTapes[symbol] = trades;
    }
  }

  public getOrderBook(symbol: string): OrderBook {
    const basePrice = this.basePrices[symbol] || 64200.00;
    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];

    // Generate 12 bids below base price
    let bidTotal = 0;
    for (let i = 1; i <= 12; i++) {
      const step = basePrice * 0.0005 * i;
      const price = parseFloat((basePrice - step).toFixed(2));
      const size = parseFloat((0.2 + Math.random() * 1.8).toFixed(4));
      bidTotal += size;
      bids.push({ price, size, total: parseFloat(bidTotal.toFixed(4)) });
    }

    // Generate 12 asks above base price
    let askTotal = 0;
    for (let i = 1; i <= 12; i++) {
      const step = basePrice * 0.0005 * i;
      const price = parseFloat((basePrice + step).toFixed(2));
      const size = parseFloat((0.2 + Math.random() * 1.8).toFixed(4));
      askTotal += size;
      asks.push({ price, size, total: parseFloat(askTotal.toFixed(4)) });
    }

    const spread = asks[0].price - bids[0].price;
    const spreadPercent = (spread / basePrice) * 100;

    return {
      symbol,
      bids,
      asks,
      spread: parseFloat(spread.toFixed(2)),
      spreadPercent: parseFloat(spreadPercent.toFixed(3)),
      lastUpdated: Date.now()
    };
  }

  public getTradeTape(symbol: string): TradeTapeItem[] {
    const list = this.tradeTapes[symbol] || [];
    // Inject dynamic trade
    if (Math.random() > 0.4) {
      const base = this.basePrices[symbol] || 64200;
      const variation = (Math.random() - 0.49) * 0.001 * base;
      const newPrice = parseFloat((base + variation).toFixed(2));
      const newTrade: TradeTapeItem = {
        id: `tr-${Date.now()}`,
        price: newPrice,
        size: parseFloat((Math.random() * 1.2).toFixed(4)),
        side: Math.random() > 0.5 ? 'BUY' : 'SELL',
        timestamp: Date.now()
      };
      this.basePrices[symbol] = newPrice;
      this.tradeTapes[symbol] = [newTrade, ...list.slice(0, 24)];
    }
    return this.tradeTapes[symbol];
  }

  public getCandles(symbol: string, timeframe: string = '1h'): Candlestick[] {
    const base = this.basePrices[symbol] || 64200;
    const count = 30;
    const candles: Candlestick[] = [];
    let currentClose = base * 0.95;

    for (let i = 0; i < count; i++) {
      const open = currentClose;
      const delta = (Math.random() - 0.48) * (base * 0.015);
      const close = parseFloat((open + delta).toFixed(2));
      const high = parseFloat((Math.max(open, close) + Math.random() * (base * 0.008)).toFixed(2));
      const low = parseFloat((Math.min(open, close) - Math.random() * (base * 0.008)).toFixed(2));
      const volume = parseFloat((Math.random() * 45 + 10).toFixed(2));

      candles.push({
        time: Date.now() - (count - i) * 3600 * 1000,
        open,
        high,
        low,
        close,
        volume
      });
      currentClose = close;
    }

    return candles;
  }

  public placeOrder(order: Omit<AdvancedOrder, 'id' | 'filledSize' | 'status' | 'timestamp' | 'fee'>): AdvancedOrder {
    const id = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fee = order.price * order.size * 0.004; // 0.4% taker fee

    const newOrder: AdvancedOrder = {
      ...order,
      id,
      filledSize: order.type === 'MARKET' ? order.size : 0,
      status: order.type === 'MARKET' ? 'FILLED' : 'OPEN',
      timestamp: Date.now(),
      fee: parseFloat(fee.toFixed(2))
    };

    this.activeOrders.unshift(newOrder);

    // If market order, record trade in tape
    if (order.type === 'MARKET') {
      const tapeItem: TradeTapeItem = {
        id: `tr-${Date.now()}`,
        price: order.price,
        size: order.size,
        side: order.side,
        timestamp: Date.now()
      };
      const list = this.tradeTapes[order.symbol] || [];
      this.tradeTapes[order.symbol] = [tapeItem, ...list.slice(0, 24)];
    }

    return newOrder;
  }

  public getOrders(symbol?: string): AdvancedOrder[] {
    if (symbol) {
      return this.activeOrders.filter((o) => o.symbol === symbol);
    }
    return [...this.activeOrders];
  }

  public cancelOrder(orderId: string): boolean {
    const ord = this.activeOrders.find((o) => o.id === orderId);
    if (ord && ord.status === 'OPEN') {
      ord.status = 'CANCELLED';
      return true;
    }
    return false;
  }
}

export const globalOrderBook = new OrderBookEngine();
