import React, { useState } from 'react';
import { 
  Server, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Layers, 
  HelpCircle,
  Plus
} from 'lucide-react';
import { SmtpRelay } from '../types';

interface BulkSmtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRelays?: (relays: SmtpRelay[]) => void;
  onImportBulk?: (relays: SmtpRelay[]) => void;
  showToast: (msg: string) => void;
}

export const BulkSmtpModal: React.FC<BulkSmtpModalProps> = ({
  isOpen,
  onClose,
  onAddRelays,
  onImportBulk,
  showToast
}) => {
  const [inputText, setInputText] = useState('');
  const [defaultLimit, setDefaultLimit] = useState(500);

  if (!isOpen) return null;

  const detectProviderFromHost = (host: string): SmtpRelay['provider'] => {
    const h = host.toLowerCase();
    if (h.includes('gmail') || h.includes('google')) return 'gmail';
    if (h.includes('office365') || h.includes('outlook')) return 'outlook';
    if (h.includes('sendgrid')) return 'sendgrid';
    if (h.includes('amazonaws') || h.includes('ses')) return 'ses';
    if (h.includes('mailgun')) return 'mailgun';
    if (h.includes('brevo') || h.includes('sendinblue')) return 'brevo';
    if (h.includes('postmark')) return 'postmark';
    if (h.includes('zoho')) return 'zoho';
    if (h.includes('yahoo')) return 'yahoo';
    return 'custom';
  };

  const handleParseAndImport = () => {
    if (!inputText.trim()) {
      showToast('Please paste one or more SMTP server configurations.');
      return;
    }

    const lines = inputText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsedRelays: SmtpRelay[] = [];
    let failedLines = 0;

    for (const line of lines) {
      // Ignore comment lines
      if (line.startsWith('#') || line.startsWith('//')) continue;

      let host = '';
      let port = 587;
      let user = '';
      let pass = '';
      let quota = defaultLimit;

      // Format 1: host:port:user:pass:quota OR host:port:user:pass
      if (line.includes(':')) {
        const parts = line.split(':');
        if (parts.length >= 4) {
          host = parts[0].trim();
          port = parseInt(parts[1].trim()) || 587;
          user = parts[2].trim();
          // The password may contain colons if poorly escaped, but usually parts[3]
          pass = parts[3].trim();
          if (parts[4]) {
            const parsedQuota = parseInt(parts[4].trim());
            if (!isNaN(parsedQuota) && parsedQuota > 0) quota = parsedQuota;
          }
        } else if (line.includes('@')) {
          // Format 2: user:pass@host:port
          try {
            const atIndex = line.indexOf('@');
            const authPart = line.substring(0, atIndex);
            const hostPart = line.substring(atIndex + 1);

            const [u, p] = authPart.split(':');
            const [h, prt] = hostPart.split(':');

            if (u && p && h) {
              user = u.trim();
              pass = p.trim();
              host = h.trim();
              port = parseInt(prt?.trim()) || 587;
            }
          } catch {
            failedLines++;
            continue;
          }
        } else if (line.includes(',')) {
          // Format 3: CSV: host,port,user,pass,quota
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 4) {
            host = parts[0];
            port = parseInt(parts[1]) || 587;
            user = parts[2];
            pass = parts[3];
            if (parts[4]) quota = parseInt(parts[4]) || defaultLimit;
          }
        }
      }

      if (host && user && pass) {
        // Auto-detect secure: port 465 is SSL/TLS, 587/25 is STARTTLS
        const secure = port === 465;

        const provider = detectProviderFromHost(host);
        const name = `${provider.toUpperCase()} (${user.split('@')[0]})`;

        parsedRelays.push({
          id: `relay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name,
          host,
          port,
          secure,
          user,
          pass,
          provider,
          dailyQuota: quota,
          sentCount: 0,
          errorCount: 0,
          weight: 1,
          status: 'active',
          senderName: user.split('@')[0],
          fromEmail: user,
        });
      } else {
        failedLines++;
      }
    }

    if (parsedRelays.length === 0) {
      showToast('Could not recognize any valid SMTP configurations. Please check formatting.');
      return;
    }

    const importer = onImportBulk || onAddRelays;
    if (importer) {
      importer(parsedRelays);
    }
    showToast(`Successfully added ${parsedRelays.length} SMTP relay(s) to the rotational pool!`);
    if (failedLines > 0) {
      showToast(`Notice: ${failedLines} line(s) could not be parsed.`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Bulk Load Multiple SMTP Relays</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold">
                  Rotational Pool
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Load dozens or hundreds of SMTP relays to cycle dynamically 1-by-1 until limits are reached
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

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Instructions */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5 text-slate-300">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              Supported Line Formats (one per line):
            </span>
            <ul className="text-[11px] space-y-1 font-mono text-slate-400 list-disc list-inside">
              <li><code className="text-emerald-300">host:port:username:password</code> (e.g. smtp.mailgun.org:587:user@domain:pass)</li>
              <li><code className="text-emerald-300">host:port:username:password:limit</code> (e.g. smtp.gmail.com:465:john@gmail.com:pass:500)</li>
              <li><code className="text-emerald-300">username:password@host:port</code> (e.g. user:pass@mail.server.com:465)</li>
              <li><code className="text-emerald-300">host,port,username,password,limit</code> (CSV export format)</li>
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Paste Multiple SMTP Accounts:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Default Limit per Relay:</span>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={defaultLimit}
                  onChange={(e) => setDefaultLimit(Math.max(1, parseInt(e.target.value) || 500))}
                  className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono text-center"
                />
                <span className="text-[11px] text-slate-400">emails</span>
              </div>
            </div>

            <textarea
              rows={8}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="smtp.gmail.com:465:user1@gmail.com:password123:500&#10;smtp.office365.com:587:user2@company.com:mypassword:1000&#10;smtp.mailgun.org:587:postmaster@domain.com:secretkey:2000"
              className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 leading-relaxed resize-y"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <span className="text-[11px] text-slate-400">
              {inputText.split(/\r?\n/).filter(l => l.trim().length > 5).length} line(s) detected
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParseAndImport}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add All Relays to Pool
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
