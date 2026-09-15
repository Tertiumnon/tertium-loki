import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { listModels } from "./ollamaClient.js";
import { saveConfig, getConfigPath, type AgentProfile, type Config } from "./config.js";

async function ask(rl: ReturnType<typeof createInterface>, question: string, fallback = ""): Promise<string> {
  const answer = (await rl.question(question)).trim();
  return answer || fallback;
}

export async function runSetupWizard(): Promise<Config> {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log("loki setup\n");

  try {
    const baseUrl = await ask(rl, `Ollama base URL [http://localhost:11434]: `, "http://localhost:11434");

    console.log(`\nChecking connection to ${baseUrl} ...`);
    let models: string[];
    try {
      models = await listModels(baseUrl);
    } catch (err) {
      console.error(`\nCould not reach Ollama at ${baseUrl}.`);
      console.error(`Make sure Ollama is running (in WSL: "sudo systemctl status ollama", or "ollama serve").`);
      console.error(`Underlying error: ${(err as Error).message}`);
      process.exit(1);
    }

    if (models.length === 0) {
      console.error(`No models found at ${baseUrl}. Pull one first, e.g.: ollama pull llama3.1:8b`);
      process.exit(1);
    }

    console.log(`\nFound ${models.length} model(s):`);
    models.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));

    const agents: AgentProfile[] = [];
    let addMore = true;
    let firstPrompt = true;

    while (addMore) {
      const label = firstPrompt ? "default" : `agent ${agents.length + 1}`;
      const modelIndexRaw = await ask(rl, `\nPick model number for '${label}' [1]: `, "1");
      const modelIndex = Number.parseInt(modelIndexRaw, 10);
      const model =
        Number.isInteger(modelIndex) && modelIndex >= 1 && modelIndex <= models.length
          ? models[modelIndex - 1]
          : models[0];

      const defaultName = firstPrompt ? "general" : `agent${agents.length + 1}`;
      const name = await ask(rl, `Name for this profile [${defaultName}]: `, defaultName);
      const systemPrompt = await ask(rl, `System prompt (optional, Enter to skip): `, "");

      agents.push({ name, model, ...(systemPrompt ? { systemPrompt } : {}) });
      firstPrompt = false;

      const more = await ask(rl, `Add another profile? (y/N): `, "n");
      addMore = more.toLowerCase().startsWith("y");
    }

    let defaultAgent = agents[0].name;
    if (agents.length > 1) {
      const names = agents.map((a) => a.name).join(", ");
      defaultAgent = await ask(rl, `\nDefault profile on startup [${defaultAgent}] (options: ${names}): `, defaultAgent);
      if (!agents.some((a) => a.name === defaultAgent)) {
        defaultAgent = agents[0].name;
      }
    }

    const config: Config = { baseUrl, defaultAgent, agents };
    await saveConfig(config);

    console.log(`\nSaved config to ${getConfigPath()}`);
    console.log(`Run "loki" to start chatting, or "loki config" to redo this setup.\n`);

    return config;
  } finally {
    rl.close();
  }
}
