const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '../../data/fun');
const PROVIDER_ID = 'calvin-and-hobbes';
const ITEM_TYPE = 'comic';
const ITEM_TITLE = 'Calvin & Hobbes';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

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
    return {
      pageId: 'fun',
      itemType: ITEM_TYPE,
      provider: PROVIDER_ID,
      title: metadata.title || ITEM_TITLE,
      date: metadata.date,
      imageUrl: '/api/fun/current/image',
      sourceUrl: metadata.sourceUrl,
      cached: true,
      stale,
      fetchedAt: metadata.fetchedAt,
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

  async getCurrentItem(options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const dateKey = getDateKey();

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

      const fallback = await this.getLatestCachedMetadata();
      if (fallback) {
        return {
          item: this.buildItem(fallback, true),
          imagePath: fallback.imagePath,
        };
      }

      return {
        item: this.buildUnavailableItem('Fun content is temporarily unavailable'),
        imagePath: null,
      };
    }
  }

  async getCurrentImagePath(options = {}) {
    const { imagePath } = await this.getCurrentItem(options);
    return imagePath;
  }
}

module.exports = new FunContentService();
