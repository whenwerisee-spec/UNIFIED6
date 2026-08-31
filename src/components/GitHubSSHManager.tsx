import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderGit2,
  Key,
  ShieldCheck,
  Terminal,
  ArrowUpRight,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Lock,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Sparkles,
  Zap,
  Radio,
  Sliders,
  ChevronRight,
  Eye,
  EyeOff,
  Code2
} from 'lucide-react';

interface GitHubSshKey {
  id: string;
  label: string;
  algorithm: 'ed25519' | 'rsa4096';
  comment: string;
  publicKey: string;
  privateKeyMasked: string;
  fingerprintSha256: string;
  fingerprintMd5: string;
  keyType: 'ssh-ed25519' | 'ssh-rsa';
  scope: 'deploy_key' | 'user_auth' | 'commit_signing';
  associatedWithEnv: boolean;
  associatedWithGitHub: boolean;
  gitHubKeyId?: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  readOnly: boolean;
}

interface GitRepoConfig {
  owner: string;
  repo: string;
  remoteUrl: string;
  httpsRemoteUrl: string;
  defaultBranch: string;
  branches: string[];
  lastCommit: {
    hash: string;
    fullHash: string;
    author: string;
    message: string;
    date: string;
    verified: boolean;
  };
  gitSshCommand: string;
  sshAgentRunning: boolean;
  knownHostsConfigured: boolean;
}

interface GitHubSSHManagerProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const GitHubSSHManager: React.FC<GitHubSSHManagerProps> = ({ showToast }) => {
  const [keys, setKeys] = useState<GitHubSshKey[]>([]);
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
  const [gitConfig, setGitConfig] = useState<GitRepoConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals & Panels
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [showPushModal, setShowPushModal] = useState<boolean>(false);
  const [showRepoConfigModal, setShowRepoConfigModal] = useState<boolean>(false);
  const [selectedKeyForDetails, setSelectedKeyForDetails] = useState<GitHubSshKey | null>(null);
  const [showFullPrivateKey, setShowFullPrivateKey] = useState<boolean>(false);

  // Generate Key Form State
  const [newKeyLabel, setNewKeyLabel] = useState<string>('Cloud Run Automated Deployer');
  const [newKeyAlgorithm, setNewKeyAlgorithm] = useState<'ed25519' | 'rsa4096'>('ed25519');
  const [newKeyComment, setNewKeyComment] = useState<string>('mlaframboisemm-deployer@applet-env');
  const [newKeyScope, setNewKeyScope] = useState<'deploy_key' | 'user_auth' | 'commit_signing'>('deploy_key');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Push Form State
  const [pushBranch, setPushBranch] = useState<string>('main');
  const [commitMessage, setCommitMessage] = useState<string>('feat: synchronize sovereign application core updates');
  const [signCommit, setSignCommit] = useState<boolean>(true);
  const [triggerCiCd, setTriggerCiCd] = useState<boolean>(true);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [pushOutputLogs, setPushOutputLogs] = useState<string[]>([]);

