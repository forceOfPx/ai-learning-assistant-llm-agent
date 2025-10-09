import { 
    createCourseAgent, 
    createPersistentCourseAgent, 
    createMemoryCourseAgent,
    createDefaultCoursePostgresConfig 
} from "../domain/course_agent_v2";
import { PostgreSQLPersistentStorage } from "../storage/persistent_storage";
import { createLLM } from "../utils/create_llm";
import * as path from "path";

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
        // 方式1: 使用简化的持久化创建函数
        console.log("\n🚀 方式1: 使用简化函数创建持久化课程代理");
        
        const persistentAgent = await createPersistentCourseAgent(
            srtPath,
            courseOutline,
            systemPrompt,
            {
                threadId: "student_001_session"
            }
        );

        console.log("✅ 持久化课程代理创建成功");

        // 演示持久化对话
        console.log("\n💬 演示持久化对话");
        
        const studentId = "student_001";
        const sessionThread = await persistentAgent.mapUserToThread(studentId, undefined, {
            name: "张同学",
            course: "AI基础课程",
            level: "初学者"
        });

        console.log(`📝 学生会话线程: ${sessionThread}`);

        // 学生提问1
        const response1 = await persistentAgent.chat("请帮我看看这门课程的学习大纲", {
            configurable: { thread_id: sessionThread }
        });
        console.log("\n学生: 请帮我看看这门课程的学习大纲");
        console.log("AI助手:", response1);

        // 学生提问2
        const response2 = await persistentAgent.chat("我想了解课程开始部分讲了什么内容？", {
            configurable: { thread_id: sessionThread }
        });
        console.log("\n学生: 我想了解课程开始部分讲了什么内容？");
        console.log("AI助手:", response2);

        // 学生提问3 - 测试会话记忆
        const response3 = await persistentAgent.chat("基于刚才你给我介绍的内容，我应该先学习哪个部分？", {
            configurable: { thread_id: sessionThread }
        });
        console.log("\n学生: 基于刚才你给我介绍的内容，我应该先学习哪个部分？");
        console.log("AI助手:", response3);

        // 查看学习分析
        console.log("\n📊 学习分析数据");
        const analytics = await persistentAgent.getThreadAnalytics(sessionThread);
        console.log("学习会话分析:", analytics);

        // 方式2: 使用完整配置创建
        console.log("\n🚀 方式2: 使用完整配置创建课程代理");
        
        const postgresConfig = createDefaultCoursePostgresConfig();
        postgresConfig.database = "ai_agent_chat"; // 使用现有的数据库
        
        const advancedAgent = await createCourseAgent({
            srtPath,
            courseOutline,
            plannerSystemPrompt: systemPrompt,
            threadId: "advanced_course_session",
            postgresConfig,
            enablePostgresPersistence: true
        });

        console.log("✅ 高级课程代理创建成功");

        // 演示多学生管理
        console.log("\n👥 演示多学生会话管理");
        
        const student1Thread = await advancedAgent.mapUserToThread("student_alice", undefined, {
            name: "Alice",
            course: "AI基础课程",
            progress: "第1章",
            notes: "对机器学习概念感兴趣"
        });

        const student2Thread = await advancedAgent.mapUserToThread("student_bob", undefined, {
            name: "Bob", 
            course: "AI基础课程",
            progress: "第2章",
            notes: "想了解深度学习应用"
        });

        // Alice 的学习对话
        const aliceResponse = await advancedAgent.chat("我对机器学习的基本概念还不太理解，能详细解释一下吗？", {
            configurable: { thread_id: student1Thread }
        });
        console.log("\nAlice: 我对机器学习的基本概念还不太理解，能详细解释一下吗？");
        console.log("AI助手:", aliceResponse.substring(0, 200) + "...");

        // Bob 的学习对话
        const bobResponse = await advancedAgent.chat("深度学习在实际项目中是如何应用的？", {
            configurable: { thread_id: student2Thread }
        });
        console.log("\nBob: 深度学习在实际项目中是如何应用的？");
        console.log("AI助手:", bobResponse.substring(0, 200) + "...");

        // 查看所有学生的学习记录
        const aliceThreads = await advancedAgent.getUserThreads("student_alice");
        const bobThreads = await advancedAgent.getUserThreads("student_bob");

        console.log(`\n📚 Alice 的学习会话: ${aliceThreads.length} 个`);
        aliceThreads.forEach(thread => {
            console.log(`- 会话: ${thread.threadId.substring(0, 20)}...`);
            console.log(`  学习笔记: ${thread.metadata?.notes}`);
        });

        console.log(`\n📚 Bob 的学习会话: ${bobThreads.length} 个`);
        bobThreads.forEach(thread => {
            console.log(`- 会话: ${thread.threadId.substring(0, 20)}...`);
            console.log(`  学习笔记: ${thread.metadata?.notes}`);
        });

        console.log("\n✅ 课程代理持久化演示完成！");

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

/**
 * 演示内存模式和持久化模式的对比
 */
async function compareMemoryVsPersistent() {
    console.log("\n🔄 内存模式 vs 持久化模式对比");

    const srtPath = path.join(__dirname, "../../voice/01/01.srt");
    const courseOutline = path.join(__dirname, "../../voice/01/outline.txt");
    const systemPrompt = "你是一个AI学习助手，帮助学生理解课程内容。";

    try {
        // 内存模式
        console.log("\n🧠 创建内存模式课程代理");
        const memoryAgent = await createMemoryCourseAgent(
            srtPath,
            courseOutline,
            systemPrompt,
            { threadId: "memory_test" }
        );

        // 持久化模式  
        console.log("💾 创建持久化模式课程代理");
        const persistentAgent = await createPersistentCourseAgent(
            srtPath,
            courseOutline,
            systemPrompt,
            { threadId: "persistent_test" }
        );

        console.log("✅ 两种模式的课程代理都创建成功");
        console.log("\n📋 模式对比:");
        console.log("内存模式: 快速启动，重启后丢失会话");
        console.log("持久化模式: 启动稍慢，会话永久保存");

    } catch (error) {
        console.error("❌ 对比演示失败:", error);
    }
}

// 如果直接运行此文件，执行演示
if (require.main === module) {
    (async () => {
        try {
            await demonstratePersistentCourseAgent();
            await compareMemoryVsPersistent();
        } catch (error) {
            console.error("演示失败:", error);
            process.exit(1);
        }
    })();
}

export {
    demonstratePersistentCourseAgent,
    compareMemoryVsPersistent
};