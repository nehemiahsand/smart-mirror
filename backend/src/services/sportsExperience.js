const axios = require('axios');
const settings = require('./settings');
const legacyHighlights = require('./funVideo');
const RuntimeStore = require('../utils/runtimeStore');
const teamRecaps = require('./teamGameRecaps');
const fail = require('../utils/serviceError');
const TEAMS = {
  auburn: { id: 'auburn', name: 'Auburn football', shortName: 'Auburn', teamId: '2', league: 'football/college-football', sport: 'football', channels: ['auburn', 'espn college football', 'southeastern conference', 'sec'] },
  gsw: { id: 'gsw', name: 'Golden State Warriors', shortName: 'GSW', teamId: '9', league: 'basketball/nba', sport: 'basketball', channels: ['golden state warriors', 'nba', 'espn'] },
};
const BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const number = (value) => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value?.value ?? value?.displayValue ?? value)) ? Number(value?.value ?? value?.displayValue ?? value) : null;
const text = (value) => typeof value === 'string' ? value : null;
const api = (url, params) => axios.get(url, { params, timeout: 5000, maxContentLength: 2 * 1024 * 1024 });
function teamView(competitor) {
  return { id: String(competitor.team?.id || ''), name: competitor.team?.displayName || competitor.team?.name || 'Team', abbreviation: competitor.team?.abbreviation || '', logo: competitor.team?.logo || competitor.team?.logos?.[0]?.href || null,
    score: number(competitor.score), color: /^[a-f\d]{6}$/i.test(competitor.team?.color || '') ? `#${competitor.team.color}` : null,
    periods: (competitor.linescores || []).map((s) => number(s.value ?? s.displayValue)) };
}
function normalizeGame(event, team, summary = null, observedAt = Date.now()) {
  const competition = summary?.header?.competitions?.[0] || event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const reportedStatus = event.status || event.competitions?.[0]?.status || {};
  const status = { ...reportedStatus, ...competition.status, type: { ...reportedStatus.type, ...competition.status?.type } };
  const situation = summary?.situation || event.competitions?.[0]?.situation || {};
  const plays = team.sport === 'football'
    ? [...(summary?.drives?.previous || []), ...(summary?.drives?.current ? [summary.drives.current] : [])].flatMap((d) => d.plays || [])
    : summary?.plays || [];
  const seen = new Map();
  for (const play of plays) if (play.id || play.text) seen.set(play.id || play.text, play);
  return {
    id: String(event.id), trackedTeam: team.id, sport: team.sport, league: team.league,
    home: teamView(competitors.find((c) => c.homeAway === 'home') || {}), away: teamView(competitors.find((c) => c.homeAway === 'away') || {}),
    live: status.type?.state === 'in' && status.type?.completed !== true,
    status: status.type?.shortDetail || status.type?.detail || null,
    period: number(status.period), clock: text(status.displayClock),
    possession: situation.possession ? String(situation.possession) : null,
    downDistance: situation.downDistanceText || null,
    fieldPosition: situation.possessionText || null,
    yardLine: number(situation.yardLine),
    recentPlays: [...seen.values()].slice(-5).reverse().map((play) => ({ id: String(play.id || ''), text: play.text || play.shortText || 'Play detail unavailable', clock: play.clock?.displayValue || null, period: number(play.period?.number) })),
    leaders: [...(summary?.leaders || [])].sort((a, b) => Number(String(b.team?.id) === team.teamId) - Number(String(a.team?.id) === team.teamId)).flatMap((item) => (item.leaders || []).slice(0, 3).map((category) => {
      const leader = category.leaders?.[0];
      return leader ? { team: item.team?.abbreviation || '', category: category.displayName || category.name, name: leader.athlete?.displayName || 'Player', value: leader.displayValue ?? null } : null;
    })).filter(Boolean).slice(0, 6),
    observedAt, stale: false, detailsAvailable: !!summary,
  };
}
class SportsExperience {
  constructor() {
    this.snapshot = null; this.pending = null; this.nextRefresh = 0; this.override = null;
    this.highlights = new RuntimeStore('sports-team-highlights.json', {});
    this.highlightPending = new Map(); this.retryAfter = new Map();
  }
  async live() {
    if (this.pending) return this.pending;
    if (Date.now() < this.nextRefresh && this.snapshot) return this.snapshot;
    this.pending = this.fetchLive().finally(() => { this.pending = null; });
    return this.pending;
  }
  async fetchLive() {
    const previous = this.snapshot;
    const checkedAt = Date.now();
    const results = await Promise.all(Object.values(TEAMS).map(async (team) => {
      try {
        // Server timezone is configured by the mirror deployment. Request an
        // adjacent-day window so games crossing local midnight remain eligible.
        const days = [-1, 0, 1].map((offset) => { const d = new Date(checkedAt + offset * 86400000); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`; });
        // This endpoint rejects date ranges. Fetch each date explicitly and
        // deduplicate games that the provider includes on adjacent dates.
        const boards = await Promise.allSettled(days.map(async (dates) => {
          const response = await api(`${BASE}/${team.league}/scoreboard`, { dates, groups: team.id === 'auburn' ? 80 : undefined, limit: 1000 });
          if (!Array.isArray(response.data?.events)) throw new Error('Invalid scoreboard');
          return response.data.events;
        }));
        const successful = boards.filter((board) => board.status === 'fulfilled');
        if (!successful.length) throw new Error('Scoreboards unavailable');
        const complete = successful.length === boards.length;
        const byId = new Map();
        const rank = (event) => ({ pre: 0, in: 1, post: 2 }[(event.status || event.competitions?.[0]?.status)?.type?.state] ?? -1);
        for (const event of successful.flatMap((board) => board.value)) {
          const old = byId.get(String(event.id));
          if (!old || rank(event) >= rank(old)) byId.set(String(event.id), event);
        }
        const eligible = [...byId.values()].filter((event) => event.competitions?.[0]?.competitors?.some((c) => String(c.team?.id) === team.teamId));
        const games = await Promise.all(eligible.filter((event) => (event.status || event.competitions?.[0]?.status)?.type?.state === 'in').map(async (event) => {
          try {
            const summary = await api(`${BASE}/${team.league}/summary`, { event: event.id });
            return normalizeGame(event, team, summary.data, checkedAt);
          } catch (_) {
            const old = previous?.games?.find((g) => g.id === String(event.id));
            return old ? { ...old, stale: true } : normalizeGame(event, team, null, checkedAt);
          }
        }));
        const liveGames = games.filter((game) => game.live);
        const ended = new Set(eligible.filter((event) => (event.status || event.competitions?.[0]?.status)?.type?.state === 'post').map((event) => String(event.id)));
        for (const game of games) if (!game.live) ended.add(game.id);
        // A failed adjacent-day request cannot prove a retained game has ended.
        if (!complete) for (const old of previous?.games || []) {
          if (old.trackedTeam === team.id && !ended.has(old.id) && !liveGames.some((game) => game.id === old.id) && checkedAt - old.observedAt < 10 * 60000)
            liveGames.push({ ...old, stale: true });
        }
        return { team: team.id, games: liveGames, ok: complete, ended: [...ended] };
      } catch (_) {
        return { team: team.id, games: (previous?.games || []).filter((g) => g.trackedTeam === team.id && checkedAt - g.observedAt < 10 * 60000).map((g) => ({ ...g, stale: true })), ok: false };
      }
    }));
    this.snapshot = { games: results.flatMap((r) => r.games), failures: results.filter((r) => !r.ok).map((r) => r.team), checkedAt };
    this.nextRefresh = checkedAt + 20000;
    // Only expire on an authoritative completed/absent result, not a failed feed.
    if (this.override?.gameId && (results.some((result) => result.ended?.includes(this.override.gameId)) || !this.snapshot.failures.includes(this.override.team) && !this.snapshot.games.some((g) => g.id === this.override.gameId))) this.override = null;
    return this.snapshot;
  }
  async select(input) {
    if (!input || !['auto', 'highlights', 'game'].includes(input.mode) || Object.keys(input).some((key) => !['mode', 'gameId'].includes(key)) || input.mode !== 'game' && input.gameId !== undefined || input.mode === 'game' && (typeof input.gameId !== 'string' || !input.gameId.trim() || input.gameId.length > 80)) throw fail('invalid_sports_selection');
    const snapshot = await this.live();
    if (input.mode === 'auto') { this.override = null; return; }
    const priority = this.preferences().priority;
    const game = input.mode === 'game' ? snapshot.games.find((g) => g.id === input.gameId && !g.stale && g.live) : priority.map((id) => snapshot.games.find((g) => g.trackedTeam === id && g.live)).find(Boolean);
    if (!game) { if (input.mode === 'highlights') { this.override = null; return; } throw fail('live_game_unavailable', 409); }
    this.override = { mode: input.mode, gameId: game.id, team: game.trackedTeam };
  }
  preferences() {
    const team = settings.get('sports.highlightsTeam');
    const priority = settings.get('sports.livePriority');
    return { team: typeof team === 'string' && Object.hasOwn(TEAMS, team) ? team : 'gsw', auto: settings.get('sports.liveGames') !== false, priority: Array.isArray(priority) && priority.length === 2 && new Set(priority).size === 2 && priority.every((id) => typeof id === 'string' && Object.hasOwn(TEAMS, id)) ? priority : ['auburn', 'gsw'] };
  }
  buildRecapFeed(teamId, feed, options = {}) {
    const source = teamRecaps.SOURCES[teamId];
    return legacyHighlights.buildFeed({ ...feed, playbackMode: source?.playbackMode || 'embed', playbackMessage: source?.playbackMessage || null }, options);
  }
  async getHighlights(teamId) {
    if (teamId === 'gsw') {
      if (this.highlightPending.has('gsw')) return this.highlightPending.get('gsw');
      if (this.gswFeed && Date.now() < (this.retryAfter.get('gsw') || 0)) return this.gswFeed;
      const work = legacyHighlights.getCurrentFeed().then((feed) => {
        this.gswFeed = feed;
        if (feed.unavailable || feed.stale) this.retryAfter.set('gsw', Date.now() + 5 * 60000);
        return feed;
      }).finally(() => this.highlightPending.delete('gsw'));
      this.highlightPending.set('gsw', work);
      return work;
    }
    const stored = this.highlights.read()[teamId];
    const cached = stored?.feed?.schemaVersion === 2 && stored.feed.channelId === teamRecaps.SOURCES[teamId]?.channelId ? stored : null;
    if (cached && Date.now() - cached.updatedAt < 5 * 60000) return this.buildRecapFeed(teamId, cached.feed);
    if (Date.now() < (this.retryAfter.get(teamId) || 0)) return cached ? this.buildRecapFeed(teamId, cached.feed, { stale: true }) : this.unavailable(teamId);
    if (this.highlightPending.has(teamId)) return this.highlightPending.get(teamId);
    const work = this.fetchHighlights(teamId).catch(() => {
      this.retryAfter.set(teamId, Date.now() + 5 * 60000);
      return cached ? this.buildRecapFeed(teamId, cached.feed, { stale: true }) : this.unavailable(teamId);
    }).finally(() => this.highlightPending.delete(teamId));
    this.highlightPending.set(teamId, work); return work;
  }
  unavailable(teamId) {
    return legacyHighlights.buildFeed({ query: `${TEAMS[teamId].name} highlights`, items: [] }, { unavailable: true, message: 'Team highlights are temporarily unavailable. Check the highlight source connection.' });
  }
  async fetchHighlights(teamId) {
    const feed = await teamRecaps.fetchFeed(teamId);
    const saved = this.highlights.read(); saved[teamId] = { updatedAt: Date.now(), feed }; this.highlights.write(saved);
    return this.buildRecapFeed(teamId, feed);
  }

  selection(snapshot = this.snapshot) {
    if (!snapshot) return { games: [], tracker: null };
    const preferences = this.preferences();
    const games = [...snapshot.games].sort((a, b) => preferences.priority.indexOf(a.trackedTeam) - preferences.priority.indexOf(b.trackedTeam));
    const selected = this.override?.mode === 'game' ? games.find((g) => g.id === this.override.gameId) : games[0];
    return { games, tracker: selected && (this.override?.mode === 'game' || preferences.auto && this.override?.mode !== 'highlights') ? selected : null };
  }
  async getExperience({ includeHighlights = true } = {}) {
    const snapshot = await this.live();
    const preferences = this.preferences();
    const { tracker } = this.selection(snapshot);
    const videoFeed = includeHighlights && (!tracker || tracker.stale) ? await this.getHighlights(preferences.team) : null;
    return { teams: Object.values(TEAMS).map(({ id, name, shortName }) => ({ id, name, shortName })), preferences, games: snapshot.games, tracker, mode: tracker ? 'game' : 'highlights', override: this.override, failures: snapshot.failures, checkedAt: snapshot.checkedAt, videoFeed };
  }
}
module.exports = new SportsExperience();
module.exports.SportsExperience = SportsExperience;
module.exports.normalizeGame = normalizeGame;
module.exports.TEAMS = TEAMS;
