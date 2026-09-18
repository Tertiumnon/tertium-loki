#!/usr/bin/env node
import packageJson from "../package.json";
import { runChatLoop } from "./chat-loop/chat-loop";
import { configExists, loadConfig } from "./config/config";
import { runSetupWizard } from "./setup-wizard/setup-wizard";
import { initWorkspaceConfig } from "./workspace/workspace";

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "setup" || command === "config") {
    await runSetupWizard();
    return;
  }

  if (command === "init") {
    const force = process.argv.includes("--force");
    const { path, created } = await initWorkspaceConfig(process.cwd(), { force });
    if (created) {
      console.log(`Created ${path}`);
      console.log(`Edit allowedGlobs/deniedGlobs/autoApprove to control what agents can read/write here.`);
    } else {
      console.log(`${path} already exists. Pass --force to overwrite it.`);
    }
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(packageJson.version);
    return;
  }

  if (command === "--help" || command === "-h") {
    console.log("Usage:");
    console.log("  loki               start chatting (runs setup first time)");
    console.log("  loki setup         (re)run the setup wizard (backend + model profiles)");
    console.log("  loki config        alias for setup");
    console.log("  loki init          create .loki/settings.yml here to enable file tools");
    console.log("  loki --version     print the installed version");
    return;
  }

  if (command?.startsWith("-")) {
    console.error(`Unknown option '${command}'. Run "loki --help" for usage.`);
    process.exit(1);
  }

  const config = configExists() ? await loadConfig() : await runSetupWizard();
  await runChatLoop(config);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
