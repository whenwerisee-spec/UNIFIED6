const crypto = require('crypto');
const fs = require('fs');

const encryptionKey = "production-encryption-key-32-chars-minimum-value";
const encrypted = fs.readFileSync('ledger_db.json', 'utf-8');

try {
  const [ivHex, cipherHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(encryptionKey.slice(0, 32), 'hex').length === 32
    ? Buffer.from(encryptionKey.slice(0, 32), 'hex')
    : crypto.pbkdf2Sync(encryptionKey, 'sovereign_ledger_salt', 100000, 32, 'sha256');
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(cipherHex, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  
  const data = JSON.parse(decrypted);
  console.log(JSON.stringify(data, null, 2));
} catch (err) {
  console.error('Decryption failed:', err.message);
}
