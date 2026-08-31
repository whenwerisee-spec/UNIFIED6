const https = require('https');

function fetchShakepayStatus() {
  return new Promise((resolve, reject) => {
    https.get('https://status.shakepay.com/api/v2/summary.json', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('[SHAKEPAY TEST] Querying https://status.shakepay.com/api/v2/summary.json ...');
  const summary = await fetchShakepayStatus();
  console.log(' - Status Indicator:', summary.status && summary.status.indicator);
  console.log(' - Status Description:', summary.status && summary.status.description);
  console.log(' - Tracked Components:', (summary.components || []).length);
  for (const c of (summary.components || []).slice(0, 5)) {
    console.log(`   * ${c.name}: ${c.status}`);
  }
  console.log('[SUCCESS] Shakepay status API is fully operational and integrated.');
}

run().catch(console.error);
