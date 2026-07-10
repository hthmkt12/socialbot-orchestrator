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

export const INSTAGRAM_PILOT_OPEN_CAPTURE: SocialTemplate = {
  platform: 'instagram',
  antiDetection: DEFAULT_ANTI_DETECTION,
  definition: {
    version: 1,
    meta: {
      key: 'instagram_pilot_open_capture',
      name: 'Instagram Pilot Open Capture',
      description: 'Open Instagram, verify the foreground app, capture screenshot evidence, and record a pilot-safe action event.',
      tags: ['instagram', 'pilot', 'evidence', 'mobile-mcp'],
    },
    inputs: {},
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 30_000, maxRetries: 1, onError: 'stop' },
    steps: [
      { id: 'launch_instagram', type: 'launch_app', params: { appName: 'com.instagram.android' } },
      { id: 'wait_loaded', type: 'wait', params: { ms: 4000 } },
      { id: 'current_app', type: 'get_current_app', params: {} },
      {
        id: 'capture_pilot_evidence',
        type: 'screenshot',
        params: {
          saveToArtifact: true,
          actionHistoryType: 'instagram_pilot_open',
        },
      },
    ],
  },
};

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

export const INSTAGRAM_WARMUP: SocialTemplate = {
  platform: 'instagram',
  antiDetection: DEFAULT_ANTI_DETECTION,
  definition: {
    version: 1,
    meta: {
      key: 'instagram_warmup',
      name: 'Instagram Account Warmup',
      description: 'Scroll the home feed, like random posts, and pause to simulate natural human warmup pacing.',
      tags: ['instagram', 'engagement', 'warmup'],
    },
    inputs: {
      scrollCount: { type: 'number', required: true, default: 5, description: 'Number of times to scroll the feed' },
    },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 120_000, maxRetries: 1, onError: 'continue' },
    steps: [
      { id: 'launch', type: 'launch_app', params: { appName: 'com.instagram.android' } },
      { id: 'wait_load', type: 'wait', params: { ms: 4000 } },
      {
        id: 'warmup_loop',
        type: 'loop',
        params: { count: '{{scrollCount}}' },
        steps: [
          { id: 'scroll_down', type: 'swipe', params: { fromX: 0.5, fromY: 0.8, toX: 0.5, toY: 0.25 } },
          { id: 'wait_after_scroll', type: 'wait', params: { ms: 3000 } },
          {
            id: 'conditional_like',
            type: 'conditional',
            params: { left: '1', operator: 'equals', right: '1' },
            then: [
              { id: 'like_post', type: 'tap', params: { x: 0.5, y: 0.4, actionBudgetType: 'like' } },
              { id: 'wait_after_like', type: 'wait', params: { ms: 2500 } }
            ],
            else: []
          }
        ]
      },
      { id: 'screenshot_proof', type: 'screenshot', params: {} }
    ]
  }
};

