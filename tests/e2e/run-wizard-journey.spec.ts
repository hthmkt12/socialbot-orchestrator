import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('Run Wizard Operator Journey', () => {
  test.beforeEach(async ({ page }) => {
    const mockMacro = {
      id: 'macro-1',
      key: 'insta_warmup',
      name: 'Instagram Warmup Pilot',
      description: 'Human-like warm-up routine with reading delays and screenshot proof',
      latest_version_id: 'ver-1',
      created_by_user_id: 'test-user-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockMacroVersion = {
      id: 'ver-1',
      macro_id: 'macro-1',
      version_number: 1,
      status: 'ACTIVE',
      tags_json: ['instagram', 'warmup'],
      input_schema_json: {
        targetTag: { type: 'string', required: true, description: 'Hashtag to explore' },
      },
      definition_json: {
        version: 1,
        meta: {
          key: 'insta_warmup',
          name: 'Instagram Warmup Pilot',
          tags: ['instagram', 'warmup'],
        },
        antiDetection: true,
        target: { mode: 'single_device' },
        inputs: {
          targetTag: { type: 'string', required: true, description: 'Hashtag to explore' },
        },
        execution: { defaultTimeoutMs: 30000, maxRetries: 1, onError: 'stop' },
        steps: [
          { id: 'step_1', type: 'launch_app', params: { appName: 'com.instagram.android' } },
          { id: 'step_2', type: 'wait', params: { ms: 2000 } },
        ],
      },
      created_by_user_id: 'test-user-id',
      created_at: new Date().toISOString(),
    };

    const mockDevice = {
      id: 'dev-1',
      user_id: 'test-user-id',
      name: 'Redmi 13C Pilot',
      model: '23106RN0DA',
      brand: 'Xiaomi',
      status: 'ONLINE',
      adb_status: 'device',
      serial: 'QC4DKJUO6PW4FMQW',
      os_version: '14',
      metadata_json: { batteryLevel: 92, isCharging: false },
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockAccounts = [
      {
        id: 'acc-active-1',
        user_id: 'test-user-id',
        username: 'insta_pilot_active',
        encrypted_password: 'v2:test-enc-pw',
        platform: 'instagram',
        warm_up_stage: 2,
        daily_action_limit: 10,
        current_action_count: 2,
        is_blocked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'acc-blocked-2',
        user_id: 'test-user-id',
        username: 'insta_blocked_acc',
        encrypted_password: 'v2:test-enc-pw',
        platform: 'instagram',
        warm_up_stage: 1,
        daily_action_limit: 5,
        current_action_count: 5,
        is_blocked: true,
        detected_block_reason: 'Detected keyword: "action blocked"',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    await loginAsTestUser(page, { role: 'OPERATOR' });

    // Mock pilot readiness reports
    await page.route('**/rest/v1/pilot_readiness_reports*', async (route) => {
      await route.fulfill({ json: [] });
    });

    // Mock API endpoints
    await page.route('**/rest/v1/macros*', async (route) => {
      await route.fulfill({ json: [mockMacro] });
    });

    await page.route('**/rest/v1/macro_versions*', async (route) => {
      await route.fulfill({ json: [mockMacroVersion] });
    });

    await page.route('**/rest/v1/devices*', async (route) => {
      await route.fulfill({ json: [mockDevice] });
    });

    await page.route('**/rest/v1/device_locks*', async (route) => {
      await route.fulfill({ json: [] });
    });

    await page.route('**/rest/v1/accounts*', async (route) => {
      const url = route.request().url();
      if (url.includes('id=eq.')) {
        const match = url.match(/id=eq\.([^&]+)/);
        const targetId = match ? match[1] : mockAccounts[0].id;
        const acc = mockAccounts.find((a) => a.id === targetId) ?? mockAccounts[0];
        await route.fulfill({ json: acc });
      } else {
        await route.fulfill({ json: mockAccounts });
      }
    });

    await page.route('**/rest/v1/workflow_runs*', async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          json: {
            id: 'run-e2e-789',
            macro_version_id: 'ver-1',
            status: 'PENDING',
            summary_json: null,
            created_at: new Date().toISOString(),
          },
        });
      } else if (method === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          json: {
            id: 'run-e2e-789',
            status: 'QUEUED',
            summary_json: null,
          },
        });
      } else if (url.includes('id=eq.run-e2e-789')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          json: [
            {
              id: 'run-e2e-789',
              status: 'PENDING',
              summary_json: null,
            },
          ],
        });
      } else {
        await route.fulfill({ json: [] });
      }
    });

    await page.route('**/functions/v1/execute-run*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          success: true,
          status: 'PENDING',
          outcome: 'CLAIM_PENDING',
        },
      });
    });

    await page.route('**/rest/v1/audit_logs*', async (route) => {
      await route.fulfill({ status: 201, json: [] });
    });

    await page.route('**/rest/v1/run_steps*', async (route) => {
      await route.fulfill({ json: [] });
    });
  });

  test('completes full multi-step run wizard journey with anti-detection and account check', async ({
    page,
  }) => {
    // Navigate to Runs via sidebar link
    await page.getByRole('link', { name: 'Runs', exact: true }).click();
    await expect(page).toHaveURL(/.*\/runs/);

    // 1. Verify New Run button is enabled for operator and click to open wizard
    const newRunBtn = page.getByRole('button', { name: /New Run/i });
    await expect(newRunBtn).toBeEnabled();
    await newRunBtn.click();

    // Verify wizard modal opens
    await expect(page.getByText('New Workflow Run')).toBeVisible();

    // 2. Step 1: Select Macro
    await expect(page.getByText('Instagram Warmup Pilot')).toBeVisible();
    await page.getByText('Instagram Warmup Pilot').click();

    const nextBtn = page.getByRole('button', { name: /Next/i });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // 3. Step 2: Target Selection
    await expect(page.getByText('Select Device')).toBeVisible();
    await expect(page.getByText('Redmi 13C Pilot')).toBeVisible();
    await page.getByText('Redmi 13C Pilot').click();

    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // 4. Step 3: Account Selection (required because antiDetection is true)
    await expect(
      page.getByText('Choose the social media account to use for this engagement run.')
    ).toBeVisible();
    await expect(page.getByText('insta_pilot_active')).toBeVisible();
    await expect(page.getByText('insta_blocked_acc')).toBeVisible();

    // Verify blocked account is disabled
    const blockedBtn = page.locator('button').filter({ hasText: 'insta_blocked_acc' });
    await expect(blockedBtn).toBeDisabled();

    // Select active account
    const activeBtn = page.locator('button').filter({ hasText: 'insta_pilot_active' });
    await expect(activeBtn).toBeEnabled();
    await activeBtn.click();

    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // 5. Step 4: Input Variables Step
    await expect(page.getByText('Configure the input variables required by this macro.')).toBeVisible();
    const tagInput = page.locator('input[type="text"]').last();
    await tagInput.fill('photography');

    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // 6. Step 5: Review & Submit
    await expect(page.getByText('Review')).toBeVisible();
    const executeBtn = page.getByRole('button', { name: /Execute Run/i });
    await expect(executeBtn).toBeVisible();
    await expect(executeBtn).toBeEnabled();

    // Click execute
    await executeBtn.click();

    // 7. Verify toast and redirection to monitor page
    await expect(page.getByText(/Run dispatched with status: (PENDING|QUEUED)/i)).toBeVisible();
    await expect(page).toHaveURL(/.*\/runs\/run-e2e-789\/monitor/);
  });
});
