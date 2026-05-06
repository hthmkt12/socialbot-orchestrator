import { useMemo } from 'react';
import type { Artifact, RunStep } from '../../lib/database.types';
import {
  buildRunArtifactStepKey,
  normalizeRunArtifact,
  type RunArtifactPreview,
} from '../../lib/run-artifacts';
import {
  RunArtifactsStats,
  RunArtifactsStepEvidence,
  RunArtifactsUnlinked,
} from './run-artifacts-sections';

interface Props {
  artifacts: Artifact[];
  steps: RunStep[];
  focusStepId?: string | null;
}

export default function RunArtifactsPanel({ artifacts, steps, focusStepId = null }: Props) {
  const normalizedArtifacts = useMemo(
    () => [...artifacts].map(normalizeRunArtifact).sort((a, b) => a.artifact.created_at.localeCompare(b.artifact.created_at)),
    [artifacts]
  );

  const stepKeys = useMemo(
    () => new Set(steps.map((step) => buildRunArtifactStepKey(step.device_id, step.step_id)).filter(Boolean)),
    [steps]
  );

  const artifactsByStepKey = useMemo(() => {
    return normalizedArtifacts.reduce<Map<string, RunArtifactPreview[]>>((map, artifact) => {
      const key = buildRunArtifactStepKey(artifact.artifact.device_id, artifact.stepId);
      if (!key) return map;
      const current = map.get(key) ?? [];
      current.push(artifact);
      map.set(key, current);
      return map;
    }, new Map());
  }, [normalizedArtifacts]);

  const stepEvidence = useMemo(() => {
    return steps
      .map((step) => ({
        step,
        artifacts: artifactsByStepKey.get(buildRunArtifactStepKey(step.device_id, step.step_id) ?? '') ?? [],
      }))
      .filter((entry) => entry.artifacts.length > 0);
  }, [artifactsByStepKey, steps]);

  const unlinkedArtifacts = useMemo(() => {
    return normalizedArtifacts.filter((artifact) => {
      const key = buildRunArtifactStepKey(artifact.artifact.device_id, artifact.stepId);
      return !key || !stepKeys.has(key);
    });
  }, [normalizedArtifacts, stepKeys]);

  const stats = useMemo(() => {
    const screenshots = normalizedArtifacts.filter((artifact) => artifact.artifact.type === 'SCREENSHOT').length;
    const logs = normalizedArtifacts.filter((artifact) => artifact.artifact.type === 'LOG_BLOB').length;
    const json = normalizedArtifacts.filter((artifact) => artifact.artifact.type === 'JSON_RESULT').length;
    return {
      total: normalizedArtifacts.length,
      screenshots,
      logs,
      json,
      stepsWithEvidence: stepEvidence.length,
    };
  }, [normalizedArtifacts, stepEvidence.length]);

  if (normalizedArtifacts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <RunArtifactsStats focusStepId={focusStepId} stats={stats} />

      <div className="p-5 space-y-5">
        <RunArtifactsStepEvidence focusStepId={focusStepId} stepEvidence={stepEvidence} />
        <RunArtifactsUnlinked artifacts={unlinkedArtifacts} />
      </div>
    </div>
  );
}
