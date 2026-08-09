import { describe, expect, it } from 'vitest';
import {
  isSensitiveKey,
  redactSensitiveValues,
  redactSensitiveJsonString,
  redactSensitiveText,
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
  it('fails closed when sensitive values occur beyond the maximum depth', () => {
    const input: Record<string, unknown> = {};
    let cursor = input;
    for (let depth = 0; depth < 12; depth += 1) {
      const nested: Record<string, unknown> = {};
      cursor.child = nested;
      cursor = nested;
    }
    cursor.password = CANARY;

    const result = redactSensitiveValues(input);

    expect(JSON.stringify(result)).not.toContain(CANARY);
    expect(JSON.stringify(result)).toContain('max_depth_exceeded');
  });

  it('terminates and fails closed for circular records', () => {
    const input: Record<string, unknown> = { label: 'root' };
    input.self = input;

    const result = redactSensitiveValues(input);

    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.stringify(result)).toContain('max_depth_exceeded');
  });

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

describe('redactSensitiveText — literal value redaction', () => {
  const CANARY = 'DO_NOT_PERSIST_PASSWORD_123';

  it('redacts a bare sensitive value in a string', () => {
    const result = redactSensitiveText(`Error: ${CANARY} was rejected`, [CANARY]);
    expect(result).toBe('Error: [REDACTED] was rejected');
  });

  it('redacts sensitive value under a non-sensitive key (text)', () => {
    const result = redactSensitiveText({ text: CANARY, backend: 'mobile-mcp' }, [CANARY]);
    expect((result as Record<string, unknown>).text).toBe('[REDACTED]');
    expect((result as Record<string, unknown>).backend).toBe('mobile-mcp');
  });

  it('redacts sensitive value nested inside output.bridge', () => {
    const input = {
      output: {
        bridge: { text: CANARY, message: 'ok' },
        backend: 'mobile-mcp',
      },
    };
    const result = redactSensitiveText(input, [CANARY]) as Record<string, unknown>;
    const output = result.output as Record<string, unknown>;
    const bridge = output.bridge as Record<string, unknown>;
    expect(bridge.text).toBe('[REDACTED]');
    expect(bridge.message).toBe('ok');
    expect(JSON.stringify(result)).not.toContain(CANARY);
  });

  it('redacts sensitive values in arrays', () => {
    const input = { steps: [CANARY, 'safe-text', CANARY] };
    const result = redactSensitiveText(input, [CANARY]) as Record<string, unknown>;
    const steps = result.steps as unknown[];
    expect(steps[0]).toBe('[REDACTED]');
    expect(steps[1]).toBe('safe-text');
    expect(steps[2]).toBe('[REDACTED]');
  });

  it('redacts sensitive values in nested arrays of objects', () => {
    const input = {
      items: [
        { label: 'a', error: `failed: ${CANARY}` },
        { label: 'b', error: 'clean' },
      ],
    };
    const result = redactSensitiveText(input, [CANARY]);
    expect(JSON.stringify(result)).not.toContain(CANARY);
  });

  it('handles non-JSON strings containing the canary', () => {
    const input = `Step failed with input ${CANARY} at line 42`;
    const result = redactSensitiveText(input, [CANARY]);
    expect(result).toBe('Step failed with input [REDACTED] at line 42');
  });

  it('returns input unchanged when no sensitive values provided', () => {
    const input = { text: 'hello', data: [1, 2] };
    const result = redactSensitiveText(input, []);
    expect(result).toBe(input);
  });

  it('filters out __DECRYPT_FAILED__ and empty strings from sensitive values', () => {
    const input = { text: 'hello', error: '__DECRYPT_FAILED__' };
    const result = redactSensitiveText(input, ['', '__DECRYPT_FAILED__', 'hello']);
    expect((result as Record<string, unknown>).text).toBe('[REDACTED]');
    // __DECRYPT_FAILED__ should NOT be redacted (it is a safe placeholder)
    expect((result as Record<string, unknown>).error).toBe('__DECRYPT_FAILED__');
  });

  it('redacts multiple sensitive values simultaneously', () => {
    const result = redactSensitiveText(
      `password1=secret1, password2=secret2`,
      ['secret1', 'secret2']
    );
    expect(result).toBe('password1=[REDACTED], password2=[REDACTED]');
  });

  it('does not mutate the original object', () => {
    const input = { text: CANARY, nested: { value: CANARY } };
    const result = redactSensitiveText(input, [CANARY]);
    expect(input.text).toBe(CANARY);
    expect(input.nested.value).toBe(CANARY);
    expect(result).not.toBe(input);
  });

  it('fails closed for circular and deeply nested literal inputs', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let depth = 0; depth < 12; depth += 1) {
      const nested: Record<string, unknown> = {};
      cursor.child = nested;
      cursor = nested;
    }
    cursor.value = CANARY;

    const circularResult = redactSensitiveText(circular, [CANARY]);
    const deepResult = redactSensitiveText(deep, [CANARY]);

    expect(JSON.stringify(circularResult)).toContain('cycle_detected');
    expect(JSON.stringify(deepResult)).not.toContain(CANARY);
    expect(JSON.stringify(deepResult)).toContain('max_depth_exceeded');
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
