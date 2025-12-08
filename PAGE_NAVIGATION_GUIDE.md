# Smart Mirror Page Navigation Guide

## Page Indicator System

Your smart mirror now uses a **page indicator** system at the bottom of the screen, similar to iOS home screen dots.

### Visual Reference

```
┌─────────────────────────────────────┐
│                                     │
│         HOME PAGE CONTENT           │
│    (Time, Weather, Calendar, etc)   │
│                                     │
│                                     │
└─────────────────────────────────────┘
            ●  ○  ← Page dots
         (Home) (Spotify)
```

When you say "Spotify":
```
┌─────────────────────────────────────┐
│                                     │
│       SPOTIFY PLAYER CONTENT        │
│      (Album art, track info)        │
│                                     │
│                                     │
└─────────────────────────────────────┘
            ○  ●  ← Page dots
         (Home) (Spotify)
```

## Page Indicators Explained

### Visual States

**Inactive dot**: `○` - Small, dim white circle (12px)
**Active dot**: `━` - Larger, bright pill shape (30px wide)

### Position
- **Fixed** at bottom center of screen
- **30px** from bottom edge
- Inside a **semi-transparent dark container** with blur effect
- **Always visible** regardless of which page you're on

### Page 1 - Home (Left Dot)
**Content:**
- Time & Date widget
- Weather widget
- Temperature (from DHT22 sensor)
- Google Calendar
- Photo slideshow

**How to get there:**
- Say **"Home"** from any page
- Default page when mirror starts

### Page 2 - Spotify (Right Dot)
**Content:**
- Album artwork (large square)
- Song title and artist name
- Progress bar with timestamps
- Playback status (Playing/Paused)
- Volume level bar
- Voice command hints

**How to get there:**
- Say **"Spotify"** from any page
- Say **"Play music"** from any page

## Voice Command Reference

### Navigation
| Command | Action |
|---------|--------|
| "Spotify" | Go to Spotify page |
| "Play music" | Go to Spotify page |
| "Home" | Return to home page |
| "Back" | Return to home page |

### Playback (Spotify page only)
| Command | Action |
|---------|--------|
| "Play" | Resume playback |
| "Pause" | Pause playback |
| "Stop" | Pause playback |
| "Next" | Skip to next track |
| "Skip" | Skip to next track |
| "Previous" | Go to previous track |
| "Volume up" | Set volume to 80% |
| "Volume down" | Set volume to 30% |
| "Volume 50" | Set volume to 50% |

## Design Philosophy

### Why No Buttons?
Since your Pi has:
- ❌ No mouse
- ❌ No keyboard  
- ❌ No touchscreen

All controls are **voice-activated**. The page indicators are purely **visual feedback** to show:
1. How many pages exist (2 dots = 2 pages)
2. Which page you're currently viewing (highlighted dot)
3. Your position in the navigation flow

### Reference Implementation
Inspired by:
- [MMM-page-indicator](https://github.com/edward-shen/MMM-page-indicator) - Dot-based page navigation
- [MMM-pages](https://github.com/edward-shen/MMM-pages) - Multi-page MagicMirror module
- [MMM-OnSpotify](https://github.com/Fabrizz/MMM-OnSpotify) - Spotify integration for MagicMirror

### CSS Styling

The page indicators use:
- **Semi-transparent background**: `rgba(0, 0, 0, 0.3)`
- **Backdrop blur**: `blur(10px)` for glassmorphism effect
- **Smooth transitions**: 300ms ease animation
- **Responsive sizing**: Active dot expands from 12px → 30px width
- **Glow effect**: Active dot has white shadow for visibility

## Troubleshooting

### Can't see page indicators?
- Check if display is in fullscreen mode
- Verify both containers are running: `docker ps`
- Check browser console for errors

### Voice commands not working?
- Make sure you're using Chrome/Edge (not Firefox)
- Check microphone permissions in browser
- Look for green "Listening..." indicator at top

### Page doesn't change with voice command?
- Check browser console for voice recognition logs
- Speak clearly: "SPOT-ih-fy" or "HOME"
- Try alternative commands: "Play music" instead of "Spotify"

### Indicators show wrong page?
- Refresh the display page
- Check if JavaScript errors in console
- Verify React state management is working

## Future Enhancements

Potential additions:
- More pages (page 3, 4, etc.)
- Swipe gestures (if touchscreen added later)
- Keyboard shortcuts (if keyboard added)
- Auto-rotation between pages
- Page names displayed on hover
- Vertical page indicator (left side)
- Animated page transitions

## Technical Details

### State Management
```javascript
const [currentPage, setCurrentPage] = useState('home');
```

### Page Detection
```javascript
<div className={`page-dot ${currentPage === 'home' ? 'active' : ''}`} />
<div className={`page-dot ${currentPage === 'spotify' ? 'active' : ''}`} />
```

### Voice Navigation
```javascript
if (command.includes('spotify') || command.includes('play music')) {
    setCurrentPage('spotify');
} else if (command.includes('home') || command.includes('back')) {
    setCurrentPage('home');
}
```

The page indicator automatically updates when `currentPage` state changes.
