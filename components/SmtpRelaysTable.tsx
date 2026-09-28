import React from 'react';
import { 
  Server, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Lock, 
  Unlock, 
  RefreshCw, 
  AlertTriangle, 
  RotateCw, 
  Zap, 
  Plus, 
  ShieldCheck, 
  Sliders, 
  BarChart2, 
  ArrowRightLeft, 
  Power,
  Layers,
  HelpCircle
} from 'lucide-react';
import { SmtpRelay, SmtpPoolConfig, LoadBalancingStrategy } from '../types';
import { calculatePoolStats } from '../services/smtpLoadBalancer';

interface SmtpRelaysTableProps {
  relays: SmtpRelay[];
  poolConfig: SmtpPoolConfig;
  onUpdatePoolConfig: (config: Partial<SmtpPoolConfig>) => void;
  onEditRelay: (relay: SmtpRelay) => void;
  onDeleteRelay: (id: string) => void;
  onTestRelay?: (relay: SmtpRelay) => void;
  onDeleteNonWorkingRelays: () => void;
  onTestAllRelays: () => void;
  onToggleRelayStatus?: (id: string) => void;
  isTestingAll: boolean;
  testingRelayId: string | null;
  editingRelayId: string | null;
  activeRelayIndex?: number;
  onOpenAddProvider?: () => void;
  onOpenBulkImport?: () => void;
  onOpenGmailAssistant?: () => void;
  onOpenDeliverabilityTest?: () => void;
  onResetQuotas?: () => void;
  lastSwitchReason?: string;
}

