import { HumanMessage } from "@langchain/core/messages";
import type { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent, type CreateReactAgentParams } from "@langchain/langgraph/prebuilt";

/**
 * Configuration required to instantiate a LangGraph React agent without tools.
 */
export type ReactAgentOptions = {
  /**
   * Chat model instance compatible with OpenAI-style tool calling.
   */
  llm: LanguageModelLike;
  /**
   * Optional system prompt or runnable used to prime the agent before it plans.
   */
  prompt?: CreateReactAgentParams["prompt"];
  /**
   * Optional set of tools to expose. Defaults to none.
   */
  tools?: CreateReactAgentParams["tools"];
  /**
   * Checkpoint saver instance controlling how long-term memory is stored. Defaults to {@link MemorySaver}.
   */
  checkpointSaver?: CreateReactAgentParams["checkpointSaver"];
  /**
   * Optional alias for {@link checkpointSaver}. If omitted, falls back to the resolved checkpoint saver.
   */
  checkpointer?: CreateReactAgentParams["checkpointer"];
  /**
   * Optional shared store used when persisting memory across threads or processes.
   */
  store?: CreateReactAgentParams["store"];
  /**
   * Default thread identifier applied to invocations when one is not provided explicitly.
   */
  defaultThreadId?: string;
};

type ReactAgentGraph = ReturnType<typeof createReactAgent>;
type InvokeOptions = Parameters<ReactAgentGraph["invoke"]>[1];
type StreamOptions = Parameters<ReactAgentGraph["stream"]>[1];
type InvokeReturn = Awaited<ReturnType<ReactAgentGraph["invoke"]>>;

/**
 * Alias for the state shape produced by LangGraph's prebuilt React agent.
 */
export type ReactAgentState = InvokeReturn;

/**
 * Thin wrapper around LangGraph's prebuilt React agent that disables tool usage.
 */
export class ReactAgent {
  private readonly graph: ReactAgentGraph;
  private readonly defaultThreadId?: string;

  constructor(options: ReactAgentOptions) {
    const {
      llm,
      prompt,
      tools,
      checkpointSaver,
      checkpointer,
      store,
      defaultThreadId,
    } = options;

    const resolvedSaver = checkpointSaver ?? checkpointer ?? new MemorySaver();

    this.graph = createReactAgent({
      llm,
      tools: tools ?? [],
      prompt,
      checkpointSaver: checkpointSaver ?? resolvedSaver,
      checkpointer: checkpointer ?? resolvedSaver,
      store,
    });

    this.defaultThreadId = defaultThreadId;
  }

  /**
   * Executes the agent end-to-end and returns the final LangGraph state.
   */
  async invoke(
    messages: BaseMessageLike[],
    options?: InvokeOptions
  ): Promise<ReactAgentState> {
    return this.graph.invoke(
      { messages },
      this.applyThreadConfig(options) as InvokeOptions
    );
  }

  /**
   * Streams intermediate state updates emitted while the agent reasons.
   */
  stream(messages: BaseMessageLike[], options?: StreamOptions) {
    const mergedOptions = {
      ...(options ?? {}),
      streamMode: options?.streamMode ?? "values",
    } as StreamOptions | undefined;

    return this.graph.stream(
      { messages },
      this.applyThreadConfig(mergedOptions) as StreamOptions
    );
  }

  /**
   * Helper that runs the agent and extracts the last AI message as plain text.
   */
  async runToText(
    messages: BaseMessageLike[],
    options?: InvokeOptions
  ): Promise<string> {
    const state = await this.invoke(messages, options);
    const last = state.messages[state.messages.length - 1];
    return last ? messageContentToString(last) : "";
  }

  /**
   * Convenience helper that sends a single user input to the agent and
   * returns the model's textual reply.
   */
  async chat(userInput: string, options?: InvokeOptions): Promise<string> {
    const responseState = await this.invoke([
      new HumanMessage(userInput),
    ], options);

    const aiMessage = responseState.messages.at(-1);
    return aiMessage ? messageContentToString(aiMessage) : "";
  }

  private applyThreadConfig(options?: Record<string, any>) {
    if (!this.defaultThreadId) {
      return options;
    }

    const baseOptions = options ?? {};
    const merged = {
      ...baseOptions,
      configurable: {
        ...(baseOptions.configurable ?? {}),
        thread_id:
          baseOptions.configurable?.thread_id ?? this.defaultThreadId,
      },
    };

    return merged;
  }
}

function messageContentToString(message: BaseMessage): string {
  const { content } = message;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk === "string") {
          return chunk;
        }
        if (chunk && typeof chunk === "object") {
          if ("text" in chunk && typeof chunk.text === "string") {
            return chunk.text;
          }
          if ("value" in chunk && typeof chunk.value === "string") {
            return chunk.value;
          }
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

export default ReactAgent;
