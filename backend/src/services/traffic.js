/**
 * Traffic Service
 * Provides real-time traffic data and commute time using TomTom Routing API
 */

const axios = require('axios');
const logger = require('../utils/logger');
const settingsService = require('./settings');

class TrafficService {
  constructor() {
    this.lastUpdate = null;
    this.cachedData = null;
    this.updateInterval = 10 * 60 * 1000; // Update every 10 minutes
    this.geocodeCache = new Map(); // Cache geocoded coordinates
  }

  /**
   * Get commute time with live traffic
   * @param {string} origin - Starting address or coordinates
   * @param {string} destination - Destination address
   * @param {string} apiKey - TomTom API key
   * @returns {Promise<Object>} Traffic data with duration, distance, and ETA
   */
  async getCommuteData(origin, destination, apiKey) {
    try {
      if (!apiKey) {
        throw new Error('TomTom API key not configured');
      }

      if (!origin || !destination) {
        throw new Error('Origin and destination are required');
      }

      // Check cache
      if (this.cachedData && this.lastUpdate && (Date.now() - this.lastUpdate) < this.updateInterval) {
        logger.info('Returning cached traffic data');
        return this.cachedData;
      }

      // Geocode addresses to coordinates (with caching)
      const [originCoords, destCoords] = await Promise.all([
        this.geocode(origin, apiKey),
        this.geocode(destination, apiKey)
      ]);

      // TomTom Routing API - calculates route with live traffic by default
      const url = `https://api.tomtom.com/routing/1/calculateRoute/${originCoords}:${destCoords}/json`;
      const params = {
        key: apiKey,
        traffic: 'true',
        travelMode: 'car',
        departAt: 'now',
        computeTravelTimeFor: 'all' // Returns noTrafficTravelTimeInSeconds for comparison
      };

      const response = await axios.get(url, { params, timeout: 10000 });

      if (!response.data.routes || response.data.routes.length === 0) {
        throw new Error('No routes found');
      }

      const route = response.data.routes[0];
      const summary = route.summary;

      const durationInSeconds = summary.travelTimeInSeconds;
      const noTrafficDuration = summary.noTrafficTravelTimeInSeconds || durationInSeconds;
      const eta = new Date(Date.now() + (durationInSeconds * 1000));

      // Format duration text
      const mins = Math.round(durationInSeconds / 60);
      const durationText = mins >= 60
        ? `${Math.floor(mins / 60)} hr ${mins % 60} min`
        : `${mins} mins`;

      // Format distance text
      const distanceMeters = summary.lengthInMeters;
      const distanceMiles = (distanceMeters / 1609.344).toFixed(1);
      const distanceText = `${distanceMiles} mi`;

      const data = {
        duration: durationText,
        durationValue: durationInSeconds, // in seconds
        durationMinutes: mins,
        distance: distanceText,
        distanceValue: distanceMeters, // in meters
        eta: eta.toISOString(),
        etaFormatted: eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' }),
        startAddress: origin,
        endAddress: destination,
        trafficConditions: this.getTrafficConditions(durationInSeconds, noTrafficDuration),
        trafficDelaySeconds: summary.trafficDelayInSeconds || 0,
        lastUpdated: new Date().toISOString()
      };

      // Cache the data
      this.cachedData = data;
      this.lastUpdate = Date.now();

      logger.info('Traffic data updated', {
        duration: data.duration,
        distance: data.distance,
        eta: data.etaFormatted
      });

      return data;
    } catch (error) {
      logger.error('Failed to fetch traffic data', { error: error.message });
      
      // Return cached data if available, even if stale
      if (this.cachedData) {
        logger.info('Returning stale cached data due to error');
        return { ...this.cachedData, stale: true };
      }
      
      throw error;
    }
  }

  /**
   * Geocode an address to coordinates using TomTom Geocoding API
   * Results are cached since addresses don't change
   * @param {string} address - Address to geocode
   * @param {string} apiKey - TomTom API key
   * @returns {Promise<string>} Coordinates as "lat,lng" string
   */
  async geocode(address, apiKey) {
    // Check geocode cache first
    if (this.geocodeCache.has(address)) {
      return this.geocodeCache.get(address);
    }

    const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(address)}.json`;
    const response = await axios.get(url, {
      params: { key: apiKey },
      timeout: 10000
    });

    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`Could not geocode address: ${address}`);
    }

    const pos = response.data.results[0].position;
    const coords = `${pos.lat},${pos.lon}`;
    
    // Cache the result permanently (addresses don't change)
    this.geocodeCache.set(address, coords);
    
    return coords;
  }

  /**
   * Determine traffic conditions based on duration difference
   * @param {number} trafficDuration - Duration with live traffic (seconds)
   * @param {number} noTrafficDuration - Duration without traffic (seconds)
   * @returns {string} Traffic condition: 'light', 'moderate', 'heavy', 'unknown'
   */
  getTrafficConditions(trafficDuration, noTrafficDuration) {
    if (!trafficDuration || !noTrafficDuration) {
      return 'unknown';
    }

    const delay = trafficDuration - noTrafficDuration;
    const delayPercent = (delay / noTrafficDuration) * 100;

    if (delayPercent < 10) {
      return 'light';
    } else if (delayPercent < 25) {
      return 'moderate';
    } else {
      return 'heavy';
    }
  }

  /**
   * Clear cached data
   */
  clearCache() {
    this.cachedData = null;
    this.lastUpdate = null;
    logger.info('Traffic cache cleared');
  }
}

module.exports = new TrafficService();