export const INSTAGRAM_HASHTAG_ENGAGE: SocialTemplate = {
  platform: 'instagram',
  antiDetection: DEFAULT_ANTI_DETECTION,
  definition: {
    version: 1,
    meta: {
      key: 'instagram_hashtag_engage',
      name: 'Instagram Hashtag Engage',
      description: 'Search a hashtag, like top posts, and optionally comment on them with conditional logic.',
      tags: ['instagram', 'engagement', 'hashtag', 'comment'],
    },
    inputs: {
      hashtag: { type: 'string', required: true, description: 'Hashtag to search (without #)' },
      postCount: { type: 'number', required: true, default: 3, description: 'Number of posts to engage' },
      commentText: { type: 'string', required: false, default: '', description: 'Optional text to comment (leave empty to skip commenting)' }
    },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 180_000, maxRetries: 1, onError: 'stop' },
    steps: [
      { id: 'launch', type: 'launch_app', params: { appName: 'com.instagram.android' } },
      { id: 'wait_load', type: 'wait', params: { ms: 4000 } },
      { id: 'tap_search_tab', type: 'tap', params: { x: 0.5, y: 0.95 } },
      { id: 'wait_search_tab', type: 'wait', params: { ms: 2000 } },
      { id: 'type_hashtag', type: 'input_text', params: { text: '#{{hashtag}}' } },
      { id: 'wait_results', type: 'wait', params: { ms: 3000 } },
      { id: 'tap_first_result', type: 'tap', params: { x: 0.5, y: 0.35 } },
      { id: 'wait_posts', type: 'wait', params: { ms: 2500 } },
      { id: 'tap_first_post', type: 'tap', params: { x: 0.33, y: 0.45 } },
      { id: 'wait_post_load', type: 'wait', params: { ms: 2000 } },
      {
        id: 'engage_loop',
        type: 'loop',
        params: { count: '{{postCount}}' },
        steps: [
          { id: 'double_tap_like', type: 'tap', params: { x: 0.5, y: 0.4, actionBudgetType: 'like' } },
          { id: 'wait_after_like', type: 'wait', params: { ms: 2000 } },
          {
            id: 'conditional_comment',
            type: 'conditional',
            params: { left: '{{commentText}}', operator: 'not_equals', right: '' },
            then: [
              { id: 'tap_comment_btn', type: 'tap', params: { x: 0.22, y: 0.5 } },
              { id: 'wait_comment_input', type: 'wait', params: { ms: 2000 } },
              { id: 'type_comment', type: 'input_text', params: { text: '{{commentText}}' } },
              { id: 'wait_type', type: 'wait', params: { ms: 1500 } },
              { id: 'tap_post_comment', type: 'tap', params: { x: 0.9, y: 0.5, actionBudgetType: 'comment' } },
              { id: 'wait_post_load', type: 'wait', params: { ms: 3000 } },
              { id: 'go_back', type: 'tap', params: { x: 0.05, y: 0.08 } },
              { id: 'wait_back', type: 'wait', params: { ms: 1500 } }
            ],
            else: []
          },
          { id: 'scroll_next_post', type: 'swipe', params: { fromX: 0.5, fromY: 0.7, toX: 0.5, toY: 0.2 } },
          { id: 'wait_next_load', type: 'wait', params: { ms: 2500 } }
        ]
      },
      { id: 'screenshot_proof', type: 'screenshot', params: {} }
    ]
  }
};

export const TIKTOK_VIEW_BOT: SocialTemplate = {
  platform: 'tiktok',
  antiDetection: DEFAULT_ANTI_DETECTION,
  definition: {
    version: 1,
    meta: {
      key: 'tiktok_view_bot',
      name: 'TikTok View Bot',
      description: 'Scroll the For You Page, watch videos for simulated view time, and randomly like videos to mimic natural user behaviour.',
      tags: ['tiktok', 'engagement', 'view', 'like'],
    },
    inputs: {
      viewCount: { type: 'number', required: true, default: 5, description: 'Number of videos to view' },
      watchTimeMs: { type: 'number', required: true, default: 6000, description: 'Simulated watch time per video in milliseconds' }
    },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 180_000, maxRetries: 1, onError: 'continue' },
    steps: [
      { id: 'launch', type: 'launch_app', params: { appName: 'com.zhiliaoapp.musically' } },
      { id: 'wait_load', type: 'wait', params: { ms: 5000 } },
      {
        id: 'view_loop',
        type: 'loop',
        params: { count: '{{viewCount}}' },
        steps: [
          { id: 'scroll_video', type: 'swipe', params: { fromX: 0.5, fromY: 0.8, toX: 0.5, toY: 0.2 } },
          { id: 'watch_video', type: 'wait', params: { ms: '{{watchTimeMs}}' } },
          {
            id: 'conditional_like',
            type: 'conditional',
            params: { left: '1', operator: 'equals', right: '1' },
            then: [
              { id: 'tap_like', type: 'tap', params: { x: 0.93, y: 0.45, actionBudgetType: 'like' } },
              { id: 'wait_after_like', type: 'wait', params: { ms: 2000 } }
            ],
            else: []
          }
        ]
      },
      { id: 'screenshot_proof', type: 'screenshot', params: {} }
    ]
  }
};


