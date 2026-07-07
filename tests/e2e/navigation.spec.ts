import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('App Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should load the Social Dashboard by default', async ({ page }) => {
    // We expect a redirect to /social-dashboard since we updated the default dashboard
    await expect(page).toHaveURL(/.*\/social-dashboard/);
    await expect(page.locator('h1').filter({ hasText: 'SOCIALBOT OPS' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Social Dashboard' })).toBeVisible();
  });

  test('should navigate via sidebar links successfully', async ({ page }) => {
    // Go to Analytics
    await page.click('text=Analytics');
    await expect(page).toHaveURL(/.*\/analytics/);
    await expect(page.locator('h2').filter({ hasText: 'Analytics' })).toBeVisible();

    // Go to System Monitor
    await page.click('text=System Monitor');
    await expect(page).toHaveURL(/.*\/system-monitor/);
    await expect(page.locator('h2').filter({ hasText: 'System Monitor' })).toBeVisible();
  });

  test('should expose core operator routes in the sidebar', async ({ page }) => {
    for (const label of [
      'Runs',
      'Approvals',
      'Devices',
      'Device Setup',
      'Schedules',
      'Fleet Health',
    ]) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
  });
});
