/**
 * Weather service using OpenWeather API
 */

const axios = require('axios');
const logger = require('../utils/logger');

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY || '';
    this.cache = null;
    this.cacheExpiry = null;
    this.cacheDuration = 10 * 60 * 1000; // 10 minutes
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
      const response = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
        params: {
          q: city,
          appid: this.apiKey,
          units: units
        },
        timeout: 5000
      });

      const data = response.data;
      
      const weatherData = {
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        windSpeed: data.wind.speed,
        city: data.name,
        country: data.sys.country,
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

  clearCache() {
    this.cache = null;
    this.cacheExpiry = null;
    logger.debug('Weather cache cleared');
  }
}

module.exports = new WeatherService();
