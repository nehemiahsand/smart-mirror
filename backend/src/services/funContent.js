const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '../../data/fun');
const PROVIDER_ID = 'calvin-and-hobbes';
const ITEM_TYPE = 'comic';
const ITEM_TITLE = 'Calvin & Hobbes';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
const FIRST_STRIP_DATE = '1985-11-18';

function pad(value) {
  return String(value).padStart(2, '0');
}

function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getSourceUrl(dateKey) {
  const [year, month, day] = String(dateKey).split('-');
  return `https://www.gocomics.com/calvinandhobbes/${year}/${month}/${day}`;
}

function parseDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== (month - 1)
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function inferExtension(contentType = '', imageUrl = '') {
  const normalizedType = String(contentType).toLowerCase();
  if (normalizedType.includes('png')) {
    return '.png';
  }
  if (normalizedType.includes('webp')) {
    return '.webp';
  }
  if (normalizedType.includes('gif')) {
    return '.gif';
  }

  const pathname = (() => {
    try {
      return new URL(imageUrl).pathname.toLowerCase();
    } catch (_) {
      return String(imageUrl).toLowerCase();
    }
  })();

  if (pathname.endsWith('.png')) {
    return '.png';
  }
  if (pathname.endsWith('.webp')) {
    return '.webp';
  }
  if (pathname.endsWith('.gif')) {
    return '.gif';
  }

  return '.jpg';
}

function extractOgImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

class FunContentService {
  getCurrentDateKey() {
    return getDateKey();
  }

  normalizeDateKey(dateKey) {
    const parsed = parseDateKey(dateKey);
    return parsed ? getDateKey(parsed) : null;
  }

  shiftDateKey(dateKey, deltaDays = 0) {
    const parsed = parseDateKey(dateKey) || new Date();
    parsed.setDate(parsed.getDate() + deltaDays);
    return getDateKey(parsed);
  }

  async ensureDataDir() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  getMetadataPath(dateKey) {
    return path.join(DATA_DIR, `${dateKey}.json`);
  }

  getImagePath(dateKey, extension) {
    return path.join(DATA_DIR, `${dateKey}${extension}`);
  }

  async readMetadata(dateKey) {
    try {
      const metadataPath = this.getMetadataPath(dateKey);
      const raw = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(raw);
      if (!metadata?.imageFilename) {
        return null;
      }

      const imagePath = path.join(DATA_DIR, metadata.imageFilename);
      await fs.access(imagePath);

      return {
        ...metadata,
        imagePath,
      };
    } catch (_) {
      return null;
    }
  }

  async getLatestCachedMetadata() {
    await this.ensureDataDir();

    const entries = await fs.readdir(DATA_DIR);
    const metadataFiles = entries
      .filter((entry) => /^\d{4}-\d{2}-\d{2}\.json$/.test(entry))
      .sort()
      .reverse();

    for (const filename of metadataFiles) {
      const dateKey = filename.replace(/\.json$/, '');
      const metadata = await this.readMetadata(dateKey);
      if (metadata) {
        return metadata;
      }
    }

    return null;
  }

  buildItem(metadata, stale = false) {
    const todayDateKey = this.getCurrentDateKey();
    const normalizedDateKey = this.normalizeDateKey(metadata.date) || metadata.date;
    const isCurrent = normalizedDateKey === todayDateKey;

    return {
      pageId: 'fun',
      itemType: ITEM_TYPE,
      provider: PROVIDER_ID,
      title: metadata.title || ITEM_TITLE,
      date: normalizedDateKey,
      imageUrl: `/api/fun/image?date=${encodeURIComponent(normalizedDateKey)}`,
      sourceUrl: metadata.sourceUrl,
      cached: true,
      stale,
      fetchedAt: metadata.fetchedAt,
      isCurrent,
      canGoNewer: normalizedDateKey < todayDateKey,
      canGoOlder: normalizedDateKey > FIRST_STRIP_DATE,
      unavailable: false,
    };
  }

