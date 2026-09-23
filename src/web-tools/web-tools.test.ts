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
    const world = "World ".repeat(40).trim();
    const html = `
      <html><head><style>body{color:red}</style><script>alert(1)</script></head>
      <body>  <h1>Hello</h1>\n<p>${world}</p>  </body></html>
    `;
    globalThis.fetch = (async () => new Response(html, { status: 200 })) as unknown as typeof fetch;

    const text = await fetchUrl("https://example.com");
    expect(text).toBe(`Hello\n${world}`);
  });

  test("truncates very long pages", async () => {
    const html = `<p>${"x".repeat(10000)}</p>`;
    globalThis.fetch = (async () => new Response(html, { status: 200 })) as unknown as typeof fetch;

    const text = await fetchUrl("https://example.com");
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThan(10000);
  });

  test("prefers <main> content, drops nav/footer, and decodes entities", async () => {
    const body = "Real article text &amp; more. ".repeat(10);
    const html = `<nav>Menu Login</nav><main><p>${body}</p></main><footer>Copyright</footer>`;
    globalThis.fetch = (async () => new Response(html, { status: 200 })) as unknown as typeof fetch;

    const text = await fetchUrl("https://example.com");
    expect(text).toContain("Real article text & more.");
    expect(text).not.toContain("Menu");
    expect(text).not.toContain("Copyright");
  });

  test("tells the model plainly when a page has almost no readable text", async () => {
    globalThis.fetch = (async () =>
      new Response("<html><title>Reddit</title><script>challenge()</script></html>", {
        status: 200,
      })) as unknown as typeof fetch;

    const text = await fetchUrl("https://example.com/js-app");
    expect(text).toContain("almost no readable text");
  });

  test("rewrites Reddit pages to their .rss feed and renders entries", async () => {
    let requested = "";
    const feed = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry><author><name>/u/someone</name></author>
        <content type="html">&lt;div class=&quot;md&quot;&gt;&lt;p&gt;${"I&amp;#39;m thinking about a GPU upgrade. ".repeat(8)}&lt;/p&gt;&lt;/div&gt;</content>
        <title>Intel Arc Pro B60?</title></entry></feed>`;
    globalThis.fetch = (async (url: string) => {
      requested = url;
      return new Response(feed, { status: 200, headers: { "content-type": "application/atom+xml" } });
    }) as unknown as typeof fetch;

    const text = await fetchUrl("https://old.reddit.com/r/LocalLLM/comments/abc/some_post/");
    expect(requested).toBe("https://www.reddit.com/r/LocalLLM/comments/abc/some_post/.rss");
    expect(text).toContain("ORIGINAL POST\nIntel Arc Pro B60?");
    expect(text).toContain("by /u/someone");
    expect(text).toContain("I'm thinking about a GPU upgrade.");
  });

  test("rejects non-http(s) and malformed URLs", async () => {
    await expect(fetchUrl("file:///etc/passwd")).rejects.toThrow("http(s)");
    await expect(fetchUrl("not a url")).rejects.toThrow("Not a valid URL");
  });

  test("throws on a non-ok response", async () => {
    globalThis.fetch = (async () =>
      new Response("", { status: 404, statusText: "Not Found" })) as unknown as typeof fetch;
    await expect(fetchUrl("https://example.com/missing")).rejects.toThrow("404");
  });
});

describe("fetchUrl scheme handling", () => {
  test("assumes https:// when the URL has no scheme", async () => {
    let requested = "";
    globalThis.fetch = (async (url: string) => {
      requested = url;
      return new Response(`<p>${"text ".repeat(60)}</p>`, { status: 200 });
    }) as unknown as typeof fetch;
    await fetchUrl("habr.com/ru/articles/1/");
    expect(requested).toBe("https://habr.com/ru/articles/1/");
  });
});
