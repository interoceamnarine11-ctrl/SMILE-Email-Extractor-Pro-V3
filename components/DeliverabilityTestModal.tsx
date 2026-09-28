import React, { useState } from 'react';
import { 
  Send, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Server, 
  ShieldCheck, 
  Mail, 
  Info,
  X,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { SmtpRelay } from '../types';
import { safeFetchJson } from '../services/safeFetch';

interface DeliverabilityTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  relays: SmtpRelay[];
  activeRelay?: SmtpRelay | null;
  showToast: (msg: string) => void;
}

export const DeliverabilityTestModal: React.FC<DeliverabilityTestModalProps> = ({
  isOpen,
  onClose,
  relays,
  activeRelay,
  showToast
}) => {
  const [selectedRelayId, setSelectedRelayId] = useState<string>(() => {
    return activeRelay?.id || relays[0]?.id || '';
  });
  const [targetEmail, setTargetEmail] = useState<string>('4sgrnts@gmail.com');
  const [senderName, setSenderName] = useState<string>('SMILE MACHINES Deliverability Tester');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const currentRelay = relays.find(r => r.id === selectedRelayId) || activeRelay || relays[0];

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRelay) {
      showToast('Please select an SMTP server to test.');
      return;
    }
    if (!targetEmail || !targetEmail.includes('@')) {
      showToast('Please enter a valid recipient email address.');
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const payload = {
        smtpConfig: {
          host: currentRelay.host,
          port: currentRelay.port,
          secure: currentRelay.secure,
          user: currentRelay.user,
          pass: currentRelay.pass
        },
        targetEmail: targetEmail.trim(),
        senderName: senderName.trim()
      };

      const res = await safeFetchJson<any>('/api/smtp/test-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok && res.data && res.data.success) {
        setResult({
          success: true,
          message: res.data.message,
          response: res.data.response,
          messageId: res.data.messageId,
          latencyMs: res.data.latencyMs,
          envelope: res.data.envelope
        });
        showToast(`Deliverability test email sent to ${targetEmail}! Check your inbox.`);
      } else {
        setResult({
          success: false,
          error: res.data?.error || res.error || 'Failed to dispatch test email',
          code: res.data?.code,
          response: res.data?.response
        });
        showToast('Test email failed. Inspect error report below.');
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || 'Network exception during test'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Live Inbox Deliverability Verification</h3>
              <p className="text-xs text-slate-400">
                Send a real test email to your personal inbox to confirm delivery, Return-Path SPF, and spam filters.
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
        <form onSubmit={handleSendTest} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* SMTP Server Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select SMTP Relay Server to Test
            </label>
            {relays.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                No SMTP servers loaded in the pool yet. Add servers first to run deliverability tests.
              </div>
            ) : (
              <select
                value={selectedRelayId}
                onChange={(e) => setSelectedRelayId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {relays.map((relay) => (
                  <option key={relay.id} value={relay.id}>
                    {relay.name || relay.host} - {relay.user} ({relay.port} {relay.secure ? 'SSL' : 'TLS'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Target Email Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Inbox (Your Email Address)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="e.g. yourname@gmail.com"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Enter your Gmail or work address where you can inspect delivery in real time.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Sender Display Name
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Sales Team"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Explanatory Deliverability Notice */}
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-blue-400">
              <Info className="w-3.5 h-3.5" />
              <span>Why Emails Might Not Deliver or Land in Spam:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
              <li><strong>From Header Mismatch:</strong> If your sender address does not match your authenticated SMTP account (e.g. sending as <code>@company.com</code> via a free Gmail relay), Gmail and Microsoft will reject it or flag it as spoofing.</li>
              <li><strong>Missing Return-Path / SPF:</strong> SMILE MACHINES now automatically aligns the SMTP envelope Return-Path with your authenticated user account.</li>
              <li><strong>Spam Trigger Headers:</strong> Headers like <code>Precedence: bulk</code> have been cleaned up to guarantee normal inbox prioritization.</li>
            </ul>
          </div>

          {/* Test Results Display */}
          {result && (
            <div className={`p-4 rounded-xl border ${result.success ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-rose-950/40 border-rose-500/40'} space-y-2.5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className={`text-xs font-bold ${result.success ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {result.success ? 'Delivered to SMTP Relay!' : 'SMTP Dispatch Error'}
                  </span>
                </div>
                {result.latencyMs && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {result.latencyMs}ms latency
                  </span>
                )}
              </div>

              {result.success ? (
                <div className="text-xs text-slate-300 space-y-1 font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-slate-800">
                  <p><span className="text-slate-500">Response:</span> <span className="text-emerald-400">{result.response}</span></p>
                  <p><span className="text-slate-500">Message-ID:</span> <span className="text-slate-300">{result.messageId}</span></p>
                  {result.envelope && (
                    <p><span className="text-slate-500">Envelope:</span> from: {result.envelope.from} &rarr; to: {result.envelope.to?.join(', ')}</p>
                  )}
                </div>
              ) : (
                <div className="text-xs text-rose-300 space-y-1 bg-black/40 p-2.5 rounded-lg border border-rose-900/60 font-mono text-[11px]">
                  <p><strong>Error:</strong> {result.error}</p>
                  {result.code && <p><strong>Code:</strong> {result.code}</p>}
                  {result.response && <p><strong>Server Response:</strong> {result.response}</p>}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSending || relays.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Testing Delivery...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Send Test Email to My Inbox
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
