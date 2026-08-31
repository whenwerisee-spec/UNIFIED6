const crypto = require('crypto');
const fs = require('fs');

const keys = [
  "production-encryption-key-32-chars-minimum-value",
  "315985bb5067699f8ffa691448877af63d21782475d1586f0a58462059dafe02"
];

const encryptedFiles = [
  'consolidated_database/ledger_db_coinbase_encrypted.json',
  'consolidated_database/ledger_db_coinbase_encrypted_backup.json'
];

encryptedFiles.forEach((file) => {
  if (!fs.existsSync(file)) {
    console.log(`${file} does not exist`);
    return;
  }
  const encrypted = fs.readFileSync(file, 'utf-8');
  keys.forEach((encryptionKey) => {
    try {
      console.log(`Trying file ${file} with key ${encryptionKey.slice(0, 10)}...`);
      const [ivHex, cipherHex] = encrypted.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = Buffer.from(encryptionKey.slice(0, 32), 'hex').length === 32
        ? Buffer.from(encryptionKey.slice(0, 32), 'hex')
        : crypto.pbkdf2Sync(encryptionKey, 'sovereign_ledger_salt', 100000, 32, 'sha256');
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(cipherHex, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');
      
      const data = JSON.parse(decrypted);
      console.log(`\nSuccessfully decrypted ${file} using key ${encryptionKey.slice(0, 10)}...`);
      console.log("Total entries:", data.entries.length);
      const yieldEntries = data.entries.filter(e => e.payload && (e.payload.action === 'yield.reward' || String(e.payload.action).includes('yield') || String(e.payload.action).includes('reward')));
      console.log("Staking / Yield entries count:", yieldEntries.length);
      console.log("Yield entries detail:", JSON.stringify(yieldEntries, null, 2));
    } catch (err) {
      console.log(`Failed with key ${encryptionKey.slice(0, 10)}: ${err.message}`);
    }
  });
});
