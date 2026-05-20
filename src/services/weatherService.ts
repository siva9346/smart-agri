import axios from 'axios';

const API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY'; // Replace with a real key from openweathermap.org
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEO_URL  = 'https://api.openweathermap.org/geo/1.0';

const FALLBACK_LAT = 13.0827;  // Chennai
const FALLBACK_LON = 80.2707;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeatherData {
  temp: number;
  condition: string;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  rainProbability?: number;
  date?: string;
}

export interface LocationInfo {
  city: string;
  state: string;
  country: string;
  display: string; // e.g. "Namakkal, Tamil Nadu"
}

export interface CitySuggestion {
  display: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLocationInfo(name: string, state: string, country: string): LocationInfo {
  const stateLabel = state || '';
  return {
    city: name,
    state: stateLabel,
    country: country || 'IN',
    display: stateLabel ? `${name}, ${stateLabel}` : name,
  };
}

/**
 * When the API key is invalid (401) we can't verify whether a city exists, so
 * we create a "best-effort" result from whatever the user typed.  Weather data
 * will come from the mock fallback, but the location label updates correctly.
 */
function demoResult(cityName: string): { lat: number; lon: number; location: LocationInfo } {
  return {
    lat: FALLBACK_LAT,
    lon: FALLBACK_LON,
    location: { city: cityName, state: 'India', country: 'IN', display: `${cityName}, India` },
  };
}

// ─── Geocode city name → lat/lon  (3-tier, India-first) ──────────────────────
//
// Tier 1 : /geo/1.0/direct?q=<city>,IN   — precise coords + state name
// Tier 2 : /geo/1.0/direct?q=<city>      — fallback without country filter
// Tier 3 : /data/2.5/weather?q=<city>,IN — works for any city even if geo API fails
// Demo   : invalid API key → return best-effort so UI still updates location label
//
export const geocodeCity = async (
  cityName: string,
): Promise<{ lat: number; lon: number; location: LocationInfo } | null> => {
  const q = cityName.trim();
  if (!q) return null;

  // ── Tier 1 : Geo API with India country bias ───────────────────────────────
  try {
    const res = await axios.get(`${GEO_URL}/direct`, {
      params: { q: `${q},IN`, limit: 5, appid: API_KEY },
      timeout: 7000,
    });
    if (res.data?.length > 0) {
      // Prefer India results; fall back to first entry if none explicitly labelled IN
      const match: any =
        res.data.find((r: any) => r.country === 'IN') ?? res.data[0];
      return {
        lat: match.lat,
        lon: match.lon,
        location: buildLocationInfo(match.name, match.state || '', match.country || 'IN'),
      };
    }
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401) {
      // Invalid API key — fall through to demo result at the end
    } else if (status !== 404) {
      // Network / server error — try next tier
    }
  }

  // ── Tier 2 : Geo API without country filter ────────────────────────────────
  try {
    const res = await axios.get(`${GEO_URL}/direct`, {
      params: { q, limit: 5, appid: API_KEY },
      timeout: 7000,
    });
    if (res.data?.length > 0) {
      const match: any =
        res.data.find((r: any) => r.country === 'IN') ?? res.data[0];
      return {
        lat: match.lat,
        lon: match.lon,
        location: buildLocationInfo(match.name, match.state || '', match.country || ''),
      };
    }
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401) {
      // API key invalid — use demo fallback so location label still updates
      return demoResult(q);
    }
  }

  // ── Tier 3 : Direct weather API  (q=city,IN) ──────────────────────────────
  // This covers cities that the Geo API misses (smaller towns, alternative spellings)
  try {
    const res = await axios.get(`${BASE_URL}/weather`, {
      params: { q: `${q},IN`, units: 'metric', appid: API_KEY },
      timeout: 7000,
    });
    const d = res.data;
    return {
      lat: d.coord.lat,
      lon: d.coord.lon,
      location: buildLocationInfo(d.name, '', d.sys?.country || 'IN'),
    };
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 404) return null;            // City genuinely not found
    if (status === 401) return demoResult(q);  // Invalid key — still update label
    return null;
  }
};

