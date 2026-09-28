import React, { useState } from 'react';
import { 
  Mail, 
  Key, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  ShieldCheck, 
  HelpCircle,
  Zap,
  Lock
} from 'lucide-react';
import { safeFetchJson } from '../services/safeFetch';
import { SmtpRelay } from '../types';

interface GmailQuickSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRelay: (relay: SmtpRelay) => void;
  showToast: (msg: string) => void;
}

export const GmailQuickSetupModal: React.FC<GmailQuickSetupModalProps> = ({
  isOpen,
  onClose,
  onAddRelay,
  showToast
}) => {
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [sendLimit, setSendLimit] = useState(500);
  const [isVerifying, setIsVerifying] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  if (!isOpen) return null;

  const handleCleanPassword = (val: string) => {
    // Strip spaces that Google often displays between 4-character blocks (e.g. "abcd efgh ijkl mnop")
    return val.replace(/\s+/g, '');
  };

  const handleTestAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPass = handleCleanPassword(appPassword);

    if (!email.includes('@')) {
      showToast('Please enter a valid Gmail or Google Workspace email address.');
      return;
    }
    if (cleanPass.length < 8) {
      showToast('Please enter your 16-character Google App Password.');
      return;
    }

    setIsVerifying(true);
    setTestResult(null);

    try {
      const res = await safeFetchJson<any>('/api/smtp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          user: email.trim(),
          pass: cleanPass
        })
      });

      if (res.ok && res.data?.success) {
        setTestResult({
          success: true,
          message: 'Handshake 250 OK: Gmail SMTP authenticated successfully!',
          latencyMs: res.data.latencyMs
        });

        const newRelay: SmtpRelay = {
          id: `gmail-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: `Gmail (${email.split('@')[0]})`,
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          user: email.trim(),
          pass: cleanPass,
          preset: 'gmail',
          dailyQuota: sendLimit,
          sentCount: 0,
          status: 'verified',
          lastTested: new Date().toLocaleTimeString(),
          lastLatencyMs: res.data.latencyMs
        };

        onAddRelay(newRelay);
        showToast(`Connected Gmail SMTP relay (${email}) with limit ${sendLimit}/day!`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        const errMsg = res.data?.error || res.error || 'Authentication rejected by Google. Ensure 2-Step Verification is ON and your App Password is 16 characters.';
        setTestResult({
          success: false,
          message: errMsg
        });
        showToast(`Gmail connection failed: ${errMsg}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection handshake timeout to smtp.gmail.com:465'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Gmail Auto-Sign & SMTP Assistant</h3>
                <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full font-semibold">
                  Google Workspace / Gmail
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Direct integration with Google SMTP relay servers (smtp.gmail.com:465 SSL)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explanatory Guide */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 bg-blue-950/30 border border-blue-800/40 rounded-xl space-y-2 text-blue-200">
            <div className="font-semibold flex items-center gap-1.5 text-blue-300">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              How Gmail SMTP Authentication Works:
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Google requires a <strong>16-character App Password</strong> for external SMTP connections. You do not use your regular Gmail password.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-slate-950/50 rounded-lg border border-slate-800">
                <span className="text-blue-400 font-bold block mb-0.5">Step 1: 2-Step Verification</span>
                Ensure 2-Step Verification is active in your Google Account.
              </div>
              <div className="p-2 bg-slate-950/50 rounded-lg border border-slate-800">
                <span className="text-blue-400 font-bold block mb-0.5">Step 2: Generate App Password</span>
                Click below to open Google App Passwords and create a code for &quot;Mail&quot;.
              </div>
              <div className="p-2 bg-slate-950/50 rounded-lg border border-slate-800">
                <span className="text-blue-400 font-bold block mb-0.5">Step 3: Connect & Rotate</span>
                Paste the 16 characters below to auto-verify and connect to the sending pool.
              </div>
            </div>
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all text-[11px] mt-1"
            >
              Open Google App Passwords
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Form */}
          <form onSubmit={handleTestAndConnect} className="space-y-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Gmail or Google Workspace Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. sales@yourdomain.com or user@gmail.com"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                16-Character Google App Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="e.g. abcd efgh ijkl mnop (spaces will be stripped automatically)"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                />
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Never shared. Stored only in your secure local session.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Daily Send Quota / Manual Limit (Emails)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="2000"
                  value={sendLimit}
                  onChange={(e) => setSendLimit(Math.max(1, parseInt(e.target.value) || 500))}
                  className="w-32 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-red-500"
                />
                <span className="text-[11px] text-slate-400">
                  (Standard free Gmail limit is ~500/day; Google Workspace is ~2,000/day)
                </span>
              </div>
            </div>

            {/* Test Feedback */}
            {testResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
                testResult.success 
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200' 
                  : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold">{testResult.message}</span>
                  {testResult.latencyMs && (
                    <span className="block text-[10px] text-emerald-300/80 mt-0.5">
                      Socket Response Time: {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isVerifying}
                className="px-5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Testing Handshake...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Auto-Test & Add to Relay Pool
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
