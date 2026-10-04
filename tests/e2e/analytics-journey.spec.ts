import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('Engagement Analytics Rollup Journey', () => {
  test.beforeEach(async ({ page }) => {
    const mockAccounts = [
      {
        id: 'acc-analytics-1',
        user_id: 'test-user-id',
        username: 'insta_active_metrics',
        encrypted_password: 'v2:test-enc-pw',
        platform: 'instagram',
        warm_up_stage: 3,
        warm_up_started_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        daily_action_limit: 15,
        current_action_count: 8,
        is_blocked: false,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockActionHistory = [
      {
        id: 'act-1',
        account_id: 'acc-analytics-1',
        action_type: 'like',
        step_id: 'step-1',
        source_run_id: 'run-1',
        source_step_id: 'step-1',
        success: true,
        error_message: null,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'act-2',
        account_id: 'acc-analytics-1',
        action_type: 'like',
        step_id: 'step-2',
        source_run_id: 'run-1',
        source_step_id: 'step-2',
        success: true,
        error_message: null,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'act-3',
        account_id: 'acc-analytics-1',
        action_type: 'follow',
        step_id: 'step-3',
        source_run_id: 'run-1',
        source_step_id: 'step-3',
        success: false,
        error_message: 'Device gesture timed out on profile button',
        created_at: new Date().toISOString(),
      },
    ];

    await loginAsTestUser(page, { role: 'OPERATOR' });

    // Mock accounts endpoint
    await page.route('**/rest/v1/accounts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: mockAccounts });
      } else {
        await route.continue();
      }
    });

    // Mock action history endpoint
    await page.route('**/rest/v1/account_action_history*', async (route) => {
      await route.fulfill({ json: mockActionHistory });
    });

    // Mock snapshots
    await page.route('**/rest/v1/account_analytics*', async (route) => {
      await route.fulfill({ json: [] });
    });

    await page.route('**/rest/v1/pilot_readiness_reports*', async (route) => {
      await route.fulfill({ json: [] });
    });
  });

  test('displays executed actions rollup, success rate, and failure alerts from live history', async ({ page }) => {
    await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/.*\/analytics/);

    // Verify heading
    await expect(page.locator('h1, h2').filter({ hasText: /Analytics/i })).toBeVisible();

    // Verify account selector has option
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('acc-analytics-1');

    // Verify real action rollup cards
    await expect(page.getByText('Actions Executed')).toBeVisible();
    await expect(page.locator('div').filter({ hasText: /^3$/ }).first()).toBeVisible(); // 3 total actions

    await expect(page.getByText('Action Success Rate')).toBeVisible();
    await expect(page.getByText('66.7%')).toBeVisible(); // 2 / 3 = 66.7%

    // Verify chart title
    await expect(page.getByText('Executed Actions Daily Rollup')).toBeVisible();

    // Verify action breakdown chips
    await expect(page.getByText('Like: 2')).toBeVisible();
    await expect(page.getByText('Follow: 1')).toBeVisible();

    // Verify incident alerts
    await expect(page.getByText('Recent Action Errors / Block Incidents')).toBeVisible();
    await expect(page.getByText(/Device gesture timed out on profile button/i)).toBeVisible();
  });
});
