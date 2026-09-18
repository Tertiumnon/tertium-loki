import { afterEach, describe, expect, test } from "bun:test";
import { commands } from "./chat-loop";
import type { ChatState, Readline } from "./chat-loop.types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeState(overrides: Partial<ChatState> = {}): ChatState {
  return {
    config: {
      backend: "llamacpp",
      baseUrl: "http://localhost:9931",
      defaultAgent: "general",
      agents: [
        { name: "general", model: "llama3.1:8b" },
        { name: "coder", model: "qwen2.5-coder:7b" },
      ],
    },
    agent: { name: "general", model: "llama3.1:8b" },
    messages: [],
    ...overrides,
  };
}

// None of the handlers exercised below touch `rl` (that's only /init), so a
// dummy is enough — `never` is assignable to the Readline parameter type.
const noRl = undefined as unknown as Readline;

describe("/which", () => {
  test("reports the active profile without changing state", async () => {
    const state = makeState();
    const result = await commands["/which"](noRl, state, "");
    expect(result).toBe("continue");
    expect(state.agent.name).toBe("general");
  });
});

describe("/reset", () => {
  test("clears message history", async () => {
    const state = makeState({ messages: [{ role: "user", content: "hi" }] });
    const result = await commands["/reset"](noRl, state, "");
    expect(result).toBe("continue");
    expect(state.messages).toEqual([]);
  });
});

describe("/agent", () => {
  test("switches to a known profile", async () => {
    const state = makeState();
    await commands["/agent"](noRl, state, "coder");
    expect(state.agent.name).toBe("coder");
  });

  test("is case-insensitive", async () => {
    const state = makeState();
    await commands["/agent"](noRl, state, "CODER");
    expect(state.agent.name).toBe("coder");
  });

  test("leaves the active agent unchanged for an unknown profile", async () => {
    const state = makeState();
    await commands["/agent"](noRl, state, "nonexistent");
    expect(state.agent.name).toBe("general");
  });
});

describe("/exit and /quit", () => {
  test("both signal exit", async () => {
    const state = makeState();
    expect(await commands["/exit"](noRl, state, "")).toBe("exit");
    expect(await commands["/quit"](noRl, state, "")).toBe("exit");
  });
});

describe("/config alias", () => {
  test("is wired to the same handler as /init", () => {
    expect(commands["/config"]).toBe(commands["/init"]);
  });
});

describe("/models", () => {
  test("continues normally after listing models from the server", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: [{ id: "llama3.1:8b" }] }), { status: 200 })) as unknown as typeof fetch;

    const result = await commands["/models"](noRl, makeState(), "");
    expect(result).toBe("continue");
  });

  test("continues (does not throw) when the server is unreachable", async () => {
    globalThis.fetch = (async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch;

    const result = await commands["/models"](noRl, makeState(), "");
    expect(result).toBe("continue");
  });
});
