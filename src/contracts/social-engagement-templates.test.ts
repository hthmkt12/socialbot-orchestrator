import { describe, expect, it } from 'vitest';
import {
  SOCIAL_TEMPLATES,
  INSTAGRAM_PILOT_OPEN_CAPTURE,
  INSTAGRAM_LIKE_HASHTAG,
  INSTAGRAM_FOLLOW_ACCOUNTS,
  INSTAGRAM_MASS_LIKE_HASHTAGS,
  INSTAGRAM_MASS_FOLLOW,
  TIKTOK_LIKE_TRENDING,
} from './social-engagement-templates';

describe('SOCIAL_TEMPLATES', () => {
  it('exports all 6 templates', () => {
    const keys = Object.keys(SOCIAL_TEMPLATES);
    expect(keys).toHaveLength(6);
    expect(keys).toContain('instagram_pilot_open_capture');
    expect(keys).toContain('instagram_like_hashtag');
    expect(keys).toContain('instagram_follow_accounts');
    expect(keys).toContain('instagram_mass_like_hashtags');
    expect(keys).toContain('instagram_mass_follow');
    expect(keys).toContain('tiktok_like_trending');
  });

  it('each template has required fields', () => {
    for (const [key, template] of Object.entries(SOCIAL_TEMPLATES)) {
      expect(template.platform).toBeTruthy();
      expect(template.antiDetection).toBeTruthy();
      expect(template.definition).toBeTruthy();
      expect(template.definition.meta.key).toBe(key);
      expect(template.definition.steps.length).toBeGreaterThan(0);
      expect(template.definition.target.mode).toBe('single_device');
    }
  });
});

describe('INSTAGRAM_PILOT_OPEN_CAPTURE', () => {
  it('opens Instagram and captures evidence without engagement actions', () => {
    expect(INSTAGRAM_PILOT_OPEN_CAPTURE.platform).toBe('instagram');
    expect(INSTAGRAM_PILOT_OPEN_CAPTURE.definition.meta.key).toBe('instagram_pilot_open_capture');
    expect(INSTAGRAM_PILOT_OPEN_CAPTURE.definition.target.mode).toBe('single_device');
    expect(INSTAGRAM_PILOT_OPEN_CAPTURE.definition.steps.map((step) => step.type)).toEqual([
      'launch_app',
      'wait',
      'get_current_app',
      'screenshot',
    ]);
    expect(INSTAGRAM_PILOT_OPEN_CAPTURE.definition.steps.some((step) => step.params.actionBudgetType)).toBe(false);
    const lastStep = INSTAGRAM_PILOT_OPEN_CAPTURE.definition.steps[INSTAGRAM_PILOT_OPEN_CAPTURE.definition.steps.length - 1];
    expect(lastStep.params.actionHistoryType).toBe('instagram_pilot_open');
  });
});

describe('INSTAGRAM_LIKE_HASHTAG', () => {
  it('has correct structure', () => {
    expect(INSTAGRAM_LIKE_HASHTAG.platform).toBe('instagram');
    expect(INSTAGRAM_LIKE_HASHTAG.definition.meta.name).toBe('Instagram Like Hashtag');
    expect(INSTAGRAM_LIKE_HASHTAG.definition.inputs.hashtag.required).toBe(true);
    expect(INSTAGRAM_LIKE_HASHTAG.definition.inputs.likeCount.default).toBe(5);
    expect(INSTAGRAM_LIKE_HASHTAG.definition.steps).toHaveLength(13);
  });

  it('has anti-detection defaults', () => {
    expect(INSTAGRAM_LIKE_HASHTAG.antiDetection.randomDelayMs).toEqual([3000, 8000]);
    expect(INSTAGRAM_LIKE_HASHTAG.antiDetection.scrollVariance).toBe(true);
  });

  it('launches instagram app', () => {
    const launch = INSTAGRAM_LIKE_HASHTAG.definition.steps[0];
    expect(launch.type).toBe('launch_app');
    expect(launch.params.appName).toBe('com.instagram.android');
  });
});

