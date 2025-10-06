import { SystemMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { createSrtTools } from "../tool/srt_tools";
import { createGetOutlineTool } from "../tool/simple_read_file_tool";
import { ReactAgent } from "../agent/react_agent_base";

type CourseAgentOptions = {
	/** Optional override for the chat model instance. */
	llm?: ChatOpenAI;
	/** Optional thread identifier used for checkpointing. */
	threadId?: string;
	/** Absolute path to the course outline file used for reference. */
	courseOutline: string;
	/** Required absolute path to the SRT transcript for tool binding. */
	srtPath: string;
	/** System prompt used to prime the agent's planner. */
	plannerSystemPrompt: string;
};

const DEFAULT_THREAD_ID = "course-agent-thread";

function createLlm(): ChatOpenAI {
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

export function createCourseAgentGraph(options: CourseAgentOptions) {
	const { srtPath, courseOutline } = options;
	if (!srtPath || !courseOutline) {
		throw new Error("srtPath or courseOutline must be provided to createCourseAgentGraph.");
	}

	const llm = options.llm ?? createLlm();
	const threadId = options.threadId ?? DEFAULT_THREAD_ID;
	const checkpointer = new MemorySaver();
	const tools: StructuredToolInterface[] = [...createSrtTools(srtPath)];

	tools.push(createGetOutlineTool(courseOutline));	

	const prompt = new SystemMessage(options.plannerSystemPrompt);

	const reactAgent = new ReactAgent({
		llm,
		prompt,
		tools,
		checkpointSaver: checkpointer,
		checkpointer,
		defaultThreadId: threadId,
	});
  
	const toolNode = new ToolNode(tools);

	async function callReactAgent(state: typeof MessagesAnnotation.State) {
		const response = await reactAgent.invoke(state.messages, {
			configurable: { thread_id: threadId },
		});

		const newMessages = response.messages.slice(state.messages.length);
		return { messages: newMessages };
	}

	function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
		const lastMessage = messages[messages.length - 1];
		if (!lastMessage || !("tool_calls" in lastMessage)) {
			return "__end__";
		}

		const toolCalls = (lastMessage as any).tool_calls;
		return Array.isArray(toolCalls) && toolCalls.length > 0 ? "tools" : "__end__";
	}

	const workflow = new StateGraph(MessagesAnnotation)
		.addNode("agent", callReactAgent)
		.addEdge("__start__", "agent")
		.addNode("tools", toolNode)
		.addEdge("tools", "agent")
		.addConditionalEdges("agent", shouldContinue);

	return workflow.compile();
}