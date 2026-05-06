#!/usr/bin/env node
// Smart Mirror Spotify auth helper.
//
// Run this on a machine with a desktop browser (your laptop) to authorize
// Spotify against the mirror without exposing the mirror to the public
// internet. The helper:
//   1. Logs in to the mirror as admin (cookie auth).
//   2. Asks the mirror for a Spotify auth URL bound to a loopback redirect
//      URI on THIS machine (default: http://127.0.0.1:8888/callback).
//   3. Spins up a tiny local HTTP server to capture the OAuth callback.
//   4. POSTs the resulting code+state back to the mirror so it can exchange
//      tokens server-side and persist them.
//
// Required environment variables:
//   MIRROR_URL        e.g. http://localhost:3001 (after `ssh -L 3001:localhost:80 ...`)
//                     or http://100.120.146.19  (direct over Tailscale)
//   ADMIN_PASSWORD    your mirror admin password
//
// Optional:
//   CALLBACK_PORT     default 8888
//   CALLBACK_HOST     default 127.0.0.1
//
// In your Spotify app's "Redirect URIs", add exactly:
//   http://127.0.0.1:8888/callback
//
// Usage:
//   MIRROR_URL=http://localhost:3001 ADMIN_PASSWORD=... node scripts/spotify-auth.mjs

import http from 'node:http';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';

const MIRROR_URL = (process.env.MIRROR_URL || '').replace(/\/$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const CALLBACK_HOST = process.env.CALLBACK_HOST || '127.0.0.1';
const CALLBACK_PORT = Number(process.env.CALLBACK_PORT || 8888);
const CALLBACK_PATH = '/callback';
const CALLBACK_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;

if (!MIRROR_URL || !ADMIN_PASSWORD) {
    console.error('Missing env. Set MIRROR_URL and ADMIN_PASSWORD.');
    process.exit(1);
}

function tryOpenBrowser(url) {
    const openers = [
        ['open', [url]],
        ['xdg-open', [url]],
        ['gio', ['open', url]],
        ['cmd', ['/c', 'start', '', url]],
    ];
    for (const [cmd, args] of openers) {
        try {
            const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
            child.unref();
            return true;
        } catch { /* try next */ }
    }
    return false;
}

function parseSetCookie(headers) {
    const raw = headers.get('set-cookie') || headers.raw?.()['set-cookie'];
    if (!raw) return '';
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((c) => String(c).split(';')[0]).join('; ');
}

async function login() {
    const res = await fetch(`${MIRROR_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ADMIN_PASSWORD }),
    });
    if (!res.ok) {
        throw new Error(`Admin login failed: HTTP ${res.status}`);
    }
    const cookie = parseSetCookie(res.headers);
    if (!cookie) {
        throw new Error('Admin login did not return a session cookie');
    }
    return cookie;
}

async function fetchAuthUrl(cookie) {
    const url = new URL(`${MIRROR_URL}/api/spotify/auth-url`);
    url.searchParams.set('redirect_uri', CALLBACK_URI);
    const res = await fetch(url, { headers: { Cookie: cookie } });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to get auth URL: HTTP ${res.status} ${text}`);
    }
    return res.json();
}

async function postAuthorize(cookie, code, state) {
    const res = await fetch(`${MIRROR_URL}/api/spotify/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ code, state }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`Authorize failed: HTTP ${res.status} ${data.error || ''}`);
    }
    return data;
}

function waitForCallback() {
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const reqUrl = new URL(req.url, CALLBACK_URI);
                if (reqUrl.pathname !== CALLBACK_PATH) {
                    res.writeHead(404).end('Not found');
                    return;
                }
                const code = reqUrl.searchParams.get('code');
                const state = reqUrl.searchParams.get('state');
                const error = reqUrl.searchParams.get('error');

                if (error) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' }).end(`Spotify error: ${error}`);
                    server.close();
                    reject(new Error(error));
                    return;
                }
                if (!code || !state) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Missing code or state');
                    server.close();
                    reject(new Error('Missing code or state'));
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'text/html' }).end(
                    '<html><body style="font-family:sans-serif;padding:2rem"><h1>Spotify connected.</h1><p>You can close this tab.</p></body></html>'
                );
                server.close();
                resolve({ code, state });
            } catch (err) {
                res.writeHead(500).end('Internal error');
                server.close();
                reject(err);
            }
        });
        server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
            console.log(`Waiting for Spotify callback at ${CALLBACK_URI}`);
        });
        server.on('error', reject);
    });
}

(async () => {
    try {
        console.log('Logging in to mirror admin...');
        const cookie = await login();

        console.log('Requesting Spotify auth URL...');
        const { authUrl } = await fetchAuthUrl(cookie);

        console.log('\nOpen this URL in a browser if it does not open automatically:\n');
        console.log(authUrl, '\n');
        tryOpenBrowser(authUrl);

        const { code, state } = await waitForCallback();
        console.log('Got Spotify callback. Exchanging code via mirror admin API...');

        const result = await postAuthorize(cookie, code, state);
        if (result.authenticated) {
            console.log('\n✓ Spotify connected. Tokens saved on the mirror.');
            process.exit(0);
        } else {
            console.error('Authorization completed but mirror reports not authenticated.');
            process.exit(1);
        }
    } catch (err) {
        console.error('\n✗ Spotify auth failed:', err.message);
        process.exit(1);
    }
})();
