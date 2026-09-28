/**
 * Intelligent Name Parsing & Capitalization Engine
 * 
 * - Full First & Last Name: Automatically recognizes separated tokens (dots ., underscores _, or hyphens -)
 *   in email usernames and extracts both first and last names with proper capitalization.
 *   e.g. mladenka.pejic@... → First Name: Mladenka, Last Name: Pejic (Full Name: Mladenka Pejic)
 * 
 * - Abbreviation & Initial Filtering:
 *   When a token is a single-letter initial (such as mladenka.p@ or p.mladenka@), the engine filters out
 *   the abbreviated initial and retains the complete name:
 *   mladenka.p@... → First Name: Mladenka (ignoring .p)
 *   p.mladenka@... → First Name: Mladenka (ignoring p.)
 *   mladenka@...   → First Name: Mladenka
 * 
 * - First Letter Capitalization: Automatically capitalizes first letter while keeping rest lowercased.
 */

export interface ParsedNameResult {
  firstName: string;
  lastName: string;
  fullName: string;
  isRoleBased?: boolean;
}

export const GENERIC_ROLE_ACCOUNTS = new Set([
  'info', 'order', 'orders', 'sales', 'support', 'contact', 'kontakt', 'admin', 
  'administrator', 'help', 'office', 'team', 'service', 'services', 'billing', 
  'inquiry', 'inquiries', 'jobs', 'careers', 'hr', 'marketing', 'press', 'media', 
  'mail', 'mailbox', 'feedback', 'general', 'account', 'accounting', 'hello', 
  'webmaster', 'privacy', 'security', 'legal', 'compliance', 'operations',
  'purchasing', 'procurement', 'export', 'import', 'finance', 'reception',
  'customerservice', 'customercare', 'postmaster', 'noreply', 'no-reply', 'root', 'abuse'
]);

/**
 * Checks if an email address or username belongs to a generic/role-based department.
 */
export function isRoleBasedEmail(emailOrUser: string): boolean {
  if (!emailOrUser) return false;
  let user = emailOrUser.toLowerCase().trim();
  if (user.includes('@')) {
    user = user.split('@')[0].trim();
  }
  user = user.replace(/\d+$/g, '');
  const tokens = user.split(/[\._\-+]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.some(t => GENERIC_ROLE_ACCOUNTS.has(t));
}

/**
 * Capitalizes first letter of string and lowercases the remainder.
 */
export function capitalizeWord(word: string): string {
  if (!word) return '';
  const clean = word.trim().replace(/[^a-zA-Z\u00C0-\u024F]/g, '');
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

/**
 * Parses First Name, Last Name, and Full Name from an email address or username.
 * Supports intelligent token separation, initial filtering, and role-based detection.
 * If the email is generic (e.g. info, sales, order), returns no name unless
 * an explicit personal name was associated with the email.
 */
export function parseNameFromEmail(emailOrUser: string, fallbackName?: string): ParsedNameResult {
  const roleBased = isRoleBasedEmail(emailOrUser);

  // If an explicit personal name with at least one valid word is provided and it doesn't look like an email or company placeholder
  if (fallbackName && fallbackName.trim() && !fallbackName.includes('@')) {
    const cleanFallback = fallbackName.trim().replace(/["']/g, '');
    const isCompanyPlaceholder = /^(company|corporate|lead|unknown|client|customer|vendor|supplier|organization|n\/a)$/i.test(cleanFallback);
    
    if (!isCompanyPlaceholder) {
      const parts = cleanFallback.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        const fn = capitalizeWord(parts[0]);
        const ln = capitalizeWord(parts[parts.length - 1]);
        if (fn && ln) {
          return { firstName: fn, lastName: ln, fullName: `${fn} ${ln}`, isRoleBased: roleBased };
        }
      } else if (parts.length === 1) {
        const fn = capitalizeWord(parts[0]);
        if (fn && !GENERIC_ROLE_ACCOUNTS.has(fn.toLowerCase())) {
          return { firstName: fn, lastName: '', fullName: fn, isRoleBased: roleBased };
        }
      }
    }
  }

  // If the email is generic (e.g. info@, sales@, orders@) and no explicit personal name was provided,
  // do NOT invent a person named "Info" or "Sales". Record NO personal name.
  if (roleBased) {
    return { firstName: '', lastName: '', fullName: '', isRoleBased: true };
  }

  if (!emailOrUser) {
    return { firstName: '', lastName: '', fullName: '', isRoleBased: false };
  }

  // Extract user part before @
  let user = emailOrUser.toLowerCase().trim();
  if (user.includes('@')) {
    user = user.split('@')[0].trim();
  }

  // Remove common trailing numbers (e.g. john.doe99 -> john.doe)
  user = user.replace(/\d+$/g, '');

  // Split on common delimiters: dots, underscores, hyphens, plus signs
  const rawTokens = user
    .split(/[\._\-+]+/)
    .map(t => t.trim().replace(/[^a-zA-Z\u00C0-\u024F]/g, ''))
    .filter(Boolean);

  if (rawTokens.length === 0) {
    return { firstName: '', lastName: '', fullName: '', isRoleBased: false };
  }

  // Filter out single-letter initials (e.g., "p" in "mladenka.p" or "p.mladenka") and generic words
  const fullTokens = rawTokens.filter(t => t.length > 1 && !GENERIC_ROLE_ACCOUNTS.has(t));

  if (fullTokens.length >= 2) {
    const fn = capitalizeWord(fullTokens[0]);
    const ln = capitalizeWord(fullTokens[1]);
    return {
      firstName: fn,
      lastName: ln,
      fullName: `${fn} ${ln}`,
      isRoleBased: false
    };
  } else if (fullTokens.length === 1) {
    const fn = capitalizeWord(fullTokens[0]);
    return {
      firstName: fn,
      lastName: '',
      fullName: fn,
      isRoleBased: false
    };
  }

  return { firstName: '', lastName: '', fullName: '', isRoleBased: false };
}
