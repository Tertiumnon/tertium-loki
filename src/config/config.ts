import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME, CONFIG_FILE_NAME } from "./config.constants";
import type { Config } from "./config.types";

function defaultConfigDir(): string {
  return join(homedir(), CONFIG_DIR_NAME);
}

/** configDir is overridable so tests can point at a temp directory instead of the real ~/.loki. */
export function getConfigPath(configDir: string = defaultConfigDir()): string {
  return join(configDir, CONFIG_FILE_NAME);
}

export function configExists(configDir: string = defaultConfigDir()): boolean {
  return existsSync(getConfigPath(configDir));
}

export async function loadConfig(configDir: string = defaultConfigDir()): Promise<Config> {
  const raw = await readFile(getConfigPath(configDir), "utf-8");
  return JSON.parse(raw) as Config;
}

export async function saveConfig(config: Config, configDir: string = defaultConfigDir()): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(getConfigPath(configDir), JSON.stringify(config, null, 2) + "\n", "utf-8");
}
