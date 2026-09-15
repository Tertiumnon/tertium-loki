import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Config } from "../config/config.types";
import { chatStream, listModels } from "../ollama-client/ollama-client";
import type { ChatMessage } from "../ollama-client/ollama-client.types";
import { runSetupWizard } from "../setup-wizard/setup-wizard";
import { ANSI_BLUE, ANSI_GRAY, ANSI_RESET } from "./chat-loop.constants";
import type { ChatState, CommandHandler, CommandResult, Readline } from "./chat-loop.types";

function printHelp(state: ChatState): void {
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

export const commands: Record<string, CommandHandler> = {
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
      console.log("Models on server:\n  " + models.join("\n  "));
    } catch (err) {
      console.error(`Failed to list models: ${(err as Error).message}`);
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
    console.log(`Active profile: ${state.agent.name} (${state.agent.model})\n`);
    return "continue";
  },

  "/exit": async () => "exit",
  "/quit": async () => "exit",
};
commands["/config"] = commands["/init"];

async function dispatchCommand(rl: Readline, state: ChatState, input: string): Promise<CommandResult | undefined> {
  const [command, ...rest] = input.split(/\s+/);
  const handler = commands[command];
  return handler ? handler(rl, state, rest.join(" ")) : undefined;
}

async function sendMessage(state: ChatState, content: string): Promise<void> {
  state.messages.push({ role: "user", content });

  const outgoing: ChatMessage[] = state.agent.systemPrompt
    ? [{ role: "system", content: state.agent.systemPrompt }, ...state.messages]
    : state.messages;

  process.stdout.write(`${ANSI_BLUE}${state.agent.name}${ANSI_RESET}: `);
  try {
    const reply = await chatStream(state.config.baseUrl, state.agent.model, outgoing, (token) => {
      process.stdout.write(token);
    });
    console.log("\n");
    state.messages.push({ role: "assistant", content: reply });
  } catch (err) {
    console.error(`\n[error] ${(err as Error).message}`);
    state.messages.pop();
  }
}

export async function runChatLoop(config: Config): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  const state: ChatState = {
    config,
    agent: config.agents.find((a) => a.name === config.defaultAgent) ?? config.agents[0],
    messages: [],
  };

  console.log(`loki — connected to ${state.config.baseUrl}`);
  console.log(`Type /help for commands, /exit to quit.\n`);
  console.log(`Active profile: ${state.agent.name} (${state.agent.model})\n`);

  try {
    while (true) {
      let userInput: string;
      try {
        userInput = (await rl.question(`${ANSI_GRAY}You (${state.agent.name})${ANSI_RESET}: `)).trim();
      } catch {
        break; // Ctrl+C / EOF
      }

      if (!userInput) continue;

      const result = await dispatchCommand(rl, state, userInput);
      if (result === "exit") break;
      if (result === "continue") continue;

      await sendMessage(state, userInput);
    }
  } finally {
    rl.close();
  }
}
