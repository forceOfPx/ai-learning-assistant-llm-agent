import { resolve } from "node:path";

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { createSrtTools } from "../tool/srt_tools";
import { createGetOutlineTool } from "../tool/simple_read_file_tool";
import { ReactAgent } from "../agent/react_agent_base";
import { th } from "zod/v4/locales";

type CourseAgentOptions = {
	/** Optional override for the chat model instance. */
	llm?: ChatOpenAI;
	/** Optional thread identifier used for checkpointing. */
	threadId?: string;
	/** Optional absolute path to the course outline file used for reference. */
	courseOutline: string;
	/** Required absolute path to the SRT transcript for tool binding. */
	srtPath: string;
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

	if (courseOutline) {
		tools.push(createGetOutlineTool(courseOutline));
	}

	const outlineDirective = courseOutline
		? `你可以随时读取课程大纲文件（路径：${courseOutline}）。`
		: "如果用户需要课程大纲，请提醒他们提供大纲文件路径。";

	const transcriptDirective = `字幕内容位于 ${srtPath}，相关工具已经自动绑定该文件。`;

	const prompt = new SystemMessage(
		`你是一个助教，能够帮助学生解决学习中的问题，你可以使用工具来辅助完成任务。注意，你拿到的字幕文件并非人工打标，而是通过ASR自动转化的，所以可能存在一定的识别误差，在定位时应该首先参考时间信息。${outlineDirective} ${transcriptDirective}`
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
	const app = createCourseAgentGraph({
		courseOutline: outlinePath,
		srtPath,
	});

	const initialState = await app.invoke({
		messages: [
			new HumanMessage(
				`我目前处在 00:34:16,000 请详细解释一下“冗余自由度的消除”。`
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