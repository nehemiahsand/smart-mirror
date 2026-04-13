# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Express API, WebSocket hub, scene/console services, and Jest tests in `backend/__tests__/`.
- `display/`: mirror UI built with React/Vite; source lives in `display/src/`.
- `mobile-pwa/`: admin/mobile React app; source lives in `mobile-pwa/src/`.
- `camera/`, `mosquitto/`, `deploy/systemd/`: sidecar services and Pi startup/update units.
- `esp32-console/`: ESP32 firmware and hardware-specific docs.
- Runtime data and secrets are local-only: `backend/.env`, `backend/data/`, `esp32-console/include/config.local.h`.

## Build, Test, and Development Commands
- `docker compose up -d --build`: build and start the full stack locally.
- `docker compose ps`: check container health and status.
- `cd backend && npm test`: run backend Jest tests.
- `cd backend && npm run dev`: run the API with `nodemon`.
- `cd display && npm run dev`: run the mirror UI in Vite dev mode.
- `cd display && npm run build`: build the display bundle.
- `cd mobile-pwa && npm run build`: build the admin PWA bundle.
- `./scripts/security-smoke-test.sh`: run the repo’s security smoke checks.

## Coding Style & Naming Conventions
- Follow existing style by area: backend uses CommonJS and mostly 2-space indentation; React apps use ES modules and 4-space indentation.
- Use `camelCase` for variables/functions, `PascalCase` for React components, and kebab-case for filenames like `layout-routes.js`.
- Keep modules focused: API routes in `backend/src/api`, services in `backend/src/services`, UI pages in `mobile-pwa/src/pages`.
- No repo-wide formatter is enforced; match surrounding code before changing style.

## Testing Guidelines
- Backend tests use Jest with files named `*.test.js` in `backend/__tests__/`.
- Add or update tests when changing auth, API behavior, scene logic, or settings flows.
- For UI or Docker changes, pair a build check with a manual smoke test against `/api/health`, `/api/camera/status`, or the relevant page.

## Commit & Pull Request Guidelines
- Recent commits use short imperative subjects: `Fix ...`, `Update ...`, `Remove ...`, `Polish ...`.
- Keep commits scoped to one concern; avoid mixing backend, firmware, and UI churn unless the change is cross-cutting.
- PRs should include a concise summary, affected surfaces (`backend`, `display`, `mobile-pwa`, `esp32-console`), verification steps, and screenshots for visible UI changes.

## Security & Configuration Tips
- Never commit `.env`, tokens, OAuth secrets, or generated local config.
- Treat `backend/data/` as runtime state, not source.
- The Pi updater in `deploy/systemd/` is fast-forward-only; test deployment-related edits carefully before enabling the timer.
