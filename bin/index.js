#!/usr/bin/env node
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  if (mod && typeof mod === "object" || typeof mod === "function") {
    for (let key of __getOwnPropNames(mod))
      if (!__hasOwnProp.call(to, key))
        __defProp(to, key, {
          get: __accessProp.bind(mod, key),
          enumerable: true
        });
  }
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// node_modules/balanced-match/index.js
var require_balanced_match = __commonJS(function(exports, module) {
  module.exports = balanced;
  function balanced(a, b, str) {
    if (a instanceof RegExp)
      a = maybeMatch(a, str);
    if (b instanceof RegExp)
      b = maybeMatch(b, str);
    var r = range(a, b, str);
    return r && {
      start: r[0],
      end: r[1],
      pre: str.slice(0, r[0]),
      body: str.slice(r[0] + a.length, r[1]),
      post: str.slice(r[1] + b.length)
    };
  }
  function maybeMatch(reg, str) {
    var m = str.match(reg);
    return m ? m[0] : null;
  }
  balanced.range = range;
  function range(a, b, str) {
    var begs, beg, left, right, result;
    var ai = str.indexOf(a);
    var bi = str.indexOf(b, ai + 1);
    var i = ai;
    if (ai >= 0 && bi > 0) {
      if (a === b) {
        return [ai, bi];
      }
      begs = [];
      left = str.length;
      while (i >= 0 && !result) {
        if (i == ai) {
          begs.push(i);
          ai = str.indexOf(a, i + 1);
        } else if (begs.length == 1) {
          result = [begs.pop(), bi];
        } else {
          beg = begs.pop();
          if (beg < left) {
            left = beg;
            right = bi;
          }
          bi = str.indexOf(b, i + 1);
        }
        i = ai < bi && ai >= 0 ? ai : bi;
      }
      if (begs.length) {
        result = [left, right];
      }
    }
    return result;
  }
});

// node_modules/brace-expansion/index.js
var require_brace_expansion = __commonJS(function(exports, module) {
  var balanced = require_balanced_match();
  module.exports = expandTop;
  var escSlash = "\x00SLASH" + Math.random() + "\x00";
  var escOpen = "\x00OPEN" + Math.random() + "\x00";
  var escClose = "\x00CLOSE" + Math.random() + "\x00";
  var escComma = "\x00COMMA" + Math.random() + "\x00";
  var escPeriod = "\x00PERIOD" + Math.random() + "\x00";
  var EXPANSION_MAX = 1e5;
  var EXPANSION_MAX_LENGTH = 4000000;
  var EXPANSION_MAX_DEPTH = 1000;
  var EXPANSION_MAX_REWRITES = 1000;
  function numeric(str) {
    return parseInt(str, 10) == str ? parseInt(str, 10) : str.charCodeAt(0);
  }
  function escapeBraces(str) {
    return str.split("\\\\").join(escSlash).split("\\{").join(escOpen).split("\\}").join(escClose).split("\\,").join(escComma).split("\\.").join(escPeriod);
  }
  function unescapeBraces(str) {
    return str.split(escSlash).join("\\").split(escOpen).join("{").split(escClose).join("}").split(escComma).join(",").split(escPeriod).join(".");
  }
  function pushAll(target, items) {
    for (var i = 0;i < items.length; i++) {
      target.push(items[i]);
    }
  }
  function parseCommaParts(str) {
    var parts = [];
    var carry = "";
    for (;; ) {
      var m = balanced("{", "}", str);
      if (!m) {
        var tail = str.split(",");
        tail[0] = carry + tail[0];
        pushAll(parts, tail);
        return parts;
      }
      var pre = m.pre;
      var body = m.body;
      var post = m.post;
      var p = pre.split(",");
      p[0] = carry + p[0];
      p[p.length - 1] += "{" + body + "}";
      if (!post.length) {
        pushAll(parts, p);
        return parts;
      }
      carry = p.pop();
      pushAll(parts, p);
      str = post;
    }
  }
  function expandTop(str, options) {
    if (!str)
      return [];
    options = options || {};
    var max = options.max == null ? EXPANSION_MAX : options.max;
    var maxLength = options.maxLength == null ? EXPANSION_MAX_LENGTH : options.maxLength;
    var maxDepth = options.maxDepth == null ? EXPANSION_MAX_DEPTH : options.maxDepth;
    var maxRewrites = options.maxRewrites == null ? EXPANSION_MAX_REWRITES : options.maxRewrites;
    if (str.substr(0, 2) === "{}") {
      str = "\\{\\}" + str.substr(2);
    }
    return expand(escapeBraces(str), max, maxLength, maxDepth, 0, maxRewrites, true).map(unescapeBraces);
  }
  function embrace(str) {
    return "{" + str + "}";
  }
  function isPadded(el) {
    return /^-?0\d/.test(el);
  }
  function lte(i, y) {
    return i <= y;
  }
  function gte(i, y) {
    return i >= y;
  }
  function combine(acc, pre, values, max, maxLength, dropEmpties) {
    var out = [];
    var length = 0;
    for (var a = 0;a < acc.length; a++) {
      for (var v = 0;v < values.length; v++) {
        if (out.length >= max)
          return out;
        var expansion = acc[a] + pre + values[v];
        if (dropEmpties && !expansion)
          continue;
        if (length + expansion.length > maxLength)
          return out;
        out.push(expansion);
        length += expansion.length;
      }
    }
    return out;
  }
  function expandSequence(body, isAlphaSequence, max, maxLength) {
    var n = body.split(/\.\./);
    var N = [];
    if (n[0] === undefined || n[1] === undefined) {
      return N;
    }
    var x = numeric(n[0]);
    var y = numeric(n[1]);
    var width = Math.max(n[0].length, n[1].length);
    var incr = n.length === 3 && n[2] !== undefined ? Math.max(Math.abs(numeric(n[2])), 1) : 1;
    var test = lte;
    var reverse = y < x;
    if (reverse) {
      incr *= -1;
      test = gte;
    }
    var pad = n.some(isPadded);
    var length = 0;
    for (var i = x;test(i, y) && N.length < max; i += incr) {
      var c;
      if (isAlphaSequence) {
        c = String.fromCharCode(i);
        if (c === "\\") {
          c = "";
        }
      } else {
        c = String(i);
        if (pad) {
          var need = width - c.length;
          if (need > 0) {
            var z = new Array(need + 1).join("0");
            if (i < 0) {
              c = "-" + z + c.slice(1);
            } else {
              c = z + c;
            }
          }
        }
      }
      if (length + c.length > maxLength)
        break;
      N.push(c);
      length += c.length;
    }
    return N;
  }
  function expand(str, max, maxLength, maxDepth, depth, maxRewrites, isTop) {
    if (depth > maxDepth) {
      return [str];
    }
    var acc = [""];
    var rewrites = 0;
    var dropEmpties = false;
    var firstGroup = true;
    for (;; ) {
      const m = balanced("{", "}", str);
      if (!m) {
        return combine(acc, str, [""], max, maxLength, dropEmpties);
      }
      const pre = m.pre;
      if (/\$$/.test(pre)) {
        acc = combine(acc, pre + "{" + m.body + "}", [""], max, maxLength, dropEmpties && !m.post.length);
        firstGroup = false;
        if (!m.post.length)
          break;
        str = m.post;
        continue;
      }
      var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
      var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
      var isSequence = isNumericSequence || isAlphaSequence;
      var isOptions = m.body.indexOf(",") >= 0;
      if (!isSequence && !isOptions) {
        if (rewrites < maxRewrites && m.post.match(/,(?!,).*\}/)) {
          rewrites++;
          str = m.pre + "{" + m.body + escClose + m.post;
          isTop = true;
          continue;
        }
        return combine(acc, pre + "{" + m.body + "}" + m.post, [""], max, maxLength, dropEmpties);
      }
      if (firstGroup) {
        dropEmpties = isTop && !isSequence;
        firstGroup = false;
      }
      var values;
      if (isSequence) {
        values = expandSequence(m.body, isAlphaSequence, max, maxLength);
      } else {
        var n = parseCommaParts(m.body);
        if (n.length === 1 && n[0] !== undefined) {
          n = expand(n[0], max, maxLength, maxDepth, depth + 1, maxRewrites, false).map(embrace);
          if (n.length === 1) {
            acc = combine(acc, pre + n[0], [""], max, maxLength, dropEmpties && !m.post.length);
            if (!m.post.length)
              break;
            str = m.post;
            continue;
          }
        }
        var dropsEmpties = dropEmpties && !m.post.length && !pre;
        for (var d = 0;dropsEmpties && d < acc.length; d++) {
          if (acc[d]) {
            dropsEmpties = false;
          }
        }
        values = [];
        var valuesLength = 0;
        outer:
          for (var j = 0;j < n.length; j++) {
            var expanded = expand(n[j], max, maxLength, maxDepth, depth + 1, maxRewrites, false);
            for (var k = 0;k < expanded.length; k++) {
              var v = expanded[k];
              if (dropsEmpties && !v)
                continue;
              if (values.length >= max || valuesLength + v.length > maxLength) {
                break outer;
              }
              values.push(v);
              valuesLength += v.length;
            }
          }
      }
      acc = combine(acc, pre, values, max, maxLength, dropEmpties && !m.post.length);
      if (!m.post.length)
        break;
      str = m.post;
    }
    return acc;
  }
});
// package.json
var package_default = {
  name: "@tertium/loki",
  version: "0.1.0",
  description: "Terminal chat CLI for local llama.cpp models — Claude-Code-CLI style, Node/TypeScript",
  author: "Vitalii Balabanov",
  email: "tertiumnon@gmail.com",
  main: "bin/index.js",
  type: "module",
  scripts: {
    build: "bun build ./src/index.ts --outfile ./bin/index.js --target node",
    start: "node bin/index.js",
    test: "bun test",
    typecheck: "tsc --noEmit",
    lint: "biome check .",
    format: "biome format --write .",
    prepublishOnly: "bun run typecheck && bun run test && bun run build",
    "release:patch": "bun node_modules/@tertium/js/scripts/release.js patch",
    "release:minor": "bun node_modules/@tertium/js/scripts/release.js minor",
    "release:major": "bun node_modules/@tertium/js/scripts/release.js major",
    prepare: "git config core.hooksPath .githooks"
  },
  bin: {
    loki: "./bin/index.js"
  },
  files: [
    "bin",
    "package.json"
  ],
  keywords: [
    "cli",
    "llama.cpp",
    "llm",
    "chat",
    "local-ai"
  ],
  engines: {
    node: ">=18.17"
  },
  dependencies: {
    "@tertium/js": "^2.9.0",
    minimatch: "^9.0.3"
  },
  devDependencies: {
    "@biomejs/biome": "^2.5.13",
    "@types/bun": "^1.4.2",
    "@types/node": "^24.0.0",
    typescript: "^5.6.0"
  },
  repository: {
    type: "git",
    url: "https://github.com/Tertiumnon/tertium-loki.git"
  },
  license: "MIT"
};

// src/chat-loop/chat-loop.ts
import { stdin as stdin2, stdout as stdout2 } from "node:process";
import { createInterface as createInterface2 } from "node:readline/promises";

