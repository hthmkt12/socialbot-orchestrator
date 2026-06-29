/**
 * Anti-detection helpers for social media automation.
 * Provides randomized delays, scroll variance, and action jitter
 * to simulate human-like behavior and avoid bot detection.
 */

/** Returns a random integer between min and max (inclusive). */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Returns a random float between min and max. */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Returns a random delay in milliseconds within the given range.
 * Default range: 3000-8000ms (human-like interaction pace).
 */
export function randomDelayMs(minMs = 3000, maxMs = 8000): number {
  return randomInt(minMs, maxMs);
}

/**
 * Returns a promise that resolves after a random delay.
 * Use between automated actions to simulate human pacing.
 */
export function sleepRandom(minMs = 3000, maxMs = 8000): Promise<void> {
  const delay = randomDelayMs(minMs, maxMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Generates random scroll parameters for pre-action scrolling.
 * Returns delta values that simulate natural scroll behavior.
 */
export function randomScrollParams() {
  return {
    deltaY: randomInt(100, 600),
    duration: randomInt(300, 1200),
    steps: randomInt(3, 8),
  };
}

/**
 * Adds coordinate jitter to a tap target.
 * Humans don't tap the exact same pixel every time.
 */
export function jitterCoordinate(x: number, y: number, radiusPx = 5) {
  const angle = randomFloat(0, 2 * Math.PI);
  const distance = randomFloat(0, radiusPx);
  return {
    x: Math.round(x + distance * Math.cos(angle)),
    y: Math.round(y + distance * Math.sin(angle)),
  };
}

import type { AntiDetectionConfig } from '../contracts/macro';
export type { AntiDetectionConfig };

export const DEFAULT_ANTI_DETECTION: AntiDetectionConfig = {
  randomDelayMs: [3000, 8000],
  scrollVariance: true,
  tapJitterPx: 5,
  cooldownBetweenActionsMs: [2000, 5000],
};

/**
 * Applies anti-detection config to step params.
 * Returns modified params with randomized delay and jittered coordinates.
 */
export function applyAntiDetection(
  params: { x?: number; y?: number; ms?: number; [key: string]: any },
  config: AntiDetectionConfig = DEFAULT_ANTI_DETECTION,
) {
  const result = { ...params };

  if (result.x !== undefined && result.y !== undefined) {
    const jittered = jitterCoordinate(result.x, result.y, config.tapJitterPx);
    result.x = jittered.x;
    result.y = jittered.y;
  }

  if (result.ms !== undefined) {
    const delayConf = config.randomDelayMs || [3000, 8000];
    const [min, max] = delayConf;
    result.ms = randomDelayMs(min, max);
  }

  return result;
}
