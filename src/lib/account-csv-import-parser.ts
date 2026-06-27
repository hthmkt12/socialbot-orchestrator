/**
 * CSV parser for bulk account import.
 *
 * Expects columns: username, password, platform, daily_limit (optional).
 * Returns parsed rows with validation errors per row.
 */
import type { AccountPlatform } from './database.types';

export interface CsvAccountRow {
  username: string;
  password: string;
  platform: AccountPlatform;
  daily_limit: number;
}

export interface CsvParseResult {
  valid: CsvAccountRow[];
  errors: { line: number; message: string }[];
}

const VALID_PLATFORMS = new Set<string>(['instagram', 'tiktok', 'facebook']);
const DEFAULT_DAILY_LIMIT = 100;

/** Parses raw CSV text into validated account rows. */
export function parseAccountCsv(csvText: string): CsvParseResult {
  const trimmed = csvText.trim();
  if (!trimmed) {
    return { valid: [], errors: [{ line: 1, message: 'Empty file' }] };
  }
  const lines = trimmed.split(/\r?\n/);

  const headerLine = lines[0].toLowerCase().trim();
  const hasHeader = headerLine.includes('username') || headerLine.includes('platform');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const valid: CsvAccountRow[] = [];
  const errors: CsvParseResult['errors'] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = hasHeader ? i + 2 : i + 1;
    const raw = dataLines[i].trim();
    if (!raw) continue;

    const cols = splitCsvLine(raw);
    if (cols.length < 3) {
      errors.push({ line: lineNum, message: `Expected at least 3 columns (username, password, platform), got ${cols.length}` });
      continue;
    }

    const username = cols[0].trim();
    const password = cols[1].trim();
    const platformRaw = cols[2].trim().toLowerCase();
    const limitRaw = cols[3]?.trim();

    if (!username) {
      errors.push({ line: lineNum, message: 'Username is empty' });
      continue;
    }
    if (!password) {
      errors.push({ line: lineNum, message: 'Password is empty' });
      continue;
    }
    if (!VALID_PLATFORMS.has(platformRaw)) {
      errors.push({ line: lineNum, message: `Invalid platform "${platformRaw}" (expected: instagram, tiktok, facebook)` });
      continue;
    }

    let dailyLimit = DEFAULT_DAILY_LIMIT;
    if (limitRaw) {
      const parsed = parseInt(limitRaw, 10);
      if (isNaN(parsed) || parsed < 1) {
        errors.push({ line: lineNum, message: `Invalid daily_limit "${limitRaw}"` });
        continue;
      }
      dailyLimit = parsed;
    }

    valid.push({
      username,
      password,
      platform: platformRaw as AccountPlatform,
      daily_limit: dailyLimit,
    });
  }

  return { valid, errors };
}

/** Splits a CSV line respecting quoted fields. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Generates a sample CSV string for download.
 * Users can use this as a template for their import file.
 */
export function generateSampleCsv(): string {
  return [
    'username,password,platform,daily_limit',
    'john_doe,mypassword123,instagram,100',
    'tiktok_user,securepass,tiktok,120',
    'fb_marketer,p@ssw0rd,facebook,80',
  ].join('\n');
}
