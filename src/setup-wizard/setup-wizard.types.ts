import type { createInterface } from "node:readline/promises";
import type { ModelInfo } from "../llm-client/llm-client.types";
import type { Role } from "../model-suggest/model-suggest.types";

export type Readline = ReturnType<typeof createInterface>;

export interface RoleSuggestion {
  role: Role;
  model: ModelInfo;
}
