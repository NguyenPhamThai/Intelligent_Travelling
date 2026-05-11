// src/services/safety/data-pipeline.ts
import { Event } from './types';

const WEATHER_API_KEY = import.meta.env?.VITE_OPENWEATHER_API_KEY || 'demo';
const NEWS_API_KEY = import.meta.env?.VITE_NEWS_API_KEY || 'demo';

export async function fetchWeatherEvents(): Promise<Event[]> {
  try {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Hanoi&appid=${WEATHER_API_KEY}`);
    const data = await response.json();
    if (data.weather) {
      const severity = data.weather[0].id >= 500 ? 7 : 3; // Rain = high severity
      return [{
        id: `weather-${Date.now()}`,
        location: { lat: data.coord.lat, lng: data.coord.lon, lon: data.coord.lon },
        type: 'weather' as const,
        severity,
        timestamp: Date.now(),
      }];
    }
  } catch (e) {
    console.error('Weather API error:', e);
  }
  return []; // Fallback to empty
}

export async function fetchNewsEvents(): Promise<Event[]> {
  try {
    const response = await fetch(`https://newsapi.org/v2/everything?q=riot+OR+crime+OR+disaster&apiKey=${NEWS_API_KEY}`);
    const data = await response.json();
    if (data.articles) {
      return data.articles.slice(0, 5).map((article: any, i: number) => ({
        id: `news-${Date.now()}-${i}`,
        location: { lat: 21.027763, lon: 105.834160, lng: 105.834160 }, // Mock location, parse if possible
        type: article.title.toLowerCase().includes('riot') ? 'riot' : article.title.toLowerCase().includes('crime') ? 'crime' : 'weather',
        severity: 6, // Assume medium
        timestamp: Date.now(),
      }));
    }
  } catch (e) {
    console.error('News API error:', e);
  }
  return [];
}

export async function getAllEvents(): Promise<Event[]> {
  const [weather, news] = await Promise.all([fetchWeatherEvents(), fetchNewsEvents()]);
  return [...weather, ...news];
}