import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool, Client } from "pg";

/**
 * PostgreSQL 数据库配置接口
 */
export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

/**
 * PostgreSQL 持久化存储管理器
 */
export class PostgreSQLPersistentStorage {
  private pool: Pool;
  private saver: PostgresSaver | null = null;
  private connected = false;

  constructor(private config: PostgreSQLConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 10, // 最大连接数
      idleTimeoutMillis: 30000, // 空闲超时时间
      connectionTimeoutMillis: 2000, // 连接超时时间
    });
  }

  /**
   * 连接到 PostgreSQL 数据库并初始化 checkpoint saver
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // 测试连接
      const testClient = await this.pool.connect();
      console.log(`📦 已连接到 PostgreSQL 数据库: ${this.config.host}:${this.config.port}/${this.config.database}`);
      testClient.release();
      
      // 创建 PostgresSaver 实例
      this.saver = new PostgresSaver(this.pool);
      
      // 让 PostgresSaver 设置其需要的表
      await this.saver.setup();
      console.log("✅ PostgresSaver 表结构已设置");
      
      // 设置我们自定义的表
      await this.setupCustomTables();
      
      this.connected = true;
      console.log("✅ PostgreSQL checkpoint saver 初始化完成");
    } catch (error) {
      console.error("❌ PostgreSQL 连接失败:", error);
      throw error;
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.pool.end();
      this.connected = false;
      this.saver = null;
      console.log("📦 已断开 PostgreSQL 连接");
    } catch (error) {
      console.error("❌ 断开 PostgreSQL 连接时出错:", error);
      throw error;
    }
  }

  /**
   * 获取 PostgresSaver 实例
   */
  getSaver(): PostgresSaver {
    if (!this.saver || !this.connected) {
      throw new Error("PostgreSQL 未连接，请先调用 connect() 方法");
    }
    return this.saver;
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 设置自定义数据库表
   */
  private async setupCustomTables(): Promise<void> {
    try {
      console.log("🔧 正在设置自定义表结构...");
      
      // 创建自定义的表
      await this.createUserSessionMappingTable();
      await this.createConversationAnalyticsTable();
      
      console.log("✅ 自定义表结构设置完成");
    } catch (error) {
      console.error("❌ 设置自定义表结构时出错:", error);
      throw error;
    }
  }

  /**
   * 创建用户会话映射表
   */
  private async createUserSessionMappingTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_session_mapping (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        thread_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB,
        UNIQUE(user_id, thread_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_session_user_id ON user_session_mapping(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_session_thread_id ON user_session_mapping(thread_id);
      CREATE INDEX IF NOT EXISTS idx_user_session_created_at ON user_session_mapping(created_at);
    `;

    await this.pool.query(createTableQuery);
  }

  /**
   * 创建对话分析表
   */
  private async createConversationAnalyticsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS conversation_analytics (
        id SERIAL PRIMARY KEY,
        thread_id VARCHAR(255) NOT NULL,
        message_count INTEGER DEFAULT 0,
        first_message_at TIMESTAMP WITH TIME ZONE,
        last_message_at TIMESTAMP WITH TIME ZONE,
        total_tokens INTEGER DEFAULT 0,
        user_messages INTEGER DEFAULT 0,
        ai_messages INTEGER DEFAULT 0,
        session_duration_minutes INTEGER DEFAULT 0,
        UNIQUE(thread_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_conversation_analytics_thread_id ON conversation_analytics(thread_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_analytics_last_message ON conversation_analytics(last_message_at);
    `;

    await this.pool.query(createTableQuery);
  }

  /**
   * 映射用户ID到线程ID
   */
  async mapUserToThread(userId: string, threadId: string, metadata?: any): Promise<void> {
    if (!this.connected) {
      throw new Error("PostgreSQL 未连接");
    }

    const query = `
      INSERT INTO user_session_mapping (user_id, thread_id, metadata, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, thread_id) 
      DO UPDATE SET 
        updated_at = CURRENT_TIMESTAMP,
        metadata = EXCLUDED.metadata;
    `;

    await this.pool.query(query, [userId, threadId, metadata ? metadata : null]);
  }

  /**
   * 获取用户的所有会话线程
   */
  async getUserThreads(userId: string): Promise<Array<{ threadId: string; createdAt: Date; updatedAt: Date; metadata?: any }>> {
    if (!this.connected) {
      throw new Error("PostgreSQL 未连接");
    }

    const query = `
      SELECT thread_id, created_at, updated_at, metadata
      FROM user_session_mapping
      WHERE user_id = $1
      ORDER BY updated_at DESC;
    `;

    const result = await this.pool.query(query, [userId]);
    
    return result.rows.map((row: any) => ({
      threadId: row.thread_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined
    }));
  }

  /**
   * 更新对话分析数据
   */
  async updateConversationAnalytics(
    threadId: string, 
    messageCount: number,
    userMessageCount: number,
    aiMessageCount: number,
    totalTokens?: number
  ): Promise<void> {
    if (!this.connected) {
      throw new Error("PostgreSQL 未连接");
    }

    const query = `
      INSERT INTO conversation_analytics (
        thread_id, message_count, user_messages, ai_messages, 
        total_tokens, first_message_at, last_message_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (thread_id) 
      DO UPDATE SET 
        message_count = EXCLUDED.message_count,
        user_messages = EXCLUDED.user_messages,
        ai_messages = EXCLUDED.ai_messages,
        total_tokens = COALESCE(EXCLUDED.total_tokens, conversation_analytics.total_tokens),
        last_message_at = CURRENT_TIMESTAMP,
        session_duration_minutes = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - conversation_analytics.first_message_at)) / 60;
    `;

    await this.pool.query(query, [
      threadId, 
      messageCount, 
      userMessageCount, 
      aiMessageCount, 
      totalTokens || 0
    ]);
  }

  /**
   * 获取对话分析数据
   */
  async getConversationAnalytics(threadId: string): Promise<any> {
    if (!this.connected) {
      throw new Error("PostgreSQL 未连接");
    }

    const query = `
      SELECT * FROM conversation_analytics WHERE thread_id = $1;
    `;

    const result = await this.pool.query(query, [threadId]);
    return result.rows[0] || null;
  }

  /**
   * 清理过期的会话数据
   */
  async cleanupExpiredSessions(daysOld: number = 30): Promise<number> {
    if (!this.connected) {
      throw new Error("PostgreSQL 未连接");
    }

    const query = `
      DELETE FROM user_session_mapping 
      WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days';
    `;

    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }

  /**
   * 获取数据库连接池实例（用于高级操作）
   */
  getPool(): Pool {
    if (!this.connected) {
      throw new Error("PostgreSQL 未连接");
    }
    return this.pool;
  }
}

/**
 * 创建默认的 PostgreSQL 配置
 */
export function createDefaultPostgreSQLConfig(): PostgreSQLConfig {
  return {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DB || "ai_agent_chat",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "password",
    ssl: process.env.POSTGRES_SSL === "true",
  };
}

/**
 * 全局 PostgreSQL 存储实例
 */
let globalPostgreSQLStorage: PostgreSQLPersistentStorage | null = null;

/**
 * 获取或创建全局 PostgreSQL 存储实例
 */
export function getPostgreSQLStorage(config?: PostgreSQLConfig): PostgreSQLPersistentStorage {
  if (!globalPostgreSQLStorage) {
    const finalConfig = config || createDefaultPostgreSQLConfig();
    globalPostgreSQLStorage = new PostgreSQLPersistentStorage(finalConfig);
  }
  return globalPostgreSQLStorage;
}

/**
 * 重置全局 PostgreSQL 存储实例
 */
export function resetPostgreSQLStorage(): void {
  globalPostgreSQLStorage = null;
}