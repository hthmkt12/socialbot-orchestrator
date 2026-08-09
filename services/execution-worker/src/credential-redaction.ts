/**
 * Worker-side credential redaction utility.
 *
 * Scrubs sensitive values from objects before persistence or logging.
 * Deny-by-default: any key matching secret patterns gets its value redacted.
 * The key itself is preserved (for debugging) but the value is replaced with [REDACTED].
 */

const SECRET_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /service[_-]?role/i,
  /account[_-]?password/i,
];

const ALLOWED_KEYS = new Set([
  'secret_scrub_status',
  'secretScrubStatus',
  'redaction_status',
  'redactionStatus',
  'credential_policy_status',
  'credentialPolicyStatus',
]);

/**
 * Check if a key name matches sensitive patterns.
 */
export function isSensitiveKey(key: string): boolean {
  if (ALLOWED_KEYS.has(key)) return false;
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Redact sensitive values in a record. Returns a new object with sensitive
 * values replaced by '[REDACTED]'. The original object is not mutated.
 * Recursively redacts nested objects and arrays.
 */
export function redactSensitiveValues<T extends Record<string, unknown>>(
  input: T,
  depth = 0
): T {
  if (depth > 10) {
    return { redaction_status: 'blocked', redaction_reason: 'max_depth_exceeded' } as unknown as T;
  }
  if (!input || typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map((item) =>
      isRecord(item) ? redactSensitiveValues(item, depth + 1) : item
    ) as unknown as T;
  }

  const result: Record<string, unknown> = { ...input };

  for (const [key, value] of Object.entries(result)) {
    if (isSensitiveKey(key) && typeof value === 'string' && value.length > 0) {
      result[key] = '[REDACTED]';
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        isRecord(item) ? redactSensitiveValues(item, depth + 1) : item
      );
      continue;
    }

    if (isRecord(value)) {
      result[key] = redactSensitiveValues(value, depth + 1);
    }
  }

  return result as T;
}

/**
 * Redact sensitive values in a JSON string. Non-string inputs are returned as-is.
 * Useful for scrubbing log messages that contain serialized objects.
 */
export function redactSensitiveJsonString(input: string): string {
  if (!input || typeof input !== 'string') return input;
  // Check if the string contains any sensitive key patterns before attempting parse
  const hasSensitiveKey = SECRET_KEY_PATTERNS.some((p) => p.test(input));
  if (!hasSensitiveKey) return input;
  try {
    const parsed = JSON.parse(input);
    if (isRecord(parsed)) {
      return JSON.stringify(redactSensitiveValues(parsed));
    }
  } catch {
    // Not valid JSON - fall through to pattern-based redaction
  }
  // Pattern-based redaction for non-JSON strings. Handles JSON-style
  // ("key": "value") and bare key=value / key="value" / key='value' patterns.
  let redacted = input.replace(
    /"(password|secret|token|apiKey|serviceRole|accountPassword|account_password|encrypted_password)"\s*:\s*"[^"]*"/gi,
    '"$1":"[REDACTED]"'
  );
  redacted = redacted.replace(
    /\b(password|secret|token|apiKey|serviceRole|accountPassword|account_password|encrypted_password)\s*[:=]\s*"?[^"\s,;}]+"?/gi,
    '$1=[REDACTED]'
  );
  return redacted;
}

/**
 * Redact specific sensitive literal values from any string, object, or array.
 * Unlike redactSensitiveValues (which redacts by KEY name), this redacts by
 * VALUE — it replaces actual known sensitive strings (e.g. a decrypted
 * password) wherever they appear, regardless of the key name.
 *
 * This is the narrow literal redaction that catches a bare password in a
 * `text` field, an error message, or nested inside `output.bridge`.
 */
export function redactSensitiveText(
  input: unknown,
  sensitiveValues: string[]
): unknown {
  if (sensitiveValues.length === 0) return input;
  // Filter out empty/placeholder values
  const values = sensitiveValues.filter((v) => v.length > 0 && v !== '__DECRYPT_FAILED__');
  if (values.length === 0) return input;

  return redactSensitiveTextInternal(input, values, 0, new WeakSet<object>());
}

function redactSensitiveTextInternal(
  input: unknown,
  values: string[],
  depth: number,
  active: WeakSet<object>
): unknown {
  if (depth > 10) {
    return { redaction_status: 'blocked', redaction_reason: 'max_depth_exceeded' };
  }
  if (typeof input === 'string') {
    return redactStringLiterals(input, values);
  }
  if (Array.isArray(input)) {
    if (active.has(input)) return { redaction_status: 'blocked', redaction_reason: 'cycle_detected' };
    active.add(input);
    const result = input.map((item) => redactSensitiveTextInternal(item, values, depth + 1, active));
    active.delete(input);
    return result;
  }
  if (isRecord(input)) {
    if (active.has(input)) return { redaction_status: 'blocked', redaction_reason: 'cycle_detected' };
    active.add(input);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = redactSensitiveTextInternal(value, values, depth + 1, active);
    }
    active.delete(input);
    return result;
  }
  return input;
}

/** Replace all occurrences of each sensitive literal in a string with [REDACTED]. */
function redactStringLiterals(text: string, values: string[]): string {
  let result = text;
  for (const value of values) {
    // Escape regex special characters in the value
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), '[REDACTED]');
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
