import { ChatOpenAI } from "@langchain/openai";
import { ReactAgent } from "../agent/react_agent_base";
import { PostgreSQLPersistentStorage, createDefaultPostgreSQLConfig } from "../storage/persistent_storage";
import * as fs from "fs";
import * as path from "path";

/**
 * 加载环境变量（从 .env 文件或环境变量）
 */
function loadEnvironmentVariables() {
  // 尝试加载 .env 文件
  const envPath = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = envContent.split('\n').filter(line => {
      return line.trim() && !line.trim().startsWith('#') && line.includes('=');
    });
    
    envVars.forEach(line => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    });
    
    console.log("📄 已加载 .env 文件");
  } else {
    console.log("📄 未找到 .env 文件，使用系统环境变量");
  }
}

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
 * 测试 PostgreSQL 基础连接
 */
async function testPostgreSQLConnection(config: any) {
  console.log("🔍 测试 PostgreSQL 基础连接...");
  
  const { Pool } = require('pg');
  const testPool = new Pool({
    host: config.host,
    port: config.port,
    database: 'postgres', // 连接到默认数据库测试连接
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await testPool.connect();
    const result = await client.query('SELECT version()');
    console.log("✅ PostgreSQL 连接测试成功");
    console.log(`📋 PostgreSQL 版本: ${result.rows[0].version.split(',')[0]}`);
    client.release();
    return true;
  } catch (error) {
    console.error("❌ PostgreSQL 连接测试失败:", error);
    return false;
  } finally {
    await testPool.end();
  }
}

/**
 * 确保数据库存在
 */
async function ensureDatabaseExists(config: any) {
  console.log("🔍 检查数据库是否存在...");
  
  // 创建连接到默认数据库（通常是 postgres）
  const { Pool } = require('pg');
  const adminPool = new Pool({
    host: config.host,
    port: config.port,
    database: 'postgres', // 连接到默认数据库
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    // 检查目标数据库是否存在
    const result = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.database]
    );

    if (result.rows.length === 0) {
      console.log(`📦 数据库 "${config.database}" 不存在，正在创建...`);
      
      // 创建数据库（注意：数据库名不能用参数化查询）
      await adminPool.query(`CREATE DATABASE "${config.database}"`);
      console.log(`✅ 数据库 "${config.database}" 创建成功`);
    } else {
      console.log(`✅ 数据库 "${config.database}" 已存在`);
    }
  } finally {
    await adminPool.end();
  }
}

/**
 * PostgreSQL 持久化 ReactAgent 使用示例
 */
