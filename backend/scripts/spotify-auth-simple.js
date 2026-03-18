#!/usr/bin/env node

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const settingsService = require('./src/services/settings');
const spotifyService = require('./src/services/spotify');

const CALLBACK_HOST = '127.0.0.1';
const CALLBACK_PORT = 8888;
const CALLBACK_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}/callback`;

function tryOpenBrowser(url) {
  const openers = [
    ['xdg-open', [url]],
    ['gio', ['open', url]],
    ['open', [url]]
  ];

  for (const [command, args] of openers) {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return true;
    } catch (error) {
      // Try the next opener.
    }
  }

  return false;
}

async function main() {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error('Spotify client credentials are missing in backend/.env');
    process.exit(1);
  }

  await settingsService.initialize();
  spotifyService.redirectUri = CALLBACK_URI;

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = spotifyService.getAuthUrl(state);

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, CALLBACK_URI);
      if (requestUrl.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }

      const code = requestUrl.searchParams.get('code');
      const returnedState = requestUrl.searchParams.get('state');
      const error = requestUrl.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(`Spotify authorization failed: ${error}`);
        server.close(() => process.exit(1));
        return;
      }

      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid Spotify callback');
        server.close(() => process.exit(1));
        return;
      }

      await spotifyService.exchangeCode(code);

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Spotify connected. You can close this window.');

      console.log('Spotify tokens saved to backend/data/settings.json');
      server.close(() => process.exit(0));
    } catch (error) {
      console.error('Spotify auth failed:', error.response?.data || error.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Spotify auth failed. Check the terminal for details.');
      server.close(() => process.exit(1));
    }
  });

  server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
    console.log('Spotify auth helper is listening on', CALLBACK_URI);
    console.log('Add this redirect URI to your Spotify app if needed:');
    console.log(CALLBACK_URI);
    console.log('');
    console.log('Open this URL in a browser to authorize Spotify:');
    console.log(authUrl);
    console.log('');

    if (tryOpenBrowser(authUrl)) {
      console.log('Attempted to open the browser automatically.');
    }
  });
}

main().catch((error) => {
  console.error('Failed to start Spotify auth helper:', error.message);
  process.exit(1);
});
