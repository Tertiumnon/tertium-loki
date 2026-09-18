import type { ChatMessage } from "../llm-client/llm-client.types";

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/** The richer message shape used internally to build conversation history for the wire —
 *  callers only ever pass/receive plain ChatMessage; tool plumbing stays in here. */
export interface WireMessage extends ChatMessage {
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface OpenAIModelEntry {
  id: string;
  meta?: {
    n_ctx_train?: number;
    n_params?: number;
  };
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

export interface OpenAIModelsResponse {
  data: OpenAIModelEntry[];
}

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface StreamToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: { name?: string; arguments?: string };
}

export interface StreamChoiceDelta {
  role?: string;
  content?: string | null;
  tool_calls?: StreamToolCallDelta[];
}

export interface StreamChunk {
  choices?: Array<{ delta?: StreamChoiceDelta; finish_reason?: string | null }>;
  error?: string | { message?: string };
}
