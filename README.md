# 功能实现
1. 基础的re-act模型
2. 读取课程大纲和字幕，来判断当前教学课程内容
3. postgresql持久化存储，目前mock了一下接口，后续接入到后端

# 使用方式
src/domain/course_agent_v2.ts

具体样例参考src/debug/course_agent_persistence_example.ts，具体运行如下：
```Typescript
        // Alice 的学习对话
        const aliceResponse = await persistAgent.chat("我是Alice, 我对群论的基本概念还不太理解，能详细解释一下吗？", {
            configurable: { thread_id: student1Thread }
        });
        console.log("\nAlice: 我对群论的基本概念还不太理解，能详细解释一下吗？");
        console.log("AI助手:", aliceResponse.substring(0, 400) + "...");
        // output
        // Alice: 我对群论的基本概念还不太理解，能详细解释一下吗？
        // AI助手: 你好Alice！很高兴能帮助你理解群论的基本概念。让我根据课程大纲为你详细解释群论的核心内容。 ....
        
        // 这里重新构建一个agent实例，
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
        // output 
        // Alice: 我目前处在 00:34:16,000 请详细解释一下“冗余自由度的消除
        // AI助手: Alice，让我根据课程内容为你详细解释"冗余自由度的消除"这个概念。

        // ## 🔍 冗余自由度的消除
```