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
    this.coordsCache = null; // Cache coordinates for the city
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
    const [current, forecastResult] = await Promise.all([
      this.getCurrentWeather(city, units),
      this.getForecast(city, units),
    ]);

    if (current?.error) {
      return current;
    }

    const forecast = Array.isArray(forecastResult?.forecast) ? forecastResult.forecast : [];
    const hourly = forecast.slice(0, 8).map((item) => ({
      timestamp: item.timestamp,
      temperature: item.temperature,
      description: item.description,
      icon: item.icon,
      humidity: item.humidity,
      windSpeed: item.windSpeed,
    }));

    const dailyByDate = new Map();
    for (const item of forecast) {
      const date = new Date(item.timestamp * 1000);
      const dateKey = date.toISOString().slice(0, 10);
      const existing = dailyByDate.get(dateKey);
      if (!existing) {
        dailyByDate.set(dateKey, {
          date: dateKey,
          min: item.temperature,
          max: item.temperature,
          description: item.description,
          icon: item.icon,
        });
        continue;
      }
      existing.min = Math.min(existing.min, item.temperature);
      existing.max = Math.max(existing.max, item.temperature);
    }

    return {
      city: current.city,
      country: current.country,
      units,
      current,
      hourly,
      daily: Array.from(dailyByDate.values()),
      alerts: [],
    };
  }

  clearCache() {
    this.cache = null;
    this.cacheExpiry = null;
    logger.debug('Weather cache cleared');
  }
}

module.exports = new WeatherService();
