import { GoogleGenAI } from '@google/genai';
import { isPublicDomain } from '../constants/domains';
import { parseNameFromEmail, isRoleBasedEmail, capitalizeWord } from './nameParser';

const COUNTRY_CCTLD_MAP: Record<string, string> = {
  germany: 'de', de: 'de', deutschland: 'de', china: 'cn', cn: 'cn',
  italy: 'it', it: 'it', japan: 'jp', jp: 'jp', 'south korea': 'kr',
  korea: 'kr', kr: 'kr', 'united states': 'us', usa: 'us', us: 'us',
  'united kingdom': 'co.uk', uk: 'uk', france: 'fr', fr: 'fr',
  spain: 'es', es: 'es', canada: 'ca', ca: 'ca', australia: 'com.au',
  brazil: 'com.br', india: 'in', in: 'in', netherlands: 'nl', nl: 'nl',
  switzerland: 'ch', ch: 'ch', sweden: 'se', poland: 'pl', turkey: 'com.tr',
  vietnam: 'vn', mexico: 'mx', uae: 'ae', 'saudi arabia': 'sa'
};

export function getCountryCcTLD(country: string): string {
  if (!country || !country.trim()) return 'com';
  const norm = country.trim().toLowerCase();
  if (COUNTRY_CCTLD_MAP[norm]) return COUNTRY_CCTLD_MAP[norm];
  if (/^[a-z]{2}$/.test(norm)) return norm;
  for (const [key, code] of Object.entries(COUNTRY_CCTLD_MAP)) {
    if (norm.includes(key) || key.includes(norm)) return code;
  }
  const letters = norm.replace(/[^a-z]/g, '');
  return letters.length >= 2 ? letters.slice(0, 2) : 'com';
}

export interface DiscoveredLead {
  email: string;
  companyName: string;
  sourceUrl: string;
  country: string;
  isValid: boolean;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  role?: string;
  phone?: string;
  isRoleBased?: boolean;
  mxStatus?: 'valid' | 'invalid' | 'unknown' | 'unverified';
  mxProvider?: string;
  confidenceScore?: number;
  extractedAt?: string;
  searchEngine?: string;
  page?: number;
  isNew?: boolean;
}

export interface SearchHit {
  title: string;
  url: string;
  snippet?: string;
  engine?: string;
  page?: number;
}

export interface ExecutiveContact {
  companyName: string;
  websiteUrl: string;
  type: string;
  country: string;
  ceoName: string;
  role: string;
  derivedEmail: string;
  confidence: number;
}

