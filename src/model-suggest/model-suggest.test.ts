import { describe, expect, test } from "bun:test";
import type { ModelInfo } from "../llm-client/llm-client.types";
import { classify, describeModel, isChatCapable, suggestForRole } from "./model-suggest";

function model(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    name: "test-model:7b",
    family: "llama",
    parameterSize: "7B",
    capabilities: ["completion"],
    ...overrides,
  };
}

describe("isChatCapable", () => {
  test("true for a plain completion model", () => {
    expect(isChatCapable(model())).toBe(true);
  });

  test("false without the completion capability", () => {
    expect(isChatCapable(model({ capabilities: ["embedding"] }))).toBe(false);
  });

  test("false for embedding-named models even if tagged completion", () => {
    expect(isChatCapable(model({ name: "nomic-embed-text", capabilities: ["completion"] }))).toBe(false);
  });
});

describe("classify", () => {
  test("defaults to general with no other signal", () => {
    expect(classify(model())).toEqual(["general"]);
  });

  test("insert capability implies coder", () => {
    expect(classify(model({ capabilities: ["completion", "insert"] }))).toEqual(["coder"]);
  });

  test("'coder' in the name implies coder even without the insert capability", () => {
    expect(classify(model({ name: "qwen2.5-coder:7b" }))).toEqual(["coder"]);
  });

  test("vision capability implies vision", () => {
    expect(classify(model({ capabilities: ["completion", "vision"] }))).toEqual(["vision"]);
  });

  test("vision-ish naming implies vision", () => {
    expect(classify(model({ name: "llava:13b" }))).toEqual(["vision"]);
  });

  test("guard-named models get no role at all", () => {
    expect(classify(model({ name: "llama-guard:8b" }))).toEqual([]);
  });

  test("a model can be classified as both vision and coder", () => {
    const roles = classify(model({ name: "some-vl-coder", capabilities: ["completion", "vision", "insert"] }));
    expect(roles).toEqual(["vision", "coder"]);
  });
});

describe("suggestForRole", () => {
  test("picks the largest parameter count among matching candidates", () => {
    const models = [
      model({ name: "small-coder", capabilities: ["completion", "insert"], parameterSize: "3B" }),
      model({ name: "big-coder", capabilities: ["completion", "insert"], parameterSize: "14B" }),
    ];
    expect(suggestForRole(models, "coder")?.name).toBe("big-coder");
  });

  test("returns undefined when nothing matches the role", () => {
    expect(suggestForRole([model({ name: "general-only" })], "vision")).toBeUndefined();
  });

  test("excludes non-chat-capable models even if the name matches", () => {
    const models = [model({ name: "coder-embed", capabilities: ["embedding"] })];
    expect(suggestForRole(models, "coder")).toBeUndefined();
  });
});

describe("describeModel", () => {
  test("flags embedding-only models as not chat-capable", () => {
    expect(describeModel(model({ capabilities: ["embedding"] }))).toContain("not chat-capable");
  });

  test("renders context length in K when present", () => {
    expect(describeModel(model({ contextLength: 131072 }))).toContain("128K ctx");
  });

  test("omits context length when absent", () => {
    expect(describeModel(model())).not.toContain("ctx");
  });
});
