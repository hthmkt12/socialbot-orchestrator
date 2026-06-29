import { describe, expect, it, vi } from 'vitest';
import {
  randomInt,
  randomFloat,
  randomDelayMs,
  randomScrollParams,
  jitterCoordinate,
  applyAntiDetection,
  DEFAULT_ANTI_DETECTION,
  sleepRandom,
} from './anti-detection-helpers';

describe('randomInt', () => {
  it('returns a value within the given range', () => {
    for (let i = 0; i < 100; i++) {
      const val = randomInt(3, 8);
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThanOrEqual(8);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('returns min when min equals max', () => {
    expect(randomInt(5, 5)).toBe(5);
  });

  it('handles negative ranges', () => {
    const val = randomInt(-10, -5);
    expect(val).toBeGreaterThanOrEqual(-10);
    expect(val).toBeLessThanOrEqual(-5);
  });
});

describe('randomFloat', () => {
  it('returns a float within the given range', () => {
    for (let i = 0; i < 100; i++) {
      const val = randomFloat(1.5, 3.5);
      expect(val).toBeGreaterThanOrEqual(1.5);
      expect(val).toBeLessThanOrEqual(3.5);
    }
  });

  it('returns non-integer values', () => {
    const vals = Array.from({ length: 50 }, () => randomFloat(1, 2));
    const hasDecimal = vals.some((v) => v !== Math.floor(v));
    expect(hasDecimal).toBe(true);
  });
});

describe('randomDelayMs', () => {
  it('returns a value in the default range', () => {
    for (let i = 0; i < 100; i++) {
      const val = randomDelayMs();
      expect(val).toBeGreaterThanOrEqual(3000);
      expect(val).toBeLessThanOrEqual(8000);
    }
  });

  it('respects custom range', () => {
    const val = randomDelayMs(100, 500);
    expect(val).toBeGreaterThanOrEqual(100);
    expect(val).toBeLessThanOrEqual(500);
  });
});

describe('sleepRandom', () => {
  it('executes and resolves after the random delay', async () => {
    vi.useFakeTimers();
    let resolved = false;
    const promise = sleepRandom(1000, 2000).then(() => {
      resolved = true;
    });

    // Advance by 500ms, should not be resolved yet
    await vi.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(false);

    // Advance by another 1500ms (total 2000ms), should resolve
    await vi.advanceTimersByTimeAsync(1500);
    expect(resolved).toBe(true);

    await promise;
    vi.useRealTimers();
  });
});

describe('randomScrollParams', () => {
  it('returns deltaY, duration, and steps within expected ranges', () => {
    for (let i = 0; i < 50; i++) {
      const params = randomScrollParams();
      expect(params.deltaY).toBeGreaterThanOrEqual(100);
      expect(params.deltaY).toBeLessThanOrEqual(600);
      expect(params.duration).toBeGreaterThanOrEqual(300);
      expect(params.duration).toBeLessThanOrEqual(1200);
      expect(params.steps).toBeGreaterThanOrEqual(3);
      expect(params.steps).toBeLessThanOrEqual(8);
    }
  });
});

describe('jitterCoordinate', () => {
  it('returns a point approximately within the jitter radius (rounding may add ~1px)', () => {
    for (let i = 0; i < 100; i++) {
      const { x, y } = jitterCoordinate(100, 200, 10);
      const dist = Math.sqrt((x - 100) ** 2 + (y - 200) ** 2);
      // Math.round can push the point up to ~1px beyond the radius
      expect(dist).toBeLessThanOrEqual(12);
    }
  });

  it('returns integer coordinates', () => {
    const { x, y } = jitterCoordinate(100, 200);
    expect(Number.isInteger(x)).toBe(true);
    expect(Number.isInteger(y)).toBe(true);
  });

  it('defaults to 5px radius with tolerance for rounding', () => {
    for (let i = 0; i < 50; i++) {
      const { x, y } = jitterCoordinate(100, 200);
      const dist = Math.sqrt((x - 100) ** 2 + (y - 200) ** 2);
      expect(dist).toBeLessThanOrEqual(7);
    }
  });

  it('can produce varied coordinates', () => {
    const results = Array.from({ length: 50 }, () => jitterCoordinate(100, 200, 5));
    const uniquePairs = new Set(results.map((r) => `${r.x},${r.y}`));
    expect(uniquePairs.size).toBeGreaterThan(1);
  });

  it('stays near the origin when radius is 0', () => {
    const { x, y } = jitterCoordinate(100, 200, 0);
    expect(x).toBe(100);
    expect(y).toBe(200);
  });
});

describe('DEFAULT_ANTI_DETECTION', () => {
  it('has the expected shape', () => {
    expect(DEFAULT_ANTI_DETECTION).toEqual({
      randomDelayMs: [3000, 8000],
      scrollVariance: true,
      tapJitterPx: 5,
      cooldownBetweenActionsMs: [2000, 5000],
    });
  });
});

describe('applyAntiDetection', () => {
  it('jitters coordinates when x and y are present', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const result = applyAntiDetection({ x: 100, y: 200 }, DEFAULT_ANTI_DETECTION);
    expect(result.x).not.toBe(100);
    expect(result.y).not.toBe(200);
    vi.restoreAllMocks();
  });

  it('randomizes delay when ms is present', () => {
    const result = applyAntiDetection({ ms: 5000 }, DEFAULT_ANTI_DETECTION);
    expect(result.ms).toBeGreaterThanOrEqual(3000);
    expect(result.ms).toBeLessThanOrEqual(8000);
  });

  it('passes through params without x/y/ms unchanged except randomization', () => {
    const result = applyAntiDetection({ text: 'hello' }, DEFAULT_ANTI_DETECTION);
    expect(result.text).toBe('hello');
  });

  it('uses default config when none provided', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const result = applyAntiDetection({ x: 50, y: 75 });
    expect(result.x).not.toBe(50);
    expect(result.y).not.toBe(75);
    vi.restoreAllMocks();
  });

  it('handles partial params correctly (x without y: no jitter, x passed through)', () => {
    // jitterCoordinate requires both x and y; with only x, no jitter applied
    const result = applyAntiDetection({ x: 100 });
    expect(result.x).toBe(100);
    expect(result.y).toBeUndefined();
  });
});