export const INSTAGRAM_MASS_LIKE_HASHTAGS: SocialTemplate = {
  platform: 'instagram',
  antiDetection: DEFAULT_ANTI_DETECTION,
  definition: {
    version: 1,
    meta: {
      key: 'instagram_mass_like_hashtags',
      name: 'Instagram Mass Like Hashtags (Foreach)',
      description: 'Search an array of hashtags and like top posts for each using foreach loop.',
      tags: ['instagram', 'engagement', 'like', 'hashtag', 'mass'],
    },
    inputs: {
      hashtags: { type: 'string', required: true, description: 'Comma-separated hashtags (e.g. fashion,style)' },
      likesPerHashtag: { type: 'number', required: true, default: 3, description: 'Posts to like per hashtag' },
    },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 180_000, maxRetries: 1, onError: 'stop' },
    steps: [
      { id: 'launch', type: 'launch_app', params: { appName: 'com.instagram.android' } },
      { id: 'wait_load', type: 'wait', params: { ms: 4000 } },
      {
        id: 'foreach_hashtag',
        type: 'foreach',
        params: { arraySourceVar: 'hashtags', itemName: 'currentHashtag' },
        steps: [
          { id: 'tap_search_tab', type: 'tap', params: { x: 0.5, y: 0.95 } },
          { id: 'wait_search_tab', type: 'wait', params: { ms: 2000 } },
          { id: 'type_hashtag', type: 'input_text', params: { text: '#{{currentHashtag}}' } },
          { id: 'wait_results', type: 'wait', params: { ms: 3000 } },
          { id: 'tap_first_result', type: 'tap', params: { x: 0.5, y: 0.35 } },
          { id: 'wait_posts', type: 'wait', params: { ms: 2500 } },
          { id: 'tap_first_post', type: 'tap', params: { x: 0.33, y: 0.45 } },
          { id: 'wait_post_load', type: 'wait', params: { ms: 2000 } },
          {
            id: 'like_loop',
            type: 'loop',
            params: { count: '{{likesPerHashtag}}' },
            steps: [
              { id: 'double_tap_like', type: 'tap', params: { x: 0.5, y: 0.4, actionBudgetType: 'like' } },
              { id: 'wait_after_like', type: 'wait', params: { ms: 2000 } },
              { id: 'scroll_next_post', type: 'swipe', params: { fromX: 0.5, fromY: 0.7, toX: 0.5, toY: 0.2 } },
              { id: 'wait_next_load', type: 'wait', params: { ms: 2500 } }
            ]
          }
        ]
      }
    ],
  },
};

export const INSTAGRAM_MASS_FOLLOW: SocialTemplate = {
  platform: 'instagram',
  antiDetection: { ...DEFAULT_ANTI_DETECTION, randomDelayMs: [5000, 12000] },
  definition: {
    version: 1,
    meta: {
      key: 'instagram_mass_follow',
      name: 'Instagram Mass Follow Accounts (Foreach)',
      description: 'Iterate over an array of usernames and follow each one.',
      tags: ['instagram', 'engagement', 'follow', 'mass'],
    },
    inputs: {
      usernames: { type: 'string', required: true, description: 'Comma-separated usernames' },
    },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 180_000, maxRetries: 1, onError: 'stop' },
    steps: [
      { id: 'launch', type: 'launch_app', params: { appName: 'com.instagram.android' } },
      { id: 'wait_load', type: 'wait', params: { ms: 4000 } },
      {
        id: 'foreach_user',
        type: 'foreach',
        params: { arraySourceVar: 'usernames', itemName: 'currentUser' },
        steps: [
          { id: 'tap_search', type: 'tap', params: { x: 0.5, y: 0.95 } },
          { id: 'wait_search', type: 'wait', params: { ms: 2000 } },
          { id: 'type_username', type: 'input_text', params: { text: '{{currentUser}}' } },
          { id: 'wait_results', type: 'wait', params: { ms: 3000 } },
          { id: 'tap_profile', type: 'tap', params: { x: 0.5, y: 0.25 } },
          { id: 'wait_profile', type: 'wait', params: { ms: 3000 } },
          { id: 'tap_follow', type: 'tap', params: { x: 0.5, y: 0.45, actionBudgetType: 'follow' } },
          { id: 'wait_after_follow', type: 'wait', params: { ms: 5000 } }
        ]
      }
    ],
  },
};

/** All available social templates, indexed by key. */
export const SOCIAL_TEMPLATES: Record<string, SocialTemplate> = {
  instagram_pilot_open_capture: INSTAGRAM_PILOT_OPEN_CAPTURE,
  instagram_like_hashtag: INSTAGRAM_LIKE_HASHTAG,
  instagram_follow_accounts: INSTAGRAM_FOLLOW_ACCOUNTS,
  instagram_mass_like_hashtags: INSTAGRAM_MASS_LIKE_HASHTAGS,
  instagram_mass_follow: INSTAGRAM_MASS_FOLLOW,
  tiktok_like_trending: TIKTOK_LIKE_TRENDING,
  instagram_warmup: INSTAGRAM_WARMUP,
  instagram_hashtag_engage: INSTAGRAM_HASHTAG_ENGAGE,
  tiktok_view_bot: TIKTOK_VIEW_BOT,
};
