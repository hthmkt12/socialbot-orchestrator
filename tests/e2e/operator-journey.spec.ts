import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('Operator Journey UX Cleanup', () => {
  test.beforeEach(async ({ page }) => {
    // Mock pilot_readiness_reports to avoid Supabase requests failing
    await page.route('**/rest/v1/pilot_readiness_reports*', async (route) => {
      await route.fulfill({ json: [] });
    });
    // Log in as OPERATOR
    await loginAsTestUser(page, { role: 'OPERATOR' });
  });

  test('should navigate successfully to readiness, accounts, runs, and analytics pages and check elements', async ({ page }) => {
    // Navigate to /readiness
    await page.goto('/readiness');
    await expect(page).toHaveURL(/.*\/readiness/);
    await expect(page.locator('h2').filter({ hasText: 'Readiness' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Submit Report' })).toBeVisible();

    // Navigate to /accounts
    await page.goto('/accounts');
    await expect(page).toHaveURL(/.*\/accounts/);
    await expect(page.locator('h2').filter({ hasText: 'Social Accounts' })).toBeVisible();

    // Navigate to /runs
    await page.goto('/runs');
    await expect(page).toHaveURL(/.*\/runs/);
    await expect(page.locator('h2').filter({ hasText: 'Workflow Runs' })).toBeVisible();

    // Navigate to /analytics
    await page.goto('/analytics');
    await expect(page).toHaveURL(/.*\/analytics/);
    await expect(page.locator('h2').filter({ hasText: 'Analytics' })).toBeVisible();
  });
});
