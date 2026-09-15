import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { chatStream, listModels } from "./ollamaClient.js";
const RESET = "\x1b[0m";
const GRAY = "\x1b[90m";
const BLUE = "\x1b[94m";
function printHelp(config) {
    const names = config.agents.map((a) => a.name).join(", ");
    console.log("Commands:");
    console.log(`  /agent <name>   switch active profile: ${names}`);
    console.log("  /which          show active profile");
    console.log("  /models         list models available on the Ollama server");
    console.log("  /reset          clear conversation history");
    console.log("  /help           show this help");
    console.log("  /exit, /quit    leave chat");
}
export async function runChatLoop(config) {
    const rl = createInterface({ input: stdin, output: stdout });
    let agent = config.agents.find((a) => a.name === config.defaultAgent) ?? config.agents[0];
    let messages = [];
    console.log(`loki — connected to ${config.baseUrl}`);
    console.log(`Type /help for commands, /exit to quit.\n`);
    console.log(`Active profile: ${agent.name} (${agent.model})\n`);
    try {
        while (true) {
            let userInput;
            try {
                userInput = (await rl.question(`${GRAY}You (${agent.name})${RESET}: `)).trim();
            }
            catch {
                break; // Ctrl+C / EOF
            }
            if (!userInput)
                continue;
            if (userInput === "/exit" || userInput === "/quit")
                break;
            if (userInput === "/help") {
                printHelp(config);
                continue;
            }
            if (userInput === "/which") {
                console.log(`Active profile: ${agent.name} (${agent.model})`);
                continue;
            }
            if (userInput === "/reset") {
                messages = [];
                console.log("Conversation history cleared.");
                continue;
            }
            if (userInput === "/models") {
                try {
                    const models = await listModels(config.baseUrl);
                    console.log("Models on server:\n  " + models.join("\n  "));
                }
                catch (err) {
                    console.error(`Failed to list models: ${err.message}`);
                }
                continue;
            }
            if (userInput.startsWith("/agent")) {
                const name = userInput.split(/\s+/, 2)[1]?.toLowerCase();
                const found = config.agents.find((a) => a.name.toLowerCase() === name);
                if (found) {
                    agent = found;
                    console.log(`Switched to ${agent.name} (${agent.model})`);
                }
                else {
                    const names = config.agents.map((a) => a.name).join(", ");
                    console.log(`Unknown profile '${name ?? ""}'. Options: ${names}`);
                }
                continue;
            }
            messages.push({ role: "user", content: userInput });
            const outgoing = agent.systemPrompt
                ? [{ role: "system", content: agent.systemPrompt }, ...messages]
                : messages;
            process.stdout.write(`${BLUE}${agent.name}${RESET}: `);
            let reply = "";
            try {
                reply = await chatStream(config.baseUrl, agent.model, outgoing, (token) => {
                    process.stdout.write(token);
                });
            }
            catch (err) {
                console.error(`\n[error] ${err.message}`);
                messages.pop();
                continue;
            }
            console.log("\n");
            messages.push({ role: "assistant", content: reply });
        }
    }
    finally {
        rl.close();
    }
}
