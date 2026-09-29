import * as XLSX from 'xlsx';
import { streamExtractEmailsFromFile, StreamParserOptions, StreamProgressStats } from './streamingFileParser';

export * from './streamingFileParser';

/**
 * Robust, linear-time RFC-compliant email regex
 */
export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Fast, linear-time domain regex without nested exponential backtracking.
 * Matches standard domains, multi-level ccTLDs (e.g. co.uk, com.au), and international domains.
 */
export const SAFE_DOMAIN_REGEX = /\b(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9-]{1,63})+\.[a-zA-Z]{2,24})\b/gi;

const IGNORED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff',
  'pdf', 'zip', 'rar', 'tar', 'gz', '7z', 'bz2',
  'mp3', 'mp4', 'avi', 'mov', 'wav', 'ogg',
  'exe', 'dmg', 'apk', 'iso', 'bin', 'msi',
  'csv', 'xlsx', 'xls', 'tsv', 'txt', 'json', 'xml', 'css', 'js', 'html', 'htm', 'md'
]);

/**
 * Extracts emails from a string using robust linear regex.
 * Filters out junk patterns like image001.gif, part1, etc.
 */
export const extractEmailsFromString = (
  text: string,
  options?: { preserveRoleAccounts?: boolean }
): string[] => {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return [];

  const junkPrefixes = ['image', 'part', 'attachment', 'frame', 'thumb', 'clip', 'img', 'file'];
  const fileExtensions = ['.gif', '.jpg', '.jpeg', '.png', '.bmp', '.svg', '.pdf', '.doc', '.docx', '.zip', '.rar'];
  const forbiddenUsernames = new Set(['postmaster', 'privacy', 'webmaster', 'abuse', 'mailer-daemon', 'root']);

  const seen = new Set<string>();
  const results: string[] = [];

  for (let i = 0; i < matches.length; i++) {
    const raw = matches[i];
    const email = raw.toLowerCase().trim().replace(/^[.<>]+|[.<>]+$/g, '');
    if (email.length < 5 || email.length > 100 || !email.includes('@')) continue;

    const [user, domain] = email.split('@');
    if (!user || !domain || !domain.includes('.')) continue;

    if (!options?.preserveRoleAccounts) {
      if (forbiddenUsernames.has(user) || 
          user.includes('noreply') || 
          user.includes('no-reply') || 
          user.includes('news') || 
          user.includes('newsletter')) {
        continue;
      }
    }

    if (junkPrefixes.some(prefix => new RegExp(`^${prefix}\\d+`, 'i').test(user))) continue;
    if (fileExtensions.some(ext => user.endsWith(ext))) continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user)) continue;

    if (!seen.has(email)) {
      seen.add(email);
      results.push(email);
    }
  }

  return results;
};

/**
 * Universal safe non-blocking file email extractor.
 * Always routes through streaming / chunked parsing to ensure the browser event loop never freezes.
 */
export const extractEmailsFromFile = async (
  file: File,
  options?: StreamParserOptions
): Promise<string[]> => {
  const result = await streamExtractEmailsFromFile(file, options);
  return result.emails;
};

export interface MXFileExtractResult {
  items: string[];
  totalUnique: number;
  emailsCount: number;
  domainsCount: number;
  fileName: string;
  fileSize: number;
  fileType: 'excel' | 'csv' | 'txt' | 'other';
}

export interface MXFolderExtractResult {
  folderName: string;
  totalFiles: number;
  filesWithTargets: number;
  totalSize: number;
  totalUnique: number;
  emailsCount: number;
  domainsCount: number;
  items: string[];
}

/**
 * Fast, non-blocking synchronous extractor for small/medium strings.
 * Uses linear non-backtracking patterns to prevent browser thread freeze.
 */
export const extractTargetsFromText = (rawText: string): { emails: string[]; domains: string[] } => {
  if (!rawText) return { emails: [], domains: [] };

  const emails = extractEmailsFromString(rawText, { preserveRoleAccounts: true });
  const standaloneDomains = new Set<string>();

  // Reset regex state
  SAFE_DOMAIN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SAFE_DOMAIN_REGEX.exec(rawText)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > 0 && rawText[matchIndex - 1] === '@') continue;

    const domainCandidate = match[1]?.toLowerCase().trim();
    if (!domainCandidate || domainCandidate.length > 100 || !domainCandidate.includes('.')) continue;

    const tld = domainCandidate.split('.').pop() || '';
    if (IGNORED_EXTENSIONS.has(tld)) continue;

    standaloneDomains.add(domainCandidate);
    if (standaloneDomains.size >= 100000) break;
  }

  return { emails, domains: Array.from(standaloneDomains) };
};

