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

function mockOllamaTags(models: Array<{ name: string; capabilities?: string[]; parameter_size?: string }>): void {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        models: models.map((m) => ({
          name: m.name,
          details: { parameter_size: m.parameter_size ?? "7B" },
          capabilities: m.capabilities ?? ["completion"],
        })),
      }),
      { status: 200 },
    )) as unknown as typeof fetch;
}

describe("runSetupWizard", () => {
  test("accepts suggested general + coder profiles and persists them", async () => {
    mockOllamaTags([
      { name: "llama3.1:8b", parameter_size: "8.0B" },
      { name: "qwen2.5-coder:7b", parameter_size: "7.6B", capabilities: ["completion", "insert"] },
    ]);

    const rl = fakeReadline([
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

    expect(config.agents.map((a) => a.name)).toEqual(["general", "coder"]);
    expect(config.agents[0].model).toBe("llama3.1:8b");
    expect(config.agents[1].model).toBe("qwen2.5-coder:7b");
    expect(config.defaultAgent).toBe("general");

    expect(await loadConfig(dir)).toEqual(config);
  });

  test("declining the only suggestion falls through to a manual pick", async () => {
    mockOllamaTags([{ name: "only-model:7b" }]);

    const rl = fakeReadline([
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
    mockOllamaTags([{ name: "llama3.1:8b", parameter_size: "8.0B" }]);

    const rl = fakeReadline([
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
});
