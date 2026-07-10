import { describe, expect, it } from 'vitest';
import {
  isSensitiveKey,
  redactSensitiveValues,
  redactSensitiveJsonString,
} from './credential-redaction';

const CANARY = 'DO_NOT_PERSIST_PASSWORD_123';

describe('isSensitiveKey', () => {
  it('returns true for sensitive key names', () => {
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('secret')).toBe(true);
    expect(isSensitiveKey('token')).toBe(true);
    expect(isSensitiveKey('apiKey')).toBe(true);
    expect(isSensitiveKey('serviceRole')).toBe(true);
    expect(isSensitiveKey('accountPassword')).toBe(true);
  });

  it('returns true for case-insensitive variants', () => {
    expect(isSensitiveKey('PASSWORD')).toBe(true);
    expect(isSensitiveKey('MySecret')).toBe(true);
    expect(isSensitiveKey('api_key')).toBe(true);
    expect(isSensitiveKey('service-role')).toBe(true);
    expect(isSensitiveKey('account_password')).toBe(true);
  });

  it('returns false for non-sensitive keys', () => {
    expect(isSensitiveKey('username')).toBe(false);
    expect(isSensitiveKey('text')).toBe(false);
    expect(isSensitiveKey('stepId')).toBe(false);
    expect(isSensitiveKey('output')).toBe(false);
  });

  it('returns false for allowed status keys despite matching patterns', () => {
    expect(isSensitiveKey('secret_scrub_status')).toBe(false);
    expect(isSensitiveKey('secretScrubStatus')).toBe(false);
    expect(isSensitiveKey('redaction_status')).toBe(false);
    expect(isSensitiveKey('redactionStatus')).toBe(false);
    expect(isSensitiveKey('credential_policy_status')).toBe(false);
    expect(isSensitiveKey('credentialPolicyStatus')).toBe(false);
  });
});

describe('redactSensitiveValues', () => {
  it('redacts password, secret, token, and apiKey values to [REDACTED]', () => {
    const input = {
      password: 'hunter2',
      secret: 'shh',
      token: 'tkn_123',
      apiKey: 'ak_456',
      username: 'alice',
    };
    const result = redactSensitiveValues(input);
    expect(result.password).toBe('[REDACTED]');
    expect(result.secret).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
    expect(result.username).toBe('alice');
  });

  it('preserves allowed status keys', () => {
    const input = {
      secret_scrub_status: 'applied',
      credential_policy_status: 'server_managed',
      redaction_status: 'complete',
      password: 'hunter2',
    };
    const result = redactSensitiveValues(input);
    expect(result.secret_scrub_status).toBe('applied');
    expect(result.credential_policy_status).toBe('server_managed');
    expect(result.redaction_status).toBe('complete');
    expect(result.password).toBe('[REDACTED]');
  });

  it('handles nested objects', () => {
    const input = {
      outer: { secret: 'nested-secret', data: 'ok' },
      password: 'top-level',
    };
    const result = redactSensitiveValues(input);
    expect(result.outer.secret).toBe('[REDACTED]');
    expect(result.outer.data).toBe('ok');
    expect(result.password).toBe('[REDACTED]');
  });

  it('handles arrays', () => {
    const input = {
      items: [
        { password: 'arr-pw', label: 'a' },
        { password: 'arr-pw-2', label: 'b' },
      ],
    };
    const result = redactSensitiveValues(input);
    expect(result.items[0].password).toBe('[REDACTED]');
    expect(result.items[0].label).toBe('a');
    expect(result.items[1].password).toBe('[REDACTED]');
    expect(result.items[1].label).toBe('b');
  });

  it('does not mutate the original object', () => {
    const input = { password: 'original', data: 'keep' };
    const result = redactSensitiveValues(input);
    expect(result.password).toBe('[REDACTED]');
    expect(input.password).toBe('original');
    expect(result).not.toBe(input);
  });

  it('preserves non-string sensitive values (only redacts non-empty strings)', () => {
    const input = { password: 12345, token: true, secret: null };
    const result = redactSensitiveValues(input);
    expect(result.password).toBe(12345);
    expect(result.token).toBe(true);
    expect(result.secret).toBe(null);
  });

  it('redacts empty-string sensitive values only if non-empty', () => {
    const input = { password: '', secret: 'has-value' };
    const result = redactSensitiveValues(input);
    expect(result.password).toBe('');
    expect(result.secret).toBe('[REDACTED]');
  });
});

