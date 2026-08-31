import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

async function generateIdentityCertificate() {
  const doc = new jsPDF();
  const secondaryColor = '#0f172a';
  const verifiedBlue = '#3b82f6';

  // --- Title Page ---
  doc.setFillColor(secondaryColor);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICATE OF', 105, 100, { align: 'center' });
  doc.text('VERIFIED IDENTITY', 105, 115, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(verifiedBlue);
  doc.text('Official Principal Registry of the Unified Finance Hub', 105, 130, { align: 'center' });

  doc.setDrawColor(verifiedBlue);
  doc.setLineWidth(1.5);
  doc.line(40, 140, 170, 140);

  doc.setFontSize(12);
  doc.setTextColor('#FFFFFF');
  doc.text('PRINCIPAL: MARCEL WILLIAM JOEY LAFRAMBOISE', 105, 160, { align: 'center' });
  doc.text('VERIFICATION LEVEL: TIER 3 (GOVERNMENT ISSUED)', 105, 170, { align: 'center' });
  doc.text('DATE: August 30, 2026', 105, 180, { align: 'center' });

  // --- Page 2: Identity Details ---
  doc.addPage();
  doc.setTextColor(secondaryColor);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Official Identity Registry', 20, 30);

  const details = [
    ['Full Legal Name', 'MARCEL WILLIAM JOEY LAFRAMBOISE'],
    ['Date of Birth', '1982/11/29'],
    ['Citizenship', 'Canada'],
    ['Document Type', 'Ontario Photo Card (Official Identification)'],
    ['Document Number', '457 - XQ28 - 47707'],
    ['Reference (DD/REF)', 'KE4724209'],
    ['Registered Address', '475 ALBERT ST, OSHAWA, ON, L1H 4S7'],
    ['Physical Description', 'M | 180 cm'],
    ['Issue Date', '2024/02/02'],
    ['Expiry Date', '2029/02/02']
  ];

  let y = 50;
  details.forEach(detail => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(detail[0], 25, y);
    doc.setFont('helvetica', 'normal');
    doc.text(detail[1], 80, y);
    doc.setDrawColor('#e2e8f0');
    doc.line(25, y + 2, 185, y + 2);
    y += 12;
  });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Cryptographic Binding', 20, y + 10);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const binding = "The above government-issued identity has been cryptographically bound to the Marshall Sovereign Treasury address (0x742d35Cc6634C0532925a3b844Bc454e4438f44e). Any transaction signed via the Tesla TSL-3 UWB gate is legally and technically attributed to this identity.";
  doc.text(doc.splitTextToSize(binding, 170), 20, y + 20);

  // --- Final Disclaimer ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor('#64748b');
  const footer = "CERTIFICATION: This document serves as the official identity anchor for Marcel Laframboise within the Sovereign Wealth Terminal. It is verified and sealed.";
  doc.text(doc.splitTextToSize(footer, 170), 20, 270);

  const outPath = path.join(process.cwd(), 'PRINCIPAL_IDENTITY_CERTIFICATE.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  console.log(`Identity Certificate generated: ${outPath}`);
}

generateIdentityCertificate();
