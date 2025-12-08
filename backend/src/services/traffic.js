/**
 * Traffic Service
 * Provides real-time traffic data and commute time using Google Maps Directions API
 */

const axios = require('axios');
const logger = require('../utils/logger');
const settingsService = require('./settings');

class TrafficService {
  constructor() {
    this.lastUpdate = null;
    this.cachedData = null;
    this.updateInterval = 5 * 60 * 1000; // Update every 5 minutes
  }

  /**
   * Get commute time with live traffic
   * @param {string} origin - Starting address or coordinates
   * @param {string} destination - Destination address
   * @param {string} apiKey - Google Maps API key
   * @returns {Promise<Object>} Traffic data with duration, distance, and ETA
   */
  async getCommuteData(origin, destination, apiKey) {
    try {
      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      if (!origin || !destination) {
        throw new Error('Origin and destination are required');
      }

      // Check cache
      if (this.cachedData && this.lastUpdate && (Date.now() - this.lastUpdate) < this.updateInterval) {
        logger.info('Returning cached traffic data');
        return this.cachedData;
      }

      const url = 'https://maps.googleapis.com/maps/api/directions/json';
      const params = {
        origin,
        destination,
        key: apiKey,
        departure_time: 'now', // Get current traffic conditions
        traffic_model: 'best_guess',
        mode: 'driving'
      };

      const response = await axios.get(url, { params, timeout: 10000 });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
      }

      if (!response.data.routes || response.data.routes.length === 0) {
        throw new Error('No routes found');
      }

      const route = response.data.routes[0];
      const leg = route.legs[0];

      // Calculate ETA
      const durationInSeconds = leg.duration_in_traffic?.value || leg.duration.value;
      const eta = new Date(Date.now() + (durationInSeconds * 1000));

      const data = {
        duration: leg.duration_in_traffic?.text || leg.duration.text,
        durationValue: durationInSeconds, // in seconds
        durationMinutes: Math.round(durationInSeconds / 60),
        distance: leg.distance.text,
        distanceValue: leg.distance.value, // in meters
        eta: eta.toISOString(),
        etaFormatted: eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' }),
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        trafficConditions: this.getTrafficConditions(leg),
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
   * Determine traffic conditions based on duration difference
   * @param {Object} leg - Route leg from Google Maps API
   * @returns {string} Traffic condition: 'light', 'moderate', 'heavy', 'unknown'
   */
  getTrafficConditions(leg) {
    if (!leg.duration_in_traffic || !leg.duration) {
      return 'unknown';
    }

    const normalDuration = leg.duration.value;
    const trafficDuration = leg.duration_in_traffic.value;
    const delay = trafficDuration - normalDuration;
    const delayPercent = (delay / normalDuration) * 100;

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
