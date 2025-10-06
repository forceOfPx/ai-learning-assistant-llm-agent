import { resolve } from "node:path";
import { createCourseAgentGraph } from "../domain/course_agent";
import { HumanMessage } from "@langchain/core/messages";

async function runDemo() {
	const srtPath = resolve(process.cwd(), "voice/01/01.srt");
	const outlinePath = resolve(process.cwd(), "voice/01/outline.txt");
	const app = createCourseAgentGraph({
		courseOutline: outlinePath,
		srtPath,
		plannerSystemPrompt: `你是一个助教，能够帮助学生解决学习中的问题，你可以使用工具来辅助完成任务。注意，你拿到的字幕文件并非人工打标，而是通过ASR自动转化的，所以可能存在一定的识别误差，在定位时应该首先参考时间信息。`
        
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