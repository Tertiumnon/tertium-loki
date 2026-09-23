export const ANSI_RESET = "\x1b[0m";
export const ANSI_GRAY = "\x1b[90m";
export const ANSI_BLUE = "\x1b[94m";

/** Always sent, ahead of AGENTS.md and the profile prompt — small local models otherwise have no
 *  idea when a tool fits and will call unrelated ones (e.g. get_weather on a "summarize this URL"). */
export const BASE_SYSTEM_PROMPT = `Today's date is {date}.
Answer from your own knowledge by default — general questions, explanations, and code need no tools.
Call a tool only when the request actually needs one:
- If the user gives a URL, call fetch_url with that exact URL. Never invent URLs to look things up.
- Only call get_weather when the user asks about the weather.
- Never call a tool that is unrelated to the request, and never repeat a call with the same arguments.
- If a tool returns an error or no useful content, tell the user plainly instead of guessing or calling other tools.
After using tools, answer the user's actual request directly. Don't list or describe the tools you called.`;

// A link as users actually paste it: with a scheme, starting www., or a bare domain followed by a path.
export const URL_IN_TEXT =
  /\b(?:https?:\/\/\S+|www\.[^\s/]+\.[a-z]{2,}\S*|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*)/i;

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
export const SPINNER_INTERVAL_MS = 80;
