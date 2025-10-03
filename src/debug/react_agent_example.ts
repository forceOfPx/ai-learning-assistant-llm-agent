import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
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

  // Build a short conversation that benefits from memory.
  const messages = [
    new HumanMessage("My name is Jamie. Remember it."),
    new HumanMessage("What's 12 * 8?"),
    new HumanMessage("Great. What's my name?")
  ];

  const result = await agent.invoke(messages);

  console.log("\nFinal agent state (messages):");
  for (const message of result.messages) {
    console.log(`- ${message.getType()}:`, message.content);
  }

  const finalResponse = result.messages[result.messages.length - 1]?.content;
  console.log("\nFinal response:", finalResponse);
}

void main().catch((error) => {
  console.error("React agent example failed:", error);
  process.exitCode = 1;
});
