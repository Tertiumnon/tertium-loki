import type { createInterface } from "node:readline/promises";
import type { AgentProfile, Config } from "../config/config.types";
import type { ChatMessage } from "../ollama-client/ollama-client.types";
import type { WorkspaceConfig } from "../workspace/workspace.types";

export type Readline = ReturnType<typeof createInterface>;

export interface ChatState {
  config: Config;
  agent: AgentProfile;
  messages: ChatMessage[];
  workspaceConfig?: WorkspaceConfig;
}

export type CommandResult = "continue" | "exit";

export type CommandHandler = (rl: Readline, state: ChatState, args: string) => Promise<CommandResult>;
