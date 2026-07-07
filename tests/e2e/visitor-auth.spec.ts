import { expect, test } from '@playwright/test';

test.describe('Visitor auth guard', () => {
  test('VIS-ERR-002 redirects internal routes to login while logged out', async ({ page }) => {
    await page.goto('/devices');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'SocialBot Orchestrator' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('VIS-CAN-001 opens the public registration screen', async ({ page }) => {
    await page.goto('/register');

    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });
});