describe('INSTAGRAM_FOLLOW_ACCOUNTS', () => {
  it('has slower anti-detection delays', () => {
    expect(INSTAGRAM_FOLLOW_ACCOUNTS.antiDetection.randomDelayMs).toEqual([4000, 10000]);
  });

  it('has action budget type on follow step', () => {
    const followStep = INSTAGRAM_FOLLOW_ACCOUNTS.definition.steps.find((s) => s.id === 'tap_follow');
    expect(followStep?.params.actionBudgetType).toBe('follow');
  });
});

describe('INSTAGRAM_MASS_LIKE_HASHTAGS', () => {
  it('uses foreach step type', () => {
    const foreachStep = INSTAGRAM_MASS_LIKE_HASHTAGS.definition.steps.find((s) => s.type === 'foreach');
    expect(foreachStep).toBeDefined();
    expect(foreachStep!.params.arraySourceVar).toBe('hashtags');
    expect(foreachStep!.params.itemName).toBe('currentHashtag');
  });

  it('has nested steps inside foreach', () => {
    const foreachStep = INSTAGRAM_MASS_LIKE_HASHTAGS.definition.steps.find((s) => s.type === 'foreach');
    expect(foreachStep!.steps).toBeDefined();
    expect(foreachStep!.steps!.length).toBeGreaterThan(0);
  });

  it('has like loop inside foreach', () => {
    const foreachStep = INSTAGRAM_MASS_LIKE_HASHTAGS.definition.steps.find((s) => s.type === 'foreach');
    const loopStep = foreachStep!.steps!.find((s) => s.type === 'loop');
    expect(loopStep).toBeDefined();
    expect(loopStep!.params.count).toBe('{{likesPerHashtag}}');
  });

  it('includes hashtag template variable', () => {
    const foreachStep = INSTAGRAM_MASS_LIKE_HASHTAGS.definition.steps.find((s) => s.type === 'foreach');
    const typeStep = foreachStep!.steps!.find((s) => s.type === 'input_text');
    expect(typeStep!.params.text).toContain('{{currentHashtag}}');
  });
});

describe('INSTAGRAM_MASS_FOLLOW', () => {
  it('uses foreach step type', () => {
    const foreachStep = INSTAGRAM_MASS_FOLLOW.definition.steps.find((s) => s.type === 'foreach');
    expect(foreachStep).toBeDefined();
    expect(foreachStep!.params.arraySourceVar).toBe('usernames');
    expect(foreachStep!.params.itemName).toBe('currentUser');
  });

  it('has slower anti-detection delays for follow actions', () => {
    expect(INSTAGRAM_MASS_FOLLOW.antiDetection.randomDelayMs).toEqual([5000, 12000]);
  });

  it('references currentUser variable in steps', () => {
    const foreachStep = INSTAGRAM_MASS_FOLLOW.definition.steps.find((s) => s.type === 'foreach');
    const inputStep = foreachStep!.steps!.find((s) => s.type === 'input_text');
    expect(inputStep!.params.text).toBe('{{currentUser}}');
  });
});

describe('TIKTOK_LIKE_TRENDING', () => {
  it('has correct platform', () => {
    expect(TIKTOK_LIKE_TRENDING.platform).toBe('tiktok');
  });

  it('launches tiktok app', () => {
    const launch = TIKTOK_LIKE_TRENDING.definition.steps[0];
    expect(launch.type).toBe('launch_app');
    expect(launch.params.appName).toBe('com.zhiliaoapp.musically');
  });

  it('includes a swipe scroll step', () => {
    const scrollStep = TIKTOK_LIKE_TRENDING.definition.steps.find((s) => s.type === 'swipe');
    expect(scrollStep).toBeDefined();
    expect(Number(scrollStep!.params.fromY)).toBeGreaterThan(Number(scrollStep!.params.toY));
  });

  it('has action budget type on like step', () => {
    const likeStep = TIKTOK_LIKE_TRENDING.definition.steps.find((s) => s.id === 'tap_like');
    expect(likeStep?.params.actionBudgetType).toBe('like');
  });
});
