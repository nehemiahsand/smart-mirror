/**
 * Weather service using OpenWeather API
 */

const axios = require('axios');
const logger = require('../utils/logger');

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ONECALL_BASE_URL = 'https://api.openweathermap.org/data/3.0';

class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY || '';
    this.cache = null;
    this.cacheExpiry = null;
    this.cacheDuration = 10 * 60 * 1000; // 10 minutes
    this.coordsCache = null;
    this.detailedCache = null;
    this.previousDetailedCache = null;
    this.detailedCacheExpiry = null;
    this.detailedCacheDuration = 3 * 60 * 60 * 1000; // 3 hours
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  async getCurrentWeather(city, units = 'metric') {
    // Return cached data if still valid
    if (this.cache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      logger.debug('Returning cached weather data');
      return this.cache;
    }

    if (!this.apiKey) {
      logger.warn('OpenWeather API key not configured');
      return {
        error: 'API key not configured',
        message: 'Please set OPENWEATHER_API_KEY in environment variables'
      };
    }

    try {
      // First, get coordinates from city name using current weather API
      const response = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
        params: {
          q: city,
          appid: this.apiKey,
          units: units
        },
        timeout: 5000
      });

      const data = response.data;
      const lat = data.coord.lat;
      const lon = data.coord.lon;
      this.coordsCache = {
        city,
        units,
        lat,
        lon,
        resolvedCity: data.name,
        resolvedCountry: data.sys.country,
        timestamp: Date.now(),
      };
      
      // Now use One Call API 3.0 for accurate daily high/low
      let tempMin = Math.round(data.main.temp);
      let tempMax = Math.round(data.main.temp);
      
      try {
        const oneCallResponse = await axios.get(`${ONECALL_BASE_URL}/onecall`, {
          params: {
            lat: lat,
            lon: lon,
            appid: this.apiKey,
            units: units === 'metric' ? 'metric' : 'imperial',
            exclude: 'minutely,hourly,alerts'
          },
          timeout: 5000
        });
        
        // Get today's daily forecast
        if (oneCallResponse.data.daily && oneCallResponse.data.daily.length > 0) {
          const today = oneCallResponse.data.daily[0];
          tempMin = Math.round(today.temp.min);
          tempMax = Math.round(today.temp.max);
          logger.info('Got accurate daily high/low from One Call API', { tempMin, tempMax });
        }
      } catch (oneCallError) {
        logger.warn('Could not fetch One Call API for daily high/low, using current temp', { error: oneCallError.message });
      }
      
      const weatherData = {
        temperature: Math.round(data.main.temp),
        tempMin: tempMin,
        tempMax: tempMax,
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        windSpeed: data.wind.speed,
        city: data.name,
        country: data.sys.country,
        latitude: lat,
        longitude: lon,
        sunrise: data.sys.sunrise,
        sunset: data.sys.sunset,
        units: units,
        timestamp: Date.now()
      };

      // Update cache
      this.cache = weatherData;
      this.cacheExpiry = Date.now() + this.cacheDuration;
      
      logger.info('Weather data fetched successfully', { city });
      return weatherData;
      
    } catch (error) {
      logger.error('Failed to fetch weather data', { 
        error: error.message,
        city 
      });
      
      // Return cached data if available, even if expired
      if (this.cache) {
        logger.warn('Returning stale cached weather data');
        return { ...this.cache, stale: true };
      }
      
      throw new Error(`Failed to fetch weather: ${error.message}`);
    }
  }

  async getForecast(city, units = 'metric') {
    if (!this.apiKey) {
      logger.warn('OpenWeather API key not configured');
      return {
        error: 'API key not configured',
        message: 'Please set OPENWEATHER_API_KEY in environment variables'
      };
    }

    try {
      const response = await axios.get(`${OPENWEATHER_BASE_URL}/forecast`, {
        params: {
          q: city,
          appid: this.apiKey,
          units: units,
          cnt: 8 // Next 24 hours (3-hour intervals)
        },
        timeout: 5000
      });

      const forecast = response.data.list.map(item => ({
        timestamp: item.dt,
        temperature: Math.round(item.main.temp),
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        humidity: item.main.humidity,
        windSpeed: item.wind.speed
      }));

      logger.info('Forecast data fetched successfully', { city });
      return {
        city: response.data.city.name,
        country: response.data.city.country,
        forecast,
        units
      };
      
    } catch (error) {
      logger.error('Failed to fetch forecast data', { 
        error: error.message,
        city 
      });
      throw new Error(`Failed to fetch forecast: ${error.message}`);
    }
  }

  async getDetailedWeather(city, units = 'metric') {
    const current = await this.getCurrentWeather(city, units);

    if (current?.error) {
      return current;
    }

    const lat = current.latitude ?? this.coordsCache?.lat;
    const lon = current.longitude ?? this.coordsCache?.lon;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      logger.warn('Detailed weather requested without cached coordinates', { city });
      return {
        city: current.city,
        country: current.country,
        units,
        current,
        hourly: [],
        daily: [],
        alerts: [],
      };
    }

    const nowMs = Date.now();
    if (
      this.detailedCache &&
      this.detailedCacheExpiry &&
      nowMs < this.detailedCacheExpiry &&
      this.detailedCache.city === current.city &&
      this.detailedCache.units === units
    ) {
      return this.buildDetailedWeatherResponse(current, this.detailedCache);
    }

    try {
      const oneCallResponse = await axios.get(`${ONECALL_BASE_URL}/onecall`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: units === 'metric' ? 'metric' : 'imperial',
          exclude: 'minutely',
        },
        timeout: 5000,
      });

      const oneCall = oneCallResponse.data || {};
      if (this.detailedCache) {
        this.previousDetailedCache = this.detailedCache;
      }
      this.detailedCache = {
        city: current.city,
        country: current.country,
        units,
        timezone: oneCall.timezone || null,
        latitude: lat,
        longitude: lon,
        hourlyAll: Array.isArray(oneCall.hourly)
          ? oneCall.hourly.map((item) => ({
            timestamp: item.dt,
            temperature: Math.round(item.temp),
            feelsLike: Math.round(item.feels_like),
            description: item.weather?.[0]?.description || '',
            icon: item.weather?.[0]?.icon || '',
            humidity: item.humidity,
            windSpeed: item.wind_speed,
            precipitationChance: Math.round((item.pop || 0) * 100),
          }))
          : [],
        dailyAll: Array.isArray(oneCall.daily)
          ? oneCall.daily.slice(0, 7).map((item) => ({
            date: new Date(item.dt * 1000).toISOString().slice(0, 10),
            timestamp: item.dt,
            min: Math.round(item.temp?.min ?? current.tempMin),
            max: Math.round(item.temp?.max ?? current.tempMax),
            morning: Math.round(item.temp?.morn ?? current.temperature),
            day: Math.round(item.temp?.day ?? current.temperature),
            evening: Math.round(item.temp?.eve ?? current.temperature),
            night: Math.round(item.temp?.night ?? current.temperature),
            description: item.weather?.[0]?.description || current.description,
            icon: item.weather?.[0]?.icon || current.icon,
            humidity: item.humidity,
            windSpeed: item.wind_speed,
            sunrise: item.sunrise,
            sunset: item.sunset,
            precipitationChance: Math.round((item.pop || 0) * 100),
          }))
          : [],
        alerts: Array.isArray(oneCall.alerts) ? oneCall.alerts : [],
        fetchedAt: nowMs,
      };
      this.detailedCacheExpiry = nowMs + this.detailedCacheDuration;

      return this.buildDetailedWeatherResponse(current, this.detailedCache);
    } catch (error) {
      logger.error('Failed to fetch detailed hourly weather data', {
        error: error.message,
        city,
      });

      if (this.detailedCache) {
        logger.warn('Returning stale cached detailed weather data');
        const response = this.buildDetailedWeatherResponse(current, this.detailedCache);
        return { ...response, stale: true };
      }

      return {
        city: current.city,
        country: current.country,
        units,
        current,
        hourly: [],
        daily: [],
        alerts: [],
      };
    }
  }

  buildDetailedWeatherResponse(current, detailedCache = {}) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const hourlyAll = Array.isArray(detailedCache.hourlyAll) ? detailedCache.hourlyAll : [];
    const previousHourlyAll = Array.isArray(this.previousDetailedCache?.hourlyAll) ? this.previousDetailedCache.hourlyAll : [];
    const dailyAll = Array.isArray(detailedCache.dailyAll) ? detailedCache.dailyAll : [];

    const hourly = hourlyAll
      .filter((item) => Number.isFinite(item?.timestamp) && item.timestamp > nowSeconds)
      .slice(0, 24);

    const hourlyTimeline = [];
    const seenTimestamps = new Set();
    [...hourlyAll, ...previousHourlyAll]
      .filter((item) => Number.isFinite(item?.timestamp))
      .sort((left, right) => left.timestamp - right.timestamp)
      .forEach((item) => {
        if (seenTimestamps.has(item.timestamp)) {
          return;
        }
        seenTimestamps.add(item.timestamp);
        hourlyTimeline.push(item);
      });

    return {
      city: current.city,
      country: current.country,
      units: detailedCache.units || current.units,
      current,
      hourly,
      hourlyAll,
      hourlyTimeline,
      daily: dailyAll,
      alerts: Array.isArray(detailedCache.alerts) ? detailedCache.alerts : [],
      timezone: detailedCache.timezone || null,
      latitude: detailedCache.latitude ?? current.latitude ?? null,
      longitude: detailedCache.longitude ?? current.longitude ?? null,
      fetchedAt: detailedCache.fetchedAt || null,
    };
  }

  clearCache() {
    this.cache = null;
    this.cacheExpiry = null;
    this.detailedCache = null;
    this.previousDetailedCache = null;
    this.detailedCacheExpiry = null;
    logger.debug('Weather cache cleared');
  }
}

module.exports = new WeatherService();