// ─── Autocomplete suggestions (returns [] silently on any failure) ────────────
export const searchSuggestions = async (partial: string): Promise<CitySuggestion[]> => {
  const q = partial.trim();
  if (q.length < 2) return [];
  try {
    const res = await axios.get(`${GEO_URL}/direct`, {
      params: { q: `${q},IN`, limit: 5, appid: API_KEY },
      timeout: 4000,
    });
    if (!res.data?.length) return [];
    return (res.data as any[])
      .filter((r) => r.lat && r.lon)
      .slice(0, 5)
      .map((r) => ({
        display: r.state ? `${r.name}, ${r.state}` : r.name,
        city: r.name,
        state: r.state || '',
        lat: r.lat,
        lon: r.lon,
      }));
  } catch (_) {
    return [];
  }
};

// ─── Reverse geocode lat/lon → LocationInfo ────────────────────────────────────
export const reverseGeocode = async (lat: number, lon: number): Promise<LocationInfo> => {
  try {
    const res = await axios.get(`${GEO_URL}/reverse`, {
      params: { lat, lon, limit: 1, appid: API_KEY },
      timeout: 6000,
    });
    if (res.data?.length > 0) {
      const { name, state, country } = res.data[0];
      return buildLocationInfo(name || 'Your Location', state || '', country || '');
    }
  } catch (_) {}
  return { city: 'Chennai', state: 'Tamil Nadu', country: 'IN', display: 'Chennai, Tamil Nadu' };
};

// ─── Current weather (by coords) ──────────────────────────────────────────────
export const fetchCurrentWeather = async (
  lat: number = FALLBACK_LAT,
  lon: number = FALLBACK_LON,
): Promise<WeatherData> => {
  try {
    const res = await axios.get(`${BASE_URL}/weather`, {
      params: { lat, lon, units: 'metric', appid: API_KEY },
      timeout: 8000,
    });
    const d = res.data;
    return {
      temp: Math.round(d.main.temp),
      condition: d.weather[0].main,
      description: d.weather[0].description,
      humidity: d.main.humidity,
      windSpeed: Math.round(d.wind.speed * 10) / 10,
      icon: d.weather[0].icon,
    };
  } catch (_) {
    return getFallbackCurrent();
  }
};

// ─── 10-day forecast (by coords) ──────────────────────────────────────────────
export const fetchForecast = async (
  lat: number = FALLBACK_LAT,
  lon: number = FALLBACK_LON,
): Promise<WeatherData[]> => {
  try {
    const res = await axios.get(`${BASE_URL}/forecast`, {
      params: { lat, lon, units: 'metric', cnt: 40, appid: API_KEY },
      timeout: 8000,
    });

    const seen = new Set<string>();
    const daily: WeatherData[] = [];

    for (const entry of res.data.list) {
      const d = new Date(entry.dt * 1000);
      const key = d.toISOString().slice(0, 10);
      if (seen.has(key)) continue;
      seen.add(key);
      daily.push({
        temp: Math.round(entry.main.temp),
        condition: entry.weather[0].main,
        description: entry.weather[0].description,
        humidity: entry.main.humidity,
        windSpeed: Math.round(entry.wind.speed * 10) / 10,
        icon: entry.weather[0].icon,
        rainProbability: entry.pop ? Math.round(entry.pop * 100) : 0,
        date: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      });
      if (daily.length === 10) break;
    }

    while (daily.length < 10) {
      const base = daily[daily.length - 1] ?? getFallbackCurrent();
      const nd = new Date();
      nd.setDate(nd.getDate() + daily.length);
      daily.push({
        ...base,
        rainProbability: 0,
        date: nd.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      });
    }

    return daily;
  } catch (_) {
    return getFallbackForecast();
  }
};

// ─── Legacy namespace export (backward compat) ────────────────────────────────
export const weatherService = { fetchCurrentWeather, fetchForecast };

// ─── Mock fallbacks ────────────────────────────────────────────────────────────
function getFallbackCurrent(): WeatherData {
  return { temp: 32, condition: 'Cloudy', description: 'scattered clouds', humidity: 65, windSpeed: 4.5, icon: '03d' };
}

function getFallbackForecast(): WeatherData[] {
  const conds = ['Rain', 'Cloudy', 'Clear'] as const;
  const icons = ['10d', '03d', '01d'];
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const ci = i % 3;
    return {
      temp: 30 + (i % 4),
      condition: conds[ci],
      description: 'local forecast',
      humidity: 60 + (i % 15),
      windSpeed: 2.5 + (i % 5),
      icon: icons[ci],
      rainProbability: ci === 0 ? 70 : ci === 1 ? 30 : 5,
      date: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    };
  });
}
