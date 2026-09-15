import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AgentProfile {
  name: string;
  model: string;
  systemPrompt?: string;
}

export interface Config {
  baseUrl: string;
  defaultAgent: string;
  agents: AgentProfile[];
}

const CONFIG_DIR = join(homedir(), ".loki");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export async function loadConfig(): Promise<Config> {
  const raw = await readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as Config;
}

export async function saveConfig(config: Config): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
