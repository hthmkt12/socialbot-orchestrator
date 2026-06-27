import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('Documentation Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should render markdown content correctly', async ({ page }) => {
    await page.goto('/docs');
    
    // Verify header exists
    await expect(page.locator('h2').filter({ hasText: 'Documentation' })).toBeVisible();

    // The manifest should load the Getting Started Introduction by default
    // We'll wait for the content to render
    await expect(page.locator('.prose')).toBeVisible();
    await expect(page.locator('.prose h1').first()).toContainText('Welcome to the Social Automation Platform');
  });

  test('should navigate between doc sections', async ({ page }) => {
    await page.goto('/docs');

    // Wait for manifest to load
    await expect(page.locator('text=Connecting Devices')).toBeVisible();

    // Click the section
    await page.click('text=Connecting Devices');

    // Verify content updates
    await expect(page.locator('.prose h1').first()).toContainText('Connecting Devices');
    await expect(page.locator('.prose h2').filter({ hasText: 'Android (ADB)' })).toBeVisible();
  });
});
