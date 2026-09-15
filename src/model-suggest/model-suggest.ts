import type { ModelInfo } from "../ollama-client/ollama-client.types";
import {
  CODER_NAME_PATTERN,
  EMBED_NAME_PATTERN,
  GUARD_NAME_PATTERN,
  VISION_NAME_PATTERN,
} from "./model-suggest.constants";
import type { Role } from "./model-suggest.types";

function parseParamCount(size: string): number {
  const match = /([\d.]+)\s*B/i.exec(size);
  return match ? Number.parseFloat(match[1]) : 0;
}

/** Embedding-only models can't hold a chat conversation at all. */
export function isChatCapable(model: ModelInfo): boolean {
  if (!model.capabilities.includes("completion")) return false;
  if (EMBED_NAME_PATTERN.test(model.name)) return false;
  return true;
}

/** Which role(s) a model looks suited for, based on live server-reported capabilities + naming. */
export function classify(model: ModelInfo): Role[] {
  const roles: Role[] = [];
  const looksLikeVision = model.capabilities.includes("vision") || VISION_NAME_PATTERN.test(model.name);
  const looksLikeCoder =
    model.capabilities.includes("insert") ||
    CODER_NAME_PATTERN.test(model.name) ||
    CODER_NAME_PATTERN.test(model.family);

  if (looksLikeVision) roles.push("vision");
  if (looksLikeCoder) roles.push("coder");
  if (roles.length === 0 && !GUARD_NAME_PATTERN.test(model.name)) roles.push("general");

  return roles;
}

/** Best candidate for a role: largest parameter count among chat-capable matches. */
export function suggestForRole(models: ModelInfo[], role: Role): ModelInfo | undefined {
  const candidates = models.filter((m) => isChatCapable(m) && classify(m).includes(role));
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => parseParamCount(b.parameterSize) - parseParamCount(a.parameterSize))[0];
}

export function describeModel(model: ModelInfo): string {
  const roles = classify(model);
  const caps = model.capabilities.length ? model.capabilities.join(", ") : "none";
  const ctx = model.contextLength ? `, ${Math.round(model.contextLength / 1024)}K ctx` : "";
  const roleLabel = isChatCapable(model) ? roles.join("/") || "unassigned" : "not chat-capable";
  return `${model.parameterSize.padEnd(6)} caps: ${caps}${ctx}  → ${roleLabel}`;
}
