import { resolve } from "node:path";

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import {
	getLineNumberAtTimestampTool,
	readNextLinesTool,
	readPreviousLinesTool,
} from "../tool/srt_tools";
import { createGetOutlineTool } from "../tool/simple_read_file_tool";
import { ReactAgent } from "../agent/react_agent_base";

type CourseAgentOptions = {
	/** Optional override for the chat model instance. */
	llm?: ChatOpenAI;
	/** Optional thread identifier used for checkpointing. */
	threadId?: string;
	/** Optional absolute path to the course outline file used for reference. */
	courseOutline?: string;
};

const DEFAULT_THREAD_ID = "course-agent-thread";

const BASE_COURSE_TOOLS: StructuredToolInterface[] = [
	getLineNumberAtTimestampTool,
	readPreviousLinesTool,
	readNextLinesTool,
];

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

export function createCourseAgentGraph(options: CourseAgentOptions = {}) {
	const llm = options.llm ?? createLlm();
	const threadId = options.threadId ?? DEFAULT_THREAD_ID;
	const checkpointer = new MemorySaver();
	const tools: StructuredToolInterface[] = [...BASE_COURSE_TOOLS];

	if (options.courseOutline) {
		tools.push(createGetOutlineTool(options.courseOutline));
	}

	const outlineDirective = options.courseOutline
		? `你可以随时读取课程大纲文件（路径：${options.courseOutline}）。`
		: "如果用户需要课程大纲，请提醒他们提供大纲文件路径。";

	const prompt = new SystemMessage(
		`你是一个助教，能够帮助学生解决学习中的问题，你可以使用工具来辅助完成任务。${outlineDirective}`
	);

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

async function runDemo() {
	const srtPath = resolve(process.cwd(), "voice/01/01.srt");
	const outlinePath = resolve(process.cwd(), "voice/01/outline.txt");
	const app = createCourseAgentGraph({ courseOutline: outlinePath });

	const initialState = await app.invoke({
		messages: [
			new HumanMessage(
				`请帮我查找字幕文件 ${srtPath} 中时间戳 00:00:59,000 所在的行，并返回前后各两行上下文。`
			),
		],
	});

	const reply = initialState.messages.at(-1);
	if (reply) {
		console.log("Course agent reply:\n", reply.content);
	}
}

if (require.main === module) {
	void runDemo().catch((error) => {
		console.error("Course agent demo failed:", error);
		process.exitCode = 1;
	});
}