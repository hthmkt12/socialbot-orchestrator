import { describe, it, expect } from 'vitest';
import { parseAccountCsv, generateSampleCsv } from './account-csv-import-parser';

describe('parseAccountCsv', () => {
  it('parses valid rows with header', () => {
    const csv = 'username,password,platform,daily_limit\njohn,mypass,instagram,100\njane,herpass,tiktok,80';
    const result = parseAccountCsv(csv);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].username).toBe('john');
    expect(result.valid[0].platform).toBe('instagram');
    expect(result.valid[0].daily_limit).toBe(100);
    expect(result.valid[1].username).toBe('jane');
    expect(result.valid[1].platform).toBe('tiktok');
    expect(result.valid[1].daily_limit).toBe(80);
    expect(result.errors).toHaveLength(0);
  });

  it('parses rows without header', () => {
    const csv = 'john,mypass,facebook,50\njane,herpass,instagram';
    const result = parseAccountCsv(csv);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].daily_limit).toBe(50);
    expect(result.valid[1].daily_limit).toBe(100); // default
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid platform', () => {
    const csv = 'username,password,platform\njohn,mypass,snapchat';
    const result = parseAccountCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('snapchat');
  });

  it('rejects empty username', () => {
    const csv = 'username,password,platform\n,mypass,instagram';
    const result = parseAccountCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Username is empty');
  });

  it('rejects too few columns', () => {
    const csv = 'john,onlypass';
    const result = parseAccountCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('3 columns');
  });

  it('handles quoted fields', () => {
    const csv = 'username,password,platform\n"john,doe","my,pass",instagram';
    const result = parseAccountCsv(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].username).toBe('john,doe');
    expect(result.valid[0].password).toBe('my,pass');
  });

  it('skips empty lines', () => {
    const csv = 'username,password,platform\njohn,mypass,instagram\n\njane,herpass,tiktok';
    const result = parseAccountCsv(csv);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid daily_limit', () => {
    const csv = 'username,password,platform,daily_limit\njohn,mypass,instagram,abc';
    const result = parseAccountCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('daily_limit');
  });

  it('returns error on empty input', () => {
    const result = parseAccountCsv('');
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Empty file');
  });
});

describe('generateSampleCsv', () => {
  it('produces valid parsable CSV', () => {
    const csv = generateSampleCsv();
    const result = parseAccountCsv(csv);
    expect(result.valid).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });
});