async function demonstratePostgreSQLPersistence() {
  console.log("🚀 开始 PostgreSQL 持久化演示");

  // 1. 创建 PostgreSQL 存储实例
  const postgresConfig = createDefaultPostgreSQLConfig();
  console.log("📋 PostgreSQL 配置:", {
    host: postgresConfig.host,
    port: postgresConfig.port,
    database: postgresConfig.database,
    user: postgresConfig.user
  });

  // 1.5. 测试基础连接
  const connectionOk = await testPostgreSQLConnection(postgresConfig);
  if (!connectionOk) {
    throw new Error("PostgreSQL 基础连接失败，请检查服务和配置");
  }

  // 1.6. 确保数据库存在
  await ensureDatabaseExists(postgresConfig);

  const postgresStorage = new PostgreSQLPersistentStorage(postgresConfig);

  try {
    // 2. 连接到数据库
    console.log("🔌 连接到 PostgreSQL...");
    await postgresStorage.connect();

    // 3. 创建 LLM
    const llm = createLLM();

    // 4. 创建使用 PostgreSQL 持久化的 ReactAgent
    const agent = new ReactAgent({
      llm,
      postgresStorage,
      defaultThreadId: "demo_postgresql_thread"
    });

    console.log("✅ ReactAgent 已创建，使用 PostgreSQL 持久化存储");

    // 5. 演示用户会话管理
    console.log("\n👤 演示用户会话管理");

    const userId1 = "user_alice";
    const userId2 = "user_bob";

    // 为用户创建会话线程
    const aliceThreadId = await agent.mapUserToThread(userId1, undefined, {
      name: "Alice",
      preferences: { language: "zh-CN" }
    });
    console.log(`Alice 的会话线程: ${aliceThreadId}`);

    const bobThreadId = await agent.mapUserToThread(userId2, undefined, {
      name: "Bob", 
      preferences: { language: "en-US" }
    });
    console.log(`Bob 的会话线程: ${bobThreadId}`);

    // 6. 演示持久化对话
    console.log("\n💬 演示持久化对话");

    // Alice 的对话
    console.log("\n--- Alice 的对话 ---");
    const aliceResponse1 = await agent.chat("你好，我是Alice，我喜欢编程", {
      configurable: { thread_id: aliceThreadId }
    });
    console.log("Alice: 你好，我是Alice，我喜欢编程");
    console.log("AI:", aliceResponse1);

    const aliceResponse2 = await agent.chat("你记得我刚才说什么了吗？", {
      configurable: { thread_id: aliceThreadId }
    });
    console.log("\nAlice: 你记得我刚才说什么了吗？");
    console.log("AI:", aliceResponse2);

    // Bob 的对话
    console.log("\n--- Bob 的对话 ---");
    const bobResponse1 = await agent.chat("Hello, I'm Bob and I love music", {
      configurable: { thread_id: bobThreadId }
    });
    console.log("Bob: Hello, I'm Bob and I love music");
    console.log("AI:", bobResponse1);

    const bobResponse2 = await agent.chat("Do you remember what I just told you?", {
      configurable: { thread_id: bobThreadId }
    });
    console.log("\nBob: Do you remember what I just told you?");
    console.log("AI:", bobResponse2);

    // 7. 查看用户的会话历史
    console.log("\n📊 查看用户会话历史");

    const aliceThreads = await agent.getUserThreads(userId1);
    console.log(`Alice 的会话线程数量: ${aliceThreads.length}`);
    aliceThreads.forEach(thread => {
      console.log(`- 线程ID: ${thread.threadId}`);
      console.log(`  创建时间: ${thread.createdAt}`);
      console.log(`  更新时间: ${thread.updatedAt}`);
      console.log(`  元数据:`, thread.metadata);
    });

    const bobThreads = await agent.getUserThreads(userId2);
    console.log(`\nBob 的会话线程数量: ${bobThreads.length}`);
    bobThreads.forEach(thread => {
      console.log(`- 线程ID: ${thread.threadId}`);
      console.log(`  创建时间: ${thread.createdAt}`);
      console.log(`  更新时间: ${thread.updatedAt}`);
      console.log(`  元数据:`, thread.metadata);
    });

    // 8. 查看对话分析数据
    console.log("\n📈 查看对话分析数据");

    const aliceAnalytics = await agent.getThreadAnalytics(aliceThreadId);
    console.log("Alice 的对话分析:", aliceAnalytics);

    const bobAnalytics = await agent.getThreadAnalytics(bobThreadId);
    console.log("Bob 的对话分析:", bobAnalytics);

    // 9. 演示会话恢复（模拟应用重启）
    console.log("\n🔄 演示会话恢复");

    // 创建新的 agent 实例（模拟应用重启）
    const newAgent = new ReactAgent({
      llm,
      postgresStorage,
    });

    // Alice 继续之前的对话
    const aliceResponse3 = await newAgent.chat("我想学习更多关于数据结构的知识", {
      configurable: { thread_id: aliceThreadId }
    });
    console.log("Alice（重启后）: 我想学习更多关于数据结构的知识");
    console.log("AI:", aliceResponse3);

    console.log("\n✅ PostgreSQL 持久化演示完成！");

  } catch (error) {
    console.error("❌ 演示过程中发生错误:", error);

    // 提供详细的解决方案提示
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('connect econnrefused') || errorMsg.includes('econnrefused')) {
        console.log("\n💡 PostgreSQL 连接被拒绝 - 解决方案:");
        console.log("1. 确保 PostgreSQL 服务正在运行");
        console.log("   - Windows: 检查服务管理器中的 PostgreSQL 服务");
        console.log("   - Linux/Mac: sudo systemctl status postgresql");
        console.log("2. 检查 PostgreSQL 是否监听正确的端口（默认5432）");
        console.log("3. 检查防火墙设置");
        
      } else if (errorMsg.includes('authentication failed') || errorMsg.includes('password')) {
        console.log("\n💡 PostgreSQL 认证失败 - 解决方案:");
        console.log("1. 检查用户名和密码是否正确");
        console.log("2. 确保用户有连接数据库的权限");
        console.log("3. 检查 pg_hba.conf 文件配置");
        
      } else if (errorMsg.includes('database') && errorMsg.includes('does not exist')) {
        console.log("\n💡 数据库不存在 - 解决方案:");
        console.log("1. 数据库创建可能失败，检查用户权限");
        console.log("2. 手动创建数据库: CREATE DATABASE ai_agent_chat;");
        
      } else if (errorMsg.includes('role') && errorMsg.includes('does not exist')) {
        console.log("\n💡 用户角色不存在 - 解决方案:");
        console.log("1. 创建 PostgreSQL 用户:");
        console.log("   CREATE USER postgres WITH PASSWORD 'your_password';");
        console.log("2. 授予权限:");
        console.log("   ALTER USER postgres CREATEDB;");
        
      } else {
        console.log("\n💡 通用解决方案:");
        console.log("1. 检查 PostgreSQL 服务状态");
        console.log("2. 验证连接配置");
        console.log("3. 检查网络连接");
        console.log("4. 查看 PostgreSQL 日志文件");
      }
      
      console.log("\n🔧 快速诊断命令:");
      console.log("psql -h localhost -p 5432 -U postgres -d postgres");
    }
  } finally {
    // 清理资源
    try {
      await postgresStorage.disconnect();
      console.log("🧹 已清理数据库连接");
    } catch (error) {
      console.warn("⚠️ 清理数据库连接时出错:", error);
    }
  }
}

