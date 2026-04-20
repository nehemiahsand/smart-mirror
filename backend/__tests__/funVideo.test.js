jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const funVideoService = require('../src/services/funVideo');

describe('Fun Video Service scheduling', () => {
  describe('getNextDailyRefreshDelayMs()', () => {
    it('schedules the same-day refresh when it is before 5 AM in Chicago', () => {
      const now = new Date('2026-04-16T09:30:00.000Z');
      const delayMs = funVideoService.getNextDailyRefreshDelayMs(now, 5, 0, 0, 'America/Chicago');

      expect(delayMs).toBe(30 * 60 * 1000);
    });

    it('rolls the refresh to the next day once 5 AM has been reached', () => {
      const now = new Date('2026-04-16T10:00:00.000Z');
      const delayMs = funVideoService.getNextDailyRefreshDelayMs(now, 5, 0, 0, 'America/Chicago');

      expect(delayMs).toBe(24 * 60 * 60 * 1000);
    });

    it('rolls the refresh to the next morning when it is already after 5 AM', () => {
      const now = new Date('2026-04-16T10:30:00.000Z');
      const delayMs = funVideoService.getNextDailyRefreshDelayMs(now, 5, 0, 0, 'America/Chicago');

      expect(delayMs).toBe((23 * 60 * 60 * 1000) + (30 * 60 * 1000));
    });
  });

  describe('getGameRecapRefreshPlan()', () => {
    it('waits until one hour after the next scheduled game window', () => {
      const now = new Date('2026-04-16T12:00:00.000Z');
      const plan = funVideoService.getGameRecapRefreshPlan({
        now,
        scheduleEvents: [
          {
            id: '401866759',
            date: '2026-04-18T02:00:00.000Z',
            competitions: [{
              status: {
                type: {
                  completed: false,
                  state: 'pre',
                },
              },
            }],
          },
        ],
        currentFeed: null,
        expectedGameDurationMinutes: 180,
        refreshDelayMinutes: 60,
      });

      expect(plan.shouldRefreshNow).toBe(false);
      expect(plan.reason).toBe('awaiting_next_game');
      expect(plan.nextCheckAt.toISOString()).toBe('2026-04-18T06:00:00.000Z');
      expect(plan.targetGameId).toBe('401866759');
    });

    it('refreshes immediately when the postgame window has passed and the cache is stale', () => {
      const now = new Date('2026-04-16T07:30:00.000Z');
      const plan = funVideoService.getGameRecapRefreshPlan({
        now,
        scheduleEvents: [
          {
            id: '401866756',
            date: '2026-04-16T02:00:00.000Z',
            competitions: [{
              status: {
                type: {
                  completed: true,
                  state: 'post',
                },
              },
            }],
          },
        ],
        currentFeed: {
          fetchedAt: '2026-04-16T05:00:00.000Z',
          items: [],
        },
        expectedGameDurationMinutes: 180,
        refreshDelayMinutes: 60,
      });

      expect(plan.shouldRefreshNow).toBe(true);
      expect(plan.reason).toBe('postgame_refresh_due');
      expect(plan.targetGameId).toBe('401866756');
      expect(plan.targetRefreshAt.toISOString()).toBe('2026-04-16T06:00:00.000Z');
    });

    it('waits one hour from observed completion when the game ran long', () => {
      const now = new Date('2026-04-16T06:45:00.000Z');
      const plan = funVideoService.getGameRecapRefreshPlan({
        now,
        scheduleEvents: [
          {
            id: '401866756',
            date: '2026-04-16T02:00:00.000Z',
            competitions: [{
              status: {
                type: {
                  completed: true,
                  state: 'post',
                },
              },
            }],
          },
        ],
        currentFeed: {
          fetchedAt: '2026-04-16T05:00:00.000Z',
          items: [],
        },
        observedCompletedAtMsByGameId: new Map([
          ['401866756', Date.parse('2026-04-16T06:30:00.000Z')],
        ]),
        expectedGameDurationMinutes: 180,
        refreshDelayMinutes: 60,
      });

      expect(plan.shouldRefreshNow).toBe(false);
      expect(plan.reason).toBe('awaiting_postgame_window');
      expect(plan.targetRefreshAt.toISOString()).toBe('2026-04-16T07:30:00.000Z');
      expect(plan.nextCheckAt.toISOString()).toBe('2026-04-16T07:30:00.000Z');
    });
  });
});
