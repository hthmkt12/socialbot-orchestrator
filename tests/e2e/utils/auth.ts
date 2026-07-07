import { Page } from '@playwright/test';

type TestUserOptions = {
  role?: 'ADMIN' | 'OPERATOR' | 'VIEWER';
};

export async function loginAsTestUser(page: Page, options: TestUserOptions = {}) {
  const role = options.role ?? 'ADMIN';
  // Setup route intercepting BEFORE navigation
  await page.route('**/auth/v1/user*', async route => {
    const json = {
      id: 'test-user-id',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await route.fulfill({ json });
  });

  await page.route('**/rest/v1/profiles*', async route => {
    const json = [{
      id: 'test-profile',
      user_id: 'test-user-id',
      role,
      email: 'test@example.com',
      created_at: new Date().toISOString()
    }];
    await route.fulfill({ json });
  });

  // Mock any account requests
  await page.route('**/rest/v1/accounts*', async route => {
    await route.fulfill({ json: [] });
  });
  
  await page.route('**/rest/v1/device_groups*', async route => {
    await route.fulfill({ json: [] });
  });
  
  await page.route('**/rest/v1/devices*', async route => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/rest/v1/workflow_schedules*', async route => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/rest/v1/macros*', async route => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/rest/v1/approvals*', async route => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/rest/v1/workflow_runs*', async route => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/auth/v1/session*', async route => {
      const json = {
        access_token: 'dummy-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'dummy-refresh-token',
        user: {
            id: 'test-user-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'test@example.com'
        }
      };
      await route.fulfill({ json });
  });
  
  await page.route('**/auth/v1/token?grant_type=password', async route => {
      const json = {
        access_token: 'dummy-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'dummy-refresh-token',
        user: {
            id: 'test-user-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'test@example.com',
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
      };
      await route.fulfill({ json });
  });

  // Navigate to app
  await page.goto('/');

  // Wait for React to mount and show either Dashboard or Login
  try {
    // If we're already on the dashboard, we don't need to log in
    await page.waitForURL(/.*\/social-dashboard/, { timeout: 2000 });
    return;
  } catch {
    // Not on dashboard, proceed to login
  }

  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Wait for the app layout to load by waiting for the URL to change to the dashboard
  await page.waitForURL(/.*\/social-dashboard/);
}
