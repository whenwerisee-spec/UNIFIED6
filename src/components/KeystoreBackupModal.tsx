import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  Key, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  FileCode, 
  Lock,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { 
  exportEncryptedKeystore, 
  importEncryptedKeystore, 
  decryptSecrets, 
  VaultMetadata,
  EncryptedVaultRecord
} from '../lib/vault-storage';

interface KeystoreBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaults: VaultMetadata[];
  selectedVaultId?: string;
  onVaultImported: () => void;
}

export const KeystoreBackupModal: React.FC<KeystoreBackupModalProps> = ({
  isOpen,
  onClose,
  vaults,
  selectedVaultId,
  onVaultImported
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  
  // Export State
  const [exportVaultId, setExportVaultId] = useState<string>(selectedVaultId || (vaults[0]?.id || ''));
  const [exportedJson, setExportedJson] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportChecksum, setExportChecksum] = useState<string | null>(null);

  // Import State
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importPassword, setImportPassword] = useState<string>('');
  const [showImportPassword, setShowImportPassword] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportKeystore = async () => {
    if (!exportVaultId) {
      setExportError('Please select a vault to export.');
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportedJson(null);
    setExportChecksum(null);

    try {
      const jsonString = await exportEncryptedKeystore(exportVaultId);
      setExportedJson(jsonString);

      // Compute simple checksum for visual verification
      const record = JSON.parse(jsonString) as EncryptedVaultRecord;
      const shortHash = record.ciphertextHex.slice(0, 16) + '...' + record.ciphertextHex.slice(-8);
      setExportChecksum(shortHash);

      // Auto-trigger file download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `keystore-${record.metadata.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err?.message || 'Failed to export encrypted keystore.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyExportJson = () => {
    if (!exportedJson) return;
    navigator.clipboard.writeText(exportedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      setImportError(null);
    };
    reader.onerror = () => {
      setImportError('Failed to read selected file.');
    };
    reader.readAsText(file);
  };

  const handleImportKeystore = async () => {
    if (!importJsonText.trim()) {
      setImportError('Please paste keystore JSON or upload a keystore file.');
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const record = JSON.parse(importJsonText) as EncryptedVaultRecord;
      if (!record.id || !record.saltHex || !record.ivHex || !record.ciphertextHex || !record.metadata) {
        throw new Error('Invalid keystore schema: Missing required cryptographic fields (PBKDF2/AES-GCM).');
      }

      // If user provided test password, verify decryption test first
      if (importPassword) {
        await decryptSecrets(record.ciphertextHex, record.saltHex, record.ivHex, importPassword);
      }

      const importedMetadata = await importEncryptedKeystore(importJsonText);
      setImportSuccess(`Keystore "${importedMetadata.label}" (${importedMetadata.address?.slice(0, 8)}...) successfully imported and persisted to encrypted storage.`);
      onVaultImported();
    } catch (err: any) {
      setImportError(err?.message || 'Failed to import keystore. Ensure the file is a valid encrypted keystore.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-white space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/15 border border-indigo-500/30 rounded-xl text-indigo-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Portable Keystore Backup & Recovery</h3>
              <p className="text-xs text-slate-400">Encrypted JSON keystore file format (PBKDF2-SHA256 + AES-GCM-256)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-bold px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => { setActiveTab('export'); setExportError(null); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 ${
              activeTab === 'export' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Encrypted Keystore</span>
          </button>
          <button
            onClick={() => { setActiveTab('import'); setImportError(null); setImportSuccess(null); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 ${
              activeTab === 'import' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Keystore File</span>
          </button>
        </div>

        {/* Export Workflow */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Select Vault to Export</label>
              <select
                value={exportVaultId}
                onChange={(e) => setExportVaultId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {vaults.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.address ? `${v.address.slice(0, 6)}...${v.address.slice(-4)}` : v.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center space-x-2 text-indigo-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Security Assurance</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                The exported JSON file is fully encrypted at rest using your master passphrase with 100,000 PBKDF2-SHA256 iterations and AES-GCM-256 authenticated encryption. Plaintext private keys are never exposed.
              </p>
            </div>

            {exportError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{exportError}</span>
              </div>
            )}

            {exportedJson && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Keystore File Generated & Downloaded</span>
                  </span>
                  {exportChecksum && (
                    <span className="font-mono text-[10px] text-slate-500">Hash: {exportChecksum}</span>
                  )}
                </div>
                <div className="relative">
                  <textarea
                    readOnly
                    rows={4}
                    value={exportedJson}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[10px] text-slate-300 focus:outline-none resize-none"
                  />
                  <button
                    onClick={handleCopyExportJson}
                    className="absolute right-2.5 top-2.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center space-x-1 border border-slate-700"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleExportKeystore}
              disabled={isExporting || vaults.length === 0}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              {isExporting ? (
                <span>Encrypting & Generating Backup...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Encrypted Keystore JSON</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Import Workflow */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Upload Keystore File or Paste JSON</label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Raw Keystore JSON Payload</label>
              <textarea
                rows={4}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='Paste encrypted {"id": "...", "ciphertextHex": "...", ...} here...'
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Vault Passphrase (Optional Decryption Test)</label>
              <div className="relative">
                <input
                  type={showImportPassword ? 'text' : 'password'}
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Enter passphrase to test verification before restoring..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowImportPassword(!showImportPassword)}
                  className="text-slate-400 hover:text-white absolute right-3 top-2.5"
                >
                  {showImportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {importError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {importSuccess && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{importSuccess}</span>
              </div>
            )}

            <button
              onClick={handleImportKeystore}
              disabled={isImporting || !importJsonText.trim()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/25 cursor-pointer"
            >
              {isImporting ? (
                <span>Validating & Restoring Keystore...</span>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Restore Keystore to Encrypted Vault</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
