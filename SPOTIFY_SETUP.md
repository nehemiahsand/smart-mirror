# Spotify Integration Setup

## Overview
Your smart mirror now has complete Spotify integration with:
- ✅ OAuth 2.0 authentication
- ✅ Spotify Player UI with album art, track info, and playback status
- ✅ Voice command support (navigation + playback control)
- ✅ Two-page navigation system (Home ↔ Spotify)
- ✅ Page indicators (dots at bottom showing current page)
- ✅ Backend API proxy for Spotify Web API
- ✅ **No buttons required** - fully voice-controlled

## Quick Start

### 1. Create Spotify Developer Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click **"Create an App"**
4. Fill in:
   - **App name**: `Smart Mirror`
   - **App description**: `Smart mirror Spotify integration`
   - **Redirect URI**: `http://100.89.218.111:3001/api/spotify/callback` (use your Pi's Tailscale IP)
5. Click **"Create"**
6. On the app page, click **"Settings"**
7. Copy your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

SSH into your Raspberry Pi and add the credentials:

```bash
cd /home/smartmirror/Downloads/smart-mirror/backend

# Edit .env file (create if doesn't exist)
nano .env
```

Add these lines:
```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://100.89.218.111:3001/api/spotify/callback
```

Save and exit (Ctrl+X, Y, Enter)

### 3. Restart Backend Container

```bash
cd /home/smartmirror/Downloads/smart-mirror
docker compose restart backend
```

### 4. Authenticate with Spotify

1. Say **"Spotify"** to navigate to the Spotify page
2. The screen will display an authentication URL
3. Open that URL on your phone or computer
4. Log in to Spotify and authorize the app
5. You'll be redirected back to the display automatically
6. Start playing music on any Spotify device

## Voice Commands

### Navigation Commands
- **"Spotify"** or **"Play music"** - Go to Spotify page
- **"Home"** or **"Back"** - Return to home page

### Playback Commands (on Spotify page)
- **"Play"** - Resume playback
- **"Pause"** or **"Stop"** - Pause playback
- **"Next"** or **"Skip"** - Next track
- **"Previous"** or **"Back"** - Previous track (for navigation, just say "Previous" not "Back")
- **"Volume up"** - Set volume to 80%
- **"Volume down"** - Set volume to 30%
- **"Volume 50"** - Set volume to 50% (any number 0-100)

## UI Design (No Mouse/Keyboard/Touch Required)

### Page Indicators
- **Two dots** appear at the bottom center of the screen
- **Left dot** = Home page
- **Right dot** = Spotify page
- The **active page** dot is larger and brighter
- Navigate using voice commands only

### Display-Only Controls
Since your Pi has no mouse, keyboard, or touchscreen, all controls are **display-only**:
- **Progress bar** - Shows song progress (no seeking)
- **Playback status** - Shows "▶ Playing" or "⏸ Paused"
- **Volume bar** - Shows current volume level
- **Album art** - Displays current track's album cover
- Control everything with **voice commands**

## Features

### Spotify Player UI (Display-Only)
- Album art display (450x450px)
- Track name and artist
- Playback status indicator ("▶ Playing" or "⏸ Paused")
- Volume bar (visual only, controlled by voice)
- Progress bar with time display (visual only)
- Real-time playback state (updates every 2 seconds)
- **Page indicator dots** at bottom

### Voice Recognition
- Continuous listening (always on)
- Visual indicator when listening
- Commands work from any page
- Auto-restart if recognition stops
- **No buttons, mouse, or touch required**

### Page Navigation
- **Page 1 (Left dot)**: Home - Shows widgets (time, weather, calendar, photos)
- **Page 2 (Right dot)**: Spotify - Shows music player
- Navigate with voice: "Spotify" or "Home"
- Automatic page indicator updates

### API Endpoints

Backend exposes these endpoints:

- `GET /api/spotify/auth-url` - Get OAuth URL
- `GET /api/spotify/callback` - OAuth callback
- `GET /api/spotify/status` - Check authentication
- `POST /api/spotify/logout` - Clear tokens
- `GET /api/spotify/player` - Current playback state
- `GET /api/spotify/currently-playing` - Current track
- `PUT /api/spotify/play` - Resume playback
- `PUT /api/spotify/pause` - Pause playback
- `POST /api/spotify/next` - Skip track
- `POST /api/spotify/previous` - Previous track
- `PUT /api/spotify/volume` - Set volume (0-100)
- `PUT /api/spotify/seek` - Seek to position (ms)
- `GET /api/spotify/devices` - List Spotify devices

## Troubleshooting

### Voice Commands Not Working
- Check browser console for errors
- Grant microphone permissions when prompted
- Speech recognition only works in Chrome/Edge (not Firefox)
- Make sure you're using HTTPS or localhost

### Spotify Authentication Fails
- Verify redirect URI matches exactly in Spotify Developer Dashboard
- Check that environment variables are set correctly
- Restart backend container after changing .env
- Check backend logs: `docker logs smart-mirror-backend`

### No Playback / "No devices available"
- Make sure Spotify is open somewhere (desktop app, phone, web player)
- Start playing a song on any device first
- The mirror can control playback but needs an active device

### Token Expired
- Tokens auto-refresh 5 minutes before expiry
- If authentication fails, go to Spotify page and re-authenticate
- Tokens are persisted in `backend/data/settings.json`

## Files Modified

### Frontend (Display)
- `display/src/App.jsx` - Page navigation + voice commands
- `display/src/App.css` - Voice indicator + Spotify button styling
- `display/src/components/SpotifyPlayer.jsx` - Spotify UI component (NEW)
- `display/src/components/SpotifyPlayer.css` - Spotify UI styling (NEW)

### Backend
- `backend/src/services/spotify.js` - Spotify service layer (NEW)
- `backend/src/api/spotify-routes.js` - Spotify API routes (NEW)
- `backend/src/index.js` - Added Spotify routes

## Next Steps

1. **Add to PWA** - Mirror Spotify controls in mobile PWA app
2. **Queue Management** - View and modify playback queue
3. **Search** - Search for songs/artists/playlists via voice
4. **Playlists** - Browse and select playlists
5. **Lyrics** - Display real-time lyrics (via Musixmatch API)
6. **History** - Show recently played tracks

## Security Notes

- Tokens are stored locally in `backend/data/settings.json`
- Access tokens expire after 1 hour (auto-refresh implemented)
- Refresh tokens are long-lived (used to get new access tokens)
- Never commit `.env` file to git (already in .gitignore)
- Spotify Client Secret should remain private

## Testing Checklist

- [ ] Spotify Developer app created
- [ ] Environment variables configured
- [ ] Backend container restarted
- [ ] Spotify authentication successful
- [ ] Voice commands working
- [ ] Page navigation working (Home ↔ Spotify)
- [ ] Playback controls working
- [ ] Volume control working
- [ ] Progress bar scrubbing working
- [ ] Album art displaying
- [ ] Real-time playback updates working

Enjoy your voice-controlled Spotify smart mirror! 🎵
