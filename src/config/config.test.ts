import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configExists, getConfigPath, loadConfig, saveConfig } from "./config";
import type { Config } from "./config.types";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "loki-config-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("config", () => {
  test("configExists is false before anything is saved", () => {
    expect(configExists(dir)).toBe(false);
  });

  test("save then load round-trips the config", async () => {
    const config: Config = {
      backend: "llamacpp",
      baseUrl: "http://localhost:9931",
      defaultAgent: "general",
      agents: [{ name: "general", model: "llama3.1:8b", systemPrompt: "Be helpful." }],
    };

    await saveConfig(config, dir);

    expect(configExists(dir)).toBe(true);
    expect(await loadConfig(dir)).toEqual(config);
  });

  test("saveConfig creates the directory if it doesn't exist yet", async () => {
    const nested = join(dir, "nested");
    await saveConfig({ backend: "llamacpp", baseUrl: "http://x", defaultAgent: "a", agents: [] }, nested);
    expect(configExists(nested)).toBe(true);
  });

  test("getConfigPath points at config.json inside the given directory", () => {
    expect(getConfigPath(dir)).toBe(join(dir, "config.json"));
  });
});
