import type { ChatMessage } from "../llm-client/llm-client.types";

/** The richer message shape used internally to build conversation history for the wire —
 *  callers only ever pass/receive plain ChatMessage; tool plumbing stays in here. */
export interface WireMessage extends ChatMessage {
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
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
