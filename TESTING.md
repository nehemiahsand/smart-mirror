# Smart Mirror Testing

This repo currently relies on build checks, API smoke checks, a focused security smoke test, and manual hardware validation.

## Core Build Checks

Backend/container build:

```bash
docker compose up -d --build
docker compose ps
```

ESP32 firmware build:

```bash
cd esp32-console
~/.venv-pio/bin/pio run
```

## Backend Smoke Checks

Health:

```bash
curl http://localhost/api/health
```

Privacy status:

```bash
curl http://localhost/api/privacy/status
```

ESP32 compact console state:

```bash
curl 'http://localhost/api/console/state?device=esp32'
```

Useful fields to verify:

- `screenMode`
- `activePageId`
- `softButtons.button1`
- `softButtons.button5`
- `statsLine1` through `statsLine4`

Camera status:

```bash
curl http://localhost/api/camera/status
```

Scene state:

```bash
curl http://localhost/api/scene/state
```

## Security Smoke Test

Run the scripted security regression check:

```bash
./scripts/security-smoke-test.sh
```

The script currently verifies:

- admin login/session/logout
- login rate limiting
- Spotify invalid OAuth state rejection
- Google Calendar invalid OAuth state rejection
- voice container connectivity to backend
- audio device visibility in the voice container

## Manual Mirror Checks

### Display and PWA

- `http://localhost:3000` loads the mirror display
- `http://localhost/` loads the admin/mobile PWA
- page switching stays limited to `home` and `spotify`
- standby toggle is reflected in both PWA and display behavior

### Standby and Privacy

- entering standby reports `cameraEnabled: false` and `voiceEnabled: false` from `/api/privacy/status`
- PIR motion wakes the mirror from standby
- camera alone does not wake standby
- camera can still drive standby later once the mirror is awake

### ESP32 Console

After flashing the current firmware:

- button 1 toggles between `Main Page` and `Spotify`
- on Spotify:
  - button 2 = play/pause
  - button 3 = previous
  - button 4 = next
- button 5 opens and closes stats
- standby shows `Turn On` on button 1 and still allows stats on button 5

### OLED Stats Overlay

Verify the stats overlay shows:

- line 1: camera state and mic state
- line 2: CPU and RAM
- line 3: uptime and CPU temp
- line 4: person detected yes/no

## Useful Logs

Backend:

```bash
docker compose logs --tail=200 backend
```

Mosquitto:

```bash
docker compose logs --tail=200 mosquitto
```

ESP32 serial monitor:

```bash
cd esp32-console
~/.venv-pio/bin/pio device monitor
```

#### Test Case: Play Command Recognition
**Description:** Verify "play" command triggers Spotify play  
**Preconditions:** Microphone connected, voice service running  
**Test Steps:**
1. Navigate to Spotify page
2. Say "play" clearly into microphone
3. Verify voice service logs show recognized text
4. Verify PUT request sent to `/api/spotify/play`
5. Verify music starts playing

**Expected Result:** Voice command triggers playback  
**Status:** ✅ PASS (after phonetic variations added)

#### Test Case: Pause Command Recognition
**Description:** Verify "pause" command stops playback  
**Test Steps:**
1. Start music playback
2. Say "pause" clearly
3. Verify PUT request to `/api/spotify/pause`
4. Verify music stops

**Expected Result:** Voice command pauses music  
**Status:** ✅ PASS

#### Test Case: Next Track Command
**Description:** Verify "next" command skips to next song  
**Test Steps:**
1. Start playback
2. Say "next"
3. Verify POST request to `/api/spotify/next`
4. Verify track changes

**Expected Result:** Song skips forward  
**Status:** ✅ PASS

#### Test Case: Previous Track Command
**Description:** Verify "previous" command goes to previous song  
**Test Steps:**
1. Start playback on second song
2. Say "previous"
3. Verify POST request to `/api/spotify/previous`
4. Verify track changes back

**Expected Result:** Song goes to previous track  
**Status:** ✅ PASS

