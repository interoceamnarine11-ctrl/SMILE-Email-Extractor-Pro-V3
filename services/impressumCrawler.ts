/**
 * Live Website Contact & Impressum Page Crawler
 * 
 * Crawls live website contact and impressum pages, parses Schema.org organization metadata,
 * headquarters addresses, and international phone dialing codes (e.g. +49 for Germany,
 * +33 for France, +41 for Switzerland, +81 for Japan).
 * 
 * Automatically determines registered enterprise name, corporate headquarters country,
 * standard business language, and phone numbers.
 */

export interface DomainContactEnrichment {
  domain: string;
  companyName: string;
  country: string;
  flag: string;
  phone?: string;
  address?: string;
  language: string;
  autoTranslateEligible: boolean;
  impressumFound: boolean;
  status: 'online' | 'unreachable' | 'offline';
}

const PHONE_DIAL_CODES: Array<{ prefix: string; country: string; language: string; flag: string }> = [
  { prefix: '+49', country: 'Germany', language: 'German', flag: '🇩🇪' },
  { prefix: '+43', country: 'Austria', language: 'German', flag: '🇦🇹' },
  { prefix: '+41', country: 'Switzerland', language: 'German', flag: '🇨🇭' },
  { prefix: '+33', country: 'France', language: 'French', flag: '🇫🇷' },
  { prefix: '+32', country: 'Belgium', language: 'French', flag: '🇧🇪' },
  { prefix: '+34', country: 'Spain', language: 'Spanish', flag: '🇪🇸' },
  { prefix: '+39', country: 'Italy', language: 'Italian', flag: '🇮🇹' },
  { prefix: '+31', country: 'Netherlands', language: 'Dutch', flag: '🇳🇱' },
  { prefix: '+81', country: 'Japan', language: 'Japanese', flag: '🇯🇵' },
  { prefix: '+86', country: 'China', language: 'Chinese', flag: '🇨🇳' },
  { prefix: '+55', country: 'Brazil', language: 'Portuguese', flag: '🇧🇷' },
  { prefix: '+351', country: 'Portugal', language: 'Portuguese', flag: '🇵🇹' },
  { prefix: '+48', country: 'Poland', language: 'Polish', flag: '🇵🇱' },
  { prefix: '+46', country: 'Sweden', language: 'Swedish', flag: '🇸🇪' },
  { prefix: '+47', country: 'Norway', language: 'Norwegian', flag: '🇳🇴' },
  { prefix: '+45', country: 'Denmark', language: 'Danish', flag: '🇩🇰' },
  { prefix: '+358', country: 'Finland', language: 'Finnish', flag: '🇫🇮' },
  { prefix: '+90', country: 'Turkey', language: 'Turkish', flag: '🇹🇷' },
  { prefix: '+44', country: 'United Kingdom', language: 'English', flag: '🇬🇧' },
  { prefix: '+1', country: 'United States', language: 'English', flag: '🇺🇸' },
  { prefix: '+61', country: 'Australia', language: 'English', flag: '🇦🇺' },
];

const TLD_COUNTRY_MAP: Record<string, { country: string; language: string; flag: string; phoneCode: string }> = {
  'de': { country: 'Germany', language: 'German', flag: '🇩🇪', phoneCode: '+49' },
  'at': { country: 'Austria', language: 'German', flag: '🇦🇹', phoneCode: '+43' },
  'ch': { country: 'Switzerland', language: 'German', flag: '🇨🇭', phoneCode: '+41' },
  'fr': { country: 'France', language: 'French', flag: '🇫🇷', phoneCode: '+33' },
  'es': { country: 'Spain', language: 'Spanish', flag: '🇪🇸', phoneCode: '+34' },
  'it': { country: 'Italy', language: 'Italian', flag: '🇮🇹', phoneCode: '+39' },
  'nl': { country: 'Netherlands', language: 'Dutch', flag: '🇳🇱', phoneCode: '+31' },
  'jp': { country: 'Japan', language: 'Japanese', flag: '🇯🇵', phoneCode: '+81' },
  'cn': { country: 'China', language: 'Chinese', flag: '🇨🇳', phoneCode: '+86' },
  'br': { country: 'Brazil', language: 'Portuguese', flag: '🇧🇷', phoneCode: '+55' },
  'pt': { country: 'Portugal', language: 'Portuguese', flag: '🇵🇹', phoneCode: '+351' },
  'pl': { country: 'Poland', language: 'Polish', flag: '🇵🇱', phoneCode: '+48' },
  'se': { country: 'Sweden', language: 'Swedish', flag: '🇸🇪', phoneCode: '+46' },
  'no': { country: 'Norway', language: 'Norwegian', flag: '🇳🇴', phoneCode: '+47' },
  'dk': { country: 'Denmark', language: 'Danish', flag: '🇩🇰', phoneCode: '+45' },
  'fi': { country: 'Finland', language: 'Finnish', flag: '🇫🇮', phoneCode: '+358' },
  'uk': { country: 'United Kingdom', language: 'English', flag: '🇬🇧', phoneCode: '+44' },
  'co.uk': { country: 'United Kingdom', language: 'English', flag: '🇬🇧', phoneCode: '+44' },
  'ca': { country: 'Canada', language: 'English', flag: '🇨🇦', phoneCode: '+1' },
  'au': { country: 'Australia', language: 'English', flag: '🇦🇺', phoneCode: '+61' },
};

/**
 * Extracts phone numbers formatted with international dialing codes from HTML
 */
