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

**loki** — a terminal chat CLI for your local [Ollama](https://ollama.com) models.
Type `loki`, pick an agent, chat. Like Claude Code's or GitHub Copilot's CLI, but
100% local: no cloud calls, no API keys, no Python — just Node/TypeScript talking
straight to Ollama's HTTP API.

## Why

Ollama already runs great models locally. This wraps that in a small, scriptable,
Claude-Code-style REPL: a config file with named model "profiles" (e.g. a coding
model, a general model), streamed responses, and slash commands to switch between
them mid-conversation.

## Requirements

- [Ollama](https://ollama.com) installed and running somewhere reachable over HTTP
  (default `http://localhost:11434`) — natively on Windows/macOS/Linux, or inside
  WSL2 (WSL2 auto-forwards `localhost` ports to Windows, so a native Windows CLI
  reaches a WSL-hosted Ollama server with no extra bridging).
- At least one model pulled: `ollama pull llama3.1:8b` (or any other tag).
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
loki init
```

It checks the connection to Ollama, reads what the server itself reports about
each installed model (family, parameter size, context length, and capabilities
like `insert` or `vision`), and **suggests role-based profiles** from that —
nothing is a hardcoded model list, so this works the same whether Ollama runs
under WSL, natively on Windows, macOS, or Linux, and it adapts automatically as
you pull new models:

- a model with the `insert` capability (code infill) or "coder"/"code" in its
  name → suggested as **coder**
- a model with the `vision` capability or vision-ish naming (`llava`, `-vl`, ...)
  → suggested as **vision**
- everything else → suggested as **general**
- when a role has multiple candidates, the one with the most parameters wins
- embedding-only models are detected and skipped — they can't hold a chat

```
loki setup

Ollama base URL [http://localhost:11434]:
Checking connection to http://localhost:11434 ...

Found 4 model(s):
  1. mistral:7b             7.2B   caps: completion, tools, 32K ctx  → general
  2. qwen2.5:7b             7.6B   caps: completion, tools, 32K ctx  → general
  3. llama3.1:8b            8.0B   caps: completion, tools, 128K ctx → general
  4. qwen2.5-coder:7b       7.6B   caps: completion, tools, insert, 32K ctx → coder

Suggested profiles based on reported capabilities:
  general  → llama3.1:8b
  coder    → qwen2.5-coder:7b

Create 'general' profile using llama3.1:8b? (Y/n): y
  Profile name [general]:
  System prompt [Enter to use the general default, or type your own]:
Create 'coder' profile using qwen2.5-coder:7b? (Y/n): y
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
loki — connected to http://localhost:11434
Type /help for commands, /exit to quit.

Active profile: general (llama3.1:8b)

You (general): /agent coder
Switched to coder (qwen2.5-coder:7b)

You (coder): write a function that checks if a number is prime
coder: def is_prime(n): ...

You (coder): /exit
```

### Commands

| Command | Effect |
|---|---|
| `/agent <name>` | switch the active profile/model |
| `/which` | show the active profile |
| `/models` | list models available on the Ollama server |
| `/reset` | clear conversation history |
| `/init`, `/config` | re-run setup without leaving chat (rescans models, rebuilds profiles) |
| `/help` | show commands |
| `/exit`, `/quit` | leave chat |

## Config

Stored at `~/.loki/config.json`:

```json
{
  "baseUrl": "http://localhost:11434",
  "defaultAgent": "general",
  "agents": [
    { "name": "general", "model": "llama3.1:8b" },
    { "name": "coder", "model": "qwen2.5-coder:7b", "systemPrompt": "You are an expert software engineer. Answer concisely with working code." }
  ]
}
```

Edit it by hand, or re-run `loki init` / `loki config`.

## How it works

`loki` talks directly to Ollama's native HTTP API:
- `GET /api/tags` to list installed models
- `POST /api/chat` with `stream: true`, reading newline-delimited JSON chunks for
  token-by-token streaming output

No SDKs, no framework — see `src/ollama-client/ollama-client.ts`.

## Project structure

Each module lives in its own folder with logic, types, and constants split out:

```
src/
  index.ts                          entry point (CLI arg handling)
  ollama-client/
    ollama-client.ts                fetch calls to Ollama's HTTP API
    ollama-client.types.ts
  config/
    config.ts                       read/write ~/.loki/config.json
    config.types.ts
    config.constants.ts
  model-suggest/
    model-suggest.ts                capability/name-based role classification
    model-suggest.types.ts
    model-suggest.constants.ts
  setup-wizard/
    setup-wizard.ts                 interactive first-run / /init flow
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
Nothing hits a real Ollama server or your real `~/.loki/config.json` — `fetch`
is mocked and config tests use a temp directory.

Releases use [`@tertium/js`](https://www.npmjs.com/package/@tertium/js)'s
git-flow release script (expects `main`/`develop` branches):

```bash
bun run release:patch
bun run release:minor
bun run release:major
```

## License

MIT
