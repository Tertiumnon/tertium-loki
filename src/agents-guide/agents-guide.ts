import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const AGENTS_MD_FILENAME = "AGENTS.md";

export async function loadAgentsGuide(cwd: string = process.cwd()): Promise<string | null> {
  const filePath = resolve(cwd, AGENTS_MD_FILENAME);
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}
