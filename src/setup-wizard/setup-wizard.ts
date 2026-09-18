import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { getConfigPath, saveConfig } from "../config/config";
import type { AgentProfile, Backend, Config } from "../config/config.types";
import { BACKEND_DEFAULT_URLS, BACKEND_LABELS, getClient } from "../llm-client/llm-client";
import type { ModelInfo } from "../llm-client/llm-client.types";
import { describeModel, isChatCapable, suggestForRole } from "../model-suggest/model-suggest";
import { ROLE_DEFAULT_PROMPTS, ROLE_ORDER } from "../model-suggest/model-suggest.constants";
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
    console.log("Which backend do you want to use?");
    console.log("  1. llama.cpp (default)");
    console.log("  2. Ollama");
    const backendChoice = await ask(rl, `Backend [1]: `, "1");
    const backend: Backend = backendChoice.trim() === "2" ? "ollama" : "llamacpp";
    const client = getClient(backend);
    const label = BACKEND_LABELS[backend];
    const defaultUrl = BACKEND_DEFAULT_URLS[backend];

    const baseUrl = await ask(rl, `\n${label} base URL [${defaultUrl}]: `, defaultUrl);

    console.log(`\nChecking connection to ${baseUrl} ...`);
    let allModels: ModelInfo[];
    try {
      allModels = await client.listModelsDetailed(baseUrl);
    } catch (err) {
      console.error(`\nCould not reach ${label} at ${baseUrl}.`);
      if (backend === "ollama") {
        console.error(`Make sure Ollama is running (e.g. "ollama serve", or check your service/WSL setup).`);
      } else {
        console.error(
          `Make sure llama-server is running (e.g. "systemctl status llama-server", or check your WSL setup).`,
        );
      }
      console.error(`Underlying error: ${(err as Error).message}`);
      process.exit(1);
    }

    const chatModels = allModels.filter(isChatCapable);
    const skipped = allModels.filter((m) => !isChatCapable(m));

    if (chatModels.length === 0) {
      if (backend === "ollama") {
        console.error(`No chat-capable models found at ${baseUrl}. Pull one first, e.g.: ollama pull llama3.1:8b`);
      } else {
        console.error(`No chat-capable models found at ${baseUrl}. Load one first, e.g. by hitting it once with`);
        console.error(`that model's id in the "model" field of a /v1/chat/completions request (router mode`);
        console.error(`auto-loads it).`);
      }
      process.exit(1);
    }

    // Everything below is derived live from what THIS server reports (capabilities,
    // parameter size, ...) — no model names are hardcoded, so this works the same
    // wherever the chosen backend runs.
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

    const config: Config = { backend, baseUrl, defaultAgent, agents };
    await saveConfig(config, configDir);

    console.log(`\nSaved config to ${getConfigPath(configDir)}`);
    console.log(`Run "loki" to start chatting, or "loki config" to redo this setup.\n`);

    return config;
  } finally {
    if (!existingRl) rl.close();
  }
}
