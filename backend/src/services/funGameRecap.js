const axios = require('axios');
const logger = require('../utils/logger');

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_TIMEOUT_MS = 12000;
const DEFAULT_TEAM_ID = '9'; // Golden State Warriors
const DEFAULT_GAME_COUNT = 10;
const DEFAULT_SEASON_TYPES = ['2', '3', '5']; // Regular season, playoffs, play-in

function getTeamId() {
  return String(process.env.FUN_VIDEO_TEAM_ID || DEFAULT_TEAM_ID).trim();
}

function getGameCount() {
  const n = Number.parseInt(process.env.FUN_VIDEO_MAX_RESULTS || String(DEFAULT_GAME_COUNT), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 15) : DEFAULT_GAME_COUNT;
}

function getNbaSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 10 ? year + 1 : year;
}

function getSeasonTypes() {
  const configured = String(process.env.FUN_VIDEO_SEASON_TYPES || '')
    .split(',')
    .map((value) => String(value).trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_SEASON_TYPES;
}

async function fetchScheduleEvents(options = {}) {
  const teamId = String(options.teamId || getTeamId()).trim();
  const season = Number.isFinite(options.season) ? options.season : getNbaSeason();
  const base = options.league ? `https://site.api.espn.com/apis/site/v2/sports/${options.league}` : ESPN_BASE;
  const seasonTypes = Array.isArray(options.seasonTypes) && options.seasonTypes.length > 0
    ? options.seasonTypes.map((value) => String(value).trim()).filter(Boolean)
    : getSeasonTypes();

  logger.info('Fetching team schedules from ESPN', { teamId, season, seasonTypes });

  const responses = await Promise.allSettled(
    seasonTypes.map(async (seasonType) => {
      const url = `${base}/teams/${teamId}/schedule?season=${season}&seasontype=${encodeURIComponent(seasonType)}`;
      const response = await axios.get(url, { timeout: ESPN_TIMEOUT_MS });
      return response.data?.events || [];
    })
  );

  const successful = responses.filter((response) => response.status === 'fulfilled');
  if (!successful.length) throw new Error('Team schedules unavailable');
  return Array.from(
    new Map(
      successful.map((response) => response.value)
        .flat()
        .filter((event) => event?.id)
        .map((event) => [String(event.id), event])
    ).values()
  );
}

function extractScore(scoreVal) {
  if (scoreVal == null || scoreVal === '') return null;
  if (typeof scoreVal === 'object') {
    return extractScore(scoreVal.value ?? scoreVal.displayValue);
  }
  return Number.isFinite(Number(scoreVal)) ? Number(scoreVal) : null;
}

function formatGameDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildSearchQuery(game) {
  const home = game.home.displayName || game.home.abbrev;
  const away = game.away.displayName || game.away.abbrev;
  const date = formatShortDate(game.date);
  return `${away} vs ${home} Full Game Highlights ${date}`;
}

function parseBoxScore(boxData) {
  if (!Array.isArray(boxData) || boxData.length === 0) {
    return null;
  }

  const statRow = boxData[0];
  const labels = (statRow.labels || []).map((l) => String(l).toLowerCase());
  const players = (statRow.athletes || [])
    .filter((a) => a.starter || a.didNotPlay === false || (a.stats && a.stats.length > 0))
    .map((a) => {
      const stats = {};
      for (let i = 0; i < labels.length; i++) {
        stats[labels[i]] = a.stats?.[i] ?? '--';
      }
      const athlete = a.athlete || {};
      return {
        name: athlete.shortName || athlete.displayName || 'Unknown',
        headshot: athlete.headshot?.href || null,
        position: athlete.position?.abbreviation || null,
        starter: a.starter === true,
        ...stats,
      };
    })
    .filter((p) => p.min !== '--' && p.min !== '0');

  const totals = {};
  const teamStats = statRow.totals || [];
  for (let i = 0; i < labels.length; i++) {
    totals[labels[i]] = teamStats[i] ?? '--';
  }

  return { players, totals, labels };
}

function parseFootballBoxScore(boxscore, teamId) {
  if (!boxscore) return null;
  const ids = [...new Set([...(boxscore.players || []), ...(boxscore.teams || [])].map((entry) => String(entry.team?.id || '')).filter(Boolean))];
  const parseTeam = (id) => {
    const players = boxscore.players?.find((entry) => String(entry.team?.id) === id);
    const team = boxscore.teams?.find((entry) => String(entry.team?.id) === id);
    const categories = (players?.statistics || []).map((category) => ({
      id: category.name, name: category.text || category.displayName || category.name,
      labels: category.labels || [],
      players: (category.athletes || []).map((row) => ({ name: row.athlete?.shortName || row.athlete?.displayName || 'Player', stats: (category.labels || []).map((_, index) => row.stats?.[index] ?? null) })),
      totals: (category.labels || []).map((_, index) => category.totals?.[index] ?? null),
    })).filter((category) => category.players.length);
    const statistics = (team?.statistics || []).map((stat) => ({ id: stat.name, label: stat.label || stat.name, value: stat.displayValue ?? null }));
    return categories.length || statistics.length ? { categories, statistics } : null;
  };
  return { sport: 'football', team: parseTeam(String(teamId)), opponent: parseTeam(ids.find((id) => id !== String(teamId))) };
}

async function fetchRecentGames(options = {}) {
  const teamId = String(options.teamId || getTeamId());
  const count = Math.min(options.count || getGameCount(), 10);
  let events = await fetchScheduleEvents({ ...options, teamId });
  const isCompleted = (event) => Number(event.seasonType?.type ?? event.seasonType?.id) !== 1
    && (event.competitions?.[0]?.status || event.status)?.type?.completed === true
    && event.competitions?.[0]?.competitors?.some((competitor) => String(competitor.team?.id) === teamId);
  if (options.includePreviousSeason && events.filter(isCompleted).length < count) {
    try {
      const previous = await fetchScheduleEvents({ ...options, teamId, season: options.season - 1 });
      events = [...new Map([...previous, ...events].map((event) => [String(event.id), event])).values()];
    } catch (_) { logger.warn('Previous season unavailable; retaining current completed games', { teamId }); }
  }

  const completed = events
    .filter((e) => {
      return isCompleted(e);
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, count);

  if (completed.length === 0) {
    throw new Error('No completed games found for team');
  }

  return completed.map((event) => {
    const comp = event.competitions[0];
    const homeComp = comp.competitors.find((c) => c.homeAway === 'home') || comp.competitors[0];
    const awayComp = comp.competitors.find((c) => c.homeAway === 'away') || comp.competitors[1];
    const isHome = String(homeComp.team?.id) === teamId;
    const team = isHome ? homeComp : awayComp;
    const opp = isHome ? awayComp : homeComp;

    return {
      gameId: event.id,
      date: event.date,
      dateFormatted: formatGameDate(event.date),
      homeAway: isHome ? 'home' : 'away',
      result: team.winner === true ? 'W' : opp.winner === true ? 'L' : extractScore(team.score) != null && extractScore(opp.score) != null && extractScore(team.score) === extractScore(opp.score) ? 'T' : null,
      score: {
        team: extractScore(team.score),
        opponent: extractScore(opp.score),
      },
      home: {
        abbrev: homeComp.team?.abbreviation || '???',
        displayName: homeComp.team?.displayName || 'Home',
        location: homeComp.team?.location || null,
        logo: homeComp.team?.logos?.[0]?.href || homeComp.team?.logo || null,
        score: extractScore(homeComp.score),
      },
      away: {
        abbrev: awayComp.team?.abbreviation || '???',
        displayName: awayComp.team?.displayName || 'Away',
        location: awayComp.team?.location || null,
        logo: awayComp.team?.logos?.[0]?.href || awayComp.team?.logo || null,
        score: extractScore(awayComp.score),
      },
      opponent: {
        abbrev: opp.team?.abbreviation || '???',
        displayName: opp.team?.displayName || 'Opponent',
        logo: opp.team?.logos?.[0]?.href || opp.team?.logo || null,
      },
    };
  });
}

async function fetchBoxScore(gameId, teamId, options = {}) {
  const base = options.league ? `https://site.api.espn.com/apis/site/v2/sports/${options.league}` : ESPN_BASE;
  const url = `${base}/summary?event=${gameId}`;
  try {
    const response = await axios.get(url, { timeout: ESPN_TIMEOUT_MS });
    const boxscore = response.data?.boxscore;
    if (options.sport === 'football') return parseFootballBoxScore(boxscore, teamId);
    if (!boxscore?.players) {
      return null;
    }

    const teamEntry = boxscore.players.find(
      (p) => String(p.team?.id) === String(teamId)
    );
    const oppEntry = boxscore.players.find(
      (p) => String(p.team?.id) !== String(teamId)
    );

    return {
      team: teamEntry ? parseBoxScore(teamEntry.statistics) : null,
      opponent: oppEntry ? parseBoxScore(oppEntry.statistics) : null,
    };
  } catch (error) {
    logger.warn('Failed to fetch box score', { gameId, error: error.message });
    return null;
  }
}

async function fetchGameRecaps() {
  const teamId = getTeamId();
  const games = await fetchRecentGames();

  const recaps = [];
  for (const game of games) {
    const boxScore = await fetchBoxScore(game.gameId, teamId);
    recaps.push({
      ...game,
      searchQuery: buildSearchQuery(game),
      boxScore: boxScore || null,
    });
  }

  return recaps;
}

module.exports = {
  fetchGameRecaps,
  fetchRecentGames,
  fetchBoxScore,
  fetchScheduleEvents,
  getTeamId,
  parseFootballBoxScore,
};
