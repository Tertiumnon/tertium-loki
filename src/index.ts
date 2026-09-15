#!/usr/bin/env node
import { runChatLoop } from "./chat-loop/chat-loop";
import { configExists, loadConfig } from "./config/config";
import { runSetupWizard } from "./setup-wizard/setup-wizard";

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