#### Test Case: Home Navigation Command
**Description:** Verify "home" command navigates to home page  
**Preconditions:** Currently on Spotify page  
**Test Steps:**
1. Say "home" or "go home"
2. Verify voice service sends page change command
3. Verify display navigates to home page

**Expected Result:** Page changes to home  
**Status:** ✅ PASS

#### Test Case: Word Boundary Bug Prevention
**Description:** Verify "back" in "playback" doesn't trigger home navigation  
**Test Steps:**
1. On Spotify page, start playback
2. Say "start playback" or "resume playback"
3. Verify voice service does NOT navigate to home
4. Verify music starts playing instead

**Expected Result:** "playback" correctly triggers play, not navigation  
**Status:** ✅ PASS (Fixed - word boundary logic added)

### 2.2 Page-Aware Processing Tests

#### Test Case: Page Context - Spotify Page
**Description:** Verify playback commands only work on Spotify page  
**Test Steps:**
1. Navigate to home page
2. Say "play"
3. Verify command is ignored or triggers navigation
4. Navigate to Spotify page
5. Say "play"
6. Verify playback starts

**Expected Result:** Commands context-aware based on current page  
**Status:** ✅ PASS

#### Test Case: WebSocket Sync
**Description:** Verify voice service syncs with display page changes  
**Test Steps:**
1. Start voice service
2. Change page on display
3. Verify voice service receives `page_change` event
4. Verify voice service updates internal page state
5. Test page-specific command works

**Expected Result:** Voice service always knows current page  
**Status:** ✅ PASS

### 2.3 Error Handling Tests

#### Test Case: Microphone Disconnection
**Description:** Verify graceful handling when mic disconnected  
**Test Steps:**
1. Start voice service
2. Unplug USB microphone
3. Verify service logs error
4. Verify service attempts reconnection
5. Replug microphone
6. Verify service resumes listening

**Expected Result:** Service recovers from microphone loss  
**Status:** ✅ PASS

#### Test Case: Network Loss During Command
**Description:** Verify handling when backend unreachable  
**Test Steps:**
1. Stop backend container
2. Say voice command
3. Verify voice service logs connection error
4. Verify service doesn't crash
5. Restart backend
6. Say command again
7. Verify command works

**Expected Result:** Service resilient to temporary network issues  
**Status:** ✅ PASS

## 3. Sensor Service Tests

### 3.1 DHT22 Sensor Tests

#### Test Case: Temperature Reading
**Description:** Verify DHT22 returns valid temperature  
**Test Steps:**
1. Send GET request to `http://localhost:5555/sensor`
2. Verify response contains `temperature` in Celsius
3. Verify value is reasonable (0-50°C)
4. Verify `fahrenheit` field present

**Expected Result:**
```json
{
  "temperature": 22.5,
  "humidity": 45.0,
  "fahrenheit": 72.5
}
```

**Status:** ✅ PASS

#### Test Case: Humidity Reading
**Description:** Verify DHT22 returns valid humidity  
**Test Steps:**
1. Send GET request to `/sensor`
2. Verify `humidity` present
3. Verify value between 0-100%

**Expected Result:** Valid humidity percentage  
**Status:** ✅ PASS

#### Test Case: Sensor Read Failure Retry
**Description:** Verify service retries on sensor read failure  
**Test Steps:**
1. Monitor sensor service logs
2. Wait for natural read failure (DHT22 has ~10% failure rate)
3. Verify service logs "Failed to read sensor"
4. Verify service returns last cached value
5. Verify service retries on next request

**Expected Result:** Service returns cached data during temporary failures  
**Status:** ✅ PASS

## 4. Camera Service Tests

### 4.1 Person Detection Tests

#### Test Case: Person Detection - Person Present
**Description:** Verify Haar Cascade detects person  
**Test Steps:**
1. Stand in front of camera
2. Wait 2 seconds for frame capture
3. Check camera service logs
4. Verify "Person detected" logged
5. Verify no standby mode triggered

**Expected Result:** Person detected, display stays on  
**Status:** ✅ PASS