/**
 * Asynchronous chunked extractor for large text blocks (> 250KB).
 * Slices the text and yields control to the browser between chunks so UI remains silky smooth.
 */
export const extractTargetsFromTextAsync = async (
  rawText: string,
  onProgress?: (percent: number, itemsCount: number) => void
): Promise<{ emails: string[]; domains: string[] }> => {
  if (!rawText) return { emails: [], domains: [] };

  const emailSet = new Set<string>();
  const domainSet = new Set<string>();

  const CHUNK_SIZE = 500 * 1024; // 500KB slices
  const totalLength = rawText.length;
  let offset = 0;
  let overlap = '';

  while (offset < totalLength) {
    const nextOffset = Math.min(offset + CHUNK_SIZE, totalLength);
    const slice = overlap + rawText.slice(offset, nextOffset);
    
    // Process slice
    const extracted = extractTargetsFromText(slice);
    extracted.emails.forEach(e => emailSet.add(e));
    extracted.domains.forEach(d => domainSet.add(d));

    // Keep last 512 bytes for boundary overlap
    overlap = slice.length > 512 ? slice.slice(-512) : '';
    offset = nextOffset;

    if (onProgress) {
      onProgress(Math.round((offset / totalLength) * 100), emailSet.size + domainSet.size);
    }

    // Yield control to event loop so browser never hangs
    await new Promise(r => setTimeout(r, 0));
  }

  return {
    emails: Array.from(emailSet),
    domains: Array.from(domainSet)
  };
};

/**
 * Filter to verify if a file from a folder is a supported text/spreadsheet/markup document.
 */
export const isSupportedFolderFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  if (name.startsWith('.') || name === 'thumbs.db' || name.startsWith('~$') || name === '.ds_store') {
    return false;
  }
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const allowed = ['txt', 'csv', 'cvs', 'xlsx', 'xls', 'tsv', 'json', 'log', 'xml', 'html', 'htm', 'md', 'eml', 'msg'];
  return allowed.includes(ext);
};

/**
 * Extracts emails and domains from an entire folder (batch of files) with cooperative async yielding.
 */
export const extractTargetsFromFolderFiles = async (
  files: File[],
  folderName: string,
  onProgress?: (info: { current: number; total: number; emailsCount: number; currentFileName: string }) => void,
  signal?: AbortSignal
): Promise<MXFolderExtractResult> => {
  const supportedFiles = files.filter(isSupportedFolderFile);
  const allEmails = new Set<string>();
  const allDomains = new Set<string>();
  let filesWithTargets = 0;
  let totalSize = 0;

  for (let i = 0; i < supportedFiles.length; i++) {
    if (signal?.aborted) break;
    const file = supportedFiles[i];
    totalSize += file.size;

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: supportedFiles.length,
        emailsCount: allEmails.size,
        currentFileName: file.name
      });
    }

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        await new Promise(r => setTimeout(r, 0)); // Yield before parsing Excel
        const workbook = XLSX.read(buffer, { type: 'array', cellFormula: false, cellHTML: false });
        
        for (let s = 0; s < workbook.SheetNames.length; s++) {
          const sheet = workbook.Sheets[workbook.SheetNames[s]];
          const sheetCsv = XLSX.utils.sheet_to_csv(sheet);
          const { emails, domains } = extractTargetsFromText(sheetCsv);
          emails.forEach(e => allEmails.add(e));
          domains.forEach(d => allDomains.add(d));
          if (emails.length > 0 || domains.length > 0) filesWithTargets++;
          await new Promise(r => setTimeout(r, 0)); // Yield between sheets
        }
      } else {
        // Read file in stream or text
        const text = await file.text();
        const { emails, domains } = text.length > 300_000 
          ? await extractTargetsFromTextAsync(text)
          : extractTargetsFromText(text);

        let fileFoundCount = 0;
        emails.forEach(e => {
          allEmails.add(e);
          fileFoundCount++;
        });
        domains.forEach(d => {
          allDomains.add(d);
          fileFoundCount++;
        });

        if (fileFoundCount > 0) {
          filesWithTargets++;
        }
      }
    } catch (err) {
      console.warn(`[Folder Scanner] Skipping unreadable file ${file.name}:`, err);
    }

    // Always yield to browser event loop
    await new Promise(r => setTimeout(r, 0));
  }

  const allItems = Array.from(new Set([...allEmails, ...allDomains]));

  return {
    folderName,
    totalFiles: supportedFiles.length,
    filesWithTargets,
    totalSize,
    totalUnique: allItems.length,
    emailsCount: allEmails.size,
    domainsCount: allDomains.size,
    items: allItems
  };
};