// src/agents-guide/agents-guide.ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
var AGENTS_MD_FILENAME = "AGENTS.md";
async function loadAgentsGuide(cwd = process.cwd()) {
  const filePath = resolve(cwd, AGENTS_MD_FILENAME);
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

// src/llamacpp-client/llamacpp-client.ts
var exports_llamacpp_client = {};
__export(exports_llamacpp_client, {
  chatStream: () => chatStream,
  chatWithTools: () => chatWithTools,
  checkConnection: () => checkConnection,
  listModels: () => listModels,
  listModelsDetailed: () => listModelsDetailed
});
var MAX_TOOL_ROUNDS = 5;
var PARAM_SIZE_FROM_NAME = /(\d+(?:\.\d+)?)\s*[Bb](?![a-zA-Z])/;
function formatParamSize(nParams) {
  const billions = nParams / 1e9;
  return `${Number.isInteger(billions) ? billions.toFixed(0) : billions.toFixed(1)}B`;
}
function deriveModelInfo(entry) {
  const nameMatch = PARAM_SIZE_FROM_NAME.exec(entry.id);
  const parameterSize = entry.meta?.n_params ? formatParamSize(entry.meta.n_params) : nameMatch ? `${nameMatch[1]}B` : "?";
  const capabilities = ["completion"];
  if (entry.architecture?.input_modalities?.includes("image")) {
    capabilities.push("vision");
  }
  return {
    name: entry.id,
    family: "unknown",
    parameterSize,
    contextLength: entry.meta?.n_ctx_train,
    capabilities
  };
}
async function listModelsDetailed(baseUrl) {
  const res = await fetch(`${baseUrl}/v1/models`);
  if (!res.ok) {
    throw new Error(`GET /v1/models failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (data.data ?? []).map(deriveModelInfo);
}
async function listModels(baseUrl) {
  const models = await listModelsDetailed(baseUrl);
  return models.map((m) => m.name);
}
async function checkConnection(baseUrl) {
  await listModels(baseUrl);
}
function applyToolCallDelta(byIndex, delta) {
  const existing = byIndex.get(delta.index);
  if (!existing) {
    byIndex.set(delta.index, {
      id: delta.id ?? `call_${delta.index}`,
      type: "function",
      function: {
        name: delta.function?.name ?? "",
        arguments: delta.function?.arguments ?? ""
      }
    });
    return;
  }
  if (delta.id)
    existing.id = delta.id;
  if (delta.function?.name)
    existing.function.name = delta.function.name;
  if (delta.function?.arguments)
    existing.function.arguments += delta.function.arguments;
}
async function streamChat(baseUrl, model, messages, onToken, tools) {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, ...tools?.length ? { tools } : {} })
  });
  if (!res.ok || !res.body) {
    throw new Error(`POST /v1/chat/completions failed: ${res.status} ${res.statusText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder;
  let buffer = "";
  let content = "";
  const toolCallsByIndex = new Map;
  const processLine = (line) => {
    if (!line.startsWith("data:"))
      return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]")
      return;
    const parsed = JSON.parse(payload);
    if (parsed.error) {
      throw new Error(typeof parsed.error === "string" ? parsed.error : parsed.error.message ?? "unknown error");
    }
    const delta = parsed.choices?.[0]?.delta;
    if (!delta)
      return;
    if (delta.content) {
      onToken(delta.content);
      content += delta.content;
    }
    for (const tc of delta.tool_calls ?? []) {
      applyToolCallDelta(toolCallsByIndex, tc);
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done)
      break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf(`
`);
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line)
        processLine(line);
      newlineIndex = buffer.indexOf(`
`);
    }
  }
  if (buffer.trim())
    processLine(buffer.trim());
  return {
    content,
    toolCalls: [...toolCallsByIndex.values()].filter((tc) => tc.function.name)
  };
}
async function chatStream(baseUrl, model, messages, onToken) {
  const { content } = await streamChat(baseUrl, model, messages, onToken);
  return content;
}
function parseToolArguments(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function chatWithTools(baseUrl, model, messages, tools, onToken, onToolCall) {
  const openaiTools = tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters }
  }));
  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const history = [...messages];
  for (let round = 0;round < MAX_TOOL_ROUNDS; round++) {
    const { content, toolCalls } = await streamChat(baseUrl, model, history, onToken, openaiTools);
    if (toolCalls.length === 0) {
      return content;
    }
    history.push({ role: "assistant", content, tool_calls: toolCalls });
    for (const call of toolCalls) {
      const tool = toolByName.get(call.function.name);
      const args = parseToolArguments(call.function.arguments);
      onToolCall?.(call.function.name, args);
      const result = tool ? await tool.execute(args).catch((err) => `Error: ${err.message}`) : `Error: unknown tool "${call.function.name}"`;
      history.push({
        role: "tool",
        tool_call_id: call.id,
        content: `Result: ${result}

Answer the user's question directly using this result. Do not describe that you called a tool.`
      });
    }
  }
  return "(stopped after too many tool calls without a final answer)";
}

// src/ollama-client/ollama-client.ts
var exports_ollama_client = {};
__export(exports_ollama_client, {
  chatStream: () => chatStream2,
  chatWithTools: () => chatWithTools2,
  checkConnection: () => checkConnection2,
  listModels: () => listModels2,
  listModelsDetailed: () => listModelsDetailed2
});
var MAX_TOOL_ROUNDS2 = 5;
async function listModelsDetailed2(baseUrl) {
  const res = await fetch(`${baseUrl}/api/tags`);
  if (!res.ok) {
    throw new Error(`GET /api/tags failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.models.map((m) => ({
    name: m.name,
    family: m.details?.family ?? "unknown",
    parameterSize: m.details?.parameter_size ?? "?",
    contextLength: m.details?.context_length,
    capabilities: m.capabilities ?? []
  }));
}
async function listModels2(baseUrl) {
  const models = await listModelsDetailed2(baseUrl);
  return models.map((m) => m.name);
}
async function checkConnection2(baseUrl) {
  await listModels2(baseUrl);
}
async function streamChat2(baseUrl, model, messages, onToken, tools) {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, ...tools?.length ? { tools } : {} })
  });
  if (!res.ok || !res.body) {
    throw new Error(`POST /api/chat failed: ${res.status} ${res.statusText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder;
  let buffer = "";
  let content = "";
  const toolCalls = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done)
      break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf(`
`);
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        const parsed = JSON.parse(line);
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        const token = parsed.message?.content;
        if (token) {
          onToken(token);
          content += token;
        }
        if (parsed.message?.tool_calls?.length) {
          toolCalls.push(...parsed.message.tool_calls);
        }
      }
      newlineIndex = buffer.indexOf(`
`);
    }
  }
  return { content, toolCalls };
}
async function chatStream2(baseUrl, model, messages, onToken) {
  const { content } = await streamChat2(baseUrl, model, messages, onToken);
  return content;
}
function parseToolArguments2(raw) {
  if (typeof raw !== "string")
    return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function chatWithTools2(baseUrl, model, messages, tools, onToken, onToolCall) {
  const ollamaTools = tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters }
  }));
  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const history = [...messages];
  for (let round = 0;round < MAX_TOOL_ROUNDS2; round++) {
    const { content, toolCalls } = await streamChat2(baseUrl, model, history, onToken, ollamaTools);
    if (toolCalls.length === 0) {
      return content;
    }
    history.push({ role: "assistant", content, tool_calls: toolCalls });
    for (const call of toolCalls) {
      const tool = toolByName.get(call.function.name);
      const args = parseToolArguments2(call.function.arguments);
      onToolCall?.(call.function.name, args);
      const result = tool ? await tool.execute(args).catch((err) => `Error: ${err.message}`) : `Error: unknown tool "${call.function.name}"`;
      history.push({
        role: "tool",
        content: `Result: ${result}

Answer the user's question directly using this result. Do not describe that you called a tool.`,
        tool_name: call.function.name
      });
    }
  }
  return "(stopped after too many tool calls without a final answer)";
}

// src/llm-client/llm-client.ts
var CLIENTS = {
  ollama: exports_ollama_client,
  llamacpp: exports_llamacpp_client
};
function getClient(backend) {
  return CLIENTS[backend];
}
var BACKEND_LABELS = {
  ollama: "Ollama",
  llamacpp: "llama.cpp"
};
var BACKEND_DEFAULT_URLS = {
  ollama: "http://localhost:11434",
  llamacpp: "http://localhost:9931"
};

// src/setup-wizard/setup-wizard.ts
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

