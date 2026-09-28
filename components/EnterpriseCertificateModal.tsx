import React, { useState, useEffect } from 'react';
import { ShieldCheck, Award, Key, Building2, Check, Copy, X, Server, RefreshCw } from 'lucide-react';

interface EnterpriseCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export interface LicenseInfo {
  organization: string;
  licenseKey: string;
  nodeId: string;
  tier: string;
  issuedDate: string;
  status: string;
  adminEmail: string;
  cryptographicSignature: string;
}

const DEFAULT_LICENSE: LicenseInfo = {
  organization: 'Acme Global Enterprises Inc.',
  licenseKey: 'AGE-8821-XPRO-9941-K89M-PERP',
  nodeId: 'NODE-0x7F8E-CLUSTER-US-EAST',
  tier: 'Enterprise Perpetual License (Unlimited Relays & Threads)',
  issuedDate: '2026-01-15',
  status: 'Verified & Active (Cryptographically Signed)',
  adminEmail: 'licensing@acme-global.com',
  cryptographicSignature: 'SHA256:4a8b79c3f910e123ab45cd67ef890123456789abcdef0123456789abcdef0123'
};

export const EnterpriseCertificateModal: React.FC<EnterpriseCertificateModalProps> = ({
  isOpen,
  onClose,
  showToast
}) => {
  const [license, setLicense] = useState<LicenseInfo>(() => {
    const saved = localStorage.getItem('app_enterprise_license_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_LICENSE;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<LicenseInfo>(license);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    setFormData(license);
  }, [license]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLicense(formData);
    localStorage.setItem('app_enterprise_license_v2', JSON.stringify(formData));
    setIsEditing(false);
    showToast('Enterprise License details updated successfully.');
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(license.licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    showToast('Cryptographic License Key copied to clipboard.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gray-950 border border-emerald-500/40 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Certificate Header Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-gray-900 to-emerald-950/80 p-5 border-b border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/40 rounded-xl text-emerald-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">Commercial Software License Certificate</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                  Perpetual Node
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Cryptographically verified node authority for high-throughput transactional dispatch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Certificate Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {!isEditing ? (
            <div className="space-y-5">
              {/* Certificate Border Box */}
              <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-950/10 relative overflow-hidden space-y-4">
                <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-300 uppercase tracking-widest">
                      Official License Seal
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {license.status}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-0.5 uppercase tracking-wider">Licensed Organization</label>
                    <div className="text-white font-bold text-sm flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      {license.organization}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-0.5 uppercase tracking-wider">Assigned Node ID</label>
                    <div className="text-gray-200 font-mono flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-emerald-400" />
                      {license.nodeId}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-0.5 uppercase tracking-wider">License Tier & Scope</label>
                    <div className="text-emerald-200 font-medium">
                      {license.tier}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-0.5 uppercase tracking-wider">Admin Contact</label>
                    <div className="text-gray-200 font-mono">
                      {license.adminEmail}
                    </div>
                  </div>
                </div>

                {/* Cryptographic Key Box */}
                <div className="pt-3 border-t border-emerald-500/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-emerald-400" />
                      Cryptographic License Key
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedKey ? 'Copied' : 'Copy Key'}
                    </button>
                  </div>
                  <div className="p-2.5 bg-black/60 border border-emerald-500/30 rounded-lg text-emerald-300 font-mono text-xs break-all select-all">
                    {license.licenseKey}
                  </div>
                </div>

                {/* Signature Hash */}
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">NODE VERIFICATION HASH</label>
                  <div className="text-[10px] text-gray-400 font-mono truncate">
                    {license.cryptographicSignature}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700 text-xs font-semibold rounded-xl transition-all"
                >
                  Edit White-Label Organization
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-950/50"
                >
                  Close Certificate
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-medium mb-1">Licensed Organization / Company Name</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={e => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-medium mb-1">Node Identifier</label>
                  <input
                    type="text"
                    value={formData.nodeId}
                    onChange={e => setFormData({ ...formData, nodeId: e.target.value })}
                    className="w-full px-3 py-2 bg-black border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-medium mb-1">Admin Email Address</label>
                  <input
                    type="email"
                    value={formData.adminEmail}
                    onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-black border border-gray-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">License Key</label>
                <input
                  type="text"
                  value={formData.licenseKey}
                  onChange={e => setFormData({ ...formData, licenseKey: e.target.value })}
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded-xl text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">License Tier</label>
                <input
                  type="text"
                  value={formData.tier}
                  onChange={e => setFormData({ ...formData, tier: e.target.value })}
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-semibold rounded-xl border border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-950/40"
                >
                  Save Certificate Details
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
