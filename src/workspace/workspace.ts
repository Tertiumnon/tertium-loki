import { readdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { minimatch } from "minimatch";
import type { ToolDefinition } from "../ollama-client/ollama-client.types";
import { WORKSPACE_CONFIG_FILENAME } from "./workspace.constants";
import type { PendingApproval, WorkspaceConfig } from "./workspace.types";

export function parseSimpleYaml(content: string): Record<string, unknown> {
  const lines = content.split("\n");
  const result: Record<string, unknown> = {};
  let currentSection: Record<string, unknown> = result;
  let currentArray: string[] | null = null;
  let sectionStack: Array<{ section: Record<string, unknown>; key: string }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

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
          if (value === "true") result[key] = true;
          else if (value === "false") result[key] = false;
          else if (value.startsWith('"') && value.endsWith('"')) result[key] = value.slice(1, -1);
          else result[key] = value;
        } else {
          result[key] = {};
          sectionStack.push({ section: result, key });
          currentSection = result[key] as Record<string, unknown>;
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
          if (value === "true") currentSection[key] = true;
          else if (value === "false") currentSection[key] = false;
          else if (value.startsWith('"') && value.endsWith('"')) currentSection[key] = value.slice(1, -1);
          else currentSection[key] = value;
        } else {
          currentArray = [];
          currentSection[key] = currentArray;
        }
      }
    }
  }

  return result;
}

export async function loadWorkspaceConfig(cwd: string = process.cwd()): Promise<WorkspaceConfig | null> {
  const configPath = resolve(cwd, WORKSPACE_CONFIG_FILENAME);
  try {
    const content = await readFile(configPath, "utf-8");
    const parsed = parseSimpleYaml(content) as Record<string, unknown>;
    const workspace = parsed.workspace as Record<string, unknown>;
    if (!workspace) return null;

    return {
      workspace: {
        root: String(workspace.root ?? "."),
        allowedGlobs: (workspace.allowedGlobs as string[]) ?? [],
        deniedGlobs: (workspace.deniedGlobs as string[]) ?? [],
        autoApprove: Boolean(workspace.autoApprove ?? false),
      },
    };
  } catch {
    return null;
  }
}

export function isPathAllowed(filePath: string, config: WorkspaceConfig): boolean {
  const root = resolve(config.workspace.root);
  const fullPath = resolve(filePath);

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

/** Throws if path is not allowed. */
export function validatePath(filePath: string, config: WorkspaceConfig): void {
  if (!isPathAllowed(filePath, config)) {
    throw new Error(`Path outside workspace or not in allowedGlobs: ${filePath}`);
  }
}

export async function readFileContent(filePath: string, config: WorkspaceConfig): Promise<string> {
  validatePath(filePath, config);
  return readFile(filePath, "utf-8");
}

export async function writeFileContent(filePath: string, content: string, config: WorkspaceConfig): Promise<void> {
  validatePath(filePath, config);
  await writeFile(filePath, content, "utf-8");
}

export async function listDirectory(dirPath: string, config: WorkspaceConfig): Promise<string[]> {
  validatePath(dirPath, config);
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.map((e) => `${e.name}${e.isDirectory() ? "/" : ""}`);
  } catch {
    return [];
  }
}

export async function deleteFilePath(filePath: string, config: WorkspaceConfig): Promise<void> {
  validatePath(filePath, config);
  const fs = await import("node:fs/promises");
  await fs.rm(filePath, { force: true });
}

export async function moveFile(fromPath: string, toPath: string, config: WorkspaceConfig): Promise<void> {
  validatePath(fromPath, config);
  validatePath(toPath, config);
  const fs = await import("node:fs/promises");
  await fs.rename(fromPath, toPath);
}

export async function createDirectory(dirPath: string, config: WorkspaceConfig): Promise<void> {
  validatePath(dirPath, config);
  const fs = await import("node:fs/promises");
  await fs.mkdir(dirPath, { recursive: true });
}

export function createFileTools(
  config: WorkspaceConfig,
  approvalHandler?: (approval: PendingApproval) => Promise<boolean>,
): ToolDefinition[] {
  return [
    {
      name: "read_file",
      description: "Read the contents of a file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path (relative or absolute)" },
        },
        required: ["path"],
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        try {
          const content = await readFileContent(path, config);
          return content;
        } catch (err) {
          return `Error: ${(err as Error).message}`;
        }
      },
    },
    {
      name: "write_file",
      description: "Write or create a file in the workspace. Overwrites if exists.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path (relative or absolute)" },
          content: { type: "string", description: "File contents" },
        },
        required: ["path", "content"],
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        const content = String(args.content ?? "");

        if (!config.workspace.autoApprove) {
          const approved = await approvalHandler?.({
            toolName: "write_file",
            description: `Write ${content.length} chars to ${path}`,
            filePath: path,
            requiresApproval: true,
          });
          if (!approved) {
            return "Cancelled by user.";
          }
        }

        try {
          await writeFileContent(path, content, config);
          return `Wrote ${content.length} chars to ${path}`;
        } catch (err) {
          return `Error: ${(err as Error).message}`;
        }
      },
    },
    {
      name: "list_files",
      description: "List files and folders in a directory.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path (relative or absolute)" },
        },
        required: ["path"],
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        try {
          const entries = await listDirectory(path, config);
          return entries.join("\n");
        } catch (err) {
          return `Error: ${(err as Error).message}`;
        }
      },
    },
    {
      name: "delete_file",
      description: "Delete a file or folder in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File or folder path" },
        },
        required: ["path"],
      },
      execute: async (args) => {
        const path = String(args.path ?? "");

        if (!config.workspace.autoApprove) {
          const approved = await approvalHandler?.({
            toolName: "delete_file",
            description: `Delete ${path}`,
            filePath: path,
            requiresApproval: true,
          });
          if (!approved) {
            return "Cancelled by user.";
          }
        }

        try {
          await deleteFilePath(path, config);
          return `Deleted ${path}`;
        } catch (err) {
          return `Error: ${(err as Error).message}`;
        }
      },
    },
    {
      name: "move_file",
      description: "Move or rename a file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Source path" },
          to: { type: "string", description: "Destination path" },
        },
        required: ["from", "to"],
      },
      execute: async (args) => {
        const from = String(args.from ?? "");
        const to = String(args.to ?? "");

        if (!config.workspace.autoApprove) {
          const approved = await approvalHandler?.({
            toolName: "move_file",
            description: `Move ${from} → ${to}`,
            filePath: from,
            requiresApproval: true,
          });
          if (!approved) {
            return "Cancelled by user.";
          }
        }

        try {
          await moveFile(from, to, config);
          return `Moved ${from} → ${to}`;
        } catch (err) {
          return `Error: ${(err as Error).message}`;
        }
      },
    },
    {
      name: "create_folder",
      description: "Create a folder in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Folder path" },
        },
        required: ["path"],
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        try {
          await createDirectory(path, config);
          return `Created folder ${path}`;
        } catch (err) {
          return `Error: ${(err as Error).message}`;
        }
      },
    },
  ];
}
