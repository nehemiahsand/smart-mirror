/**
 * Photos Service
 * Serves photos from a local directory with metadata management
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class PhotosService {
  constructor() {
    this.photosDir = process.env.PHOTOS_DIR || path.join(__dirname, '../../data/photos');
    this.metadataFile = path.join(__dirname, '../../data/photos-metadata.json');
    this.photoCache = [];
    this.metadata = [];
    this.lastFetch = null;
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.photosDir, { recursive: true });

      try {
        const data = await fs.readFile(this.metadataFile, 'utf8');
        this.metadata = JSON.parse(data);
      } catch (error) {
        this.metadata = [];
      }

      await this.syncMetadata();
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize photos service', { error: error.message });
    }
  }

  async syncMetadata() {
    try {
      const files = await fs.readdir(this.photosDir);
      const imageFiles = files.filter(f => this.supportedFormats.includes(path.extname(f).toLowerCase()));

      for (const filename of imageFiles) {
        if (!this.metadata.find(m => m.filename === filename)) {
          const stats = await fs.stat(path.join(this.photosDir, filename));
          this.metadata.push({
            id: Date.now() + Math.random(),
            filename,
            caption: path.basename(filename, path.extname(filename)),
            uploadedAt: stats.mtime.toISOString(),
            size: stats.size,
            order: this.metadata.length
          });
        }
      }

      this.metadata = this.metadata.filter(m => imageFiles.includes(m.filename));
      await this.saveMetadata();
    } catch (error) {
      logger.error('Failed to sync metadata', { error: error.message });
    }
  }

  async saveMetadata() {
    try {
      await fs.writeFile(this.metadataFile, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      logger.error('Failed to save metadata', { error: error.message });
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured() {
    return !!this.photosDir;
  }

  /**
   * Get photos from local directory
   */
  async fetchPhotosFromDirectory() {
    await this.initialize();

    return this.metadata
      .sort((a, b) => a.order - b.order)
      .map(m => ({
        id: m.id,
        filename: m.filename,
        url: `/api/photos/image/${m.filename}`,
        caption: m.caption,
        uploadedAt: m.uploadedAt,
        size: m.size,
        order: m.order
      }));
  }

  /**
   * Get photo file path
   */
  getPhotoPath(filename) {
    // Sanitize filename to prevent directory traversal
    const sanitized = path.basename(filename);
    return path.join(this.photosDir, sanitized);
  }

  /**
   * Get photos with caching
   */
  async getPhotos() {
    // Return cached photos if still valid
    const now = Date.now();
    if (this.photoCache.length > 0 && this.lastFetch && (now - this.lastFetch) < this.cacheTimeout) {
      logger.debug('Returning cached photos', { count: this.photoCache.length });
      return { photos: this.photoCache };
    }

    try {
      logger.info('Fetching photos from directory', { dir: this.photosDir });
      const photos = await this.fetchPhotosFromDirectory();
      
      this.photoCache = photos;
      this.lastFetch = now;
      
      logger.info('Photos fetched successfully', { count: photos.length });
      return { photos };
    } catch (error) {
      logger.error('Failed to get photos', { error: error.message });
      
      // Return cached photos if available, even if expired
      if (this.photoCache.length > 0) {
        logger.warn('Returning stale cached photos due to error');
        return { photos: this.photoCache };
      }
      
      return {
        error: true,
        message: `Add photos to ${this.photosDir}`,
        photos: []
      };
    }
  }

  async addPhoto(filename, buffer, caption = '') {
    await this.initialize();

    try {
      const filepath = path.join(this.photosDir, filename);
      await fs.writeFile(filepath, buffer);

      const stats = await fs.stat(filepath);
      const photo = {
        id: Date.now() + Math.random(),
        filename,
        caption: caption || path.basename(filename, path.extname(filename)),
        uploadedAt: new Date().toISOString(),
        size: stats.size,
        order: this.metadata.length
      };

      this.metadata.push(photo);
      await this.saveMetadata();
      this.lastFetch = null; // Invalidate cache

      logger.info('Photo added', { filename, size: stats.size });
      
      return {
        id: photo.id,
        filename: photo.filename,
        caption: photo.caption,
        uploadedAt: photo.uploadedAt,
        size: photo.size,
        order: photo.order,
        url: `/api/photos/image/${photo.filename}`
      };
    } catch (error) {
      logger.error('Failed to add photo', { filename, error: error.message });
      throw error;
    }
  }

  async updatePhoto(id, updates) {
    await this.initialize();

    const photo = this.metadata.find(m => m.id === id);
    if (!photo) {
      throw new Error('Photo not found');
    }

    if (updates.caption !== undefined) {
      photo.caption = updates.caption;
    }

    if (updates.order !== undefined) {
      photo.order = updates.order;
    }

    await this.saveMetadata();
    this.lastFetch = null;
    logger.info('Photo updated', { id, updates });

    return {
      id: photo.id,
      filename: photo.filename,
      caption: photo.caption,
      uploadedAt: photo.uploadedAt,
      size: photo.size,
      order: photo.order,
      url: `/api/photos/image/${photo.filename}`
    };
  }

  async deletePhoto(id) {
    await this.initialize();

    const photo = this.metadata.find(m => m.id === id);
    if (!photo) {
      throw new Error('Photo not found');
    }

    try {
      const filepath = path.join(this.photosDir, photo.filename);
      await fs.unlink(filepath);
      
      this.metadata = this.metadata.filter(m => m.id !== id);
      await this.saveMetadata();
      this.lastFetch = null;

      logger.info('Photo deleted', { id, filename: photo.filename });
    } catch (error) {
      logger.error('Failed to delete photo', { id, error: error.message });
      throw error;
    }
  }

  async reorderPhotos(photoIds) {
    await this.initialize();

    photoIds.forEach((id, index) => {
      const photo = this.metadata.find(m => m.id === id);
      if (photo) {
        photo.order = index;
      }
    });

    await this.saveMetadata();
    this.lastFetch = null;
    logger.info('Photos reordered', { count: photoIds.length });
  }
}

module.exports = new PhotosService();
