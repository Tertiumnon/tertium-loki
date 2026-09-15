import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const CONFIG_DIR = join(homedir(), ".loki");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
export function configExists() {
    return existsSync(CONFIG_PATH);
}
export function getConfigPath() {
    return CONFIG_PATH;
}
export async function loadConfig() {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
}
export async function saveConfig(config) {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
