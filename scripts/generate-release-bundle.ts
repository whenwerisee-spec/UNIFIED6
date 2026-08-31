import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const VERSION = '6.4.3';
const RELEASE_DIR = path.join(process.cwd(), 'release_bundle');
const ARTIFACTS = [
  { name: 'sovereign-app.apk', path: 'public/sovereign-app.apk' },
  { name: 'UNIFIED_FINANCE_HUB_CAPABILITIES.pdf', path: 'UNIFIED_FINANCE_HUB_CAPABILITIES.pdf' },
  { name: 'SOVEREIGN_PRINCIPAL_MANIFESTO.pdf', path: 'SOVEREIGN_PRINCIPAL_MANIFESTO.pdf' },
  { name: 'SOVEREIGN_TECHNOLOGY_DEED.pdf', path: 'SOVEREIGN_TECHNOLOGY_DEED.pdf' },
  { name: 'SOVEREIGN_INFRASTRUCTURE_AUDIT.pdf', path: 'SOVEREIGN_INFRASTRUCTURE_AUDIT.pdf' },
  { name: 'GENESIS_AUTHORITY_DEED.pdf', path: 'GENESIS_AUTHORITY_DEED.pdf' },
  { name: 'MANULIFE_SOVEREIGN_RAIL_DEED.pdf', path: 'MANULIFE_SOVEREIGN_RAIL_DEED.pdf' },
  { name: 'SOVEREIGN_POST_QUANTUM_SHIELD.pdf', path: 'SOVEREIGN_POST_QUANTUM_SHIELD.pdf' },
  { name: 'INTERAC_SOVEREIGN_HUB_DEED.pdf', path: 'INTERAC_SOVEREIGN_HUB_DEED.pdf' },
  { name: 'GLOBAL_SOVEREIGNTY_CERTIFICATE.pdf', path: 'GLOBAL_SOVEREIGNTY_CERTIFICATE.pdf' },
  { name: 'SOVEREIGN_MASTER_CHARTER.pdf', path: 'SOVEREIGN_MASTER_CHARTER.pdf' },
  { name: 'PRINCIPAL_SOVEREIGN_HANDBOOK.pdf', path: 'PRINCIPAL_SOVEREIGN_HANDBOOK.pdf' },
  { name: 'PRINCIPAL_IDENTITY_CERTIFICATE.pdf', path: 'PRINCIPAL_IDENTITY_CERTIFICATE.pdf' },
  { name: 'SOVEREIGN_PATENT_CHARTER.pdf', path: 'SOVEREIGN_PATENT_CHARTER.pdf' }
];

function getHash(filePath: string): string {
  if (!fs.existsSync(filePath)) return 'FILE_NOT_FOUND';
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function generateReleaseBundle() {
  console.log(`[RELEASE] Initiating Sovereign Release Bundle v${VERSION}...`);

  if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR);
  }

  const manifest: any = {
    version: VERSION,
    timestamp: new Date().toISOString(),
    principal: 'MARCEL LAFRAMBOISE',
    files: []
  };

  ARTIFACTS.forEach(art => {
    const srcPath = path.join(process.cwd(), art.path);
    const destPath = path.join(RELEASE_DIR, art.name);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      const hash = getHash(srcPath);
      manifest.files.push({
        name: art.name,
        sha256: hash,
        status: 'VERIFIED'
      });
      console.log(`[RELEASE] Included & Hashed: ${art.name}`);
    } else {
      console.warn(`[RELEASE] Warning: Artifact missing: ${art.name}`);
    }
  });

  const manifestPath = path.join(RELEASE_DIR, 'MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[RELEASE] Manifest Sealed: ${manifestPath}`);

  // Create final ZIP
  const zipName = `unified_sovereign_release_v${VERSION}.zip`;
  const zipPath = path.join(process.cwd(), '..', zipName);

  console.log(`[RELEASE] Compressing Final Bundle: ${zipName}`);
  try {
    execSync(`tar -acvf "${zipPath}" -C "${RELEASE_DIR}" .`);
    console.log(`[RELEASE] SUCCESS: Sovereign Release Bundle created at: ${zipPath}`);
  } catch (e) {
    console.error(`[RELEASE] Compression failed:`, e);
  }
}

generateReleaseBundle();
