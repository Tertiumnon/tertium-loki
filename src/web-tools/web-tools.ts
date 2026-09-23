import type { ToolDefinition } from "../llm-client/llm-client.types";
import {
  FETCH_URL_MAX_CHARS,
  FETCH_URL_MIN_USEFUL_CHARS,
  FETCH_URL_TIMEOUT_MS,
  HTML_ENTITIES,
  OPEN_METEO_FORECAST_URL,
  OPEN_METEO_GEOCODING_URL,
  REDDIT_HOST_PATTERN,
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

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const hex = code[1] === "x" || code[1] === "X";
      const n = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Strips markup down to readable text, dropping page chrome (nav/header/footer) and non-text elements. */
export function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");

  // Prefer the page's main content when it's marked up, so the character budget isn't spent on menus.
  const main = /<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(withoutNoise)?.[2];
  const body = main && main.replace(/<[^>]+>/g, "").trim().length > 0 ? main : withoutNoise;

  return decodeEntities(body.replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim();
}

/** Atom/RSS feeds (e.g. Reddit's .rss) carry HTML-escaped entries — render each as "title / author / body". */
function feedToText(xml: string, isThread = false): string {
  const tag = (block: string, name: string): string =>
    new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i").exec(block)?.[1] ?? "";
  const unwrap = (s: string): string => s.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");

  const entries = [...xml.matchAll(/<(entry|item)\b[\s\S]*?<\/\1>/gi)].map(([block], i) => {
    const title = htmlToText(decodeEntities(unwrap(tag(block, "title"))));
    const author = htmlToText(tag(tag(block, "author"), "name") || tag(block, "author") || tag(block, "dc:creator"));
    const body = htmlToText(decodeEntities(unwrap(tag(block, "content") || tag(block, "description"))));
    // In a thread feed the first entry is the post and the rest are replies — label them, or small
    // models attribute commenters' suggestions to the original poster.
    const label = isThread ? (i === 0 ? "ORIGINAL POST" : "COMMENT") : "";
    return [label, title, author && `by ${author}`, body].filter(Boolean).join("\n");
  });

  return entries.length > 0 ? entries.join("\n\n---\n\n") : htmlToText(xml);
}

/** Reddit HTML pages are a JS bot challenge for non-browsers; the .rss variant of the same path is not. */
export function rewriteForFetch(url: URL): URL {
  if (REDDIT_HOST_PATTERN.test(url.hostname) && !/\.(rss|json)$/i.test(url.pathname)) {
    const rewritten = new URL(url);
    rewritten.hostname = "www.reddit.com";
    rewritten.pathname = `${url.pathname.replace(/\/+$/, "")}/.rss`;
    return rewritten;
  }
  return url;
}

/** Fetches a specific URL and returns readable text (markup stripped, truncated). */
export async function fetchUrl(rawUrl: string): Promise<string> {
  let parsed: URL;
  try {
    // Users (and models echoing them) often drop the scheme: "habr.com/ru/articles/1".
    const trimmed = rawUrl.trim();
    parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error(`Not a valid URL: "${rawUrl}"`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Only http(s) URLs can be fetched, got "${parsed.protocol}"`);
  }

  const target = rewriteForFetch(parsed).toString();
  const res = await fetch(target, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_URL_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Fetching ${target} failed: ${res.status} ${res.statusText}`);
  }

  const body = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  const isFeed = /xml|rss|atom/i.test(contentType) || /^\s*<\?xml[\s\S]{0,200}<(feed|rss)\b/i.test(body);
  const isText = /^(text\/plain|application\/json)/i.test(contentType);
  const isRedditThread = REDDIT_HOST_PATTERN.test(parsed.hostname) && /\/comments\//.test(parsed.pathname);
  const text = isFeed ? feedToText(body, isRedditThread) : isText ? body.trim() : htmlToText(body);

  if (text.length < FETCH_URL_MIN_USEFUL_CHARS) {
    return `The page at ${target} returned almost no readable text (it likely requires JavaScript or blocks automated access). Extracted text: "${text}". Tell the user the page could not be read; do not guess its contents.`;
  }

  return text.length > FETCH_URL_MAX_CHARS ? `${text.slice(0, FETCH_URL_MAX_CHARS)}…` : text;
}

export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: "get_weather",
    description:
      "Get the current weather for a named location. Only call this when the user explicitly asks about weather.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City or place name, e.g. 'Paris' or 'Tokyo, Japan'" },
      },
      required: ["location"],
    },
    execute: (args) => getWeather(String(args.location ?? "")),
    answerAfter: true,
  },
  {
    name: "fetch_url",
    description:
      "Fetch the readable text content of a web page. Call this when the user gives a URL or asks about a specific page.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "A fully-qualified http(s) URL" },
      },
      required: ["url"],
    },
    execute: (args) => fetchUrl(String(args.url ?? "")),
    answerAfter: true,
  },
];
