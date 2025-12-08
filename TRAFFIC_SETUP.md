# Traffic Widget Setup Guide

## Overview
The traffic widget shows your drive time to school with live traffic data and ETA.

## Configuration Steps

### 1. Get Google Maps API Key
1. Go to https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Enable the **Directions API**
4. Go to Credentials and create an API key
5. (Optional) Restrict the API key to Directions API only

### 2. Configure Settings
Edit `/home/smartmirror/Downloads/smart-mirror/backend/data/settings.json`:

```json
{
  "traffic": {
    "enabled": true,
    "origin": "Your Home Address",
    "destination": "School Address", 
    "googleMapsApiKey": "YOUR_API_KEY_HERE"
  },
  "widgets": {
    "traffic": true
  },
  "widgetOrder": [
    "timedate",
    "weathertemp",
    "traffic",
    "googlecalendar",
    "photos"
  ]
}
```

### 3. Address Formats
You can use any of these formats:
- **Full address**: `"1600 Amphitheatre Parkway, Mountain View, CA"`
- **Coordinates**: `"37.4224764,-122.0842499"`
- **Place name**: `"Birmingham High School, Birmingham, AL"`

### 4. Restart Backend
```bash
cd /home/smartmirror/Downloads/smart-mirror
docker compose restart backend
```

### 5. Verify Widget
The widget should now appear on your display showing:
- Drive time in minutes
- Distance
- Traffic conditions (Light/Moderate/Heavy)
- Estimated arrival time

## Features
- Updates every 5 minutes with live traffic data
- Shows traffic conditions with color coding:
  - 🟢 Green = Light traffic
  - 🟡 Yellow = Moderate traffic
  - 🔴 Red = Heavy traffic
- Displays estimated arrival time
- Uses cached data if API temporarily unavailable

## API Usage
- Free tier: 40,000 requests/month
- Widget updates: Every 5 minutes = ~8,640 requests/month
- Well within free tier limits

## Troubleshooting
- Check backend logs: `docker compose logs backend --tail 50`
- Verify API key is correct in settings.json
- Ensure Directions API is enabled in Google Cloud Console
- Check that addresses are valid and recognized by Google Maps
