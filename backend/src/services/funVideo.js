const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

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
    title: String(snippet.title || 'Stephen Curry highlight'),
    channelTitle: String(snippet.channelTitle || 'YouTube'),
    channelId: snippet.channelId || null,
    publishedAt: snippet.publishedAt || null,
    thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null,
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
  };
}

class FunVideoService {
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

  async getCurrentFeed(options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const dateKey = getDateKey();

    await this.ensureDataDir();

    if (!forceRefresh) {
      const cached = await this.readCachedFeed(dateKey);
      if (cached) {
        return this.buildFeed(cached);
      }
    }

    try {
      const fetched = await this.fetchDailyFeed(dateKey);
      return this.buildFeed(fetched);
    } catch (error) {
      logger.warn('Failed to refresh daily YouTube fun feed', {
        error: error.message,
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

      return this.buildUnavailableFeed('Stephen Curry highlights are temporarily unavailable');
    }
  }
}

module.exports = new FunVideoService();
