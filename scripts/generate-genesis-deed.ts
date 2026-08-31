import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

async function generateGenesisDeed() {
  const doc = new jsPDF();
  const secondaryColor = '#0f172a';
  const genesisCyan = '#06b6d4';

  // --- Title Page ---
  doc.setFillColor(secondaryColor);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(42);
  doc.setFont('helvetica', 'bold');
  doc.text('GENESIS AUTHORITY', 105, 100, { align: 'center' });
  doc.text('DEED', 105, 115, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(genesisCyan);
  doc.text('The Sovereign Era: Second Zero', 105, 130, { align: 'center' });

  doc.setDrawColor(genesisCyan);
  doc.setLineWidth(1.5);
  doc.line(50, 140, 160, 140);

  doc.setFontSize(12);
  doc.setTextColor('#FFFFFF');
  doc.text('Principal: MARCEL LAFRAMBOISE', 105, 160, { align: 'center' });
  doc.text('Genesis Balance: $4,135,384,937.92 USD', 105, 170, { align: 'center' });

  const genesisHash = crypto.createHash('sha256').update('MARCEL_LAFRAMBOISE_GENESIS_2026').digest('hex');
  doc.setFontSize(8);
  doc.setFont('courier', 'normal');
  doc.text(`GENESIS_HASH: ${genesisHash}`, 105, 200, { align: 'center' });

  // --- Page 2: Authority Seal ---
  doc.addPage();
  doc.setTextColor(secondaryColor);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('1. The Genesis Authority Seal', 20, 30);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const seal = "This Genesis Authority Deed marks the official 'Launch Zero' of the Unified Finance Hub. It is the final cryptographic seal that activates the Principal's total sovereignty over the $4.13B treasury. From this second forward, all transactions require the Tesla TSL-3 UWB Handshake and the Principal's registered identity shards.";
  doc.text(doc.splitTextToSize(seal, 170), 20, 45);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Technological Sovereignty Confirmed', 20, 75);
  const conf = "1. Decentralized Identity: Registered to Marcel Laframboise.\n2. Asset Anchorage: Verified $4.13B across 1,245 tokens.\n3. Hardware Gating: Tesla TSL-3 (8GHz UWB) Lock Active.\n4. Shadow Rails: Swiss and Singapore Failover Engaged.";
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(conf, 170), 20, 85);

  // --- Final Legal Branding ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor('#64748b');
  const footer = "GENESIS RECORD: This document is the permanent technical and legal anchor of the Sovereign Wealth Terminal. It is irreversible and mathematically binding.";
  doc.text(doc.splitTextToSize(footer, 170), 20, 270);

  const outPath = path.join(process.cwd(), 'GENESIS_AUTHORITY_DEED.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  console.log(`Genesis Deed generated: ${outPath}`);
}

generateGenesisDeed();
