import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { getConfigPath, saveConfig } from "../config/config";
import type { AgentProfile, Config } from "../config/config.types";
import { describeModel, isChatCapable, suggestForRole } from "../model-suggest/model-suggest";
import { ROLE_DEFAULT_PROMPTS, ROLE_ORDER } from "../model-suggest/model-suggest.constants";
import { listModelsDetailed } from "../ollama-client/ollama-client";
import type { ModelInfo } from "../ollama-client/ollama-client.types";
import type { Readline, RoleSuggestion } from "./setup-wizard.types";

async function ask(rl: Readline, question: string, fallback = ""): Promise<string> {
  const answer = (await rl.question(question)).trim();
  return answer || fallback;
}

async function pickModel(rl: Readline, models: ModelInfo[], label: string): Promise<ModelInfo> {
  const idxRaw = await ask(rl, `Pick model number for '${label}' [1]: `, "1");
  const idx = Number.parseInt(idxRaw, 10);
  return Number.isInteger(idx) && idx >= 1 && idx <= models.length ? models[idx - 1] : models[0];
}

async function addCustomProfile(rl: Readline, models: ModelInfo[], agents: AgentProfile[]): Promise<void> {
  const label = agents.length === 0 ? "default" : `agent ${agents.length + 1}`;
  const model = await pickModel(rl, models, label);
  const defaultName = agents.length === 0 ? "general" : `agent${agents.length + 1}`;
  const name = await ask(rl, `Name for this profile [${defaultName}]: `, defaultName);
  const systemPrompt = await ask(rl, `System prompt (optional, Enter to skip): `, "");
  agents.push({ name, model: model.name, ...(systemPrompt ? { systemPrompt } : {}) });
}

/** configDir is overridable so tests can point at a temp directory instead of the real ~/.loki. */
export async function runSetupWizard(existingRl?: Readline, configDir?: string): Promise<Config> {
  const rl = existingRl ?? createInterface({ input: stdin, output: stdout });

  console.log("loki setup\n");

  try {
    const baseUrl = await ask(rl, `Ollama base URL [http://localhost:11434]: `, "http://localhost:11434");

    console.log(`\nChecking connection to ${baseUrl} ...`);
    let allModels: ModelInfo[];
    try {
      allModels = await listModelsDetailed(baseUrl);
    } catch (err) {
      console.error(`\nCould not reach Ollama at ${baseUrl}.`);
      console.error(`Make sure Ollama is running (e.g. "ollama serve", or check your service/WSL setup).`);
      console.error(`Underlying error: ${(err as Error).message}`);
      process.exit(1);
    }

    const chatModels = allModels.filter(isChatCapable);
    const skipped = allModels.filter((m) => !isChatCapable(m));

    if (chatModels.length === 0) {
      console.error(`No chat-capable models found at ${baseUrl}. Pull one first, e.g.: ollama pull llama3.1:8b`);
      process.exit(1);
    }

    // Everything below is derived live from what THIS Ollama server reports
    // (capabilities, family, parameter size) — no model names are hardcoded,
    // so this works the same whether Ollama runs on WSL, native Windows, macOS, or Linux.
    console.log(`\nFound ${allModels.length} model(s):`);
    chatModels.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.name.padEnd(22)} ${describeModel(m)}`);
    });
    if (skipped.length > 0) {
      console.log(`  (skipped, not chat-capable: ${skipped.map((m) => m.name).join(", ")})`);
    }

    const agents: AgentProfile[] = [];

    const suggestions: RoleSuggestion[] = ROLE_ORDER.map((role) => ({
      role,
      model: suggestForRole(chatModels, role),
    })).filter((s): s is RoleSuggestion => s.model !== undefined);

    if (suggestions.length > 0) {
      console.log(`\nSuggested profiles based on reported capabilities:`);
      for (const { role, model } of suggestions) {
        console.log(`  ${role.padEnd(8)} → ${model.name}`);
      }
      console.log();

      for (const { role, model } of suggestions) {
        const accept = await ask(rl, `Create '${role}' profile using ${model.name}? (Y/n): `, "y");
        if (!accept.toLowerCase().startsWith("n")) {
          const name = await ask(rl, `  Profile name [${role}]: `, role);
          const systemPrompt = await ask(
            rl,
            `  System prompt [Enter to use the ${role} default, or type your own]: `,
            ROLE_DEFAULT_PROMPTS[role],
          );
          agents.push({ name, model: model.name, systemPrompt });
        }
      }
    } else {
      console.log(`\nNo strong role signal in your installed models — falling back to manual setup.`);
    }

    let addMore = agents.length === 0;
    if (agents.length > 0) {
      const more = await ask(rl, `\nAdd another custom profile? (y/N): `, "n");
      addMore = more.toLowerCase().startsWith("y");
    }

    while (addMore) {
      await addCustomProfile(rl, chatModels, agents);
      const more = await ask(rl, `Add another profile? (y/N): `, "n");
      addMore = more.toLowerCase().startsWith("y");
    }

    let defaultAgent = agents[0].name;
    if (agents.length > 1) {
      const names = agents.map((a) => a.name).join(", ");
      defaultAgent = await ask(
        rl,
        `\nDefault profile on startup [${defaultAgent}] (options: ${names}): `,
        defaultAgent,
      );
      if (!agents.some((a) => a.name === defaultAgent)) {
        defaultAgent = agents[0].name;
      }
    }

    const config: Config = { baseUrl, defaultAgent, agents };
    await saveConfig(config, configDir);

    console.log(`\nSaved config to ${getConfigPath(configDir)}`);
    console.log(`Run "loki" to start chatting, or "loki config" to redo this setup.\n`);

    return config;
  } finally {
    if (!existingRl) rl.close();
  }
}
