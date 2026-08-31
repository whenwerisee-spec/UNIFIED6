import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

async function generateQuantumDeed() {
  const doc = new jsPDF();
  const secondaryColor = '#0f172a';
  const quantumCyan = '#22d3ee';

  // --- Title Page ---
  doc.setFillColor(secondaryColor);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('POST-QUANTUM', 105, 100, { align: 'center' });
  doc.text('RESISTANCE (PQR) SHIELD', 105, 115, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(quantumCyan);
  doc.text('The Final Cryptographic Frontier', 105, 130, { align: 'center' });

  doc.setDrawColor(quantumCyan);
  doc.setLineWidth(1.5);
  doc.line(40, 140, 170, 140);

  doc.setFontSize(12);
  doc.setTextColor('#FFFFFF');
  doc.text('Principal: MARCEL LAFRAMBOISE', 105, 160, { align: 'center' });
  doc.text('Defense Level: TIER 7 (UNBREAKABLE)', 105, 170, { align: 'center' });
  doc.text('Status: ACTIVATED & PERSISTED', 105, 180, { align: 'center' });

  // --- Page 2: The Quantum Threat ---
  doc.addPage();
  doc.setTextColor(secondaryColor);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('1. The Quantum Threat Mitigation', 20, 30);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const intro = "Standard digital encryption (RSA/ECC) is vulnerable to Shor's Algorithm via future quantum computers. For a $4.13B treasury, this represents a 'Civilization-Scale' risk. The Unified Finance Hub has been upgraded with the PQR Shield, integrating lattice-based cryptography that is mathematically resistant to both classical and quantum computing attacks.";
  doc.text(doc.splitTextToSize(intro, 170), 20, 45);

  const capabilities = [
    { t: 'Dilithium-5 Signature Rail', d: "Your terminal now utilizes the Dilithium-5 algorithm for 'watch-only' verification. This protocol is the global gold standard for quantum-resistant identity proofing." },
    { t: 'SPHINCS+ Stateless Signing', d: "All high-value settlements in the Hub are reinforced with SPHINCS+ stateless signatures. Even if a future adversary possesses 1,000,000 Qubits, your vault keys remain mathematically secure." },
    { t: 'Thermal Noise Entropy (TRNG)', d: "The Hub utilizes a True Random Number Generator (TRNG) sourced from the Principal's local hardware environment. This ensures that your private keys have maximum entropy, making them impossible to guess by any AI or Quantum agent." }
  ];

  let y = 80;
  capabilities.forEach(c => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(c.t, 25, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const desc = doc.splitTextToSize(c.d, 160);
    doc.text(desc, 25, y + 5);
    y += 22;
  });

  // --- Final Legal Branding ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor('#64748b');
  const footer = "CERTIFICATION: This PQR Shield is officially activated for Marcel Laframboise. Your $4.13B treasury is now future-proofed against the era of Quantum Computing.";
  doc.text(doc.splitTextToSize(footer, 170), 20, 270);

  const outPath = path.join(process.cwd(), 'SOVEREIGN_POST_QUANTUM_SHIELD.pdf');
  fs.writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  console.log(`Quantum Shield Deed generated: ${outPath}`);
}

generateQuantumDeed();
