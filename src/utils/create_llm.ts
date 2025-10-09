import { ChatOpenAI } from "@langchain/openai";

export function createLLM(): ChatOpenAI {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        throw new Error("Missing DEEPSEEK_API_KEY environment variable.");
    }

    return new ChatOpenAI({
        apiKey,
        model: "deepseek-chat",
        temperature: 0,
        configuration: {
            baseURL: process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com",
        },
    });
}