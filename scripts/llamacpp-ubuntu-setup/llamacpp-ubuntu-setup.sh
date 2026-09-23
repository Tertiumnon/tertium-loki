#!/usr/bin/env bash
set -euo pipefail

ask() {
  local prompt="$1" default="$2" var
  read -r -p "$prompt [$default]: " var
  echo "${var:-$default}"
}

confirm() {
  local prompt="$1" default="$2" var
  read -r -p "$prompt [$default]: " var
  var="${var:-$default}"
  [[ "$var" =~ ^[Yy] ]]
}

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this script as your normal user, not root (it uses sudo when needed)." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script requires an apt-based system (Ubuntu/Debian)." >&2
  exit 1
fi

RUN_USER="$(id -un)"
RUN_GROUP="$(id -gn)"

echo "== llama.cpp setup =="
INSTALL_DIR="$(ask "Directory to clone/build llama.cpp in" "$HOME/llama.cpp")"

GPU_AVAILABLE=false
CUDA_ARCH=""
if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then
  GPU_COUNT="$(nvidia-smi --query-gpu=name --format=csv,noheader | wc -l)"
  echo "$GPU_COUNT NVIDIA GPU(s) detected:"
  nvidia-smi --query-gpu=index,name,memory.total,compute_cap --format=csv,noheader
  if confirm "Build with CUDA (GPU) support?" "Y"; then
    GPU_AVAILABLE=true
    # union of every detected GPU's compute capability, so the build works on all of them
    CUDA_ARCH="$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader \
      | tr -d '[:space:]' | tr -d '.' | sort -u | paste -sd ';' -)"
    echo "Building for CUDA architecture(s): $CUDA_ARCH"
    if [[ "$GPU_COUNT" -gt 1 ]]; then
      echo "Note: llama-server uses one GPU by default when multiple are present;"
      echo "pass --tensor-split / --main-gpu via the extra-args prompt below to change that."
    fi
  fi
else
  if command -v lspci >/dev/null 2>&1 && lspci | grep -qiE 'VGA|3D controller' \
    && lspci | grep -qiE 'AMD|ATI|Intel Corporation.*(Arc|Graphics)'; then
    echo "A non-NVIDIA GPU was detected, but this script only automates the CUDA build."
    echo "llama.cpp also supports AMD (ROCm/HIP) and Intel (SYCL/Vulkan) backends,"
    echo "but setting up those toolchains isn't covered here."
  else
    echo "No GPU detected (or nvidia-smi unavailable)."
  fi
  if ! confirm "Continue with a CPU-only build?" "Y"; then
    exit 1
  fi
fi

echo
echo "== Installing build dependencies (sudo required) =="
APT_PACKAGES="cmake build-essential git libcurl4-openssl-dev libssl-dev"
if [[ "$GPU_AVAILABLE" == true ]]; then
  APT_PACKAGES="$APT_PACKAGES nvidia-cuda-toolkit"
fi
sudo apt-get update
# shellcheck disable=SC2086
sudo apt-get install -y $APT_PACKAGES

echo
echo "== Fetching llama.cpp source =="
if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" pull --ff-only
else
  git clone --depth 1 https://github.com/ggml-org/llama.cpp "$INSTALL_DIR"
fi

echo
echo "== Building llama.cpp =="
CMAKE_ARGS=()
if [[ "$GPU_AVAILABLE" == true ]]; then
  CMAKE_ARGS+=(-DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES="$CUDA_ARCH")
fi
cmake -S "$INSTALL_DIR" -B "$INSTALL_DIR/build" "${CMAKE_ARGS[@]}"
cmake --build "$INSTALL_DIR/build" --config Release -j"$(nproc)"

SERVER_BIN="$INSTALL_DIR/build/bin/llama-server"
if [[ ! -x "$SERVER_BIN" ]]; then
  echo "Build did not produce $SERVER_BIN" >&2
  exit 1
fi

