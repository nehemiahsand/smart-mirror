# Replace Fun Page With Weather and Sports Pages

## Summary
Change the mirror page set from `home / fun / spotify` to `home / weather / sports / spotify`.

`home` stays visually and behaviorally the same. The old Fun page is removed from the display flow. Its sun/moon widgets move to a new Weather page, and its Golden State recap/highlights widget moves to a new Sports page. Bible Clock and comic content are removed from the active mirror UI for now, but the underlying services can stay in the codebase unused to keep this refactor scoped.

## Key Changes
- Page model and navigation
  - Update all display/page allowlists, page indicators, cycle order, and admin page buttons to `home`, `weather`, `sports`, `spotify`.
  - Backend console/page normalization should introduce canonical `weather` and `sports` pages.
  - Keep a temporary legacy alias so inbound `fun` requests normalize to `sports` until every surface is updated.

- Display app
  - Add a dedicated `WeatherPage` component:
    - top time/date section
    - sun widget from current Fun page
    - moon widget from current Fun page
    - daily weather card showing current, high, low, icon/conditions
    - hourly weather strip showing the next 8 true hourly entries with hour label, temp, and conditions/icon
  - Add a dedicated `SportsPage` component:
    - top time/date section
    - Warriors-only recap/highlights panel reused from the current Fun page
    - preserve existing GameScoreBar / box score behavior already used by the Warriors highlight feed
  - Remove the old `FunPage` from page routing and page indicator flow.

- Backend data and page payloads
  - Extend the weather page payload so it is display-ready instead of console-tab-oriented:
    - `sun`
    - `moon`
    - `dailySummary` for today
    - `hourly` as the next 8 true hourly forecast entries
  - Upgrade weather sourcing so "hourly" comes from real One Call hourly data, not the current 3-hour forecast list.
  - Add a `sports` console page payload that exposes the current Warriors recap/highlights feed now returned by the old Fun page.
  - Update WebSocket and display-page broadcast allowlists to include `weather` and `sports`.

- PWA/admin surfaces
  - Update Dashboard page labels and quick actions to `Home`, `Weather`, `Sports`, `Spotify`.
  - Update Widget Manager so it no longer exposes `Fun Page`.
  - Keep widget ordering configurable for `home` only in this change; `weather` and `sports` use fixed layouts and do not add new settings keys.
  - Update any remaining copy that still references the Fun page.

## Public Interfaces
- Display page identifiers change from `home / fun / spotify` to `home / weather / sports / spotify`.
- Backend page normalization should accept legacy `fun` and map it to `sports` during the transition.
- Weather page data becomes a richer payload with `sun`, `moon`, `dailySummary`, and true-hourly `hourly` entries intended for the display UI.

## Test Plan
- Backend
  - Verify `/api/display/page` accepts `weather` and `sports`.
  - Verify legacy `fun` page requests normalize to `sports`.
  - Add/update tests for console page payload generation for `weather` and `sports`.
  - Add/update tests for hourly weather shaping from the One Call response.

- Frontend
  - Build `display` and `mobile-pwa`.
  - Smoke test page cycling order: `home -> weather -> sports -> spotify`.
  - Smoke test Dashboard page buttons and any PWA labels.
  - Smoke test Weather page with missing weather data so empty/fallback states still render cleanly.
  - Smoke test Sports page when Warriors recap/highlights are unavailable so the existing unavailable state still shows correctly.

## Assumptions
- `home` remains unchanged, including its existing compact weather and sports content.
- The old Fun page is removed from active use; Bible Clock and comic content are not migrated elsewhere in this change.
- The new Sports page is Warriors-only for now, with room to add other favorite teams later.
- The Weather page shows the next 8 true hourly forecast entries by default.