function extractInternationalPhone(html: string): string | undefined {
  // Look for international phone formats: +49 123 4567, +49 (0)30 123456, +1-800-123-4567
  const phoneRegex = /(?:\+|00)(\d{1,3})[\s.-]?(?:\(?0\)?[\s.-]?)?(\d{1,4})[\s.-]?(\d{2,4})[\s.-]?(\d{2,6})/g;
  const matches = html.match(phoneRegex);
  if (matches && matches.length > 0) {
    // Return first clean phone number
    const first = matches[0].trim().replace(/\s+/g, ' ');
    if (first.length >= 8 && first.length <= 25) {
      return first.startsWith('00') ? '+' + first.slice(2) : first;
    }
  }

  // Also check tel: links
  const telMatch = html.match(/href=["']tel:([+0-9\s.-]+)["']/i);
  if (telMatch && telMatch[1]) {
    const rawTel = telMatch[1].trim();
    if (rawTel.length >= 8 && rawTel.length <= 25) {
      return rawTel;
    }
  }

  return undefined;
}

/**
 * Parses Schema.org JSON-LD for Organization details
 */
function extractSchemaOrgData(html: string): { name?: string; address?: string; country?: string; phone?: string } {
  try {
    const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      const content = match[1].trim();
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        const type = (item['@type'] || '').toString();
        if (/Organization|Corporation|LocalBusiness|LegalService|Company/i.test(type)) {
          const name = item.name || item.legalName;
          const phone = item.telephone;
          let country: string | undefined;
          let addressStr: string | undefined;

          if (item.address) {
            if (typeof item.address === 'string') {
              addressStr = item.address;
            } else if (typeof item.address === 'object') {
              country = item.address.addressCountry;
              addressStr = [
                item.address.streetAddress,
                item.address.postalCode,
                item.address.addressLocality,
                country
              ].filter(Boolean).join(', ');
            }
          }

          if (name || phone || addressStr) {
            return { name, address: addressStr, country, phone };
          }
        }
      }
    }
  } catch {}
  return {};
}

/**
 * Crawls a single domain's homepage and impressum / contact paths
 */
export async function crawlDomainContactAndImpressum(domainInput: string): Promise<DomainContactEnrichment> {
  const cleanDomain = domainInput.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  const tld = cleanDomain.split('.').slice(1).join('.');

  const fallbackTld = TLD_COUNTRY_MAP[tld] || {
    country: 'International',
    language: 'English',
    flag: '🌐',
    phoneCode: ''
  };

  const defaultResult: DomainContactEnrichment = {
    domain: cleanDomain,
    companyName: cleanDomain.split('.')[0].toUpperCase(),
    country: fallbackTld.country,
    flag: fallbackTld.flag,
    phone: fallbackTld.phoneCode ? `${fallbackTld.phoneCode} (Expected)` : undefined,
    language: fallbackTld.language,
    autoTranslateEligible: fallbackTld.language !== 'English',
    impressumFound: false,
    status: 'unreachable'
  };

  const candidateUrls = [
    `https://${cleanDomain}`,
    `https://${cleanDomain}/impressum`,
    `https://${cleanDomain}/kontakt`,
    `https://${cleanDomain}/contact`,
    `https://${cleanDomain}/about-us`
  ];

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  let combinedHtml = '';
  let foundPage = false;
  let impressumFound = false;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        headers: browserHeaders,
        redirect: 'follow',
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        foundPage = true;
        const pageText = await res.text();
        combinedHtml += '\n' + pageText;
        if (url.includes('impressum') || pageText.toLowerCase().includes('impressum') || pageText.toLowerCase().includes('handelsregister')) {
          impressumFound = true;
        }
      }
    } catch {}
  }

  if (!foundPage) {
    return defaultResult;
  }

  defaultResult.status = 'online';
  defaultResult.impressumFound = impressumFound;

  // 1. Schema.org metadata
  const schema = extractSchemaOrgData(combinedHtml);
  if (schema.name) {
    defaultResult.companyName = schema.name;
  }
  if (schema.address) {
    defaultResult.address = schema.address;
  }
  if (schema.phone) {
    defaultResult.phone = schema.phone;
  }

  // 2. International Phone Dialing Code detection
  const detectedPhone = extractInternationalPhone(combinedHtml);
  if (detectedPhone) {
    defaultResult.phone = detectedPhone;

    // Check if phone matches international dialing codes
    for (const item of PHONE_DIAL_CODES) {
      if (detectedPhone.startsWith(item.prefix)) {
        defaultResult.country = item.country;
        defaultResult.language = item.language;
        defaultResult.flag = item.flag;
        defaultResult.autoTranslateEligible = item.language !== 'English';
        break;
      }
    }
  }

  // 3. Impressum legal form markers (e.g., GmbH, AG, SAS, S.L., Sp. z o.o.)
  if (combinedHtml.includes('GmbH') || combinedHtml.includes('AG ') || combinedHtml.includes('Handelsregister')) {
    if (defaultResult.country === 'International') {
      defaultResult.country = 'Germany';
      defaultResult.language = 'German';
      defaultResult.flag = '🇩🇪';
      defaultResult.autoTranslateEligible = true;
    }
  } else if (combinedHtml.includes('SAS ') || combinedHtml.includes('SARL') || combinedHtml.includes('SIRET')) {
    if (defaultResult.country === 'International') {
      defaultResult.country = 'France';
      defaultResult.language = 'French';
      defaultResult.flag = '🇫🇷';
      defaultResult.autoTranslateEligible = true;
    }
  }

  return defaultResult;
}
