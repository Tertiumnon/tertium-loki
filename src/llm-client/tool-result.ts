/**
 * Wording of the "tool" message fed back to the model, shared by both backends. Small models
 * (Llama 3.1 8B especially) tend to parrot tool content verbatim, so a bare "Result: Error: ..."
 * ends up printed as the reply — failures are phrased as a situation to explain instead.
 */
export function formatToolResult(toolName: string, result: string): string {
  if (result.startsWith("Error:")) {
    const reason = result.slice("Error:".length).trim();
    return `The ${toolName} tool failed: ${reason}. Tell the user briefly, in your own words, that it didn't work and why. Do not make up the missing information.`;
  }
  return `${result}\n\n(Tool output above. Use it to answer the user's original request in your own words — don't quote it verbatim or mention the tool.)`;
}
