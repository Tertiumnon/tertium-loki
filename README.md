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

It checks the connection to Ollama, lists your installed models, and lets you
define one or more named profiles (model + optional system prompt):

```
loki setup

Ollama base URL [http://localhost:11434]:
Checking connection to http://localhost:11434 ...

Found 4 model(s):
  1. mistral:7b
  2. qwen2.5:7b
  3. llama3.1:8b
  4. qwen2.5-coder:7b

Pick model number for 'default' [1]: 3
Name for this profile [general]: general
System prompt (optional, Enter to skip):
Add another profile? (y/N): y

Pick model number for 'agent 2' [1]: 4
Name for this profile [agent2]: coder
System prompt (optional, Enter to skip): You are an expert software engineer. Answer concisely with working code.
Add another profile? (y/N): n

Default profile on startup [general] (options: general, coder):

Saved config to C:\Users\you\.loki\config.json
```

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
