import { resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
    getLineNumberAtTimestampTool,
    readNextLinesTool,
    readPreviousLinesTool,
} from "../src/tool/srt_tools";
import {
    setSrtContextWindow,
    SRT_CONTEXT_WINDOW,
} from "../src/tool/const";

const SAMPLE_SRT_PATH = resolve(process.cwd(), "voice/01/01.srt");

let originalWindow: number;

beforeAll(() => {
    originalWindow = SRT_CONTEXT_WINDOW;
    setSrtContextWindow(2);
});

afterAll(() => {
    setSrtContextWindow(originalWindow);
});

describe("srt_tools wrappers", () => {
    it("returns JSON string from getLineNumberAtTimestampTool", async () => {
        const raw = await getLineNumberAtTimestampTool.invoke({
            filePath: SAMPLE_SRT_PATH,
            timestamp: "00:00:59,000",
        });

        expect(typeof raw).toBe("string");
        const parsed = JSON.parse(raw as string);

        expect(parsed.success).toBe(true);
        expect(parsed.lineNumber).toBe(102);
    });

    it("returns JSON string from readPreviousLinesTool", async () => {
        const raw = await readPreviousLinesTool.invoke({
            filePath: SAMPLE_SRT_PATH,
            lineNumber: 102,
        });

        const parsed = JSON.parse(raw as string);
        expect(parsed.success).toBe(true);
        expect(parsed.lines.length).toBeLessThanOrEqual(2);
    });

    it("returns JSON string from readNextLinesTool", async () => {
        const raw = await readNextLinesTool.invoke({
            filePath: SAMPLE_SRT_PATH,
            lineNumber: 102,
        });

        const parsed = JSON.parse(raw as string);
        expect(parsed.success).toBe(true);
        expect(parsed.lines.length).toBeLessThanOrEqual(2);
    });
});
