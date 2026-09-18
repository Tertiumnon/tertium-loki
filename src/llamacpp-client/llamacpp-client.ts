import type { ChatMessage, ModelInfo, ToolDefinition } from "../llm-client/llm-client.types";
import type {
  OpenAIModelEntry,
  OpenAIModelsResponse,
  OpenAITool,
  StreamChunk,
  StreamToolCallDelta,
  ToolCall,
  WireMessage,
} from "./llamacpp-client.types";

const MAX_TOOL_ROUNDS = 5;

const PARAM_SIZE_FROM_NAME = /(\d+(?:\.\d+)?)\s*[Bb](?![a-zA-Z])/;

function formatParamSize(nParams: number): string {
  const billions = nParams / 1_000_000_000;
  return `${Number.isInteger(billions) ? billions.toFixed(0) : billions.toFixed(1)}B`;
}

/**
 * llama-server (unlike Ollama) doesn't report a model "family" or parameter
 * count directly for most entries — parameter size is parsed from the repo
 * name (e.g. "...-8B-Instruct-GGUF") when the server itself doesn't supply
 * meta.n_params, same naming-convention-heuristic approach model-suggest
 * already uses for role classification.
 */
function deriveModelInfo(entry: OpenAIModelEntry): ModelInfo {
  const nameMatch = PARAM_SIZE_FROM_NAME.exec(entry.id);
  const parameterSize = entry.meta?.n_params
    ? formatParamSize(entry.meta.n_params)
    : nameMatch
      ? `${nameMatch[1]}B`
      : "?";

  const capabilities = ["completion"];
  if (entry.architecture?.input_modalities?.includes("image")) {
    capabilities.push("vision");
  }

  return {
    name: entry.id,
    family: "unknown",
    parameterSize,
    contextLength: entry.meta?.n_ctx_train,
    capabilities,
  };
}

export async function listModelsDetailed(baseUrl: string): Promise<ModelInfo[]> {
  const res = await fetch(`${baseUrl}/v1/models`);
  if (!res.ok) {
    throw new Error(`GET /v1/models failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as OpenAIModelsResponse;
  return (data.data ?? []).map(deriveModelInfo);
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
  toolCalls: ToolCall[];
}

function applyToolCallDelta(byIndex: Map<number, ToolCall>, delta: StreamToolCallDelta): void {
  const existing = byIndex.get(delta.index);
  if (!existing) {
    byIndex.set(delta.index, {
      id: delta.id ?? `call_${delta.index}`,
      type: "function",
      function: {
        name: delta.function?.name ?? "",
        arguments: delta.function?.arguments ?? "",
      },
    });
    return;
  }
  if (delta.id) existing.id = delta.id;
  if (delta.function?.name) existing.function.name = delta.function.name;
  if (delta.function?.arguments) existing.function.arguments += delta.function.arguments;
}

/** POSTs one /v1/chat/completions turn and reads the SSE stream, collecting text + any tool calls. */
async function streamChat(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  onToken: (token: string) => void,
  tools?: OpenAITool[],
): Promise<StreamedTurn> {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, ...(tools?.length ? { tools } : {}) }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`POST /v1/chat/completions failed: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCallsByIndex = new Map<number, ToolCall>();

  const processLine = (line: string): void => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    const parsed = JSON.parse(payload) as StreamChunk;
    if (parsed.error) {
      throw new Error(typeof parsed.error === "string" ? parsed.error : (parsed.error.message ?? "unknown error"));
    }

    const delta = parsed.choices?.[0]?.delta;
    if (!delta) return;

    if (delta.content) {
      onToken(delta.content);
      content += delta.content;
    }

    for (const tc of delta.tool_calls ?? []) {
      applyToolCallDelta(toolCallsByIndex, tc);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) processLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) processLine(buffer.trim());

  return {
    content,
    toolCalls: [...toolCallsByIndex.values()].filter((tc) => tc.function.name),
  };
}

/**
 * Streams a chat completion from llama-server's OpenAI-compatible /v1/chat/completions
 * endpoint. Calls onToken for each content fragment as it arrives; returns the full reply.
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

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Like chatStream, but lets the model call tools mid-conversation (e.g. get_weather,
 * fetch_url) — the ReAct-style loop Claude Code itself uses for WebFetch/WebSearch,
 * just against a local llama.cpp model instead. Runs each tool call locally, feeds the
 * result back as a "tool" message, and repeats until the model gives a final answer
 * or MAX_TOOL_ROUNDS is hit. Requires the server to be started with --jinja.
 */
export async function chatWithTools(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  onToken: (token: string) => void,
  onToolCall?: (name: string, args: Record<string, unknown>) => void,
): Promise<string> {
  const openaiTools: OpenAITool[] = tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const history: WireMessage[] = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { content, toolCalls } = await streamChat(baseUrl, model, history, onToken, openaiTools);

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
        tool_call_id: call.id,
        content: `Result: ${result}\n\nAnswer the user's question directly using this result. Do not describe that you called a tool.`,
      });
    }
  }

  return "(stopped after too many tool calls without a final answer)";
}
