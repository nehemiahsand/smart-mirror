const axios = require('axios');
const logger = require('../utils/logger');

class NBAService {
  constructor() {
    this.cacheTimeout = 2 * 60 * 1000; // 2 minutes
    this.lastUpdate = null;
    this.cachedData = null;
  }

  async getScores(teams = null) {
    try {
      // Check cache first
      const now = Date.now();
      if (this.cachedData && this.lastUpdate && (now - this.lastUpdate < this.cacheTimeout)) {
        logger.info('NBA: Returning cached data');
        return this.filterByTeams(this.cachedData, teams);
      }

      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const url = `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${today}&limit=200`;

      logger.info(`NBA: Fetching from ${url}`);
      const response = await axios.get(url);
      
      if (!response.data || !response.data.events) {
        logger.warn('NBA: No events data in response');
        return { games: [], lastUpdate: new Date().toISOString() };
      }

      const formattedGames = this.formatGames(response.data.events);
      
      this.cachedData = formattedGames;
      this.lastUpdate = now;

      return this.filterByTeams(formattedGames, teams);
    } catch (error) {
      logger.error(`NBA: Error fetching scores: ${error.message}`);
      
      // Return stale data if available
      if (this.cachedData) {
        logger.info('NBA: Returning stale cached data due to error');
        return this.filterByTeams(this.cachedData, teams);
      }
      
      return { games: [], lastUpdate: new Date().toISOString(), error: error.message };
    }
  }

  formatGames(events) {
    const games = events.map(event => {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

      // Game status
      let status = [];
      let gameState = 'pre'; // pre, live, final

      if (competition.status.type.completed) {
        gameState = 'final';
        status.push('FINAL');
        if (competition.status.type.detail.includes('OT')) {
          status.push(competition.status.type.detail.match(/\d+OT/)?.[0] || 'OT');
        }
      } else if (competition.status.type.state === 'in') {
        gameState = 'live';
        status.push(competition.status.displayClock);
        status.push(this.getPeriod(competition.status.period));
      } else {
        gameState = 'pre';
        const gameTime = new Date(event.date);
        status.push(gameTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          timeZone: 'America/Chicago'
        }));
      }

      // Get broadcast info
      const broadcasts = [];
      if (competition.broadcasts && competition.broadcasts.length > 0) {
        competition.broadcasts.forEach(market => {
          if (market.market === 'national') {
            market.names.forEach(name => broadcasts.push(name));
          }
        });
      }

      return {
        id: event.id,
        homeTeam: {
          name: homeTeam.team.displayName,
          shortName: homeTeam.team.shortDisplayName,
          abbrev: homeTeam.team.abbreviation,
          score: parseInt(homeTeam.score) || 0,
          logo: homeTeam.team.logo,
          record: homeTeam.records?.[0]?.summary || '',
          color: homeTeam.team.color,
        },
        awayTeam: {
          name: awayTeam.team.displayName,
          shortName: awayTeam.team.shortDisplayName,
          abbrev: awayTeam.team.abbreviation,
          score: parseInt(awayTeam.score) || 0,
          logo: awayTeam.team.logo,
          record: awayTeam.records?.[0]?.summary || '',
          color: awayTeam.team.color,
        },
        status: status,
        gameState: gameState,
        broadcasts: broadcasts,
        venue: competition.venue?.fullName || '',
        isWinner: {
          home: competition.status.type.completed && homeTeam.winner,
          away: competition.status.type.completed && awayTeam.winner,
        }
      };
    });

    return { 
      games: games,
      lastUpdate: new Date().toISOString() 
    };
  }

  getPeriod(period) {
    if (period === 1) return '1st';
    if (period === 2) return '2nd';
    if (period === 3) return '3rd';
    if (period === 4) return '4th';
    if (period > 4) return `OT${period - 4 > 1 ? period - 4 : ''}`;
    return '';
  }

  filterByTeams(data, teams) {
    if (!teams || teams.length === 0) {
      return data;
    }

    const teamCodes = teams.map(t => t.toUpperCase());
    const filteredGames = data.games.filter(game => 
      teamCodes.includes(game.homeTeam.abbrev) || 
      teamCodes.includes(game.awayTeam.abbrev)
    );

    return {
      games: filteredGames,
      lastUpdate: data.lastUpdate
    };
  }

  clearCache() {
    this.cachedData = null;
    this.lastUpdate = null;
  }
}

module.exports = new NBAService();