echo
echo "== Server configuration =="
PORT="$(ask "Port for llama-server" "9931")"
CTX_SIZE="$(ask "Context size (tokens)" "8192")"
MODELS_MAX="$(ask "Max models loaded in memory at once (limited by VRAM/RAM)" "1")"
SLEEP_IDLE="$(ask "Seconds of idleness before a loaded model sleeps (-1 to disable)" "1800")"
EXTRA_ARGS="$(ask "Any extra llama-server arguments (leave blank if none)" "")"

echo
echo "== Models =="
echo "Enter Hugging Face GGUF models to download now, as space-separated"
echo "  <user>/<repo>:<quant>  entries, e.g.:"
echo "  bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M bartowski/Qwen2.5-Coder-7B-Instruct-GGUF:Q4_K_M"
echo "Leave blank to skip (you can add models later)."
read -r -p "Models: " MODELS_INPUT

if [[ -n "$MODELS_INPUT" ]]; then
  DL_PORT=$((PORT + 1))
  for repo in $MODELS_INPUT; do
    echo
    echo "-- Downloading $repo --"
    DL_ARGS=(-hf "$repo" --port "$DL_PORT")
    if [[ "$GPU_AVAILABLE" == true ]]; then
      DL_ARGS+=(-ngl 999)
    fi
    LOG_FILE="$(mktemp)"
    "$SERVER_BIN" "${DL_ARGS[@]}" >"$LOG_FILE" 2>&1 &
    DL_PID=$!
    for _ in $(seq 1 90); do
      if grep -q "model loaded" "$LOG_FILE" 2>/dev/null; then
        break
      fi
      if ! kill -0 "$DL_PID" 2>/dev/null; then
        break
      fi
      sleep 5
    done
    if grep -q "model loaded" "$LOG_FILE" 2>/dev/null; then
      echo "$repo downloaded."
    else
      echo "Warning: could not confirm $repo downloaded successfully. Log:" >&2
      tail -n 20 "$LOG_FILE" >&2
    fi
    kill "$DL_PID" 2>/dev/null || true
    wait "$DL_PID" 2>/dev/null || true
    rm -f "$LOG_FILE"
  done
else
  echo "Skipping model downloads."
fi

echo
echo "== systemd service =="
SERVICE_NAME="$(ask "systemd service name" "llama-server")"

SERVER_ARGS=(--host 0.0.0.0 --port "$PORT" --jinja -c "$CTX_SIZE" --models-max "$MODELS_MAX" --sleep-idle-seconds "$SLEEP_IDLE")
if [[ "$GPU_AVAILABLE" == true ]]; then
  SERVER_ARGS+=(-ngl 999)
fi
if [[ -n "$EXTRA_ARGS" ]]; then
  SERVER_ARGS+=($EXTRA_ARGS)
fi

EXEC_START="$SERVER_BIN"
for a in "${SERVER_ARGS[@]}"; do
  EXEC_START="$EXEC_START $a"
done

UNIT_FILE="$(mktemp)"
cat >"$UNIT_FILE" <<EOF
[Unit]
Description=llama.cpp Server (router mode)
After=network-online.target

[Service]
ExecStart=$EXEC_START
User=$RUN_USER
Group=$RUN_GROUP
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

sudo cp "$UNIT_FILE" "/etc/systemd/system/$SERVICE_NAME.service"
rm -f "$UNIT_FILE"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"

echo
echo "== Existing Ollama service =="
if systemctl list-unit-files 2>/dev/null | grep -q '^ollama\.service'; then
  if confirm "An Ollama systemd service was found. Stop and disable it now?" "Y"; then
    sudo systemctl disable --now ollama
    echo "Ollama stopped and disabled."
  fi
else
  echo "No Ollama systemd service found, nothing to do."
fi

echo
sleep 2
sudo systemctl --no-pager status "$SERVICE_NAME" || true

echo
echo "Done. API available at: http://localhost:$PORT/v1"
echo "List models:   curl http://localhost:$PORT/v1/models"
echo "Service logs:  journalctl -u $SERVICE_NAME -f"
