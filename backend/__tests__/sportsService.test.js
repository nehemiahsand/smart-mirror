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
});