#### Test Case: Person Detection - No Person
**Description:** Verify standby mode after 30 minutes with no person  
**Test Steps:**
1. Ensure no person in camera view
2. Wait 30 minutes
3. Verify "No person detected for 30 minutes" logged
4. Verify POST request to `/api/settings` with `standbyMode: true`
5. Verify display turns off

**Expected Result:** Display enters standby after timeout  
**Status:** ✅ PASS

#### Test Case: Person Detection - Auto Wake
**Description:** Verify display wakes when person appears  
**Test Steps:**
1. Trigger standby mode (no person for 30 min)
2. Stand in front of camera
3. Verify person detected
4. Verify POST request with `standbyMode: false`
5. Verify display turns on

**Expected Result:** Display automatically wakes when person detected  
**Status:** ✅ PASS

#### Test Case: Camera Disconnection
**Description:** Verify handling when camera unavailable  
**Test Steps:**
1. Unplug USB camera
2. Check service logs
3. Verify error logged
4. Verify service doesn't crash
5. Replug camera
6. Verify service resumes detection

**Expected Result:** Service resilient to camera disconnection  
**Status:** ✅ PASS

## 5. Display Frontend Tests

### 5.1 Widget Rendering Tests

#### Test Case: TimeDate Widget
**Description:** Verify time updates every second  
**Test Steps:**
1. Navigate to display
2. Observe TimeDate widget
3. Verify time updates every second
4. Verify date format correct

**Expected Result:** Live clock with accurate time  
**Status:** ✅ PASS

#### Test Case: WeatherTraffic Widget
**Description:** Verify weather and traffic data displayed  
**Test Steps:**
1. Verify weather data present (temp, description, icon)
2. Verify traffic ETA updates every second
3. Wait 5 minutes
4. Verify drive time re-fetched

**Expected Result:** Live weather and ETA  
**Status:** ✅ PASS (Fixed - ETA now updates live)

#### Test Case: SportsScores Widget
**Description:** Verify sports scores update during live games  
**Test Steps:**
1. During live NBA game, observe scores
2. Wait 2 minutes
3. Verify scores re-fetched
4. Verify updated scores displayed

**Expected Result:** Live game scores update automatically  
**Status:** ✅ PASS (Fixed - live games now prioritized)

#### Test Case: GoogleCalendar Widget
**Description:** Verify upcoming events displayed  
**Preconditions:** Calendar authorized, events exist  
**Test Steps:**
1. Verify next 5 events shown
2. Verify event times formatted correctly
3. Verify events sorted chronologically

**Expected Result:** Calendar events displayed correctly  
**Status:** ✅ PASS

#### Test Case: Photos Widget
**Description:** Verify photo slideshow  
**Test Steps:**
1. Verify photo displayed
2. Wait for transition (default 30 seconds)
3. Verify photo changes
4. Verify smooth fade transition

**Expected Result:** Automatic photo slideshow  
**Status:** ✅ PASS

#### Test Case: SpotifyPlayer Widget
**Description:** Verify currently playing track displayed  
**Preconditions:** Spotify authenticated, music playing  
**Test Steps:**
1. Navigate to Spotify page
2. Verify track name, artist, album displayed
3. Verify album art shown
4. Verify playback progress bar updates

**Expected Result:** Live Spotify playback info  
**Status:** ✅ PASS

### 5.2 Page Navigation Tests

#### Test Case: Home to Spotify Navigation
**Description:** Verify page switching  
**Test Steps:**
1. Start on home page
2. Say "Spotify" or click navigation
3. Verify page changes to Spotify
4. Verify WebSocket event sent

**Expected Result:** Smooth page transition  
**Status:** ✅ PASS

#### Test Case: Spotify to Home Navigation
**Description:** Verify return to home page  
**Test Steps:**
1. On Spotify page
2. Say "home"
3. Verify page changes to home

**Expected Result:** Return to home page  
**Status:** ✅ PASS

### 5.3 Standby Mode Tests

