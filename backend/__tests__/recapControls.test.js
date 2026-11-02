jest.mock('../src/services/sportsExperience', () => ({ preferences: jest.fn(), selection: jest.fn(() => ({ tracker: null, games: [] })), getExperience: jest.fn(), getHighlights: jest.fn() }));
jest.mock('../src/services/settings', () => ({ get: jest.fn(), getAll: jest.fn(() => ({})) }));
const sports = require('../src/services/sportsExperience');
const consoleService = require('../src/services/console');
beforeEach(() => {
  jest.spyOn(consoleService, 'broadcastState').mockImplementation(() => {});
  jest.spyOn(consoleService, 'broadcastPageData').mockResolvedValue({});
  jest.spyOn(consoleService, 'getState').mockReturnValue({});
});
afterEach(() => { jest.restoreAllMocks(); consoleService.close(); });
it.each(['gsw', 'auburn'])('uses the same game navigation and Video/Box controls for %s', async (team) => {
  sports.preferences.mockReturnValue({ team });
  sports.getExperience.mockResolvedValue({ preferences: { team }, tracker: null, games: [], videoFeed: { items: Array.from({ length: 10 }, (_, id) => ({ videoId: String(id) })) } });
  sports.getHighlights.mockResolvedValue({ items: Array.from({ length: 10 }, (_, id) => ({ videoId: String(id) })) });
  consoleService.ensureRecapTeam(team);
  consoleService.runtime.funClipIndex = 0;
  consoleService.runtime.funViewMode = 'video';
  expect(consoleService.getSoftButtons('sports').button4).toBe('Box');
  await consoleService.handleFunAction('next');
  expect(consoleService.runtime.funViewMode).toBe('boxscore');
  expect(consoleService.getSoftButtons('sports').button4).toBe('Video');
  await consoleService.handleFunAction('previous');
  expect(consoleService.runtime.funClipIndex).toBe(1);
  expect(consoleService.runtime.funViewMode).toBe('video');
});
it('starts at the latest game in video mode after selecting another highlight team', async () => {
  consoleService.runtime.funRecapTeam = 'gsw';
  consoleService.runtime.funClipIndex = 8;
  consoleService.runtime.funViewMode = 'boxscore';
  sports.preferences.mockReturnValue({ team: 'auburn' });
  sports.getExperience.mockResolvedValue({ preferences: { team: 'auburn' }, tracker: null, games: [], videoFeed: { items: [{ game: { gameId: 'latest' } }] } });
  const data = await consoleService.getSportsPageData();
  expect(data.videoFeed.selectedClipIndex).toBe(0);
  expect(data.videoFeed.viewMode).toBe('video');
});
