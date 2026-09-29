import { extractEmailsFromText } from './dorkHelper';
import type { ExtractedEmail } from '../types';
import * as XLSX from 'xlsx';

/**
 * Reusable Folder & File Email Parsing Engine
 * 
 * Provides extraction of email addresses from files in a folder or multiple files,
 * supporting text, CSV, TSV, JSON, HTML, XML, Markdown, logs, etc.
 */

// Robust RFC-compliant email regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Image and binary extensions to avoid false positives
const EXCLUDED_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp|tiff|css|js|map|woff|woff2|ttf|eot)$/i;

/**
 * Extracts clean, deduplicated email addresses from any raw text.
 */
export function extractEmailsFromRawText(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX) || [];
  const emailSet = new Set<string>();

  for (const match of matches) {
    const clean = match.toLowerCase().trim();
    if (!EXCLUDED_EXTENSIONS.test(clean) && clean.includes('.') && clean.length > 5 && clean.length < 120) {
      emailSet.add(clean);
    }
  }

  return Array.from(emailSet);
}

/**
 * Reads a single file asynchronously and returns extracted emails.
 */
export async function readEmailsFromFile(file: File): Promise<string[]> {
  try {
    // If file is very large (e.g. over 30MB), skip or yield
    if (file.size > 30 * 1024 * 1024) {
      return [];
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      let sheetText = '';
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        sheetText += XLSX.utils.sheet_to_csv(sheet) + '\n';
      }
      return extractEmailsFromRawText(sheetText);
    }

    const text = await file.text();
    return extractEmailsFromRawText(text);
  } catch (err) {
    console.warn(`[readEmailsFromFile] Error parsing ${file.name}:`, err);
    return [];
  }
}

/**
 * Traverses a FileSystemEntry (directory or file) from Drag and Drop.
 */
export async function traverseFileSystemEntry(entry: any): Promise<File[]> {
  const files: File[] = [];

  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) => {
      entry.file((f: File) => resolve(f), () => resolve(null));
    });
    if (file) files.push(file);
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const readAllEntries = async (): Promise<any[]> => {
      let allEntries: any[] = [];
      let batch = await new Promise<any[]>((resolve, reject) => dirReader.readEntries(resolve, reject));
      while (batch.length > 0) {
        allEntries = allEntries.concat(batch);
        batch = await new Promise<any[]>((resolve, reject) => dirReader.readEntries(resolve, reject));
      }
      return allEntries;
    };

    try {
      const entries = await readAllEntries();
      const subPromises = entries.map(child => traverseFileSystemEntry(child));
      const subResults = await Promise.all(subPromises);
      subResults.forEach(arr => files.push(...arr));
    } catch (e) {
      console.error('Error traversing directory entry:', e);
    }
  }

  return files;
}

/**
 * Reads an array or FileList of files and extracts all unique emails.
 */
export async function extractEmailsFromFiles(
  files: FileList | File[],
  onProgress?: (processed: number, total: number, currentFileName: string) => void
): Promise<{ emails: string[]; fileCount: number }> {
  const fileArray = Array.from(files);
  const emailSet = new Set<string>();
  const total = fileArray.length;

  for (let i = 0; i < total; i++) {
    const file = fileArray[i];
    if (onProgress) {
      onProgress(i + 1, total, file.name);
    }
    // Yield to browser event loop
    if (i % 5 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }

    const found = await readEmailsFromFile(file);
    found.forEach(e => emailSet.add(e));
  }

  return {
    emails: Array.from(emailSet),
    fileCount: total
  };
}

/**
 * Reads an array or FileList of files from a folder and returns fully enriched ExtractedEmail leads
 * with Company Name, Website, Country, First Name, Last Name, and Role Account classification.
 */
export async function extractLeadsFromFiles(
  files: FileList | File[],
  fallbackCountry: string = 'N/A',
  onProgress?: (processed: number, total: number, currentFileName: string) => void
): Promise<{ leads: ExtractedEmail[]; emails: string[]; fileCount: number }> {
  const fileArray = Array.from(files);
  const leadsMap = new Map<string, ExtractedEmail>();
  const total = fileArray.length;

  for (let i = 0; i < total; i++) {
    const file = fileArray[i];
    if (onProgress) {
      onProgress(i + 1, total, file.name);
    }
    if (i % 5 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }

    if (file.size > 25 * 1024 * 1024) continue;

    try {
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsText(file);
      });

      if (text) {
        const fileLeads = extractEmailsFromText(text, fallbackCountry);
        for (const lead of fileLeads) {
          if (!leadsMap.has(lead.email)) {
            leadsMap.set(lead.email, lead);
          }
        }
      }
    } catch {
      // Skip problematic files gracefully
    }
  }

  const leads = Array.from(leadsMap.values());
  return {
    leads,
    emails: leads.map(l => l.email),
    fileCount: total
  };
}
