import type { ChatMessage, ModelInfo, ToolDefinition } from "../llm-client/llm-client.types";
import { holdBackPossibleToolCall, parseTextToolCall } from "../llm-client/text-tool-call";
import { formatToolResult } from "../llm-client/tool-result";
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
const MAX_TOOL_CALLS_PER_TURN = 1;

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

/** llama-server explains most failures in the body ("tools param requires --jinja flag",
 *  context overflow, unknown model, ...) — surface that instead of just "500 Internal Server Error". */
async function errorDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return "";
  try {
    const parsed = JSON.parse(text) as { error?: string | { message?: string } };
    const message = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
    return message ? ` — ${message}` : ` — ${text.slice(0, 300)}`;
  } catch {
    return ` — ${text.slice(0, 300)}`;
  }
}

/** An error reported by llama-server inside an already-open stream (as opposed to an HTTP failure). */
class StreamError extends Error {}

interface StreamedTurn {
  content: string;
  toolCalls: ToolCall[];
}

function applyToolCallDelta(byIndex: Map<number, ToolCall>, delta: StreamToolCallDelta): void {
  const existing = byIndex.get(delta.index);
  if (!existing) {
    byIndex.set(delta.index, {
      id: delta.id ?? "",
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
    // One call per turn: with parallel calls allowed, small models (seen with Qwen2.5-7B) can
    // degenerate into emitting the same call over and over until the context fills.
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...(tools?.length ? { tools, parallel_tool_calls: false } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`POST /v1/chat/completions failed: ${res.status} ${res.statusText}${await errorDetail(res)}`);
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
      throw new StreamError(
        typeof parsed.error === "string" ? parsed.error : (parsed.error.message ?? "unknown error"),
      );
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

  // Some builds ignore parallel_tool_calls: false, and a degenerate model then streams dozens of
  // identical calls. Once a call past the cap starts, stop reading — cancelling the stream also
  // makes llama-server stop generating instead of burning the rest of the context.
  let runaway = false;
  while (!runaway) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) processLine(line);
      if (toolCallsByIndex.size > MAX_TOOL_CALLS_PER_TURN) {
        runaway = true;
        break;
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }
  if (runaway) {
    await reader.cancel().catch(() => {});
  } else if (buffer.trim()) {
    processLine(buffer.trim());
  }

  // Drop the partial call that tripped the cap, and collapse identical calls within the turn.
  const seen = new Set<string>();
  const toolCalls = [...toolCallsByIndex.values()].slice(0, MAX_TOOL_CALLS_PER_TURN).filter((tc) => {
    const key = `${tc.function.name}:${tc.function.arguments}`;
    if (!tc.function.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { content, toolCalls };
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

/**
 * With tools attached, llama-server parses the model's output against the chat template's tool-call
 * grammar and aborts the stream when it doesn't fit ("does not match the expected ... format") —
 * typically a small model trying to call a tool that wasn't offered. If that happens before any text
 * reached the user, retry the turn once without tools so the model answers in plain text instead.
 */
async function streamTurnWithTools(
  baseUrl: string,
  model: string,
  history: WireMessage[],
  onToken: (token: string) => void,
  tools: OpenAITool[],
): Promise<StreamedTurn> {
  let streamedText = false;
  try {
    return await streamChat(
      baseUrl,
      model,
      history,
      (token) => {
        streamedText = true;
        onToken(token);
      },
      tools,
    );
  } catch (err) {
    if (!(err instanceof StreamError) || streamedText) throw err;
    return streamChat(baseUrl, model, history, onToken);
  }
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
  // Small models often repeat the exact same call; re-running it wastes a round and the
  // network, so a repeat just gets the earlier result back with a nudge to answer.
  const resultsByCall = new Map<string, string>();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const display = holdBackPossibleToolCall(onToken);
    const turn = await streamTurnWithTools(baseUrl, model, history, display.onToken, openaiTools);
    let { content } = turn;
    const { toolCalls } = turn;

    if (toolCalls.length === 0) {
      const textCall = parseTextToolCall(content, new Set(toolByName.keys()));
      if (!textCall) {
        display.flush();
        return content;
      }
      toolCalls.push({
        id: "",
        type: "function",
        function: { name: textCall.name, arguments: JSON.stringify(textCall.args) },
      });
      content = "";
    }

    // Some templates stream tool calls without an id; ids must still be unique across the whole history.
    toolCalls.forEach((call, i) => {
      if (!call.id) call.id = `call_${round}_${i}`;
    });
    history.push({ role: "assistant", content, tool_calls: toolCalls });

    for (const call of toolCalls) {
      const tool = toolByName.get(call.function.name);
      const args = parseToolArguments(call.function.arguments);
      const key = `${call.function.name}:${JSON.stringify(args)}`;
      const previous = resultsByCall.get(key);
      onToolCall?.(call.function.name, args);

      let result: string;
      if (previous !== undefined) {
        result = `${previous}\n\n(You already called ${call.function.name} with these arguments — use this result instead of calling it again.)`;
      } else {
        result = tool
          ? await tool.execute(args).catch((err: unknown) => `Error: ${(err as Error).message}`)
          : `Error: unknown tool "${call.function.name}". Available tools: ${[...toolByName.keys()].join(", ")}`;
        resultsByCall.set(key, result);
      }

      history.push({
        role: "tool",
        tool_call_id: call.id,
        content: formatToolResult(call.function.name, result),
      });
    }

    if (toolCalls.some((call) => toolByName.get(call.function.name)?.answerAfter)) break;
  }

  // A one-shot lookup ran, or tool rounds ran out: ask once more with tools withheld, so the model
  // has to answer from what it gathered.
  const { content } = await streamChat(baseUrl, model, history, onToken);
  if (content.trim()) return content;

  const fallback = "(stopped after too many tool calls without a final answer)";
  onToken(fallback);
  return fallback;
}
