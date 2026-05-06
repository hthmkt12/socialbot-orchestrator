import type { SocialMacroDefinition, SocialMacroStep } from './social-macro-dsl';

export function exportSocialMacroToAutoJs(def: SocialMacroDefinition) {
  const lines = [
    `"auto";`,
    `const config = ${JSON.stringify({
      appPackage: def.app.packageName,
      inputs: Object.fromEntries(Object.keys(def.inputs).map((key) => [key, `{{${key}}}`])),
      allowPublish: def.safety.allowPublishByDefault,
      reviewBeforePublish: def.safety.reviewBeforePublish,
    }, null, 2)};`,
    `function valueOf(value) {`,
    `  if (typeof value !== "string") return value;`,
    `  return value.replace(/\\{\\{([^}]+)\\}\\}/g, function(_, key) { return String(config.inputs[key] || ""); });`,
    `}`,
    `function findTarget(target, timeoutMs) {`,
    `  if (!target) return null;`,
    `  if (target.resourceId) return id(target.resourceId).findOne(timeoutMs);`,
    `  if (target.text) return text(target.text).findOne(timeoutMs);`,
    `  if (target.textContains) return textContains(target.textContains).findOne(timeoutMs);`,
    `  if (target.description) return desc(target.description).findOne(timeoutMs);`,
    `  return null;`,
    `}`,
    `function tapTarget(target) {`,
    `  const node = findTarget(target, 1500);`,
    `  if (node) { const b = node.bounds(); click(b.centerX(), b.centerY()); return; }`,
    `  if (target && target.fallback) { click(Math.round(device.width * target.fallback.x), Math.round(device.height * target.fallback.y)); return; }`,
    `  throw new Error("Target not found and no fallback coordinate");`,
    `}`,
    `function inputTarget(target, textValue) {`,
    `  if (target) tapTarget(target);`,
    `  sleep(300);`,
    `  setText(valueOf(textValue));`,
    `}`,
  ];

  for (const step of def.steps) lines.push(...exportStep(step));
  lines.push(`toast("Social macro completed: ${escapeString(def.meta.key)}");`);
  return `${lines.join('\n')}\n`;
}

function exportStep(step: SocialMacroStep) {
  const target = JSON.stringify(step.target ?? null);
  if (step.action === 'launch_app') return [`launchPackage(valueOf(config.appPackage));`];
  if (step.action === 'wait') return [`sleep(${step.ms ?? 1_000});`];
  if (step.action === 'tap') return [`tapTarget(${target});`];
  if (step.action === 'input_text') return [`inputTarget(${target}, ${JSON.stringify(step.value ?? '')});`];
  if (step.action === 'screenshot') return [`captureScreen("/sdcard/laixi-${escapeString(step.id)}.png");`];
  if (step.action === 'review_gate') {
    return [
      `if (config.reviewBeforePublish) {`,
      `  toast(${JSON.stringify(step.reason ?? 'Review draft before publish')});`,
      `  sleep(3000);`,
      `}`,
    ];
  }
  if (step.action === 'publish') {
    return [
      `if (!config.allowPublish) {`,
      `  toast("Publish blocked by default. Set config.allowPublish=true after review.");`,
      `  exit();`,
      `}`,
      `tapTarget(${target});`,
    ];
  }
  if (step.action === 'verify_foreground_app') {
    return [`if (currentPackage() !== valueOf(${JSON.stringify(step.expectedPackage ?? '')})) throw new Error("Foreground app mismatch");`];
  }
  return [`swipe(${coord('x', step.from, 0.5)}, ${coord('y', step.from, 0.75)}, ${coord('x', step.to, 0.5)}, ${coord('y', step.to, 0.35)}, 500);`];
}

function coord(axis: 'x' | 'y', point: { x: number; y: number } | undefined, fallback: number) {
  const dimension = axis === 'x' ? 'device.width' : 'device.height';
  return `Math.round(${dimension} * ${point?.[axis] ?? fallback})`;
}

function escapeString(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}
