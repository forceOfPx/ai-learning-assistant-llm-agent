import { 
    createPersistentCourseAgent, 
    createMemoryCourseAgent,
    createDefaultCoursePostgresConfig 
} from "../domain/course_agent_v2";

import * as path from "path";

const STUDENT_NAME = "student_alice";
const DEFAULT_THREAD_ID = "default_course_thread"; // todo: 这个没啥用了，之前的接口

/**
 * 演示课程代理的 PostgreSQL 持久化功能
 */
async function demonstratePersistentCourseAgent() {
    console.log("🎓 开始课程代理持久化演示");

    // 设置文件路径
    const srtPath = path.join(__dirname, "../../voice/01/01.srt");
    const courseOutline = path.join(__dirname, "../../voice/01/outline.txt");
    
    const systemPrompt = `你是一个专业的AI学习助手。你的任务是帮助学生理解课程内容，回答问题，并提供学习指导。

## 你的能力：
1. 📚 可以查看课程大纲，了解整体学习目标
2. 🎥 可以根据时间戳查看视频课程的字幕内容
3. 🔍 可以搜索相关的课程片段
4. 💡 提供详细的解释和举例

## 行为准则：
- 始终保持专业和耐心
- 根据学生的问题引用具体的课程内容
- 提供清晰、结构化的回答
- 鼓励学生思考和提问

请准备好回答学生关于课程的任何问题！`;

    console.log("📋 课程配置:");
    console.log(`SRT 文件: ${srtPath}`);
    console.log(`课程大纲: ${courseOutline}`);

    try {
        const postgresConfig = createDefaultCoursePostgresConfig();
        postgresConfig.database = "ai_agent_chat"; // 使用现有的数据库
        
        const persistAgent = await createPersistentCourseAgent(
            srtPath,
            courseOutline,
            systemPrompt,
            {
                threadId: DEFAULT_THREAD_ID,
                postgresConfig
            }
        );

        const student1Thread = await persistAgent.mapUserToThread(STUDENT_NAME, undefined, {
            name: "Alice",
            course: "群论",
            progress: "第1章",
            notes: `学习开始时间: ${new Date().toLocaleString('zh-CN', { 
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })}`
        });
        // Alice 的学习对话
        const aliceResponse = await persistAgent.chat("我是Alice, 我对群论的基本概念还不太理解，能详细解释一下吗？", {
            configurable: { thread_id: student1Thread }
        });
        console.log("\nAlice: 我对群论的基本概念还不太理解，能详细解释一下吗？");
        console.log("AI助手:", aliceResponse.substring(0, 400) + "...");

        // 模拟Alice关闭浏览器后重新打开，继续对话
        const persistAgent2 =  await createPersistentCourseAgent(
            srtPath,
            courseOutline,
            systemPrompt,
            {
                threadId: DEFAULT_THREAD_ID,
                postgresConfig
            }
        );

        let aliceResponse2 = await persistAgent2.chat("我目前处在 00:34:16,000 请详细解释一下“冗余自由度的消除", {
            configurable: { thread_id: student1Thread }
        });
        console.log("\nAlice: 我目前处在 00:34:16,000 请详细解释一下“冗余自由度的消除");
        console.log("AI助手:", aliceResponse2.substring(0, 400) + "...");

        aliceResponse2 = await persistAgent2.chat("帮我总结一下今天我学习了什么？", {
            configurable: { thread_id: student1Thread }
        });
        console.log("\nAlice: 帮我总结一下今天我学习了什么？");
        console.log("AI助手:", aliceResponse2.substring(0, 400) + "...");
    } catch (error) {
        console.error("❌ 演示过程中发生错误:", error);
        
        // 提供课程代理特有的错误解决方案
        if (error instanceof Error) {
            const errorMsg = error.message.toLowerCase();
            
            if (errorMsg.includes('srt') || errorMsg.includes('outline')) {
                console.log("\n💡 课程文件错误 - 解决方案:");
                console.log("1. 确保 SRT 字幕文件存在");
                console.log("2. 确保课程大纲文件存在");
                console.log("3. 检查文件路径是否正确");
                console.log("4. 确保文件格式正确且可读");
            }
        }
    }
}

// 如果直接运行此文件，执行演示
if (require.main === module) {
    (async () => {
        try {
            await demonstratePersistentCourseAgent();
        } catch (error) {
            console.error("演示失败:", error);
            process.exit(1);
        }
    })();
}

export {
    demonstratePersistentCourseAgent
};