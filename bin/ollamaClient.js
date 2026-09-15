export async function listModels(baseUrl) {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) {
        throw new Error(`GET /api/tags failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json());
    return data.models.map((m) => m.name);
}
export async function checkConnection(baseUrl) {
    await listModels(baseUrl);
}
/**
 * Streams a chat completion from Ollama's /api/chat endpoint (newline-delimited JSON).
 * Calls onToken for each content fragment as it arrives; returns the full assistant reply.
 */
export async function chatStream(baseUrl, model, messages, onToken) {
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
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (!line)
                continue;
            const parsed = JSON.parse(line);
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
