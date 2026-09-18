import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initWorkspaceConfig, isPathAllowed, parseSimpleYaml, validatePath } from "./workspace";
import type { WorkspaceConfig } from "./workspace.types";

describe("parseSimpleYaml", () => {
  test("parses simple YAML with nested structure", () => {
    const yaml = `workspace:
  root: "."
  allowedGlobs:
    - "src/**"
    - "*.md"
  deniedGlobs:
    - "node_modules/**"
  autoApprove: true`;

    const parsed = parseSimpleYaml(yaml);
    expect(parsed.workspace).toBeDefined();
    const ws = parsed.workspace as Record<string, unknown>;
    expect(ws.root).toBe(".");
    const allowedGlobs = ws.allowedGlobs as unknown[];
    const deniedGlobs = ws.deniedGlobs as unknown[];
    expect(allowedGlobs?.length).toBe(2);
    expect(deniedGlobs?.length).toBe(1);
    expect(ws.autoApprove).toBe(true);
  });
});

describe("isPathAllowed", () => {
  const config: WorkspaceConfig = {
    workspace: {
      root: "/project",
      allowedGlobs: ["src/**", "*.json", "*.md"],
      deniedGlobs: ["node_modules/**", ".git/**"],
      autoApprove: true,
    },
  };

  test("allows paths matching allowed globs", () => {
    expect(isPathAllowed("/project/src/index.ts", config)).toBe(true);
    expect(isPathAllowed("/project/src/lib/util.ts", config)).toBe(true);
  });

  test("allows paths matching top-level globs", () => {
    expect(isPathAllowed("/project/package.json", config)).toBe(true);
    expect(isPathAllowed("/project/README.md", config)).toBe(true);
  });

  test("denies paths outside workspace root", () => {
    expect(isPathAllowed("/other/src/index.ts", config)).toBe(false);
  });

  test("denies paths matching denied globs", () => {
    expect(isPathAllowed("/project/node_modules/foo/bar.js", config)).toBe(false);
    expect(isPathAllowed("/project/.git/config", config)).toBe(false);
  });

  test("denies paths not matching any allowed glob", () => {
    expect(isPathAllowed("/project/secret.env", config)).toBe(false);
  });
});

describe("validatePath", () => {
  const config: WorkspaceConfig = {
    workspace: {
      root: "/project",
      allowedGlobs: ["src/**"],
      autoApprove: false,
    },
  };

  test("throws on disallowed paths", () => {
    expect(() => validatePath("/other/src/index.ts", config)).toThrow();
    expect(() => validatePath("/project/secret.env", config)).toThrow();
  });

  test("does not throw on allowed paths", () => {
    expect(() => validatePath("/project/src/index.ts", config)).not.toThrow();
  });
});

describe("initWorkspaceConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "loki-workspace-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("creates .loki/settings.yml with permissive defaults", async () => {
    const result = await initWorkspaceConfig(dir);

    expect(result.created).toBe(true);
    const content = await readFile(result.path, "utf-8");
    expect(content).toContain('allowedGlobs:\n    - "**/*"');
    expect(content).toContain("autoApprove: false");
  });

  test("does not overwrite an existing settings file", async () => {
    const first = await initWorkspaceConfig(dir);
    await writeFile(first.path, 'workspace:\n  root: "."\n  allowedGlobs: []\n  autoApprove: true\n', "utf-8");

    const second = await initWorkspaceConfig(dir);

    expect(second.created).toBe(false);
    expect(await readFile(second.path, "utf-8")).toContain("autoApprove: true");
  });

  test("overwrites when force is passed", async () => {
    const first = await initWorkspaceConfig(dir);
    await writeFile(first.path, 'workspace:\n  root: "."\n  allowedGlobs: []\n  autoApprove: true\n', "utf-8");

    const second = await initWorkspaceConfig(dir, { force: true });

    expect(second.created).toBe(true);
    expect(await readFile(second.path, "utf-8")).toContain("autoApprove: false");
  });
});
