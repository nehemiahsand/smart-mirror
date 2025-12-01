# Smart Mirror - Docker Setup

## Quick Start

Start all services:
```bash
docker-compose up -d
```

Stop all services:
```bash
docker-compose down
```

View logs:
```bash
docker-compose logs -f
```

## Services

- **Backend** - Port 3001 - Node.js API server
- **Display** - Port 3000 - Vite React mirror display
- **PWA** - Port 3002 - Progressive Web App control panel
- **Sensor** - Port 5555 - DHT22 temperature/humidity sensor

## URLs

- Mirror Display: http://192.168.1.85:3000
- Backend API: http://192.168.1.85:3001
- PWA Control Panel: http://192.168.1.85:3002

## Development

Rebuild after code changes:
```bash
docker-compose up -d --build
```

Restart a specific service:
```bash
docker-compose restart backend
```

View service status:
```bash
docker-compose ps
```

## Notes

- Sensor container runs in privileged mode to access GPIO
- Backend data persists in `./backend/data` volume
- All services auto-restart unless stopped manually
