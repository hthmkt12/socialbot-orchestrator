function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildClaimSummary(
  summaryJson: Record<string, unknown> | null,
  instanceId: string,
  claimToken: string,
  claimedAt: string,
  heartbeatAt: string,
  leaseExpiresAt: string,
  observedStatus: string,
  isReclaim: boolean
) {
  const summary = isRecord(summaryJson) ? summaryJson : {};
  const control = isRecord(summary.control) ? summary.control : {};
  const claim = isRecord(control.claim) ? control.claim : {};
  const priorReclaims = Number(claim.reclaimCount ?? 0);

  return {
    ...summary,
    control: {
      ...control,
      claim: {
        ...claim,
        executionOwner: instanceId,
        claimToken,
        claimedAt,
        leaseExpiresAt,
        lastHeartbeatAt: heartbeatAt,
        lastObservedStatus: observedStatus,
        reclaimCount: isReclaim ? priorReclaims + 1 : priorReclaims,
      },
    },
  };
}