describe('redactSensitiveJsonString', () => {
  it('redacts sensitive values in JSON strings', () => {
    const json = JSON.stringify({ password: 'leaked', token: 'abc', username: 'bob' });
    const result = redactSensitiveJsonString(json);
    expect(result).not.toContain('leaked');
    expect(result).not.toContain('"abc"');
    expect(result).toContain('[REDACTED]');
    expect(result).toContain('bob');
  });

  it('passes through non-JSON strings without sensitive keys unchanged', () => {
    const text = 'This is a normal log message with no secrets.';
    expect(redactSensitiveJsonString(text)).toBe(text);
  });

  it('passes through JSON strings without sensitive keys unchanged', () => {
    const json = JSON.stringify({ username: 'bob', count: 3 });
    expect(redactSensitiveJsonString(json)).toBe(json);
  });

  it('applies pattern-based redaction to non-JSON strings with sensitive keys', () => {
    const text = 'Error: password="leaked-pw" was rejected';
    const result = redactSensitiveJsonString(text);
    expect(result).not.toContain('leaked-pw');
    expect(result).toContain('[REDACTED]');
  });

  it('returns non-string inputs unchanged', () => {
    expect(redactSensitiveJsonString(null as unknown as string)).toBe(null);
    expect(redactSensitiveJsonString(undefined as unknown as string)).toBe(undefined);
  });
});

describe('canary: plaintext credential does not appear in persisted data', () => {
  it('redactSensitiveValues removes canary from sensitive keys', () => {
    const input = { password: CANARY, username: 'testuser', text: CANARY };
    const result = redactSensitiveValues(input);
    // The canary must be redacted from the sensitive `password` key.
    expect(result.password).toBe('[REDACTED]');
    expect(result.password).not.toContain(CANARY);
    // text is NOT a sensitive key, so the redactor won't redact it - this
    // proves the redactor works on KEY names, not values. The canary in
    // `text` is intentionally retained.
    expect(result.text).toBe(CANARY);
    // The canary must NOT appear under any sensitive key in the serialized
    // output. Only non-sensitive keys may retain it.
    const reSerialized = JSON.stringify(result);
    const sensitiveKeyPattern = /"(password|secret|token|apiKey|serviceRole|accountPassword|account_password)":"[^"]*"/gi;
    const sensitiveMatches = reSerialized.match(sensitiveKeyPattern) ?? [];
    for (const match of sensitiveMatches) {
      expect(match).not.toContain(CANARY);
    }
  });

  it('redactSensitiveValues removes canary from nested objects', () => {
    const input = {
      outer: { secret: CANARY, data: 'ok' },
      password: CANARY,
    };
    const result = redactSensitiveValues(input);
    expect(JSON.stringify(result)).not.toContain(CANARY);
  });

  it('redactSensitiveJsonString removes canary from JSON string', () => {
    const json = JSON.stringify({ password: CANARY, token: 'abc' });
    const result = redactSensitiveJsonString(json);
    expect(result).not.toContain(CANARY);
    expect(result).toContain('[REDACTED]');
  });

  it('redactSensitiveValues removes canary from arrays of objects', () => {
    const input = {
      steps: [
        { password: CANARY, label: 'a' },
        { secret: CANARY, label: 'b' },
      ],
    };
    const result = redactSensitiveValues(input);
    expect(JSON.stringify(result)).not.toContain(CANARY);
  });

  it('canary is absent from a realistic step output payload', () => {
    // Simulate a step output that accidentally includes a password field
    const input = {
      success: true,
      output: {
        text: '[REDACTED]',
        password: CANARY,
        backend: 'mobile-mcp',
        serial: 'serial-1',
      },
      errorPayload: null,
    };
    const result = redactSensitiveValues(input);
    expect(JSON.stringify(result)).not.toContain(CANARY);
    expect(result.output.password).toBe('[REDACTED]');
  });
});
