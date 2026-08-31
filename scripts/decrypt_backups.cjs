const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keys = [
  "production-encryption-key-32-chars-minimum-value",
  "315985bb5067699f8ffa691448877af63d21782475d1586f0a58462059dafe02"
];

const backupDir = 'backups';
if (!fs.existsSync(backupDir)) {
  console.log('backups directory does not exist');
  process.exit(0);
}

const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
console.log(`Found ${files.length} backups in ${backupDir}.`);

files.forEach((file) => {
  const filePath = path.join(backupDir, file);
  const encrypted = fs.readFileSync(filePath, 'utf-8');
  
  keys.forEach((encryptionKey) => {
    try {
      const [ivHex, cipherHex] = encrypted.split(':');
      if (!ivHex || !cipherHex) return;
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
      if (yieldEntries.length > 0) {
        console.log("Yield entries detail:", JSON.stringify(yieldEntries, null, 2));
      }
    } catch (err) {
      // wrong key, ignore
    }
  });
});
