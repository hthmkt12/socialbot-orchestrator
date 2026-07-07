import { expect, test } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('Operator accounts management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, { role: 'OPERATOR' });
  });

  test('OP-CAN-002 and OP-CAN-003 expose account create and import actions', async ({ page }) => {
    await page.goto('/accounts');

    await expect(page.getByRole('button', { name: 'Import CSV' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Add Account' })).toBeEnabled();
    await expect(page.getByText('role can inspect accounts but not change them')).toHaveCount(0);
  });
});