/**
 * 数据库设置演示
 */
async function demonstrateDatabaseSetup() {
  console.log("\n🛠️ 数据库设置演示");

  const postgresConfig = createDefaultPostgreSQLConfig();
  
  // 确保数据库存在
  await ensureDatabaseExists(postgresConfig);
  
  const postgresStorage = new PostgreSQLPersistentStorage(postgresConfig);

  try {
    await postgresStorage.connect();
    console.log("✅ 数据库连接成功");

    // 演示清理操作
    console.log("🧹 清理 30 天前的过期会话...");
    const cleanedCount = await postgresStorage.cleanupExpiredSessions(30);
    console.log(`清理了 ${cleanedCount} 个过期会话`);

    console.log("✅ 数据库设置完成");

  } catch (error) {
    console.error("❌ 数据库设置失败:", error);
  } finally {
    await postgresStorage.disconnect();
  }
}

/**
 * 检查和设置环境变量
 */
function checkAndSetupEnvironment() {
  console.log("\n🔍 检查环境变量配置...");
  
  // 检查 PostgreSQL 配置
  const postgresConfig = {
    host: process.env.POSTGRES_HOST || "localhost",
    port: process.env.POSTGRES_PORT || "5432", 
    database: process.env.POSTGRES_DB || "ai_agent_chat",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "password",
    ssl: process.env.POSTGRES_SSL === "true"
  };

  // 检查 DeepSeek API 配置
  const deepseekConfig = {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com"
  };

  console.log("📋 当前环境配置:");
  console.log("PostgreSQL:");
  console.log(`  ✓ Host: ${postgresConfig.host}`);
  console.log(`  ✓ Port: ${postgresConfig.port}`);  
  console.log(`  ✓ Database: ${postgresConfig.database}`);
  console.log(`  ✓ User: ${postgresConfig.user}`);
  console.log(`  ${postgresConfig.password === "password" ? "⚠️" : "✓"} Password: ${postgresConfig.password === "password" ? "使用默认密码" : "已设置"}`);
  console.log(`  ✓ SSL: ${postgresConfig.ssl}`);
  
  console.log("DeepSeek API:");
  console.log(`  ${deepseekConfig.apiKey ? "✓" : "❌"} API Key: ${deepseekConfig.apiKey ? "已设置" : "未设置"}`);
  console.log(`  ✓ Base URL: ${deepseekConfig.baseURL}`);

  // 检查缺失的关键配置
  const missingConfig = [];
  if (!deepseekConfig.apiKey) {
    missingConfig.push("DEEPSEEK_API_KEY");
  }
  if (postgresConfig.password === "password") {
    console.log("\n⚠️  警告: 使用默认PostgreSQL密码，建议在生产环境中修改");
  }

  if (missingConfig.length > 0) {
    console.log("\n❌ 缺失的必需配置:");
    missingConfig.forEach(config => {
      console.log(`  - ${config}`);
    });

    return false;
  }

  console.log("\n✅ 环境配置检查通过");
  return true;
}

// 如果直接运行此文件，执行演示
if (require.main === module) {
  (async () => {
    // 首先检查环境配置
    const envOk = checkAndSetupEnvironment();
    
    if (!envOk) {
      console.log("\n❌ 环境配置不完整，请设置必需的环境变量后重试");
      process.exit(1);
    }
    
    console.log("\n🚀 开始演示:");
    console.log("1. 完整的 PostgreSQL 持久化演示");
    console.log("2. 仅数据库设置演示");
    
    // 这里可以添加命令行参数处理，暂时直接运行完整演示
    try {
      await demonstratePostgreSQLPersistence();
    } catch (error) {
      console.error("演示失败:", error);
      console.log("\n💡 如果是首次运行，请先运行数据库设置演示");
      await demonstrateDatabaseSetup();
    }
  })();
}

export {
  demonstratePostgreSQLPersistence,
  demonstrateDatabaseSetup,
  checkAndSetupEnvironment,
  testPostgreSQLConnection,
  ensureDatabaseExists
};