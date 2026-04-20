const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

const gameRecap = require('./funGameRecap');

const DATA_DIR = path.join(__dirname, '../../data/fun-video');
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const DEFAULT_PROVIDER = 'youtube';
const DEFAULT_QUERY = 'Stephen Curry highlights';
const DEFAULT_REGION_CODE = 'US';
const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_ROTATION_SECONDS = 90;
const DEFAULT_TIMEZONE = process.env.TZ || 'America/Chicago';
const DEFAULT_MAX_SEARCH_PAGES = 10;
const DEFAULT_MIN_DURATION_SECONDS = 90;
const DEFAULT_DAILY_REFRESH_HOUR = 5;
const DEFAULT_DAILY_REFRESH_MINUTE = 0;
const DEFAULT_GAME_REFRESH_DELAY_MINUTES = 60;
const DEFAULT_EXPECTED_GAME_DURATION_MINUTES = 180;
const DEFAULT_GAME_SCHEDULE_POLL_MINUTES = 5;
const DEFAULT_IDLE_RECHECK_HOURS = 12;
const MIN_SCHEDULE_DELAY_MS = 1000;
const DEFAULT_ALLOWED_CHANNEL_MATCHES = [
  'espn',
  'golden state warriors',
  'golden hoops',
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDateKey(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getQuery() {
  return String(process.env.FUN_VIDEO_QUERY || DEFAULT_QUERY).trim() || DEFAULT_QUERY;
}

function getMaxResults() {
  const parsed = Number.parseInt(process.env.FUN_VIDEO_MAX_RESULTS || String(DEFAULT_MAX_RESULTS), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_RESULTS;
  }
  return clamp(parsed, 1, 10);
}

function getRotationSeconds() {
  const parsed = Number.parseInt(process.env.FUN_VIDEO_ROTATION_SECONDS || String(DEFAULT_ROTATION_SECONDS), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ROTATION_SECONDS;
  }
  return clamp(parsed, 15, 600);
}

function getMaxSearchPages() {
  const parsed = Number.parseInt(process.env.FUN_VIDEO_MAX_SEARCH_PAGES || String(DEFAULT_MAX_SEARCH_PAGES), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_SEARCH_PAGES;
  }
  return clamp(parsed, 1, 20);
}

function getMinDurationSeconds() {
  const parsed = Number.parseInt(process.env.FUN_VIDEO_MIN_DURATION_SECONDS || String(DEFAULT_MIN_DURATION_SECONDS), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MIN_DURATION_SECONDS;
  }
  return clamp(parsed, 30, 3600);
}

function getRefreshHour() {
  const parsed = Number.parseInt(process.env.FUN_VIDEO_REFRESH_HOUR || String(DEFAULT_DAILY_REFRESH_HOUR), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_DAILY_REFRESH_HOUR;
  }
  return clamp(parsed, 0, 23);
}

function getGameRefreshDelayMinutes() {
  const parsed = Number.parseInt(
    process.env.FUN_VIDEO_GAME_REFRESH_DELAY_MINUTES || String(DEFAULT_GAME_REFRESH_DELAY_MINUTES),
    10
  );
  if (!Number.isFinite(parsed)) {
    return DEFAULT_GAME_REFRESH_DELAY_MINUTES;
  }
  return clamp(parsed, 5, 360);
}

function getExpectedGameDurationMinutes() {
  const parsed = Number.parseInt(
    process.env.FUN_VIDEO_GAME_DURATION_MINUTES || String(DEFAULT_EXPECTED_GAME_DURATION_MINUTES),
    10
  );
  if (!Number.isFinite(parsed)) {
    return DEFAULT_EXPECTED_GAME_DURATION_MINUTES;
  }
  return clamp(parsed, 90, 360);
}

function getGameSchedulePollMinutes() {
  const parsed = Number.parseInt(
    process.env.FUN_VIDEO_GAME_SCHEDULE_POLL_MINUTES || String(DEFAULT_GAME_SCHEDULE_POLL_MINUTES),
    10
  );
  if (!Number.isFinite(parsed)) {
    return DEFAULT_GAME_SCHEDULE_POLL_MINUTES;
  }
  return clamp(parsed, 1, 60);
}

function getIdleRecheckHours() {
  const parsed = Number.parseInt(
    process.env.FUN_VIDEO_IDLE_RECHECK_HOURS || String(DEFAULT_IDLE_RECHECK_HOURS),
    10
  );
  if (!Number.isFinite(parsed)) {
    return DEFAULT_IDLE_RECHECK_HOURS;
  }
  return clamp(parsed, 1, 48);
}

function getTimeZoneOffsetMinutes(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const offsetText = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT';
  if (offsetText === 'GMT' || offsetText === 'UTC') {
    return 0;
  }

  const match = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i.exec(offsetText);
  if (!match) {
    return 0;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number.parseInt(match[2] || '0', 10);
  const minutes = Number.parseInt(match[3] || '0', 10);
  return sign * ((hours * 60) + minutes);
}

function getLocalDateParts(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number.parseInt(parts.year, 10),
    month: Number.parseInt(parts.month, 10),
    day: Number.parseInt(parts.day, 10),
  };
}

function addDaysToDateParts(dateParts, days) {
  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function zonedDateTimeToUtcTimestamp(dateParts, hour, minute = 0, second = 0, timeZone = DEFAULT_TIMEZONE) {
  let timestamp = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute, second);

  for (let i = 0; i < 3; i += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(timestamp), timeZone);
    const adjusted = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute, second)
      - (offsetMinutes * 60 * 1000);
    if (adjusted === timestamp) {
      break;
    }
    timestamp = adjusted;
  }

  return timestamp;
}

