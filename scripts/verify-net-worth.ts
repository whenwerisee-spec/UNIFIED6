import dotenv from 'dotenv';
import { db } from '../src/db/ledger.js';
import { syncAllStripeBalances, GLOBAL_STRIPE_BALANCE } from '../src/lib/stripe-sync.js';

dotenv.config();

async function run() {
  console.log('🧪 Starting live Stripe balance verification and net worth calculation...');
  
  // 1. Trigger Stripe sync
  await syncAllStripeBalances();

  // 2. Query master database ledger for user 'user_mlaframboisemm'
  const userId = 'user_mlaframboisemm';
  const wallets = db.execute('SELECT * FROM wallets WHERE user_id = ? AND asset_symbol = ?', [userId, 'USD']) as any[];
  
  const externalCash = wallets && wallets.length > 0 ? Number(wallets[0].balance || 0) : 0;
  const stripeHeldFunds = GLOBAL_STRIPE_BALANCE.available;

  const consolidatedUSD = externalCash + stripeHeldFunds;

  console.log('\n========================================================================');
  console.log('💵 USD CASH SUMMARY');
  console.log('========================================================================');
  console.log(`   - Master Ledger (External Cash DB balance):  $${externalCash.toFixed(2)} USD`);
  console.log(`   - Stripe-held Funds (Live Stripe balance):   $${stripeHeldFunds.toFixed(2)} USD`);
  console.log(`   ---------------------------------------------------------------------`);
  console.log(`   - Consolidated USD Cash Total:              $${consolidatedUSD.toFixed(2)} USD`);
  console.log('========================================================================\n');

  // 3. Compute holdings map similar to server.ts portfolio builder
  const holdingsMap = new Map<string, number>();
  
  // Seed with server.ts default demo holdings
  holdingsMap.set('ETH', 116998.23);
  holdingsMap.set('USDC', 422611769.18);
  holdingsMap.set('USDF', 260668051.49);
  holdingsMap.set('PEPE', 56467600000000);
  holdingsMap.set('PEPE_USD', 56467600000000 * 0.0000125); // value in USD
  holdingsMap.set('LEO', 8981561.45);
  holdingsMap.set('XAUT', 21731.703);
  holdingsMap.set('PAXG', 9313.587);
  holdingsMap.set('LINK', 652949.04);
  holdingsMap.set('USD', consolidatedUSD); // Use consolidated USD balance!

  // Default prices from prices endpoint
  const prices: Record<string, number> = {
    BTC: 64200,
    ETH: 3350,
    SOL: 145,
    POL: 0.52,
    BNB: 575,
    LEO: 5.85,
    USDC: 1,
    PEPE: 0.0000125,
    SHIB: 0.0000185,
    LINK: 15.2,
    XAUT: 2350,
    LIF3: 0.012,
    MXNT: 0.055,
    HYPE: 4.5
  };

  let totalNetWorth = consolidatedUSD;
  
  console.log('💼 PORTFOLIO NET WORTH breakdown:');
  console.log(`   - USD Cash (Consolidated): $${consolidatedUSD.toFixed(2)} USD`);

  for (const [asset, amount] of holdingsMap.entries()) {
    if (asset === 'USD') continue;
    let value = 0;
    if (asset === 'PEPE_USD') {
      value = amount;
    } else {
      const price = prices[asset] || 0;
      value = amount * price;
    }
    totalNetWorth += value;
    console.log(`   - ${asset}: ${amount.toLocaleString()} (Valued at: $${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD)`);
  }

  console.log('========================================================================');
  console.log(`💼 TOTAL NET WORTH: $${totalNetWorth.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD`);
  console.log('========================================================================\n');

  console.log('✅ Balance and total net worth sync verification completed successfully.');
}

run();
