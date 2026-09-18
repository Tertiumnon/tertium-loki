# @tertium/loki

```
        __            __
       /  \.        ./  \
      |    \\      //    |
       \    \\    //    /
        \    \\  //    /
         '.   \\//   .'
           '.  ()  .'
          .-'|    |'-.
         /   '----'   \
        |   O      O   |
         \    \__/    /
          '.        .'
            '------'
```

**loki** — a terminal chat CLI for your local models, backed by either
[llama.cpp](https://github.com/ggml-org/llama.cpp) or [Ollama](https://ollama.com) —
you pick which one during setup. Type `loki`, pick an agent, chat. Like Claude
Code's or GitHub Copilot's CLI, but 100% local: no cloud calls, no API keys —
just Node/TypeScript talking straight to your local server's HTTP API.

> ⚠️ **DEVELOPMENT**: This project is under active development. Features and APIs
> may change. Contributions and feedback welcome.
> [GitHub Issues](https://github.com/Tertiumnon/tertium-loki/issues)

## Why

llama.cpp and Ollama both already run great models locally. This wraps whichever
one you use in a small, scriptable, Claude-Code-style REPL: a config file with
named model "profiles" (e.g. a coding model, a general model), streamed
responses, and slash commands to switch between them mid-conversation.

## Requirements

Pick one backend and have it running before `loki setup`:

- **llama.cpp** — `llama-server`, built and running somewhere reachable over
  HTTP (default `http://localhost:9931`), started in **router mode** so
  multiple models can be listed/auto-loaded, and with `--jinja` so tool-calling
  works — natively on Windows/macOS/Linux, or inside WSL2 (WSL2 auto-forwards
  `localhost` ports to Windows, so a native Windows CLI reaches a WSL-hosted
  llama-server with no extra bridging). See `scripts/llamacpp-ubuntu-setup/` in
  this repo for an automated Ubuntu/WSL setup. At least one GGUF model needs to
  be downloaded into llama-server's cache (the setup script handles this, or
  use `llama-server -hf <user>/<repo>:<quant>` once).
- **Ollama** — installed and running somewhere reachable over HTTP (default
  `http://localhost:11434`) — natively on Windows/macOS/Linux, or inside WSL2.
  At least one model pulled: `ollama pull llama3.1:8b` (or any other tag).

Either way, also:
- [Bun](https://bun.sh) >= 1.4 (used as both installer and bundler).
- Node.js >= 18.17 (the built CLI runs on plain Node too, no Bun needed at runtime).

## Install

```bash
git clone git@github.com:Tertiumnon/tertium-loki.git
cd tertium-loki
bun install
bun run build
bun link
```

`bun link` registers `loki` as a global command (via Bun's global bin dir, e.g.
`~/.bun/bin` — make sure that's on your `PATH`).

## Usage

First run walks you through setup automatically; you can also trigger it explicitly:

```bash
loki setup
```

It first asks which backend to use, then checks the connection and reads what
that server itself reports about each installed model (parameter size,
capabilities), and **suggests role-based profiles** from that plus
naming-convention heuristics — nothing is a hardcoded model list, so this works
the same wherever the server runs, and it adapts automatically as you add new
models:

- "coder"/"code" in the model id → suggested as **coder**
- vision capability reported by the server, or vision-ish naming
  (`llava`, `-vl`, ...) → suggested as **vision**
- everything else → suggested as **general**
- when a role has multiple candidates, the one with the most parameters wins
- embedding-only models are detected by name and skipped — they can't hold a chat

```
loki setup

Which backend do you want to use?
  1. llama.cpp (default)
  2. Ollama
Backend [1]:

llama.cpp base URL [http://localhost:9931]:
Checking connection to http://localhost:9931 ...

Found 4 model(s):
  1. bartowski/Mistral-7B-Instruct-v0.3-GGUF:Q4_K_M       7B  caps: completion  → general
  2. bartowski/Qwen2.5-7B-Instruct-GGUF:Q4_K_M             7B  caps: completion  → general
  3. bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M      8B  caps: completion  → general
  4. bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M       7B  caps: completion  → coder

Suggested profiles based on reported capabilities:
  general  → bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M
  coder    → bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M

Create 'general' profile using bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M? (Y/n): y
  Profile name [general]:
  System prompt [Enter to use the general default, or type your own]:
Create 'coder' profile using bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M? (Y/n): y
  Profile name [coder]:
  System prompt [Enter to use the coder default, or type your own]:

Add another custom profile? (y/N): n

Default profile on startup [general] (options: general, coder):

Saved config to C:\Users\you\.loki\config.json
```

You can decline any suggestion (answer `n`) and/or add fully custom profiles
afterward by picking a model number manually — the suggestion step never
forces a choice on you.

Then just run:

```bash
loki
```

```
loki — connected to http://localhost:9931
Type /help for commands, /exit to quit.

Active profile: general (bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M)

You (general): /agent coder
Switched to coder (bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M)

You (coder): write a function that checks if a number is prime
coder: def is_prime(n): ...

You (coder): /exit
```

### Commands

| Command | Effect |
|---|---|
| `/agent <name>` | switch the active profile/model |
| `/which` | show the active profile |
| `/models` | list models available on the llama.cpp server |
| `/reset` | clear conversation history |
| `/setup`, `/config` | re-run setup without leaving chat (rescans models, rebuilds profiles) |
| `/init` | create `.loki/settings.yml` here to enable file tools |
| `/help` | show commands |
| `/exit`, `/quit` | leave chat |

## Project Instructions (AGENTS.md)

If an `AGENTS.md` file exists in the current directory, `loki` will load it and
prepend its contents to every agent's system prompt. This lets you provide
project-specific context, conventions, or instructions that apply to all agents.

Example `AGENTS.md`:

```markdown
# Project-Wide Instructions

- Use TypeScript with strict type checking.
- For API responses, always validate and handle errors.
- Prefer composition over inheritance.
- Keep functions under 20 lines.
- File structure follows the tertium-* pattern: each module in its own folder
  with logic, types, and constants split out.
```

This is read on startup and prepended before any agent-specific system prompt,
so project instructions apply globally while agent system prompts can still
specialize per role (coding vs. general vs. vision).

## Config

Stored at `~/.loki/config.json`. One config = one backend (switch backends by
re-running `loki setup`, which overwrites it):

```json
{
  "backend": "llamacpp",
  "baseUrl": "http://localhost:9931",
  "defaultAgent": "general",
  "agents": [
    { "name": "general", "model": "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M" },
    { "name": "coder", "model": "bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M", "systemPrompt": "You are an expert software engineer. Answer concisely with working code." }
  ]
}
```

With Ollama as the backend, `"backend"` is `"ollama"` and `model` values are
Ollama tags (e.g. `"llama3.1:8b"`) instead of Hugging Face repo ids.

Edit it by hand, or re-run `loki setup` / `loki config`.

## Tools

### Internet Access

Local models have no internet access by default — they can only answer from
what they learned during training, so anything time-sensitive (weather, current
events) either gets refused or hallucinated. `loki` gives every agent two
built-in web tools it can call mid-conversation, the same ReAct-style loop Claude
Code itself uses for `WebFetch`:

- **`get_weather(location)`** — current conditions via
  [Open-Meteo](https://open-meteo.com) (free, no API key, built for
  programmatic access).
- **`fetch_url(url)`** — fetches a specific page and returns its text (HTML
  stripped), like Claude Code's `WebFetch`.

```
You (general): what's the weather in Paris right now?
general:
[calling get_weather({"location":"Paris"})]
The current weather in Paris is partly cloudy, 16.7°C, wind 10 km/h.
```

**No general "search the web" tool.** Real search APIs (Google/Bing/Brave/Tavily)
all require an API key; the free, keyless alternative is scraping a search
engine's HTML, which DuckDuckGo actively blocks with a bot-detection CAPTCHA —
confirmed while building this, so it wasn't shipped as a silently-broken tool.
If you want open-ended search, add a tool backed by a paid/keyed search API in
`src/web-tools/web-tools.ts`.

**Reliability depends on the model and, for llama.cpp, server flags.**

- With the **llama.cpp** backend, `llama-server` must be started with `--jinja`
  for tool-calling to work at all — without it, models just describe the tool
  call as plain text instead of emitting a structured one. Even with `--jinja`,
  quality varies by model: Llama 3.1/3.3 and Qwen 2.5 (including Qwen 2.5
  Coder) have native tool-call template support and work reliably in testing;
  models without a tool-aware chat template fall back to llama.cpp's "Generic"
  handler, which is less consistent. See llama.cpp's
  [function-calling docs](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md)
  for which models are natively supported.
- With the **Ollama** backend, tool-calling support can be inconsistent even on
  models that advertise it — `llama3.1:8b` reliably used both tools correctly
  in testing, while `qwen2.5-coder:7b` sometimes emitted the tool call as plain
  text instead of a structured call.

If a tool doesn't seem to fire, try `/agent general` (or whichever profile uses
your strongest general-purpose model).

### File Operations (Workspace)

Agents get no file-read/write capabilities by default. Run `loki init` (or `/init`
mid-chat) in a project directory to scaffold `.loki/settings.yml` there — the
same safe pattern Claude Code uses for local context, with approval gates:

```bash
cd your-project
loki init
```

```
Created /path/to/your-project/.loki/settings.yml
Edit allowedGlobs/deniedGlobs/autoApprove to control what agents can read/write here.
```

The generated file starts permissive (everything except `node_modules/`, `.git/`,
`.env`, and `secrets/`) with `autoApprove: false`, so every write/delete/move still
prompts for confirmation until you opt in. Tighten it to taste:

```yaml
workspace:
  root: "."  # Base path; all ops confined here
  allowedGlobs:
    - "src/**"
    - "lib/**"
    - "*.json"
    - "*.md"
  deniedGlobs:
    - "node_modules/**"
    - ".git/**"
  autoApprove: true  # If true, writes auto-execute without per-command confirmation
```

`loki init` never overwrites an existing `.loki/settings.yml` — pass `--force` if
you really want to reset it back to the generated defaults.

Once configured, agents can call:

- **`read_file(path)`** — read a file.
- **`write_file(path, content)`** — create or overwrite a file.
- **`list_files(path)`** — list directory contents.
- **`delete_file(path)`** — delete a file or folder.
- **`move_file(from, to)`** — rename or move.
- **`create_folder(path)`** — create a directory.

All paths are validated against `allowedGlobs` / `deniedGlobs` before executing — the
model can never escape the workspace root or touch forbidden paths, even if it tries.
If `autoApprove` is `false` (or omitted, default), write/delete operations prompt in
chat before executing: `Approve write_file(...)? (y/N):`.

```
You (coder): /init
Created /path/to/your-project/.loki/settings.yml
Edit allowedGlobs/deniedGlobs/autoApprove to control what agents can read/write here.

You (coder): create a haiku.txt file with a haiku about local LLMs
coder:
[calling write_file({"path":"haiku.txt","content":"Local models hum\nNo cloud, no key, just silence\nTokens flow offline"})]

Approve Write 54 chars to haiku.txt? (y/N): y
Created haiku.txt for you.
```

Declining (`n`, or just Enter) cancels that one call — the tool returns
`Cancelled by user.` to the model instead of touching the file, and the
conversation continues normally. With `autoApprove: true` the same exchange
skips the prompt entirely and applies the write immediately.

## How it works

`loki` talks directly to whichever backend's native HTTP API you picked at
setup — `src/llm-client/llm-client.ts` picks the right implementation based on
`config.backend`, and both expose the same `{listModelsDetailed, chatStream,
chatWithTools, ...}` shape to the rest of the app:

- **llama.cpp** (`src/llamacpp-client/llamacpp-client.ts`) — the OpenAI-compatible API:
  `GET /v1/models` to list loaded/cached models (router mode), `POST
  /v1/chat/completions` with `stream: true`, reading Server-Sent Events for
  token-by-token streaming output, accumulating any `tool_calls` the model
  makes across their streamed argument fragments.
- **Ollama** (`src/ollama-client/ollama-client.ts`) — Ollama's native API:
  `GET /api/tags` to list installed models, `POST /api/chat` with `stream:
  true`, reading newline-delimited JSON chunks.

Either way, when the model calls a tool, `loki` runs it locally and feeds the
result back as a `tool` message, looping until it gets a final answer.

No SDKs, no framework — see `src/web-tools/web-tools.ts` for the tool
implementations.

## Project structure

Each module lives in its own folder with logic, types, and constants split out:

```
src/
  index.ts                          entry point (CLI arg handling)
  llm-client/
    llm-client.ts                   picks ollama-client or llamacpp-client based on config.backend
    llm-client.types.ts             shared ChatMessage / ModelInfo / ToolDefinition shapes
  llamacpp-client/
    llamacpp-client.ts              fetch calls to llama-server's OpenAI-compatible API + tool-calling loop
    llamacpp-client.types.ts
  ollama-client/
    ollama-client.ts                fetch calls to Ollama's native API + tool-calling loop
    ollama-client.types.ts
  web-tools/
    web-tools.ts                    get_weather / fetch_url tool implementations
    web-tools.types.ts
    web-tools.constants.ts
  workspace/
    workspace.ts                    file tools + workspace config loading
    workspace.types.ts
    workspace.constants.ts
  config/
    config.ts                       read/write ~/.loki/config.json
    config.types.ts
    config.constants.ts
  model-suggest/
    model-suggest.ts                capability/name-based role classification
    model-suggest.types.ts
    model-suggest.constants.ts
  setup-wizard/
    setup-wizard.ts                 interactive first-run / /setup flow
    setup-wizard.types.ts
  chat-loop/
    chat-loop.ts                    the REPL + slash-command dispatch table
    chat-loop.types.ts
    chat-loop.constants.ts
```

`bun build` bundles all of this into a single `bin/index.js` — that's the only
file that actually ships (see `files` in `package.json`).

## Development

```bash
bun install       # install deps
bun test          # run the test suite
bun run typecheck # tsc --noEmit
bun run lint      # biome check .
bun run format    # biome format --write .
bun run build     # bundle src/index.ts -> bin/index.js
bun run start     # run the built CLI
```

Tests are colocated with each module (`*.test.ts` next to the file it covers).
Nothing hits a real llama.cpp or Ollama server, or your real `~/.loki/config.json`
— `fetch` is mocked and config tests use a temp directory.

Releases use [`@tertium/js`](https://www.npmjs.com/package/@tertium/js)'s
git-flow release script (expects `main`/`develop` branches):

```bash
bun run release:patch
bun run release:minor
bun run release:major
```

## License

MIT
