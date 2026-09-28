/**
 * Country & Language Detection Engine
 * 
 * Accurately analyzes email domains, ccTLDs (country code top-level domains),
 * second-level domains (e.g. .co.uk, .com.de, .com.au), and returns:
 * - Country name (e.g., Germany, France, Japan)
 * - Country Code (e.g., DE, FR, JP)
 * - Standard Business Language (e.g., German, French, Japanese)
 * - Defaulting to English if international or unknown
 */

export interface CountryLanguageInfo {
  country: string;
  countryCode: string;
  language: string;
  isEnglishDefault: boolean;
}

// Comprehensive registry of ccTLDs and associated business languages
const CCTLD_LANGUAGE_MAP: Record<string, { country: string; code: string; language: string }> = {
  // Western & Central Europe
  'de': { country: 'Germany', code: 'DE', language: 'German' },
  'at': { country: 'Austria', code: 'AT', language: 'German' },
  'ch': { country: 'Switzerland', code: 'CH', language: 'German' },
  'fr': { country: 'France', code: 'FR', language: 'French' },
  'es': { country: 'Spain', code: 'ES', language: 'Spanish' },
  'it': { country: 'Italy', code: 'IT', language: 'Italian' },
  'nl': { country: 'Netherlands', code: 'NL', language: 'Dutch' },
  'be': { country: 'Belgium', code: 'BE', language: 'French' },
  'lu': { country: 'Luxembourg', code: 'LU', language: 'French' },
  'pt': { country: 'Portugal', code: 'PT', language: 'Portuguese' },
  'pl': { country: 'Poland', code: 'PL', language: 'Polish' },
  'cz': { country: 'Czech Republic', code: 'CZ', language: 'Czech' },
  'sk': { country: 'Slovakia', code: 'SK', language: 'Slovak' },
  'hu': { country: 'Hungary', code: 'HU', language: 'Hungarian' },
  'ro': { country: 'Romania', code: 'RO', language: 'Romanian' },
  'bg': { country: 'Bulgaria', code: 'BG', language: 'Bulgarian' },
  'gr': { country: 'Greece', code: 'GR', language: 'Greek' },

  // Nordics
  'se': { country: 'Sweden', code: 'SE', language: 'Swedish' },
  'no': { country: 'Norway', code: 'NO', language: 'Norwegian' },
  'dk': { country: 'Denmark', code: 'DK', language: 'Danish' },
  'fi': { country: 'Finland', code: 'FI', language: 'Finnish' },
  'is': { country: 'Iceland', code: 'IS', language: 'Icelandic' },

  // Americas
  'br': { country: 'Brazil', code: 'BR', language: 'Portuguese' },
  'mx': { country: 'Mexico', code: 'MX', language: 'Spanish' },
  'ar': { country: 'Argentina', code: 'AR', language: 'Spanish' },
  'cl': { country: 'Chile', code: 'CL', language: 'Spanish' },
  'co': { country: 'Colombia', code: 'CO', language: 'Spanish' },
  'pe': { country: 'Peru', code: 'PE', language: 'Spanish' },
  'uy': { country: 'Uruguay', code: 'UY', language: 'Spanish' },
  've': { country: 'Venezuela', code: 'VE', language: 'Spanish' },
  'ec': { country: 'Ecuador', code: 'EC', language: 'Spanish' },
  'cr': { country: 'Costa Rica', code: 'CR', language: 'Spanish' },
  'pa': { country: 'Panama', code: 'PA', language: 'Spanish' },

  // Asia / Middle East / Others
  'jp': { country: 'Japan', code: 'JP', language: 'Japanese' },
  'kr': { country: 'South Korea', code: 'KR', language: 'Korean' },
  'cn': { country: 'China', code: 'CN', language: 'Chinese' },
  'tw': { country: 'Taiwan', code: 'TW', language: 'Chinese' },
  'hk': { country: 'Hong Kong', code: 'HK', language: 'Chinese' },
  'vn': { country: 'Vietnam', code: 'VN', language: 'Vietnamese' },
  'th': { country: 'Thailand', code: 'TH', language: 'Thai' },
  'id': { country: 'Indonesia', code: 'ID', language: 'Indonesian' },
  'tr': { country: 'Turkey', code: 'TR', language: 'Turkish' },
  'ru': { country: 'Russia', code: 'RU', language: 'Russian' },
  'ua': { country: 'Ukraine', code: 'UA', language: 'Ukrainian' },
  'ae': { country: 'United Arab Emirates', code: 'AE', language: 'Arabic' },
  'sa': { country: 'Saudi Arabia', code: 'SA', language: 'Arabic' },
  'eg': { country: 'Egypt', code: 'EG', language: 'Arabic' },
  'il': { country: 'Israel', code: 'IL', language: 'Hebrew' },

  // English-speaking
  'uk': { country: 'United Kingdom', code: 'GB', language: 'English' },
  'us': { country: 'United States', code: 'US', language: 'English' },
  'ca': { country: 'Canada', code: 'CA', language: 'English' },
  'au': { country: 'Australia', code: 'AU', language: 'English' },
  'nz': { country: 'New Zealand', code: 'NZ', language: 'English' },
  'ie': { country: 'Ireland', code: 'IE', language: 'English' },
  'za': { country: 'South Africa', code: 'ZA', language: 'English' },
  'sg': { country: 'Singapore', code: 'SG', language: 'English' },
  'in': { country: 'India', code: 'IN', language: 'English' },
};

/**
 * Extracts country and language from an email address or domain.
 * Defaults cleanly to English if not a specific non-English country code.
 */
export function detectCountryAndLanguage(emailOrDomain: string): CountryLanguageInfo {
  if (!emailOrDomain) {
    return {
      country: 'International',
      countryCode: 'GLOBAL',
      language: 'English',
      isEnglishDefault: true
    };
  }

  const clean = emailOrDomain.toLowerCase().trim();
  const domain = clean.includes('@') ? clean.split('@')[1] : clean;
  const parts = domain.split('.');

  if (parts.length >= 2) {
    const lastTld = parts[parts.length - 1];
    const secondTld = parts.length >= 3 ? parts[parts.length - 2] : '';

    // Check for last TLD match
    if (CCTLD_LANGUAGE_MAP[lastTld]) {
      const match = CCTLD_LANGUAGE_MAP[lastTld];
      return {
        country: match.country,
        countryCode: match.code,
        language: match.language,
        isEnglishDefault: match.language === 'English'
      };
    }

    // Check for combined second-level TLD e.g. co.uk, com.au, com.de, etc.
    if (secondTld && CCTLD_LANGUAGE_MAP[secondTld]) {
      const match = CCTLD_LANGUAGE_MAP[secondTld];
      return {
        country: match.country,
        countryCode: match.code,
        language: match.language,
        isEnglishDefault: match.language === 'English'
      };
    }
  }

  // Generic / Default (e.g. .com, .org, .net, .io, .ai, .biz, .co) -> English
  return {
    country: 'International',
    countryCode: 'GLOBAL',
    language: 'English',
    isEnglishDefault: true
  };
}
