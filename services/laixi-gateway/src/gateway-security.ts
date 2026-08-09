import { createHash, timingSafeEqual } from 'node:crypto';

interface GatewaySecurityOptions {
  httpToken?: string;
  enrollmentToken?: string;
  allowInsecureDev?: boolean;
  rateLimitPerMinute?: number;
}

interface RateWindow {
  startedAt: number;
  count: number;
}

function safeEqual(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export class GatewaySecurityPolicy {
  private readonly windows = new Map<string, RateWindow>();
  private readonly rateLimitPerMinute: number;

  constructor(private readonly options: GatewaySecurityOptions) {
    if (!options.allowInsecureDev && !options.httpToken) {
      throw new Error('Missing required env var: GATEWAY_HTTP_TOKEN');
    }
    if (!options.allowInsecureDev && !options.enrollmentToken) {
      throw new Error('Missing required env var: GATEWAY_DEVICE_ENROLLMENT_TOKEN');
    }
    const configuredLimit = options.rateLimitPerMinute ?? 120;
    this.rateLimitPerMinute = Number.isFinite(configuredLimit)
      ? Math.max(1, Math.floor(configuredLimit))
      : 120;
  }

  hasHttpAccess(authorization: string | undefined) {
    if (this.options.allowInsecureDev && !this.options.httpToken) return true;
    if (!authorization?.startsWith('Bearer ') || !this.options.httpToken) return false;
    return safeEqual(authorization.slice('Bearer '.length).trim(), this.options.httpToken);
  }

  hasEnrollmentAccess(token: string | undefined) {
    if (this.options.allowInsecureDev && !this.options.enrollmentToken) return true;
    if (!token || !this.options.enrollmentToken) return false;
    return safeEqual(token, this.options.enrollmentToken);
  }

  consume(clientKey: string, now = Date.now()) {
    const current = this.windows.get(clientKey);
    if (!current || now - current.startedAt >= 60_000) {
      this.windows.set(clientKey, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= this.rateLimitPerMinute) return false;
    current.count += 1;
    return true;
  }
}
