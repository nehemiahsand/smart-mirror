const axios = require('axios');
const logger = require('../utils/logger');

class SportsService {
  constructor() {
    this.cacheTimeout = 2 * 60 * 1000; // 2 minutes
    this.cache = {
      nba: { data: null, lastUpdate: null },
      nfl: { data: null, lastUpdate: null },
      ncaaf: { data: null, lastUpdate: null },
      ncaab: { data: null, lastUpdate: null },
      mlb: { data: null, lastUpdate: null },
      soccer: { data: null, lastUpdate: null }
    };

    this.sportConfig = {
      nba: {
        name: 'NBA Basketball',
        url: 'basketball/nba',
        icon: '🏀'
      },
      nfl: {
        name: 'NFL Football',
        url: 'football/nfl',
        icon: '🏈'
      },
      ncaaf: {
        name: 'NCAA Football',
        url: 'football/college-football',
        icon: '🏈'
      },
      ncaab: {
        name: 'NCAA Basketball',
        url: 'basketball/mens-college-basketball',
        icon: '🏀'
      },
      mlb: {
        name: 'MLB Baseball',
        url: 'baseball/mlb',
        icon: '⚾'
      },
      soccer: {
        name: 'Soccer',
        url: 'soccer/usa.1', // MLS
        icon: '⚽'
      }
    };
  }

  async getScores(sport, teams = null) {
    try {
      const config = this.sportConfig[sport];
      if (!config) {
        throw new Error(`Unknown sport: ${sport}`);
      }

      // Check cache first
      const now = Date.now();
      const cached = this.cache[sport];
      if (cached.data && cached.lastUpdate && (now - cached.lastUpdate < this.cacheTimeout)) {
        logger.info(`${config.name}: Returning cached data`);
        return this.filterByTeams(cached.data, teams);
      }

      // Always fetch today's games first (use local timezone, not UTC)
      const localDate = new Date();
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const today = `${year}${month}${day}`;
      
      const url = `https://site.web.api.espn.com/apis/site/v2/sports/${config.url}/scoreboard?dates=${today}&limit=200`;

      logger.info(`${config.name}: Fetching today's games from ${url}`);
      const response = await axios.get(url);
      
      let formattedGames = null;

      // If we have games today (scheduled, live, or completed), show them
      // We show completed games for the rest of the day so users can see final scores
      if (response.data && response.data.events && response.data.events.length > 0) {
        formattedGames = this.formatGames(response.data.events, sport);
        logger.info(`${config.name}: Found ${response.data.events.length} games for today`);
        
        // Check if we have any games that aren't completed yet (upcoming or live)
        const hasActiveGames = response.data.events.some(event => {
          const status = event.competitions[0].status;
          // Game is active if it's not completed OR if it's currently in progress
          return !status.type.completed;
        });
        
        // If all games are completed AND it's late in the day (after 10 PM local), look ahead
        const currentHour = new Date().getHours();
        if (!hasActiveGames && currentHour >= 22) {
          logger.info(`${config.name}: All today's games completed and it's late (${currentHour}:00), checking tomorrow`);
          formattedGames = null; // Force search for tomorrow's games
        }
      }
      
      if (!formattedGames) {
        // No games today OR all completed and late at night, search up to 7 days ahead for next games
        logger.info(`${config.name}: No games today, searching for upcoming games...`);
        const maxDaysAhead = 7;
        
        for (let daysAhead = 1; daysAhead <= maxDaysAhead; daysAhead++) {
          const searchDate = new Date();
          searchDate.setDate(searchDate.getDate() + daysAhead);
          const year = searchDate.getFullYear();
          const month = String(searchDate.getMonth() + 1).padStart(2, '0');
          const day = String(searchDate.getDate()).padStart(2, '0');
          const dateStr = `${year}${month}${day}`;
          
          const futureUrl = `https://site.web.api.espn.com/apis/site/v2/sports/${config.url}/scoreboard?dates=${dateStr}&limit=200`;
          
          logger.info(`${config.name}: Checking ${daysAhead} day(s) ahead...`);
          const futureResponse = await axios.get(futureUrl);
          
          if (futureResponse.data && futureResponse.data.events && futureResponse.data.events.length > 0) {
            formattedGames = this.formatGames(futureResponse.data.events, sport);
            logger.info(`${config.name}: Found games ${daysAhead} day(s) ahead`);
            break;
          }
        }
      }

      if (!formattedGames) {
        logger.warn(`${config.name}: No games found in next 7 days`);
        return { games: [], lastUpdate: new Date().toISOString(), sport };
      }
      
      this.cache[sport].data = formattedGames;
      this.cache[sport].lastUpdate = now;

      return this.filterByTeams(formattedGames, teams);
    } catch (error) {
      logger.error(`${sport}: Error fetching scores: ${error.message}`);
      
      // Return stale data if available
      const cached = this.cache[sport];
      if (cached.data) {
        logger.info(`${sport}: Returning stale cached data due to error`);
        return this.filterByTeams(cached.data, teams);
      }
      
      return { games: [], lastUpdate: new Date().toISOString(), error: error.message, sport };
    }
  }

