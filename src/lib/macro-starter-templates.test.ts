import { describe, expect, it } from 'vitest';
import { getStarterMacroTemplates } from './macro-starter-templates';

describe('getStarterMacroTemplates', () => {
  it('returns an array of templates', () => {
    const templates = getStarterMacroTemplates();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
  });

  it('includes generic sample macros', () => {
    const templates = getStarterMacroTemplates();
    const generic = templates.filter((t) => !t.tags.includes('instagram') && !t.tags.includes('tiktok'));
    expect(generic.length).toBeGreaterThanOrEqual(5);
  });

  it('includes social engagement templates', () => {
    const templates = getStarterMacroTemplates();
    const social = templates.filter(
      (t) => t.tags.includes('instagram') || t.tags.includes('tiktok'),
    );
    expect(social.length).toBeGreaterThanOrEqual(4);
  });

  it('each template has all required fields', () => {
    const templates = getStarterMacroTemplates();
    for (const t of templates) {
      expect(t.key).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(Array.isArray(t.tags)).toBe(true);
      expect(['single_device', 'multi_device', 'device_group', 'all_devices']).toContain(t.targetMode);
      expect(t.stepCount).toBeGreaterThan(0);
      expect(['builder', 'json']).toContain(t.opensIn);
      expect(t.opensInLabel).toBeTruthy();
      expect(t.opensInReason).toBeTruthy();
      expect(t.definition).toBeTruthy();
    }
  });

  it('social templates open in Raw JSON', () => {
    const templates = getStarterMacroTemplates();
    const social = templates.filter((t) => t.tags.includes('instagram'));
    for (const t of social) {
      expect(t.opensIn).toBe('json');
      expect(t.opensInLabel).toBe('Raw JSON');
    }
  });

  it('has unique keys across all templates', () => {
    const templates = getStarterMacroTemplates();
    const keys = templates.map((t) => t.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('has reasonable step counts', () => {
    const templates = getStarterMacroTemplates();
    for (const t of templates) {
      expect(t.stepCount).toBeLessThanOrEqual(20);
    }
  });

  it('includes mass follow and mass like templates', () => {
    const templates = getStarterMacroTemplates();
    const keys = templates.map((t) => t.key);
    expect(keys).toContain('instagram_mass_like_hashtags');
    expect(keys).toContain('instagram_mass_follow');
    expect(keys).toContain('instagram_like_hashtag');
    expect(keys).toContain('instagram_follow_accounts');
    expect(keys).toContain('tiktok_like_trending');
  });
});
