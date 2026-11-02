import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run against the isolated fixture only. These screenshots never contact hardware.
const reviewRoot = process.env.NEXUS_REVIEW_DIR || 'test-results/page-review';
const views = [
    ['home', '/home'],
    ['mirror-controls', '/mirror/controls'],
    ['mirror-edit-main', '/mirror/edit'],
    ['mirror-edit-weather', '/mirror/edit', 'weather'],
    ['mirror-edit-sports', '/mirror/edit?section=sports'],
    ['mirror-camera', '/mirror/camera'],
    ['mirror-photos', '/mirror/photos'],
    ['alarms', '/alarms/alarms'],
    ['timers', '/alarms/timers'],
    ['clock', '/alarms/clock'],
    ['lights', '/lights'],
    ['devices', '/monitor/devices'],
    ['device-mirror', '/monitor/devices/mirror'],
    ['device-clock', '/monitor/devices/smart-clock'],
    ['device-wled', '/monitor/devices/desk'],
    ['device-unconfigured', '/monitor/devices/mac'],
    ['device-network', '/monitor/devices/mirror/network'],
    ['network-secured', '/monitor/devices/mirror/network'],
    ['network-open', '/monitor/devices/mirror/network'],
    ['activity', '/monitor/activity'],
    ['settings', '/settings'],
    ['connections', '/settings/connections'],
    ['preferences', '/settings#preferences'],
    ['backup', '/settings#backup'],
    ['access', '/settings#access']
];

test('secondary pages and long dialogs fit narrow phones and wide desktops', async ({
    page
}) => {
    test.setTimeout(90000);
    await page.goto('/');
    await page.getByLabel('Admin password').fill('nexus-local-test-password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(
        page.getByRole('heading', { name: 'Home', exact: true })
    ).toBeVisible();
    for (const width of [320, 768, 1920]) {
        await page.setViewportSize({ width, height: 844 });
        for (const route of [
            '/monitor/devices/mirror/network',
            '/monitor/devices/mirror',
            '/monitor/devices/smart-clock',
            '/monitor/devices/desk',
            '/monitor/devices/mac',
            '/settings/connections',
            '/settings#preferences',
            '/settings#backup',
            '/settings#access'
        ]) {
            await page.goto(route);
            await expect(page.locator('.nexus-main h1')).toBeVisible();
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                ),
                `${route} at ${width}`
            ).toBe(true);
        }
    }
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/lights');
    await page
        .getByRole('button', { name: 'Manage favorites & paired presets' })
        .click();
    const save = page.getByRole('button', {
        name: 'Save favorites',
        exact: true
    });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    expect(
        await page
            .getByRole('dialog')
            .evaluate((element) => element.scrollWidth <= element.clientWidth)
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(
        page.getByRole('button', { name: 'Manage favorites & paired presets' })
    ).toBeFocused();
});

