INSERT INTO macros (key, name, description, author_id, definition)
VALUES (
  'instagram_warmup_bot',
  'Instagram Warmup Bot',
  'Automatically scrolls Instagram feed and likes posts to build trust score.',
  (SELECT id FROM users LIMIT 1),
  '{
    "version": 1,
    "meta": {
      "key": "instagram_warmup_bot",
      "name": "Instagram Warmup Bot",
      "tags": ["instagram", "warmup", "bot"]
    },
    "inputs": {
      "loopCount": { "type": "number", "required": true, "default": 5, "description": "How many posts to view/like" }
    },
    "antiDetection": {
      "randomDelayMs": [3000, 8000],
      "scrollVariance": true,
      "tapJitterPx": 10,
      "cooldownBetweenActionsMs": [1000, 4000],
      "deviceFingerprint": true
    },
    "target": { "mode": "single_device" },
    "execution": { "defaultTimeoutMs": 15000, "maxRetries": 1, "onError": "stop" },
    "steps": [
      { "id": "launch_ig", "type": "launch_app", "params": { "appId": "com.instagram.android" }, "targetApp": "instagram" },
      { "id": "wait_feed", "type": "wait", "params": { "ms": 5000 } },
      {
        "id": "feed_loop",
        "type": "loop",
        "params": { "count": "{{loopCount}}" },
        "steps": [
          { "id": "scroll_feed", "type": "swipe", "params": { "direction": "up", "durationMs": 1000 } },
          { "id": "wait_read", "type": "wait", "params": { "ms": "random(2000, 5000)" } },
          { "id": "like_post", "type": "tap", "params": { "x": 0.5, "y": 0.5 }, "policy": { "timeoutMs": 5000 } }
        ]
      }
    ]
  }'
), (
  'tiktok_view_bot',
  'TikTok View Bot',
  'Scrolls TikTok FYP and watches videos to build account retention metrics.',
  (SELECT id FROM users LIMIT 1),
  '{
    "version": 1,
    "meta": {
      "key": "tiktok_view_bot",
      "name": "TikTok View Bot",
      "tags": ["tiktok", "warmup", "bot"]
    },
    "inputs": {
      "loopCount": { "type": "number", "required": true, "default": 10, "description": "How many videos to watch" }
    },
    "antiDetection": {
      "randomDelayMs": [5000, 15000],
      "scrollVariance": true,
      "tapJitterPx": 5,
      "cooldownBetweenActionsMs": [2000, 6000],
      "deviceFingerprint": true
    },
    "target": { "mode": "single_device" },
    "execution": { "defaultTimeoutMs": 15000, "maxRetries": 1, "onError": "stop" },
    "steps": [
      { "id": "launch_tt", "type": "launch_app", "params": { "appId": "com.ss.android.ugc.trill" }, "targetApp": "tiktok" },
      { "id": "wait_fyp", "type": "wait", "params": { "ms": 5000 } },
      {
        "id": "fyp_loop",
        "type": "loop",
        "params": { "count": "{{loopCount}}" },
        "steps": [
          { "id": "watch_video", "type": "wait", "params": { "ms": "random(10000, 30000)" } },
          { "id": "scroll_next", "type": "swipe", "params": { "direction": "up", "durationMs": 500 } }
        ]
      }
    ]
  }'
);
