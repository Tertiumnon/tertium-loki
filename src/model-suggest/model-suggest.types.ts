import type { ModelInfo } from "../llm-client/llm-client.types";

export type Role = "general" | "coder" | "vision";

export interface RoleSuggestion {
  role: Role;
  model: ModelInfo;
}