for (const theme of ['dark', 'light']) {
    for (const [size, width, height] of [
        ['desktop', 1440, 1000],
        ['phone', 390, 844]
    ]) {
        test(`page review ${theme} ${size}`, async ({ page }) => {
            test.setTimeout(180000);
            const directory = path.resolve(reviewRoot, `${theme}-${size}`);
            await mkdir(directory, { recursive: true });
            const pageErrors = [];
            page.on('pageerror', (error) => pageErrors.push(error.message));
            await page.setViewportSize({ width, height });
            page.setDefaultTimeout(10000);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.addInitScript(
                (value) => localStorage.setItem('nexus-theme', value),
                theme
            );
            await page.goto('/');
            await expect(page.getByLabel('Admin password')).toBeVisible();
            await page.screenshot({
                path: path.join(directory, 'login.png'),
                fullPage: true
            });
            await page
                .getByLabel('Admin password')
                .fill('nexus-local-test-password');
            await page.getByRole('button', { name: 'Sign In' }).click();
            await expect(
                page.getByRole('heading', { name: 'Home', exact: true })
            ).toBeVisible();
            const captures = [
                { name: 'login', route: '/', theme, width, height }
            ];
            async function record(name, route, fullPage = true) {
                expect(
                    await page.evaluate(
                        () => document.documentElement.scrollWidth <= innerWidth
                    ),
                    `${name} at ${width}`
                ).toBe(true);
                await page.screenshot({
                    path: path.join(directory, `${name}.png`),
                    fullPage
                });
                captures.push({ name, route, theme, width, height });
            }
            for (const [name, route, mirrorPage] of views) {
                await page.goto(route);
                await expect(page.locator('.nexus-main h1')).toBeVisible();
                await expect(
                    page.locator('.nexus-topbar .connection')
                ).toHaveText('Connected');
                await expect(page.locator('html')).toHaveAttribute(
                    'data-theme',
                    theme
                );
                if (mirrorPage)
                    await page
                        .getByRole('combobox', { name: /Mirror page/ })
                        .selectOption(mirrorPage);
                if (name === 'connections')
                    await expect(
                        page.locator('.connection-editor')
                    ).toHaveCount(7);
                if (name.startsWith('device-'))
                    await expect(
                        page.locator('.nexus-main h2').first()
                    ).toBeVisible();
                if (route.endsWith('/network')) {
                    await expect(
                        page.getByRole('button', {
                            name: 'Scan Wi-Fi networks'
                        })
                    ).toBeEnabled();
                    if (name.startsWith('network-')) {
                        await page
                            .getByRole('button', {
                                name:
                                    name === 'network-open'
                                        ? /Guest test network/
                                        : /Nexus test network/
                            })
                            .click();
                        await expect(
                            page.getByRole('heading', { name: /^Connect to/ })
                        ).toBeFocused();
                        if (name === 'network-open')
                            await expect(
                                page.getByRole('button', {
                                    name: 'Connect',
                                    exact: true
                                })
                            ).toBeEnabled();
                    }
                }
                for (const panel of await page.locator('.surface').all()) {
                    await panel.scrollIntoViewIfNeeded();
                    await expect(panel).toHaveCSS('opacity', '1');
                }
                await page.evaluate(() =>
                    window.scrollTo({ top: 0, behavior: 'instant' })
                );
                expect(
                    await page.evaluate(
                        () => document.documentElement.scrollWidth <= innerWidth
                    ),
                    `${name} at ${width}`
                ).toBe(true);
                await page.screenshot({
                    path: path.join(directory, `${name}.png`),
                    fullPage: true
                });
                captures.push({ name, route, theme, width, height });
            }
            for (const [name, route] of [
                ['mirror-edit-expanded', '/mirror/edit'],
                ['mirror-maintenance', '/mirror/controls'],
                ['clock-expanded', '/alarms/clock'],
                ['device-maintenance', '/monitor/devices/mirror'],
                ['lights-expanded', '/lights']
            ]) {
                await page.goto(route);
                await expect(page.locator('.nexus-main h1')).toBeVisible();
                for (const summary of await page
                    .locator('details > summary')
                    .all())
                    await summary.click();
                await page.evaluate(() =>
                    window.scrollTo({ top: 0, behavior: 'instant' })
                );
                await record(name, route);
            }
            for (const [name, route, button, title] of [
                ['timer-editor', '/alarms/timers', 'Custom', 'Custom timer'],
                [
                    'favorites-editor',
                    '/lights',
                    'Manage favorites & paired presets',
                    'Lighting favorites'
                ],
                [
                    'device-editor',
                    '/settings/connections',
                    'Add device',
                    'Register device'
                ]
            ]) {
                await page.goto(route);
                await page
                    .getByRole('button', { name: button, exact: true })
                    .click();
                await expect(
                    page.getByRole('dialog', { name: title, exact: true })
                ).toBeVisible();
                await record(name, route, false);
                if (name === 'favorites-editor') {
                    const save = page.getByRole('button', {
                        name: 'Save favorites',
                        exact: true
                    });
                    await save.scrollIntoViewIfNeeded();
                    await expect(save).toBeInViewport();
                    await record('favorites-editor-footer', route, false);
                }
                await page.keyboard.press('Escape');
                await expect(page.getByRole('dialog')).toBeHidden();
            }
            // Capture the main editor overlay at both sizes, with focus and Escape checked.
            await page.goto('/alarms/alarms');
            await page.getByRole('button', { name: 'Create alarm' }).click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await page.screenshot({
                path: path.join(directory, 'alarm-editor.png'),
                fullPage: false
            });
            await page.keyboard.press('Escape');
            await expect(page.getByRole('dialog')).toBeHidden();
            await expect(
                page.getByRole('button', { name: 'Create alarm' })
            ).toBeFocused();
            captures.push({
                name: 'alarm-editor',
                route: '/alarms/alarms',
                theme,
                width,
                height
            });
            await page.getByRole('button', { name: 'Create alarm' }).click();
            await page
                .getByRole('combobox', { name: 'Type', exact: true })
                .selectOption('repeat');
            await record('alarm-repeat-editor', '/alarms/alarms', false);
            await page.keyboard.press('Escape');
            expect(pageErrors).toEqual([]);
            await writeFile(
                path.join(directory, 'manifest.json'),
                JSON.stringify(captures, null, 2)
            );
        });
    }
}
