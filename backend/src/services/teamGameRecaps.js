const axios = require('axios');
const gameRecap = require('./funGameRecap');
const RuntimeStore = require('../utils/runtimeStore');

const SOURCES = {
  auburn: { name: 'Auburn football', teamId: '2', league: 'football/college-football', channelId: 'UCzRWWsFjqHk1an4OnVPsl9g', channelTitle: 'ESPN College Football' },
};
const MINUTE = 60000;
const normalized = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function mentionsTeam(title, team) {
  const text = ` ${normalized(title)} `;
  const aliases = [team.displayName, team.location, team.abbrev];
  return aliases.some((alias) => normalized(alias) && text.includes(` ${normalized(alias)} `));
}
function matchesGame(video, game, source) {
  const title = video.snippet?.title || '';
  const published = Date.parse(video.snippet?.publishedAt);
  const kickoff = Date.parse(game.date);
  return video.snippet?.channelId === source.channelId && /\bhighlights?\b/i.test(title)
    && !/reaction|simulation|madden|preview/i.test(title)
    && mentionsTeam(title, game.home) && mentionsTeam(title, game.away)
    && Number.isFinite(published) && published >= kickoff - 6 * 60 * MINUTE && published <= kickoff + 7 * 24 * 60 * MINUTE;
}
const request = (url, params) => axios.get(url, { params, timeout: 8000, maxContentLength: 2 * 1024 * 1024 });
async function mapLimited(values, limit, fn) {
  const result = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) { const index = next++; result[index] = await fn(values[index]); }
  }));
  return result;
}
class TeamGameRecaps {
  constructor() { this.cache = new RuntimeStore('sports-recap-games.json', { games: {} }); }
  async findVideo(game, source) {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return null;
    const start = Date.parse(game.date);
    const response = await request('https://www.googleapis.com/youtube/v3/search', {
      key, part: 'snippet', type: 'video', channelId: source.channelId,
      q: `${game.away.displayName} ${game.home.displayName} highlights`, maxResults: 8,
      publishedAfter: new Date(start - 6 * 60 * MINUTE).toISOString(),
      publishedBefore: new Date(Math.min(Date.now(), start + 7 * 24 * 60 * MINUTE)).toISOString(),
      videoEmbeddable: 'true', videoSyndicated: 'true',
    });
    const candidates = (response.data?.items || []).filter((video) => /^[\w-]{11}$/.test(video.id?.videoId || '') && matchesGame(video, game, source));
    if (!candidates.length) return null;
    const details = await request('https://www.googleapis.com/youtube/v3/videos', { key, id: candidates.map((video) => video.id.videoId).join(','), part: 'status,snippet,contentDetails' });
    const allowed = new Map((details.data?.items || []).filter((video) => matchesGame(video, game, source)
      && video.status?.embeddable === true && video.status?.privacyStatus === 'public'
      && video.snippet?.liveBroadcastContent === 'none' && video.contentDetails?.contentRating?.ytRating !== 'ytAgeRestricted'
      && !(video.contentDetails?.regionRestriction?.blocked || []).includes('US')
      && (!video.contentDetails?.regionRestriction?.allowed || video.contentDetails.regionRestriction.allowed.includes('US'))).map((video) => [video.id, video]));
    // Prefer full-game highlights when the same channel also posts short clips.
    const hit = [...candidates].sort((a, b) => Number(/full.{0,8}game|game highlights/i.test(b.snippet.title)) - Number(/full.{0,8}game|game highlights/i.test(a.snippet.title))).find((video) => allowed.has(video.id.videoId));
    if (!hit) return null;
    return { videoId: hit.id.videoId, title: allowed.get(hit.id.videoId).snippet.title, channelId: source.channelId, channelTitle: source.channelTitle, publishedAt: hit.snippet.publishedAt };
  }
  async fetchFeed(teamId) {
    const source = SOURCES[teamId];
    if (!source) throw new Error('Unsupported recap team');
    const now = new Date();
    const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric' }).format(now));
    const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric' }).format(now));
    const options = { ...source, sport: 'football', season: month >= 3 ? year : year - 1, seasonTypes: ['2', '3'], count: 10, includePreviousSeason: true };
    const games = await gameRecap.fetchRecentGames(options);
    const items = await mapLimited(games, 3, async (game) => {
      const id = `${teamId}:${game.gameId}`;
      const saved = this.cache.read().games[id] || {};
      const stamp = Date.now();
      const age = stamp - Date.parse(game.date);
      const missingRetry = age < 2 * 24 * 60 * MINUTE ? 60 * MINUTE : age < 7 * 24 * 60 * MINUTE ? 6 * 60 * MINUTE : 7 * 24 * 60 * MINUTE;
      const needsVideo = saved.channelId !== source.channelId || !saved.videoCheckedAt || stamp - saved.videoCheckedAt > (saved.video && !saved.video.unavailable ? 7 * 24 * 60 * MINUTE : missingRetry);
      const needsBox = !saved.boxCheckedAt || stamp - saved.boxCheckedAt > (saved.boxScore?.team ? 24 * 60 * MINUTE : 5 * MINUTE);
      const [video, boxScore] = await Promise.all([
        needsVideo ? this.findVideo(game, source).catch(() => saved.channelId === source.channelId ? saved.video || null : null) : saved.video || null,
        needsBox ? gameRecap.fetchBoxScore(game.gameId, source.teamId, options) : saved.boxScore,
      ]);
      const store = this.cache.read();
      store.games[id] = { video, boxScore, date: game.date, channelId: source.channelId, videoCheckedAt: needsVideo ? stamp : saved.videoCheckedAt, boxCheckedAt: needsBox ? stamp : saved.boxCheckedAt };
      const keys = Object.keys(store.games).sort((a, b) => Date.parse(store.games[b].date) - Date.parse(store.games[a].date));
      for (const key of keys.slice(100)) delete store.games[key];
      this.cache.write(store);
      return { videoId: null, title: `${game.away.displayName} vs ${game.home.displayName}`, channelTitle: source.channelTitle, channelId: source.channelId,
        ...video, game: { ...game, sport: 'football', boxScore: boxScore || null },
        unavailable: !video || video.unavailable === true, message: video?.message || (video ? null : `Game highlights are not available from ${source.channelTitle}. Scores and available box-score statistics remain accessible.`) };
    });
    return { provider: source.provider || 'youtube', mode: 'game_recap', schemaVersion: 2, query: `${source.name} Game Highlights`, channelId: source.channelId, channelTitle: source.channelTitle,
      playbackMode: source.playbackMode || 'embed', playbackMessage: source.playbackMessage || null,
      items, date: now.toISOString().slice(0, 10), fetchedAt: now.toISOString(), rotationSeconds: 90 };
  }
}
module.exports = new TeamGameRecaps();
module.exports.TeamGameRecaps = TeamGameRecaps;
module.exports.SOURCES = SOURCES;
module.exports.matchesGame = matchesGame;