// src/config/config.ts
import { existsSync } from "node:fs";
import { mkdir, readFile as readFile2, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// src/config/config.constants.ts
var CONFIG_DIR_NAME = ".loki";
var CONFIG_FILE_NAME = "config.json";

// src/config/config.ts
function defaultConfigDir() {
  return join(homedir(), CONFIG_DIR_NAME);
}
function getConfigPath(configDir = defaultConfigDir()) {
  return join(configDir, CONFIG_FILE_NAME);
}
function configExists(configDir = defaultConfigDir()) {
  return existsSync(getConfigPath(configDir));
}
async function loadConfig(configDir = defaultConfigDir()) {
  const raw = await readFile2(getConfigPath(configDir), "utf-8");
  const config = JSON.parse(raw);
  return config.backend ? config : { ...config, backend: "ollama" };
}
async function saveConfig(config, configDir = defaultConfigDir()) {
  await mkdir(configDir, { recursive: true });
  await writeFile(getConfigPath(configDir), `${JSON.stringify(config, null, 2)}
`, "utf-8");
}

// src/model-suggest/model-suggest.constants.ts
var ROLE_ORDER = ["general", "coder", "vision"];
var ROLE_DEFAULT_PROMPTS = {
  general: "You are a helpful, concise assistant.",
  coder: "You are an expert software engineer. Answer coding questions concisely, with working code.",
  vision: "You are a helpful assistant that can analyze and describe images in detail."
};
var CODER_NAME_PATTERN = /code|coder|sql|devstral|starcoder/i;
var VISION_NAME_PATTERN = /vision|[-:]vl\b|vl[-:]|llava|bakllava|moondream|pixtral/i;
var EMBED_NAME_PATTERN = /embed/i;
var GUARD_NAME_PATTERN = /guard|shield|moderation/i;

// src/model-suggest/model-suggest.ts
function parseParamCount(size) {
  const match = /([\d.]+)\s*B/i.exec(size);
  return match ? Number.parseFloat(match[1]) : 0;
}
function isChatCapable(model) {
  if (!model.capabilities.includes("completion"))
    return false;
  if (EMBED_NAME_PATTERN.test(model.name))
    return false;
  return true;
}
function classify(model) {
  const roles = [];
  const looksLikeVision = model.capabilities.includes("vision") || VISION_NAME_PATTERN.test(model.name);
  const looksLikeCoder = model.capabilities.includes("insert") || CODER_NAME_PATTERN.test(model.name) || CODER_NAME_PATTERN.test(model.family);
  if (looksLikeVision)
    roles.push("vision");
  if (looksLikeCoder)
    roles.push("coder");
  if (roles.length === 0 && !GUARD_NAME_PATTERN.test(model.name))
    roles.push("general");
  return roles;
}
function suggestForRole(models, role) {
  const candidates = models.filter((m) => isChatCapable(m) && classify(m).includes(role));
  if (candidates.length === 0)
    return;
  return [...candidates].sort((a, b) => parseParamCount(b.parameterSize) - parseParamCount(a.parameterSize))[0];
}
function describeModel(model) {
  const roles = classify(model);
  const caps = model.capabilities.length ? model.capabilities.join(", ") : "none";
  const ctx = model.contextLength ? `, ${Math.round(model.contextLength / 1024)}K ctx` : "";
  const roleLabel = isChatCapable(model) ? roles.join("/") || "unassigned" : "not chat-capable";
  return `${model.parameterSize.padEnd(6)} caps: ${caps}${ctx}  → ${roleLabel}`;
}

// src/setup-wizard/setup-wizard.ts
async function ask(rl, question, fallback = "") {
  const answer = (await rl.question(question)).trim();
  return answer || fallback;
}
async function pickModel(rl, models, label) {
  const idxRaw = await ask(rl, `Pick model number for '${label}' [1]: `, "1");
  const idx = Number.parseInt(idxRaw, 10);
  return Number.isInteger(idx) && idx >= 1 && idx <= models.length ? models[idx - 1] : models[0];
}
async function addCustomProfile(rl, models, agents) {
  const label = agents.length === 0 ? "default" : `agent ${agents.length + 1}`;
  const model = await pickModel(rl, models, label);
  const defaultName = agents.length === 0 ? "general" : `agent${agents.length + 1}`;
  const name = await ask(rl, `Name for this profile [${defaultName}]: `, defaultName);
  const systemPrompt = await ask(rl, `System prompt (optional, Enter to skip): `, "");
  agents.push({ name, model: model.name, ...systemPrompt ? { systemPrompt } : {} });
}
async function runSetupWizard(existingRl, configDir) {
  const rl = existingRl ?? createInterface({ input: stdin, output: stdout });
  console.log(`loki setup
`);
  try {
    console.log("Which backend do you want to use?");
    console.log("  1. llama.cpp (default)");
    console.log("  2. Ollama");
    const backendChoice = await ask(rl, `Backend [1]: `, "1");
    const backend = backendChoice.trim() === "2" ? "ollama" : "llamacpp";
    const client = getClient(backend);
    const label = BACKEND_LABELS[backend];
    const defaultUrl = BACKEND_DEFAULT_URLS[backend];
    const baseUrl = await ask(rl, `
${label} base URL [${defaultUrl}]: `, defaultUrl);
    console.log(`
Checking connection to ${baseUrl} ...`);
    let allModels;
    try {
      allModels = await client.listModelsDetailed(baseUrl);
    } catch (err) {
      console.error(`
Could not reach ${label} at ${baseUrl}.`);
      if (backend === "ollama") {
        console.error(`Make sure Ollama is running (e.g. "ollama serve", or check your service/WSL setup).`);
      } else {
        console.error(`Make sure llama-server is running (e.g. "systemctl status llama-server", or check your WSL setup).`);
      }
      console.error(`Underlying error: ${err.message}`);
      process.exit(1);
    }
    const chatModels = allModels.filter(isChatCapable);
    const skipped = allModels.filter((m) => !isChatCapable(m));
    if (chatModels.length === 0) {
      if (backend === "ollama") {
        console.error(`No chat-capable models found at ${baseUrl}. Pull one first, e.g.: ollama pull llama3.1:8b`);
      } else {
        console.error(`No chat-capable models found at ${baseUrl}. Load one first, e.g. by hitting it once with`);
        console.error(`that model's id in the "model" field of a /v1/chat/completions request (router mode`);
        console.error(`auto-loads it).`);
      }
      process.exit(1);
    }
    console.log(`
Found ${allModels.length} model(s):`);
    chatModels.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.name.padEnd(22)} ${describeModel(m)}`);
    });
    if (skipped.length > 0) {
      console.log(`  (skipped, not chat-capable: ${skipped.map((m) => m.name).join(", ")})`);
    }
    const agents = [];
    const suggestions = ROLE_ORDER.map((role) => ({
      role,
      model: suggestForRole(chatModels, role)
    })).filter((s) => s.model !== undefined);
    if (suggestions.length > 0) {
      console.log(`
Suggested profiles based on reported capabilities:`);
      for (const { role, model } of suggestions) {
        console.log(`  ${role.padEnd(8)} → ${model.name}`);
      }
      console.log();
      for (const { role, model } of suggestions) {
        const accept = await ask(rl, `Create '${role}' profile using ${model.name}? (Y/n): `, "y");
        if (!accept.toLowerCase().startsWith("n")) {
          const name = await ask(rl, `  Profile name [${role}]: `, role);
          const systemPrompt = await ask(rl, `  System prompt [Enter to use the ${role} default, or type your own]: `, ROLE_DEFAULT_PROMPTS[role]);
          agents.push({ name, model: model.name, systemPrompt });
        }
      }
    } else {
      console.log(`
No strong role signal in your installed models — falling back to manual setup.`);
    }
    let addMore = agents.length === 0;
    if (agents.length > 0) {
      const more = await ask(rl, `
Add another custom profile? (y/N): `, "n");
      addMore = more.toLowerCase().startsWith("y");
    }
    while (addMore) {
      await addCustomProfile(rl, chatModels, agents);
      const more = await ask(rl, `Add another profile? (y/N): `, "n");
      addMore = more.toLowerCase().startsWith("y");
    }
    let defaultAgent = agents[0].name;
    if (agents.length > 1) {
      const names = agents.map((a) => a.name).join(", ");
      defaultAgent = await ask(rl, `
Default profile on startup [${defaultAgent}] (options: ${names}): `, defaultAgent);
      if (!agents.some((a) => a.name === defaultAgent)) {
        defaultAgent = agents[0].name;
      }
    }
    const config = { backend, baseUrl, defaultAgent, agents };
    await saveConfig(config, configDir);
    console.log(`
Saved config to ${getConfigPath(configDir)}`);
    console.log(`Run "loki" to start chatting, or "loki config" to redo this setup.
`);
    return config;
  } finally {
    if (!existingRl)
      rl.close();
  }
}

// src/web-tools/web-tools.constants.ts
var OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
var OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
var FETCH_URL_MAX_CHARS = 4000;
var USER_AGENT = "loki-cli (+https://github.com/Tertiumnon/tertium-loki)";
var WMO_WEATHER_DESCRIPTIONS = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail"
};

// src/web-tools/web-tools.ts
async function geocode(location) {
  const url = `${OPEN_METEO_GEOCODING_URL}?name=${encodeURIComponent(location)}&count=1`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding lookup failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const first = data.results?.[0];
  return first ? { name: first.name, latitude: first.latitude, longitude: first.longitude, country: first.country } : undefined;
}
async function fetchCurrentWeather(latitude, longitude) {
  const url = `${OPEN_METEO_FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Forecast lookup failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return {
    temperatureC: data.current.temperature_2m,
    windSpeedKph: data.current.wind_speed_10m,
    weatherCode: data.current.weather_code
  };
}
async function getWeather(location) {
  const place = await geocode(location);
  if (!place) {
    return `No location found matching "${location}".`;
  }
  const weather = await fetchCurrentWeather(place.latitude, place.longitude);
  const description = WMO_WEATHER_DESCRIPTIONS[weather.weatherCode] ?? `weather code ${weather.weatherCode}`;
  const where = [place.name, place.country].filter(Boolean).join(", ");
  return `Current weather in ${where}: ${description}, ${weather.temperatureC}°C, wind ${weather.windSpeedKph} km/h.`;
}
async function fetchUrl(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Fetching ${url} failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > FETCH_URL_MAX_CHARS ? `${text.slice(0, FETCH_URL_MAX_CHARS)}…` : text;
}
var BUILTIN_TOOLS = [
  {
    name: "get_weather",
    description: "Get the current weather for a named location (city, region, or place name).",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City or place name, e.g. 'Paris' or 'Tokyo, Japan'" }
      },
      required: ["location"]
    },
    execute: (args) => getWeather(String(args.location ?? ""))
  },
  {
    name: "fetch_url",
    description: "Fetch the readable text content of a specific web page URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "A fully-qualified http(s) URL" }
      },
      required: ["url"]
    },
    execute: (args) => fetchUrl(String(args.url ?? ""))
  }
];

// src/workspace/workspace.ts
import { existsSync as existsSync2 } from "node:fs";
import { mkdir as mkdir2, readdir, readFile as readFile3, writeFile as writeFile2 } from "node:fs/promises";
import { dirname, relative, resolve as resolve2 } from "node:path";

// node_modules/minimatch/dist/esm/index.js
var import_brace_expansion = __toESM(require_brace_expansion(), 1);

// node_modules/minimatch/dist/esm/assert-valid-pattern.js
var MAX_PATTERN_LENGTH = 1024 * 64;
var assertValidPattern = (pattern) => {
  if (typeof pattern !== "string") {
    throw new TypeError("invalid pattern");
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new TypeError("pattern is too long");
  }
};

// node_modules/minimatch/dist/esm/brace-expressions.js
var posixClasses = {
  "[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true],
  "[:alpha:]": ["\\p{L}\\p{Nl}", true],
  "[:ascii:]": ["\\x" + "00-\\x" + "7f", false],
  "[:blank:]": ["\\p{Zs}\\t", true],
  "[:cntrl:]": ["\\p{Cc}", true],
  "[:digit:]": ["\\p{Nd}", true],
  "[:graph:]": ["\\p{Z}\\p{C}", true, true],
  "[:lower:]": ["\\p{Ll}", true],
  "[:print:]": ["\\p{C}", true],
  "[:punct:]": ["\\p{P}", true],
  "[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true],
  "[:upper:]": ["\\p{Lu}", true],
  "[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true],
  "[:xdigit:]": ["A-Fa-f0-9", false]
};
var braceEscape = (s) => s.replace(/[[\]\\-]/g, "\\$&");
var regexpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var rangesToString = (ranges) => ranges.join("");
var parseClass = (glob, position) => {
  const pos = position;
  if (glob.charAt(pos) !== "[") {
    throw new Error("not in a brace expression");
  }
  const ranges = [];
  const negs = [];
  let i = pos + 1;
  let sawStart = false;
  let uflag = false;
  let escaping = false;
  let negate = false;
  let endPos = pos;
  let rangeStart = "";
  WHILE:
    while (i < glob.length) {
      const c = glob.charAt(i);
      if ((c === "!" || c === "^") && i === pos + 1) {
        negate = true;
        i++;
        continue;
      }
      if (c === "]" && sawStart && !escaping) {
        endPos = i + 1;
        break;
      }
      sawStart = true;
      if (c === "\\") {
        if (!escaping) {
          escaping = true;
          i++;
          continue;
        }
      }
      if (c === "[" && !escaping) {
        for (const [cls, [unip, u, neg]] of Object.entries(posixClasses)) {
          if (glob.startsWith(cls, i)) {
            if (rangeStart) {
              return ["$.", false, glob.length - pos, true];
            }
            i += cls.length;
            if (neg)
              negs.push(unip);
            else
              ranges.push(unip);
            uflag = uflag || u;
            continue WHILE;
          }
        }
      }
      escaping = false;
      if (rangeStart) {
        if (c > rangeStart) {
          ranges.push(braceEscape(rangeStart) + "-" + braceEscape(c));
        } else if (c === rangeStart) {
          ranges.push(braceEscape(c));
        }
        rangeStart = "";
        i++;
        continue;
      }
      if (glob.startsWith("-]", i + 1)) {
        ranges.push(braceEscape(c + "-"));
        i += 2;
        continue;
      }
      if (glob.startsWith("-", i + 1)) {
        rangeStart = c;
        i += 2;
        continue;
      }
      ranges.push(braceEscape(c));
      i++;
    }
  if (endPos < i) {
    return ["", false, 0, false];
  }
  if (!ranges.length && !negs.length) {
    return ["$.", false, glob.length - pos, true];
  }
  if (negs.length === 0 && ranges.length === 1 && /^\\?.$/.test(ranges[0]) && !negate) {
    const r = ranges[0].length === 2 ? ranges[0].slice(-1) : ranges[0];
    return [regexpEscape(r), false, endPos - pos, false];
  }
  const sranges = "[" + (negate ? "^" : "") + rangesToString(ranges) + "]";
  const snegs = "[" + (negate ? "" : "^") + rangesToString(negs) + "]";
  const comb = ranges.length && negs.length ? "(" + sranges + "|" + snegs + ")" : ranges.length ? sranges : snegs;
  return [comb, uflag, endPos - pos, true];
};

// node_modules/minimatch/dist/esm/unescape.js
var unescape = (s, { windowsPathsNoEscape = false } = {}) => {
  return windowsPathsNoEscape ? s.replace(/\[([^\/\\])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^\/\\])\]/g, "$1$2").replace(/\\([^\/])/g, "$1");
};

