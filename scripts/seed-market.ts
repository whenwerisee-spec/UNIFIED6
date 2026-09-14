import { globalOrderBook } from '../api/engine/orderbook';

console.log('--- SEEDING COINBASE LEVEL-2 ORDER BOOK ENGINE ---');
const btcBook = globalOrderBook.getOrderBook('BTC-USD');
console.log(`BTC-USD Spread: $${btcBook.spread} (${btcBook.spreadPercent}%)`);
console.log(`Bids count: ${btcBook.bids.length}, Top Bid: $${btcBook.bids[0]?.price}`);
console.log(`Asks count: ${btcBook.asks.length}, Top Ask: $${btcBook.asks[0]?.price}`);
console.log('Order Book Engine Ready.');
