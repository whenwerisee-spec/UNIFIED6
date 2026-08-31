const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('sovereigns_interbank_vault.db');

db.all('SELECT id, name, email, kycLevel, citizenship FROM users WHERE email = ?', ['whenwerisee@gmail.com'], (err, user) => {
  if (err) { console.error('Error:', err); db.close(); return; }
  console.log('=== YOUR ACCOUNT ===');
  console.log(JSON.stringify(user, null, 2));
  
  if (user && user.length > 0) {
    db.all('SELECT id, user_id, asset_symbol, balance, public_address_ethereum, public_address_bitcoin FROM wallets WHERE user_id = ?', [user[0].id], (err, wallets) => {
      if (err) { console.error('Error:', err); }
      console.log('\n=== YOUR ASSETS ===');
      if (wallets && wallets.length > 0) {
        wallets.forEach(w => {
          console.log('  ' + w.asset_symbol + ': ' + w.balance);
        });
        console.log('\nDetailed:', JSON.stringify(wallets, null, 2));
      } else {
        console.log('  No assets found');
      }
      db.close();
    });
  } else {
    console.log('User not found');
    db.close();
  }
});
