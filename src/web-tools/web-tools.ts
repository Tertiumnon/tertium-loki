import type { ToolDefinition } from "../llm-client/llm-client.types";
import {
  FETCH_URL_MAX_CHARS,
  OPEN_METEO_FORECAST_URL,
  OPEN_METEO_GEOCODING_URL,
  USER_AGENT,
  WMO_WEATHER_DESCRIPTIONS,
} from "./web-tools.constants";
import type {
  CurrentWeather,
  GeocodedPlace,
  OpenMeteoForecastResponse,
  OpenMeteoGeocodingResponse,
} from "./web-tools.types";

async function geocode(location: string): Promise<GeocodedPlace | undefined> {
  const url = `${OPEN_METEO_GEOCODING_URL}?name=${encodeURIComponent(location)}&count=1`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding lookup failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as OpenMeteoGeocodingResponse;
  const first = data.results?.[0];
  return first
    ? { name: first.name, latitude: first.latitude, longitude: first.longitude, country: first.country }
    : undefined;
}

async function fetchCurrentWeather(latitude: number, longitude: number): Promise<CurrentWeather> {
  const url = `${OPEN_METEO_FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Forecast lookup failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as OpenMeteoForecastResponse;
  return {
    temperatureC: data.current.temperature_2m,
    windSpeedKph: data.current.wind_speed_10m,
    weatherCode: data.current.weather_code,
  };
}

/** Free, keyless, and built for programmatic access (unlike scraping a search engine). */
export async function getWeather(location: string): Promise<string> {
  const place = await geocode(location);
  if (!place) {
    return `No location found matching "${location}".`;
  }

  const weather = await fetchCurrentWeather(place.latitude, place.longitude);
  const description = WMO_WEATHER_DESCRIPTIONS[weather.weatherCode] ?? `weather code ${weather.weatherCode}`;
  const where = [place.name, place.country].filter(Boolean).join(", ");

  return `Current weather in ${where}: ${description}, ${weather.temperatureC}°C, wind ${weather.windSpeedKph} km/h.`;
}

/** Fetches a specific URL and returns readable text (HTML tags stripped, truncated). */
export async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Fetching ${url} failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > FETCH_URL_MAX_CHARS ? `${text.slice(0, FETCH_URL_MAX_CHARS)}…` : text;
}

export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: "get_weather",
    description: "Get the current weather for a named location (city, region, or place name).",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City or place name, e.g. 'Paris' or 'Tokyo, Japan'" },
      },
      required: ["location"],
    },
    execute: (args) => getWeather(String(args.location ?? "")),
  },
  {
    name: "fetch_url",
    description: "Fetch the readable text content of a specific web page URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "A fully-qualified http(s) URL" },
      },
      required: ["url"],
    },
    execute: (args) => fetchUrl(String(args.url ?? "")),
  },
];
