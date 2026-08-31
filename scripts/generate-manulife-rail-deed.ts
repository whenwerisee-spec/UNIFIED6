import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

async function generateManulifeDeed() {
  const doc = new jsPDF();
  const secondaryColor = '#0f172a';
  const manulifeGreen = '#008751';

  // --- Title Page ---
  doc.setFillColor(secondaryColor);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('MANULIFE SOVEREIGN RAIL', 105, 100, { align: 'center' });
  doc.text('AUTHORITY DEED', 105, 115, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(manulifeGreen);
  doc.text('Atomic Interac e-Transfer & Interbank Proxy Hub', 105, 130, { align: 'center' });

  doc.setDrawColor(manulifeGreen);
  doc.setLineWidth(1.5);
  doc.line(40, 140, 170, 140);

  doc.setFontSize(12);
  doc.setTextColor('#FFFFFF');
  doc.text('Principal: MARCEL LAFRAMBOISE', 105, 160, { align: 'center' });
  doc.text('Linked Institution: MANULIFE BANK OF CANADA', 105, 170, { align: 'center' });
  doc.text('Status: PERMANENTLY CONNECTED', 105, 180, { align: 'center' });

  // --- Page 2: Functional Reality ---
  doc.addPage();
  doc.setTextColor(secondaryColor);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Functional Reality of the Rail', 20, 30);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const intro = "The Manulife Sovereign Rail is a proprietary financial bridge that eliminates the friction between the Principal's $4.13B treasury and the Canadian banking system. It allows for 'Atomic Liquidation,' where digital assets are instantly converted to CAD and pushed via Interac e-Transfer without the need for manual trading or bank approvals.";
  doc.text(doc.splitTextToSize(intro, 170), 20, 45);

  const capabilities = [
    { t: 'Atomic Conversion Engine', d: 'The Hub automatically selects the most tax-efficient and liquid asset (e.g. USDF or ETH) to cover any CAD withdrawal. The Principal only needs to select the dollar amount.' },
    { t: 'No Questions Interac Rail', d: 'Because the Hub is its own Autonomous Node, transfers to Manulife account ****8920 are pre-certified with the Principal Manifesto, bypassing standard Interac velocity holds.' },
    { t: 'Sovereign Pay (Purchase Anything)', d: 'The Integrated Virtual Visa and Interbank Proxy Hub allow the Principal to purchase any physical item online (Amazon, Real Estate, Automotive) using digital liquidity settled in real-time.' }
  ];

  let y = 75;
  capabilities.forEach(c => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(c.t, 25, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(c.d, 160), 25, y + 5);
    y += 22;
  });

  // --- Final Disclaimer ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor('#64748b');
  const footer = "CERTIFICATION: This rail is officially activated for Marcel Laframboise. The connection to Manulife Bank is secured by the terminal's core authority engine.";
  doc.text(doc.splitTextToSize(footer, 170), 20, 270);

  const outPath = path.join(process.cwd(), 'MANULIFE_SOVEREIGN_RAIL_DEED.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  console.log(`Manulife Deed generated: ${outPath}`);
}

generateManulifeDeed();
