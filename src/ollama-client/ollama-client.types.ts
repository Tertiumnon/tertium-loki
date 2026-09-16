export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
}

export interface ModelInfo {
  name: string;
  family: string;
  parameterSize: string;
  contextLength?: number;
  capabilities: string[];
}

export interface OllamaTagsModel {
  name: string;
  details?: {
    family?: string;
    parameter_size?: string;
    context_length?: number;
  };
  capabilities?: string[];
}

export interface OllamaTagsResponse {
  models: OllamaTagsModel[];
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown> | string;
  };
}

export interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OllamaChatStreamChunk {
  message?: { content?: string; tool_calls?: OllamaToolCall[] };
  done?: boolean;
  error?: string;
}

/** A tool the model can call mid-conversation, e.g. get_weather or fetch_url. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}
