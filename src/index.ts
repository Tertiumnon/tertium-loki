#!/usr/bin/env node
import packageJson from "../package.json";
import { runChatLoop } from "./chat-loop/chat-loop";
import { configExists, loadConfig } from "./config/config";
import { runSetupWizard } from "./setup-wizard/setup-wizard";

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "config" || command === "init") {
    await runSetupWizard();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(packageJson.version);
    return;
  }

  if (command === "--help" || command === "-h") {
    console.log("Usage:");
    console.log("  loki               start chatting (runs setup first time)");
    console.log("  loki init          (re)run the setup wizard");
    console.log("  loki config        alias for init");
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
