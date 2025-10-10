import { ChatOpenAI } from "@langchain/openai";
import { createLLM } from "../utils/create_llm";
import { MemorySaver } from "@langchain/langgraph";
import { StructuredToolInterface } from "@langchain/core/tools";
import { createSrtTools } from "../tool/srt_tools";
import { createGetOutlineTool } from "../tool/simple_read_file_tool";
import { SystemMessage } from "@langchain/core/messages";
import ReactAgent from "../agent/react_agent_base";
import { PostgreSQLPersistentStorage, PostgreSQLConfig } from "../storage/persistent_storage";


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
    /** Optional PostgreSQL configuration for persistent storage. If not provided, uses MemorySaver. */
    postgresConfig?: PostgreSQLConfig;
    /** Optional PostgreSQL storage instance. If provided, postgresConfig will be ignored. */
    postgresStorage?: PostgreSQLPersistentStorage;
    /** Enable automatic database connection and setup. Defaults to true if postgres config is provided. */
    enablePostgresPersistence?: boolean;
};

const DEFAULT_THREAD_ID = "course-agent-thread";

/**
 * 创建默认的课程代理 PostgreSQL 配置
 */
export function createDefaultCoursePostgresConfig(): PostgreSQLConfig {
    return {
        host: process.env.POSTGRES_HOST || "localhost",
        port: parseInt(process.env.POSTGRES_PORT || "5432"),
        database: process.env.POSTGRES_DB || "ai_agent_chat",
        user: process.env.POSTGRES_USER || "postgres", 
        password: process.env.POSTGRES_PASSWORD || "postgres",
        ssl: process.env.POSTGRES_SSL === "true",
    };
}

/**
 * 创建带有 PostgreSQL 持久化的课程代理（简化版）
 */
export async function createPersistentCourseAgent(
    srtPath: string,
    courseOutline: string, 
    plannerSystemPrompt: string,
    options?: {
        llm?: ChatOpenAI;
        threadId?: string;
        postgresConfig?: PostgreSQLConfig;
    }
): Promise<ReactAgent> {
    const postgresConfig = options?.postgresConfig ?? createDefaultCoursePostgresConfig();
    
    return createCourseAgent({
        srtPath,
        courseOutline,
        plannerSystemPrompt,
        llm: options?.llm,
        threadId: options?.threadId,
        postgresConfig,
        enablePostgresPersistence: true,
    });
}

/**
 * 创建仅使用内存存储的课程代理（简化版）
 */
export function createMemoryCourseAgent(
    srtPath: string,
    courseOutline: string,
    plannerSystemPrompt: string,
    options?: {
        llm?: ChatOpenAI;
        threadId?: string;
    }
): Promise<ReactAgent> {
    return createCourseAgent({
        srtPath,
        courseOutline,
        plannerSystemPrompt,
        llm: options?.llm,
        threadId: options?.threadId,
        enablePostgresPersistence: false,
    });
}

async function createCourseAgent(options: CourseAgentOptions): Promise<ReactAgent> {
    const { srtPath, courseOutline, postgresConfig, postgresStorage, enablePostgresPersistence = true } = options;
    
    if (!srtPath || !courseOutline) {
        throw new Error("srtPath or courseOutline must be provided to createCourseAgent.");
    }

    const llm = options.llm ?? createLLM();
    const threadId = options.threadId ?? DEFAULT_THREAD_ID;
    
    // 设置持久化存储
    let storage: PostgreSQLPersistentStorage | undefined;
    let checkpointer;

    if (postgresStorage) {
        // 使用提供的 PostgreSQL 存储实例
        storage = postgresStorage;
        if (enablePostgresPersistence && !storage.isConnected()) {
            await storage.connect();
        }
        checkpointer = storage.getSaver();
    } else if (postgresConfig && enablePostgresPersistence) {
        // 创建新的 PostgreSQL 存储实例
        storage = new PostgreSQLPersistentStorage(postgresConfig);
        await storage.connect();
        checkpointer = storage.getSaver();
    } else {
        // 使用内存存储
        checkpointer = new MemorySaver();
        console.log("🧠 Course Agent 使用内存存储（会话将不会持久化）");
    }

    // 创建工具
    const tools: StructuredToolInterface[] = [...createSrtTools(srtPath)];
    tools.push(createGetOutlineTool(courseOutline));

    const prompt = new SystemMessage(options.plannerSystemPrompt);

    return new ReactAgent({
        llm,
        prompt,
        tools,
        checkpointSaver: checkpointer,
        checkpointer,
        defaultThreadId: threadId,
        postgresStorage: storage,
    });
}