# Real Voice Recognition - Using Pi's Microphone

## What Changed

**CRITICAL FIX**: The previous implementation used browser-based Web Speech API, which would only work if you had a microphone connected to the device viewing the display (laptop/phone). This was useless for your headless Pi.

## New Implementation

### Python Voice Recognition Service
- ✅ **Runs on the Pi** using the camera's USB microphone (C270 HD WEBCAM)
- ✅ **Continuous listening** - always running in background
- ✅ **Google Speech Recognition** - accurate voice-to-text
- ✅ **WebSocket communication** - sends commands to display instantly
- ✅ **No browser dependencies** - works on headless Pi

### How It Works

```
Your Voice → USB Mic → Voice Service (Python) → Backend (WebSocket) → Display (Page Change)
```

1. **Voice service** listens continuously via microphone
2. When it hears "Spotify" or "Home", it sends command to backend
3. **Backend** broadcasts page change via WebSocket
4. **Display** receives message and changes page
5. **Page indicator** updates automatically

## Voice Commands

### Navigation
- **"Spotify"** - Go to Spotify page
- **"Play music"** - Go to Spotify page
- **"Home"** - Return to home page
- **"Back"** - Return to home page

### Playback (on Spotify page only)
- **"Play"** - Resume playback
- **"Pause"** / **"Stop"** - Pause playback
- **"Next"** / **"Skip"** - Next track
- **"Previous"** - Previous track
- **"Volume up"** - Set to 80%
- **"Volume down"** - Set to 30%

## Checking If It's Working

### Check Voice Service Logs
```bash
docker logs smart-mirror-voice --tail 20
```

**Look for:**
```
INFO - 🎤 Voice recognition started - listening for commands...
INFO - Say 'Spotify' or 'Home' to navigate pages
```

### Test Voice Command
1. Say **"Spotify"** clearly
2. Check logs:
```bash
docker logs smart-mirror-voice --tail 5
```

**Should see:**
```
INFO - 🔊 Heard: 'spotify'
INFO - 🎤 Processing command: 'spotify'
INFO - ✅ Page changed to: spotify
```

### Check Page Indicator
- Bottom of display shows **two dots**
- **Right dot** should light up when you say "Spotify"
- **Left dot** should light up when you say "Home"

## Microphone Detection

The service automatically detects available microphones. Your setup has:
```
Available microphones:
- vc4-hdmi-0: MAI PCM i2s-hifi-0 (hw:0,0)
- C270 HD WEBCAM: USB Audio (hw:2,0)  ← USING THIS
- sysdefault
- hdmi
- default
```

The C270 webcam microphone is being used for voice input.

## Troubleshooting

### Voice commands not recognized
1. **Check service is running**:
   ```bash
   docker ps | grep voice
   ```
   Should show `smart-mirror-voice` as `Up`

2. **Check for errors**:
   ```bash
   docker logs smart-mirror-voice 2>&1 | grep ERROR
   ```

3. **Speak clearly and louder** - The mic might not pick up quiet speech

4. **Check microphone levels**:
   ```bash
   docker exec -it smart-mirror-voice arecord -l
   ```

### Page doesn't change
1. **Check backend logs**:
   ```bash
   docker logs smart-mirror-backend --tail 20
   ```
   Should see "Broadcasting voice command"

2. **Check display logs**:
   ```bash
   docker logs smart-mirror-display --tail 20
   ```

3. **Restart all services**:
   ```bash
   cd /home/smartmirror/Downloads/smart-mirror
   docker compose restart
   ```

### Internet required
Voice recognition uses Google's cloud API, so **internet connection is required**.

If internet is down, you'll see:
```
ERROR - Could not request results from Google Speech Recognition
```

## Page Indicator Position

The page dots are positioned at `bottom: 150px` from the bottom edge.

**If you can't see them**, edit `/home/smartmirror/Downloads/smart-mirror/display/src/App.css`:

```css
.page-indicator {
  bottom: 200px;  /* Move higher */
}
```

Then rebuild:
```bash
docker compose up -d --build display
```

## Architecture

### Services
- **voice** (NEW) - Python voice recognition using USB mic
- **backend** - Node.js API + WebSocket server
- **display** - React frontend showing pages
- **camera** - AI person detection
- **sensor** - DHT22 temperature/humidity

### Communication Flow
```
Voice Service → HTTP POST → Backend /api/broadcast
Backend → WebSocket → All connected displays
Display → React state update → Page change
Page Indicator → CSS update → Visual feedback
```

## Files Created/Modified

### New Files
- `voice/voice_service.py` - Main voice recognition service
- `voice/requirements.txt` - Python dependencies
- `voice/Dockerfile` - Voice service container
- `docker-compose.yml` - Added voice service

### Modified Files
- `backend/src/api/routes.js` - Added /api/broadcast endpoint
- `display/src/hooks/useWebSocket.js` - Added page_change handler
- `display/src/App.jsx` - Removed browser voice, added WebSocket callback
- `display/src/App.css` - Moved page indicators higher

## Testing Checklist

- [ ] Voice service running (`docker ps | grep voice`)
- [ ] Logs show "🎤 Voice recognition started"
- [ ] Say "Spotify" - logs show "Heard: spotify"
- [ ] Page indicator right dot lights up
- [ ] Say "Home" - left dot lights up
- [ ] Display actually changes pages
- [ ] Spotify page shows album art (if authenticated)

Everything should now work using the Pi's actual microphone, not a browser!