  formatGames(events, sport) {
    const games = events.map(event => {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

      // Get status
      const status = competition.status;
      let gameStatus = 'upcoming';
      let detail = status.type.shortDetail || status.type.detail;

      if (status.type.completed) {
        gameStatus = 'final';
      } else if (status.type.state === 'in') {
        gameStatus = 'live';
        // For live games, show period and time
        if (sport === 'nba' || sport === 'ncaab') {
          const period = this.getPeriod(status.period, sport);
          detail = `${period} ${status.displayClock || ''}`.trim();
        } else if (sport === 'nfl' || sport === 'ncaaf') {
          const quarter = this.getQuarter(status.period);
          detail = `${quarter} ${status.displayClock || ''}`.trim();
        } else if (sport === 'mlb') {
          const inning = this.getInning(status.period);
          detail = `${inning} ${status.type.shortDetail || ''}`.trim();
        } else if (sport === 'soccer') {
          detail = `${status.displayClock || ''}'`.trim();
        }
      }

      // Get broadcast info - show only first network
      const broadcasts = competition.broadcasts || [];
      let broadcast = '';
      if (broadcasts.length > 0 && broadcasts[0].names && broadcasts[0].names.length > 0) {
        broadcast = broadcasts[0].names[0];
      }

      // Clean team abbreviations (remove weird characters for NCAA)
      const cleanAbbrev = (abbrev) => {
        if (!abbrev) return '';
        // Remove any non-letter characters and numbers from the end
        return abbrev.replace(/[^A-Za-z]+$/, '').trim();
      };

      // Get rank - only if team is in top 25
      const getRank = (competitor) => {
        const rank = competitor.curatedRank?.current;
        // Only return rank if it's a valid top 25 ranking
        return (rank && rank <= 25) ? rank : null;
      };

      return {
        id: event.id,
        date: event.date,
        status: gameStatus,
        statusDetail: detail,
        broadcast: broadcast,
        away: {
          team: cleanAbbrev(awayTeam.team.abbreviation),
          name: awayTeam.team.displayName,
          logo: awayTeam.team.logo,
          score: awayTeam.score || '0',
          record: awayTeam.records?.[0]?.summary || '',
          rank: getRank(awayTeam)
        },
        home: {
          team: cleanAbbrev(homeTeam.team.abbreviation),
          name: homeTeam.team.displayName,
          logo: homeTeam.team.logo,
          score: homeTeam.score || '0',
          record: homeTeam.records?.[0]?.summary || '',
          rank: getRank(homeTeam)
        }
      };
    });

    return {
      games,
      lastUpdate: new Date().toISOString(),
      sport
    };
  }

  getPeriod(period, sport) {
    if (sport === 'nba' || sport === 'ncaab') {
      if (period <= 4) return `Q${period}`;
      return `OT${period - 4}`;
    }
    return `Period ${period}`;
  }

  getQuarter(period) {
    if (period <= 4) return `Q${period}`;
    return `OT${period - 4}`;
  }

  getInning(period) {
    const half = period % 2 === 0 ? 'Bot' : 'Top';
    const inning = Math.ceil(period / 2);
    return `${half} ${inning}`;
  }

  filterByTeams(data, teams) {
    if (!teams || teams.length === 0) {
      return data;
    }

    const teamArray = Array.isArray(teams) ? teams : teams.split(',').map(t => t.trim());
    const filteredGames = data.games.filter(game => 
      teamArray.includes(game.home.team) || teamArray.includes(game.away.team)
    );

    return {
      ...data,
      games: filteredGames
    };
  }

  clearCache(sport = null) {
    if (sport) {
      this.cache[sport] = { data: null, lastUpdate: null };
      logger.info(`${sport} cache cleared`);
    } else {
      Object.keys(this.cache).forEach(key => {
        this.cache[key] = { data: null, lastUpdate: null };
      });
      logger.info('All sports cache cleared');
    }
  }

  getSupportedSports() {
    return Object.keys(this.sportConfig).map(key => ({
      id: key,
      name: this.sportConfig[key].name,
      icon: this.sportConfig[key].icon
    }));
  }
}

module.exports = new SportsService();
