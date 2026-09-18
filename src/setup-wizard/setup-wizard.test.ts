import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../config/config";
import { runSetupWizard } from "./setup-wizard";
import type { Readline } from "./setup-wizard.types";

const originalFetch = globalThis.fetch;
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "loki-wizard-test-"));
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await rm(dir, { recursive: true, force: true });
});

/** Feeds a fixed script of answers, one per rl.question() call, in order. */
function fakeReadline(answers: string[]): Readline {
  let i = 0;
  return {
    question: async () => {
      if (i >= answers.length) {
        throw new Error(`setup wizard asked more questions than the test scripted (used ${i})`);
      }
      return answers[i++];
    },
  } as unknown as Readline;
}

function mockModelsEndpoint(models: Array<{ name: string; nParams?: number }>): void {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: models.map((m) => ({
          id: m.name,
          ...(m.nParams ? { meta: { n_params: m.nParams } } : {}),
        })),
      }),
      { status: 200 },
    )) as unknown as typeof fetch;
}

function mockOllamaModelsEndpoint(models: Array<{ name: string }>): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ models: models.map((m) => ({ name: m.name, capabilities: ["completion"] })) }), {
      status: 200,
    })) as unknown as typeof fetch;
}

describe("runSetupWizard", () => {
  test("accepts suggested general + coder profiles and persists them", async () => {
    mockModelsEndpoint([{ name: "llama3.1:8b" }, { name: "qwen2.5-coder:7b" }]);

    const rl = fakeReadline([
      "", // backend -> default (llama.cpp)
      "", // base URL -> default
      "", // accept 'general' suggestion
      "", // profile name -> default "general"
      "", // system prompt -> role default
      "", // accept 'coder' suggestion
      "", // profile name -> default "coder"
      "", // system prompt -> role default
      "n", // add another custom profile? no
      "", // default profile on startup -> "general"
    ]);

    const config = await runSetupWizard(rl, dir);

    expect(config.backend).toBe("llamacpp");
    expect(config.agents.map((a) => a.name)).toEqual(["general", "coder"]);
    expect(config.agents[0].model).toBe("llama3.1:8b");
    expect(config.agents[1].model).toBe("qwen2.5-coder:7b");
    expect(config.defaultAgent).toBe("general");

    expect(await loadConfig(dir)).toEqual(config);
  });

  test("declining the only suggestion falls through to a manual pick", async () => {
    mockModelsEndpoint([{ name: "only-model:7b" }]);

    const rl = fakeReadline([
      "", // backend -> default
      "", // base URL
      "n", // decline the 'general' suggestion
      "1", // manual pick: model #1
      "", // profile name -> default "general"
      "", // system prompt -> skip
      "n", // add another? no
    ]);

    const config = await runSetupWizard(rl, dir);

    expect(config.agents).toHaveLength(1);
    expect(config.agents[0].name).toBe("general");
    expect(config.agents[0].model).toBe("only-model:7b");
  });

  test("lets you override the suggested profile name and system prompt", async () => {
    mockModelsEndpoint([{ name: "llama3.1:8b" }]);

    const rl = fakeReadline([
      "", // backend -> default
      "",
      "", // accept suggestion
      "my-assistant", // custom name
      "You only speak in haiku.", // custom system prompt
      "n",
    ]);

    const config = await runSetupWizard(rl, dir);

    expect(config.agents[0].name).toBe("my-assistant");
    expect(config.agents[0].systemPrompt).toBe("You only speak in haiku.");
  });

  test("picking '2' selects the Ollama backend and its default URL", async () => {
    mockOllamaModelsEndpoint([{ name: "llama3.1:8b" }]);

    const rl = fakeReadline([
      "2", // backend -> Ollama
      "", // base URL -> default (Ollama's)
      "", // accept 'general' suggestion
      "", // profile name -> default "general"
      "", // system prompt -> role default
      "n", // add another custom profile? no
    ]);

    const config = await runSetupWizard(rl, dir);

    expect(config.backend).toBe("ollama");
    expect(config.baseUrl).toBe("http://localhost:11434");
    expect(config.agents[0].model).toBe("llama3.1:8b");
  });
});
