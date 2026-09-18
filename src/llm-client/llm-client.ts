import type { Backend } from "../config/config.types";
import * as llamacppClient from "../llamacpp-client/llamacpp-client";
import * as ollamaClient from "../ollama-client/ollama-client";
import type { ChatMessage, ModelInfo, ToolDefinition } from "./llm-client.types";

export interface LlmClient {
  listModelsDetailed: (baseUrl: string) => Promise<ModelInfo[]>;
  listModels: (baseUrl: string) => Promise<string[]>;
  checkConnection: (baseUrl: string) => Promise<void>;
  chatStream: (
    baseUrl: string,
    model: string,
    messages: ChatMessage[],
    onToken: (token: string) => void,
  ) => Promise<string>;
  chatWithTools: (
    baseUrl: string,
    model: string,
    messages: ChatMessage[],
    tools: ToolDefinition[],
    onToken: (token: string) => void,
    onToolCall?: (name: string, args: Record<string, unknown>) => void,
  ) => Promise<string>;
}

const CLIENTS: Record<Backend, LlmClient> = {
  ollama: ollamaClient,
  llamacpp: llamacppClient,
};

export function getClient(backend: Backend): LlmClient {
  return CLIENTS[backend];
}

export const BACKEND_LABELS: Record<Backend, string> = {
  ollama: "Ollama",
  llamacpp: "llama.cpp",
};

export const BACKEND_DEFAULT_URLS: Record<Backend, string> = {
  ollama: "http://localhost:11434",
  llamacpp: "http://localhost:9931",
};
