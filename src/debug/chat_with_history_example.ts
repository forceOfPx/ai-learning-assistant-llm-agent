import { ChatOpenAI } from "@langchain/openai";
import { ReactAgent } from "../agent/react_agent_base";

function createLLM() {
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

  return llm;
}

/**
 * 演示如何使用ReactAgent的chat方法进行多轮对话，
 * 并利用checkpointer维护会话历史
 */
async function demonstrateChatWithHistory() {
  const llm = createLLM();

  // 创建agent，使用默认的MemorySaver作为checkpointer
  const agent = new ReactAgent({
    llm,
    defaultThreadId: "conversation_1", // 设置默认会话ID
  });

  console.log("=== 演示1: 使用默认thread进行多轮对话 ===");
  
  // 第一轮对话
  const response1 = await agent.chat("你好，我叫张三");
  console.log("用户: 你好，我叫张三");
  console.log("AI:", response1);

  // 第二轮对话 - AI应该能记住用户的名字
  const response2 = await agent.chat("请问你还记得我的名字吗？");
  console.log("\n用户: 请问你还记得我的名字吗？");
  console.log("AI:", response2);

  console.log("\n=== 演示2: 使用不同thread进行独立对话 ===");

  // 创建新的会话线程
  const newThreadId = agent.createNewThread();
  
  // 在新线程中对话 - 不应该知道之前的信息
  const response3 = await agent.chat("你好，请问你记得我的名字吗？", {
    configurable: { thread_id: newThreadId }
  });
  console.log("用户: 你好，请问你记得我的名字吗？ (新线程)");
  console.log("AI:", response3);

  console.log("\n=== 演示3: 查看会话历史 ===");
  
  // 查看默认线程的会话历史
  const history = await agent.getConversationHistory();
  console.log("默认线程的会话历史:");
  history.forEach((msg, index) => {
    const role = msg._getType() === "human" ? "用户" : "AI";
    console.log(`${index + 1}. ${role}: ${msg.content}`);
  });
}

/**
 * 演示如何在实际应用中管理多个用户的会话
 */
async function demonstrateMultiUserChat() {
  console.log("\n\n=== 多用户会话管理演示 ===");
  
  const llm = createLLM();

  const agent = new ReactAgent({ llm });

  // 模拟用户A的会话
  const userAThread = agent.createNewThread();
  console.log("\n--- 用户A的会话 ---");
  
  const responseA1 = await agent.chat("我是Alice，我喜欢编程", {
    configurable: { thread_id: userAThread }
  });
  console.log("Alice: 我是Alice，我喜欢编程");
  console.log("AI:", responseA1);

  // 模拟用户B的会话
  const userBThread = agent.createNewThread();
  console.log("\n--- 用户B的会话 ---");
  
  const responseB1 = await agent.chat("我是Bob，我喜欢音乐", {
    configurable: { thread_id: userBThread }
  });
  console.log("Bob: 我是Bob，我喜欢音乐");
  console.log("AI:", responseB1);

  // 用户A继续对话
  console.log("\n--- 用户A继续对话 ---");
  const responseA2 = await agent.chat("你记得我的爱好吗？", {
    configurable: { thread_id: userAThread }
  });
  console.log("Alice: 你记得我的爱好吗？");
  console.log("AI:", responseA2);

  // 用户B继续对话
  console.log("\n--- 用户B继续对话 ---");
  const responseB2 = await agent.chat("你记得我的爱好吗？", {
    configurable: { thread_id: userBThread }
  });
  console.log("Bob: 你记得我的爱好吗？");
  console.log("AI:", responseB2);
}

// 如果直接运行此文件，则执行演示
if (require.main === module) {
  (async () => {
    try {
      await demonstrateChatWithHistory();
      await demonstrateMultiUserChat();
    } catch (error) {
      console.error("演示过程中发生错误:", error);
    }
  })();
}

export {
  demonstrateChatWithHistory,
  demonstrateMultiUserChat
};