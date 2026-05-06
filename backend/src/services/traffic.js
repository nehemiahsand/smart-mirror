/**
 * Traffic Service
 * Provides real-time traffic data and commute time using TomTom or Google Maps.
 */

const axios = require('axios');
const logger = require('../utils/logger');

class TrafficService {
  constructor() {
    this.updateInterval = 10 * 60 * 1000; // Update every 10 minutes
    this.geocodeCache = new Map(); // Cache TomTom geocoded coordinates
    this.routeCache = new Map(); // Cache routing responses keyed by origin->destination
    // Legacy single-result cache (kept for backwards compatibility with callers
    // that don't pass a structured config). Delegates to routeCache internally.
    this.lastUpdate = null;
    this.cachedData = null;
  }

  cacheKey(origin, destination) {
    return `${origin}=>${destination}`;
  }

  getCachedRoute(origin, destination) {
    const entry = this.routeCache.get(this.cacheKey(origin, destination));
    if (!entry) return null;
    if ((Date.now() - entry.timestamp) > this.updateInterval) return null;
    return entry.data;
  }

  setCachedRoute(origin, destination, data) {
    this.routeCache.set(this.cacheKey(origin, destination), {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Fetch commute data for multiple destinations sharing one origin / API key.
   * Returns one entry per destination, using cached results where fresh.
   * @param {Object} config { origin, destinations: [{label, address}], tomtomApiKey, googleMapsApiKey }
   */
  async getCommutes(config) {
    const {
      origin,
      destinations = [],
      tomtomApiKey,
      googleMapsApiKey
    } = config || {};

    if (!origin) {
      throw new Error('Origin is required');
    }
    if (!Array.isArray(destinations) || destinations.length === 0) {
      throw new Error('At least one destination is required');
    }
    if (!tomtomApiKey && !googleMapsApiKey) {
      throw new Error('Traffic API key not configured');
    }

    const results = await Promise.all(destinations.map(async (dest) => {
      const address = typeof dest === 'string' ? dest : dest?.address;
      const label = typeof dest === 'string' ? dest : (dest?.label || address);
      if (!address) {
        return { label: label || 'Destination', error: 'Destination address is empty' };
      }

      try {
        const data = await this.getCommuteData({
          origin,
          destination: address,
          tomtomApiKey,
          googleMapsApiKey
        });
        return { label, ...data };
      } catch (error) {
        return { label, error: error.message };
      }
    }));

    return {
      origin,
      commutes: results,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get commute time with live traffic
   * @param {Object|string} configOrOrigin - Traffic config or origin string
   * @param {string} destinationArg - Destination address
   * @param {string} apiKeyArg - TomTom API key
   * @returns {Promise<Object>} Traffic data with duration, distance, and ETA
   */
  async getCommuteData(configOrOrigin, destinationArg, apiKeyArg) {
    try {
      const config = typeof configOrOrigin === 'object' && configOrOrigin !== null
        ? configOrOrigin
        : {
            origin: configOrOrigin,
            destination: destinationArg,
            tomtomApiKey: apiKeyArg
          };

      const { origin, destination, tomtomApiKey, googleMapsApiKey } = config;

      if (!origin || !destination) {
        throw new Error('Origin and destination are required');
      }

      const cached = this.getCachedRoute(origin, destination);
      if (cached) {
        logger.debug('Returning cached traffic data', { origin, destination });
        return cached;
      }

      let data;
      if (tomtomApiKey) {
        data = await this.getTomTomCommuteData(origin, destination, tomtomApiKey);
      } else if (googleMapsApiKey) {
        data = await this.getGoogleMapsCommuteData(origin, destination, googleMapsApiKey);
      } else {
        throw new Error('Traffic API key not configured');
      }

      this.setCachedRoute(origin, destination, data);
      this.cachedData = data;
      this.lastUpdate = Date.now();

      logger.info('Traffic data updated', {
        duration: data.duration,
        distance: data.distance,
        eta: data.etaFormatted,
        provider: data.provider
      });

      return data;
    } catch (error) {
      logger.error('Failed to fetch traffic data', { error: error.message });

      // Try stale cache for this specific route first
      const config = typeof configOrOrigin === 'object' && configOrOrigin !== null
        ? configOrOrigin
        : { origin: configOrOrigin, destination: destinationArg };
      const staleEntry = this.routeCache.get(this.cacheKey(config.origin, config.destination));
      if (staleEntry?.data) {
        logger.info('Returning stale cached data due to error');
        return { ...staleEntry.data, stale: true };
      }

      throw error;
    }
  }

  async getTomTomCommuteData(origin, destination, apiKey) {
    if (!apiKey) {
      throw new Error('TomTom API key not configured');
    }

    const [originCoords, destCoords] = await Promise.all([
      this.geocode(origin, apiKey),
      this.geocode(destination, apiKey)
    ]);

    const url = `https://api.tomtom.com/routing/1/calculateRoute/${originCoords}:${destCoords}/json`;
    const params = {
      key: apiKey,
      traffic: 'true',
      travelMode: 'car',
      departAt: 'now',
      computeTravelTimeFor: 'all'
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('No routes found');
    }

    const route = response.data.routes[0];
    const summary = route.summary;

    return this.formatTrafficData({
      provider: 'tomtom',
      durationInSeconds: summary.travelTimeInSeconds,
      noTrafficDurationInSeconds: summary.noTrafficTravelTimeInSeconds || summary.travelTimeInSeconds,
      distanceMeters: summary.lengthInMeters,
      origin,
      destination,
      trafficDelaySeconds: summary.trafficDelayInSeconds || 0
    });
  }

  async getGoogleMapsCommuteData(origin, destination, apiKey) {
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin,
        destination,
        key: apiKey,
        mode: 'driving',
        departure_time: 'now',
        traffic_model: 'best_guess'
      },
      timeout: 10000
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps directions failed: ${response.data.status}`);
    }

    const route = response.data.routes?.[0];
    const leg = route?.legs?.[0];
    if (!leg) {
      throw new Error('No route legs found');
    }

    const durationInSeconds = leg.duration_in_traffic?.value || leg.duration?.value;
    const noTrafficDurationInSeconds = leg.duration?.value || durationInSeconds;
    const distanceMeters = leg.distance?.value;

    return this.formatTrafficData({
      provider: 'google-maps',
      durationInSeconds,
      noTrafficDurationInSeconds,
      distanceMeters,
      origin: leg.start_address || origin,
      destination: leg.end_address || destination,
      trafficDelaySeconds: Math.max(0, durationInSeconds - noTrafficDurationInSeconds)
    });
  }

  formatTrafficData({
    provider,
    durationInSeconds,
    noTrafficDurationInSeconds,
    distanceMeters,
    origin,
    destination,
    trafficDelaySeconds
  }) {
    if (!durationInSeconds || !distanceMeters) {
      throw new Error('Traffic response missing duration or distance');
    }

    const eta = new Date(Date.now() + (durationInSeconds * 1000));
    const mins = Math.round(durationInSeconds / 60);
    const durationText = mins >= 60
      ? `${Math.floor(mins / 60)} hr ${mins % 60} min`
      : `${mins} mins`;
    const distanceMiles = (distanceMeters / 1609.344).toFixed(1);

    return {
      provider,
      duration: durationText,
      durationValue: durationInSeconds,
      durationMinutes: mins,
      distance: `${distanceMiles} mi`,
      distanceValue: distanceMeters,
      eta: eta.toISOString(),
      etaFormatted: eta.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Chicago'
      }),
      startAddress: origin,
      endAddress: destination,
      trafficConditions: this.getTrafficConditions(durationInSeconds, noTrafficDurationInSeconds),
      trafficDelaySeconds: trafficDelaySeconds || 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Geocode an address to coordinates using TomTom Geocoding API
   * Results are cached since addresses don't change
   * @param {string} address - Address to geocode
   * @param {string} apiKey - TomTom API key
   * @returns {Promise<string>} Coordinates as "lat,lng" string
   */
  async geocode(address, apiKey) {
    if (this.geocodeCache.has(address)) {
      return this.geocodeCache.get(address);
    }

    // If the input already looks like "lat,lng" (decimal coordinates), skip
    // the geocoding API entirely. TomTom routing accepts raw coordinates and
    // this avoids extra API calls / quota and brittle text-based lookups.
    const coordMatch = String(address).trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const [, lat, lon] = coordMatch;
      const coords = `${lat},${lon}`;
      this.geocodeCache.set(address, coords);
      return coords;
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
    }
    if (delayPercent < 25) {
      return 'moderate';
    }
    return 'heavy';
  }

  /**
   * Clear cached data
   */
  clearCache() {
    this.cachedData = null;
    this.lastUpdate = null;
    this.routeCache.clear();
    logger.info('Traffic cache cleared');
  }
}

module.exports = new TrafficService();
