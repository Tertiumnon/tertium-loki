import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { availableBuiltinTools, commands } from "./chat-loop";
import type { ChatState, Readline } from "./chat-loop.types";

const originalFetch = globalThis.fetch;
const originalCwd = process.cwd();

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

// None of the handlers exercised below touch `rl` (that's only /setup), so a
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
  test("is wired to the same handler as /setup", () => {
    expect(commands["/config"]).toBe(commands["/setup"]);
  });
});

describe("/init", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "loki-chat-loop-test-"));
    process.chdir(dir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  });

  test("scaffolds .loki/settings.yml in the current directory and loads it into state", async () => {
    const state = makeState();
    expect(state.workspaceConfig).toBeUndefined();

    const result = await commands["/init"](noRl, state, "");

    expect(result).toBe("continue");
    expect(state.workspaceConfig?.workspace.autoApprove).toBe(false);
  });

  test("does not overwrite an existing settings file", async () => {
    await commands["/init"](noRl, makeState(), "");
    const settingsPath = join(dir, ".loki", "settings.yml");
    await writeFile(settingsPath, 'workspace:\n  root: "."\n  allowedGlobs: []\n  autoApprove: true\n', "utf-8");

    await commands["/init"](noRl, makeState(), "");

    expect(await readFile(settingsPath, "utf-8")).toContain("autoApprove: true");
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

describe("availableBuiltinTools", () => {
  test("withholds fetch_url until the user has shared a link", () => {
    const names = (content: string) => availableBuiltinTools([{ role: "user", content }]).map((t) => t.name);
    expect(names("what is a mutex?")).toEqual(["get_weather"]);
    expect(names("summarize https://example.com/post")).toContain("fetch_url");
  });
});

describe("availableBuiltinTools link detection", () => {
  test("recognises links pasted without a scheme, but not ordinary sentences", () => {
    const hasFetch = (content: string) =>
      availableBuiltinTools([{ role: "user", content }]).some((t) => t.name === "fetch_url");
    expect(hasFetch("summarize habr.com/ru/articles/1085868/")).toBe(true);
    expect(hasFetch("what's on www.example.com")).toBe(true);
    expect(hasFetch("I use Node.js. Is that ok?")).toBe(false);
  });
});
