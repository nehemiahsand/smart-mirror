const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '../../data/bible-clock');
const VERSE_CACHE_DIR = path.join(DATA_DIR, 'verses');
const VERSE_COUNT_CACHE_PATH = path.join(DATA_DIR, 'verse-counts.json');
const VERSE_COUNT_SOURCE_URL = 'https://raw.githubusercontent.com/bkuhl/bible-verse-counts-per-chapter/master/bible.json';
const DEFAULT_TIMEZONE = process.env.TZ || 'America/Chicago';
const DEFAULT_CLOCK_FORMAT = '24h';
const ESV_API_URL = 'https://api.esv.org/v3/passage/text/';

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeClockFormat(clockFormat) {
  return clockFormat === '12h' ? '12h' : DEFAULT_CLOCK_FORMAT;
}

function sanitizeCacheKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getDateParts(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
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
    hour24: Number.parseInt(parts.hour, 10),
    minute: Number.parseInt(parts.minute, 10),
  };
}

function buildDateKey(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function getReferenceHour(hour24, clockFormat) {
  if (normalizeClockFormat(clockFormat) === '12h') {
    return hour24 % 12 || 12;
  }

  return hour24 === 0 ? 12 : hour24;
}

function formatClockLabel(parts, clockFormat) {
  const normalizedClockFormat = normalizeClockFormat(clockFormat);
  const hour = getReferenceHour(parts.hour24, normalizedClockFormat);
  const minute = pad(parts.minute);

  if (normalizedClockFormat === '12h') {
    const period = parts.hour24 >= 12 ? 'PM' : 'AM';
    return `${pad(hour)}:${minute} ${period}`;
  }

  return `${pad(parts.hour24)}:${minute}`;
}

function hashString(value) {
  let hash = 0;
  for (const character of String(value)) {
    hash = ((hash << 5) - hash) + character.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

class BibleVerseClockService {
  constructor() {
    this.verseCountIndex = null;
    this.verseTextCache = new Map();
  }

  async ensureDataDir() {
    await fs.mkdir(VERSE_CACHE_DIR, { recursive: true });
  }

  async loadVerseCountIndex() {
    if (Array.isArray(this.verseCountIndex) && this.verseCountIndex.length > 0) {
      return this.verseCountIndex;
    }

    await this.ensureDataDir();

    try {
      const raw = await fs.readFile(VERSE_COUNT_CACHE_PATH, 'utf8');
      const cached = JSON.parse(raw);
      if (Array.isArray(cached) && cached.length > 0) {
        this.verseCountIndex = cached;
        return cached;
      }
    } catch (_) {
      // Cache miss falls through to network fetch.
    }

    const response = await axios.get(VERSE_COUNT_SOURCE_URL, {
      timeout: 20000,
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    const normalized = Array.isArray(response.data)
      ? response.data.map((book) => ({
        name: book.book,
        abbr: book.abbr,
        chapters: Array.isArray(book.chapters)
          ? book.chapters.map((chapter) => Number.parseInt(chapter.verses, 10) || 0)
          : [],
      }))
      : [];

    if (normalized.length === 0) {
      throw new Error('Verse count index was empty');
    }

    await fs.writeFile(VERSE_COUNT_CACHE_PATH, JSON.stringify(normalized, null, 2), 'utf8');
    this.verseCountIndex = normalized;
    return normalized;
  }

  async readCachedVerse(reference) {
    const cacheKey = sanitizeCacheKey(reference);
    if (this.verseTextCache.has(cacheKey)) {
      return this.verseTextCache.get(cacheKey);
    }

    try {
      const cachePath = path.join(VERSE_CACHE_DIR, `${cacheKey}.json`);
      const raw = await fs.readFile(cachePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed?.text) {
        this.verseTextCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (_) {
      return null;
    }

    return null;
  }

  async writeCachedVerse(reference, text) {
    const cacheKey = sanitizeCacheKey(reference);
    const payload = {
      reference,
      text,
      fetchedAt: new Date().toISOString(),
    };

    const cachePath = path.join(VERSE_CACHE_DIR, `${cacheKey}.json`);
    await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8');
    this.verseTextCache.set(cacheKey, payload);
    return payload;
  }

  async fetchVerseText(reference) {
    const apiKey = process.env.ESV_API_KEY;
    if (!apiKey) {
      return {
        status: 'missing-api-key',
        text: null,
        fetchedAt: null,
      };
    }

    const cached = await this.readCachedVerse(reference);
    if (cached?.text) {
      return {
        status: 'ready',
        text: cached.text,
        cached: true,
        fetchedAt: cached.fetchedAt,
      };
    }

    try {
      const response = await axios.get(ESV_API_URL, {
        timeout: 15000,
        headers: {
          Authorization: `Token ${apiKey}`,
        },
        params: {
          q: reference,
          'include-passage-references': false,
          'include-first-verse-numbers': false,
          'include-verse-numbers': false,
          'include-footnotes': false,
          'include-headings': false,
          'include-short-copyright': false,
          'include-copyright': false,
        },
      });

      const text = Array.isArray(response.data?.passages)
        ? String(response.data.passages[0] || '').replace(/\s+/g, ' ').trim()
        : '';

      if (!text) {
        throw new Error('Empty ESV passage response');
      }

      const saved = await this.writeCachedVerse(reference, text);
      return {
        status: 'ready',
        text: saved.text,
        cached: false,
        fetchedAt: saved.fetchedAt,
      };
    } catch (error) {
      logger.warn('Failed to fetch ESV passage text', {
        error: error.message,
        reference,
      });

      const staleCached = await this.readCachedVerse(reference);
      if (staleCached?.text) {
        return {
          status: 'ready',
          text: staleCached.text,
          cached: true,
          stale: true,
          fetchedAt: staleCached.fetchedAt,
        };
      }

      return {
        status: 'error',
        text: null,
        fetchedAt: null,
      };
    }
  }

  async getCurrentWidget(options = {}) {
    const timeZone = options.timeZone || DEFAULT_TIMEZONE;
    const clockFormat = normalizeClockFormat(options.clockFormat);
    const parts = getDateParts(new Date(), timeZone);
    const referenceHour = getReferenceHour(parts.hour24, clockFormat);
    const timeLabel = formatClockLabel(parts, clockFormat);
    const minute = parts.minute;

    const baseWidget = {
      type: 'verse-clock',
      title: 'Bible Clock',
      clockFormat,
      timeLabel,
      displayHour: referenceHour,
      displayMinute: minute,
      translation: 'ESV',
      status: 'no-verse',
      reference: null,
      verseText: null,
      message: 'Pause and reflect',
      detail: 'No verse found for this time code.',
      cached: false,
      stale: false,
      fetchedAt: null,
    };

    if (minute < 1 || minute > 59) {
      return baseWidget;
    }

    let verseCountIndex;
    try {
      verseCountIndex = await this.loadVerseCountIndex();
    } catch (error) {
      logger.error('Failed to load verse count index', { error: error.message });
      return {
        ...baseWidget,
        status: 'error',
        message: 'Bible clock unavailable',
        detail: 'Verse reference index could not be loaded.',
      };
    }

    const candidates = verseCountIndex.filter((book) => {
      if (!Array.isArray(book.chapters) || book.chapters.length < referenceHour) {
        return false;
      }
      return (book.chapters[referenceHour - 1] || 0) >= minute;
    });

    if (candidates.length === 0) {
      return baseWidget;
    }

    const dateKey = buildDateKey(parts);
    const selectedIndex = hashString(`${dateKey}:${referenceHour}:${minute}`) % candidates.length;
    const selectedBook = candidates[selectedIndex];
    const reference = `${selectedBook.name} ${referenceHour}:${minute}`;
    const verseText = await this.fetchVerseText(reference);

    if (verseText.status === 'missing-api-key') {
      return {
        ...baseWidget,
        status: 'missing-api-key',
        reference,
        message: reference,
        detail: 'Set ESV_API_KEY to load verse text.',
      };
    }

    if (verseText.status === 'error') {
      return {
        ...baseWidget,
        status: 'error',
        reference,
        message: reference,
        detail: 'Verse text could not be loaded right now.',
      };
    }

    return {
      ...baseWidget,
      status: 'ready',
      reference,
      verseText: verseText.text,
      message: reference,
      detail: 'English Standard Version',
      cached: verseText.cached === true,
      stale: verseText.stale === true,
      fetchedAt: verseText.fetchedAt,
    };
  }
}

module.exports = new BibleVerseClockService();
