import { test, expect } from '@playwright/test';
async function revealHome(page) {
    for (const card of await page.locator('.home-card').all()) {
        await card.scrollIntoViewIfNeeded();
        await expect(card).toHaveCSS('opacity', '1');
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}
test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Admin password').fill('nexus-local-test-password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(
        page.getByRole('heading', { name: 'Home', exact: true })
    ).toBeVisible();
});
test('visible navigation, tap-only remote, explicit standby, and mobile/desktop layouts', async ({
    page
}) => {
    await page.goto('/mirror/controls');
    await page.setViewportSize({ width: 320, height: 780 });
    await page.getByRole('button', { name: 'Standby', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Wake', exact: true })
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Wake', exact: true }).click();
    await page.getByRole('button', { name: '1 Weather' }).click();
    await expect(
        page.getByRole('button', { name: /Unavailable/ }).first()
    ).toBeDisabled();
    for (const section of [
        'Home',
        'Alarms',
        'Lights',
        'Monitor',
        'Settings',
        'Mirror'
    ]) {
        if (section === 'Settings')
            await page
                .getByRole('link', { name: 'Settings', exact: true })
                .click();
        else
            await page
                .locator('.nexus-workspace > .nexus-navigation')
                .getByRole('link', { name: section, exact: true })
                .click();
        await expect(
            page.getByRole('heading', { name: section, exact: true, level: 1 })
        ).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
    }
    await page.screenshot({
        path: 'test-results/nexus-mobile.png',
        fullPage: true
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('.nexus-sidebar')).toBeVisible();
    await expect(
        page.locator('.nexus-workspace > .nexus-navigation')
    ).toBeHidden();
    await page.screenshot({
        path: 'test-results/nexus-desktop.png',
        fullPage: true
    });
});
test('alarm editor and master-off timer choices use real command correlation', async ({
    page
}) => {
    await page.goto('/alarms/clock');
    const master = page.getByRole('switch', {
        name: 'Smart master',
        exact: true
    });
    await expect(master).toBeEnabled();
    await master.click();
    await expect(master).not.toBeChecked();
    await page.getByRole('link', { name: 'Timers', exact: true }).click();
    await page.getByRole('button', { name: '2 min', exact: true }).click();
    await expect(
        page.getByRole('dialog', { name: 'Smart master is off' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Keep suspended' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page
        .getByRole('link', { name: 'Alarms', exact: true })
        .last()
        .click();
    await page.getByRole('button', { name: 'Create alarm' }).click();
    await page
        .getByRole('combobox', { name: 'Type', exact: true })
        .selectOption('repeat');
    await page.getByRole('button', { name: 'Save alarm' }).click();
    await page
        .getByRole('button', { name: 'Turn on master and enable' })
        .click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(
        page.getByRole('switch', { name: 'Enable alarm 7:00' })
    ).toBeChecked();
});
test('camera teardown, theme, grouped WLED power, and legacy redirects', async ({
    page
}) => {
    await page.goto('/camera');
    await expect(page).toHaveURL(/mirror\/camera/);
    await expect(page.getByAltText('Live mirror camera')).toBeVisible();
    await page.getByRole('link', { name: 'Controls', exact: true }).click();
    await expect(page.getByAltText('Live mirror camera')).toHaveCount(0);
    await page.goto('/lights');
    await page.getByRole('switch', { name: 'All lights power' }).click();
    await expect(
        page.getByRole('switch', { name: 'Desk power' })
    ).not.toBeChecked();
    await expect(
        page.getByRole('switch', { name: 'Monitor power' })
    ).not.toBeChecked();
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('every view fits narrow phones and tablets; photos preserve upload and delete', async ({
    page
}) => {
    test.setTimeout(90000);
    for (const width of [320, 390, 768, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of [
            '/home',
            '/mirror/controls',
            '/mirror/edit',
            '/mirror/camera',
            '/mirror/photos',
            '/alarms/alarms',
            '/alarms/timers',
            '/alarms/clock',
            '/lights',
            '/monitor/devices',
            '/monitor/activity',
            '/settings'
        ]) {
            await page.goto(path);
            await expect(page.locator('.nexus-main h1')).toBeVisible();
            await expect(page.locator('.nexus-topbar .connection')).toHaveText(
                'Connected'
            );
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                ),
                `${path} at ${width}px`
            ).toBe(true);
        }
    }
    await page.goto('/mirror/photos');
    const fs = await import('node:fs');
    const icon = new URL('../public/icon-192.png', import.meta.url);
    await page.locator('input[type="file"]').setInputFiles({
        name: 'nexus-test.png',
        mimeType: 'image/png',
        buffer: fs.readFileSync(icon)
    });
    await expect(
        page.getByRole('button', { name: 'Preview photo 1', exact: true })
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Preview photo 1', exact: true })
        .click();
    await expect(
        page.getByRole('dialog', { name: 'Photo preview' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(
        page.getByRole('dialog', { name: 'Delete photo?' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Preview photo 1', exact: true })
    ).toHaveCount(0);
});

test('unsaved mirror edits block navigation and theme respects reduced motion', async ({
    page
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/mirror/edit');
    const widget = page.getByRole('switch', {
        name: 'Show Time & Date',
        exact: true
    });
    await widget.click();
    page.once('dialog', (dialog) => dialog.dismiss());
    const nav = page.locator(
        '.nexus-sidebar:visible .nexus-navigation, .nexus-workspace > .nexus-navigation:visible'
    );
    await nav.getByRole('link', { name: 'Lights', exact: true }).click();
    await expect(page).toHaveURL(/mirror\/edit/);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status')).toHaveText(
        'Mirror preferences saved.'
    );
    await nav.getByRole('link', { name: 'Lights', exact: true }).click();
    await expect(page).toHaveURL(/lights/);
});

test('Monitor exposes measurements and filters; dialogs support Escape and restore focus', async ({
    page
}) => {
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    await page.goto('/monitor/devices');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('.device-card')).toHaveCount(7);
    await expect(page.locator('.device-card-motion').first()).toHaveCSS(
        'opacity',
        '1'
    );
    expect(
        await page
            .locator('.device-grid')
            .evaluate(
                (element) =>
                    getComputedStyle(element).gridTemplateColumns.split(' ')
                        .length
            )
    ).toBe(4);
    await page.screenshot({
        path: 'test-results/nexus-monitor-desktop.png',
        fullPage: true
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
        path: 'test-results/nexus-monitor-mobile.png',
        fullPage: true
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const mirror = page.locator('.device-card[href="/monitor/devices/mirror"]');
    await expect(mirror.getByText('12%', { exact: true })).toBeVisible();
    await expect(
        mirror.getByRole('progressbar', { name: 'CPU usage' })
    ).toHaveAttribute('aria-valuenow', '12');
    await page
        .getByRole('textbox', { name: 'Search devices' })
        .fill('ThinkPad');
    await expect(page.locator('.device-card')).toHaveCount(1);
    await expect(page.locator('.device-card')).toContainText('Not configured');
    await page.getByRole('textbox', { name: 'Search devices' }).fill('');
    await page
        .getByRole('radiogroup', { name: 'Filter devices' })
        .getByText('Online', { exact: true })
        .click();
    await expect(
        page.getByRole('radio', { name: 'Online', exact: true })
    ).toBeChecked();
    await expect(page.locator('.device-card')).toHaveCount(4);
    await page.goto('/alarms/alarms');
    const create = page.getByRole('button', { name: 'Create alarm' });
    await create.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(create).toBeFocused();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/lights');
    await expect(page.locator('.lighting-group')).toHaveCSS('opacity', '1');
    await expect(page.locator('.lighting-group')).toHaveCSS(
        'transform',
        'none'
    );
    await page.getByRole('slider', { name: 'Desk brightness' }).press('End');
    await expect(
        page.getByRole('slider', { name: 'Desk brightness' })
    ).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByRole('status')).toContainText('Desk updated.');
    await page.goto('/monitor/devices');
    await expect(
        page.locator('.device-card[href="/monitor/devices/desk"]')
    ).toContainText('100%');
    expect(browserErrors).toEqual([]);
});

test('Home is the landing page, never streams the camera, and opens every workspace', async ({
    page
}) => {
    const requests = [];
    const errors = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('pageerror', (error) => errors.push(error.message));
    for (const path of ['/', '/dashboard', '/this-page-does-not-exist']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/home$/);
        await expect(
            page.getByRole('heading', { name: 'Home', exact: true })
        ).toBeVisible();
        await expect(page.locator('.home-device-table tbody tr')).toHaveCount(
            7
        );
    }
    expect(requests.filter((url) => url.includes('/api/camera/'))).toEqual([]);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(
        page.locator('.nexus-sidebar .nexus-navigation a')
    ).toHaveCount(6);
    await expect(page.locator('.home-mirror')).toHaveCSS('opacity', '1');
    await revealHome(page);
    await page.screenshot({
        path: 'test-results/nexus-home-desktop.png',
        fullPage: true
    });
    await page.getByRole('link', { name: 'Manual alarm', exact: true }).click();
    await expect(page).toHaveURL(/\/alarms\/alarms#manual$/);
    await expect(page.locator('#manual')).toBeFocused();
    await page.goto('/home');
    await page.getByRole('link', { name: 'Camera', exact: true }).click();
    await expect(page.getByAltText('Live mirror camera')).toBeVisible();
    await page
        .locator('.nexus-sidebar')
        .getByRole('link', { name: 'Home', exact: true })
        .click();
    await expect(page.getByAltText('Live mirror camera')).toHaveCount(0);
    for (const [label, path] of [
        ['Open mirror', '/mirror/controls'],
        ['Edit', '/mirror/edit'],
        ['Photos', '/mirror/photos'],
        ['Open clock', '/alarms/alarms'],
        ['Timers', '/alarms/timers'],
        ['Open lights', '/lights'],
        ['Open monitor', '/monitor/devices'],
        ['Open settings', '/settings']
    ]) {
        await page.goto('/home');
        const link =
            label === 'Photos'
                ? page.locator('.home-links a[href="/mirror/photos"]')
                : page.getByRole('link', { name: label, exact: true });
        await link.click();
        await expect(page).toHaveURL(new RegExp(path + '$'));
    }
    await page.goto('/home');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
        page.locator('.nexus-workspace > .nexus-navigation a:visible')
    ).toHaveCount(5);
    await expect(page.locator('.nexus-settings-shortcut')).toBeVisible();
    await revealHome(page);
    await page.screenshot({
        path: 'test-results/nexus-home-mobile.png',
        fullPage: true
    });
    await page.locator('.nexus-settings-shortcut').click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.goto('/home');
    await page
        .getByRole('link', { name: 'Backup & restore', exact: true })
        .click();
    await expect(page.locator('#backup')).toHaveAttribute('open', '');
    expect(errors).toEqual([]);
});

test('Home power controls reconcile state, retain pending locks across navigation, and show group failures', async ({
    page
}) => {
    await page.goto('/home');
    const groupPower = page.getByRole('switch', { name: 'All lights power' });
    await expect(groupPower).toBeEnabled();
    if (!(await groupPower.isChecked())) await groupPower.click();
    await expect(groupPower).toBeChecked();
    await expect(
        page.getByRole('switch', { name: 'Desk power' })
    ).toBeChecked();
    await expect(
        page.getByRole('switch', { name: 'Monitor power' })
    ).toBeChecked();
    if (
        await page
            .getByRole('button', { name: 'Wake up', exact: true })
            .isEnabled()
    )
        await page
            .getByRole('button', { name: 'Wake up', exact: true })
            .click();
    await page.getByRole('button', { name: 'Standby', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Standby', exact: true })
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Wake up', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Wake up', exact: true })
    ).toBeDisabled();
    let release;
    let started;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const seen = new Promise((resolve) => {
        started = resolve;
    });
    await page.route('**/api/lights/desk/command', async (route) => {
        started();
        await gate;
        await route.continue();
    });
    try {
        await page
            .getByRole('switch', { name: 'Desk power', exact: true })
            .click();
        await seen;
        await page
            .getByRole('link', { name: 'Open lights', exact: true })
            .click();
        await expect(
            page.getByRole('switch', { name: 'Desk power' })
        ).toBeDisabled();
        release();
        await expect(
            page.getByRole('switch', { name: 'Desk power' })
        ).toBeEnabled();
        await expect(
            page.getByRole('switch', { name: 'Desk power' })
        ).not.toBeChecked();
    } finally {
        release();
    }
    await page.unroute('**/api/lights/desk/command');
    await page.goto('/home');
    await expect(
        page.getByText('Mixed power state', { exact: true })
    ).toBeVisible();
    await page.route('**/api/lights/group', (route) =>
        route.fulfill({
            json: {
                ok: false,
                results: [
                    { id: 'desk', ok: true },
                    { id: 'monitor', ok: false, error: 'unreachable' }
                ]
            }
        })
    );
    await page.getByRole('switch', { name: 'All lights power' }).click();
    await expect(page.getByRole('alert')).toContainText(
        'Desk: updated · Monitor: unreachable'
    );
});

test('Home fits long names in both themes and detail states remain accessible', async ({
    page
}) => {
    const longName =
        'Mirror and Raspberry Pi with a deliberately long descriptive device name';
    await page.route('**/api/devices', async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.devices[0].name = longName;
        await route.fulfill({ response, json: body });
    });
    for (const theme of ['light', 'dark']) {
        await page.goto('/settings');
        await page
            .getByRole('button', {
                name: theme === 'light' ? 'Light' : 'Dark',
                exact: true
            })
            .click();
        for (const width of [320, 390, 768, 1440, 1920]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto('/home');
            await expect(
                page.getByRole('link', { name: longName, exact: true })
            ).toBeVisible();
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                ),
                `${theme} Home at ${width}`
            ).toBe(true);
            if (width >= 1200)
                expect(
                    await page
                        .locator('.home-grid')
                        .evaluate(
                            (element) =>
                                getComputedStyle(
                                    element
                                ).gridTemplateColumns.split(' ').length
                        )
                ).toBe(2);
        }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/home');
    await expect(page.locator('.home-mirror')).toHaveCSS('transform', 'none');
    await page.getByRole('link', { name: longName, exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/monitor\/devices\/mirror$/);
    await page.goto('/settings/connections');
    await expect(page.locator('#connections')).toHaveAttribute('open', '');
    await page.unrouteAll({ behavior: 'wait' });
});

test('compact colored presets include the explicitly mapped Rainbow / Gaming pair', async ({ page }) => {
    await page.goto('/lights');
    const pair = page.getByRole('button', { name: 'Rainbow / Gaming', exact: true });
    await expect(pair).toBeEnabled();
    const response = page.waitForResponse((r) => r.url().endsWith('/api/lights/group') && r.request().method() === 'POST');
    await pair.click();
    const result = await (await response).json();
    expect(result.results.find((r) => r.id === 'desk').state.state.ps).toBe(6);
    expect(result.results.find((r) => r.id === 'monitor').state.state.ps).toBe(3);
    await expect(pair).toHaveAttribute('aria-pressed', 'true');
    expect((await pair.boundingBox()).height).toBeLessThan(60);
    const starWars = page.getByRole('button', { name: 'Star Wars', exact: true }).first();
    expect(await starWars.evaluate((e) => e.style.getPropertyValue('--preset-background'))).toMatch(/#0000ff.*#ff0000/);
});

test('contextual mirror preferences persist team choice and game priority', async ({ page }) => {
    await page.goto('/mirror/edit');
    await page.getByRole('combobox', { name: 'Mirror page', exact: true }).selectOption('weather');
    await expect(page.getByRole('textbox', { name: 'City', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Preferred sport' })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Mirror page', exact: true }).selectOption('sports');
    await expect(page.getByRole('textbox', { name: 'City', exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Highlights team' }).locator('option')).toHaveText(['Golden State Warriors', 'Auburn football']);
    await expect(page.locator('.sports-priority-row')).toHaveCount(2);
    await page.getByRole('combobox', { name: 'Highlights team' }).selectOption('auburn');
    await page.getByRole('button', { name: 'Move gsw up', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Mirror preferences saved.')).toBeVisible();
    await page.reload();
    await page.getByRole('combobox', { name: 'Mirror page', exact: true }).selectOption('sports');
    await expect(page.getByRole('combobox', { name: 'Highlights team' })).toHaveValue('auburn');
    await expect(page.locator('.sports-priority-row').first()).toContainText('Golden State Warriors');
});

test('activity identifies source devices and filters warnings and errors', async ({ page }) => {
    await page.goto('/monitor/activity');
    await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('Error');
    await expect(page.locator('.activity-entry')).toHaveCount(1);
    await expect(page.locator('.activity-entry')).toContainText('Monitor');
    await page.locator('.activity-entry summary').click();
    await expect(page.locator('.activity-details')).toBeVisible();
    await page.getByRole('combobox', { name: 'Device', exact: true }).selectOption('desk');
    await expect(page.getByText('No events match these filters.')).toBeVisible();
});