function getNextDailyRefreshDelayMs(
  now = new Date(),
  hour = getRefreshHour(),
  minute = DEFAULT_DAILY_REFRESH_MINUTE,
  second = 0,
  timeZone = DEFAULT_TIMEZONE
) {
  const today = getLocalDateParts(now, timeZone);
  let nextTimestamp = zonedDateTimeToUtcTimestamp(today, hour, minute, second, timeZone);

  if (nextTimestamp <= now.getTime()) {
    nextTimestamp = zonedDateTimeToUtcTimestamp(addDaysToDateParts(today, 1), hour, minute, second, timeZone);
  }

  return Math.max(nextTimestamp - now.getTime(), 0);
}

function parseTimestampMs(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function getScheduleStatus(event) {
  return event?.competitions?.[0]?.status?.type || {};
}

function isCompletedScheduleEvent(event) {
  return getScheduleStatus(event).completed === true;
}

function isInProgressScheduleEvent(event) {
  return getScheduleStatus(event).state === 'in';
}

function isUpcomingScheduleEvent(event) {
  return getScheduleStatus(event).state === 'pre';
}

function getExpectedGameRefreshAt(
  event,
  expectedGameDurationMinutes = getExpectedGameDurationMinutes(),
  refreshDelayMinutes = getGameRefreshDelayMinutes()
) {
  const startMs = parseTimestampMs(event?.date);
  if (!Number.isFinite(startMs)) {
    return null;
  }

  return new Date(startMs + ((expectedGameDurationMinutes + refreshDelayMinutes) * 60 * 1000));
}

function getObservedCompletionRefreshAt(
  gameId,
  observedCompletedAtMsByGameId,
  refreshDelayMinutes = getGameRefreshDelayMinutes()
) {
  if (!(observedCompletedAtMsByGameId instanceof Map) || !gameId) {
    return null;
  }

  const observedCompletedAtMs = observedCompletedAtMsByGameId.get(String(gameId));
  if (!Number.isFinite(observedCompletedAtMs)) {
    return null;
  }

  return new Date(observedCompletedAtMs + (refreshDelayMinutes * 60 * 1000));
}

function feedIncludesGame(feed, gameId) {
  if (!feed || !Array.isArray(feed.items) || !gameId) {
    return false;
  }

  return feed.items.some((item) => String(item?.game?.gameId || '') === String(gameId));
}

function getGameRecapRefreshPlan(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const currentFeed = options.currentFeed || null;
  const scheduleEvents = Array.isArray(options.scheduleEvents) ? options.scheduleEvents : [];
  const expectedGameDurationMinutes = Number.isFinite(options.expectedGameDurationMinutes)
    ? options.expectedGameDurationMinutes
    : getExpectedGameDurationMinutes();
  const refreshDelayMinutes = Number.isFinite(options.refreshDelayMinutes)
    ? options.refreshDelayMinutes
    : getGameRefreshDelayMinutes();
  const observedCompletedAtMsByGameId = options.observedCompletedAtMsByGameId instanceof Map
    ? options.observedCompletedAtMsByGameId
    : null;
  const pollMinutes = Number.isFinite(options.pollMinutes)
    ? options.pollMinutes
    : getGameSchedulePollMinutes();
  const idleRecheckHours = Number.isFinite(options.idleRecheckHours)
    ? options.idleRecheckHours
    : getIdleRecheckHours();

  const normalizedEvents = scheduleEvents
    .filter((event) => event?.id)
    .filter((event) => (
      isCompletedScheduleEvent(event)
      || isInProgressScheduleEvent(event)
      || isUpcomingScheduleEvent(event)
    ));

  const completedGames = normalizedEvents
    .filter((event) => isCompletedScheduleEvent(event))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const activeGames = normalizedEvents
    .filter((event) => isInProgressScheduleEvent(event))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcomingGames = normalizedEvents
    .filter((event) => isUpcomingScheduleEvent(event))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const latestCompletedGame = completedGames[0] || null;
  const activeGame = activeGames[0] || null;
  const nextUpcomingGame = upcomingGames[0] || null;
  const feedFetchedAtMs = parseTimestampMs(currentFeed?.fetchedAt);
  const latestCompletedGameId = latestCompletedGame ? String(latestCompletedGame.id) : null;
  const latestCompletedRefreshAt = latestCompletedGame
    ? (
      getObservedCompletionRefreshAt(latestCompletedGameId, observedCompletedAtMsByGameId, refreshDelayMinutes)
      || getExpectedGameRefreshAt(latestCompletedGame, expectedGameDurationMinutes, refreshDelayMinutes)
    )
    : null;
  const latestGameIsInFeed = latestCompletedGameId ? feedIncludesGame(currentFeed, latestCompletedGameId) : false;
  const latestGameIsFresh = Boolean(
    latestCompletedGame
    && latestGameIsInFeed
    && Number.isFinite(feedFetchedAtMs)
    && latestCompletedRefreshAt
    && feedFetchedAtMs >= latestCompletedRefreshAt.getTime()
  );

  if (
    latestCompletedGame
    && latestCompletedRefreshAt
    && now.getTime() >= latestCompletedRefreshAt.getTime()
    && !latestGameIsFresh
  ) {
    return {
      shouldRefreshNow: true,
      reason: 'postgame_refresh_due',
      nextCheckAt: now,
      targetGameId: latestCompletedGameId,
      targetRefreshAt: latestCompletedRefreshAt,
    };
  }

  if (latestCompletedGame && latestCompletedRefreshAt && now.getTime() < latestCompletedRefreshAt.getTime()) {
    return {
      shouldRefreshNow: false,
      reason: 'awaiting_postgame_window',
      nextCheckAt: latestCompletedRefreshAt,
      targetGameId: latestCompletedGameId,
      targetRefreshAt: latestCompletedRefreshAt,
    };
  }

  if (activeGame) {
    const activeRefreshAt = getExpectedGameRefreshAt(activeGame, expectedGameDurationMinutes, refreshDelayMinutes);
    const fallbackCheckAt = new Date(now.getTime() + (pollMinutes * 60 * 1000));
    return {
      shouldRefreshNow: false,
      reason: 'game_in_progress',
      nextCheckAt: activeRefreshAt && activeRefreshAt.getTime() > now.getTime() ? activeRefreshAt : fallbackCheckAt,
      targetGameId: String(activeGame.id),
      targetRefreshAt: activeRefreshAt,
    };
  }

  if (nextUpcomingGame) {
    const nextRefreshAt = getExpectedGameRefreshAt(nextUpcomingGame, expectedGameDurationMinutes, refreshDelayMinutes);
    const fallbackCheckAt = new Date(now.getTime() + (idleRecheckHours * 60 * 60 * 1000));
    return {
      shouldRefreshNow: false,
      reason: 'awaiting_next_game',
      nextCheckAt: nextRefreshAt && nextRefreshAt.getTime() > now.getTime() ? nextRefreshAt : fallbackCheckAt,
      targetGameId: String(nextUpcomingGame.id),
      targetRefreshAt: nextRefreshAt,
    };
  }

  return {
    shouldRefreshNow: false,
    reason: 'idle_recheck',
    nextCheckAt: new Date(now.getTime() + (idleRecheckHours * 60 * 60 * 1000)),
    targetGameId: latestCompletedGameId,
    targetRefreshAt: latestCompletedRefreshAt,
  };
}

function normalizeChannelText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim();
}

