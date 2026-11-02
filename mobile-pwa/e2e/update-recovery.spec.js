import { test, expect } from '@playwright/test';

test('app update recovery refreshes the current route once and retains sign-in', async ({
    page
}) => {
    await page.goto('/');
    await page.getByLabel('Admin password').fill('nexus-local-test-password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(
        page.getByRole('heading', { name: 'Home', exact: true })
    ).toBeVisible();
    await page.goto('/mirror/controls');
    await expect(
        page.getByRole('heading', { name: 'Mirror', exact: true })
    ).toBeVisible();
    await Promise.all([
        page.waitForEvent('domcontentloaded'),
        page.evaluate(() =>
            window.dispatchEvent(
                new Event('vite:preloadError', { cancelable: true })
            )
        )
    ]);
    await expect(page).toHaveURL(/\/mirror\/controls$/);
    await expect(
        page.getByRole('heading', { name: 'Mirror', exact: true })
    ).toBeVisible();
    expect(
        await page.evaluate(() =>
            sessionStorage.getItem('nexus-preload-recovery-at')
        )
    ).toBeTruthy();
    expect(
        await page.evaluate(() =>
            window.dispatchEvent(
                new Event('vite:preloadError', { cancelable: true })
            )
        )
    ).toBe(true);
    await expect(
        page.getByRole('heading', { name: 'Mirror', exact: true })
    ).toBeVisible();
});