// node_modules/minimatch/dist/esm/ast.js
var _a;
var types = new Set(["!", "?", "+", "*", "@"]);
var isExtglobType = (c) => types.has(c);
var isExtglobAST = (c) => isExtglobType(c.type);
var adoptionMap = new Map([
  ["!", ["@"]],
  ["?", ["?", "@"]],
  ["@", ["@"]],
  ["*", ["*", "+", "?", "@"]],
  ["+", ["+", "@"]]
]);
var adoptionWithSpaceMap = new Map([
  ["!", ["?"]],
  ["@", ["?"]],
  ["+", ["?", "*"]]
]);
var adoptionAnyMap = new Map([
  ["!", ["?", "@"]],
  ["?", ["?", "@"]],
  ["@", ["?", "@"]],
  ["*", ["*", "+", "?", "@"]],
  ["+", ["+", "@", "?", "*"]]
]);
var usurpMap = new Map([
  ["!", new Map([["!", "@"]])],
  ["?", new Map([["*", "*"], ["+", "*"]])],
  ["@", new Map([["!", "!"], ["?", "?"], ["@", "@"], ["*", "*"], ["+", "+"]])],
  ["+", new Map([["?", "*"], ["*", "*"]])]
]);
var startNoTraversal = "(?!(?:^|/)\\.\\.?(?:$|/))";
var startNoDot = "(?!\\.)";
var addPatternStart = new Set(["[", "."]);
var justDots = new Set(["..", "."]);
var reSpecials = new Set("().*{}+?[]^$\\!");
var regExpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var qmark = "[^/]";
var star = qmark + "*?";
var starNoEmpty = qmark + "+?";

class AST {
  type;
  #root;
  #hasMagic;
  #uflag = false;
  #parts = [];
  #parent;
  #parentIndex;
  #negs;
  #filledNegs = false;
  #options;
  #toString;
  #emptyExt = false;
  constructor(type, parent, options = {}) {
    this.type = type;
    if (type)
      this.#hasMagic = true;
    this.#parent = parent;
    this.#root = this.#parent ? this.#parent.#root : this;
    this.#options = this.#root === this ? options : this.#root.#options;
    this.#negs = this.#root === this ? [] : this.#root.#negs;
    if (type === "!" && !this.#root.#filledNegs)
      this.#negs.push(this);
    this.#parentIndex = this.#parent ? this.#parent.#parts.length : 0;
  }
  get hasMagic() {
    if (this.#hasMagic !== undefined)
      return this.#hasMagic;
    for (const p of this.#parts) {
      if (typeof p === "string")
        continue;
      if (p.type || p.hasMagic)
        return this.#hasMagic = true;
    }
    return this.#hasMagic;
  }
  toString() {
    if (this.#toString !== undefined)
      return this.#toString;
    if (!this.type) {
      return this.#toString = this.#parts.map((p) => String(p)).join("");
    } else {
      return this.#toString = this.type + "(" + this.#parts.map((p) => String(p)).join("|") + ")";
    }
  }
  #fillNegs() {
    if (this !== this.#root)
      throw new Error("should only call on root");
    if (this.#filledNegs)
      return this;
    this.toString();
    this.#filledNegs = true;
    let n;
    while (n = this.#negs.pop()) {
      if (n.type !== "!")
        continue;
      let p = n;
      let pp = p.#parent;
      while (pp) {
        for (let i = p.#parentIndex + 1;!pp.type && i < pp.#parts.length; i++) {
          for (const part of n.#parts) {
            if (typeof part === "string") {
              throw new Error("string part in extglob AST??");
            }
            part.copyIn(pp.#parts[i]);
          }
        }
        p = pp;
        pp = p.#parent;
      }
    }
    return this;
  }
  push(...parts) {
    for (const p of parts) {
      if (p === "")
        continue;
      if (typeof p !== "string" && !(p instanceof _a && p.#parent === this)) {
        throw new Error("invalid part: " + p);
      }
      this.#parts.push(p);
    }
  }
  toJSON() {
    const ret = this.type === null ? this.#parts.slice().map((p) => typeof p === "string" ? p : p.toJSON()) : [this.type, ...this.#parts.map((p) => p.toJSON())];
    if (this.isStart() && !this.type)
      ret.unshift([]);
    if (this.isEnd() && (this === this.#root || this.#root.#filledNegs && this.#parent?.type === "!")) {
      ret.push({});
    }
    return ret;
  }
  isStart() {
    if (this.#root === this)
      return true;
    if (!this.#parent?.isStart())
      return false;
    if (this.#parentIndex === 0)
      return true;
    const p = this.#parent;
    for (let i = 0;i < this.#parentIndex; i++) {
      const pp = p.#parts[i];
      if (!(pp instanceof _a && pp.type === "!")) {
        return false;
      }
    }
    return true;
  }
  isEnd() {
    if (this.#root === this)
      return true;
    if (this.#parent?.type === "!")
      return true;
    if (!this.#parent?.isEnd())
      return false;
    if (!this.type)
      return this.#parent?.isEnd();
    const pl = this.#parent ? this.#parent.#parts.length : 0;
    return this.#parentIndex === pl - 1;
  }
  copyIn(part) {
    if (typeof part === "string")
      this.push(part);
    else
      this.push(part.clone(this));
  }
  clone(parent) {
    const c = new _a(this.type, parent);
    for (const p of this.#parts) {
      c.copyIn(p);
    }
    return c;
  }
  static #parseAST(str, ast, pos, opt, extDepth) {
    const maxDepth = opt.maxExtglobRecursion ?? 2;
    let escaping = false;
    let inBrace = false;
    let braceStart = -1;
    let braceNeg = false;
    if (ast.type === null) {
      let i = pos;
      let acc = "";
      while (i < str.length) {
        const c = str.charAt(i++);
        if (escaping || c === "\\") {
          escaping = !escaping;
          acc += c;
          continue;
        }
        if (inBrace) {
          if (i === braceStart + 1) {
            if (c === "^" || c === "!") {
              braceNeg = true;
            }
          } else if (c === "]" && !(i === braceStart + 2 && braceNeg)) {
            inBrace = false;
          }
          acc += c;
          continue;
        } else if (c === "[") {
          inBrace = true;
          braceStart = i;
          braceNeg = false;
          acc += c;
          continue;
        }
        const doRecurse = !opt.noext && isExtglobType(c) && str.charAt(i) === "(" && extDepth <= maxDepth;
        if (doRecurse) {
          ast.push(acc);
          acc = "";
          const ext = new _a(c, ast);
          i = _a.#parseAST(str, ext, i, opt, extDepth + 1);
          ast.push(ext);
          continue;
        }
        acc += c;
      }
      ast.push(acc);
      return i;
    }
    let i = pos + 1;
    let part = new _a(null, ast);
    const parts = [];
    let acc = "";
    while (i < str.length) {
      const c = str.charAt(i++);
      if (escaping || c === "\\") {
        escaping = !escaping;
        acc += c;
        continue;
      }
      if (inBrace) {
        if (i === braceStart + 1) {
          if (c === "^" || c === "!") {
            braceNeg = true;
          }
        } else if (c === "]" && !(i === braceStart + 2 && braceNeg)) {
          inBrace = false;
        }
        acc += c;
        continue;
      } else if (c === "[") {
        inBrace = true;
        braceStart = i;
        braceNeg = false;
        acc += c;
        continue;
      }
      const doRecurse = isExtglobType(c) && str.charAt(i) === "(" && (extDepth <= maxDepth || ast && ast.#canAdoptType(c));
      if (doRecurse) {
        const depthAdd = ast && ast.#canAdoptType(c) ? 0 : 1;
        part.push(acc);
        acc = "";
        const ext = new _a(c, part);
        part.push(ext);
        i = _a.#parseAST(str, ext, i, opt, extDepth + depthAdd);
        continue;
      }
      if (c === "|") {
        part.push(acc);
        acc = "";
        parts.push(part);
        part = new _a(null, ast);
        continue;
      }
      if (c === ")") {
        if (acc === "" && ast.#parts.length === 0) {
          ast.#emptyExt = true;
        }
        part.push(acc);
        acc = "";
        ast.push(...parts, part);
        return i;
      }
      acc += c;
    }
    ast.type = null;
    ast.#hasMagic = undefined;
    ast.#parts = [str.substring(pos - 1)];
    return i;
  }
  #canAdoptWithSpace(child) {
    return this.#canAdopt(child, adoptionWithSpaceMap);
  }
  #canAdopt(child, map = adoptionMap) {
    if (!child || typeof child !== "object" || child.type !== null || child.#parts.length !== 1 || this.type === null) {
      return false;
    }
    const gc = child.#parts[0];
    if (!gc || typeof gc !== "object" || gc.type === null) {
      return false;
    }
    return this.#canAdoptType(gc.type, map);
  }
  #canAdoptType(c, map = adoptionAnyMap) {
    return !!map.get(this.type)?.includes(c);
  }
  #adoptWithSpace(child, index) {
    const gc = child.#parts[0];
    const blank = new _a(null, gc, this.options);
    blank.#parts.push("");
    gc.push(blank);
    this.#adopt(child, index);
  }
  #adopt(child, index) {
    const gc = child.#parts[0];
    this.#parts.splice(index, 1, ...gc.#parts);
    for (const p of gc.#parts) {
      if (typeof p === "object")
        p.#parent = this;
    }
    this.#toString = undefined;
  }
  #canUsurpType(c) {
    const m = usurpMap.get(this.type);
    return !!m?.has(c);
  }
  #canUsurp(child) {
    if (!child || typeof child !== "object" || child.type !== null || child.#parts.length !== 1 || this.type === null || this.#parts.length !== 1) {
      return false;
    }
    const gc = child.#parts[0];
    if (!gc || typeof gc !== "object" || gc.type === null) {
      return false;
    }
    return this.#canUsurpType(gc.type);
  }
  #usurp(child) {
    const m = usurpMap.get(this.type);
    const gc = child.#parts[0];
    const nt = m?.get(gc.type);
    if (!nt)
      return false;
    this.#parts = gc.#parts;
    for (const p of this.#parts) {
      if (typeof p === "object")
        p.#parent = this;
    }
    this.type = nt;
    this.#toString = undefined;
    this.#emptyExt = false;
  }
  #flatten() {
    if (!isExtglobAST(this)) {
      for (const p of this.#parts) {
        if (typeof p === "object")
          p.#flatten();
      }
    } else {
      let iterations = 0;
      let done = false;
      do {
        done = true;
        for (let i = 0;i < this.#parts.length; i++) {
          const c = this.#parts[i];
          if (typeof c === "object") {
            c.#flatten();
            if (this.#canAdopt(c)) {
              done = false;
              this.#adopt(c, i);
            } else if (this.#canAdoptWithSpace(c)) {
              done = false;
              this.#adoptWithSpace(c, i);
            } else if (this.#canUsurp(c)) {
              done = false;
              this.#usurp(c);
            }
          }
        }
      } while (!done && ++iterations < 10);
    }
    this.#toString = undefined;
  }
  static fromGlob(pattern, options = {}) {
    const ast = new _a(null, undefined, options);
    _a.#parseAST(pattern, ast, 0, options, 0);
    return ast;
  }
  toMMPattern() {
    if (this !== this.#root)
      return this.#root.toMMPattern();
    const glob = this.toString();
    const [re, body, hasMagic, uflag] = this.toRegExpSource();
    const anyMagic = hasMagic || this.#hasMagic || this.#options.nocase && !this.#options.nocaseMagicOnly && glob.toUpperCase() !== glob.toLowerCase();
    if (!anyMagic) {
      return body;
    }
    const flags = (this.#options.nocase ? "i" : "") + (uflag ? "u" : "");
    return Object.assign(new RegExp(`^${re}$`, flags), {
      _src: re,
      _glob: glob
    });
  }
  get options() {
    return this.#options;
  }
  toRegExpSource(allowDot) {
    const dot = allowDot ?? !!this.#options.dot;
    if (this.#root === this) {
      this.#flatten();
      this.#fillNegs();
    }
    if (!isExtglobAST(this)) {
      const noEmpty = this.isStart() && this.isEnd();
      const src = this.#parts.map((p) => {
        const [re, _, hasMagic, uflag] = typeof p === "string" ? _a.#parseGlob(p, this.#hasMagic, noEmpty) : p.toRegExpSource(allowDot);
        this.#hasMagic = this.#hasMagic || hasMagic;
        this.#uflag = this.#uflag || uflag;
        return re;
      }).join("");
      let start = "";
      if (this.isStart()) {
        if (typeof this.#parts[0] === "string") {
          const dotTravAllowed = this.#parts.length === 1 && justDots.has(this.#parts[0]);
          if (!dotTravAllowed) {
            const aps = addPatternStart;
            const needNoTrav = dot && aps.has(src.charAt(0)) || src.startsWith("\\.") && aps.has(src.charAt(2)) || src.startsWith("\\.\\.") && aps.has(src.charAt(4));
            const needNoDot = !dot && !allowDot && aps.has(src.charAt(0));
            start = needNoTrav ? startNoTraversal : needNoDot ? startNoDot : "";
          }
        }
      }
      let end = "";
      if (this.isEnd() && this.#root.#filledNegs && this.#parent?.type === "!") {
        end = "(?:$|\\/)";
      }
      const final = start + src + end;
      return [
        final,
        unescape(src),
        this.#hasMagic = !!this.#hasMagic,
        this.#uflag
      ];
    }
    const repeated = this.type === "*" || this.type === "+";
    const start = this.type === "!" ? "(?:(?!(?:" : "(?:";
    let body = this.#partsToRegExp(dot);
    if (this.isStart() && this.isEnd() && !body && this.type !== "!") {
      const s = this.toString();
      const me = this;
      me.#parts = [s];
      me.type = null;
      me.#hasMagic = undefined;
      return [s, unescape(this.toString()), false, false];
    }
    let bodyDotAllowed = !repeated || allowDot || dot || !startNoDot ? "" : this.#partsToRegExp(true);
    if (bodyDotAllowed === body) {
      bodyDotAllowed = "";
    }
    if (bodyDotAllowed) {
      body = `(?:${body})(?:${bodyDotAllowed})*?`;
    }
    let final = "";
    if (this.type === "!" && this.#emptyExt) {
      final = (this.isStart() && !dot ? startNoDot : "") + starNoEmpty;
    } else {
      const close = this.type === "!" ? "))" + (this.isStart() && !dot && !allowDot ? startNoDot : "") + star + ")" : this.type === "@" ? ")" : this.type === "?" ? ")?" : this.type === "+" && bodyDotAllowed ? ")" : this.type === "*" && bodyDotAllowed ? `)?` : `)${this.type}`;
      final = start + body + close;
    }
    return [
      final,
      unescape(body),
      this.#hasMagic = !!this.#hasMagic,
      this.#uflag
    ];
  }
  #partsToRegExp(dot) {
    return this.#parts.map((p) => {
      if (typeof p === "string") {
        throw new Error("string type in extglob ast??");
      }
      const [re, _, _hasMagic, uflag] = p.toRegExpSource(dot);
      this.#uflag = this.#uflag || uflag;
      return re;
    }).filter((p) => !(this.isStart() && this.isEnd()) || !!p).join("|");
  }
  static #parseGlob(glob, hasMagic, noEmpty = false) {
    let escaping = false;
    let re = "";
    let uflag = false;
    let inStar = false;
    for (let i = 0;i < glob.length; i++) {
      const c = glob.charAt(i);
      if (escaping) {
        escaping = false;
        re += (reSpecials.has(c) ? "\\" : "") + c;
        inStar = false;
        continue;
      }
      if (c === "\\") {
        if (i === glob.length - 1) {
          re += "\\\\";
        } else {
          escaping = true;
        }
        continue;
      }
      if (c === "[") {
        const [src, needUflag, consumed, magic] = parseClass(glob, i);
        if (consumed) {
          re += src;
          uflag = uflag || needUflag;
          i += consumed - 1;
          hasMagic = hasMagic || magic;
          inStar = false;
          continue;
        }
      }
      if (c === "*") {
        if (inStar)
          continue;
        inStar = true;
        re += noEmpty && /^[*]+$/.test(glob) ? starNoEmpty : star;
        hasMagic = true;
        continue;
      } else {
        inStar = false;
      }
      if (c === "?") {
        re += qmark;
        hasMagic = true;
        continue;
      }
      re += regExpEscape(c);
    }
    return [re, unescape(glob), !!hasMagic, uflag];
  }
}
_a = AST;

