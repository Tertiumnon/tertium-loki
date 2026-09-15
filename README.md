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
- Node.js >= 18.17.

## Install

```bash
git clone git@github.com:Tertiumnon/tertium-loki.git
cd tertium-loki
npm install
npm run build
npm install -g .
```

This registers `loki` as a global command.

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

`loki` talks directly to Ollama's OpenAI-independent native API:
- `GET /api/tags` to list installed models
- `POST /api/chat` with `stream: true`, reading newline-delimited JSON chunks for
  token-by-token streaming output

No SDKs, no framework — see `src/ollamaClient.ts`.

## License

MIT
