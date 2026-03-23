jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const sportsService = require('../src/services/sports');

describe('Sports Service', () => {
  describe('getPeriod()', () => {
    it('formats NBA periods as quarters before overtime', () => {
      expect(sportsService.getPeriod(1, 'nba')).toBe('Q1');
      expect(sportsService.getPeriod(4, 'nba')).toBe('Q4');
      expect(sportsService.getPeriod(5, 'nba')).toBe('OT1');
    });

    it('formats mens college basketball periods as halves before overtime', () => {
      expect(sportsService.getPeriod(1, 'ncaab')).toBe('H1');
      expect(sportsService.getPeriod(2, 'ncaab')).toBe('H2');
      expect(sportsService.getPeriod(3, 'ncaab')).toBe('OT1');
    });
  });

  describe('formatUpcomingDetail()', () => {
    it('shows only the time for same-day games', () => {
      const now = new Date('2026-03-23T15:00:00-05:00');
      expect(sportsService.formatUpcomingDetail('2026-03-23T20:30:00Z', now)).toBe('3:30 PM');
    });

    it('includes weekday and date for future-day games', () => {
      const now = new Date('2026-03-23T15:00:00-05:00');
      expect(sportsService.formatUpcomingDetail('2026-03-30T00:00:00Z', now)).toBe('Sun 3/29 7:00 PM');
    });
  });
});