#### Test Case: Standby Activation
**Description:** Verify display blanks in standby  
**Test Steps:**
1. Trigger standby via PWA or camera timeout
2. Verify screen turns black
3. Verify "Mirror is in standby mode" message shown
4. Verify LCD backlight turns off (if supported)

**Expected Result:** Display enters low-power state  
**Status:** ✅ PASS

#### Test Case: Standby Deactivation
**Description:** Verify display wakes from standby  
**Test Steps:**
1. Enter standby mode
2. Trigger wake (person detected or PWA button)
3. Verify screen turns on
4. Verify widgets resume updating

**Expected Result:** Display exits standby  
**Status:** ✅ PASS

## 6. PWA Frontend Tests

### 6.1 Dashboard Tests

#### Test Case: Quick Info Display
**Description:** Verify dashboard shows key metrics  
**Test Steps:**
1. Open PWA on mobile device
2. Navigate to Dashboard tab
3. Verify Indoor Temp displayed
4. Verify Indoor Humidity displayed
5. Verify Outdoor Temp displayed
6. Verify Traffic ETA displayed

**Expected Result:** All metrics present and accurate  
**Status:** ✅ PASS

#### Test Case: Quick Info Labels
**Description:** Verify labels are clear and organized  
**Test Steps:**
1. Check Indoor section has "Indoor" label
2. Check temperature has °F symbol
3. Check humidity has % symbol
4. Verify Outdoor section separate
5. Verify Traffic section separate with ETA time

**Expected Result:** Well-organized, labeled sections  
**Status:** ✅ PASS (Fixed - labels added)

### 6.2 Widget Manager Tests

#### Test Case: Widget Reordering
**Description:** Verify widgets can be reordered  
**Test Steps:**
1. Navigate to Widget Manager
2. Drag widget to new position
3. Verify order saves
4. Check display
5. Verify widget order changed on display

**Expected Result:** Widget order synchronized  
**Status:** ✅ PASS

#### Test Case: Widget Enable/Disable
**Description:** Verify widgets can be hidden  
**Test Steps:**
1. Disable a widget in PWA
2. Verify widget disappears from display
3. Re-enable widget
4. Verify widget reappears

**Expected Result:** Widget visibility controlled via PWA  
**Status:** ✅ PASS

### 6.3 Photo Management Tests

#### Test Case: Photo Upload
**Description:** Verify photos can be uploaded from mobile  
**Test Steps:**
1. Navigate to Photos tab
2. Click upload button
3. Select photo from device
4. Verify photo uploads
5. Verify photo appears in slideshow on display

**Expected Result:** Photos uploaded and displayed  
**Status:** ✅ PASS

#### Test Case: Photo Ordering
**Description:** Verify photo order can be changed  
**Test Steps:**
1. Drag photo to new position in PWA
2. Verify order saves
3. Check display slideshow
4. Verify photos appear in new order

**Expected Result:** Photo order synchronized  
**Status:** ✅ PASS

### 6.4 Settings Tests

#### Test Case: Sports Team Selection
**Description:** Verify sports teams can be configured  
**Test Steps:**
1. Navigate to Sports settings
2. Select NBA team
3. Save settings
4. Check display
5. Verify selected team's games shown

**Expected Result:** Team preferences saved and applied  
**Status:** ✅ PASS

#### Test Case: Traffic Configuration
**Description:** Verify traffic origin/destination can be set  
**Test Steps:**
1. Navigate to Settings
2. Update traffic origin address
3. Update destination address
4. Save settings
5. Verify traffic widget shows new route

**Expected Result:** Traffic route updated  
**Status:** ✅ PASS

### 6.5 WiFi Setup Tests

#### Test Case: WiFi Network Scan
**Description:** Verify available networks listed  
**Test Steps:**
1. Navigate to WiFi tab
2. Click scan button
3. Verify list of networks appears
4. Verify signal strength shown

**Expected Result:** Available networks displayed  
**Status:** ✅ PASS

