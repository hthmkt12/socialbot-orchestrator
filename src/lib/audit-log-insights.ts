import type { AuditLog } from './database.types';
import {
  flattenSearchTerms,
  getAuditActionLabel,
  getAuditDomain,
  getAuditDomainLabel,
  getAuditResourceLabel,
  isRecord,
} from './audit-log-insight-helpers';
import { buildAuditHighlights, buildAuditRelatedLinks } from './audit-log-insight-sections';
export type {
  AuditDomain,
  AuditHighlight,
  AuditLink,
  AuditLogInsight,
  AuditTone,
} from './audit-log-insight-types';
export { AUDIT_DOMAIN_ORDER } from './audit-log-insight-types';
import { buildAuditSummary } from './audit-log-summary';

export { getAuditDomainLabel } from './audit-log-insight-helpers';
import type { AuditLogInsight } from './audit-log-insight-types';

function buildMetadata(log: AuditLog) {
  return isRecord(log.metadata_json) ? log.metadata_json : {};
}

export function buildAuditLogInsight(log: AuditLog): AuditLogInsight {
  const metadata = buildMetadata(log);
  const domain = getAuditDomain(log.action, log.resource_type);
  const actionLabel = getAuditActionLabel(log.action);
  const resourceLabel = getAuditResourceLabel(log.resource_type);
  const summary = buildAuditSummary(log, metadata);
  const highlights = buildAuditHighlights(metadata);
  const relatedLinks = buildAuditRelatedLinks(log, metadata);
  const searchText = [
    log.action,
    actionLabel,
    domain,
    resourceLabel,
    log.resource_type,
    log.resource_id,
    summary,
    ...flattenSearchTerms(metadata),
  ]
    .join(' ')
    .toLowerCase();

  return {
    domain,
    domainLabel: getAuditDomainLabel(domain),
    actionLabel,
    resourceLabel,
    summary,
    highlights,
    relatedLinks,
    searchText,
  };
}
