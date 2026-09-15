import type { Role } from "./model-suggest.types";

export const ROLE_ORDER: Role[] = ["general", "coder", "vision"];

export const ROLE_DEFAULT_PROMPTS: Record<Role, string> = {
  general: "You are a helpful, concise assistant.",
  coder: "You are an expert software engineer. Answer coding questions concisely, with working code.",
  vision: "You are a helpful assistant that can analyze and describe images in detail.",
};

// Naming-convention heuristics only — never specific model tags — so this holds
// up across whatever models a given user happens to have pulled.
export const CODER_NAME_PATTERN = /code|coder|sql|devstral|starcoder/i;
export const VISION_NAME_PATTERN = /vision|[-:]vl\b|vl[-:]|llava|bakllava|moondream|pixtral/i;
export const EMBED_NAME_PATTERN = /embed/i;
export const GUARD_NAME_PATTERN = /guard|shield|moderation/i;