/**
 * Extracts emails and standalone domains from uploaded Excel (.xlsx, .xls), CSV (.csv, .cvs), or TXT (.txt) files.
 * Memory-safe and 100% non-blocking: streams slices and yields to keep browser responsive at all times.
 */
export const extractTargetsForMXFromFile = async (
  file: File,
  onProgress?: (stats: { percent: number; emailsCount: number; domainsCount: number; status: string }) => void
): Promise<MXFileExtractResult> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isExcel = ext === 'xlsx' || ext === 'xls';
  const isCsv = ext === 'csv' || ext === 'cvs';
  const isTxt = ext === 'txt' || ext === 'text';

  const fileType: 'excel' | 'csv' | 'txt' | 'other' = isExcel 
    ? 'excel' 
    : isCsv 
    ? 'csv' 
    : isTxt 
    ? 'txt' 
    : 'other';

  try {
    const emailSet = new Set<string>();
    const domainSet = new Set<string>();

    if (isExcel) {
      if (onProgress) onProgress({ percent: 10, emailsCount: 0, domainsCount: 0, status: 'Reading Excel workbook...' });
      const buffer = await file.arrayBuffer();
      await new Promise(r => setTimeout(r, 0)); // Yield

      const workbook = XLSX.read(buffer, { type: 'array', cellFormula: false, cellHTML: false });
      const totalSheets = workbook.SheetNames.length;

      for (let i = 0; i < totalSheets; i++) {
        const sheetName = workbook.SheetNames[i];
        const worksheet = workbook.Sheets[sheetName];
        const sheetCsv = XLSX.utils.sheet_to_csv(worksheet);
        
        const { emails, domains } = extractTargetsFromText(sheetCsv);
        emails.forEach(e => emailSet.add(e));
        domains.forEach(d => domainSet.add(d));

        if (onProgress) {
          const percent = Math.round(10 + ((i + 1) / totalSheets) * 85);
          onProgress({
            percent,
            emailsCount: emailSet.size,
            domainsCount: domainSet.size,
            status: `Parsed sheet ${i + 1} of ${totalSheets} (${sheetName})...`
          });
        }
        await new Promise(r => setTimeout(r, 0)); // Yield between sheets
      }
    } else {
      // Chunked slice reader for text/CSV files to never freeze on 1MB-100MB files
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalBytes = file.size;
      let bytesProcessed = 0;
      let overlapBuffer = '';
      const decoder = new TextDecoder('utf-8');

      while (bytesProcessed < totalBytes) {
        const end = Math.min(bytesProcessed + chunkSize, totalBytes);
        const slice = file.slice(bytesProcessed, end);
        const buffer = await slice.arrayBuffer();
        const chunkText = decoder.decode(buffer, { stream: end < totalBytes });

        const combinedText = overlapBuffer + chunkText;
        const { emails, domains } = extractTargetsFromText(combinedText);
        emails.forEach(e => emailSet.add(e));
        domains.forEach(d => domainSet.add(d));

        overlapBuffer = combinedText.length > 512 ? combinedText.slice(-512) : '';
        bytesProcessed = end;

        if (onProgress) {
          const percent = Math.min(99, Math.round((bytesProcessed / totalBytes) * 100));
          onProgress({
            percent,
            emailsCount: emailSet.size,
            domainsCount: domainSet.size,
            status: `Reading file ${percent}% (${emailSet.size.toLocaleString()} emails found)...`
          });
        }

        // Cooperative yield
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const allItems = Array.from(new Set([...emailSet, ...domainSet]));

    if (onProgress) {
      onProgress({
        percent: 100,
        emailsCount: emailSet.size,
        domainsCount: domainSet.size,
        status: `Done! ${allItems.length.toLocaleString()} targets extracted.`
      });
    }

    return {
      items: allItems,
      totalUnique: allItems.length,
      emailsCount: emailSet.size,
      domainsCount: domainSet.size,
      fileName: file.name,
      fileSize: file.size,
      fileType
    };
  } catch (err: any) {
    console.error("Error extracting targets for MX from file:", err);
    throw new Error(`Failed to parse ${file.name}: ${err?.message || 'Unsupported file structure'}`);
  }
};
