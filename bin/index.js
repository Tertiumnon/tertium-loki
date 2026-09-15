#!/usr/bin/env node

// src/config/config.ts
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// src/config/config.constants.ts
var CONFIG_DIR_NAME = ".loki";
var CONFIG_FILE_NAME = "config.json";

// src/config/config.ts
var CONFIG_DIR = join(homedir(), CONFIG_DIR_NAME);
var CONFIG_PATH = join(CONFIG_DIR, CONFIG_FILE_NAME);
function configExists() {
  return existsSync(CONFIG_PATH);
}
function getConfigPath() {
  return CONFIG_PATH;
}
async function loadConfig() {
  const raw = await readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}
async function saveConfig(config) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + `
`, "utf-8");
}

// src/setup-wizard/setup-wizard.ts
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

// src/model-suggest/model-suggest.constants.ts
var ROLE_ORDER = ["general", "coder", "vision"];
var ROLE_DEFAULT_PROMPTS = {
  general: "You are a helpful, concise assistant.",
  coder: "You are an expert software engineer. Answer coding questions concisely, with working code.",
  vision: "You are a helpful assistant that can analyze and describe images in detail."
};
var CODER_NAME_PATTERN = /code|coder|sql|devstral|starcoder/i;
var VISION_NAME_PATTERN = /vision|[-:]vl\b|vl[-:]|llava|bakllava|moondream|pixtral/i;
var EMBED_NAME_PATTERN = /embed/i;
var GUARD_NAME_PATTERN = /guard|shield|moderation/i;

// src/model-suggest/model-suggest.ts
function parseParamCount(size) {
  const match = /([\d.]+)\s*B/i.exec(size);
  return match ? Number.parseFloat(match[1]) : 0;
}
function isChatCapable(model) {
  if (!model.capabilities.includes("completion"))
    return false;
  if (EMBED_NAME_PATTERN.test(model.name))
    return false;
  return true;
}
function classify(model) {
  const roles = [];
  const looksLikeVision = model.capabilities.includes("vision") || VISION_NAME_PATTERN.test(model.name);
  const looksLikeCoder = model.capabilities.includes("insert") || CODER_NAME_PATTERN.test(model.name) || CODER_NAME_PATTERN.test(model.family);
  if (looksLikeVision)
    roles.push("vision");
  if (looksLikeCoder)
    roles.push("coder");
  if (roles.length === 0 && !GUARD_NAME_PATTERN.test(model.name))
    roles.push("general");
  return roles;
}
function suggestForRole(models, role) {
  const candidates = models.filter((m) => isChatCapable(m) && classify(m).includes(role));
  if (candidates.length === 0)
    return;
  return [...candidates].sort((a, b) => parseParamCount(b.parameterSize) - parseParamCount(a.parameterSize))[0];
}
function describeModel(model) {
  const roles = classify(model);
  const caps = model.capabilities.length ? model.capabilities.join(", ") : "none";
  const ctx = model.contextLength ? `, ${Math.round(model.contextLength / 1024)}K ctx` : "";
  const roleLabel = isChatCapable(model) ? roles.join("/") || "unassigned" : "not chat-capable";
  return `${model.parameterSize.padEnd(6)} caps: ${caps}${ctx}  → ${roleLabel}`;
}

// src/ollama-client/ollama-client.ts
async function listModelsDetailed(baseUrl) {
  const res = await fetch(`${baseUrl}/api/tags`);
  if (!res.ok) {
    throw new Error(`GET /api/tags failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.models.map((m) => ({
    name: m.name,
    family: m.details?.family ?? "unknown",
    parameterSize: m.details?.parameter_size ?? "?",
    contextLength: m.details?.context_length,
    capabilities: m.capabilities ?? []
  }));
}
async function listModels(baseUrl) {
  const models = await listModelsDetailed(baseUrl);
  return models.map((m) => m.name);
}
async function chatStream(baseUrl, model, messages, onToken) {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true })
  });
  if (!res.ok || !res.body) {
    throw new Error(`POST /api/chat failed: ${res.status} ${res.statusText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder;
  let buffer = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done)
      break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf(`
`)) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line)
        continue;
      const parsed = JSON.parse(line);
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      const token = parsed.message?.content;
      if (token) {
        onToken(token);
        full += token;
      }
    }
  }
  return full;
}