// node_modules/minimatch/dist/esm/escape.js
var escape = (s, { windowsPathsNoEscape = false } = {}) => {
  return windowsPathsNoEscape ? s.replace(/[?*()[\]]/g, "[$&]") : s.replace(/[?*()[\]\\]/g, "\\$&");
};

// node_modules/minimatch/dist/esm/index.js
var minimatch = (p, pattern, options = {}) => {
  assertValidPattern(pattern);
  if (!options.nocomment && pattern.charAt(0) === "#") {
    return false;
  }
  return new Minimatch(pattern, options).match(p);
};
var starDotExtRE = /^\*+([^+@!?\*\[\(]*)$/;
var starDotExtTest = (ext) => (f) => !f.startsWith(".") && f.endsWith(ext);
var starDotExtTestDot = (ext) => (f) => f.endsWith(ext);
var starDotExtTestNocase = (ext) => {
  ext = ext.toLowerCase();
  return (f) => !f.startsWith(".") && f.toLowerCase().endsWith(ext);
};
var starDotExtTestNocaseDot = (ext) => {
  ext = ext.toLowerCase();
  return (f) => f.toLowerCase().endsWith(ext);
};
var starDotStarRE = /^\*+\.\*+$/;
var starDotStarTest = (f) => !f.startsWith(".") && f.includes(".");
var starDotStarTestDot = (f) => f !== "." && f !== ".." && f.includes(".");
var dotStarRE = /^\.\*+$/;
var dotStarTest = (f) => f !== "." && f !== ".." && f.startsWith(".");
var starRE = /^\*+$/;
var starTest = (f) => f.length !== 0 && !f.startsWith(".");
var starTestDot = (f) => f.length !== 0 && f !== "." && f !== "..";
var qmarksRE = /^\?+([^+@!?\*\[\(]*)?$/;
var qmarksTestNocase = ([$0, ext = ""]) => {
  const noext = qmarksTestNoExt([$0]);
  if (!ext)
    return noext;
  ext = ext.toLowerCase();
  return (f) => noext(f) && f.toLowerCase().endsWith(ext);
};
var qmarksTestNocaseDot = ([$0, ext = ""]) => {
  const noext = qmarksTestNoExtDot([$0]);
  if (!ext)
    return noext;
  ext = ext.toLowerCase();
  return (f) => noext(f) && f.toLowerCase().endsWith(ext);
};
var qmarksTestDot = ([$0, ext = ""]) => {
  const noext = qmarksTestNoExtDot([$0]);
  return !ext ? noext : (f) => noext(f) && f.endsWith(ext);
};
var qmarksTest = ([$0, ext = ""]) => {
  const noext = qmarksTestNoExt([$0]);
  return !ext ? noext : (f) => noext(f) && f.endsWith(ext);
};
var qmarksTestNoExt = ([$0]) => {
  const len = $0.length;
  return (f) => f.length === len && !f.startsWith(".");
};
var qmarksTestNoExtDot = ([$0]) => {
  const len = $0.length;
  return (f) => f.length === len && f !== "." && f !== "..";
};
var defaultPlatform = typeof process === "object" && process ? typeof process.env === "object" && process.env && process.env.__MINIMATCH_TESTING_PLATFORM__ || process.platform : "posix";
var path = {
  win32: { sep: "\\" },
  posix: { sep: "/" }
};
var sep = defaultPlatform === "win32" ? path.win32.sep : path.posix.sep;
minimatch.sep = sep;
var GLOBSTAR = Symbol("globstar **");
minimatch.GLOBSTAR = GLOBSTAR;
var qmark2 = "[^/]";
var star2 = qmark2 + "*?";
var twoStarDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";
var twoStarNoDot = "(?:(?!(?:\\/|^)\\.).)*?";
var filter = (pattern, options = {}) => (p) => minimatch(p, pattern, options);
minimatch.filter = filter;
var ext = (a, b = {}) => Object.assign({}, a, b);
var defaults = (def) => {
  if (!def || typeof def !== "object" || !Object.keys(def).length) {
    return minimatch;
  }
  const orig = minimatch;
  const m = (p, pattern, options = {}) => orig(p, pattern, ext(def, options));
  return Object.assign(m, {
    Minimatch: class Minimatch extends orig.Minimatch {
      constructor(pattern, options = {}) {
        super(pattern, ext(def, options));
      }
      static defaults(options) {
        return orig.defaults(ext(def, options)).Minimatch;
      }
    },
    AST: class AST2 extends orig.AST {
      constructor(type, parent, options = {}) {
        super(type, parent, ext(def, options));
      }
      static fromGlob(pattern, options = {}) {
        return orig.AST.fromGlob(pattern, ext(def, options));
      }
    },
    unescape: (s, options = {}) => orig.unescape(s, ext(def, options)),
    escape: (s, options = {}) => orig.escape(s, ext(def, options)),
    filter: (pattern, options = {}) => orig.filter(pattern, ext(def, options)),
    defaults: (options) => orig.defaults(ext(def, options)),
    makeRe: (pattern, options = {}) => orig.makeRe(pattern, ext(def, options)),
    braceExpand: (pattern, options = {}) => orig.braceExpand(pattern, ext(def, options)),
    match: (list, pattern, options = {}) => orig.match(list, pattern, ext(def, options)),
    sep: orig.sep,
    GLOBSTAR
  });
};
minimatch.defaults = defaults;
var braceExpand = (pattern, options = {}) => {
  assertValidPattern(pattern);
  if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
    return [pattern];
  }
  return import_brace_expansion.default(pattern);
};
minimatch.braceExpand = braceExpand;
var makeRe = (pattern, options = {}) => new Minimatch(pattern, options).makeRe();
minimatch.makeRe = makeRe;
var match = (list, pattern, options = {}) => {
  const mm = new Minimatch(pattern, options);
  list = list.filter((f) => mm.match(f));
  if (mm.options.nonull && !list.length) {
    list.push(pattern);
  }
  return list;
};
minimatch.match = match;
var globMagic = /[?*]|[+@!]\(.*?\)|\[|\]/;
var regExpEscape2 = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

class Minimatch {
  options;
  set;
  pattern;
  windowsPathsNoEscape;
  nonegate;
  negate;
  comment;
  empty;
  preserveMultipleSlashes;
  partial;
  globSet;
  globParts;
  nocase;
  isWindows;
  platform;
  windowsNoMagicRoot;
  maxGlobstarRecursion;
  regexp;
  constructor(pattern, options = {}) {
    assertValidPattern(pattern);
    options = options || {};
    this.options = options;
    this.maxGlobstarRecursion = options.maxGlobstarRecursion ?? 200;
    this.pattern = pattern;
    this.platform = options.platform || defaultPlatform;
    this.isWindows = this.platform === "win32";
    this.windowsPathsNoEscape = !!options.windowsPathsNoEscape || options.allowWindowsEscape === false;
    if (this.windowsPathsNoEscape) {
      this.pattern = this.pattern.replace(/\\/g, "/");
    }
    this.preserveMultipleSlashes = !!options.preserveMultipleSlashes;
    this.regexp = null;
    this.negate = false;
    this.nonegate = !!options.nonegate;
    this.comment = false;
    this.empty = false;
    this.partial = !!options.partial;
    this.nocase = !!this.options.nocase;
    this.windowsNoMagicRoot = options.windowsNoMagicRoot !== undefined ? options.windowsNoMagicRoot : !!(this.isWindows && this.nocase);
    this.globSet = [];
    this.globParts = [];
    this.set = [];
    this.make();
  }
  hasMagic() {
    if (this.options.magicalBraces && this.set.length > 1) {
      return true;
    }
    for (const pattern of this.set) {
      for (const part of pattern) {
        if (typeof part !== "string")
          return true;
      }
    }
    return false;
  }
  debug(..._) {}
  make() {
    const pattern = this.pattern;
    const options = this.options;
    if (!options.nocomment && pattern.charAt(0) === "#") {
      this.comment = true;
      return;
    }
    if (!pattern) {
      this.empty = true;
      return;
    }
    this.parseNegate();
    this.globSet = [...new Set(this.braceExpand())];
    if (options.debug) {
      this.debug = (...args) => console.error(...args);
    }
    this.debug(this.pattern, this.globSet);
    const rawGlobParts = this.globSet.map((s) => this.slashSplit(s));
    this.globParts = this.preprocess(rawGlobParts);
    this.debug(this.pattern, this.globParts);
    let set = this.globParts.map((s, _, __) => {
      if (this.isWindows && this.windowsNoMagicRoot) {
        const isUNC = s[0] === "" && s[1] === "" && (s[2] === "?" || !globMagic.test(s[2])) && !globMagic.test(s[3]);
        const isDrive = /^[a-z]:/i.test(s[0]);
        if (isUNC) {
          return [...s.slice(0, 4), ...s.slice(4).map((ss) => this.parse(ss))];
        } else if (isDrive) {
          return [s[0], ...s.slice(1).map((ss) => this.parse(ss))];
        }
      }
      return s.map((ss) => this.parse(ss));
    });
    this.debug(this.pattern, set);
    this.set = set.filter((s) => s.indexOf(false) === -1);
    if (this.isWindows) {
      for (let i = 0;i < this.set.length; i++) {
        const p = this.set[i];
        if (p[0] === "" && p[1] === "" && this.globParts[i][2] === "?" && typeof p[3] === "string" && /^[a-z]:$/i.test(p[3])) {
          p[2] = "?";
        }
      }
    }
    this.debug(this.pattern, this.set);
  }
  preprocess(globParts) {
    if (this.options.noglobstar) {
      for (let i = 0;i < globParts.length; i++) {
        for (let j = 0;j < globParts[i].length; j++) {
          if (globParts[i][j] === "**") {
            globParts[i][j] = "*";
          }
        }
      }
    }
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      globParts = this.firstPhasePreProcess(globParts);
      globParts = this.secondPhasePreProcess(globParts);
    } else if (optimizationLevel >= 1) {
      globParts = this.levelOneOptimize(globParts);
    } else {
      globParts = this.adjascentGlobstarOptimize(globParts);
    }
    return globParts;
  }
  adjascentGlobstarOptimize(globParts) {
    return globParts.map((parts) => {
      let gs = -1;
      while ((gs = parts.indexOf("**", gs + 1)) !== -1) {
        let i = gs;
        while (parts[i + 1] === "**") {
          i++;
        }
        if (i !== gs) {
          parts.splice(gs, i - gs);
        }
      }
      return parts;
    });
  }
  levelOneOptimize(globParts) {
    return globParts.map((parts) => {
      parts = parts.reduce((set, part) => {
        const prev = set[set.length - 1];
        if (part === "**" && prev === "**") {
          return set;
        }
        if (part === "..") {
          if (prev && prev !== ".." && prev !== "." && prev !== "**") {
            set.pop();
            return set;
          }
        }
        set.push(part);
        return set;
      }, []);
      return parts.length === 0 ? [""] : parts;
    });
  }
  levelTwoFileOptimize(parts) {
    if (!Array.isArray(parts)) {
      parts = this.slashSplit(parts);
    }
    let didSomething = false;
    do {
      didSomething = false;
      if (!this.preserveMultipleSlashes) {
        for (let i = 1;i < parts.length - 1; i++) {
          const p = parts[i];
          if (i === 1 && p === "" && parts[0] === "")
            continue;
          if (p === "." || p === "") {
            didSomething = true;
            parts.splice(i, 1);
            i--;
          }
        }
        if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
          didSomething = true;
          parts.pop();
        }
      }
      let dd = 0;
      while ((dd = parts.indexOf("..", dd + 1)) !== -1) {
        const p = parts[dd - 1];
        if (p && p !== "." && p !== ".." && p !== "**") {
          didSomething = true;
          parts.splice(dd - 1, 2);
          dd -= 2;
        }
      }
    } while (didSomething);
    return parts.length === 0 ? [""] : parts;
  }
  firstPhasePreProcess(globParts) {
    let didSomething = false;
    do {
      didSomething = false;
      for (let parts of globParts) {
        let gs = -1;
        while ((gs = parts.indexOf("**", gs + 1)) !== -1) {
          let gss = gs;
          while (parts[gss + 1] === "**") {
            gss++;
          }
          if (gss > gs) {
            parts.splice(gs + 1, gss - gs);
          }
          let next = parts[gs + 1];
          const p = parts[gs + 2];
          const p2 = parts[gs + 3];
          if (next !== "..")
            continue;
          if (!p || p === "." || p === ".." || !p2 || p2 === "." || p2 === "..") {
            continue;
          }
          didSomething = true;
          parts.splice(gs, 1);
          const other = parts.slice(0);
          other[gs] = "**";
          globParts.push(other);
          gs--;
        }
        if (!this.preserveMultipleSlashes) {
          for (let i = 1;i < parts.length - 1; i++) {
            const p = parts[i];
            if (i === 1 && p === "" && parts[0] === "")
              continue;
            if (p === "." || p === "") {
              didSomething = true;
              parts.splice(i, 1);
              i--;
            }
          }
          if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
            didSomething = true;
            parts.pop();
          }
        }
        let dd = 0;
        while ((dd = parts.indexOf("..", dd + 1)) !== -1) {
          const p = parts[dd - 1];
          if (p && p !== "." && p !== ".." && p !== "**") {
            didSomething = true;
            const needDot = dd === 1 && parts[dd + 1] === "**";
            const splin = needDot ? ["."] : [];
            parts.splice(dd - 1, 2, ...splin);
            if (parts.length === 0)
              parts.push("");
            dd -= 2;
          }
        }
      }
    } while (didSomething);
    return globParts;
  }
  secondPhasePreProcess(globParts) {
    for (let i = 0;i < globParts.length - 1; i++) {
      for (let j = i + 1;j < globParts.length; j++) {
        const matched = this.partsMatch(globParts[i], globParts[j], !this.preserveMultipleSlashes);
        if (matched) {
          globParts[i] = [];
          globParts[j] = matched;
          break;
        }
      }
    }
    return globParts.filter((gs) => gs.length);
  }
  partsMatch(a, b, emptyGSMatch = false) {
    let ai = 0;
    let bi = 0;
    let result = [];
    let which = "";
    while (ai < a.length && bi < b.length) {
      if (a[ai] === b[bi]) {
        result.push(which === "b" ? b[bi] : a[ai]);
        ai++;
        bi++;
      } else if (emptyGSMatch && a[ai] === "**" && b[bi] === a[ai + 1]) {
        result.push(a[ai]);
        ai++;
      } else if (emptyGSMatch && b[bi] === "**" && a[ai] === b[bi + 1]) {
        result.push(b[bi]);
        bi++;
      } else if (a[ai] === "*" && b[bi] && (this.options.dot || !b[bi].startsWith(".")) && b[bi] !== "**") {
        if (which === "b")
          return false;
        which = "a";
        result.push(a[ai]);
        ai++;
        bi++;
      } else if (b[bi] === "*" && a[ai] && (this.options.dot || !a[ai].startsWith(".")) && a[ai] !== "**") {
        if (which === "a")
          return false;
        which = "b";
        result.push(b[bi]);
        ai++;
        bi++;
      } else {
        return false;
      }
    }
    return a.length === b.length && result;
  }
  parseNegate() {
    if (this.nonegate)
      return;
    const pattern = this.pattern;
    let negate = false;
    let negateOffset = 0;
    for (let i = 0;i < pattern.length && pattern.charAt(i) === "!"; i++) {
      negate = !negate;
      negateOffset++;
    }
    if (negateOffset)
      this.pattern = pattern.slice(negateOffset);
    this.negate = negate;
  }
  matchOne(file, pattern, partial = false) {
    let fileStartIndex = 0;
    let patternStartIndex = 0;
    if (this.isWindows) {
      const fileDrive = typeof file[0] === "string" && /^[a-z]:$/i.test(file[0]);
      const fileUNC = !fileDrive && file[0] === "" && file[1] === "" && file[2] === "?" && /^[a-z]:$/i.test(file[3]);
      const patternDrive = typeof pattern[0] === "string" && /^[a-z]:$/i.test(pattern[0]);
      const patternUNC = !patternDrive && pattern[0] === "" && pattern[1] === "" && pattern[2] === "?" && typeof pattern[3] === "string" && /^[a-z]:$/i.test(pattern[3]);
      const fdi = fileUNC ? 3 : fileDrive ? 0 : undefined;
      const pdi = patternUNC ? 3 : patternDrive ? 0 : undefined;
      if (typeof fdi === "number" && typeof pdi === "number") {
        const [fd, pd] = [
          file[fdi],
          pattern[pdi]
        ];
        if (fd.toLowerCase() === pd.toLowerCase()) {
          pattern[pdi] = fd;
          patternStartIndex = pdi;
          fileStartIndex = fdi;
        }
      }
    }
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      file = this.levelTwoFileOptimize(file);
    }
    if (pattern.includes(GLOBSTAR)) {
      return this.#matchGlobstar(file, pattern, partial, fileStartIndex, patternStartIndex);
    }
    return this.#matchOne(file, pattern, partial, fileStartIndex, patternStartIndex);
  }
  #matchGlobstar(file, pattern, partial, fileIndex, patternIndex) {
    const firstgs = pattern.indexOf(GLOBSTAR, patternIndex);
    const lastgs = pattern.lastIndexOf(GLOBSTAR);
    const [head, body, tail] = partial ? [
      pattern.slice(patternIndex, firstgs),
      pattern.slice(firstgs + 1),
      []
    ] : [
      pattern.slice(patternIndex, firstgs),
      pattern.slice(firstgs + 1, lastgs),
      pattern.slice(lastgs + 1)
    ];
    if (head.length) {
      const fileHead = file.slice(fileIndex, fileIndex + head.length);
      if (!this.#matchOne(fileHead, head, partial, 0, 0))
        return false;
      fileIndex += head.length;
    }
    let fileTailMatch = 0;
    if (tail.length) {
      if (tail.length + fileIndex > file.length)
        return false;
      let tailStart = file.length - tail.length;
      if (this.#matchOne(file, tail, partial, tailStart, 0)) {
        fileTailMatch = tail.length;
      } else {
        if (file[file.length - 1] !== "" || fileIndex + tail.length === file.length) {
          return false;
        }
        tailStart--;
        if (!this.#matchOne(file, tail, partial, tailStart, 0))
          return false;
        fileTailMatch = tail.length + 1;
      }
    }
    if (!body.length) {
      let sawSome = !!fileTailMatch;
      for (let i = fileIndex;i < file.length - fileTailMatch; i++) {
        const f = String(file[i]);
        sawSome = true;
        if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) {
          return false;
        }
      }
      return partial || sawSome;
    }
    const bodySegments = [[[], 0]];
    let currentBody = bodySegments[0];
    let nonGsParts = 0;
    const nonGsPartsSums = [0];
    for (const b of body) {
      if (b === GLOBSTAR) {
        nonGsPartsSums.push(nonGsParts);
        currentBody = [[], 0];
        bodySegments.push(currentBody);
      } else {
        currentBody[0].push(b);
        nonGsParts++;
      }
    }
    let i = bodySegments.length - 1;
    const fileLength = file.length - fileTailMatch;
    for (const b of bodySegments) {
      b[1] = fileLength - (nonGsPartsSums[i--] + b[0].length);
    }
    return !!this.#matchGlobStarBodySections(file, bodySegments, fileIndex, 0, partial, 0, !!fileTailMatch);
  }
  #matchGlobStarBodySections(file, bodySegments, fileIndex, bodyIndex, partial, globStarDepth, sawTail) {
    const bs = bodySegments[bodyIndex];
    if (!bs) {
      for (let i = fileIndex;i < file.length; i++) {
        sawTail = true;
        const f = file[i];
        if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) {
          return false;
        }
      }
      return sawTail;
    }
    const [body, after] = bs;
    while (fileIndex <= after) {
      const m = this.#matchOne(file.slice(0, fileIndex + body.length), body, partial, fileIndex, 0);
      if (m && globStarDepth < this.maxGlobstarRecursion) {
        const sub = this.#matchGlobStarBodySections(file, bodySegments, fileIndex + body.length, bodyIndex + 1, partial, globStarDepth + 1, sawTail);
        if (sub !== false)
          return sub;
      }
      const f = file[fileIndex];
      if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) {
        return false;
      }
      fileIndex++;
    }
    return partial || null;
  }
  #matchOne(file, pattern, partial, fileIndex, patternIndex) {
    let fi;
    let pi;
    let pl;
    let fl;
    for (fi = fileIndex, pi = patternIndex, fl = file.length, pl = pattern.length;fi < fl && pi < pl; fi++, pi++) {
      this.debug("matchOne loop");
      let p = pattern[pi];
      let f = file[fi];
      this.debug(pattern, p, f);
      if (p === false || p === GLOBSTAR)
        return false;
      let hit;
      if (typeof p === "string") {
        hit = f === p;
        this.debug("string match", p, f, hit);
      } else {
        hit = p.test(f);
        this.debug("pattern match", p, f, hit);
      }
      if (!hit)
        return false;
    }
    if (fi === fl && pi === pl) {
      return true;
    } else if (fi === fl) {
      return partial;
    } else if (pi === pl) {
      return fi === fl - 1 && file[fi] === "";
    } else {
      throw new Error("wtf?");
    }
  }
  braceExpand() {
    return braceExpand(this.pattern, this.options);
  }
  parse(pattern) {
    assertValidPattern(pattern);
    const options = this.options;
    if (pattern === "**")
      return GLOBSTAR;
    if (pattern === "")
      return "";
    let m;
    let fastTest = null;
    if (m = pattern.match(starRE)) {
      fastTest = options.dot ? starTestDot : starTest;
    } else if (m = pattern.match(starDotExtRE)) {
      fastTest = (options.nocase ? options.dot ? starDotExtTestNocaseDot : starDotExtTestNocase : options.dot ? starDotExtTestDot : starDotExtTest)(m[1]);
    } else if (m = pattern.match(qmarksRE)) {
      fastTest = (options.nocase ? options.dot ? qmarksTestNocaseDot : qmarksTestNocase : options.dot ? qmarksTestDot : qmarksTest)(m);
    } else if (m = pattern.match(starDotStarRE)) {
      fastTest = options.dot ? starDotStarTestDot : starDotStarTest;
    } else if (m = pattern.match(dotStarRE)) {
      fastTest = dotStarTest;
    }
    const re = AST.fromGlob(pattern, this.options).toMMPattern();
    if (fastTest && typeof re === "object") {
      Reflect.defineProperty(re, "test", { value: fastTest });
    }
    return re;
  }
  makeRe() {
    if (this.regexp || this.regexp === false)
      return this.regexp;
    const set = this.set;
    if (!set.length) {
      this.regexp = false;
      return this.regexp;
    }
    const options = this.options;
    const twoStar = options.noglobstar ? star2 : options.dot ? twoStarDot : twoStarNoDot;
    const flags = new Set(options.nocase ? ["i"] : []);
    let re = set.map((pattern) => {
      const pp = pattern.map((p) => {
        if (p instanceof RegExp) {
          for (const f of p.flags.split(""))
            flags.add(f);
        }
        return typeof p === "string" ? regExpEscape2(p) : p === GLOBSTAR ? GLOBSTAR : p._src;
      });
      pp.forEach((p, i) => {
        const next = pp[i + 1];
        const prev = pp[i - 1];
        if (p !== GLOBSTAR || prev === GLOBSTAR) {
          return;
        }
        if (prev === undefined) {
          if (next !== undefined && next !== GLOBSTAR) {
            pp[i + 1] = "(?:\\/|" + twoStar + "\\/)?" + next;
          } else {
            pp[i] = twoStar;
          }
        } else if (next === undefined) {
          pp[i - 1] = prev + "(?:\\/|" + twoStar + ")?";
        } else if (next !== GLOBSTAR) {
          pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + "\\/)" + next;
          pp[i + 1] = GLOBSTAR;
        }
      });
      return pp.filter((p) => p !== GLOBSTAR).join("/");
    }).join("|");
    const [open, close] = set.length > 1 ? ["(?:", ")"] : ["", ""];
    re = "^" + open + re + close + "$";
    if (this.negate)
      re = "^(?!" + re + ").+$";
    try {
      this.regexp = new RegExp(re, [...flags].join(""));
    } catch (ex) {
      this.regexp = false;
    }
    return this.regexp;
  }
  slashSplit(p) {
    if (this.preserveMultipleSlashes) {
      return p.split("/");
    } else if (this.isWindows && /^\/\/[^\/]+/.test(p)) {
      return ["", ...p.split(/\/+/)];
    } else {
      return p.split(/\/+/);
    }
  }
  match(f, partial = this.partial) {
    this.debug("match", f, this.pattern);
    if (this.comment) {
      return false;
    }
    if (this.empty) {
      return f === "";
    }
    if (f === "/" && partial) {
      return true;
    }
    const options = this.options;
    if (this.isWindows) {
      f = f.split("\\").join("/");
    }
    const ff = this.slashSplit(f);
    this.debug(this.pattern, "split", ff);
    const set = this.set;
    this.debug(this.pattern, "set", set);
    let filename = ff[ff.length - 1];
    if (!filename) {
      for (let i = ff.length - 2;!filename && i >= 0; i--) {
        filename = ff[i];
      }
    }
    for (let i = 0;i < set.length; i++) {
      const pattern = set[i];
      let file = ff;
      if (options.matchBase && pattern.length === 1) {
        file = [filename];
      }
      const hit = this.matchOne(file, pattern, partial);
      if (hit) {
        if (options.flipNegate) {
          return true;
        }
        return !this.negate;
      }
    }
    if (options.flipNegate) {
      return false;
    }
    return this.negate;
  }
  static defaults(def) {
    return minimatch.defaults(def).Minimatch;
  }
}
minimatch.AST = AST;
minimatch.Minimatch = Minimatch;
minimatch.escape = escape;
minimatch.unescape = unescape;

