/**
 * Models whose chat template has no tool support (e.g. Qwen2.5-Coder) still "call" tools — as
 * plain text: a bare JSON object, or one wrapped in <tool_call>/<tools> tags or a ```json fence.
 * The server can't recognise those, so they arrive as ordinary content. These helpers let the
 * tool loops treat such a reply as the tool call it was meant to be.
 */

export interface TextToolCall {
  name: string;
  args: Record<string, unknown>;
}

const WRAPPERS = [
  /^<(tool_call|tools|tool|function_call|json)>\s*([\s\S]*?)\s*<\/\1>$/i,
  /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
];

const CALL_OPENERS = [
  "{",
  "<tool_call>",
  "<tools>",
  "<tool>",
  "<json>",
  "<function_call>",
  "```json",
  "```\n{",
  "```{",
];

/** True while a streamed reply could still turn out to be a text-form tool call. Checked as
 *  prefixes both ways, since an opener can arrive split across tokens ("<", "tools>") — and a
 *  code answer like "```python" is released right away instead of being held to the end. */
export function mightBeTextToolCall(content: string): boolean {
  const start = content.trimStart().toLowerCase();
  return CALL_OPENERS.some((opener) => opener.startsWith(start) || start.startsWith(opener));
}

/**
 * The tool call a reply stands for: either the whole reply, or a call that ends it after some
 * lead-in prose ("I'll check the weather. <json>{...}</json>"). The call has to be the last thing
 * in the reply, so a JSON example in the middle of an explanation never triggers a tool.
 */
export function parseTextToolCall(content: string, toolNames: Set<string>): TextToolCall | undefined {
  let body = content.trim();
  for (const wrapper of WRAPPERS) {
    const match = wrapper.exec(body);
    if (match) body = match[match.length - 1];
  }

  const whole = toToolCall(tryParseJson(body), toolNames);
  if (whole) return whole;

  // Lead-in prose: drop a trailing closing tag/fence, then try each "{" from the end.
  const tail = content
    .trim()
    .replace(/(<\/[a-z_]+>|```)\s*$/i, "")
    .trimEnd();
  if (!tail.endsWith("}")) return undefined;
  // (lastIndexOf clamps a negative fromIndex to 0, so stop explicitly once index 0 has been tried.)
  for (let i = tail.lastIndexOf("{"); i >= 0; i = i > 0 ? tail.lastIndexOf("{", i - 1) : -1) {
    const call = toToolCall(tryParseJson(tail.slice(i)), toolNames);
    if (call) return call;
  }
  return undefined;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toToolCall(parsed: unknown, toolNames: Set<string>): TextToolCall | undefined {
  if (typeof parsed !== "object" || parsed === null) return undefined;

  const { name, arguments: rawArgs, parameters } = parsed as Record<string, unknown>;
  if (typeof name !== "string" || !toolNames.has(name)) return undefined;

  const args = rawArgs ?? parameters ?? {};
  if (typeof args === "string") {
    try {
      return { name, args: JSON.parse(args) as Record<string, unknown> };
    } catch {
      return undefined;
    }
  }
  return typeof args === "object" && args !== null ? { name, args: args as Record<string, unknown> } : undefined;
}

/**
 * Wraps onToken so a reply that starts like a text tool call is held back instead of streamed —
 * otherwise the raw JSON flashes on screen before loki runs the call. flush() releases whatever
 * was held when the reply turned out to be ordinary text.
 */
export function holdBackPossibleToolCall(onToken: (token: string) => void): {
  onToken: (token: string) => void;
  flush: () => void;
} {
  let held = "";
  let holding = true;
  return {
    onToken(token) {
      if (!holding) {
        onToken(token);
        return;
      }
      held += token;
      if (!mightBeTextToolCall(held)) {
        holding = false;
        onToken(held);
        held = "";
      }
    },
    flush() {
      if (held) onToken(held);
      held = "";
      holding = false;
    },
  };
}
