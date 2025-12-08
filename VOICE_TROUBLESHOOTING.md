# Voice Command Troubleshooting Guide

## Changes Made

### 1. **Page Indicators Repositioned**
- Moved from `bottom: 30px` → `bottom: 150px`
- Should now be clearly visible above the bottom edge
- Dark background made more opaque for better visibility

### 2. **Voice Recognition Improvements**
- Added better debug logging in browser console
- Fixed voice recognition to work continuously
- Voice indicator now shows:
  - **Green pulsing**: "🎤 Listening... Say 'Spotify'" (voice is ON)
  - **Red static**: "🎤 Voice Off - Refresh page" (voice is OFF)

## How to Check Voice Recognition

### Step 1: Open Browser Console
1. Open the display in Chrome: `http://100.89.218.111:3000`
2. Press **F12** to open Developer Tools
3. Click **Console** tab
4. Look for these messages:

**Good signs (voice is working):**
```
✅ Speech recognition supported
🎤 Voice recognition started and listening
```

**Bad signs (voice is broken):**
```
❌ Speech recognition NOT supported in this browser
❌ Speech recognition error: not-allowed
```

### Step 2: Check Microphone Permissions

If you see **"not-allowed"** error:
1. Click the **lock icon** in the address bar (left of URL)
2. Find **Microphone** permission
3. Set it to **Allow**
4. **Refresh the page**

### Step 3: Test Voice Commands

Say these commands clearly:
- **"Spotify"** → Should navigate to Spotify page
- **"Home"** → Should navigate back to home page

You should see in console:
```
Voice command detected: spotify
Navigating to Spotify page
```

## Common Issues

### Issue: "Voice Off - Refresh page" Shows Red
**Cause**: Voice recognition failed to start

**Solutions**:
1. **Refresh the page** (Ctrl+R or F5)
2. **Check microphone permissions** (see Step 2 above)
3. **Use Chrome or Edge** (Firefox doesn't support Web Speech API)
4. Check if **HTTPS** is required (some browsers block mic on HTTP)

### Issue: Voice indicator is green but commands don't work
**Cause**: Commands not being recognized

**Solutions**:
1. Speak **louder and clearer**
2. Say exact words: **"SPOT-ih-fy"** or **"HOME"**
3. Check console for "Voice command detected" messages
4. Make sure microphone is not muted
5. Test microphone works in other apps first

### Issue: Page indicators not visible
**Cause**: Positioned off-screen

**Current position**: `bottom: 150px`

**To adjust**: Edit `/home/smartmirror/Downloads/smart-mirror/display/src/App.css`
```css
.page-indicator {
  bottom: 150px; /* Change this value */
}
```

Try values:
- `200px` - Higher up
- `100px` - Lower down
- `50%` - Middle of screen

### Issue: Can't see voice indicator at top
**Cause**: Positioned off-screen

**Current position**: `top: 20px`

**To adjust**: Edit same CSS file:
```css
.voice-listening-indicator {
  top: 20px; /* Change this value */
}
```

## Browser Console Commands

Open console (F12) and run these to debug:

### Check if speech recognition exists:
```javascript
console.log('SpeechRecognition:', 'webkitSpeechRecognition' in window);
```

### Manually test voice command:
```javascript
// This should trigger navigation
setCurrentPage('spotify');
```

### Check current page:
```javascript
console.log(document.querySelector('.page-dot.active'));
```

## Voice Command Reference (Updated)

### Navigation (works from any page):
- "Spotify" → Go to Spotify
- "Play music" → Go to Spotify
- "Home" → Go to home
- "Back" → Go to home

### Playback (only on Spotify page):
- "Play" → Resume
- "Pause" / "Stop" → Pause
- "Next" / "Skip" → Next track
- "Previous" → Previous track
- "Volume up" → 80%
- "Volume down" → 30%
- "Volume 50" → 50% (any number)

## Quick Test Procedure

1. **Refresh display page**
2. **Check top of screen**: Green pulsing = good, Red = bad
3. **Open console (F12)**: Look for "🎤 Voice recognition started"
4. **Say "Spotify"**: Should see "Voice command detected: spotify"
5. **Check bottom of screen**: Right dot should be active
6. **Say "Home"**: Should see "Voice command detected: home"
7. **Check bottom**: Left dot should be active

## If All Else Fails

### Hard Reset:
```bash
cd /home/smartmirror/Downloads/smart-mirror
docker compose down
docker compose up -d
```

### Rebuild everything:
```bash
cd /home/smartmirror/Downloads/smart-mirror
docker compose up -d --build
```

### Check logs:
```bash
docker logs smart-mirror-display
```

### Access from different device:
Try opening `http://100.89.218.111:3000` from:
- Your laptop (with Chrome)
- Your phone (with Chrome)
- Different browser

### Test microphone separately:
Go to https://www.google.com and click the microphone icon in search box. If that works, voice should work on mirror too.

## Debugging Tips

The voice recognition system:
- Runs **continuously** in background
- Auto-restarts if it stops
- Logs every command to console
- Should show green indicator when listening
- Only works in **Chrome/Edge** (not Firefox/Safari)

If you see the green indicator but commands don't work:
1. The mic is working
2. Recognition is running
3. Problem is with **command matching**
4. Try saying commands **more clearly**
5. Check console to see what it heard vs what you said
