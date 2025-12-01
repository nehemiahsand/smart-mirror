# 🚀 Smart Mirror Setup Instructions

Your Raspberry Pi IP: **192.168.1.85**  
Tailscale VPN IP: **100.120.146.19**

## Remote Access via Tailscale

This smart mirror uses **Tailscale VPN** for secure remote access from anywhere.

### Accessing the Mirror Remotely:
- **PWA (Mobile Web App):** http://100.120.146.19:3002
- **Display UI:** http://100.120.146.19:3000
- **Backend API:** http://100.120.146.19:3001

### On Local Network:
- **PWA:** http://192.168.1.85:3002 or http://nehemiah-pi5.local:3002
- **Display UI:** http://192.168.1.85:3000
- **Backend API:** http://192.168.1.85:3001

### When Connected to Hotspot:
- **PWA:** http://10.42.0.1:3002
- **Display UI:** http://10.42.0.1:3000
- **Backend API:** http://10.42.0.1:3001

**Note:** Tailscale runs automatically on boot and keeps the Pi accessible from anywhere.

## Pre-Launch Checklist

### 1. Get OpenWeather API Key (Required)
1. Go to https://openweathermap.org/api
2. Sign up for a free account
3. Go to "API keys" section
4. Copy your API key

### 2. Install Dependencies

#### Backend:
```bash
cd /home/smartmirror/Downloads/smart-mirror/backend
npm install
```

#### Display:
```bash
cd /home/smartmirror/Downloads/smart-mirror/display
npm install
```

### 3. Configure Environment Variables

#### Backend (.env):
```bash
cd /home/smartmirror/Downloads/smart-mirror/backend
cp .env.example .env
nano .env
```

Edit the following:
- `OPENWEATHER_API_KEY=` (paste your API key here)
- Keep other defaults or adjust as needed

#### Display (.env):
```bash
cd /home/smartmirror/Downloads/smart-mirror/display
cp .env.example .env
nano .env
```

Edit:
- `VITE_WS_URL=ws://192.168.1.85:3001` (use your Pi's IP)

### 4. Start the Application

#### Terminal 1 - Backend:
```bash
cd /home/smartmirror/Downloads/smart-mirror/backend
npm start
```

#### Terminal 2 - Display:
```bash
cd /home/smartmirror/Downloads/smart-mirror/display
npm start
```

### 5. Access the Mirror

Open browser on any device in your network:
- **Display UI:** http://192.168.1.85:5173
- **Backend API:** http://192.168.1.85:3001/api/health

### 6. Test Drag & Drop Editor

1. Open the display UI
2. Press **Ctrl + E** to enter layout editor
3. Drag widgets around
4. Click **Save**
5. Watch the live preview update via WebSocket!

## Quick Commands

### One-line setup:
```bash
# Backend
cd /home/smartmirror/Downloads/smart-mirror/backend && npm install && cp .env.example .env

# Display
cd /home/smartmirror/Downloads/smart-mirror/display && npm install && cp .env.example .env
```

### Check if running:
```bash
# Backend
curl http://localhost:3001/api/health

# Display
curl http://localhost:5173
```

### Stop everything:
```bash
# Press Ctrl+C in each terminal
```

## Troubleshooting

**Backend won't start:**
- Check if port 3001 is available: `lsof -i :3001`
- Verify .env file exists and has API key
- Check logs for errors

**Display won't connect to backend:**
- Verify backend is running
- Check VITE_WS_URL in display/.env
- Test WebSocket: `curl http://192.168.1.85:3001/api/health`

**DHT22 sensor errors:**
- Normal if you don't have the sensor connected
- Backend will still work, just shows "N/A" for temperature

**OpenWeather API errors:**
- Verify API key is correct
- Check if you've exceeded free tier limits (60 calls/minute)
- Wait a few minutes for API key to activate (new accounts)

