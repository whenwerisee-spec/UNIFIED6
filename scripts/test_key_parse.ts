import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

function run() {
  const privateKey = process.env.COINBASE_API_SECRET_RAW || '';
  console.log('Original length:', privateKey.length);
  console.log('Original start:', JSON.stringify(privateKey.slice(0, 40)));
  console.log('Original end:', JSON.stringify(privateKey.slice(-40)));
  
  let formattedKey = privateKey;
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
    formattedKey = formattedKey.slice(1, -1);
    console.log('Trimmed quotes. Length now:', formattedKey.length);
  }
  formattedKey = formattedKey.replace(/\\n/g, '\n');
  console.log('Replaced newlines. Length now:', formattedKey.length);
  console.log('Formatted start:', JSON.stringify(formattedKey.slice(0, 40)));
  console.log('Formatted end:', JSON.stringify(formattedKey.slice(-40)));

  try {
    const keyObj = crypto.createPrivateKey({
      key: formattedKey,
      format: 'pem'
    });
    console.log('Key parsed successfully as PEM!');
    console.log('Key type:', keyObj.type);
    console.log('Key asymmetricKeyType:', keyObj.asymmetricKeyType);
  } catch (err: any) {
    console.error('Failed to parse key:', err.message);
  }
}

run();