// src/workspace/workspace.constants.ts
var WORKSPACE_CONFIG_FILENAME = ".loki/settings.yml";

// src/workspace/workspace.ts
var DEFAULT_SETTINGS_YAML = `workspace:
  # Base directory (relative paths are resolved from here)
  root: "."

  # Glob patterns — agents can read/write/delete files matching these.
  # Supports *, **, ? and character classes like standard glob patterns.
  allowedGlobs:
    - "**/*"

  # Patterns explicitly forbidden (takes precedence over allowedGlobs)
  deniedGlobs:
    - "node_modules/**"
    - ".git/**"
    - ".env"
    - "**/*.env"
    - "secrets/**"

  # If true: write/delete/move operations execute without per-command confirmation.
  # If false or omitted: each write/delete/move prompts "Approve X? (y/N):" in chat.
  autoApprove: false
`;
function parseSimpleYaml(content) {
  const lines = content.split(`
`);
  const result = {};
  let currentSection = result;
  let currentArray = null;
  let sectionStack = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#"))
      continue;
    const indent = line.search(/\S/);
    if (indent === 0) {
      currentArray = null;
      sectionStack = [];
      currentSection = result;
      const match = trimmed.match(/^([^:]+):\s*(.*)?$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2]?.trim();
        if (value) {
          if (value === "true")
            result[key] = true;
          else if (value === "false")
            result[key] = false;
          else if (value.startsWith('"') && value.endsWith('"'))
            result[key] = value.slice(1, -1);
          else
            result[key] = value;
        } else {
          result[key] = {};
          sectionStack.push({ section: result, key });
          currentSection = result[key];
        }
      }
    } else if (trimmed.startsWith("- ")) {
      const item = trimmed.slice(2).trim();
      const cleanItem = item.startsWith('"') && item.endsWith('"') ? item.slice(1, -1) : item;
      if (currentArray) {
        currentArray.push(cleanItem);
      }
    } else {
      const match = trimmed.match(/^([^:]+):\s*(.*)?$/);
      if (match) {
        currentArray = null;
        const key = match[1].trim();
        const value = match[2]?.trim();
        if (value) {
          if (value === "true")
            currentSection[key] = true;
          else if (value === "false")
            currentSection[key] = false;
          else if (value.startsWith('"') && value.endsWith('"'))
            currentSection[key] = value.slice(1, -1);
          else
            currentSection[key] = value;
        } else {
          currentArray = [];
          currentSection[key] = currentArray;
        }
      }
    }
  }
  return result;
}
async function loadWorkspaceConfig(cwd = process.cwd()) {
  const configPath = resolve2(cwd, WORKSPACE_CONFIG_FILENAME);
  try {
    const content = await readFile3(configPath, "utf-8");
    const parsed = parseSimpleYaml(content);
    const workspace = parsed.workspace;
    if (!workspace)
      return null;
    return {
      workspace: {
        root: String(workspace.root ?? "."),
        allowedGlobs: workspace.allowedGlobs ?? [],
        deniedGlobs: workspace.deniedGlobs ?? [],
        autoApprove: Boolean(workspace.autoApprove ?? false)
      }
    };
  } catch {
    return null;
  }
}
async function initWorkspaceConfig(cwd = process.cwd(), options = {}) {
  const path = resolve2(cwd, WORKSPACE_CONFIG_FILENAME);
  if (existsSync2(path) && !options.force) {
    return { path, created: false };
  }
  await mkdir2(dirname(path), { recursive: true });
  await writeFile2(path, DEFAULT_SETTINGS_YAML, "utf-8");
  return { path, created: true };
}
function isPathAllowed(filePath, config) {
  const root = resolve2(config.workspace.root);
  const fullPath = resolve2(filePath);
  if (!fullPath.startsWith(root)) {
    return false;
  }
  const rel = relative(root, fullPath);
  for (const denied of config.workspace.deniedGlobs ?? []) {
    if (minimatch(rel, denied)) {
      return false;
    }
  }
  for (const allowed of config.workspace.allowedGlobs) {
    if (minimatch(rel, allowed)) {
      return true;
    }
  }
  return false;
}
function validatePath(filePath, config) {
  if (!isPathAllowed(filePath, config)) {
    throw new Error(`Path outside workspace or not in allowedGlobs: ${filePath}`);
  }
}
async function readFileContent(filePath, config) {
  validatePath(filePath, config);
  return readFile3(filePath, "utf-8");
}
async function writeFileContent(filePath, content, config) {
  validatePath(filePath, config);
  await writeFile2(filePath, content, "utf-8");
}
async function listDirectory(dirPath, config) {
  validatePath(dirPath, config);
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.map((e) => `${e.name}${e.isDirectory() ? "/" : ""}`);
  } catch {
    return [];
  }
}
async function deleteFilePath(filePath, config) {
  validatePath(filePath, config);
  const fs = await import("node:fs/promises");
  await fs.rm(filePath, { force: true });
}
async function moveFile(fromPath, toPath, config) {
  validatePath(fromPath, config);
  validatePath(toPath, config);
  const fs = await import("node:fs/promises");
  await fs.rename(fromPath, toPath);
}
async function createDirectory(dirPath, config) {
  validatePath(dirPath, config);
  const fs = await import("node:fs/promises");
  await fs.mkdir(dirPath, { recursive: true });
}
function createFileTools(config, approvalHandler) {
  return [
    {
      name: "read_file",
      description: "Read the contents of a file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path (relative or absolute)" }
        },
        required: ["path"]
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        try {
          const content = await readFileContent(path, config);
          return content;
        } catch (err) {
          return `Error: ${err.message}`;
        }
      }
    },
    {
      name: "write_file",
      description: "Write or create a file in the workspace. Overwrites if exists.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path (relative or absolute)" },
          content: { type: "string", description: "File contents" }
        },
        required: ["path", "content"]
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        const content = String(args.content ?? "");
        if (!config.workspace.autoApprove) {
          const approved = await approvalHandler?.({
            toolName: "write_file",
            description: `Write ${content.length} chars to ${path}`,
            filePath: path,
            requiresApproval: true
          });
          if (!approved) {
            return "Cancelled by user.";
          }
        }
        try {
          await writeFileContent(path, content, config);
          return `Wrote ${content.length} chars to ${path}`;
        } catch (err) {
          return `Error: ${err.message}`;
        }
      }
    },
    {
      name: "list_files",
      description: "List files and folders in a directory.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path (relative or absolute)" }
        },
        required: ["path"]
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        try {
          const entries = await listDirectory(path, config);
          return entries.join(`
`);
        } catch (err) {
          return `Error: ${err.message}`;
        }
      }
    },
    {
      name: "delete_file",
      description: "Delete a file or folder in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File or folder path" }
        },
        required: ["path"]
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        if (!config.workspace.autoApprove) {
          const approved = await approvalHandler?.({
            toolName: "delete_file",
            description: `Delete ${path}`,
            filePath: path,
            requiresApproval: true
          });
          if (!approved) {
            return "Cancelled by user.";
          }
        }
        try {
          await deleteFilePath(path, config);
          return `Deleted ${path}`;
        } catch (err) {
          return `Error: ${err.message}`;
        }
      }
    },
    {
      name: "move_file",
      description: "Move or rename a file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Source path" },
          to: { type: "string", description: "Destination path" }
        },
        required: ["from", "to"]
      },
      execute: async (args) => {
        const from = String(args.from ?? "");
        const to = String(args.to ?? "");
        if (!config.workspace.autoApprove) {
          const approved = await approvalHandler?.({
            toolName: "move_file",
            description: `Move ${from} → ${to}`,
            filePath: from,
            requiresApproval: true
          });
          if (!approved) {
            return "Cancelled by user.";
          }
        }
        try {
          await moveFile(from, to, config);
          return `Moved ${from} → ${to}`;
        } catch (err) {
          return `Error: ${err.message}`;
        }
      }
    },
    {
      name: "create_folder",
      description: "Create a folder in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Folder path" }
        },
        required: ["path"]
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        try {
          await createDirectory(path, config);
          return `Created folder ${path}`;
        } catch (err) {
          return `Error: ${err.message}`;
        }
      }
    }
  ];
}

