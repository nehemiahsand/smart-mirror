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

describe('Football recap data', () => {
  afterEach(() => jest.clearAllMocks());
  it('parses football passing/rushing/receiving and team comparison without NBA minute filters', () => {
    const box = gameRecap.parseFootballBoxScore({ players: [{ team: { id: '7' }, statistics: [{ name: 'passing', labels: ['YDS', 'TD'], athletes: [{ athlete: { displayName: 'Quarterback' }, stats: ['222', '0'] }], totals: ['222', '0'] }] }], teams: [{ team: { id: '7' }, statistics: [{ name: 'turnovers', label: 'Turnovers', displayValue: '0' }] }, { team: { id: '22' }, statistics: [{ name: 'totalYards', displayValue: '381' }] }] }, '7');
    expect(box.team.categories[0].players[0].stats).toEqual(['222', '0']);
    expect(box.team.statistics[0].value).toBe('0');
    expect(box.opponent.statistics[0].value).toBe('381');
  });
  it('fills at most ten completed games across season boundaries and ignores future/unrelated games', async () => {
    const make = (id, day, completed = true, teamId = '2') => ({ id, date: `2026-0${day}-01T12:00:00Z`, competitions: [{ status: { type: { completed } }, competitors: [{ homeAway: 'home', team: { id: teamId }, score: 0 }, { homeAway: 'away', team: { id: '99' }, score: null }] }] });
    axios.get.mockImplementation(async (url) => ({ data: { events: url.includes('season=2026') ? [make('new','9'), make('future','9',false), make('other','9',true,'999')] : [make('old','1')] } }));
    const games = await gameRecap.fetchRecentGames({ teamId: '2', league: 'football/college-football', season: 2026, seasonTypes: ['2','3'], includePreviousSeason: true, count: 10 });
    expect(games.map((game) => game.gameId)).toEqual(['new','old']);
    expect(games[0].home.score).toBe(0);
    expect(games[0].away.score).toBeNull();
  });
});
it('caps football history at ten unique completed regular/postseason games', async () => {
  const make = (id, day, type = 2, completed = true) => ({ id, date: new Date(Date.UTC(2026,9,day)).toISOString(), seasonType: { type }, competitions: [{ status: { type: { completed } }, competitors: [{ homeAway: 'home', team: { id: '2' }, score: 0 }, { homeAway: 'away', team: { id: '99' }, score: 7, winner: true }] }] });
  const events = [...Array.from({ length: 14 }, (_, i) => make(String(i+1), i+1)), make('preseason',29,1), make('future',31,2,false)];
  axios.get.mockResolvedValue({ data: { events } });
  const games = await gameRecap.fetchRecentGames({ teamId: '2', league: 'football/college-football', season: 2026, seasonTypes: ['2','3'], count: 10 });
  expect(games).toHaveLength(10);
  expect(games[0].gameId).toBe('14');
  expect(games[9].gameId).toBe('5');
  expect(games.some((game) => ['preseason','future'].includes(game.gameId))).toBe(false);
});
