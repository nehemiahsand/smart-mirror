# NBA Scores Widget Setup

## Overview
The NBA widget displays live NBA game scores for teams you follow. It shows:
- Team logos, names, and records
- Live scores and game status
- Quarter/period information
- Game broadcasts
- Winner highlighting

## Features
- **Live Updates**: Scores refresh every 2 minutes
- **Team Filtering**: Show only your favorite teams
- **Game Status**: Pre-game times, live scores with quarter, final scores
- **Visual Indicators**: 
  - Red border for live games (with pulsing animation)
  - Gray border for final games
  - Blue border for upcoming games
  - Bold text for winning teams

## Configuration

### Settings Location
Edit `/backend/data/settings.json`:

```json
{
  "nba": {
    "enabled": true,
    "teams": ["ORL"]
  },
  "widgets": {
    "nba": true
  }
}
```

### Team Codes
Use official NBA team abbreviations:

**Eastern Conference:**
- ATL - Atlanta Hawks
- BOS - Boston Celtics
- BKN - Brooklyn Nets
- CHA - Charlotte Hornets
- CHI - Chicago Bulls
- CLE - Cleveland Cavaliers
- DET - Detroit Pistons
- IND - Indiana Pacers
- MIA - Miami Heat
- MIL - Milwaukee Bucks
- NY - New York Knicks
- ORL - Orlando Magic
- PHI - Philadelphia 76ers
- TOR - Toronto Raptors
- WSH - Washington Wizards

**Western Conference:**
- DAL - Dallas Mavericks
- DEN - Denver Nuggets
- GS - Golden State Warriors
- HOU - Houston Rockets
- LAC - Los Angeles Clippers
- LAL - Los Angeles Lakers
- MEM - Memphis Grizzlies
- MIN - Minnesota Timberwolves
- NO - New Orleans Pelicans
- OKC - Oklahoma City Thunder
- PHX - Phoenix Suns
- POR - Portland Trail Blazers
- SAC - Sacramento Kings
- SA - San Antonio Spurs
- UTAH - Utah Jazz

### Examples

**Follow multiple teams:**
```json
"nba": {
  "enabled": true,
  "teams": ["ORL", "BOS", "LAL"]
}
```

**Show all NBA games (leave teams empty):**
```json
"nba": {
  "enabled": true,
  "teams": []
}
```

**Disable the widget:**
```json
"nba": {
  "enabled": false,
  "teams": ["ORL"]
},
"widgets": {
  "nba": false
}
```

## API Details

### Data Source
- **Provider**: ESPN Scoreboard API
- **Endpoint**: `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`
- **Update Frequency**: 2 minutes
- **Cache**: 2 minutes server-side

### API Routes

**Get NBA Scores:**
```
GET http://localhost:3001/api/nba/scores
GET http://localhost:3001/api/nba/scores?teams=ORL,BOS
```

**Clear Cache:**
```
POST http://localhost:3001/api/nba/clear-cache
```

## Layout

The NBA widget displays beside the Google Calendar widget in a horizontal layout:

```
┌─────────────────────────────────────────┐
│          Time & Date Widget             │
├─────────────────┬───────────────────────┤
│                 │                       │
│  Google Calendar│    NBA Scores         │
│                 │                       │
├─────────────────┴───────────────────────┤
│       Weather & Traffic Widget          │
└─────────────────────────────────────────┘
```

On smaller screens, it stacks vertically.

## Game Status Examples

### Pre-Game
```
ORL vs BOS
7:30 PM
ESPN, TNT
```

### Live Game
```
ORL 95  (Winner in bold)
BOS 92
5:34 2nd Quarter
ESPN
```

### Final Game
```
ORL 112  (Winner in bold)
BOS 108
FINAL
```

### Overtime
```
ORL 118
BOS 115
FINAL OT
```

## Customization

### Change Update Frequency
Edit `/display/src/widgets/NBAScores.jsx`:
```javascript
const interval = setInterval(fetchNBAScores, 5 * 60 * 1000); // 5 minutes
```

### Adjust Widget Width
Edit `/display/src/App.css`:
```css
.nba-widget {
  max-width: 600px; /* Default: 500px */
}
```

### Modify Cache Duration
Edit `/backend/src/services/nba.js`:
```javascript
this.cacheTimeout = 5 * 60 * 1000; // 5 minutes (default: 2 minutes)
```

## Troubleshooting

### Widget Not Showing
1. Check settings.json has `"nba": true` in widgets
2. Verify `nba.enabled: true`
3. Restart containers: `docker compose restart backend display`

### No Games Displayed
- Check if it's game day (NBA season runs October - June)
- Verify team codes are correct
- Check browser console for errors
- Test API directly: `curl http://localhost:3001/api/nba/scores`

### Scores Not Updating
1. Clear cache: `curl -X POST http://localhost:3001/api/nba/clear-cache`
2. Check backend logs: `docker compose logs backend`
3. Verify network connectivity

## Technical Notes

Based on the MMM-MyScoreboard module structure:
- Uses ESPN's free Scoreboard API (no API key required)
- Respects rate limits with 2-minute caching
- Filters games by team abbreviations
- Handles overtime, playoff games, and special status

## Future Enhancements

Possible additions:
- Playoff series status
- Player stats (top scorers)
- Game highlights/play-by-play
- Favorite team highlighting
- Score notifications via voice
- Historical game results
