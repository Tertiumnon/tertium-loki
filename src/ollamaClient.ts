export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function listModels(baseUrl: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/api/tags`);
  if (!res.ok) {
    throw new Error(`GET /api/tags failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { models: { name: string }[] };
  return data.models.map((m) => m.name);
}

export async function checkConnection(baseUrl: string): Promise<void> {
  await listModels(baseUrl);
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
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`POST /api/chat failed: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      const parsed = JSON.parse(line) as {
        message?: { content?: string };
        done?: boolean;
        error?: string;
      };
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      const token = parsed.message?.content;
      if (token) {
        onToken(token);
        full += token;
      }
    }
  }

  return full;
}