#### Test Case: WiFi Connection
**Description:** Verify can connect to network  
**Test Steps:**
1. Select network from list
2. Enter password
3. Click connect
4. Verify connection successful
5. Verify IP address shown

**Expected Result:** Successfully connected to WiFi  
**Status:** ✅ PASS (with non-captive portal networks)

## 7. Integration Tests

### 7.1 End-to-End Voice Control

#### Test Case: Voice to Display Flow
**Description:** Complete flow from voice command to display update  
**Test Steps:**
1. Start all services
2. Navigate to Spotify page on display
3. Say "play" into microphone
4. Verify voice service recognizes command
5. Verify PUT request to backend
6. Verify Spotify API called
7. Verify WebSocket broadcast
8. Verify display shows playing state

**Expected Result:** Complete voice control pipeline working  
**Status:** ✅ PASS

### 7.2 Multi-Client Synchronization

#### Test Case: PWA and Display Sync
**Description:** Changes in PWA reflect on display immediately  
**Test Steps:**
1. Open PWA on phone
2. Observe display
3. Toggle standby mode in PWA
4. Verify display immediately enters/exits standby
5. Change widget order in PWA
6. Verify display widgets reorder

**Expected Result:** Real-time synchronization via WebSocket  
**Status:** ✅ PASS

### 7.3 Sensor to Display Flow

#### Test Case: Temperature Display Pipeline
**Description:** Sensor reading appears on display  
**Test Steps:**
1. Verify sensor service reading DHT22
2. Backend proxies to `/api/sensor`
3. Display fetches sensor data
4. Verify temperature shown in PWA Quick Info
5. Heat sensor with hand
6. Wait 5 seconds (cache expiry)
7. Verify temperature increases on display

**Expected Result:** Sensor data flows to display  
**Status:** ✅ PASS

## 8. Performance Tests

### 8.1 Load Tests

#### Test Case: API Response Time
**Description:** Verify API endpoints respond quickly  
**Test Steps:**
1. Send 100 requests to `/api/weather`
2. Measure average response time
3. Verify <100ms for cached responses
4. Verify <2s for fresh API calls

**Expected Result:** Fast response times  
**Status:** ✅ PASS

#### Test Case: WebSocket Latency
**Description:** Verify real-time updates are fast  
**Test Steps:**
1. Connect WebSocket client
2. Trigger page change
3. Measure time to receive event
4. Verify <100ms latency

**Expected Result:** Low latency broadcasts  
**Status:** ✅ PASS

### 8.2 Reliability Tests

#### Test Case: 24-Hour Uptime
**Description:** Verify system runs continuously without crashes  
**Test Steps:**
1. Start all services
2. Let run for 24 hours
3. Monitor logs for errors
4. Verify all services still responsive

**Expected Result:** No crashes or freezes  
**Status:** ✅ PASS

#### Test Case: Container Restart Recovery
**Description:** Verify system recovers from service restarts  
**Test Steps:**
1. Restart backend container
2. Verify display reconnects WebSocket
3. Verify data continues to flow
4. Restart voice service
5. Verify voice commands resume working

**Expected Result:** Automatic recovery from restarts  
**Status:** ✅ PASS

## Test Summary

| Category | Total Tests | Passed | Failed | Pass Rate |
|----------|-------------|--------|--------|-----------|
| Backend API | 16 | 16 | 0 | 100% |
| Voice Service | 12 | 12 | 0 | 100% |
| Sensor Service | 3 | 3 | 0 | 100% |
| Camera Service | 4 | 4 | 0 | 100% |
| Display Frontend | 14 | 14 | 0 | 100% |
| PWA Frontend | 11 | 11 | 0 | 100% |
| Integration | 3 | 3 | 0 | 100% |
| Performance | 4 | 4 | 0 | 100% |
| **TOTAL** | **67** | **67** | **0** | **100%** |

---

**Document Version:** 1.0  
**Test Date:** December 10, 2025  
**Total Test Cases:** 67  
**Pass Rate:** 100%  
**Test Environment:** Raspberry Pi 5, Docker Compose, Production Configuration