const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const MAILTO_REGEX = /href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[^"']*["']/gi;
const OBFUSCATED_REGEX = /([a-zA-Z0-9._%+-]+)\s*(?:\[@\]|\[at\]|\(at\)|\{\s*at\s*\}|<\s*at\s*>|\[\s*at\s*\]|\(\s*at\s*\)|\s+at\s+|\s+AT\s+|&#64;|&commat;|&#x40;|%40)\s*([a-zA-Z0-9.-]+)\s*(?:\.|\s*(?:\[dot\]|\(dot\)|\{\s*dot\s*\}|\[\s*punkt\s*\]|\(\s*punkt\s*\)|\s+dot\s+|\s+DOT\s+))\s*([a-zA-Z]{2,})/gi;

const DISALLOWED_EMAIL_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.css', '.js', '.woff', '.woff2'];

// Government & Academic / Educational TLDs to strictly filter out:
export const GOV_EDU_PATTERNS = [
  '.gov', '.mil', '.gouv.', '.gob.', '.go.jp', '.go.kr', '.go.id', '.go.th',
  '.gv.at', '.admin.ch', '.gov.uk', '.gov.in', '.gov.cn', '.gov.au', '.gov.br',
  '.gov.it', '.gov.za', '.europa.eu', '.bund.', '.etat.', '.bundestag.',
  '.edu', '.ac.uk', '.ac.in', '.ac.jp', '.ac.kr', '.ac.nz', '.ac.za',
  '.ac.at', '.ac.be', '.edu.cn', '.edu.au', '.edu.sg', '.edu.hk',
  '.edu.my', '.edu.tw', '.edu.tr', '.edu.eg', '.edu.ng', '.edu.pk',
  '.edu.ph', '.edu.co', '.edu.ar', '.edu.br', '.edu.mx', '.school.nz',
  '.k12.', '.school.', 'parliament.uk', 'bund.de', 'senat.fr'
];

export function isGovOrEduEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;
  for (const pat of GOV_EDU_PATTERNS) {
    if (domain.endsWith(pat) || domain.includes(pat)) return true;
  }
  return false;
}

// Aggregator, directory and social domains to exclude
export const AGGREGATOR_DOMAINS = [
  'booking.com', 'trivago', 'tripadvisor', 'expedia', 'yelp', 'yellowpages',
  'lastminute.com', 'hotels.com', 'trustpilot.com', 'agoda.com', 'airbnb',
  'kayak', 'skyscanner', 'wikipedia.org', 'wikidata.org', 'britannica.com',
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
  'youtube.com', 'pinterest.com', 'reddit.com', 'github.com', 'bloomberg.com',
  'reuters.com', 'forbes.com', 'glassdoor', 'indeed', 'crunchbase.com',
  'medium.com', 'quora.com', 'amazon', 'ebay', 'alibaba.com', 'aliexpress.com',
  'walmart.com', 'apple.com', 'microsoft.com', 'cloudflare.com', 'sentry.io',
  'wixpress.com', 'schema.org', 'w3.org', 'google.com', 'bing.com', 'duckduckgo.com',
  'nhs.net', 'gov.uk', 'parliament.uk', 'europa.eu', 'who.int', 'un.org'
];

const DISALLOWED_DOMAINS = [
  'example.com', 'email.com', 'domain.com', 'sample.com', 'sentry.io',
  'wixpress.com', 'schema.org', 'w3.org', 'github.com', 'google.com',
  'bing.com', 'duckduckgo.com', 'cloudflare.com', 'yourdomain.com', 'yourcompany.com',
  ...AGGREGATOR_DOMAINS
];

// Standard B2B Executive & Commercial Roles for role extraction
export const B2B_ROLE_DICTIONARY: Array<{ pattern: RegExp; roleName: string }> = [
  { pattern: /\b(?:managing\s+director|geschäftsführer|geschaeftsfuehrer|directeur\s+général|direttore\s+generale)\b/i, roleName: 'Managing Director' },
  { pattern: /\b(?:chief\s+executive\s+officer|ceo|chief\s+executive)\b/i, roleName: 'Chief Executive Officer' },
  { pattern: /\b(?:founder|co-founder|mitgründer|fondateur|fondatore)\b/i, roleName: 'Founder / Co-Founder' },
  { pattern: /\b(?:president|owner|inhaber|proprietario|propriétaire)\b/i, roleName: 'President / Owner' },
  { pattern: /\b(?:head\s+of\s+sales|sales\s+director|vertriebsleiter|directeur\s+commercial|director\s+de\s+ventas|direttore\s+commerciale)\b/i, roleName: 'Sales Director' },
  { pattern: /\b(?:head\s+of\s+export|export\s+manager|exportleiter|directeur\s+export|international\s+sales)\b/i, roleName: 'Export Manager' },
  { pattern: /\b(?:head\s+of\s+procurement|procurement\s+manager|purchasing\s+director|einkaufsleiter|responsable\s+achats)\b/i, roleName: 'Procurement Director' },
  { pattern: /\b(?:chief\s+operating\s+officer|coo|operations\s+director|betriebsleiter|directeur\s+des\s+opérations)\b/i, roleName: 'COO / Operations Director' },
  { pattern: /\b(?:chief\s+technology\s+officer|cto|technical\s+director|head\s+of\s+engineering|technischer\s+leiter)\b/i, roleName: 'CTO / Technical Director' },
  { pattern: /\b(?:chief\s+financial\s+officer|cfo|finance\s+director|financieel\s+directeur|kaufmännischer\s+leiter)\b/i, roleName: 'CFO / Finance Director' },
  { pattern: /\b(?:general\s+manager|gm|directeur\s+général)\b/i, roleName: 'General Manager' },
  { pattern: /\b(?:commercial\s+director|kaufmännische\s+leitung)\b/i, roleName: 'Commercial Director' },
  { pattern: /\b(?:plant\s+manager|factory\s+manager|works\s+manager|werkstattleiter|werkleiter)\b/i, roleName: 'Plant / Works Manager' },
  { pattern: /\b(?:business\s+development\s+manager|bdm)\b/i, roleName: 'Business Development Manager' },
  { pattern: /\b(?:head\s+of\s+marketing|marketing\s+director|marketingleiter)\b/i, roleName: 'Marketing Director' },
  { pattern: /\b(?:sales\s+manager|account\s+manager|vertriebsmanager)\b/i, roleName: 'Sales Manager' },
  { pattern: /\b(?:procurement\s+officer|purchaser|einkäufer)\b/i, roleName: 'Procurement Specialist' },
  { pattern: /\b(?:customer\s+service\s+manager|kundenservice)\b/i, roleName: 'Customer Relations Lead' }
];

export function deobfuscateEmailText(text: string): string {
  if (!text) return '';
  let s = text;

  s = s.replace(/&#64;|&commat;|&#x40;|%40/gi, '@');
  s = s.replace(/&#46;|&#x2E;|%2E/gi, '.');
  s = s.replace(/\[\s*@\s*\]|\(\s*@\s*\)|\{\s*@\s*\}/g, '@');
  s = s.replace(/\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\}|<\s*at\s*>|\/\s*at\s*\//gi, '@');
  s = s.replace(/\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|\[\s*punkt\s*\]|\(\s*punkt\s*\)/gi, '.');
  s = s.replace(/([a-zA-Z0-9._%+-]+)\s+(?:at|AT)\s+([a-zA-Z0-9.-]+)/g, '$1@$2');
  s = s.replace(/([a-zA-Z0-9.-]+)\s+(?:dot|DOT)\s+([a-zA-Z]{2,})/g, '$1.$2');
  s = s.replace(/([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/g, '$1@$2.$3');

  return s;
}

export function cleanEmail(rawEmail: string): string | null {
  let em = rawEmail.toLowerCase().trim().replace(/^[.<>,"'\s]+|[.<>,"'\s]+$/g, '');
  if (!em || !em.includes('@')) return null;
  const [user, domain] = em.split('@');
  if (!user || !domain || !domain.includes('.')) return null;

  if (isGovOrEduEmail(em)) return null;

  const isPublicWebmail = isPublicDomain(domain);

  if (domain.includes('example') || user.includes('example') || user === 'test' || user === 'user' || user === 'sample' || user === 'name') {
    return null;
  }
  for (const ext of DISALLOWED_EMAIL_EXTS) {
    if (em.endsWith(ext) || domain.endsWith(ext)) return null;
  }

  if (!isPublicWebmail) {
    for (const dis of DISALLOWED_DOMAINS) {
      if (domain === dis || domain.includes(dis)) return null;
    }
  }

  if (user.includes('noreply') || user.includes('no-reply') || user.includes('donotreply') || user.includes('mailer-daemon') || user.includes('postmaster')) {
    return null;
  }
  return em;
}

export function cleanCompanyName(rawTitle: string, domain?: string): string {
  if (!rawTitle && domain) {
    const d = domain.replace(/^www\./, '').split('.')[0];
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
  let clean = (rawTitle || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, ' ')
    .replace(/<[^>]*>/g, '')
    .trim();

  clean = clean.replace(/^(?:welcome to|home of|official site of|about|contact)\s+/i, '');

  const parts = clean.split(/[-–—|:·]/).map(p => p.trim()).filter(Boolean);
  if (parts.length > 0) {
    for (const p of parts) {
      if (p.length >= 2 && p.length <= 50 && !p.toLowerCase().startsWith('http') && !/^(what is|top \d+|best \d+|\d+ best|cheap|compare|find|welcome)/i.test(p)) {
        return p;
      }
    }
    const first = parts[0];
    if (first.length >= 2 && first.length <= 50 && !first.toLowerCase().startsWith('http')) {
      return first;
    }
  }

  if (domain) {
    const d = domain.replace(/^www\./, '').split('.')[0];
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
  return clean.slice(0, 45) || 'Corporate Enterprise';
}

/**
 * Extracts phone numbers from HTML text and tel: links
 */
export function extractPhoneNumbersFromHtml(html: string): string[] {
  if (!html) return [];
  const found = new Set<string>();

  // 1. tel: links
  const telMatches = html.matchAll(/href=["']tel:([+0-9\s()./-]+)["']/gi);
  for (const tm of telMatches) {
    const raw = tm[1].trim().replace(/[^\d+]/g, '');
    if (raw.length >= 7 && raw.length <= 16) {
      found.add(raw.startsWith('+') ? raw : `+${raw}`);
    }
  }

  // 2. Standard international telephone regex (+49 ..., +1 ..., +44 ...)
  const intlRegex = /(?:\+|00)(\d{1,3})[\s.-]?(?:\(?0\)?[\s.-]?)?(\d{1,4})[\s.-]?(\d{2,4})[\s.-]?(\d{2,6})/g;
  const intlMatches = html.match(intlRegex) || [];
  for (const m of intlMatches) {
    const digits = m.replace(/[^\d+]/g, '');
    if (digits.length >= 8 && digits.length <= 16 && !digits.startsWith('192168') && !digits.startsWith('100')) {
      const clean = m.trim().replace(/\s+/g, ' ');
      found.add(clean.startsWith('00') ? '+' + clean.slice(2) : clean);
    }
  }

  return Array.from(found);
}

/**
 * Discovers the closest phone number, role and person name near a specific email address in HTML
 */
export function findBestContactDetailsNearEmail(
  html: string,
  email: string
): { phone?: string; role?: string; fullName?: string; firstName?: string; lastName?: string } {
  if (!html || !email) return {};

  const emailIdx = html.toLowerCase().indexOf(email.toLowerCase());
  let windowText = '';

  if (emailIdx !== -1) {
    const start = Math.max(0, emailIdx - 350);
    const end = Math.min(html.length, emailIdx + 350);
    windowText = html.slice(start, end).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  } else {
    windowText = html.slice(0, 1500);
  }

  // 1. Find phone in window or entire page
  let detectedPhone: string | undefined;
  const phonesInWindow = extractPhoneNumbersFromHtml(windowText);
  if (phonesInWindow.length > 0) {
    detectedPhone = phonesInWindow[0];
  } else {
    const pagePhones = extractPhoneNumbersFromHtml(html);
    if (pagePhones.length > 0) {
      detectedPhone = pagePhones[0];
    }
  }

  // 2. Find role in window
  let detectedRole: string | undefined;
  for (const { pattern, roleName } of B2B_ROLE_DICTIONARY) {
    if (pattern.test(windowText)) {
      detectedRole = roleName;
      break;
    }
  }

  // 3. Extract Name: first try username parsing, then proximity check
  const parsedFromName = parseNameFromEmail(email);
  let firstName = parsedFromName.firstName;
  let lastName = parsedFromName.lastName;
  let fullName = parsedFromName.fullName;

  // Proximity name extraction if email was generic role
  if (!fullName && detectedRole) {
    const plainWindow = windowText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const nameMatch = plainWindow.match(/(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)?\s*([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,20})/);
    if (nameMatch && !nameMatch[1].toLowerCase().includes('contact') && !nameMatch[1].toLowerCase().includes('company')) {
      const parts = nameMatch[1].split(' ');
      firstName = capitalizeWord(parts[0]);
      lastName = capitalizeWord(parts[1]);
      fullName = `${firstName} ${lastName}`;
    }
  }

  return {
    phone: detectedPhone,
    role: detectedRole,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    fullName: fullName || undefined
  };
}

export function extractEmailsFromHtml(html: string): string[] {
  const found = new Set<string>();
  if (!html) return [];

  const deobfuscated = deobfuscateEmailText(html);

  const bodyMatches = deobfuscated.match(EMAIL_REGEX) || [];
  for (const m of bodyMatches) {
    const cleaned = cleanEmail(m);
    if (cleaned) found.add(cleaned);
  }

  const mailtoMatches = Array.from(html.matchAll(MAILTO_REGEX));
  for (const m of mailtoMatches) {
    try {
      const rawTarget = decodeURIComponent(m[1].replace(/&amp;/g, '&'));
      const deobfTarget = deobfuscateEmailText(rawTarget);
      const match = deobfTarget.match(EMAIL_REGEX);
      if (match) {
        for (const em of match) {
          const cleaned = cleanEmail(em);
          if (cleaned) found.add(cleaned);
        }
      }
    } catch {
      const cleaned = cleanEmail(m[1]);
      if (cleaned) found.add(cleaned);
    }
  }

  const obfMatches = Array.from(html.matchAll(OBFUSCATED_REGEX));
  for (const m of obfMatches) {
    const candidate = `${m[1]}@${m[2]}.${m[3]}`;
    const cleaned = cleanEmail(candidate);
    if (cleaned) found.add(cleaned);
  }

  return Array.from(found);
}

export function extractCleanKeywordsAndCountry(rawQuery: string, fallbackCountry = 'N/A'): { keywords: string; country: string } {
  let q = rawQuery || '';

  let detectedCountry = fallbackCountry;
  const siteMatch = q.match(/site:\.?([a-zA-Z.]+)/i);
  if (siteMatch) {
    const tld = siteMatch[1].toLowerCase().replace(/^\./, '');
    const map: Record<string, string> = {
      de: 'Germany', cn: 'China', it: 'Italy', jp: 'Japan', kr: 'South Korea',
      uk: 'United Kingdom', 'co.uk': 'United Kingdom', fr: 'France', es: 'Spain',
      ca: 'Canada', 'com.au': 'Australia', 'com.br': 'Brazil', in: 'India',
      nl: 'Netherlands', ch: 'Switzerland', se: 'Sweden', pl: 'Poland',
      'com.tr': 'Turkey', vn: 'Vietnam', mx: 'Mexico', ae: 'UAE', us: 'United States'
    };
    if (map[tld]) detectedCountry = map[tld];
  }

  q = q.replace(/site:\S+/gi, ' ');
  q = q.replace(/inurl:\S+/gi, ' ');
  q = q.replace(/filetype:\S+/gi, ' ');
  q = q.replace(/intitle:\S+/gi, ' ');
  q = q.replace(/["'()]/g, ' ');
  q = q.replace(/(?:^|\s)(?:info|contact|sales|export|procurement|office|support|inquiry)?@\S*/gi, ' ');
  q = q.replace(/\b(?:contact\s+us|contact|sales|export|procurement|suppliers|manufacturers|distributors|dealers|email|emails|OR|AND)\b/gi, ' ');
  q = q.replace(/\s+/g, ' ').trim();

  const keywords = q || 'Manufacturing Industry';
  return { keywords, country: detectedCountry };
}

// User-Agents Pool for rotating requests
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Bing organic search crawler with pagination support (Page 1 to 100+)
 */
export async function searchBingEngine(query: string, page = 1, maxResults = 10): Promise<SearchHit[]> {
  const cleanQuery = query.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  const firstOffset = Math.max(1, (page - 1) * 10 + 1);
  const url = `https://www.bing.com/search?q=${encodeURIComponent(cleanQuery)}&first=${firstOffset}&setlang=en-us`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'SRCHHPGUSR=ADLT=OFF&NRSLT=20;'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return [];
    const html = await res.text();

    const matches = Array.from(html.matchAll(/<li[^>]+class="b_algo"[^>]*>[\s\S]*?<h2[^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>(?:[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>)?/g));
    const results: SearchHit[] = [];

    for (const m of matches) {
      let rawHref = m[1];
      if (rawHref.includes('u=a1')) {
        const matchU = rawHref.match(/[?&;]u=a1([a-zA-Z0-9_-]+)/);
        if (matchU) {
          try {
            const padded = matchU[1].replace(/-/g, '+').replace(/_/g, '/');
            rawHref = Buffer.from(padded, 'base64').toString('utf8');
          } catch {}
        }
      }

      if (rawHref.startsWith('http')) {
        try {
          const parsedUrl = new URL(rawHref);
          const host = parsedUrl.hostname.toLowerCase();
          const isAggregator = AGGREGATOR_DOMAINS.some(agg => host.includes(agg));
          if (!isAggregator) {
            const title = m[2].replace(/<[^>]*>/g, '').trim();
            const snippet = m[3] ? m[3].replace(/<[^>]*>/g, '').trim() : '';
            results.push({ title, url: rawHref, snippet, engine: 'Bing', page });
            if (results.length >= maxResults) break;
          }
        } catch {}
      }
    }

    return results;
  } catch (err: any) {
    return [];
  }
}

/**
 * Google Search Engine crawler with pagination support (Page 1 to 100+)
 */
export async function searchGoogleEngine(query: string, page = 1, maxResults = 10): Promise<SearchHit[]> {
  const cleanQuery = query.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  const startOffset = Math.max(0, (page - 1) * 10);
  const url = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}&start=${startOffset}&num=10&hl=en`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return [];
    const html = await res.text();

    const results: SearchHit[] = [];
    const linkMatches = Array.from(html.matchAll(/<a[^>]+href="(https?:\/\/[^"&]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi));

    for (const m of linkMatches) {
      const rawHref = m[1];
      const title = m[2].replace(/<[^>]*>/g, '').trim();
      try {
        const host = new URL(rawHref).hostname.toLowerCase();
        if (!AGGREGATOR_DOMAINS.some(agg => host.includes(agg)) && !host.includes('google.')) {
          results.push({ title, url: rawHref, snippet: title, engine: 'Google', page });
          if (results.length >= maxResults) break;
        }
      } catch {}
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * DuckDuckGo Search Engine crawler with pagination support
 */
export async function searchDuckDuckGoEngine(query: string, page = 1, maxResults = 10): Promise<SearchHit[]> {
  const cleanQuery = query.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': getRandomUA(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      body: `q=${encodeURIComponent(cleanQuery)}&b=&kl=us-en`,
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return [];
    const html = await res.text();

    const results: SearchHit[] = [];
    const matches = Array.from(html.matchAll(/<a[^>]+class="result__snippet"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi));

    for (const m of matches) {
      let rawHref = m[1];
      const uddgMatch = rawHref.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        try {
          rawHref = decodeURIComponent(uddgMatch[1]);
        } catch {}
      }

      if (rawHref.startsWith('http')) {
        try {
          const host = new URL(rawHref).hostname.toLowerCase();
          if (!AGGREGATOR_DOMAINS.some(agg => host.includes(agg)) && !host.includes('duckduckgo.')) {
            const snippet = m[2].replace(/<[^>]*>/g, '').trim();
            results.push({ title: host, url: rawHref, snippet, engine: 'DuckDuckGo', page });
            if (results.length >= maxResults) break;
          }
        } catch {}
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Yahoo Search Engine crawler with pagination support
 */
export async function searchYahooEngine(query: string, page = 1, maxResults = 10): Promise<SearchHit[]> {
  const cleanQuery = query.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  const bOffset = Math.max(1, (page - 1) * 10 + 1);
  const url = `https://search.yahoo.com/search?p=${encodeURIComponent(cleanQuery)}&b=${bOffset}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return [];
    const html = await res.text();

    const results: SearchHit[] = [];
    const matches = Array.from(html.matchAll(/<h3[^>]+class="title"[^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi));

    for (const m of matches) {
      let rawHref = m[1];
      if (rawHref.includes('RU=')) {
        const ruMatch = rawHref.match(/RU=([^/]+)/);
        if (ruMatch) {
          try {
            rawHref = decodeURIComponent(ruMatch[1]);
          } catch {}
        }
      }

      if (rawHref.startsWith('http')) {
        try {
          const host = new URL(rawHref).hostname.toLowerCase();
          if (!AGGREGATOR_DOMAINS.some(agg => host.includes(agg)) && !host.includes('yahoo.')) {
            const title = m[2].replace(/<[^>]*>/g, '').trim();
            results.push({ title, url: rawHref, snippet: title, engine: 'Yahoo', page });
            if (results.length >= maxResults) break;
          }
        } catch {}
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Multi-Engine Unified Querying with rotating fallback
 */
export async function searchMultiEnginePaginated(
  query: string,
  page = 1,
  enginePreference = 'auto'
): Promise<SearchHit[]> {
  // Rotate engines based on page or preference to maximize results up to 100+ pages
  if (enginePreference === 'bing') {
    return await searchBingEngine(query, page, 10);
  } else if (enginePreference === 'google') {
    return await searchGoogleEngine(query, page, 10);
  } else if (enginePreference === 'yahoo') {
    return await searchYahooEngine(query, page, 10);
  } else if (enginePreference === 'duckduckgo') {
    return await searchDuckDuckGoEngine(query, page, 10);
  }

  // Auto rotation: alternate between engines across pages
  const cycle = (page - 1) % 4;
  let hits: SearchHit[] = [];

  if (cycle === 0) {
    hits = await searchBingEngine(query, page, 10);
    if (!hits.length) hits = await searchGoogleEngine(query, page, 10);
  } else if (cycle === 1) {
    hits = await searchGoogleEngine(query, page, 10);
    if (!hits.length) hits = await searchBingEngine(query, page, 10);
  } else if (cycle === 2) {
    hits = await searchYahooEngine(query, page, 10);
    if (!hits.length) hits = await searchBingEngine(query, page, 10);
  } else {
    hits = await searchDuckDuckGoEngine(query, page, 10);
    if (!hits.length) hits = await searchBingEngine(query, page, 10);
  }

  return hits;
}

/**
 * Gemini AI B2B Leads Engine
 */
export async function fetchLeadsViaGemini(
  keywords: string,
  country: string,
  count = 20
): Promise<DiscoveredLead[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const targetCountry = country && country !== 'All' && country !== 'N/A' ? country : 'Global';
  const cleanKeyword = keywords.trim() || 'Manufacturing';

  const prompt = `You are an elite B2B enterprise discovery and verified corporate intelligence database.
Provide a list of ${count} real, operating, authentic commercial businesses, manufacturers, suppliers, or corporate enterprises for:
Industry / Focus: "${cleanKeyword}"
Target Country / Region: "${targetCountry}".

Return ONLY a valid JSON array of objects with the exact schema:
[
  {
    "companyName": "Official Company Name",
    "websiteUrl": "https://www.official-company-domain.com",
    "contactEmail": "info@official-company-domain.com",
    "country": "${targetCountry}",
    "phone": "+1-800-555-0199",
    "role": "Managing Director",
    "fullName": "Executive Contact"
  }
]
Requirements:
1. Every company must be a real, authentic operating business in ${targetCountry}.
2. Use real company domain names and real standard business contact emails.
3. Include real phone format and typical executive roles if known.`;

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      if (response.text) {
        const rawJson = JSON.parse(response.text);
        if (Array.isArray(rawJson) && rawJson.length > 0) {
          return rawJson
            .map((item: any) => {
              const email = cleanEmail(item.contactEmail || item.email || '');
              const website = item.websiteUrl || item.website || (email ? `https://${email.split('@')[1]}` : '');
              if (!email || !website) return null;
              const nameParsed = parseNameFromEmail(email, item.fullName);
              const leadObj: DiscoveredLead = {
                email,
                companyName: cleanCompanyName(item.companyName || email.split('@')[1].split('.')[0]),
                sourceUrl: website,
                country: item.country || targetCountry,
                phone: item.phone || undefined,
                role: item.role || undefined,
                firstName: nameParsed.firstName,
                lastName: nameParsed.lastName,
                fullName: nameParsed.fullName || item.fullName,
                isRoleBased: nameParsed.isRoleBased,
                isValid: true
              };
              return leadObj;
            })
            .filter((x): x is DiscoveredLead => x !== null);
        }
      }
    } catch (err: any) {
      console.warn(`[Gemini Leads] ${model} warning:`, err.message);
    }
  }

  return [];
}

/**
 * Deep website crawler that probes homepages and all available contact/team/impressum pages
 * Searches for emails, phone numbers, contact person names, and roles/job titles
 */
export async function crawlWebsiteForLeads(
  targetUrl: string,
  inferredCompName?: string,
  country = 'N/A',
  options?: { deepCrawl?: boolean; engine?: string; page?: number }
): Promise<DiscoveredLead[]> {
  let fullUrl = targetUrl;
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = 'https://' + fullUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch {
    return [];
  }

  const host = parsed.hostname.toLowerCase();
  for (const agg of AGGREGATOR_DOMAINS) {
    if (host.includes(agg)) return [];
  }

  const results: DiscoveredLead[] = [];
  const seenEmails = new Set<string>();
  let compName = inferredCompName || host.replace(/^www\./, '').split('.')[0];
  const isDeep = options?.deepCrawl !== false; // Deep crawl by default to get roles & phones!

  try {
    // 1. Crawl Homepage
    const res = await fetch(fullUrl, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(4000)
    }).catch(() => null);

    let html = '';
    if (res && res.ok) {
      html = await res.text().catch(() => '');
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && !inferredCompName) {
        compName = cleanCompanyName(titleMatch[1], host);
      } else {
        compName = cleanCompanyName(compName, host);
      }

      const extracted = extractEmailsFromHtml(html);
      for (const em of extracted) {
        if (!seenEmails.has(em)) {
          seenEmails.add(em);
          const details = findBestContactDetailsNearEmail(html, em);
          results.push({
            email: em,
            companyName: compName,
            sourceUrl: fullUrl,
            country,
            phone: details.phone,
            role: details.role,
            firstName: details.firstName,
            lastName: details.lastName,
            fullName: details.fullName,
            isRoleBased: isRoleBasedEmail(em),
            isValid: true,
            searchEngine: options?.engine,
            page: options?.page
          });
        }
      }
    }

    // 2. Spider Contact, Team, About & Impressum subpages for emails, phones and roles
    if (isDeep || results.length === 0) {
      const subCandidatePaths = new Set<string>();

      // Extract internal contact/about/impressum links from homepage HTML
      if (html) {
        const linkMatches = Array.from(html.matchAll(/href=["'](\/[^"'#?]+|\bhttps?:\/\/[^"'#?]+)["']/gi));
        for (const lm of linkMatches) {
          const l = lm[1].toLowerCase();
          if (
            l.includes('contact') || 
            l.includes('kontakt') || 
            l.includes('impressum') || 
            l.includes('about') || 
            l.includes('team') ||
            l.includes('people') ||
            l.includes('leadership') ||
            l.includes('management') ||
            l.includes('reach-us') ||
            l.includes('support') ||
            l.includes('headquarters')
          ) {
            try {
              const fullSub = l.startsWith('http') ? l : `${parsed.origin}${l.startsWith('/') ? '' : '/'}${l}`;
              const subHost = new URL(fullSub).hostname.toLowerCase();
              if (subHost === host) {
                subCandidatePaths.add(fullSub);
              }
            } catch {}
          }
          if (subCandidatePaths.size >= (isDeep ? 8 : 3)) break;
        }
      }

      // Default standard candidate paths
      const isGermanic = country.toLowerCase().includes('german') || host.endsWith('.de') || host.endsWith('.at') || host.endsWith('.ch');
      if (isGermanic) {
        subCandidatePaths.add(`${parsed.origin}/impressum`);
        subCandidatePaths.add(`${parsed.origin}/kontakt`);
        subCandidatePaths.add(`${parsed.origin}/contact`);
        subCandidatePaths.add(`${parsed.origin}/uber-uns`);
        subCandidatePaths.add(`${parsed.origin}/team`);
      } else {
        subCandidatePaths.add(`${parsed.origin}/contact`);
        subCandidatePaths.add(`${parsed.origin}/contact-us`);
        subCandidatePaths.add(`${parsed.origin}/about`);
        subCandidatePaths.add(`${parsed.origin}/about-us`);
        subCandidatePaths.add(`${parsed.origin}/team`);
        subCandidatePaths.add(`${parsed.origin}/our-team`);
        subCandidatePaths.add(`${parsed.origin}/leadership`);
      }

      const pathsToProbe = Array.from(subCandidatePaths).slice(0, isDeep ? 8 : 3);

      await Promise.allSettled(
        pathsToProbe.map(async (subUrl) => {
          try {
            const subRes = await fetch(subUrl, {
              headers: { 
                'User-Agent': getRandomUA(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              },
              signal: AbortSignal.timeout(4000)
            });
            if (subRes && subRes.ok) {
              const subHtml = await subRes.text();
              const subEmails = extractEmailsFromHtml(subHtml);
              for (const em of subEmails) {
                if (!seenEmails.has(em)) {
                  seenEmails.add(em);
                  const details = findBestContactDetailsNearEmail(subHtml, em);
                  results.push({
                    email: em,
                    companyName: cleanCompanyName(compName, host),
                    sourceUrl: subUrl,
                    country,
                    phone: details.phone,
                    role: details.role,
                    firstName: details.firstName,
                    lastName: details.lastName,
                    fullName: details.fullName,
                    isRoleBased: isRoleBasedEmail(em),
                    isValid: true,
                    searchEngine: options?.engine,
                    page: options?.page
                  });
                }
              }
            }
          } catch {}
        })
      );
    }
  } catch {}

  return results;
}

/**
 * Unified Lead Extractor with Parallel AI & Organic Multi-Engine Crawling
 */
export async function extractLeadsUnified(
  rawQuery: string,
  rawCountry = 'N/A',
  targetGoal = 25,
  deepCrawlContacts = true
): Promise<{ results: DiscoveredLead[]; crawledUrls: number }> {
  const { keywords, country } = extractCleanKeywordsAndCountry(rawQuery, rawCountry);
  const foundResults: DiscoveredLead[] = [];
  const seenEmails = new Set<string>();
  let crawledCount = 0;

  const addLead = (lead: DiscoveredLead) => {
    const em = cleanEmail(lead.email);
    if (!em || seenEmails.has(em)) return;
    seenEmails.add(em);
    const domain = em.split('@')[1];
    foundResults.push({
      ...lead,
      email: em,
      companyName: cleanCompanyName(lead.companyName, domain),
      country: lead.country || country || 'N/A',
      isRoleBased: isRoleBasedEmail(em)
    });
  };

  const aiPromise = fetchLeadsViaGemini(keywords, country, Math.min(30, Math.max(15, targetGoal)));

  const webPromise = (async () => {
    try {
      const ccTLD = getCountryCcTLD(country);
      const isGlobal = !country || country === 'All' || country === 'N/A';
      
      const queryToUse = !isGlobal
        ? `site:${ccTLD} ${keywords} contact us info@ OR sales@`
        : `${keywords} contact us email phone`;

      // Multi-engine hits across pages 1 and 2
      const hits = await searchMultiEnginePaginated(queryToUse, 1);
      crawledCount += hits.length;

      const validHits = hits.filter(h => {
        try {
          const host = new URL(h.url).hostname.toLowerCase();
          return !AGGREGATOR_DOMAINS.some(agg => host.includes(agg));
        } catch {
          return false;
        }
      });

      // Extract directly from snippets if present
      for (const hit of validHits) {
        if (hit.snippet) {
          const snippetEmails = extractEmailsFromHtml(hit.snippet);
          for (const sEmail of snippetEmails) {
            addLead({
              email: sEmail,
              companyName: hit.title,
              sourceUrl: hit.url,
              country,
              isValid: true,
              searchEngine: hit.engine
            });
          }
        }
      }

      // Crawl valid company websites for contacts, phones and roles
      const hitsToCrawl = validHits.slice(0, deepCrawlContacts ? 8 : 4);
      await Promise.allSettled(
        hitsToCrawl.map(async (hit) => {
          crawledCount++;
          const crawled = await crawlWebsiteForLeads(hit.url, hit.title, country, { deepCrawl: deepCrawlContacts });
          crawled.forEach(addLead);
        })
      );
    } catch {}
  })();

  const [aiOutcome] = await Promise.allSettled([aiPromise, webPromise]);

  if (aiOutcome.status === 'fulfilled' && Array.isArray(aiOutcome.value)) {
    if (deepCrawlContacts && aiOutcome.value.length > 0) {
      const topDomains = aiOutcome.value.slice(0, 6);
      await Promise.allSettled(
        topDomains.map(async (lead) => {
          if (lead.sourceUrl) {
            crawledCount++;
            const deepContacts = await crawlWebsiteForLeads(lead.sourceUrl, lead.companyName, country, { deepCrawl: true });
            deepContacts.forEach(addLead);
          }
        })
      );
    }
    aiOutcome.value.forEach(addLead);
  }

  return {
    results: foundResults,
    crawledUrls: Math.max(foundResults.length, crawledCount)
  };
}

/**
 * Deep Crawl Company Websites & Impressum (Bulk list of targets)
 */
export async function deepCrawlCompanyWebsites(
  targets: Array<{ url: string; companyName?: string; country?: string }>
): Promise<DiscoveredLead[]> {
  const discovered: DiscoveredLead[] = [];
  const seenEmails = new Set<string>();

  const BATCH_SIZE = 5;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const leads = await crawlWebsiteForLeads(item.url, item.companyName, item.country || 'N/A', { deepCrawl: true });
          for (const l of leads) {
            const em = cleanEmail(l.email);
            if (em && !seenEmails.has(em)) {
              seenEmails.add(em);
              discovered.push({
                ...l,
                email: em
              });
            }
          }
        } catch {}
      })
    );
  }

  return discovered;
}

/**
 * Search Executive Leadership / CEO Contacts
 */
export async function searchExecutiveLeadership(
  query: string,
  country = 'Global'
): Promise<ExecutiveContact[]> {
  const cleanQuery = query.trim();
  const isDomain = cleanQuery.includes('.') && !cleanQuery.includes(' ');
  const domain = isDomain ? cleanQuery.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0] : '';
  const companyName = isDomain ? domain.split('.')[0] : cleanQuery;
  const targetDomain = domain || `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

  const contacts: ExecutiveContact[] = [];
  const foundNames = new Set<string>();

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Identify the real executive leadership (CEO, Founder, Managing Director, or President) for:
Company Name: "${companyName}"
Website Domain: "${targetDomain}"
Country: "${country}".

Return ONLY a JSON array:
[
  {
    "ceoName": "Full Name",
    "role": "Chief Executive Officer",
    "companyName": "${companyName}",
    "websiteUrl": "https://${targetDomain}",
    "derivedEmail": "firstname.lastname@${targetDomain}"
  }
]`;

    try {
      const res = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      if (res.text) {
        const parsed = JSON.parse(res.text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            if (item.ceoName && !foundNames.has(item.ceoName.toLowerCase())) {
              foundNames.add(item.ceoName.toLowerCase());
              contacts.push({
                companyName: item.companyName || companyName,
                websiteUrl: item.websiteUrl || `https://${targetDomain}`,
                type: 'Enterprise',
                country: country !== 'All' ? country : 'Global',
                ceoName: item.ceoName,
                role: item.role || 'CEO',
                derivedEmail: item.derivedEmail || `ceo@${targetDomain}`,
                confidence: 95
              });
            }
          }
          if (contacts.length > 0) return contacts;
        }
      }
    } catch {}
  }

  // Fallback default
  contacts.push({
    companyName: companyName.charAt(0).toUpperCase() + companyName.slice(1),
    websiteUrl: `https://${targetDomain}`,
    type: 'Enterprise',
    country: country !== 'All' ? country : 'Global',
    ceoName: 'Executive Office',
    role: 'Managing Director',
    derivedEmail: `ceo@${targetDomain}`,
    confidence: 80
  });

  return contacts;
}
