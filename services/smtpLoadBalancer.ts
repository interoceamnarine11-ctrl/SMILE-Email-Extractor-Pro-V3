import { SmtpRelay, SmtpPoolConfig, LoadBalancingStrategy, SmtpProviderType } from '../types';

export interface ProviderPreset {
  id: SmtpProviderType;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  defaultDailyQuota: number;
  description: string;
  authTip: string;
  badgeColor: string;
}

export const SMTP_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'gmail',
    name: 'Google Workspace / Gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    defaultDailyQuota: 500,
    description: 'Requires 2-Step Verification + 16-character Google App Password.',
    authTip: 'Generate an App Password at myaccount.google.com/apppasswords',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40'
  },
  {
    id: 'outlook',
    name: 'Microsoft 365 / Outlook',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    defaultDailyQuota: 1000,
    description: 'Requires SMTP AUTH enabled in Microsoft 365 Admin Center.',
    authTip: 'Use your full Microsoft 365 email and password or App Password',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
  },
  {
    id: 'sendgrid',
    name: 'Twilio SendGrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    defaultDailyQuota: 25000,
    description: 'Username is always "apikey". Password is your SendGrid API Key (starts with SG.).',
    authTip: 'Username: apikey | Password: SG.xxxxxxxx',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
  },
  {
    id: 'ses',
    name: 'Amazon Simple Email Service (SES)',
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    secure: false,
    defaultDailyQuota: 50000,
    description: 'Use your AWS SES SMTP Credentials (not IAM Access Key directly).',
    authTip: 'Obtain SMTP credentials from AWS SES Console -> SMTP Settings',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  {
    id: 'mailgun',
    name: 'Mailgun by Sinch',
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    defaultDailyQuota: 10000,
    description: 'Use the domain SMTP credentials provided in the Mailgun dashboard.',
    authTip: 'Username: postmaster@yourdomain.com | Password: from Mailgun dashboard',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
  },
  {
    id: 'brevo',
    name: 'Brevo (formerly Sendinblue)',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    defaultDailyQuota: 3000,
    description: 'Master SMTP API login found in Brevo SMTP & API settings.',
    authTip: 'Username: login email | Password: Master SMTP Key',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  {
    id: 'postmark',
    name: 'Postmark',
    host: 'smtp.postmarkapp.com',
    port: 587,
    secure: false,
    defaultDailyQuota: 10000,
    description: 'High deliverability transactional server. Server API token used as user & pass.',
    authTip: 'Both username and password are your Postmark Server API Token',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
  },
  {
    id: 'zoho',
    name: 'Zoho Mail Professional',
    host: 'smtppro.zoho.com',
    port: 465,
    secure: true,
    defaultDailyQuota: 500,
    description: 'Requires Application-Specific Password if 2FA is active.',
    authTip: 'Generate an App Password in Zoho Accounts -> Security -> App Passwords',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail / AOL',
    host: 'smtp.mail.yahoo.com',
    port: 465,
    secure: true,
    defaultDailyQuota: 500,
    description: 'Requires Yahoo App Password generated in Account Security.',
    authTip: 'Generate App Password in Yahoo Account Settings -> Security',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40'
  },
  {
    id: 'custom',
    name: 'Custom cPanel / Linux MTA Server',
    host: 'mail.yourdomain.com',
    port: 587,
    secure: false,
    defaultDailyQuota: 1000,
    description: 'Direct Postfix/Exim/cPanel mail server with custom limits.',
    authTip: 'Standard mail client port 587 (STARTTLS) or 465 (SSL/TLS)',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40'
  }
];

export interface PoolStats {
  totalRelays: number;
  activeCount: number;
  exhaustedCount: number;
  quarantinedCount: number;
  totalQuota: number;
  totalSent: number;
  remainingQuota: number;
  exhaustionPercentage: number;
}

/**
 * Calculates aggregated quota and health statistics for the SMTP pool.
 */
export function calculatePoolStats(relays: SmtpRelay[]): PoolStats {
  const totalRelays = relays.length;
  let activeCount = 0;
  let exhaustedCount = 0;
  let quarantinedCount = 0;
  let totalQuota = 0;
  let totalSent = 0;

  for (const r of relays) {
    const quota = r.dailyQuota || r.hourlyQuota || 500;
    const sent = r.sentCount || 0;
    totalQuota += quota;
    totalSent += sent;

    if (r.status === 'error') {
      quarantinedCount++;
    } else if (sent >= quota || r.status === 'exhausted') {
      exhaustedCount++;
    } else if (r.status !== 'disabled') {
      activeCount++;
    }
  }

  const remainingQuota = Math.max(0, totalQuota - totalSent);
  const exhaustionPercentage = totalQuota > 0 ? Math.min(100, Math.round((totalSent / totalQuota) * 100)) : 0;

  return {
    totalRelays,
    activeCount,
    exhaustedCount,
    quarantinedCount,
    totalQuota,
    totalSent,
    remainingQuota,
    exhaustionPercentage
  };
}

/**
 * Checks whether an individual relay is currently eligible to send.
 */
export function isRelayEligible(relay: SmtpRelay, maxConsecutiveErrors = 3): boolean {
  if (relay.status === 'disabled' || relay.status === 'error') return false;
  if ((relay.errorCount || 0) >= maxConsecutiveErrors) return false;
  const quota = relay.dailyQuota || relay.hourlyQuota || 500;
  const sent = relay.sentCount || 0;
  return sent < quota;
}

/**
 * Selects the next eligible relay server from the pool using the chosen load balancing strategy.
 */
export function selectNextRelayFromPool(
  relays: SmtpRelay[],
  strategy: LoadBalancingStrategy,
  lastIndex: number,
  maxConsecutiveErrors = 3
): { relay: SmtpRelay; index: number } | null {
  if (!relays || relays.length === 0) return null;

  // Filter only relays that are healthy and under quota limit
  const eligibleWithIndex = relays
    .map((r, i) => ({ relay: r, originalIndex: i }))
    .filter(({ relay }) => isRelayEligible(relay, maxConsecutiveErrors));

  if (eligibleWithIndex.length === 0) {
    return null; // All relays in pool are exhausted or in error!
  }

  switch (strategy) {
    case 'quota_fill': {
      // Greedy strategy: fill server 0 until full, then server 1, etc.
      return { relay: eligibleWithIndex[0].relay, index: eligibleWithIndex[0].originalIndex };
    }

    case 'least_used': {
      // Pick the relay with the lowest sent count
      const sorted = [...eligibleWithIndex].sort((a, b) => (a.relay.sentCount || 0) - (b.relay.sentCount || 0));
      return { relay: sorted[0].relay, index: sorted[0].originalIndex };
    }

    case 'lowest_latency': {
      // Pick relay with fastest latency probe
      const sorted = [...eligibleWithIndex].sort((a, b) => (a.relay.lastLatencyMs || 9999) - (b.relay.lastLatencyMs || 9999));
      return { relay: sorted[0].relay, index: sorted[0].originalIndex };
    }

    case 'weighted': {
      // Weighted distribution based on configured weight (default 1)
      const totalWeight = eligibleWithIndex.reduce((sum, item) => sum + Math.max(1, item.relay.weight || 1), 0);
      let randomVal = Math.random() * totalWeight;
      for (const item of eligibleWithIndex) {
        randomVal -= Math.max(1, item.relay.weight || 1);
        if (randomVal <= 0) {
          return { relay: item.relay, index: item.originalIndex };
        }
      }
      return { relay: eligibleWithIndex[0].relay, index: eligibleWithIndex[0].originalIndex };
    }

    case 'round_robin':
    default: {
      // Sequential rotation through eligible servers
      const nextCandidate = eligibleWithIndex.find(item => item.originalIndex > lastIndex);
      if (nextCandidate) {
        return { relay: nextCandidate.relay, index: nextCandidate.originalIndex };
      }
      // Wrap around to the first eligible server
      return { relay: eligibleWithIndex[0].relay, index: eligibleWithIndex[0].originalIndex };
    }
  }
}

/**
 * Updates pool state upon successful send:
 * - Increments sentCount
 * - Resets consecutive errorCount to 0
 * - If quota reached, updates status to 'exhausted'
 */
export function recordSendSuccess(relays: SmtpRelay[], relayId: string): SmtpRelay[] {
  return relays.map(r => {
    if (r.id !== relayId) return r;
    const newSent = (r.sentCount || 0) + 1;
    const quota = r.dailyQuota || r.hourlyQuota || 500;
    const isExhausted = newSent >= quota;

    return {
      ...r,
      sentCount: newSent,
      errorCount: 0,
      errorMessage: undefined,
      lastUsedTimestamp: Date.now(),
      status: isExhausted ? 'exhausted' : (r.status === 'testing' ? 'verified' : r.status)
    };
  });
}

/**
 * Updates pool state upon send failure:
 * - Increments errorCount
 * - If errorCount >= maxConsecutiveErrors, quarantines the relay (status = 'error')
 */
export function recordSendFailure(
  relays: SmtpRelay[],
  relayId: string,
  errorMessage: string,
  maxConsecutiveErrors = 3
): { updatedRelays: SmtpRelay[]; wasQuarantined: boolean; relayName: string } {
  let wasQuarantined = false;
  let relayName = relayId;

  const updatedRelays = relays.map(r => {
    if (r.id !== relayId) return r;
    relayName = r.name || `${r.host} (${r.user})`;
    const newErrors = (r.errorCount || 0) + 1;
    const shouldQuarantine = newErrors >= maxConsecutiveErrors;
    if (shouldQuarantine) wasQuarantined = true;

    return {
      ...r,
      errorCount: newErrors,
      errorMessage,
      status: shouldQuarantine ? ('error' as const) : r.status
    };
  });

  return { updatedRelays, wasQuarantined, relayName };
}