  buildUnavailableItem(message = 'Fun content unavailable') {
    return {
      pageId: 'fun',
      itemType: null,
      provider: null,
      title: 'Fun',
      imageUrl: null,
      sourceUrl: null,
      cached: false,
      stale: false,
      fetchedAt: null,
      isCurrent: true,
      canGoNewer: false,
      canGoOlder: false,
      unavailable: true,
      message,
    };
  }

  async fetchProviderItem(dateKey) {
    const sourceUrl = getSourceUrl(dateKey);
    logger.info('Fetching fun content', { provider: PROVIDER_ID, date: dateKey, sourceUrl });

    const htmlResponse = await axios.get(sourceUrl, {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'User-Agent': USER_AGENT,
      },
      timeout: 15000,
    });

    const imageUrl = extractOgImage(htmlResponse.data);
    if (!imageUrl) {
      throw new Error('Could not extract fun content image');
    }

    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
      },
      timeout: 20000,
    });

    const extension = inferExtension(imageResponse.headers['content-type'], imageUrl);
    const imageFilename = `${dateKey}${extension}`;
    const imagePath = this.getImagePath(dateKey, extension);

    await fs.writeFile(imagePath, imageResponse.data);

    const metadata = {
      provider: PROVIDER_ID,
      itemType: ITEM_TYPE,
      title: ITEM_TITLE,
      date: dateKey,
      sourceUrl,
      upstreamImageUrl: imageUrl,
      imageFilename,
      fetchedAt: new Date().toISOString(),
    };

    await fs.writeFile(this.getMetadataPath(dateKey), JSON.stringify(metadata, null, 2), 'utf8');

    return {
      ...metadata,
      imagePath,
    };
  }

  async getItemByDate(dateKeyInput, options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const fallbackToLatest = options.fallbackToLatest === true;
    const dateKey = this.normalizeDateKey(dateKeyInput) || this.getCurrentDateKey();

    await this.ensureDataDir();

    if (!forceRefresh) {
      const cachedToday = await this.readMetadata(dateKey);
      if (cachedToday) {
        return {
          item: this.buildItem(cachedToday, false),
          imagePath: cachedToday.imagePath,
        };
      }
    }

    try {
      const fetched = await this.fetchProviderItem(dateKey);
      return {
        item: this.buildItem(fetched, false),
        imagePath: fetched.imagePath,
      };
    } catch (error) {
      logger.error('Failed to refresh fun content', {
        error: error.message,
        provider: PROVIDER_ID,
        date: dateKey,
      });

      const cachedForDate = await this.readMetadata(dateKey);
      if (cachedForDate) {
        return {
          item: this.buildItem(cachedForDate, true),
          imagePath: cachedForDate.imagePath,
        };
      }

      if (fallbackToLatest) {
        const fallback = await this.getLatestCachedMetadata();
        if (fallback) {
          return {
            item: this.buildItem(fallback, true),
            imagePath: fallback.imagePath,
          };
        }
      }

      return {
        item: this.buildUnavailableItem('Fun content is temporarily unavailable'),
        imagePath: null,
      };
    }
  }

  async getCurrentItem(options = {}) {
    return this.getItemByDate(this.getCurrentDateKey(), {
      ...options,
      fallbackToLatest: true,
    });
  }

  async getImagePathForDate(dateKeyInput, options = {}) {
    const normalizedDateKey = this.normalizeDateKey(dateKeyInput) || this.getCurrentDateKey();
    const { imagePath } = await this.getItemByDate(normalizedDateKey, {
      ...options,
      fallbackToLatest: normalizedDateKey === this.getCurrentDateKey(),
    });
    return imagePath;
  }

  async getCurrentImagePath(options = {}) {
    const { imagePath } = await this.getCurrentItem(options);
    return imagePath;
  }
}

module.exports = new FunContentService();
