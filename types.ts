export interface ExtractedEmail {
  email: string;
  sourceUrl: string;
  companyName?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  isRoleBased?: boolean;
  domain?: string;
  isValid?: boolean;
  phone?: string;
  role?: string;
  title?: string;
  mxStatus?: 'valid' | 'invalid' | 'unknown' | 'unverified';
  mxProvider?: string;
  confidenceScore?: number;
  extractedAt?: string;
  searchEngine?: string;
  isNew?: boolean;
}

export interface CompanyIntel {
  domain: string;
  companyName: string;
  industry: string;
  subCategory?: string;
  productCategory?: string; // Main product/service category classification
  primaryProducts?: string[]; // Core products or services offered
  overview: string;
  businessModel?: string;
  headquarters?: string;
  title?: string;
  metaDescription?: string;
  searchSnippet?: string;
  websiteUrl?: string;
  websiteStatus: 'online' | 'unreachable' | 'offline';
  websiteSnippet?: string;
  headings?: string[];
  groundingSource?: string;
  favicon?: string;
  confidenceScore?: number;
  isAiEnhanced?: boolean;
  emails: string[];
}

export interface IndustryGroupIntel {
  industry: string;
  emails: string[];
  companies: CompanyIntel[];
}

export interface ProductGroupIntel {
  productCategory: string;
  emails: string[];
  companies: CompanyIntel[];
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  preset?: string;
}

export type SmtpProviderType = 'gmail' | 'outlook' | 'sendgrid' | 'ses' | 'mailgun' | 'brevo' | 'postmark' | 'zoho' | 'yahoo' | 'custom';

export type LoadBalancingStrategy = 'round_robin' | 'quota_fill' | 'least_used' | 'lowest_latency' | 'weighted';

export interface SmtpRelay {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  preset?: string;
  provider?: SmtpProviderType;
  name?: string;
  hourlyQuota?: number;
  dailyQuota?: number;
  sentCount?: number;
  errorCount?: number;
  maxConsecutiveErrors?: number;
  status: 'active' | 'testing' | 'verified' | 'error' | 'exhausted' | 'cooling_down' | 'disabled';
  lastTested?: string;
  lastLatencyMs?: number;
  errorMessage?: string;
  senderName?: string;
  fromEmail?: string;
  priority?: number;
  weight?: number;
  lastUsedTimestamp?: number;
}

export interface SmtpPoolConfig {
  name: string;
  strategy: LoadBalancingStrategy;
  autoFailover: boolean;
  maxConsecutiveErrors: number;
  cooldownPeriodMinutes: number;
}

export interface SenderUniqueCredentials {
  uniqueMessageIdTemplate: string;
  listUnsubscribe: string;
  listUnsubscribePost: string;
  feedbackId: string;
  returnPath: string;
  xMailer: string;
  organization: string;
  uniqueSignature: string;
  deliverabilityScore: number;
  generatedAt: string;
}

export interface EmailHeaderConfig {
  senderName: string;
  fromEmail: string;
  replyTo: string;
  cc: string;
  bcc: string;
  listUnsubscribe: string;
  listUnsubscribePost?: string;
  feedbackId?: string;
  returnPath?: string;
  xMailer?: string;
  organization: string;
  precedence: string;
  priority: 'normal' | 'high' | 'low';
  customMessageId: boolean;
}

export interface EmailComposerState {
  subject: string;
  bodyMode: 'plain' | 'html';
  plainText: string;
  htmlContent: string;
}

export interface RecipientItem {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  company?: string;
  phone?: string;
  country?: string;
  targetLanguage?: string;
  mxStatus?: 'valid' | 'invalid' | 'unknown' | 'unverified';
  mxHost?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  timestamp?: string;
  messageId?: string;
  error?: string;
  response?: string;
  latencyMs?: number;
  autoTranslated?: boolean;
  translatedLanguage?: string;
}

export interface DeliverabilityAudit {
  domain: string;
  hasMx: boolean;
  mxRecords: string[];
  hasSpf: boolean;
  spfRecord?: string;
  hasDmarc: boolean;
  dmarcRecord?: string;
  dmarcPolicy?: string;
  hasDkim?: boolean;
  dkimSelector?: string;
  dkimRecord?: string;
  score: number;
  recommendations?: string[];
  uniqueCredentials?: SenderUniqueCredentials;
}

export interface HttpApiConfig {
  endpointUrl: string;
  apiKey: string;
  apiProvider?: 'cpanel_php' | 'resend' | 'brevo' | 'sendgrid';
  senderEmail?: string;
  senderName?: string;
  status?: 'verified' | 'untested' | 'error';
  lastTested?: string;
  lastLatencyMs?: number;
  errorMessage?: string;
  serverInfo?: {
    server?: string;
    php_version?: string;
    mta_configured?: boolean;
  };
}

