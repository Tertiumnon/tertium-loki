export type Backend = "ollama" | "llamacpp";

export interface AgentProfile {
  name: string;
  model: string;
  systemPrompt?: string;
}

export interface Config {
  backend: Backend;
  baseUrl: string;
  defaultAgent: string;
  agents: AgentProfile[];
}
