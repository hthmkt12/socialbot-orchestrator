import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('Operator Warm-Up Dashboard Journey', () => {
  test.beforeEach(async ({ page }) => {
    // 5 days ago for warm-up start -> eligible for Stage 3 advancement
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const mockAccounts = [
      {
        id: 'acc-warm-1',
        user_id: 'test-user-id',
        username: 'insta_warm_pilot',
        encrypted_password: 'v2:test-enc-pw',
        platform: 'instagram',
        warm_up_stage: 2,
        warm_up_started_at: fiveDaysAgo,
        daily_action_limit: 5,
        current_action_count: 5,
        is_blocked: false,
        created_at: fiveDaysAgo,
        updated_at: fiveDaysAgo,
      },
      {
        id: 'acc-warm-2',
        user_id: 'test-user-id',
        username: 'tiktok_pilot_full',
        encrypted_password: 'v2:test-enc-pw',
        platform: 'tiktok',
        warm_up_stage: 5,
        warm_up_started_at: thirtyDaysAgo,
        daily_action_limit: 120,
        current_action_count: 45,
        is_blocked: false,
        created_at: thirtyDaysAgo,
        updated_at: thirtyDaysAgo,
      },
    ];

    await loginAsTestUser(page, { role: 'OPERATOR' });

    // Mock accounts query (registered AFTER loginAsTestUser so it takes precedence)
    await page.route('**/rest/v1/accounts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: mockAccounts });
      } else if (route.request().method() === 'PATCH') {
        const patchData = route.request().postDataJSON();
        await route.fulfill({
          json: { ...mockAccounts[0], ...patchData },
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/rest/v1/pilot_readiness_reports*', async (route) => {
      await route.fulfill({ json: [] });
    });
  });

  test('displays warm-up progression panel, stat cards, and budget breakdown', async ({ page }) => {
    await page.goto('/social-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/.*\/social-dashboard/);

    // Verify main dashboard heading
    await expect(page.locator('h1, h2').filter({ hasText: /Social Dashboard/i })).toBeVisible();

    // Verify stat cards
    await expect(page.getByText('In Warm-Up').first()).toBeVisible();
    await expect(page.getByText('Full Speed').first()).toBeVisible();

    // Verify WarmUpAdvancementPanel shows ready account
    await expect(page.getByText('Ready to Advance')).toBeVisible();
    await expect(page.getByText('insta_warm_pilot').first()).toBeVisible();
    await expect(page.getByText('Stage 3').first()).toBeVisible(); // Target stage label

    // Verify AccountHealthCard renders budget badges
    await expect(page.getByText('Likes').first()).toBeVisible();
  });

  test('advancing account triggers mutation and success toast', async ({ page }) => {
    await page.goto('/social-dashboard', { waitUntil: 'domcontentloaded' });

    // Look for the "Advance All" or advance button
    const advanceButton = page.getByRole('button', { name: /Advance/i }).first();
    await expect(advanceButton).toBeVisible();
    await advanceButton.click();

    // Toast notification should announce success
    await expect(page.getByText(/Advanced 1 account/i)).toBeVisible();
  });
});
