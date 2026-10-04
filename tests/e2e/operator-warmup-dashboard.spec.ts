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
      {
        id: 'acc-blocked-3',
        user_id: 'test-user-id',
        username: 'insta_blocked_pilot',
        encrypted_password: 'v2:test-enc-pw',
        platform: 'instagram',
        warm_up_stage: 3,
        warm_up_started_at: fiveDaysAgo,
        daily_action_limit: 15,
        current_action_count: 5,
        is_blocked: true,
        detected_block_reason: 'Detected keyword: "action blocked"',
        created_at: fiveDaysAgo,
        updated_at: fiveDaysAgo,
      },
    ];

    await loginAsTestUser(page, { role: 'OPERATOR' });

    // Mock accounts query (registered AFTER loginAsTestUser so it takes precedence)
    await page.route('**/rest/v1/accounts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: mockAccounts });
      } else if (route.request().method() === 'PATCH') {
        const patchData = route.request().postDataJSON();
        const url = route.request().url();
        const match = url.match(/id=eq\.([^&]+)/);
        const targetId = match ? match[1] : mockAccounts[0].id;
        const targetAccount = mockAccounts.find((a) => a.id === targetId) ?? mockAccounts[0];
        await route.fulfill({
          json: { ...targetAccount, ...patchData },
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

  test('resolving and unblocking account triggers mutation and success toast', async ({ page }) => {
    await page.goto('/social-dashboard', { waitUntil: 'domcontentloaded' });

    // Verify blocked warning banner & card presence
    await expect(page.getByText(/1 account blocked/i)).toBeVisible();
    await expect(page.getByText('insta_blocked_pilot').first()).toBeVisible();
    await expect(page.getByText('Checkpoint / Restriction Detected')).toBeVisible();
    await expect(page.getByText(/Detected keyword: "action blocked"/i)).toBeVisible();

    // Click "Resolve & Unblock Account"
    const unblockButton = page.getByRole('button', { name: 'Resolve & Unblock Account', exact: true });
    await expect(unblockButton).toBeVisible();
    await unblockButton.click();

    // Verify success toast
    await expect(page.getByText(/Account unblocked successfully/i)).toBeVisible();
  });

  test('exporting accounts snapshot triggers csv download and success toast', async ({ page }) => {
    await page.goto('/social-dashboard', { waitUntil: 'domcontentloaded' });

    const exportBtn = page.getByRole('button', { name: /Export CSV Snapshot/i });
    await expect(exportBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^accounts-snapshot-.*\.csv$/);
    await expect(page.getByText(/Accounts exported successfully/i)).toBeVisible();
  });
});

