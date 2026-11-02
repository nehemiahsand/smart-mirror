jest.mock('../src/services/teamGameRecaps', () => ({ SOURCES: { auburn: { channelId: 'auburn-channel' } }, fetchFeed: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../src/services/settings', () => ({ get: jest.fn() }));
jest.mock('../src/services/funVideo', () => ({ getCurrentFeed: jest.fn(async () => ({ items: [] })), buildFeed: jest.fn((feed, extra) => ({ ...feed, ...extra })) }));
jest.mock('../src/utils/runtimeStore', () => class { constructor() { this.value = {}; } read() { return this.value; } write(value) { this.value = value; } });
const axios = require('axios');
const settings = require('../src/services/settings');
const { SportsExperience, normalizeGame, TEAMS } = require('../src/services/sportsExperience');
const competitor = (id, score, homeAway) => ({ team: { id, abbreviation: id, displayName: id }, score, homeAway });
const event = (id, team, state = 'in') => ({ id, status: { type: { state }, period: 3, displayClock: '6:42' }, competitions: [{ competitors: [competitor(team, '0', 'home'), competitor('other', null, 'away')] }] });
beforeEach(() => { jest.clearAllMocks(); settings.get.mockReturnValue(undefined); });
it('preserves zero scores and unavailable readings, with sport-specific plays', () => {
  const game = normalizeGame(event('a', '2'), TEAMS.auburn, { drives: { previous: [{ plays: [{ id: 'p', text: 'Rush for six yards', clock: { displayValue: '6:42' } }] }] } });
  expect(game.home.score).toBe(0); expect(game.away.score).toBeNull(); expect(game.yardLine).toBeNull(); expect(game.recentPlays[0].text).toContain('Rush');
});
it('prioritizes Auburn over GSW, honors overrides and master-off setting', async () => {
  const service = new SportsExperience();
  const a = normalizeGame(event('a', '2'), TEAMS.auburn), g = normalizeGame(event('g', '9'), TEAMS.gsw);
  service.live = jest.fn(async () => ({ games: [g, a], failures: [], checkedAt: Date.now() }));
  expect((await service.getExperience({ includeHighlights: false })).tracker.id).toBe('a');
  await service.select({ mode: 'game', gameId: 'g' });
  expect((await service.getExperience({ includeHighlights: false })).tracker.id).toBe('g');
  await service.select({ mode: 'highlights' }); expect((await service.getExperience({ includeHighlights: false })).mode).toBe('highlights');
  await service.select({ mode: 'auto' });
  settings.get.mockImplementation((key) => key === 'sports.liveGames' ? false : undefined);
  expect((await service.getExperience({ includeHighlights: false })).tracker).toBeNull();
  await expect(service.select({ mode: 'game', gameId: 'untracked' })).rejects.toMatchObject({ status: 409 });
});
it('filters other teams, coalesces polling, and marks retained failures stale', async () => {
  const service = new SportsExperience();
  axios.get.mockImplementation(async (url) => ({ data: url.includes('scoreboard') ? { events: [event('a', '2'), event('other', '999')] } : { drives: { previous: [] } } }));
  const [a, b] = await Promise.all([service.live(), service.live()]);
  expect(a).toEqual(b); expect(a.games.map((g) => g.id)).toEqual(['a']);
  const calls = axios.get.mock.calls.length; await service.live(); expect(axios.get).toHaveBeenCalledTimes(calls);
  service.nextRefresh = 0; axios.get.mockRejectedValue(new Error('offline'));
  expect((await service.live()).games[0]).toMatchObject({ stale: true, id: 'a' });
});
it('expires a pinned game when authoritative data says it ended, but not on feed failures', async () => {
  const service = new SportsExperience(); service.override = { mode: 'game', gameId: 'a', team: 'auburn' };
  axios.get.mockRejectedValue(new Error('offline')); await service.live(); expect(service.override).not.toBeNull();
  service.nextRefresh = 0; axios.get.mockResolvedValue({ data: { events: [] } }); await service.live(); expect(service.override).toBeNull();
});
it('never falls back to another team’s cached highlights', async () => {
  const service = new SportsExperience(); service.highlights.write({ gsw: { updatedAt: Date.now(), feed: { query: 'Warriors', items: [{ videoId: 'warriors' }] } } });
  service.fetchHighlights = jest.fn().mockRejectedValue(new Error('quota'));
  const feed = await service.getHighlights('auburn'); expect(feed.query).toContain('Auburn'); expect(feed.items).toEqual([]); expect(feed.unavailable).toBe(true);
  await service.getHighlights('auburn'); expect(service.fetchHighlights).toHaveBeenCalledTimes(1);
});
it('does not keep a tracker when the summary confirms the game ended', async () => {
  const service = new SportsExperience();
  axios.get.mockImplementation(async (url) => ({ data: url.includes('scoreboard') ? { events: [event('a', '2')] } : { header: { competitions: [{ competitors: [competitor('2', '24', 'home'), competitor('other', '21', 'away')], status: { type: { state: 'post', completed: true } } }] } } }));
  expect((await service.live()).games).toEqual([]);
});
it('allows highlights fallback while a retained game is stale', async () => {
  const service = new SportsExperience(); const game = { ...normalizeGame(event('a', '2'), TEAMS.auburn), stale: true };
  service.live = jest.fn(async () => ({ games: [game], failures: ['auburn'], checkedAt: Date.now() }));
  await service.select({ mode: 'highlights' });
  expect((await service.getExperience({ includeHighlights: false })).tracker).toBeNull();
});

it('coalesces the legacy Warriors highlight refresh instead of duplicating provider requests', async () => {
  const service = new SportsExperience(); const legacy = require('../src/services/funVideo');
  let resolve; legacy.getCurrentFeed.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  const first = service.getHighlights('gsw'); const second = service.getHighlights('gsw');
  resolve({ items: [] }); await Promise.all([first, second]);
  expect(legacy.getCurrentFeed).toHaveBeenCalledTimes(1);
});

it('requests supported individual scoreboard dates and deduplicates adjacent-day games', async () => {
  const service = new SportsExperience();
  axios.get.mockImplementation(async (url) => ({ data: url.includes('scoreboard') ? { events: [event('a', '2')] } : { drives: { previous: [] } } }));
  const snapshot = await service.live();
  const boards = axios.get.mock.calls.filter(([url]) => url.includes('scoreboard'));
  expect(boards).toHaveLength(6);
  expect(boards.every(([, options]) => /^\d{8}$/.test(options.params.dates))).toBe(true);
  expect(new Set(boards.map(([, options]) => options.params.dates)).size).toBe(3);
  expect(snapshot.games.map((game) => game.id)).toEqual(['a']);
  expect(axios.get.mock.calls.filter(([url]) => url.includes('summary'))).toHaveLength(1);
});



it('keeps a discovered live game when another adjacent date fails', async () => {
  const service = new SportsExperience();
  const seen = new Map();
  axios.get.mockImplementation(async (url) => {
    if (!url.includes('scoreboard')) return { data: {} };
    const n = (seen.get(url) || 0) + 1; seen.set(url, n);
    if (url.includes('college-football') && n === 3) throw new Error('future day unavailable');
    return { data: { events: url.includes('college-football') && n === 2 ? [event('a', '2')] : [] } };
  });
  const snapshot = await service.live();
  expect(snapshot.games.map((game) => game.id)).toEqual(['a']);
  expect(snapshot.failures).toEqual(['auburn']);
  expect((await service.getExperience({ includeHighlights: false })).tracker.id).toBe('a');
});
it('does not let a scheduled duplicate overwrite an in-progress game', async () => {
  const service = new SportsExperience(); let count = 0;
  axios.get.mockImplementation(async (url) => {
    if (!url.includes('scoreboard')) return { data: {} };
    if (!url.includes('college-football')) return { data: { events: [] } };
    return { data: { events: [event('a', '2', ++count === 2 ? 'in' : 'pre')] } };
  });
  expect((await service.live()).games.map((game) => game.id)).toEqual(['a']);
});
it('retains a stale pinned game after partial failure but expires it on an authoritative final', async () => {
  const service = new SportsExperience();
  service.snapshot = { games: [normalizeGame(event('a', '2'), TEAMS.auburn)], failures: [], checkedAt: Date.now() };
  service.override = { mode: 'game', gameId: 'a', team: 'auburn' };
  let count = 0;
  axios.get.mockImplementation(async (url) => {
    if (url.includes('college-football') && ++count === 1) throw new Error('timeout');
    return { data: { events: [] } };
  });
  expect((await service.live()).games[0]).toMatchObject({ id: 'a', stale: true });
  expect(service.override).not.toBeNull();
  service.nextRefresh = 0; count = 0;
  axios.get.mockImplementation(async (url) => {
    if (url.includes('college-football') && ++count === 1) throw new Error('timeout');
    return { data: { events: [event('a', '2', 'post')] } };
  });
  expect((await service.live()).games).toEqual([]);
  expect(service.override).toBeNull();
});

it('uses game-centric recaps and invalidates the former generic football feed cache', async () => {
  const service = new SportsExperience();
  service.highlights.write({ auburn: { updatedAt: Date.now(), feed: { items: [{ videoId: 'old-generic' }] } } });
  const provider = require('../src/services/teamGameRecaps');
  provider.fetchFeed.mockResolvedValue({ mode: 'game_recap', schemaVersion: 2, channelId: 'auburn-channel', items: [{ videoId: null, game: { gameId: 'a' } }] });
  const feed = await service.getHighlights('auburn');
  expect(feed.items[0].game.gameId).toBe('a');
  await service.getHighlights('auburn');
  expect(provider.fetchFeed).toHaveBeenCalledTimes(1);
});

it('only tracks Auburn and GSW and ignores a retired highlight preference', async () => {
  settings.get.mockImplementation((key) => key === 'sports.highlightsTeam' ? 'broncos' : undefined);
  const service = new SportsExperience();
  expect(Object.keys(TEAMS)).toEqual(['auburn', 'gsw']);
  expect(service.preferences()).toMatchObject({ team: 'gsw', priority: ['auburn', 'gsw'] });
  axios.get.mockResolvedValue({ data: { events: [] } });
  await service.live();
  expect(axios.get.mock.calls.every(([url]) => !url.includes('football/nfl'))).toBe(true);
});
