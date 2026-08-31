const fs = require('fs');
const https = require('https');

const DEFAULT_URL = process.env.SOV_TERMINAL_URL || "https://ais-dev-vsguby4cvne7edjk3z4bzv-522633331757.us-east1.run.app";

function sanitizeValue(v) {
  return String(v).replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');
}

function askMasked(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let input = '';

    function onData(ch) {
      const char = String(ch);
      if (char === '\r' || char === '\n') {
        stdout.write('\n');
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        resolve(input);
        return;
      }
      if (char === '\u0003') { // Ctrl-C
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        reject(new Error('Interrupted'));
        return;
      }
      if (char === '\u0008' || char === '\u007f') { // backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          stdout.write('\b \b');
        }
        return;
      }
      input += char;
      stdout.write('*');
    }

    stdin.on('data', onData);
  });
}

async function main() {
  try {
    console.log('\x1b[33m%s\x1b[0m', '=== MARSHALL SOVEREIGN CREDENTIAL SYNCER ===');

    const terminalUrl = (process.env.SOV_TERMINAL_URL || DEFAULT_URL).replace(/\/$/, '');

    const pinFromEnv = process.env.SOV_PIN && String(process.env.SOV_PIN).trim();
    let pin = pinFromEnv;

    if (!pin) {
      pin = await askMasked(`Enter your 6-digit Sovereign Security PIN: `);
    }

    if (!/^\d{6}$/.test(pin)) {
      console.error('\x1b[31m%s\x1b[0m', '❌ Error: PIN must be exactly 6 digits.');
      process.exit(1);
    }

    if (!terminalUrl.startsWith('https://')) {
      console.error('\x1b[31m%s\x1b[0m', '❌ Error: terminal URL must be https://');
      process.exit(1);
    }

    console.log('\x1b[36m%s\x1b[0m', `Connecting to ${terminalUrl}/api/security/export-keys...`);

    const payload = JSON.stringify({ pin });
    const urlObj = new URL(`${terminalUrl}/api/security/export-keys`);

    const req = https.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 200 && result && result.success && result.keys && typeof result.keys === 'object') {
            try {
              if (fs.existsSync('.env')) {
                const bakName = `.env.bak.${Date.now()}`;
                fs.copyFileSync('.env', bakName);
                console.log('\x1b[33m%s\x1b[0m', `Existing .env backed up to ${bakName}`);
              }

              let envContent = `# =========================================================================\n`;
              envContent += `# CREDENTIALS IMPORTED PROGRAMMATICALLY FROM SOVEREIGN TERMINAL\n`;
              envContent += `# Imported: ${new Date().toISOString()}\n`;
              envContent += `# =========================================================================\n\n`;

              for (const [key, value] of Object.entries(result.keys)) {
                const safe = sanitizeValue(value);
                envContent += `${key}="${safe}"\n`;
              }

              fs.writeFileSync('.env', envContent, { encoding: 'utf8', mode: 0o600 });
              console.log('\x1b[32m%s\x1b[0m', '✔ Success! Your local .env file has been updated securely with all active keys.');
            } catch (e) {
              console.error('\x1b[31m%s\x1b[0m', '❌ Error writing .env file:', e.message || e);
            }
          } else {
            console.error('\x1b[31m%s\x1b[0m', `❌ Sync Failed: ${result && result.error ? result.error : 'Invalid credentials or status code.'}`);
          }
        } catch (e) {
          console.error('\x1b[31m%s\x1b[0m', '❌ Error parsing server response:', e.message);
          console.log('Server Status Code:', res.statusCode);
          console.log('Response Headers:', res.headers);
          console.log('Raw Response (first 500 chars):', data.substring(0, 500));
        }
      });
    });

    req.on('error', (e) => {
      console.error('\x1b[31m%s\x1b[0m', `❌ Network Connection Error: ${e.message}`);
    });

    req.write(payload);
    req.end();

  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Interrupted or unexpected error:', err.message || err);
    process.exit(1);
  }
}

if (require.main === module) main();
