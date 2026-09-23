export const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export const FETCH_URL_MAX_CHARS = 8000;
export const FETCH_URL_TIMEOUT_MS = 20_000;
// Below this much extracted text the page is almost certainly a JS shell or bot challenge.
export const FETCH_URL_MIN_USEFUL_CHARS = 200;

// www/old/new/np.reddit.com HTML pages serve a JS bot challenge to non-browsers,
// but the same path with ".rss" appended returns the post + comments as Atom XML.
export const REDDIT_HOST_PATTERN = /^(?:www\.|old\.|new\.|np\.)?reddit\.com$/i;

export const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};
export const USER_AGENT = "loki-cli (+https://github.com/Tertiumnon/tertium-loki)";

// WMO weather interpretation codes, as returned by Open-Meteo's `weather_code` field.
export const WMO_WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};
