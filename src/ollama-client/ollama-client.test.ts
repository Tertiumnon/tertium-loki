import { afterEach, describe, expect, test } from "bun:test";
import { chatStream, listModelsDetailed } from "./ollama-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("listModelsDetailed", () => {
  test("maps the raw /api/tags shape into ModelInfo", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          models: [
            {
              name: "llama3.1:8b",
              details: { family: "llama", parameter_size: "8.0B", context_length: 131072 },
              capabilities: ["completion", "tools"],
            },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const models = await listModelsDetailed("http://localhost:11434");
    expect(models).toEqual([
      {
        name: "llama3.1:8b",
        family: "llama",
        parameterSize: "8.0B",
        contextLength: 131072,
        capabilities: ["completion", "tools"],
      },
    ]);
  });

  test("fills in defaults when details/capabilities are missing", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ models: [{ name: "mystery:1b" }] }), { status: 200 })) as unknown as typeof fetch;

    const [model] = await listModelsDetailed("http://localhost:11434");
    expect(model.family).toBe("unknown");
    expect(model.parameterSize).toBe("?");
    expect(model.capabilities).toEqual([]);
    expect(model.contextLength).toBeUndefined();
  });

  test("throws with the status on a non-ok response", async () => {
    globalThis.fetch = (async () => new Response("", { status: 500, statusText: "Internal Error" })) as unknown as typeof fetch;
    await expect(listModelsDetailed("http://localhost:11434")).rejects.toThrow("500");
  });
});

describe("chatStream", () => {
  function ndjsonResponse(lines: string[]) {
    return new Response(lines.map((l) => `${l}\n`).join(""), { status: 200 });
  }

  test("streams tokens as they arrive and assembles the full reply", async () => {
    globalThis.fetch = (async () =>
      ndjsonResponse([
        JSON.stringify({ message: { content: "Hel" } }),
        JSON.stringify({ message: { content: "lo" } }),
        JSON.stringify({ done: true }),
      ])) as unknown as typeof fetch;

    const tokens: string[] = [];
    const full = await chatStream("http://localhost:11434", "test-model", [], (t) => tokens.push(t));

    expect(tokens).toEqual(["Hel", "lo"]);
    expect(full).toBe("Hello");
  });

  test("throws on an in-stream error chunk", async () => {
    globalThis.fetch = (async () => ndjsonResponse([JSON.stringify({ error: "model not found" })])) as unknown as typeof fetch;
    await expect(chatStream("http://localhost:11434", "missing", [], () => {})).rejects.toThrow("model not found");
  });

  test("throws when the response is not ok", async () => {
    globalThis.fetch = (async () => new Response("", { status: 404, statusText: "Not Found" })) as unknown as typeof fetch;
    await expect(chatStream("http://localhost:11434", "missing", [], () => {})).rejects.toThrow("404");
  });
});
