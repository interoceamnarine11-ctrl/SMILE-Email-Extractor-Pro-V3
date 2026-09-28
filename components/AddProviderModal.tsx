import React, { useState } from 'react';
import { 
  Server, 
  X, 
  Check, 
  HelpCircle, 
  Plus, 
  ShieldCheck, 
  Sliders, 
  Zap, 
  Mail, 
  ExternalLink 
} from 'lucide-react';
import { SmtpRelay, SmtpProviderType } from '../types';
import { SMTP_PROVIDER_PRESETS, ProviderPreset } from '../services/smtpLoadBalancer';
import { safeFetchJson } from '../services/safeFetch';

interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRelay: (relay: SmtpRelay) => void;
  showToast: (msg: string) => void;
}

export const AddProviderModal: React.FC<AddProviderModalProps> = ({
  isOpen,
  onClose,
  onAddRelay,
  showToast
}) => {
  const [selectedProviderId, setSelectedProviderId] = useState<SmtpProviderType>('gmail');
  const [name, setName] = useState<string>('Google Workspace / Gmail');
  const [host, setHost] = useState<string>('smtp.gmail.com');
  const [port, setPort] = useState<number>(465);
  const [secure, setSecure] = useState<boolean>(true);
  const [user, setUser] = useState<string>('');
  const [pass, setPass] = useState<string>('');
  const [dailyQuota, setDailyQuota] = useState<number>(500);
  const [weight, setWeight] = useState<number>(1);
  const [senderName, setSenderName] = useState<string>('');
  const [fromEmail, setFromEmail] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const currentPreset = SMTP_PROVIDER_PRESETS.find(p => p.id === selectedProviderId) || SMTP_PROVIDER_PRESETS[0];

  const handleSelectProvider = (preset: ProviderPreset) => {
    setSelectedProviderId(preset.id);
    setName(preset.name);
    setHost(preset.host);
    setPort(preset.port);
    setSecure(preset.secure);
    setDailyQuota(preset.defaultDailyQuota);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!host || !user || !pass) {
      showToast('Please provide host, username, and password before testing.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await safeFetchJson<any>('/api/smtp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port, secure, user, pass })
      });

      if (res.ok && res.data && res.data.success) {
        setTestResult({
          success: true,
          message: `Connection & credentials verified! (${res.data.latencyMs}ms)`
        });
        showToast('SMTP credentials tested and verified successfully!');
      } else {
        setTestResult({
          success: false,
          message: res.data?.error || res.error || 'Connection handshake failed'
        });
        showToast('Connection failed. Please check credentials.');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network exception'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim() || !user.trim() || !pass.trim()) {
      showToast('Host, username, and password are required.');
      return;
    }

    const newRelay: SmtpRelay = {
      id: `relay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: name.trim() || `${selectedProviderId.toUpperCase()} Relay`,
      provider: selectedProviderId,
      host: host.trim(),
      port: Number(port),
      secure,
      user: user.trim(),
      pass: pass.trim(),
      dailyQuota: Number(dailyQuota) || 500,
      sentCount: 0,
      errorCount: 0,
      weight: Number(weight) || 1,
      senderName: senderName.trim() || undefined,
      fromEmail: fromEmail.trim() || user.trim(),
      status: testResult?.success ? 'verified' : 'active',
      lastTested: testResult ? new Date().toLocaleTimeString() : undefined
    };

    onAddRelay(newRelay);
    showToast(`Added ${newRelay.name} to the Rotational SMTP Pool!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add SMTP Provider to Load-Balanced Pool</h3>
              <p className="text-xs text-slate-400">
                Connect and configure any major email infrastructure provider or custom mail server.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          {/* Provider Preset Selector Pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select SMTP Provider Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {SMTP_PROVIDER_PRESETS.map((p) => {
                const isSelected = selectedProviderId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProvider(p)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight line-clamp-1">{p.name.split('/')[0]}</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-1">{p.host.split('.')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Tip Banner */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">{currentPreset.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${currentPreset.badgeColor}`}>
                Default Quota: {currentPreset.defaultDailyQuota.toLocaleString()}/day
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{currentPreset.description}</p>
            <p className="text-[11px] text-blue-400 font-mono flex items-center gap-1 pt-0.5">
              <HelpCircle className="w-3 h-3 flex-shrink-0" />
              {currentPreset.authTip}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Relay Friendly Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Primary Gmail Relay"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Daily Quota Limit
                </label>
                <input
                  type="number"
                  value={dailyQuota}
                  onChange={(e) => setDailyQuota(Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  SMTP Host Server
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="e.g. smtp.gmail.com"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    setPort(p);
                    if (p === 465) setSecure(true);
                    if (p === 587 || p === 25) setSecure(false);
                  }}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Encryption
                </label>
                <select
                  value={secure ? 'ssl' : 'tls'}
                  onChange={(e) => setSecure(e.target.value === 'ssl')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ssl">SSL / TLS (Port 465)</option>
                  <option value="tls">STARTTLS (Port 587)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username / Auth Email
                </label>
                <input
                  type="text"
                  value={user}
                  onChange={(e) => {
                    setUser(e.target.value);
                    if (!fromEmail) setFromEmail(e.target.value);
                    if (!senderName && e.target.value.includes('@')) {
                      setSenderName(e.target.value.split('@')[0]);
                    }
                  }}
                  placeholder="username@domain.com or apikey"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password / App Password / API Key
                </label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="16-char App Password or API Token"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Sender Identity & Load Balancer Weight */}
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  Sender Deliverability Alignment & Weight
                </span>
                <span className="text-[10px] text-slate-400">Guarantees SPF Alignment</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    From Address
                  </label>
                  <input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder={user || 'sender@domain.com'}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g. Sales Director"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Load Balancer Weight
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    min={1}
                    max={10}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Test Connection Result */}
            {testResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                {testResult.success ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-rose-400" />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !host || !user || !pass}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isTesting ? <Zap className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                {isTesting ? 'Testing Handshake...' : 'Test Connection'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Rotational Pool
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
