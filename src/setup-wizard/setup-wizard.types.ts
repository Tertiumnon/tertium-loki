import type { createInterface } from "node:readline/promises";
import type { Role } from "../model-suggest/model-suggest.types";
import type { ModelInfo } from "../ollama-client/ollama-client.types";

export type Readline = ReturnType<typeof createInterface>;

export interface RoleSuggestion {
  role: Role;
  model: ModelInfo;
}
