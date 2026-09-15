export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
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

export interface OllamaChatStreamChunk {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}
