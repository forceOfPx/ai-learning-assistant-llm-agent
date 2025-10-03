import { ChatOpenAI } from "@langchain/openai";
import { ReactAgent } from "../agent/react_agent_base";

/**
 * Demonstrates how to run the LangGraph React agent wrapper with DeepSeek as the LLM provider.
 *
 * Required environment variable:
 *   - DEEPSEEK_API_KEY: Your DeepSeek API key.
 * Optional environment variable:
 *   - DEEPSEEK_API_BASE: Override the default DeepSeek API base URL (defaults to https://api.deepseek.com).
 */
async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY environment variable.");
  }

  const llm = new ChatOpenAI({
    model: "deepseek-chat",
    apiKey,
    temperature: 0.2,
    configuration: {
      baseURL: process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com",
    },
  });

  const agent = new ReactAgent({
    llm,
    defaultThreadId: "debug-deepseek-thread",
  });

  // Walk through a short conversation using the chat helper that auto-adds human messages.
  const prompts = [
    "My name is Jamie. Remember it.",
    "What's 12 * 8?",
    "Great. What's my name?",
  ];

  let lastResponse = "";
  for (const input of prompts) {
    lastResponse = await agent.chat(input);
    console.log(`\nUser: ${input}`);
    console.log(`Agent: ${lastResponse}`);
  }

  console.log("\nFinal response:", lastResponse);
}

void main().catch((error) => {
  console.error("React agent example failed:", error);
  process.exitCode = 1;
});
