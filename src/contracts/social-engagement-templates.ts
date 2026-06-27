/**
 * Pre-built social macro templates for Instagram and TikTok engagement.
 * These use the standard MacroDefinition format with anti-detection
 * config embedded in step params.
 */
import type { MacroDefinition } from './macro';
import type { AntiDetectionConfig } from '../lib/anti-detection-helpers';
import { DEFAULT_ANTI_DETECTION } from '../lib/anti-detection-helpers';

export interface SocialTemplate {
  definition: MacroDefinition;
  antiDetection: AntiDetectionConfig;
  platform: 'instagram' | 'tiktok' | 'facebook';
}

export const INSTAGRAM_LIKE_HASHTAG: SocialTemplate = {
  platform: 'instagram',
  antiDetection: DEFAULT_ANTI_DETECTION,
  definition: {
    version: 1,
    meta: {
      key: 'instagram_like_hashtag',
      name: 'Instagram Like Hashtag',
      description: 'Search a hashtag and like recent posts with human-like delays.',
      tags: ['instagram', 'engagement', 'like', 'hashtag'],
    },
    inputs: {
      hashtag: { type: 'string', required: true, description: 'Target hashtag (without #)' },
      likeCount: { type: 'number', required: true, default: 5, description: 'Posts to like' },
    },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 120_000, maxRetries: 1, onError: 'stop' },
    steps: [
      { id: 'launch', type: 'launch_app', params: { appName: 'com.instagram.android' } },
      { id: 'wait_load', type: 'wait', params: { ms: 4000 } },
      { id: 'tap_search', type: 'tap', params: { x: 0.5, y: 0.95 } },
      { id: 'wait_search', type: 'wait', params: { ms: 2000 } },
      { id: 'type_hashtag', type: 'input_text', params: { text: '#{{hashtag}}' } },
      { id: 'wait_results', type: 'wait', params: { ms: 3000 } },
      { id: 'tap_first_result', type: 'tap', params: { x: 0.5, y: 0.35 } },
      { id: 'wait_posts', type: 'wait', params: { ms: 2500 } },
      { id: 'tap_first_post', type: 'tap', params: { x: 0.33, y: 0.45 } },
      { id: 'wait_post_load', type: 'wait', params: { ms: 2000 } },
      { id: 'double_tap_like', type: 'tap', params: { x: 0.5, y: 0.4, actionBudgetType: 'like' } },
      { id: 'wait_after_like', type: 'wait', params: { ms: 3000 } },
      { id: 'screenshot_proof', type: 'screenshot', params: {} },
    ],
  },
};

export const INSTAGRAM_FOLLOW_ACCOUNTS: SocialTemplate = {
  platform: 'instagram',
  antiDetection: { ...DEFAULT_ANTI_DETECTION, randomDelayMs: [4000, 10000] },
  definition: {
    version: 1,
    meta: {
      key: 'instagram_follow_accounts',
      name: 'Instagram Follow From Profile',
      description: 'Visit a profile and follow. Includes warm-up-safe delays.',
      tags: ['instagram', 'engagement', 'follow'],
    },
    inputs: {
      profileUrl: { type: 'string', required: true, description: 'Profile URL or username to visit' },
    },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 60_000, maxRetries: 1, onError: 'stop' },
    steps: [
      { id: 'launch', type: 'launch_app', params: { appName: 'com.instagram.android' } },
      { id: 'wait_load', type: 'wait', params: { ms: 4000 } },
      { id: 'tap_search', type: 'tap', params: { x: 0.5, y: 0.95 } },
      { id: 'wait_search', type: 'wait', params: { ms: 2000 } },
      { id: 'type_username', type: 'input_text', params: { text: '{{profileUrl}}' } },
      { id: 'wait_results', type: 'wait', params: { ms: 3000 } },
      { id: 'tap_profile', type: 'tap', params: { x: 0.5, y: 0.25 } },
      { id: 'wait_profile', type: 'wait', params: { ms: 3000 } },
      { id: 'tap_follow', type: 'tap', params: { x: 0.5, y: 0.45, actionBudgetType: 'follow' } },
      { id: 'wait_after_follow', type: 'wait', params: { ms: 5000 } },
      { id: 'screenshot_proof', type: 'screenshot', params: {} },
    ],
  },
};

export const TIKTOK_LIKE_TRENDING: SocialTemplate = {
  platform: 'tiktok',
  antiDetection: DEFAULT_ANTI_DETECTION,
  definition: {
    version: 1,
    meta: {
      key: 'tiktok_like_trending',
      name: 'TikTok Like Trending',
      description: 'Scroll the For You Page and like trending videos with natural delays.',
      tags: ['tiktok', 'engagement', 'like', 'trending'],
    },
    inputs: {
      likeCount: { type: 'number', required: true, default: 5, description: 'Videos to like' },
    },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 120_000, maxRetries: 1, onError: 'stop' },
    steps: [
      { id: 'launch', type: 'launch_app', params: { appName: 'com.zhiliaoapp.musically' } },
      { id: 'wait_load', type: 'wait', params: { ms: 5000 } },
      { id: 'scroll_down', type: 'swipe', params: { fromX: 0.5, fromY: 0.7, toX: 0.5, toY: 0.3 } },
      { id: 'wait_video', type: 'wait', params: { ms: 4000 } },
      { id: 'tap_like', type: 'tap', params: { x: 0.93, y: 0.45, actionBudgetType: 'like' } },
      { id: 'wait_after_like', type: 'wait', params: { ms: 3000 } },
      { id: 'screenshot_proof', type: 'screenshot', params: {} },
    ],
  },
};

/** All available social templates, indexed by key. */
export const SOCIAL_TEMPLATES: Record<string, SocialTemplate> = {
  instagram_like_hashtag: INSTAGRAM_LIKE_HASHTAG,
  instagram_follow_accounts: INSTAGRAM_FOLLOW_ACCOUNTS,
  tiktok_like_trending: TIKTOK_LIKE_TRENDING,
};
