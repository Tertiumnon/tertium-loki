import type { ModelInfo } from "../ollama-client/ollama-client.types";

export type Role = "general" | "coder" | "vision";

export interface RoleSuggestion {
  role: Role;
  model: ModelInfo;
}
