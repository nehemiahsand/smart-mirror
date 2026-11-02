jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../src/services/funGameRecap', () => ({ fetchRecentGames: jest.fn(), fetchBoxScore: jest.fn() }));
jest.mock('../src/utils/runtimeStore', () => class { constructor(name, fallback) { this.value = JSON.parse(JSON.stringify(fallback)); } read() { return JSON.parse(JSON.stringify(this.value)); } write(value) { this.value = value; } });
const axios = require('axios');
const recaps = require('../src/services/funGameRecap');
const { TeamGameRecaps, SOURCES, matchesGame } = require('../src/services/teamGameRecaps');
const source = SOURCES.auburn;
const game = { gameId: 'game-1', date: '2026-10-25T20:05:00Z', homeAway: 'away', home: { displayName: 'LSU Tigers', location: 'LSU', abbrev: 'LSU', score: 16 }, away: { displayName: 'Auburn Tigers', location: 'Auburn', abbrev: 'AUB', score: 30 } };
const snippet = (extra = {}) => ({ channelId: source.channelId, title: 'Auburn Tigers vs LSU Tigers Game Highlights', publishedAt: '2026-10-26T00:00:00Z', liveBroadcastContent: 'none', ...extra });
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-30T12:00:00Z')); process.env.YOUTUBE_API_KEY = 'test-only'; recaps.fetchRecentGames.mockResolvedValue([game]); recaps.fetchBoxScore.mockResolvedValue({ sport: 'football', team: { categories: [] } }); });
afterEach(() => { jest.useRealTimers(); delete process.env.YOUTUBE_API_KEY; });
it('requires the pinned channel, both teams, the game date window, and highlights content', () => {
  expect(matchesGame({ snippet: snippet() }, game, source)).toBe(true);
  for (const change of [{ channelId: 'copycat' }, { title: 'Auburn Tigers vs Alabama Crimson Tide Game Highlights' }, { publishedAt: '2025-10-26T00:00:00Z' }, { title: 'Auburn Tigers vs LSU Tigers Reaction Highlights' }])
    expect(matchesGame({ snippet: snippet(change) }, game, source)).toBe(false);
});
it('pins searches and details to the official channel and attaches the correct football box score', async () => {
  const service = new TeamGameRecaps();
  axios.get.mockResolvedValueOnce({ data: { items: [{ id: { videoId: 'abcdefghijk' }, snippet: snippet() }] } }).mockResolvedValueOnce({ data: { items: [{ id: 'abcdefghijk', snippet: snippet(), status: { public: true, privacyStatus: 'public', embeddable: true }, contentDetails: {} }] } });
  const feed = await service.fetchFeed('auburn');
  expect(axios.get.mock.calls[0][1].params.channelId).toBe(source.channelId);
  expect(feed.items[0]).toMatchObject({ videoId: 'abcdefghijk', game: { gameId: game.gameId, boxScore: { sport: 'football' } } });
  expect(recaps.fetchRecentGames).toHaveBeenCalledWith(expect.objectContaining({ count: 10, season: 2026, league: 'football/college-football', seasonTypes: ['2', '3'] }));
  await service.fetchFeed('auburn');
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(recaps.fetchBoxScore).toHaveBeenCalledTimes(1);
});
it('keeps the game and box score when the source has no matching video instead of using an unrelated clip', async () => {
  const service = new TeamGameRecaps();
  axios.get.mockResolvedValue({ data: { items: [{ id: { videoId: 'abcdefghijk' }, snippet: snippet({ title: 'Auburn Tigers vs Alabama Crimson Tide Game Highlights' }) }] } });
  const feed = await service.fetchFeed('auburn');
  expect(feed.items).toHaveLength(1);
  expect(feed.items[0]).toMatchObject({ videoId: null, unavailable: true, game: { gameId: game.gameId } });
  await service.fetchFeed('auburn');
  expect(axios.get).toHaveBeenCalledTimes(1);
});
it('rejects disallowed embeds even when the channel/date/game match', async () => {
  const service = new TeamGameRecaps();
  axios.get.mockResolvedValueOnce({ data: { items: [{ id: { videoId: 'abcdefghijk' }, snippet: snippet() }] } }).mockResolvedValueOnce({ data: { items: [{ id: 'abcdefghijk', snippet: snippet(), status: { privacyStatus: 'public', embeddable: false } }] } });
  expect((await service.fetchFeed('auburn')).items[0].videoId).toBeNull();
});
it('backs off missing videos for older games instead of spending search quota on every refresh', async () => {
  const service = new TeamGameRecaps();
  service.findVideo = jest.fn(async () => null);
  await service.fetchFeed('auburn');
  jest.advanceTimersByTime(30 * 60000);
  await service.fetchFeed('auburn');
  expect(service.findVideo).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(6 * 3600000);
  await service.fetchFeed('auburn');
  expect(service.findVideo).toHaveBeenCalledTimes(2);
});

it('rejects a removed team rather than requesting its highlights', async () => {
  await expect(new TeamGameRecaps().fetchFeed('broncos')).rejects.toThrow('Unsupported recap team');
  expect(axios.get).not.toHaveBeenCalled();
});
