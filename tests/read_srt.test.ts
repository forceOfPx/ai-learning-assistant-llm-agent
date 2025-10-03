import { resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
  getLineNumberAtTimestamp,
  readNextLines,
  readPreviousLines,
} from "../src/tool/read_srt";
import {
  setSrtContextWindow,
  SRT_CONTEXT_WINDOW,
} from "../src/tool/const";

const SAMPLE_SRT_PATH = resolve(process.cwd(), "voice/01/01.srt");

let originalWindow: number;

beforeAll(() => {
  originalWindow = SRT_CONTEXT_WINDOW;
  setSrtContextWindow(3);
});

afterAll(() => {
  setSrtContextWindow(originalWindow);
});

describe("read_srt tools", () => {
  it("locates the line number for a given timestamp", () => {
    const result = getLineNumberAtTimestamp(SAMPLE_SRT_PATH, "00:00:59,000");

    expect(result.success).toBe(true);
    expect(result.lineNumber).toBe(102);

    const entry = result.entry as Array<{ lineNumber: number; content: string }>;
    expect(entry).toBeDefined();
    expect(entry?.some((line) => line.content.includes("我们要学群论干什么用或者是研究什么东西的"))).toBe(
      true
    );
  });

  it("locates the line number for a given timestamp 2.", () => {
    const result = getLineNumberAtTimestamp(SAMPLE_SRT_PATH, "01:06:20,980");

    expect(result.success).toBe(true);
    expect(result.lineNumber).toBe(6878);

    const entry = result.entry as Array<{ lineNumber: number; content: string }>;
    expect(entry).toBeDefined();
    expect(entry?.some((line) => line.content.includes("我每一个元素有没有逆元"))).toBe(
      true
    );
  });

  it("reads the previous context window from the target line", () => {
    const result = readPreviousLines(SAMPLE_SRT_PATH, 5645);

    expect(result.success).toBe(true);
    expect(result.firstLineNumber).toBe(5642);

    const lines = result.lines as Array<{ lineNumber: number; content: string }>;
    expect(lines.length).toBe(3);
    expect(lines[1].content).toBe("同构是说的什么呢");
    expect(lines[lines.length - 1].content).toBe("");
  });

  it("reads the next context window from the target line", () => {
    const result = readNextLines(SAMPLE_SRT_PATH, 7760);

    expect(result.success).toBe(true);
    expect(result.lastLineNumber).toBe(7763);

    const lines = result.lines as Array<{ lineNumber: number; content: string }>;
    expect(lines.length).toBe(3);
    expect(lines[1].content).toBe("01:12:35,220 --> 01:12:35,820");
    expect(lines[lines.length - 1].content).toBe("这个乘法表");
  });
});
