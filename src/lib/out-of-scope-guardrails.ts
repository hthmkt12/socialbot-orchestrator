export const OUT_OF_SCOPE_ROUTE_SEGMENTS = [
  'marketplace',
  'billing',
  'payment',
  'checkout',
  'subscription',
  'collaboration',
  'social-graph',
  'social-network',
  'native-mobile',
  'offline',
] as const;

export function isOutOfScopeRoute(pathname: string) {
  const normalized = pathname.toLowerCase().replace(/^\/+/, '');
  return OUT_OF_SCOPE_ROUTE_SEGMENTS.some((segment) => (
    normalized === segment ||
    normalized.startsWith(`${segment}/`) ||
    normalized.includes(`/${segment}/`)
  ));
}

export const OUT_OF_SCOPE_GUARDRAIL_STATUS = [
  { id: 'OOS-001', status: 'covered', evidence: 'No marketplace route/table; route guard denies marketplace path segments.' },
  { id: 'OOS-002', status: 'covered', evidence: 'Billing/payment/checkout routes are denied; no pricing or billing page is routed.' },
  { id: 'OOS-003', status: 'covered', evidence: 'Public social graph/network routes are denied; social actions remain workflow/account operations.' },
  { id: 'OOS-004', status: 'covered', evidence: 'No collaboration route/table; route guard denies collaboration path segment.' },
  { id: 'OOS-005', status: 'covered', evidence: 'Docs/roadmap state social platform safety is not guaranteed.' },
  { id: 'OOS-006', status: 'covered', evidence: 'Account password storage remains encrypted pilot payload; no production credential vault route.' },
  { id: 'OOS-007', status: 'covered', evidence: 'No automatic account purchase/create marketplace route.' },
  { id: 'OOS-008', status: 'covered', evidence: 'Sensitive steps remain approval-gated.' },
  { id: 'OOS-009', status: 'covered', evidence: 'Mobile MCP V1 blocks run_autox before bridge execution.' },
  { id: 'OOS-010', status: 'covered', evidence: 'Docs mark device bridge live readiness as proof-gated; verification reports are required before live claims.' },
  { id: 'OOS-011', status: 'covered', evidence: 'Docs mark iOS readiness as Portal + iproxy proof-gated; bridge blocks iOS ADB-only steps.' },
  { id: 'OOS-012', status: 'covered', evidence: 'Worker artifact policy omits large inline DB payloads.' },
  { id: 'OOS-013', status: 'covered', evidence: 'No external customer sharing/export route.' },
  { id: 'OOS-014', status: 'covered', evidence: 'Sequential pilot path remains accepted; no fleet parallel SLA route or claim.' },
  { id: 'OOS-015', status: 'covered', evidence: 'Web app only; native-mobile route is denied.' },
  { id: 'OOS-016', status: 'covered', evidence: 'Supabase/runtime/device connectivity remains required; offline route is denied.' },
] as const;
