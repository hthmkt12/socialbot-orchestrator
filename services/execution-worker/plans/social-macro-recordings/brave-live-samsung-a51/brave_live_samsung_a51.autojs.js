"auto";
const config = {
  "appPackage": "com.brave.browser",
  "inputs": {
    "caption": "{{caption}}"
  },
  "allowPublish": false,
  "reviewBeforePublish": true
};
function valueOf(value) {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{([^}]+)\}\}/g, function(_, key) { return String(config.inputs[key] || ""); });
}
function findTarget(target, timeoutMs) {
  if (!target) return null;
  if (target.resourceId) return id(target.resourceId).findOne(timeoutMs);
  if (target.text) return text(target.text).findOne(timeoutMs);
  if (target.textContains) return textContains(target.textContains).findOne(timeoutMs);
  if (target.description) return desc(target.description).findOne(timeoutMs);
  return null;
}
function tapTarget(target) {
  const node = findTarget(target, 1500);
  if (node) { const b = node.bounds(); click(b.centerX(), b.centerY()); return; }
  if (target && target.fallback) { click(Math.round(device.width * target.fallback.x), Math.round(device.height * target.fallback.y)); return; }
  throw new Error("Target not found and no fallback coordinate");
}
function inputTarget(target, textValue) {
  if (target) tapTarget(target);
  sleep(300);
  setText(valueOf(textValue));
}
launchPackage(valueOf(config.appPackage));
sleep(2500);
tapTarget({"textContains":"Post","fallback":{"x":0.5,"y":0.92}});
sleep(1500);
inputTarget({"fallback":{"x":0.5,"y":0.35}}, "{{caption}}");
captureScreen("/sdcard/laixi-capture_draft.png");
if (config.reviewBeforePublish) {
  toast("Review draft before publish");
  sleep(3000);
}
if (!config.allowPublish) {
  toast("Publish blocked by default. Set config.allowPublish=true after review.");
  exit();
}
tapTarget({"text":"Post","fallback":{"x":0.88,"y":0.08}});
toast("Social macro completed: brave_live_samsung_a51");
