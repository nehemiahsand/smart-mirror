jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const axios = require('axios');
const gameRecap = require('../src/services/funGameRecap');

describe('Fun Game Recap Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-16T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.FUN_VIDEO_SEASON_TYPES;
  });

  it('includes play-in games when building the recent game list', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: {
          events: [
            {
              id: '401811054',
              date: '2026-04-13T00:30Z',
              competitions: [{
                status: { type: { completed: true } },
                competitors: [
                  { homeAway: 'home', team: { id: '12', abbreviation: 'LAC', displayName: 'LA Clippers' }, score: 115 },
                  { homeAway: 'away', team: { id: '9', abbreviation: 'GS', displayName: 'Golden State Warriors' }, score: 110, winner: false },
                ],
              }],
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: { events: [] } })
      .mockResolvedValueOnce({
        data: {
          events: [
            {
              id: '401866756',
              date: '2026-04-16T02:00Z',
              competitions: [{
                status: { type: { completed: true } },
                competitors: [
                  { homeAway: 'home', team: { id: '12', abbreviation: 'LAC', displayName: 'LA Clippers' }, score: 121, winner: false },
                  { homeAway: 'away', team: { id: '9', abbreviation: 'GS', displayName: 'Golden State Warriors' }, score: 126, winner: true },
                ],
              }],
            },
          ],
        },
      });

    const games = await gameRecap.fetchRecentGames();

    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(axios.get.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining('seasontype=2'),
      expect.stringContaining('seasontype=3'),
      expect.stringContaining('seasontype=5'),
    ]);
    expect(games[0]).toMatchObject({
      gameId: '401866756',
      dateFormatted: 'Apr 15, 2026',
      result: 'W',
      score: {
        team: 126,
        opponent: 121,
      },
      opponent: {
        displayName: 'LA Clippers',
      },
    });
  });
});
