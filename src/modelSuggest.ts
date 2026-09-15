import type { ModelInfo } from "./ollamaClient.js";

export type Role = "general" | "coder" | "vision";

export const ROLE_ORDER: Role[] = ["general", "coder", "vision"];

export const ROLE_DEFAULT_PROMPTS: Record<Role, string> = {
  general: "You are a helpful, concise assistant.",
  coder: "You are an expert software engineer. Answer coding questions concisely, with working code.",
  vision: "You are a helpful assistant that can analyze and describe images in detail.",
};

// Naming-convention heuristics only — never specific model tags — so this holds
// up across whatever models a given user happens to have pulled.
const CODER_NAME_PATTERN = /code|coder|sql|devstral|starcoder/i;
const VISION_NAME_PATTERN = /vision|[-:]vl\b|vl[-:]|llava|bakllava|moondream|pixtral/i;
const EMBED_NAME_PATTERN = /embed/i;
const GUARD_NAME_PATTERN = /guard|shield|moderation/i;

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
