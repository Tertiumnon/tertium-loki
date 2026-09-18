import type { ChatMessage, ModelInfo, ToolDefinition } from "../llm-client/llm-client.types";
import type {
  OllamaChatStreamChunk,
  OllamaTagsResponse,
  OllamaTool,
  OllamaToolCall,
  WireMessage,
} from "./ollama-client.types";

const MAX_TOOL_ROUNDS = 5;

/**
 * Reads whatever the Ollama server itself reports per model (family, parameter
 * size, context length, capabilities like "insert"/"vision"/"tools"). Nothing
 * here is a hardcoded model list — it works the same against any Ollama server
 * (WSL, native Windows, macOS, Linux) and picks up new models automatically.
 */
export async function listModelsDetailed(baseUrl: string): Promise<ModelInfo[]> {
  const res = await fetch(`${baseUrl}/api/tags`);
  if (!res.ok) {
    throw new Error(`GET /api/tags failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as OllamaTagsResponse;
  return data.models.map((m) => ({
    name: m.name,
    family: m.details?.family ?? "unknown",
    parameterSize: m.details?.parameter_size ?? "?",
    contextLength: m.details?.context_length,
    capabilities: m.capabilities ?? [],
  }));
}

export async function listModels(baseUrl: string): Promise<string[]> {
  const models = await listModelsDetailed(baseUrl);
  return models.map((m) => m.name);
}

export async function checkConnection(baseUrl: string): Promise<void> {
  await listModels(baseUrl);
}

interface StreamedTurn {
  content: string;
  toolCalls: OllamaToolCall[];
}

/** POSTs one /api/chat turn and reads the newline-delimited JSON stream, collecting text + any tool calls. */
async function streamChat(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  onToken: (token: string) => void,
  tools?: OllamaTool[],
): Promise<StreamedTurn> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, ...(tools?.length ? { tools } : {}) }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`POST /api/chat failed: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls: OllamaToolCall[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line) {
        const parsed = JSON.parse(line) as OllamaChatStreamChunk;
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        const token = parsed.message?.content;
        if (token) {
          onToken(token);
          content += token;
        }
        if (parsed.message?.tool_calls?.length) {
          toolCalls.push(...parsed.message.tool_calls);
        }
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  return { content, toolCalls };
}

/**
 * Streams a chat completion from Ollama's /api/chat endpoint (newline-delimited JSON).
 * Calls onToken for each content fragment as it arrives; returns the full assistant reply.
 */
export async function chatStream(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  onToken: (token: string) => void,
): Promise<string> {
  const { content } = await streamChat(baseUrl, model, messages, onToken);
  return content;
}

function parseToolArguments(raw: OllamaToolCall["function"]["arguments"]): Record<string, unknown> {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Like chatStream, but lets the model call tools mid-conversation (e.g. get_weather,
 * fetch_url) — the ReAct-style loop Claude Code itself uses for WebFetch/WebSearch,
 * just against a local Ollama model instead. Runs each tool call locally, feeds the
 * result back as a "tool" message, and repeats until the model gives a final answer
 * or MAX_TOOL_ROUNDS is hit.
 */
export async function chatWithTools(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  onToken: (token: string) => void,
  onToolCall?: (name: string, args: Record<string, unknown>) => void,
): Promise<string> {
  const ollamaTools: OllamaTool[] = tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const history: WireMessage[] = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { content, toolCalls } = await streamChat(baseUrl, model, history, onToken, ollamaTools);

    if (toolCalls.length === 0) {
      return content;
    }

    history.push({ role: "assistant", content, tool_calls: toolCalls });

    for (const call of toolCalls) {
      const tool = toolByName.get(call.function.name);
      const args = parseToolArguments(call.function.arguments);
      onToolCall?.(call.function.name, args);

      const result = tool
        ? await tool.execute(args).catch((err: unknown) => `Error: ${(err as Error).message}`)
        : `Error: unknown tool "${call.function.name}"`;

      history.push({
        role: "tool",
        content: `Result: ${result}\n\nAnswer the user's question directly using this result. Do not describe that you called a tool.`,
        tool_name: call.function.name,
      });
    }
  }

  const fallback = "(stopped after too many tool calls without a final answer)";
  onToken(fallback);
  return fallback;
}