// src/setup-wizard/setup-wizard.ts
async function ask(rl, question, fallback = "") {
  const answer = (await rl.question(question)).trim();
  return answer || fallback;
}
async function pickModel(rl, models, label) {
  const idxRaw = await ask(rl, `Pick model number for '${label}' [1]: `, "1");
  const idx = Number.parseInt(idxRaw, 10);
  return Number.isInteger(idx) && idx >= 1 && idx <= models.length ? models[idx - 1] : models[0];
}
async function addCustomProfile(rl, models, agents) {
  const label = agents.length === 0 ? "default" : `agent ${agents.length + 1}`;
  const model = await pickModel(rl, models, label);
  const defaultName = agents.length === 0 ? "general" : `agent${agents.length + 1}`;
  const name = await ask(rl, `Name for this profile [${defaultName}]: `, defaultName);
  const systemPrompt = await ask(rl, `System prompt (optional, Enter to skip): `, "");
  agents.push({ name, model: model.name, ...systemPrompt ? { systemPrompt } : {} });
}
async function runSetupWizard(existingRl) {
  const rl = existingRl ?? createInterface({ input: stdin, output: stdout });
  console.log(`loki setup
`);
  try {
    const baseUrl = await ask(rl, `Ollama base URL [http://localhost:11434]: `, "http://localhost:11434");
    console.log(`
Checking connection to ${baseUrl} ...`);
    let allModels;
    try {
      allModels = await listModelsDetailed(baseUrl);
    } catch (err) {
      console.error(`
Could not reach Ollama at ${baseUrl}.`);
      console.error(`Make sure Ollama is running (e.g. "ollama serve", or check your service/WSL setup).`);
      console.error(`Underlying error: ${err.message}`);
      process.exit(1);
    }
    const chatModels = allModels.filter(isChatCapable);
    const skipped = allModels.filter((m) => !isChatCapable(m));
    if (chatModels.length === 0) {
      console.error(`No chat-capable models found at ${baseUrl}. Pull one first, e.g.: ollama pull llama3.1:8b`);
      process.exit(1);
    }
    console.log(`
Found ${allModels.length} model(s):`);
    chatModels.forEach((m, i) => console.log(`  ${i + 1}. ${m.name.padEnd(22)} ${describeModel(m)}`));
    if (skipped.length > 0) {
      console.log(`  (skipped, not chat-capable: ${skipped.map((m) => m.name).join(", ")})`);
    }
    const agents = [];
    const suggestions = ROLE_ORDER.map((role) => ({
      role,
      model: suggestForRole(chatModels, role)
    })).filter((s) => s.model !== undefined);
    if (suggestions.length > 0) {
      console.log(`
Suggested profiles based on reported capabilities:`);
      for (const { role, model } of suggestions) {
        console.log(`  ${role.padEnd(8)} → ${model.name}`);
      }
      console.log();
      for (const { role, model } of suggestions) {
        const accept = await ask(rl, `Create '${role}' profile using ${model.name}? (Y/n): `, "y");
        if (!accept.toLowerCase().startsWith("n")) {
          const name = await ask(rl, `  Profile name [${role}]: `, role);
          const systemPrompt = await ask(rl, `  System prompt [Enter to use the ${role} default, or type your own]: `, ROLE_DEFAULT_PROMPTS[role]);
          agents.push({ name, model: model.name, systemPrompt });
        }
      }
    } else {
      console.log(`
No strong role signal in your installed models — falling back to manual setup.`);
    }
    let addMore = agents.length === 0;
    if (agents.length > 0) {
      const more = await ask(rl, `
Add another custom profile? (y/N): `, "n");
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
      defaultAgent = await ask(rl, `
Default profile on startup [${defaultAgent}] (options: ${names}): `, defaultAgent);
      if (!agents.some((a) => a.name === defaultAgent)) {
        defaultAgent = agents[0].name;
      }
    }
    const config = { baseUrl, defaultAgent, agents };
    await saveConfig(config);
    console.log(`
Saved config to ${getConfigPath()}`);
    console.log(`Run "loki" to start chatting, or "loki config" to redo this setup.
`);
    return config;
  } finally {
    if (!existingRl)
      rl.close();
  }
}

// src/chat-loop/chat-loop.ts
import { createInterface as createInterface2 } from "node:readline/promises";
import { stdin as stdin2, stdout as stdout2 } from "node:process";

// src/chat-loop/chat-loop.constants.ts
var ANSI_RESET = "\x1B[0m";
var ANSI_GRAY = "\x1B[90m";
var ANSI_BLUE = "\x1B[94m";