export const SmtpRelaysTable: React.FC<SmtpRelaysTableProps> = ({
  relays,
  poolConfig,
  onUpdatePoolConfig,
  onEditRelay,
  onDeleteRelay,
  onTestRelay,
  onDeleteNonWorkingRelays,
  onTestAllRelays,
  onToggleRelayStatus,
  isTestingAll,
  testingRelayId,
  editingRelayId,
  activeRelayIndex,
  onOpenAddProvider,
  onOpenBulkImport,
  onOpenGmailAssistant,
  onOpenDeliverabilityTest,
  onResetQuotas,
  lastSwitchReason
}) => {
  const stats = calculatePoolStats(relays);

  const getProviderBadge = (provider?: string, host?: string) => {
    const prov = provider || (host?.toLowerCase().includes('gmail') ? 'gmail' : host?.toLowerCase().includes('outlook') ? 'outlook' : 'custom');
    switch (prov) {
      case 'gmail':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-300 border border-red-500/40">Gmail / Workspace</span>;
      case 'outlook':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">Office 365</span>;
      case 'sendgrid':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">SendGrid</span>;
      case 'ses':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">Amazon SES</span>;
      case 'mailgun':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">Mailgun</span>;
      case 'brevo':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Brevo</span>;
      case 'postmark':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">Postmark</span>;
      case 'zoho':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">Zoho Mail</span>;
      default:
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40">SMTP Relay</span>;
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Top Banner: Load Balancer & Pool Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">
                Rotational SMTP Manager & Load-Balanced Pool
              </h3>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full font-semibold">
                Multi-Provider Pool
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Dynamically load-balances sending across multiple SMTP providers with error failover and quota exhaustion protection.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenAddProvider && (
            <button
              type="button"
              onClick={onOpenAddProvider}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/30"
              title="Add a new SMTP provider (Gmail, Outlook, SendGrid, SES, Mailgun, etc.)"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Provider
            </button>
          )}

          {onOpenGmailAssistant && (
            <button
              type="button"
              onClick={onOpenGmailAssistant}
              className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              title="Connect Gmail using Google App Password and auto-configuration"
            >
              <Zap className="w-3.5 h-3.5 text-red-400" />
              Gmail Auto-Sign
            </button>
          )}

          {onOpenBulkImport && (
            <button
              type="button"
              onClick={onOpenBulkImport}
              className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              title="Paste multiple SMTPs in host:port:user:pass:quota format"
            >
              <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
              Load Multiple SMTPs
            </button>
          )}

          {onOpenDeliverabilityTest && (
            <button
              type="button"
              onClick={onOpenDeliverabilityTest}
              className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white border border-amber-500/40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              title="Send a live test email directly to your personal inbox to inspect delivery"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Verify Deliverability
            </button>
          )}
        </div>
      </div>

      {/* Load Balancer Configuration Controls & Live Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-gray-950/80 rounded-xl border border-gray-800 text-xs">
        {/* Strategy Selector */}
        <div>
          <label className="block text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
            Load-Balancing Strategy
          </label>
          <select
            value={poolConfig.strategy}
            onChange={(e) => onUpdatePoolConfig({ strategy: e.target.value as LoadBalancingStrategy })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-blue-500"
          >
            <option value="round_robin">🔄 Round-Robin (Dynamic 1-by-1)</option>
            <option value="quota_fill">📈 Quota-Fill (Exhaust First, Then Next)</option>
            <option value="least_used">⚖️ Least-Used (Lowest Sent Balance)</option>
            <option value="lowest_latency">⚡ Lowest Latency (Fastest Server)</option>
            <option value="weighted">📊 Weighted Proportional Distribution</option>
          </select>
        </div>

        {/* Failover & Error Threshold */}
        <div>
          <label className="block text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            Error-Based Failover Settings
          </label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer bg-gray-900 px-2.5 py-1.5 rounded-lg border border-gray-700 flex-1 text-gray-200">
              <input
                type="checkbox"
                checked={poolConfig.autoFailover}
                onChange={(e) => onUpdatePoolConfig({ autoFailover: e.target.checked })}
                className="rounded border-gray-700 text-blue-600 focus:ring-0"
              />
              <span className="text-[11px] font-semibold">Auto-Failover on Error</span>
            </label>
            <div className="flex items-center gap-1 bg-gray-900 px-2.5 py-1.5 rounded-lg border border-gray-700">
              <span className="text-[10px] text-gray-400">Quarantine after:</span>
              <select
                value={poolConfig.maxConsecutiveErrors}
                onChange={(e) => onUpdatePoolConfig({ maxConsecutiveErrors: Number(e.target.value) })}
                className="bg-transparent text-white font-bold focus:outline-none text-[11px]"
              >
                <option value={1}>1 err</option>
                <option value={2}>2 errs</option>
                <option value={3}>3 errs</option>
                <option value={5}>5 errs</option>
              </select>
            </div>
          </div>
        </div>

        {/* Aggregated Pool Telemetry */}
        <div>
          <div className="flex items-center justify-between text-gray-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
              Pool Capacity & Quota Health
            </span>
            <span className="text-[11px] text-white font-mono">
              {stats.totalSent.toLocaleString()} / {stats.totalQuota.toLocaleString()} sent
            </span>
          </div>
          <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden border border-gray-800 p-0.5">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                stats.exhaustionPercentage > 90 
                  ? 'bg-rose-500' 
                  : stats.exhaustionPercentage > 75 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${stats.exhaustionPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
            <span>{stats.activeCount} Healthy Server{stats.activeCount === 1 ? '' : 's'}</span>
            {stats.exhaustedCount > 0 && <span className="text-amber-400 font-semibold">{stats.exhaustedCount} Quota Reached</span>}
            {stats.quarantinedCount > 0 && <span className="text-rose-400 font-semibold">{stats.quarantinedCount} Quarantined</span>}
            <span className="text-gray-300 font-mono">{stats.remainingQuota.toLocaleString()} left</span>
          </div>
        </div>
      </div>

      {/* Switch Notification Banner if active */}
      {lastSwitchReason && (
        <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl text-xs text-blue-200 flex items-center gap-2 animate-fadeIn">
          <Activity className="w-4 h-4 text-blue-400 flex-shrink-0 animate-pulse" />
          <span><strong>Load Balancer Event:</strong> {lastSwitchReason}</span>
        </div>
      )}

      {/* Action Controls for Batch Verification & Maintenance */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTestAllRelays}
            disabled={isTestingAll || relays.length === 0}
            className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Perform live TLS handshake probes on all pool servers"
          >
            {isTestingAll ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            )}
            {isTestingAll ? 'Auditing Relays...' : 'Test All Relays'}
          </button>

          {stats.totalSent > 0 && onResetQuotas && (
            <button
              type="button"
              onClick={onResetQuotas}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl border border-gray-700 transition-all flex items-center gap-1"
              title="Reset sent counters to zero for all relays in the pool"
            >
              <RefreshCw className="w-3 h-3 text-gray-400" />
              Reset All Quotas
            </button>
          )}

          {stats.quarantinedCount > 0 && (
            <button
              type="button"
              onClick={onDeleteNonWorkingRelays}
              className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 animate-pulse"
              title="Automatically remove all quarantined or non-working SMTP servers from the pool"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Purge Broken ({stats.quarantinedCount})
            </button>
          )}
        </div>

        <div className="text-[11px] text-gray-400">
          Showing {relays.length} configured server{relays.length === 1 ? '' : 's'} in pool
        </div>
      </div>

      {/* Relays Table */}
      {relays.length === 0 ? (
        <div className="py-10 text-center bg-gray-950/60 rounded-xl border border-dashed border-gray-800 text-xs text-gray-400 space-y-3">
          <Server className="w-10 h-10 mx-auto text-gray-600" />
          <p className="text-sm font-semibold text-gray-300">No SMTP provider servers in the pool yet.</p>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Add multiple SMTP relays (Gmail, SendGrid, Amazon SES, Outlook, etc.) to enable automatic load-balancing, quota rotation, and error failover.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {onOpenAddProvider && (
              <button
                type="button"
                onClick={onOpenAddProvider}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                + Add Provider Preset
              </button>
            )}
            {onOpenBulkImport && (
              <button
                type="button"
                onClick={onOpenBulkImport}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                + Bulk Load Multiple SMTPs
              </button>
            )}
            {onOpenGmailAssistant && (
              <button
                type="button"
                onClick={onOpenGmailAssistant}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                + Connect Gmail
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-950/80 text-gray-400 uppercase tracking-wider font-mono text-[10px] border-b border-gray-800">
              <tr>
                <th className="py-3 px-3.5">Provider & Host</th>
                <th className="py-3 px-3">Port & TLS</th>
                <th className="py-3 px-3">Username & Return-Path</th>
                <th className="py-3 px-3">Sent / Quota Progress</th>
                <th className="py-3 px-3">Weight</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Latency</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/80">
              {relays.map((relay, idx) => {
                const isCurrentActive = activeRelayIndex === idx;
                const isEditing = editingRelayId === relay.id;
                const isTesting = testingRelayId === relay.id;
                const quota = relay.dailyQuota || relay.hourlyQuota || 500;
                const sent = relay.sentCount || 0;
                const isLimitReached = sent >= quota;
                const pct = Math.min(100, Math.round((sent / quota) * 100));

                let statusBadge;
                if (relay.status === 'disabled') {
                  statusBadge = (
                    <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700 font-semibold">
                      Disabled
                    </span>
                  );
                } else if (relay.status === 'error' || (relay.errorCount || 0) >= (poolConfig.maxConsecutiveErrors || 3)) {
                  statusBadge = (
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/40 font-semibold flex items-center gap-1" title={relay.errorMessage || 'Quarantined due to errors'}>
                      <XCircle className="w-3 h-3 text-rose-400" />
                      Quarantined ({relay.errorCount || 1})
                    </span>
                  );
                } else if (isLimitReached || relay.status === 'exhausted') {
                  statusBadge = (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      Exhausted
                    </span>
                  );
                } else if (relay.status === 'verified') {
                  statusBadge = (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Verified Ready
                    </span>
                  );
                } else {
                  statusBadge = (
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/40 font-semibold">
                      Active
                    </span>
                  );
                }

                return (
                  <tr
                    key={relay.id}
                    className={`transition-colors ${
                      isCurrentActive 
                        ? 'bg-blue-950/40 border-l-4 border-l-blue-500' 
                        : isEditing 
                          ? 'bg-amber-950/30' 
                          : 'hover:bg-gray-800/40'
                    }`}
                  >
                    {/* Provider & Host */}
                    <td className="py-3 px-3.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          {getProviderBadge(relay.provider, relay.host)}
                          <span className="font-bold text-white text-xs">{relay.name || relay.host}</span>
                        </div>
                        <span className="text-[11px] font-mono text-gray-400">{relay.host}</span>
                      </div>
                    </td>

                    {/* Port & Security */}
                    <td className="py-3 px-3 font-mono text-[11px] text-gray-300">
                      <div className="flex items-center gap-1">
                        {relay.secure ? (
                          <Lock className="w-3 h-3 text-emerald-400" title="Implicit SSL/TLS" />
                        ) : (
                          <Unlock className="w-3 h-3 text-blue-400" title="STARTTLS" />
                        )}
                        <span>{relay.port}</span>
                        <span className="text-[10px] text-gray-500">
                          ({relay.secure ? 'SSL' : 'STARTTLS'})
                        </span>
                      </div>
                    </td>

                    {/* Username & From Identity */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="font-mono text-gray-200 text-[11px] truncate max-w-[150px]" title={relay.user}>
                          {relay.user}
                        </span>
                        {relay.fromEmail && relay.fromEmail !== relay.user && (
                          <span className="text-[10px] text-gray-400 truncate max-w-[150px]" title={`From: ${relay.fromEmail}`}>
                            From: {relay.fromEmail}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sent / Quota Progress */}
                    <td className="py-3 px-3">
                      <div className="space-y-1 w-28">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono font-semibold text-gray-300">
                            {sent} / {quota}
                          </span>
                          <span className={isLimitReached ? 'text-amber-400 font-bold' : 'text-gray-400'}>
                            {pct}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isLimitReached 
                                ? 'bg-amber-500' 
                                : pct > 75 
                                  ? 'bg-blue-400' 
                                  : 'bg-emerald-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Weight */}
                    <td className="py-3 px-3 font-mono text-[11px] text-gray-300">
                      {relay.weight || 1}x
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {statusBadge}
                    </td>

                    {/* Latency */}
                    <td className="py-3 px-3 font-mono text-[11px] text-gray-400">
                      {isTesting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      ) : relay.lastLatencyMs !== undefined ? (
                        <span className="text-gray-300">{relay.lastLatencyMs}ms</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onToggleRelayStatus && (
                          <button
                            type="button"
                            onClick={() => onToggleRelayStatus(relay.id)}
                            className={`p-1.5 rounded-lg border transition ${
                              relay.status === 'disabled'
                                ? 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white'
                                : 'bg-emerald-950/60 border-emerald-600/40 text-emerald-400 hover:bg-emerald-900/60'
                            }`}
                            title={relay.status === 'disabled' ? 'Enable Relay' : 'Disable Relay'}
                          >
                            <Power className="w-3 h-3" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onEditRelay(relay)}
                          className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg border border-gray-700 transition"
                          title="Edit Relay Configuration & Quotas"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteRelay(relay.id)}
                          className="p-1.5 bg-gray-800 hover:bg-rose-900/60 text-gray-400 hover:text-rose-300 rounded-lg border border-gray-700 transition"
                          title="Remove from Pool"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