// src/chat-loop/chat-loop.constants.ts
var ANSI_RESET = "\x1B[0m";
var ANSI_GRAY = "\x1B[90m";
var ANSI_BLUE = "\x1B[94m";
var SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
var SPINNER_INTERVAL_MS = 80;

// src/chat-loop/chat-loop.ts
function createSpinner() {
  const isInteractive = process.stdout.isTTY === true;
  let timer;
  let frame = 0;
  let drawn = false;
  const draw = () => {
    process.stdout.write(`${drawn ? "\b" : ""}${ANSI_GRAY}${SPINNER_FRAMES[frame]}${ANSI_RESET}`);
    drawn = true;
    frame = (frame + 1) % SPINNER_FRAMES.length;
  };
  return {
    start() {
      if (!isInteractive || timer)
        return;
      draw();
      timer = setInterval(draw, SPINNER_INTERVAL_MS);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      if (drawn) {
        process.stdout.write("\b \b");
        drawn = false;
      }
    }
  };
}
function printHelp(state) {
  const names = state.config.agents.map((a) => a.name).join(", ");
  console.log("Commands:");
  console.log(`  /agent <name>   switch active profile: ${names}`);
  console.log("  /which          show active profile");
  console.log("  /models         list models available on the server");
  console.log("  /reset          clear conversation history");
  console.log("  /setup, /config re-run setup (rescans models, rebuild profiles)");
  console.log("  /init           create .loki/settings.yml here to enable file tools");
  console.log("  /help           show this help");
  console.log("  /exit, /quit    leave chat");
}
var commands = {
  "/help": async (_rl, state) => {
    printHelp(state);
    return "continue";
  },
  "/which": async (_rl, state) => {
    console.log(`Active profile: ${state.agent.name} (${state.agent.model})`);
    return "continue";
  },
  "/reset": async (_rl, state) => {
    state.messages = [];
    console.log("Conversation history cleared.");
    return "continue";
  },
  "/models": async (_rl, state) => {
    try {
      const models = await getClient(state.config.backend).listModels(state.config.baseUrl);
      console.log(`Models on server:
  ${models.join(`
  `)}`);
    } catch (err) {
      console.error(`Failed to list models: ${err.message}`);
    }
    return "continue";
  },
  "/agent": async (_rl, state, args) => {
    const name = args.trim().toLowerCase();
    const found = state.config.agents.find((a) => a.name.toLowerCase() === name);
    if (found) {
      state.agent = found;
      console.log(`Switched to ${found.name} (${found.model})`);
    } else {
      const names = state.config.agents.map((a) => a.name).join(", ");
      console.log(`Unknown profile '${name}'. Options: ${names}`);
    }
    return "continue";
  },
  "/setup": async (rl, state) => {
    console.log();
    state.config = await runSetupWizard(rl);
    state.agent = state.config.agents.find((a) => a.name === state.config.defaultAgent) ?? state.config.agents[0];
    state.messages = [];
    console.log(`Active profile: ${state.agent.name} (${state.agent.model})
`);
    return "continue";
  },
  "/init": async (_rl, state) => {
    const { path, created } = await initWorkspaceConfig();
    if (created) {
      console.log(`Created ${path}`);
    } else {
      console.log(`${path} already exists.`);
    }
    state.workspaceConfig = await loadWorkspaceConfig() ?? undefined;
    return "continue";
  },
  "/exit": async () => "exit",
  "/quit": async () => "exit"
};
commands["/config"] = commands["/setup"];
async function dispatchCommand(rl, state, input) {
  const [command, ...rest] = input.split(/\s+/);
  const handler = commands[command];
  return handler ? handler(rl, state, rest.join(" ")) : undefined;
}
function buildSystemPrompt(state) {
  const parts = [];
  if (state.agentsGuide) {
    parts.push(state.agentsGuide);
  }
  if (state.agent.systemPrompt) {
    parts.push(state.agent.systemPrompt);
  }
  return parts.join(`

`);
}
async function sendMessage(state, content, rl) {
  state.messages.push({ role: "user", content });
  const systemPrompt = buildSystemPrompt(state);
  const outgoing = systemPrompt ? [{ role: "system", content: systemPrompt }, ...state.messages] : state.messages;
  let allTools = [...BUILTIN_TOOLS];
  if (state.workspaceConfig) {
    const approvalHandler = async (approval) => {
      const answer = await rl.question(`
${ANSI_GRAY}Approve ${approval.description}? (y/N): ${ANSI_RESET}`);
      return answer.toLowerCase().startsWith("y");
    };
    const fileTools = createFileTools(state.workspaceConfig, approvalHandler);
    allTools = [...allTools, ...fileTools];
  }
  process.stdout.write(`${ANSI_BLUE}${state.agent.name}${ANSI_RESET}: `);
  const spinner = createSpinner();
  spinner.start();
  let atLineStart = false;
  try {
    const reply = await getClient(state.config.backend).chatWithTools(state.config.baseUrl, state.agent.model, outgoing, allTools, (token) => {
      spinner.stop();
      process.stdout.write(token);
      atLineStart = token.endsWith(`
`);
    }, (name, args) => {
      spinner.stop();
      if (!atLineStart)
        process.stdout.write(`
`);
      process.stdout.write(`${ANSI_GRAY}[calling ${name}(${JSON.stringify(args)})]${ANSI_RESET}
`);
      atLineStart = true;
      spinner.start();
    });
    spinner.stop();
    console.log(`
`);
    state.messages.push({ role: "assistant", content: reply });
  } catch (err) {
    spinner.stop();
    console.error(`
[error] ${err.message}`);
    state.messages.pop();
  }
}
async function runChatLoop(config) {
  const rl = createInterface2({ input: stdin2, output: stdout2 });
  const workspaceConfig = await loadWorkspaceConfig();
  const agentsGuide = await loadAgentsGuide();
  const state = {
    config,
    agent: config.agents.find((a) => a.name === config.defaultAgent) ?? config.agents[0],
    messages: [],
    workspaceConfig: workspaceConfig ?? undefined,
    agentsGuide: agentsGuide ?? undefined
  };
  console.log(`loki — connected to ${BACKEND_LABELS[state.config.backend]} at ${state.config.baseUrl}`);
  if (agentsGuide) {
    console.log(`Loaded AGENTS.md (${agentsGuide.length} chars)`);
  }
  if (workspaceConfig) {
    console.log(`Workspace: ${workspaceConfig.workspace.root} (autoApprove: ${workspaceConfig.workspace.autoApprove})`);
  }
  console.log(`Type /help for commands, /exit to quit.
`);
  console.log(`Active profile: ${state.agent.name} (${state.agent.model})
`);
  try {
    while (true) {
      let userInput;
      try {
        userInput = (await rl.question(`${ANSI_GRAY}You (${state.agent.name})${ANSI_RESET}: `)).trim();
      } catch {
        break;
      }
      if (!userInput)
        continue;
      const result = await dispatchCommand(rl, state, userInput);
      if (result === "exit")
        break;
      if (result === "continue")
        continue;
      await sendMessage(state, userInput, rl);
    }
  } finally {
    rl.close();
  }
}