  // Test Handshake State
  const [isTestingSsh, setIsTestingSsh] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    authenticated: boolean;
    logs: string[];
    latencyMs: number;
    username: string;
  } | null>(null);

  // Repo Edit State
  const [editOwner, setEditOwner] = useState<string>('mlaframboisemm');
  const [editRepo, setEditRepo] = useState<string>('coinbase55');
  const [editBranch, setEditBranch] = useState<string>('main');

  // Copy Feedback
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Fetch Keys and Git Config
  const fetchGitHubData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/github/ssh-keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setActiveKeyId(data.activeKeyId || null);
        if (data.gitConfig) {
          setGitConfig(data.gitConfig);
          setEditOwner(data.gitConfig.owner);
          setEditRepo(data.gitConfig.repo);
          setEditBranch(data.gitConfig.defaultBranch);
          setPushBranch(data.gitConfig.defaultBranch);
        }
      }
    } catch (err) {
      console.error('Failed to load GitHub SSH data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGitHubData();
  }, [fetchGitHubData]);

  // Copy to clipboard helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    showToast('OpenSSH Public Key copied to clipboard!', 'success');
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  // Generate Key
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsGenerating(true);
      const res = await fetch('/api/github/ssh-keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newKeyLabel,
          algorithm: newKeyAlgorithm,
          comment: newKeyComment,
          scope: newKeyScope,
          autoAssociateEnv: true,
          autoAssociateGitHub: false
        })
      });
      const data = await res.json();
      if (data.success && data.key) {
        showToast(`SSH Key "${data.key.label}" generated and associated with app environment!`, 'success');
        setShowGenerateModal(false);
        setSelectedKeyForDetails(data.key);
        fetchGitHubData();
      } else {
        showToast(data.message || 'Failed to generate key', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error generating key', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Set Active Key
  const handleSetActiveKey = async (keyId: string) => {
    try {
      const res = await fetch(`/api/github/ssh-keys/${keyId}/set-active`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        setActiveKeyId(keyId);
        fetchGitHubData();
      }
    } catch (err) {
      showToast('Failed to switch active SSH key', 'error');
    }
  };

  // Associate Key
  const handleAssociateKey = async (keyId: string) => {
    try {
      const res = await fetch(`/api/github/ssh-keys/${keyId}/associate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          associateWithEnv: true,
          associateWithGitHub: true
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        fetchGitHubData();
      }
    } catch (err) {
      showToast('Failed to associate SSH key', 'error');
    }
  };

  // Test Live Connection
  const handleTestConnection = async (keyId?: string) => {
    const targetId = keyId || activeKeyId || keys[0]?.id;
    if (!targetId) return;

    try {
      setIsTestingSsh(true);
      setTestResult(null);
      const res = await fetch(`/api/github/ssh-keys/${targetId}/test-connection`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          authenticated: true,
          logs: data.logs,
          latencyMs: data.latencyMs,
          username: data.username
        });
        showToast(`GitHub SSH Handshake Verified (${data.latencyMs}ms)!`, 'success');
        fetchGitHubData();
      } else {
        showToast(data.message || 'SSH connection test failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'SSH Test Error', 'error');
    } finally {
      setIsTestingSsh(false);
    }
  };

  // Execute Git Push
  const handleExecutePush = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsPushing(true);
      setPushOutputLogs([]);
      const res = await fetch('/api/github/git-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: pushBranch,
          commitMessage,
          signCommit,
          triggerCiCd
        })
      });
      const data = await res.json();
      if (data.success) {
        setPushOutputLogs(data.pushLogs || []);
        showToast(`Git Push to ${data.branch} successful!`, 'success');
        fetchGitHubData();
      } else {
        showToast(data.message || 'Push failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Push error', 'error');
    } finally {
      setIsPushing(false);
    }
  };

  // Delete Key
  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke and delete this SSH key from the internal environment?')) {
      return;
    }
    try {
      const res = await fetch(`/api/github/ssh-keys/${keyId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        if (selectedKeyForDetails?.id === keyId) {
          setSelectedKeyForDetails(null);
        }
        fetchGitHubData();
      }
    } catch (err) {
      showToast('Failed to delete key', 'error');
    }
  };

  // Update Repo Config
  const handleUpdateRepoConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/github/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: editOwner,
          repo: editRepo,
          defaultBranch: editBranch
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        setShowRepoConfigModal(false);
        fetchGitHubData();
      }
    } catch (err) {
      showToast('Failed to update repo configuration', 'error');
    }
  };

  const activeKey = keys.find(k => k.id === activeKeyId) || keys[0];

  return (
    <div id="github-ssh-manager-panel" className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden mb-8 transition-all">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                <FolderGit2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    GitHub SSH & Git Environment
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    SSH Agent Active
                  </span>
                </div>
                <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
                  Generate cryptographic SSH keys, bind them to your app container keychain, and execute signed git pushes to GitHub.
                </p>
              </div>
            </div>

            {/* Quick Repo Metadata Bar */}
            {gitConfig && (
              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono">
                <div className="flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                  <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Remote:</span>
                  <span className="text-white font-bold">{gitConfig.remoteUrl}</span>
                </div>
                <div className="flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                  <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Head:</span>
                  <span className="text-emerald-300">{gitConfig.lastCommit.hash}</span>
                  <span className="text-slate-400 truncate max-w-[200px]">"{gitConfig.lastCommit.message}"</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Button Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-test-ssh-handshake"
              onClick={() => handleTestConnection()}
              disabled={isTestingSsh || keys.length === 0}
              className="px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-600 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Terminal className={`w-4 h-4 text-emerald-400 ${isTestingSsh ? 'animate-spin' : ''}`} />
              {isTestingSsh ? 'Testing Handshake...' : 'Test SSH Handshake'}
            </button>

            <button
              id="btn-open-git-push-modal"
              onClick={() => setShowPushModal(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 border border-indigo-400/30"
            >
              <Zap className="w-4 h-4 text-indigo-200" />
              Push to GitHub
            </button>

            <button
              id="btn-open-generate-ssh-modal"
              onClick={() => setShowGenerateModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 border border-emerald-400/30"
            >
              <Plus className="w-4 h-4" />
              Generate SSH Key
            </button>

            <button
              id="btn-open-repo-config-modal"
              onClick={() => setShowRepoConfigModal(true)}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs border border-slate-700 transition-all"
              title="Configure Repository Target"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Test Diagnostics Drawer (When run) */}
      {testResult && (
        <div className="bg-slate-950 border-b border-slate-800 p-5 font-mono text-xs text-slate-300 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                GitHub SSH Handshake: 200 AUTHENTICATED
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-400">{testResult.latencyMs}ms RTT</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Authenticated user: @{testResult.username}</span>
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="text-slate-400 hover:text-white text-xs underline"
            >
              Close Diagnostic
            </button>
          </div>

          <div className="mt-3 space-y-1 bg-black/40 p-4 rounded-xl border border-slate-800/80 max-h-48 overflow-y-auto">
            {testResult.logs.map((log, idx) => (
              <div key={idx} className="flex items-start space-x-2">
                <span className="text-slate-600 select-none">{String(idx + 1).padStart(2, '0')}</span>
                <span className={log.includes('GITHUB OUTPUT') ? 'text-emerald-300 font-bold' : log.includes('Authenticated') ? 'text-cyan-300' : 'text-slate-400'}>
                  {log}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="p-6 space-y-6">
        {/* Active Environment SSH Key Card */}
        {activeKey ? (
          <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-indigo-100 p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white">
                    Active Git Identity
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Internal Keychain Associated
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-200 text-slate-700">
                    {activeKey.algorithm.toUpperCase()} (256-bit)
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-600" />
                  {activeKey.label}
                </h3>
                <p className="text-xs text-slate-600 font-mono">
                  Fingerprint: <strong className="text-slate-900">{activeKey.fingerprintSha256}</strong>
                </p>
              </div>

              {/* Quick Copy & Add to GitHub Links */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id={`btn-copy-active-pubkey-${activeKey.id}`}
                  onClick={() => handleCopy(activeKey.publicKey, activeKey.id)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {copiedKeyId === activeKey.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied Public Key!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Public Key</span>
                    </>
                  )}
                </button>

                <a
                  href={`https://github.com/${gitConfig?.owner || 'mlaframboisemm'}/${gitConfig?.repo || 'coinbase55'}/settings/keys/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-200 transition-all flex items-center gap-1.5"
                >
                  <span>Add to GitHub Deploy Keys</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  onClick={() => setSelectedKeyForDetails(activeKey)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <span>Key Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <Key className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No SSH Keys Installed</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Generate an Ed25519 or RSA SSH key pair to authenticate git pushes to your repository.
            </p>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Generate First SSH Key
            </button>
          </div>
        )}

        {/* SSH Keys List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Installed SSH Key Pairs ({keys.length})
            </h4>
            <span className="text-xs text-slate-400">
              Keys stored in secure internal memory & app keychain
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {keys.map((key) => {
              const isSelectedActive = key.id === activeKeyId;
              return (
                <div
                  key={key.id}
                  id={`ssh-key-card-${key.id}`}
                  className={`rounded-2xl border transition-all p-4 ${
                    isSelectedActive
                      ? 'bg-white border-indigo-400 shadow-sm ring-1 ring-indigo-200'
                      : 'bg-slate-50/80 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Key Identity Info */}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900">{key.label}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          key.algorithm === 'ed25519' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {key.keyType}
                        </span>
                        {key.associatedWithGitHub && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> GitHub Verified
                          </span>
                        )}
                        {isSelectedActive && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                            Primary
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-mono text-slate-600 truncate max-w-xl">
                        {key.fingerprintSha256}
                      </p>

                      <div className="flex items-center space-x-4 text-[11px] text-slate-400 pt-0.5">
                        <span>Comment: <strong className="text-slate-600 font-mono">{key.comment}</strong></span>
                        <span>Scope: <strong className="text-slate-600">{key.scope.replace('_', ' ')}</strong></span>
                        <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                        {key.lastUsedAt && <span>Last Used: {new Date(key.lastUsedAt).toLocaleTimeString()}</span>}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleCopy(key.publicKey, key.id)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-all flex items-center gap-1"
                        title="Copy OpenSSH Public Key"
                      >
                        {copiedKeyId === key.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKeyId === key.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      {!isSelectedActive ? (
                        <button
                          onClick={() => handleSetActiveKey(key.id)}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-all"
                        >
                          Set Primary
                        </button>
                      ) : (
                        <span className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
                        </span>
                      )}

                      <button
                        onClick={() => handleTestConnection(key.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                      >
                        <Terminal className="w-3.5 h-3.5 text-slate-600" />
                        <span>Test</span>
                      </button>

                      <button
                        onClick={() => setSelectedKeyForDetails(key)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
                      >
                        Details
                      </button>

                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Revoke SSH Key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3-Step Setup Guide & Instructions Box */}
        <div className="bg-slate-900 rounded-2xl p-5 text-slate-300 space-y-4">
          <div className="flex items-center space-x-2 text-white">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-bold">Seamless 3-Step GitHub SSH Workflow</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-1.5">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] border border-indigo-400/40">1</span>
                <span>Generate Key Pair</span>
              </div>
              <p className="text-slate-400">
                Click <strong>Generate SSH Key</strong> to produce a state-of-the-art Ed25519 key pair with automatic internal keychain binding.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-1.5">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] border border-indigo-400/40">2</span>
                <span>Associate with GitHub</span>
              </div>
              <p className="text-slate-400">
                Copy your OpenSSH public key and paste into your repository's <strong>Deploy Keys</strong> (with write access enabled) or your personal GitHub SSH keys.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-1.5">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] border border-indigo-400/40">3</span>
                <span>Push & Deploy</span>
              </div>
              <p className="text-slate-400">
                Use <strong>Push to GitHub</strong> to sign commits and push code branches directly over authenticated SSH tunnels.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: GENERATE SSH KEY PAIR */}
      {/* ========================================================================= */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Key className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Generate Cryptographic SSH Key Pair</h3>
                  <p className="text-xs text-slate-500">Creates private/public key with internal environment association</p>
                </div>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Key Label</label>
                <input
                  type="text"
                  required
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="e.g. Cloud Run Deployer"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cryptographic Algorithm</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-start space-x-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      newKeyAlgorithm === 'ed25519' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-400' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="algo"
                      value="ed25519"
                      checked={newKeyAlgorithm === 'ed25519'}
                      onChange={() => setNewKeyAlgorithm('ed25519')}
                      className="mt-0.5 text-emerald-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Ed25519 (Recommended)</div>
                      <div className="text-[10px] text-slate-500">256-bit Edwards Curve, fast and secure</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start space-x-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      newKeyAlgorithm === 'rsa4096' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-400' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="algo"
                      value="rsa4096"
                      checked={newKeyAlgorithm === 'rsa4096'}
                      onChange={() => setNewKeyAlgorithm('rsa4096')}
                      className="mt-0.5 text-emerald-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">RSA 4096-bit</div>
                      <div className="text-[10px] text-slate-500">Legacy enterprise compatibility</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Key Comment / Email Tag</label>
                <input
                  type="text"
                  required
                  value={newKeyComment}
                  onChange={(e) => setNewKeyComment(e.target.value)}
                  placeholder="e.g. developer@internal-env"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Key Purpose Scope</label>
                <select
                  value={newKeyScope}
                  onChange={(e) => setNewKeyScope(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="deploy_key">Deploy Key (Repository Read/Write Git Push)</option>
                  <option value="user_auth">Personal User SSH Authentication</option>
                  <option value="commit_signing">Cryptographic Commit Signing (git -S)</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Auto-Associate with App Container
                </div>
                <p className="text-[11px]">
                  The new key will automatically be set as active in <code>GIT_SSH_COMMAND</code> and loaded into the local SSH identity keyring.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {isGenerating ? 'Generating Key Pair...' : 'Generate & Associate Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PUSH TO GITHUB */}
      {/* ========================================================================= */}
      {showPushModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <FolderGit2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Execute Secure Git Push</h3>
                  <p className="text-xs text-slate-500">Push signed commits to GitHub via authenticated SSH tunnel</p>
                </div>
              </div>
              <button
                onClick={() => { setShowPushModal(false); setPushOutputLogs([]); }}
                className="text-slate-400 hover:text-slate-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecutePush} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Branch</label>
                  <select
                    value={pushBranch}
                    onChange={(e) => setPushBranch(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {(gitConfig?.branches || ['main', 'staging', 'release/v2.4', 'feature/sovereign-core']).map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Active SSH Key</label>
                  <div className="px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 truncate">
                    {activeKey?.label || 'No key loaded'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Commit Message</label>
                <textarea
                  rows={2}
                  required
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Describe your change..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signCommit}
                    onChange={(e) => setSignCommit(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Cryptographically sign commit with active SSH key (<code>git commit -S</code>)</span>
                </label>

                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={triggerCiCd}
                    onChange={(e) => setTriggerCiCd(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Trigger GitHub Actions & Cloud Run CI/CD deployment webhook</span>
                </label>
              </div>

              {/* Terminal Logs Output */}
              {pushOutputLogs.length > 0 && (
                <div className="bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-slate-300 space-y-1 max-h-48 overflow-y-auto border border-slate-800">
                  <div className="text-emerald-400 font-bold flex items-center gap-1 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Push Execution Output
                  </div>
                  {pushOutputLogs.map((log, i) => (
                    <div key={i} className={log.includes('Successfully') || log.includes('GITHUB') ? 'text-emerald-300' : 'text-slate-400'}>
                      {log}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPushModal(false); setPushOutputLogs([]); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isPushing}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isPushing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {isPushing ? 'Pushing to Remote...' : 'Execute Git Push'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KEY DETAILS & OPENSSH EXPORT */}
      {/* ========================================================================= */}
      {selectedKeyForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedKeyForDetails.label}</h3>
                  <p className="text-xs text-slate-500">{selectedKeyForDetails.algorithm.toUpperCase()} • {selectedKeyForDetails.fingerprintSha256}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedKeyForDetails(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Public Key Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">OpenSSH Public Key</label>
                  <button
                    onClick={() => handleCopy(selectedKeyForDetails.publicKey, selectedKeyForDetails.id)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    {copiedKeyId === selectedKeyForDetails.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKeyId === selectedKeyForDetails.id ? 'Copied to Clipboard' : 'Copy Public Key'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={3}
                  value={selectedKeyForDetails.publicKey}
                  className="w-full p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs focus:outline-none border border-slate-800 select-all"
                />
              </div>

              {/* Private Key Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    Private Key (Hardware Enclave Protected)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowFullPrivateKey(!showFullPrivateKey)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                  >
                    {showFullPrivateKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showFullPrivateKey ? 'Hide Key' : 'Reveal Masked Key'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={4}
                  value={showFullPrivateKey ? selectedKeyForDetails.privateKeyMasked : '-----BEGIN OPENSSH PRIVATE KEY-----\n••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••\n[ENCRYPTED IN HARDWARE KEYCHAIN - ACCESS RESTRICTED TO SSH AGENT]\n••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••\n-----END OPENSSH PRIVATE KEY-----'}
                  className="w-full p-3 rounded-xl bg-slate-950 text-amber-300 font-mono text-xs focus:outline-none border border-slate-800"
                />
              </div>

              {/* Fingerprints */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono">
                <div>
                  <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">SHA256 Fingerprint</div>
                  <div className="text-slate-800 truncate font-semibold">{selectedKeyForDetails.fingerprintSha256}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">MD5 Fingerprint</div>
                  <div className="text-slate-800 truncate font-semibold">{selectedKeyForDetails.fingerprintMd5}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => handleAssociateKey(selectedKeyForDetails.id)}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verify GitHub Association</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedKeyForDetails(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURE REPOSITORY */}
      {/* ========================================================================= */}
      {showRepoConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Sliders className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Configure GitHub Remote</h3>
                  <p className="text-xs text-slate-500">Update repository owner, name, and default branch</p>
                </div>
              </div>
              <button
                onClick={() => setShowRepoConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRepoConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">GitHub Owner / Organization</label>
                <input
                  type="text"
                  required
                  value={editOwner}
                  onChange={(e) => setEditOwner(e.target.value)}
                  placeholder="e.g. mlaframboisemm"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Repository Name</label>
                <input
                  type="text"
                  required
                  value={editRepo}
                  onChange={(e) => setEditRepo(e.target.value)}
                  placeholder="e.g. coinbase55"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Default Branch</label>
                <input
                  type="text"
                  required
                  value={editBranch}
                  onChange={(e) => setEditBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 font-mono">
                <div>SSH Remote: <strong className="text-slate-900">git@github.com:{editOwner}/{editRepo}.git</strong></div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRepoConfigModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