// src/chat-loop/chat-loop.ts
function printHelp(state) {
  const names = state.config.agents.map((a) => a.name).join(", ");
  console.log("Commands:");
  console.log(`  /agent <name>   switch active profile: ${names}`);
  console.log("  /which          show active profile");
  console.log("  /models         list models available on the Ollama server");
  console.log("  /reset          clear conversation history");
  console.log("  /init, /config  re-run setup (rescans models, rebuild profiles)");
  console.log("  /help           show this help");
  console.log("  /exit, /quit    leave chat");
}
var commands = {
  "/help": async (_rl, state) => {
    printHelp(state);
    return "continue";
  },
  "/which": async (_rl, state) => {
    console.log(`Active profile: ${state.agent.name} (${state.agent.model})`);
    return "continue";
  },
  "/reset": async (_rl, state) => {
    state.messages = [];
    console.log("Conversation history cleared.");
    return "continue";
  },
  "/models": async (_rl, state) => {
    try {
      const models = await listModels(state.config.baseUrl);
      console.log(`Models on server:
  ` + models.join(`
  `));
    } catch (err) {
      console.error(`Failed to list models: ${err.message}`);
    }
    return "continue";
  },
  "/agent": async (_rl, state, args) => {
    const name = args.trim().toLowerCase();
    const found = state.config.agents.find((a) => a.name.toLowerCase() === name);
    if (found) {
      state.agent = found;
      console.log(`Switched to ${found.name} (${found.model})`);
    } else {
      const names = state.config.agents.map((a) => a.name).join(", ");
      console.log(`Unknown profile '${name}'. Options: ${names}`);
    }
    return "continue";
  },
  "/init": async (rl, state) => {
    console.log();
    state.config = await runSetupWizard(rl);
    state.agent = state.config.agents.find((a) => a.name === state.config.defaultAgent) ?? state.config.agents[0];
    state.messages = [];
    console.log(`Active profile: ${state.agent.name} (${state.agent.model})
`);
    return "continue";
  },
  "/exit": async () => "exit",
  "/quit": async () => "exit"
};
commands["/config"] = commands["/init"];
async function dispatchCommand(rl, state, input) {
  const [command, ...rest] = input.split(/\s+/);
  const handler = commands[command];
  return handler ? handler(rl, state, rest.join(" ")) : undefined;
}
async function sendMessage(state, content) {
  state.messages.push({ role: "user", content });
  const outgoing = state.agent.systemPrompt ? [{ role: "system", content: state.agent.systemPrompt }, ...state.messages] : state.messages;
  process.stdout.write(`${ANSI_BLUE}${state.agent.name}${ANSI_RESET}: `);
  try {
    const reply = await chatStream(state.config.baseUrl, state.agent.model, outgoing, (token) => {
      process.stdout.write(token);
    });
    console.log(`
`);
    state.messages.push({ role: "assistant", content: reply });
  } catch (err) {
    console.error(`
[error] ${err.message}`);
    state.messages.pop();
  }
}
async function runChatLoop(config) {
  const rl = createInterface2({ input: stdin2, output: stdout2 });
  const state = {
    config,
    agent: config.agents.find((a) => a.name === config.defaultAgent) ?? config.agents[0],
    messages: []
  };
  console.log(`loki — connected to ${state.config.baseUrl}`);
  console.log(`Type /help for commands, /exit to quit.
`);
  console.log(`Active profile: ${state.agent.name} (${state.agent.model})
`);
  try {
    while (true) {
      let userInput;
      try {
        userInput = (await rl.question(`${ANSI_GRAY}You (${state.agent.name})${ANSI_RESET}: `)).trim();
      } catch {
        break;
      }
      if (!userInput)
        continue;
      const result = await dispatchCommand(rl, state, userInput);
      if (result === "exit")
        break;
      if (result === "continue")
        continue;
      await sendMessage(state, userInput);
    }
  } finally {
    rl.close();
  }
}

// src/index.ts
async function main() {
  const command = process.argv[2];
  if (command === "config" || command === "init") {
    await runSetupWizard();
    return;
  }
  if (command === "--help" || command === "-h") {
    console.log("Usage:");
    console.log("  loki               start chatting (runs setup first time)");
    console.log("  loki init          (re)run the setup wizard");
    console.log("  loki config        alias for init");
    return;
  }
  const config = configExists() ? await loadConfig() : await runSetupWizard();
  await runChatLoop(config);
}
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
