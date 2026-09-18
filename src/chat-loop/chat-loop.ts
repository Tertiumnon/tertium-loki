import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { loadAgentsGuide } from "../agents-guide/agents-guide";
import type { Config } from "../config/config.types";
import { BACKEND_LABELS, getClient } from "../llm-client/llm-client";
import type { ChatMessage, ToolDefinition } from "../llm-client/llm-client.types";
import { runSetupWizard } from "../setup-wizard/setup-wizard";
import { BUILTIN_TOOLS } from "../web-tools/web-tools";
import { createFileTools, initWorkspaceConfig, loadWorkspaceConfig } from "../workspace/workspace";
import type { PendingApproval } from "../workspace/workspace.types";
import { ANSI_BLUE, ANSI_GRAY, ANSI_RESET, SPINNER_FRAMES, SPINNER_INTERVAL_MS } from "./chat-loop.constants";
import type { ChatState, CommandHandler, CommandResult, Readline } from "./chat-loop.types";

interface Spinner {
  start: () => void;
  stop: () => void;
}

/** Animated "waiting for a reply" indicator, drawn in place after the "name: " label.
 *  A no-op outside a real TTY (piped output, tests) so it never corrupts non-interactive logs. */
function createSpinner(): Spinner {
  const isInteractive = process.stdout.isTTY === true;
  let timer: ReturnType<typeof setInterval> | undefined;
  let frame = 0;
  let drawn = false;

  // Each tick overwrites the previous glyph in place with a single write (backspace + new
  // char) — erasing to a blank first and redrawing after would flash blank/glyph every tick.
  const draw = (): void => {
    process.stdout.write(`${drawn ? "\b" : ""}${ANSI_GRAY}${SPINNER_FRAMES[frame]}${ANSI_RESET}`);
    drawn = true;
    frame = (frame + 1) % SPINNER_FRAMES.length;
  };

  return {
    start(): void {
      if (!isInteractive || timer) return;
      draw();
      timer = setInterval(draw, SPINNER_INTERVAL_MS);
    },
    stop(): void {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      if (drawn) {
        process.stdout.write("\b \b");
        drawn = false;
      }
    },
  };
}

function printHelp(state: ChatState): void {
  const names = state.config.agents.map((a) => a.name).join(", ");
  console.log("Commands:");
  console.log(`  /agent <name>   switch active profile: ${names}`);
  console.log("  /which          show active profile");
  console.log("  /models         list models available on the server");
  console.log("  /reset          clear conversation history");
  console.log("  /setup, /config re-run setup (rescans models, rebuild profiles)");
  console.log("  /init           create .loki/settings.yml here to enable file tools");
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
      const models = await getClient(state.config.backend).listModels(state.config.baseUrl);
      console.log(`Models on server:\n  ${models.join("\n  ")}`);
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

  "/setup": async (rl, state) => {
    console.log();
    state.config = await runSetupWizard(rl);
    state.agent = state.config.agents.find((a) => a.name === state.config.defaultAgent) ?? state.config.agents[0];
    state.messages = [];
    console.log(`Active profile: ${state.agent.name} (${state.agent.model})\n`);
    return "continue";
  },

  "/init": async (_rl, state) => {
    const { path, created } = await initWorkspaceConfig();
    if (created) {
      console.log(`Created ${path}`);
    } else {
      console.log(`${path} already exists.`);
    }
    state.workspaceConfig = (await loadWorkspaceConfig()) ?? undefined;
    return "continue";
  },

  "/exit": async () => "exit",
  "/quit": async () => "exit",
};
commands["/config"] = commands["/setup"];

async function dispatchCommand(rl: Readline, state: ChatState, input: string): Promise<CommandResult | undefined> {
  const [command, ...rest] = input.split(/\s+/);
  const handler = commands[command];
  return handler ? handler(rl, state, rest.join(" ")) : undefined;
}

function buildSystemPrompt(state: ChatState): string {
  const parts: string[] = [];

  if (state.agentsGuide) {
    parts.push(state.agentsGuide);
  }

  if (state.agent.systemPrompt) {
    parts.push(state.agent.systemPrompt);
  }

  return parts.join("\n\n");
}

async function sendMessage(state: ChatState, content: string, rl: Readline): Promise<void> {
  state.messages.push({ role: "user", content });

  const systemPrompt = buildSystemPrompt(state);
  const outgoing: ChatMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...state.messages]
    : state.messages;

  let allTools: ToolDefinition[] = [...BUILTIN_TOOLS];

  if (state.workspaceConfig) {
    const approvalHandler = async (approval: PendingApproval): Promise<boolean> => {
      const answer = await rl.question(`\n${ANSI_GRAY}Approve ${approval.description}? (y/N): ${ANSI_RESET}`);
      return answer.toLowerCase().startsWith("y");
    };

    const fileTools = createFileTools(state.workspaceConfig, approvalHandler);
    allTools = [...allTools, ...fileTools];
  }

  process.stdout.write(`${ANSI_BLUE}${state.agent.name}${ANSI_RESET}: `);

  const spinner = createSpinner();
  spinner.start();
  let atLineStart = false;

  try {
    const reply = await getClient(state.config.backend).chatWithTools(
      state.config.baseUrl,
      state.agent.model,
      outgoing,
      allTools,
      (token) => {
        spinner.stop();
        process.stdout.write(token);
        atLineStart = token.endsWith("\n");
      },
      (name, args) => {
        spinner.stop();
        if (!atLineStart) process.stdout.write("\n");
        process.stdout.write(`${ANSI_GRAY}[calling ${name}(${JSON.stringify(args)})]${ANSI_RESET}\n`);
        atLineStart = true;
        spinner.start();
      },
    );
    spinner.stop();
    console.log("\n");
    state.messages.push({ role: "assistant", content: reply });
  } catch (err) {
    spinner.stop();
    console.error(`\n[error] ${(err as Error).message}`);
    state.messages.pop();
  }
}

export async function runChatLoop(config: Config): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  const workspaceConfig = await loadWorkspaceConfig();
  const agentsGuide = await loadAgentsGuide();

  const state: ChatState = {
    config,
    agent: config.agents.find((a) => a.name === config.defaultAgent) ?? config.agents[0],
    messages: [],
    workspaceConfig: workspaceConfig ?? undefined,
    agentsGuide: agentsGuide ?? undefined,
  };

  console.log(`loki — connected to ${BACKEND_LABELS[state.config.backend]} at ${state.config.baseUrl}`);
  if (agentsGuide) {
    console.log(`Loaded AGENTS.md (${agentsGuide.length} chars)`);
  }
  if (workspaceConfig) {
    console.log(`Workspace: ${workspaceConfig.workspace.root} (autoApprove: ${workspaceConfig.workspace.autoApprove})`);
  }
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

      await sendMessage(state, userInput, rl);
    }
  } finally {
    rl.close();
  }
}
