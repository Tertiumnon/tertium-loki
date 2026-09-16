import { afterEach, describe, expect, test } from "bun:test";
import { fetchUrl, getWeather } from "./web-tools";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("getWeather", () => {
  test("geocodes the location then reports current conditions", async () => {
    let call = 0;
    globalThis.fetch = (async (url: string) => {
      call++;
      if (call === 1) {
        expect(url).toContain("geocoding-api.open-meteo.com");
        return jsonResponse({ results: [{ name: "Paris", latitude: 48.85, longitude: 2.35, country: "France" }] });
      }
      expect(url).toContain("api.open-meteo.com/v1/forecast");
      return jsonResponse({ current: { temperature_2m: 16.3, weather_code: 1, wind_speed_10m: 9.3 } });
    }) as unknown as typeof fetch;

    const result = await getWeather("Paris");
    expect(result).toBe("Current weather in Paris, France: Mainly clear, 16.3°C, wind 9.3 km/h.");
  });

  test("reports when no location matches", async () => {
    globalThis.fetch = (async () => jsonResponse({ results: [] })) as unknown as typeof fetch;
    const result = await getWeather("Nowhereville");
    expect(result).toBe('No location found matching "Nowhereville".');
  });

  test("falls back to the raw code for an unmapped weather_code", async () => {
    let call = 0;
    globalThis.fetch = (async () => {
      call++;
      if (call === 1) {
        return jsonResponse({ results: [{ name: "Somewhere", latitude: 0, longitude: 0 }] });
      }
      return jsonResponse({ current: { temperature_2m: 10, weather_code: 9999, wind_speed_10m: 1 } });
    }) as unknown as typeof fetch;

    const result = await getWeather("Somewhere");
    expect(result).toContain("weather code 9999");
  });
});

describe("fetchUrl", () => {
  test("strips tags/scripts/styles and collapses whitespace", async () => {
    const html = `
      <html><head><style>body{color:red}</style><script>alert(1)</script></head>
      <body>  <h1>Hello</h1>\n<p>World</p>  </body></html>
    `;
    globalThis.fetch = (async () => new Response(html, { status: 200 })) as unknown as typeof fetch;

    const text = await fetchUrl("https://example.com");
    expect(text).toBe("Hello World");
  });

  test("truncates very long pages", async () => {
    const html = `<p>${"x".repeat(5000)}</p>`;
    globalThis.fetch = (async () => new Response(html, { status: 200 })) as unknown as typeof fetch;

    const text = await fetchUrl("https://example.com");
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThan(5000);
  });

  test("throws on a non-ok response", async () => {
    globalThis.fetch = (async () =>
      new Response("", { status: 404, statusText: "Not Found" })) as unknown as typeof fetch;
    await expect(fetchUrl("https://example.com/missing")).rejects.toThrow("404");
  });
});
