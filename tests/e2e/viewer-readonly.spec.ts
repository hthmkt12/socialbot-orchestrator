import { expect, test } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('Viewer read-only guard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page, { role: 'VIEWER' });
  });

  test('VIEW-NO-006 keeps social account actions read-only', async ({ page }) => {
    await page.goto('/accounts');

    await expect(page.getByText('Viewer role can inspect accounts but not change them')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import CSV' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add Account' })).toBeDisabled();
  });

  test('VIEW-NO-005 keeps device sync and Mobile MCP actions read-only', async ({ page }) => {
    await page.goto('/devices');

    await expect(page.getByText('Viewer role can inspect devices but not sync fleet state')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync from Laixi' })).toBeDisabled();

    await page.goto('/mobile-mcp-orchestrator');

    await expect(page.getByText('Viewer role can inspect Mobile MCP fleet state but not control devices')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Launch app' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Current app' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Screenshot grid' })).toBeDisabled();
  });

  test('VIEW-NO-001 and VIEW-NO-003 keep run and approval actions read-only', async ({ page }) => {
    await page.goto('/runs');

    await expect(page.getByText('Viewer role is read-only for run control')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Run' })).toBeDisabled();

    await page.goto('/approvals');

    await expect(page.getByText('Viewer role can inspect but not resolve approvals')).toBeVisible();
  });

  test('VIEW-NO-004 keeps macro actions read-only and VIEW-NO-007 hides audit navigation', async ({ page }) => {
    await page.goto('/macros');

    await expect(page.getByText('Viewer role is read-only for macros')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Macro' })).toBeDisabled();

    await expect(page.getByRole('link', { name: 'Audit Logs' })).toHaveCount(0);
  });

  test('VIEW-NO-005 keeps schedule management read-only', async ({ page }) => {
    await page.goto('/schedules');

    await expect(page.getByText('Viewer role can inspect schedules but not change them')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Schedule' })).toBeDisabled();
  });
});
