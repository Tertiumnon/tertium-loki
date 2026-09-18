import { afterEach, describe, expect, test } from "bun:test";
import type { ToolDefinition } from "../llm-client/llm-client.types";
import { chatStream, chatWithTools, listModelsDetailed } from "./llamacpp-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Builds a fake /v1/chat/completions SSE response body from a list of chunk objects. */
function sseResponse(events: unknown[]): Response {
  const body = `${events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("")}data: [DONE]\n\n`;
  return new Response(body, { status: 200 });
}

function contentDeltas(...tokens: string[]): unknown[] {
  return tokens.map((content) => ({ choices: [{ delta: { content } }] }));
}

function toolCallDeltas(id: string, name: string, argumentsJson: string): unknown[] {
  return [
    { choices: [{ delta: { tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: "" } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: argumentsJson } }] } }] },
    { choices: [{ finish_reason: "tool_calls", delta: {} }] },
  ];
}

describe("listModelsDetailed", () => {
  test("maps the /v1/models shape into ModelInfo, preferring server-reported meta", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M",
              meta: { n_params: 8_000_000_000, n_ctx_train: 131072 },
              architecture: { input_modalities: ["text"] },
            },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const [model] = await listModelsDetailed("http://localhost:9931");
    expect(model).toEqual({
      name: "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M",
      family: "unknown",
      parameterSize: "8B",
      contextLength: 131072,
      capabilities: ["completion"],
    });
  });

  test("falls back to parsing parameter size from the name when meta is absent", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: [{ id: "bartowski/Qwen2.5-7B-Instruct-GGUF:Q4_K_M" }] }), {
        status: 200,
      })) as unknown as typeof fetch;

    const [model] = await listModelsDetailed("http://localhost:9931");
    expect(model.parameterSize).toBe("7B");
    expect(model.contextLength).toBeUndefined();
  });

  test("falls back to '?' when neither meta nor the name gives a parameter size", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: [{ id: "mystery-model" }] }), { status: 200 })) as unknown as typeof fetch;

    const [model] = await listModelsDetailed("http://localhost:9931");
    expect(model.parameterSize).toBe("?");
  });

  test("flags vision capability from input_modalities", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ data: [{ id: "gemma-3-4b-it", architecture: { input_modalities: ["text", "image"] } }] }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const [model] = await listModelsDetailed("http://localhost:9931");
    expect(model.capabilities).toEqual(["completion", "vision"]);
  });

  test("throws with the status on a non-ok response", async () => {
    globalThis.fetch = (async () =>
      new Response("", { status: 500, statusText: "Internal Error" })) as unknown as typeof fetch;
    await expect(listModelsDetailed("http://localhost:9931")).rejects.toThrow("500");
  });
});

describe("chatStream", () => {
  test("streams tokens as they arrive and assembles the full reply", async () => {
    globalThis.fetch = (async () => sseResponse(contentDeltas("Hel", "lo"))) as unknown as typeof fetch;

    const tokens: string[] = [];
    const full = await chatStream("http://localhost:9931", "test-model", [], (t) => tokens.push(t));

    expect(tokens).toEqual(["Hel", "lo"]);
    expect(full).toBe("Hello");
  });

  test("throws on an in-stream error chunk", async () => {
    globalThis.fetch = (async () => sseResponse([{ error: "model not found" }])) as unknown as typeof fetch;
    await expect(chatStream("http://localhost:9931", "missing", [], () => {})).rejects.toThrow("model not found");
  });

  test("throws when the response is not ok", async () => {
    globalThis.fetch = (async () =>
      new Response("", { status: 404, statusText: "Not Found" })) as unknown as typeof fetch;
    await expect(chatStream("http://localhost:9931", "missing", [], () => {})).rejects.toThrow("404");
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
    globalThis.fetch = (async () => sseResponse(contentDeltas("Hi there"))) as unknown as typeof fetch;

    const reply = await chatWithTools("http://localhost:9931", "test-model", [], [fakeTool("noop", "")], () => {});
    expect(reply).toBe("Hi there");
  });

  test("executes a tool call, feeds the result back, and returns the final answer", async () => {
    let round = 0;
    globalThis.fetch = (async () => {
      round++;
      if (round === 1) {
        return sseResponse(toolCallDeltas("call_1", "get_weather", '{"location":"Paris"}'));
      }
      return sseResponse(contentDeltas("It is sunny in Paris."));
    }) as unknown as typeof fetch;

    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const reply = await chatWithTools(
      "http://localhost:9931",
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
        return sseResponse(toolCallDeltas("call_1", "does_not_exist", "{}"));
      }
      return sseResponse(contentDeltas("done"));
    }) as unknown as typeof fetch;

    const reply = await chatWithTools("http://localhost:9931", "test-model", [], [], () => {});
    expect(reply).toBe("done");
  });

  test("stops after MAX_TOOL_ROUNDS if the model never gives a final answer", async () => {
    globalThis.fetch = (async () => sseResponse(toolCallDeltas("call_1", "loop", "{}"))) as unknown as typeof fetch;

    const tokens: string[] = [];
    const reply = await chatWithTools("http://localhost:9931", "test-model", [], [fakeTool("loop", "again")], (token) =>
      tokens.push(token),
    );
    expect(reply).toContain("too many tool calls");
    // The fallback must reach onToken too, or the terminal never shows it (nothing was streamed).
    expect(tokens.join("")).toContain("too many tool calls");
  });
});
