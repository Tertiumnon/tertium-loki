/**
 * Backend-agnostic shapes shared by both ollama-client and llamacpp-client.
 * Tool-call plumbing (tool_calls, tool_call_id, ...) is backend-specific wire
 * format and stays internal to each client module — callers only ever see
 * plain {role, content} messages going in and a final string reply coming out.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ModelInfo {
  name: string;
  family: string;
  parameterSize: string;
  contextLength?: number;
  capabilities: string[];
}

/** A tool the model can call mid-conversation, e.g. get_weather or fetch_url. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}
