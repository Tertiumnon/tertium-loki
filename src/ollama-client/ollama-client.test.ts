import { afterEach, describe, expect, test } from "bun:test";
import type { ToolDefinition } from "../llm-client/llm-client.types";
import { chatStream, chatWithTools, listModelsDetailed } from "./ollama-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function ndjsonResponse(lines: string[]): Response {
  return new Response(lines.map((l) => `${l}\n`).join(""), { status: 200 });
}

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
    globalThis.fetch = (async () =>
      new Response("", { status: 500, statusText: "Internal Error" })) as unknown as typeof fetch;
    await expect(listModelsDetailed("http://localhost:11434")).rejects.toThrow("500");
  });
});

describe("chatStream", () => {
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
    globalThis.fetch = (async () =>
      ndjsonResponse([JSON.stringify({ error: "model not found" })])) as unknown as typeof fetch;
    await expect(chatStream("http://localhost:11434", "missing", [], () => {})).rejects.toThrow("model not found");
  });

  test("throws when the response is not ok", async () => {
    globalThis.fetch = (async () =>
      new Response("", { status: 404, statusText: "Not Found" })) as unknown as typeof fetch;
    await expect(chatStream("http://localhost:11434", "missing", [], () => {})).rejects.toThrow("404");
  });
});

describe("chatWithTools", () => {
  function fakeTool(name: string, result: string): ToolDefinition {
    return {
      name,
      description: `test tool ${name}`,
      parameters: { type: "object", properties: {} },
      execute: async () => result,
    };
  }

  test("returns directly when the model calls no tools", async () => {
    globalThis.fetch = (async () =>
      ndjsonResponse([
        JSON.stringify({ message: { content: "Hi there" } }),
        JSON.stringify({ done: true }),
      ])) as unknown as typeof fetch;

    const reply = await chatWithTools("http://localhost:11434", "test-model", [], [fakeTool("noop", "")], () => {});
    expect(reply).toBe("Hi there");
  });

  test("executes a tool call, feeds the result back, and returns the final answer", async () => {
    let round = 0;
    globalThis.fetch = (async () => {
      round++;
      if (round === 1) {
        return ndjsonResponse([
          JSON.stringify({
            message: {
              content: "",
              tool_calls: [{ function: { name: "get_weather", arguments: { location: "Paris" } } }],
            },
          }),
        ]);
      }
      return ndjsonResponse([JSON.stringify({ message: { content: "It is sunny in Paris." } })]);
    }) as unknown as typeof fetch;

    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const reply = await chatWithTools(
      "http://localhost:11434",
      "test-model",
      [{ role: "user", content: "weather in paris?" }],
      [fakeTool("get_weather", "Sunny, 20°C")],
      () => {},
      (name, args) => calls.push({ name, args }),
    );

    expect(reply).toBe("It is sunny in Paris.");
    expect(calls).toEqual([{ name: "get_weather", args: { location: "Paris" } }]);
    expect(round).toBe(2);
  });

  test("reports an unknown tool name without crashing", async () => {
    let round = 0;
    globalThis.fetch = (async () => {
      round++;
      if (round === 1) {
        return ndjsonResponse([
          JSON.stringify({
            message: { content: "", tool_calls: [{ function: { name: "does_not_exist", arguments: {} } }] },
          }),
        ]);
      }
      return ndjsonResponse([JSON.stringify({ message: { content: "done" } })]);
    }) as unknown as typeof fetch;

    const reply = await chatWithTools("http://localhost:11434", "test-model", [], [], () => {});
    expect(reply).toBe("done");
  });

  test("stops after MAX_TOOL_ROUNDS if the model never gives a final answer", async () => {
    globalThis.fetch = (async () =>
      ndjsonResponse([
        JSON.stringify({ message: { content: "", tool_calls: [{ function: { name: "loop", arguments: {} } }] } }),
      ])) as unknown as typeof fetch;

    const tokens: string[] = [];
    const reply = await chatWithTools(
      "http://localhost:11434",
      "test-model",
      [],
      [fakeTool("loop", "again")],
      (token) => tokens.push(token),
    );
    expect(reply).toContain("too many tool calls");
    // The fallback must reach onToken too, or the terminal never shows it (nothing was streamed).
    expect(tokens.join("")).toContain("too many tool calls");
  });

  test("parses stringified JSON arguments as well as plain objects", async () => {
    let round = 0;
    globalThis.fetch = (async () => {
      round++;
      if (round === 1) {
        return ndjsonResponse([
          JSON.stringify({
            message: {
              content: "",
              tool_calls: [{ function: { name: "get_weather", arguments: '{"location":"Rome"}' } }],
            },
          }),
        ]);
      }
      return ndjsonResponse([JSON.stringify({ message: { content: "warm" } })]);
    }) as unknown as typeof fetch;

    const calls: Array<Record<string, unknown>> = [];
    await chatWithTools(
      "http://localhost:11434",
      "test-model",
      [],
      [fakeTool("get_weather", "warm")],
      () => {},
      (_name, args) => calls.push(args),
    );

    expect(calls).toEqual([{ location: "Rome" }]);
  });
});
