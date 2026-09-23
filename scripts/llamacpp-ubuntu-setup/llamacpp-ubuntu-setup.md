# llama.cpp setup for Ubuntu

Builds [llama.cpp](https://github.com/ggml-org/llama.cpp) from source (with CUDA if an
NVIDIA GPU is detected), downloads the GGUF models you choose, and installs it as a
systemd service running in **router mode** — models are loaded on demand and swapped
automatically, similar to how Ollama behaves. Works on native Ubuntu and Ubuntu-on-WSL.

Nothing is hardcoded: the script detects your GPU, user, and OS packages, and prompts
for everything else (install path, port, context size, models to download, service
name, whether to disable an existing Ollama install).

## Usage

```sh
./llamacpp-ubuntu-setup.sh
```

Run it as your normal user (not root) — it calls `sudo` itself when it needs to
install packages or manage the systemd service, and will prompt for your password.

You'll be asked for:

- Where to clone/build llama.cpp (default `~/llama.cpp`)
- Whether to build with CUDA, if one or more NVIDIA GPUs are detected — the build
  targets the union of every detected card's compute capability, so it works
  correctly even on mixed-GPU machines (e.g. an old card + a new one)
- The port for `llama-server` (default `9931` — llama.cpp's own upcoming default,
  chosen to avoid clashing with common dev ports like 3000/5000/8000/8080)
- Context size, max models resident in memory at once, and idle-sleep timeout
- Any extra `llama-server` flags you want passed through
- Which models to download, as Hugging Face `<user>/<repo>:<quant>` entries
  (e.g. `bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M`) — you can find repos at
  https://huggingface.co/models?library=gguf. Leave blank to skip and add later.
- The systemd service name (default `llama-server`)
- Whether to stop and disable an existing Ollama systemd service, if one is found

## After it runs

```sh
curl http://localhost:<port>/v1/models
curl http://localhost:<port>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "<user>/<repo>:<quant>", "messages": [{"role": "user", "content": "hi"}]}'
```

Or open `http://localhost:<port>` in a browser for the built-in web chat UI.

Service management:

```sh
sudo systemctl status <service-name>
sudo systemctl restart <service-name>
journalctl -u <service-name> -f
```

## Adding more models later

```sh
curl "http://localhost:<port>/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model": "<user>/<new-repo>:<quant>", "messages": [{"role": "user", "content": "hi"}]}'
```

The router downloads and loads a new model automatically the first time it's
referenced, then restart the service (or hit `/v1/models?reload=1`) to pick it up
in the model list going forward.

## Reverting to Ollama

```sh
sudo systemctl disable --now <llama.cpp service name>
sudo systemctl enable --now ollama
```

## Notes

- The service is started with `--jinja`, which loki's tool-calling (`fetch_url`,
  `get_weather`, file tools) needs. If you set up `llama-server` by hand, pass it
  too — without it, requests that include tools fail or the model only describes
  the call in plain text. Existing installs from an older version of this script:
  add `--jinja` to `ExecStart` in `/etc/systemd/system/<service>.service`, then
  `sudo systemctl daemon-reload && sudo systemctl restart <service>`.

- Only NVIDIA/CUDA is automated. If a non-NVIDIA GPU (AMD/Intel) is detected, the
  script says so and falls back to a CPU-only build — llama.cpp does support
  ROCm/HIP and SYCL/Vulkan, but setting those toolchains up isn't covered here.
- With multiple NVIDIA GPUs, the build targets all of their architectures, but
  `llama-server` still only uses one GPU by default at runtime. Use the
  "extra llama-server arguments" prompt to pass `--tensor-split` / `--main-gpu`
  if you want to spread a model across more than one card.
- `--models-max` controls how many models can be resident at once. On a single
  consumer GPU, `1` is usually right — loading a second model unloads the first.
- If `apt install` seems to hang or gets killed, run it directly in your own
  terminal rather than through a wrapper/automation tool that may reap
  low-memory background processes.
- The build needs `libssl-dev` for the built-in HTTPS model downloader (`-hf`
  flag) to work — the script installs it, but if you strip it from a custom
  package list, `-hf` downloads will fail with an OpenSSL error.
