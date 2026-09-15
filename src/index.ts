#!/usr/bin/env node
import { configExists, loadConfig } from "./config.js";
import { runSetupWizard } from "./setupWizard.js";
import { runChatLoop } from "./chatLoop.js";

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "config" || command === "init") {
    await runSetupWizard();
    return;
  }

  if (command === "--help" || command === "-h") {
    console.log("Usage:");
    console.log("  loki               start chatting (runs setup first time)");
    console.log("  loki init          (re)run the setup wizard");
    console.log("  loki config        alias for init");
    return;
  }

  const config = configExists() ? await loadConfig() : await runSetupWizard();
  await runChatLoop(config);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