// src/index.ts
async function main() {
  const command = process.argv[2];
  if (command === "setup" || command === "config") {
    await runSetupWizard();
    return;
  }
  if (command === "init") {
    const force = process.argv.includes("--force");
    const { path, created } = await initWorkspaceConfig(process.cwd(), { force });
    if (created) {
      console.log(`Created ${path}`);
      console.log(`Edit allowedGlobs/deniedGlobs/autoApprove to control what agents can read/write here.`);
    } else {
      console.log(`${path} already exists. Pass --force to overwrite it.`);
    }
    return;
  }
  if (command === "--version" || command === "-v") {
    console.log(package_default.version);
    return;
  }
  if (command === "--help" || command === "-h") {
    console.log("Usage:");
    console.log("  loki               start chatting (runs setup first time)");
    console.log("  loki setup         (re)run the setup wizard (backend + model profiles)");
    console.log("  loki config        alias for setup");
    console.log("  loki init          create .loki/settings.yml here to enable file tools");
    console.log("  loki --version     print the installed version");
    return;
  }
  if (command?.startsWith("-")) {
    console.error(`Unknown option '${command}'. Run "loki --help" for usage.`);
    process.exit(1);
  }
  const config = configExists() ? await loadConfig() : await runSetupWizard();
  await runChatLoop(config);
}
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
