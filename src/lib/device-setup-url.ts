export function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

export function normalizeBaseUrl(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimTrailingSlash(trimmed || fallback);
}

export function toGatewayWsUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl, 'http://127.0.0.1:8080');
  if (normalized.startsWith('ws://') || normalized.startsWith('wss://')) return normalized;
  if (normalized.startsWith('https://')) return normalized.replace(/^https:\/\//, 'wss://');
  if (normalized.startsWith('http://')) return normalized.replace(/^http:\/\//, 'ws://');
  return `ws://${normalized.replace(/^\/+/, '')}`;
}