function getAllowedChannelMatches() {
  const configured = String(process.env.FUN_VIDEO_ALLOWED_CHANNELS || '')
    .split(',')
    .map((value) => normalizeChannelText(value))
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_ALLOWED_CHANNEL_MATCHES;
}

function haveSameAllowedChannels(value) {
  if (!Array.isArray(value)) {
    return false;
  }

  const expected = getAllowedChannelMatches();
  if (value.length !== expected.length) {
    return false;
  }

  return value.every((entry, index) => entry === expected[index]);
}

function isAllowedChannel(channelTitle) {
  const normalizedTitle = normalizeChannelText(channelTitle);
  if (!normalizedTitle) {
    return false;
  }

  return getAllowedChannelMatches().some((candidate) => {
    if (normalizedTitle === candidate) {
      return true;
    }

    if (candidate.includes(' ') && normalizedTitle.includes(candidate)) {
      return true;
    }

    return false;
  });
}

function parseIsoDurationSeconds(value) {
  const text = String(value || '').trim();
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(text);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1] || '0', 10);
  const minutes = Number.parseInt(match[2] || '0', 10);
  const seconds = Number.parseInt(match[3] || '0', 10);
  return (hours * 3600) + (minutes * 60) + seconds;
}

function parseEmbedDimensions(embedHtml) {
  const html = String(embedHtml || '');
  const widthMatch = /width="(\d+)"/i.exec(html);
  const heightMatch = /height="(\d+)"/i.exec(html);
  const width = widthMatch ? Number.parseInt(widthMatch[1], 10) : null;
  const height = heightMatch ? Number.parseInt(heightMatch[1], 10) : null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function hasShortsKeywords(...values) {
  const text = values
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  if (!text) {
    return false;
  }
  return /#shorts\b|\bshorts\b|\/shorts\//i.test(text);
}

function buildFilterConfig() {
  return {
    allowedChannels: getAllowedChannelMatches(),
    minDurationSeconds: getMinDurationSeconds(),
  };
}

function haveSameFilterConfig(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return haveSameAllowedChannels(value.allowedChannels)
    && Number(value.minDurationSeconds) === getMinDurationSeconds();
}

function decodeHtmlEntities(text) {
  const str = String(text || '');
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function buildEmbedUrl(videoId) {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    loop: '1',
    playlist: videoId,
    iv_load_policy: '3',
    fs: '0',
    disablekb: '1',
    vq: 'hd1080',
  });

  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

function normalizeVideoItem(item) {
  const videoId = item?.id?.videoId;
  const snippet = item?.snippet || {};
  if (!videoId) {
    return null;
  }

  return {
    videoId,
    title: decodeHtmlEntities(snippet.title || 'Stephen Curry highlight'),
    channelTitle: decodeHtmlEntities(snippet.channelTitle || 'YouTube'),
    channelId: snippet.channelId || null,
    publishedAt: snippet.publishedAt || null,
    thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null,
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
  };
}

class FunVideoService {
  constructor() {
    this.dailyRefreshTimeout = null;
    this.pendingGameIds = new Set();
    this.observedCompletedAtMsByGameId = new Map();
  }

  async ensureDataDir() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  getCachePath(dateKey) {
    return path.join(DATA_DIR, `${dateKey}.json`);
  }

  async readCachedFeed(dateKey) {
    try {
      const raw = await fs.readFile(this.getCachePath(dateKey), 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.items) || parsed.items.length === 0) {
        return null;
      }
      if (!haveSameFilterConfig(parsed?.filterConfig)) {
        return null;
      }
      return parsed;
    } catch (_) {
      return null;
    }
  }

  async getLatestCachedFeed() {
    await this.ensureDataDir();

    const entries = await fs.readdir(DATA_DIR);
    const cacheFiles = entries
      .filter((entry) => /^\d{4}-\d{2}-\d{2}\.json$/.test(entry))
      .sort()
      .reverse();

    for (const filename of cacheFiles) {
      const cached = await this.readCachedFeed(filename.replace(/\.json$/, ''));
      if (cached) {
        return cached;
      }
    }

    return null;
  }

  buildFeed(payload, options = {}) {
    const stale = options.stale === true;
    const unavailable = options.unavailable === true;
    const message = options.message || null;
    const items = Array.isArray(payload?.items)
      ? payload.items.map((item) => ({
        ...item,
        embedUrl: buildEmbedUrl(item.videoId),
      }))
      : [];

    return {
      provider: DEFAULT_PROVIDER,
      mode: payload?.mode || 'search',
      query: payload?.query || getQuery(),
      date: payload?.date || getDateKey(),
      items,
      rotationSeconds: payload?.rotationSeconds || getRotationSeconds(),
      fetchedAt: payload?.fetchedAt || null,
      stale,
      unavailable,
      message,
    };
  }

  buildUnavailableFeed(message) {
    return this.buildFeed({
      provider: DEFAULT_PROVIDER,
      query: getQuery(),
      date: getDateKey(),
      items: [],
      rotationSeconds: getRotationSeconds(),
      fetchedAt: null,
    }, {
      unavailable: true,
      message,
    });
  }

  async fetchDailyFeed(dateKey) {
    const apiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY is not configured');
    }

    const seen = new Set();
    const items = [];
    const filterConfig = buildFilterConfig();
    const allowedMatches = filterConfig.allowedChannels;
    let pageToken;
    let pagesFetched = 0;
    const maxResults = getMaxResults();
    const maxSearchPages = getMaxSearchPages();

    while (items.length < maxResults && pagesFetched < maxSearchPages) {
      const response = await axios.get(YOUTUBE_SEARCH_URL, {
        timeout: 20000,
        params: {
          key: apiKey,
          part: 'snippet',
          type: 'video',
          order: 'date',
          maxResults: 50,
          q: getQuery(),
          regionCode: DEFAULT_REGION_CODE,
          videoEmbeddable: 'true',
          videoSyndicated: 'true',
          videoDefinition: 'high',
          videoDuration: 'medium',
          pageToken,
        },
      });

      pagesFetched += 1;

      const pageItems = response.data?.items || [];
      const candidateIds = pageItems
        .map((item) => item?.id?.videoId)
        .filter((videoId) => typeof videoId === 'string' && videoId.length > 0);
      const detailsMap = new Map();

      if (candidateIds.length > 0) {
        const detailsResponse = await axios.get(YOUTUBE_VIDEOS_URL, {
          timeout: 20000,
          params: {
            key: apiKey,
            part: 'contentDetails,snippet,player',
            id: candidateIds.join(','),
          },
        });

        for (const detail of detailsResponse.data?.items || []) {
          if (detail?.id) {
            detailsMap.set(detail.id, detail);
          }
        }
      }

      for (const item of pageItems) {
        const normalized = normalizeVideoItem(item);
        if (!normalized || seen.has(normalized.videoId)) {
          continue;
        }

        if (!isAllowedChannel(normalized.channelTitle)) {
          continue;
        }

        const details = detailsMap.get(normalized.videoId);
        const durationSeconds = parseIsoDurationSeconds(details?.contentDetails?.duration);
        if (Number.isFinite(durationSeconds) && durationSeconds < filterConfig.minDurationSeconds) {
          continue;
        }

        const detailsSnippet = details?.snippet || {};
        if (hasShortsKeywords(
          normalized.title,
          item?.snippet?.description,
          detailsSnippet.title,
          detailsSnippet.description
        )) {
          continue;
        }

        if (detailsSnippet.liveBroadcastContent && detailsSnippet.liveBroadcastContent !== 'none') {
          continue;
        }

        const dimensions = parseEmbedDimensions(details?.player?.embedHtml);
        if (dimensions && dimensions.height > dimensions.width) {
          continue;
        }

        seen.add(normalized.videoId);
        items.push(normalized);

        if (items.length >= maxResults) {
          break;
        }
      }

      pageToken = response.data?.nextPageToken;
      if (!pageToken) {
        break;
      }
    }

    if (items.length === 0) {
      throw new Error(`No embeddable Stephen Curry videos were returned from allowed channels: ${allowedMatches.join(', ')}`);
    }

    if (items.length < maxResults) {
      logger.warn('YouTube fun feed returned fewer allowed videos than requested', {
        found: items.length,
        requested: maxResults,
        pagesFetched,
        maxSearchPages,
        allowedChannels: allowedMatches,
      });
    }

    const payload = {
      provider: DEFAULT_PROVIDER,
      query: getQuery(),
      filterConfig,
      date: dateKey,
      items,
      rotationSeconds: getRotationSeconds(),
      fetchedAt: new Date().toISOString(),
    };

    await fs.writeFile(this.getCachePath(dateKey), JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  getFeedMode() {
    return String(process.env.FUN_VIDEO_MODE || 'search').trim().toLowerCase();
  }

  async fetchGameRecapFeed(dateKey) {
    const apiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY is not configured');
    }

    const recaps = await gameRecap.fetchGameRecaps();
    const items = [];

    for (const recap of recaps) {
      try {
        const response = await axios.get(YOUTUBE_SEARCH_URL, {
          timeout: 15000,
          params: {
            key: apiKey,
            part: 'snippet',
            type: 'video',
            q: recap.searchQuery,
            maxResults: 3,
            videoEmbeddable: 'true',
            videoSyndicated: 'true',
          },
        });

        const hit = (response.data?.items || [])[0];
        const videoId = hit?.id?.videoId;
        if (!videoId) {
          logger.warn('No YouTube result for game recap query', { query: recap.searchQuery });
          continue;
        }

        items.push({
          videoId,
          title: decodeHtmlEntities(hit.snippet?.title || recap.searchQuery),
          channelTitle: decodeHtmlEntities(hit.snippet?.channelTitle || 'NBA'),
          channelId: hit.snippet?.channelId || null,
          publishedAt: hit.snippet?.publishedAt || null,
          thumbnailUrl: hit.snippet?.thumbnails?.high?.url || null,
          watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
          game: {
            gameId: recap.gameId,
            date: recap.date,
            dateFormatted: recap.dateFormatted,
            homeAway: recap.homeAway,
            result: recap.result,
            score: recap.score,
            home: recap.home,
            away: recap.away,
            opponent: recap.opponent,
            boxScore: recap.boxScore,
          },
        });
      } catch (error) {
        logger.warn('YouTube search failed for game recap', {
          query: recap.searchQuery,
          error: error.message,
        });
      }
    }

    if (items.length === 0) {
      throw new Error('No game recap videos found');
    }

    const payload = {
      provider: DEFAULT_PROVIDER,
      mode: 'game_recap',
      query: 'Warriors Game Highlights',
      filterConfig: buildFilterConfig(),
      date: dateKey,
      items,
      rotationSeconds: getRotationSeconds(),
      fetchedAt: new Date().toISOString(),
    };

    await fs.writeFile(this.getCachePath(dateKey), JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  async getCurrentFeed(options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const dateKey = getDateKey();
    const mode = this.getFeedMode();

    await this.ensureDataDir();

    if (!forceRefresh) {
      const cached = await this.readCachedFeed(dateKey);
      if (cached && (cached.mode || 'search') === mode) {
        return this.buildFeed(cached);
      }
    }

    try {
      const fetched = mode === 'game_recap'
        ? await this.fetchGameRecapFeed(dateKey)
        : await this.fetchDailyFeed(dateKey);
      return this.buildFeed(fetched);
    } catch (error) {
      logger.warn('Failed to refresh daily YouTube fun feed', {
        error: error.message,
        mode,
        query: getQuery(),
      });

      const cachedToday = await this.readCachedFeed(dateKey);
      if (cachedToday) {
        return this.buildFeed(cachedToday, { stale: true });
      }

      const latestCached = await this.getLatestCachedFeed();
      if (latestCached) {
        return this.buildFeed(latestCached, { stale: true });
      }

      return this.buildUnavailableFeed('Game highlights are temporarily unavailable');
    }
  }

  setNextScheduleTimeout(delayMs, run) {
    const safeDelayMs = Math.max(delayMs, MIN_SCHEDULE_DELAY_MS);
    this.dailyRefreshTimeout = setTimeout(() => {
      run().catch((error) => {
        logger.warn('Game highlights refresh scheduler tick failed', { error: error.message });
        this.setNextScheduleTimeout(getGameSchedulePollMinutes() * 60 * 1000, run);
      });
    }, safeDelayMs);

    if (typeof this.dailyRefreshTimeout?.unref === 'function') {
      this.dailyRefreshTimeout.unref();
    }
  }

  observeGameScheduleTransitions(scheduleEvents, observedAt = new Date()) {
    const nextPendingGameIds = new Set();

    for (const event of Array.isArray(scheduleEvents) ? scheduleEvents : []) {
      const gameId = String(event?.id || '');
      if (!gameId) {
        continue;
      }

      if (isUpcomingScheduleEvent(event) || isInProgressScheduleEvent(event)) {
        nextPendingGameIds.add(gameId);
        continue;
      }

      if (
        isCompletedScheduleEvent(event)
        && this.pendingGameIds.has(gameId)
        && !this.observedCompletedAtMsByGameId.has(gameId)
      ) {
        this.observedCompletedAtMsByGameId.set(gameId, observedAt.getTime());
      }
    }

    const knownGameIds = new Set(
      (Array.isArray(scheduleEvents) ? scheduleEvents : [])
        .map((event) => String(event?.id || ''))
        .filter(Boolean)
    );

    for (const gameId of this.observedCompletedAtMsByGameId.keys()) {
      if (!knownGameIds.has(gameId)) {
        this.observedCompletedAtMsByGameId.delete(gameId);
      }
    }

    this.pendingGameIds = nextPendingGameIds;
  }

  startDailyRefreshSchedule(options = {}) {
    const refreshHour = Number.isFinite(options.hour) ? clamp(options.hour, 0, 23) : getRefreshHour();
    const refreshMinute = Number.isFinite(options.minute)
      ? clamp(options.minute, 0, 59)
      : DEFAULT_DAILY_REFRESH_MINUTE;
    const timeZone = String(options.timeZone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
    const onRefresh = typeof options.onRefresh === 'function' ? options.onRefresh : null;

    this.stopDailyRefreshSchedule();

    const scheduleNextRun = async () => {
      const mode = this.getFeedMode();

      if (mode === 'game_recap') {
        const now = new Date();
        let currentFeed = await this.getLatestCachedFeed();
        const scheduleEvents = await gameRecap.fetchScheduleEvents();
        this.observeGameScheduleTransitions(scheduleEvents, now);
        let plan = getGameRecapRefreshPlan({
          now,
          currentFeed,
          scheduleEvents,
          observedCompletedAtMsByGameId: this.observedCompletedAtMsByGameId,
        });

        if (plan.shouldRefreshNow) {
          currentFeed = await this.getCurrentFeed({ forceRefresh: true });
          logger.info('Postgame highlights refresh completed', {
            mode: currentFeed?.mode || null,
            items: Array.isArray(currentFeed?.items) ? currentFeed.items.length : 0,
            stale: currentFeed?.stale === true,
            unavailable: currentFeed?.unavailable === true,
            fetchedAt: currentFeed?.fetchedAt || null,
            targetGameId: plan.targetGameId,
            targetRefreshAt: plan.targetRefreshAt?.toISOString() || null,
          });

          if (onRefresh) {
            await onRefresh(currentFeed);
          }

          plan = getGameRecapRefreshPlan({
            now: new Date(),
            currentFeed,
            scheduleEvents,
            observedCompletedAtMsByGameId: this.observedCompletedAtMsByGameId,
          });
        }

        const nextCheckAt = plan.nextCheckAt instanceof Date ? plan.nextCheckAt : new Date(Date.now() + (getGameSchedulePollMinutes() * 60 * 1000));
        const delayMs = Math.max(nextCheckAt.getTime() - Date.now(), MIN_SCHEDULE_DELAY_MS);

        logger.info('Scheduled game highlights refresh check', {
          mode,
          reason: plan.reason,
          targetGameId: plan.targetGameId || null,
          targetRefreshAt: plan.targetRefreshAt?.toISOString() || null,
          nextCheckAt: nextCheckAt.toISOString(),
          delayMs,
        });

        this.setNextScheduleTimeout(delayMs, scheduleNextRun);
        return;
      }

      const now = new Date();
      const delayMs = getNextDailyRefreshDelayMs(now, refreshHour, refreshMinute, 0, timeZone);
      const nextRunAt = new Date(now.getTime() + delayMs);

      logger.info('Scheduled daily game highlights refresh', {
        refreshHour,
        refreshMinute,
        timeZone,
        nextRunAt: nextRunAt.toISOString(),
        delayMs,
      });

      this.setNextScheduleTimeout(delayMs, async () => {
        const feed = await this.getCurrentFeed({ forceRefresh: true });
        logger.info('Daily game highlights refresh completed', {
          timeZone,
          refreshHour,
          refreshMinute,
          mode: feed?.mode || null,
          items: Array.isArray(feed?.items) ? feed.items.length : 0,
          stale: feed?.stale === true,
          unavailable: feed?.unavailable === true,
          fetchedAt: feed?.fetchedAt || null,
        });

        if (onRefresh) {
          await onRefresh(feed);
        }

        await scheduleNextRun();
      });
    };

    scheduleNextRun().catch((error) => {
      logger.warn('Failed to initialize game highlights refresh schedule', { error: error.message });
      this.setNextScheduleTimeout(getGameSchedulePollMinutes() * 60 * 1000, scheduleNextRun);
    });
  }

  stopDailyRefreshSchedule() {
    if (!this.dailyRefreshTimeout) {
      return;
    }

    clearTimeout(this.dailyRefreshTimeout);
    this.dailyRefreshTimeout = null;
    this.pendingGameIds = new Set();
    this.observedCompletedAtMsByGameId.clear();
  }
}

const funVideoService = new FunVideoService();

module.exports = funVideoService;
module.exports.getNextDailyRefreshDelayMs = getNextDailyRefreshDelayMs;
module.exports.getGameRecapRefreshPlan = getGameRecapRefreshPlan;
