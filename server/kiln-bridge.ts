import crypto from 'crypto';
import fs from 'fs';
import { exec } from 'child_process';
import fetch from 'node-fetch';

export interface IKilnBridge {
  signPayload(payload: string): Promise<string>;
  getKid?(): string;
}

class HttpKilnBridge implements IKilnBridge {
  private url: string;
  constructor(url: string) {
    this.url = url;
  }
  async signPayload(payload: string): Promise<string> {
    const res = await fetch(this.url, { method: 'POST', body: JSON.stringify({ payload }), headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`Kiln HTTP bridge responded ${res.status}`);
    const json = (await res.json()) as { signature?: unknown };
    if (!json?.signature) throw new Error('Kiln HTTP bridge returned no signature');
    return String(json.signature);
  }
}

class CliKilnBridge implements IKilnBridge {
  private cmdTemplate: string;
  constructor(cmdTemplate: string) {
    this.cmdTemplate = cmdTemplate;
  }
  async signPayload(payload: string): Promise<string> {
    // insert payload safely into template by replacing {payload}
    const cmd = this.cmdTemplate.replace('{payload}', payload.replace(/'/g, "'\\''"));
    return new Promise((resolve, reject) => {
      exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject(new Error('Kiln CLI error: ' + (stderr || err.message)));
        resolve(stdout.trim());
      });
    });
  }
}

class Pkcs11KilnBridge implements IKilnBridge {
  // PKCS#11 integration requires native module and configuration.
  // This is a stub that throws if not configured.
  constructor() {
    // no-op
  }
  async signPayload(_: string): Promise<string> {
    throw new Error('PKCS#11 Kiln bridge not configured in this environment');
  }
}

// Development shim fallback (ephemeral RSA key)
class ShimKilnBridge implements IKilnBridge {
  private privateKey: crypto.KeyObject;
  private kid: string;
  constructor() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.privateKey = privateKey;
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    this.kid = crypto.createHash('sha256').update(pubPem).digest('hex').slice(0, 16);
  }
  getKid() { return this.kid; }
  async signPayload(payload: string): Promise<string> {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(payload);
    sign.end();
    const sig = sign.sign({ key: this.privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING });
    return sig.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

export function getKilnBridge(): IKilnBridge {
  const mode = (process.env.SOVEREIGN_KILN_MODE || 'shim').toLowerCase();
  if (mode === 'http') {
    const url = process.env.SOVEREIGN_KILN_HTTP_URL;
    if (!url) throw new Error('SOVEREIGN_KILN_HTTP_URL not set for http mode');
    return new HttpKilnBridge(url);
  }
  if (mode === 'cli') {
    const tpl = process.env.SOVEREIGN_KILN_CLI || '';
    if (!tpl) throw new Error('SOVEREIGN_KILN_CLI not set for cli mode');
    return new CliKilnBridge(tpl);
  }
  if (mode === 'pkcs11') {
    const libPath = process.env.SOVEREIGN_KILN_PKCS11_LIB;
    const slotId = process.env.SOVEREIGN_KILN_SLOT_ID || '0';
    if (!libPath) {
      console.warn('[KILN] PKCS#11 mode selected but SOVEREIGN_KILN_PKCS11_LIB is not set. Falling back to stub bridge.');
    }
    return new Pkcs11KilnBridge();
  }
  // default shim
  return new ShimKilnBridge();
}

