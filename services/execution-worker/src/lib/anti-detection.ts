export interface AntiDetectionConfig {
  minDelayMs?: number;
  maxDelayMs?: number;
  coordinateVariancePixels?: number;
}

export const DEFAULT_ANTI_DETECTION_CONFIG: AntiDetectionConfig = {
  minDelayMs: 3000,
  maxDelayMs: 8000,
  coordinateVariancePixels: 5,
};

/**
 * Returns a random delay between min and max bounds.
 */
export function getRandomDelay(
  minMs = DEFAULT_ANTI_DETECTION_CONFIG.minDelayMs!,
  maxMs = DEFAULT_ANTI_DETECTION_CONFIG.maxDelayMs!
): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
}

/**
 * Applies a random variance to a coordinate (0-1 relative scale).
 * Assumes a typical screen resolution (e.g., 1080x2400) to calculate a relative variance.
 */
export function applyCoordinateVariance(
  value: number,
  variancePixels = DEFAULT_ANTI_DETECTION_CONFIG.coordinateVariancePixels!,
  assumedScreenSize = 1080 // Default to width for conservative variance
): number {
  const varianceRelative = variancePixels / assumedScreenSize;
  const offset = (Math.random() * 2 - 1) * varianceRelative; // +/- varianceRelative
  let newValue = value + offset;

  // Bound to 0-1
  if (newValue < 0) newValue = 0;
  if (newValue > 1) newValue = 1;

  return Number(newValue.toFixed(4));
}

/**
 * Promise-based sleep utility.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
