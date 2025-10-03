import { resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
    createGetLineNumberAtTimestampTool,
    createReadNextLinesTool,
    createReadPreviousLinesTool,
} from "../src/tool/srt_tools";
import {
    setSrtContextWindow,
    SRT_CONTEXT_WINDOW,
} from "../src/tool/const";

const SAMPLE_SRT_PATH = resolve(process.cwd(), "voice/01/01.srt");

let originalWindow: number;
const tools = {
    getLineNumberAtTimestamp: null as ReturnType<typeof createGetLineNumberAtTimestampTool> | null,
    readPreviousLines: null as ReturnType<typeof createReadPreviousLinesTool> | null,
    readNextLines: null as ReturnType<typeof createReadNextLinesTool> | null,
};

beforeAll(() => {
    originalWindow = SRT_CONTEXT_WINDOW;
    setSrtContextWindow(2);
    tools.getLineNumberAtTimestamp = createGetLineNumberAtTimestampTool(SAMPLE_SRT_PATH);
    tools.readPreviousLines = createReadPreviousLinesTool(SAMPLE_SRT_PATH);
    tools.readNextLines = createReadNextLinesTool(SAMPLE_SRT_PATH);
});

afterAll(() => {
    setSrtContextWindow(originalWindow);
});

describe("srt_tools wrappers", () => {
    it("returns JSON string from getLineNumberAtTimestampTool", async () => {
        const raw = await tools.getLineNumberAtTimestamp!.invoke({
            timestamp: "00:00:59,000",
        });

        expect(typeof raw).toBe("string");
        const parsed = JSON.parse(raw as string);

        expect(parsed.success).toBe(true);
        expect(parsed.lineNumber).toBe(102);
    });

    it("returns JSON string from readPreviousLinesTool", async () => {
        const raw = await tools.readPreviousLines!.invoke({
            lineNumber: 102,
        });

        const parsed = JSON.parse(raw as string);
        expect(parsed.success).toBe(true);
        expect(parsed.lines.length).toBeLessThanOrEqual(2);
    });

    it("returns JSON string from readNextLinesTool", async () => {
        const raw = await tools.readNextLines!.invoke({
            lineNumber: 102,
        });

        const parsed = JSON.parse(raw as string);
        expect(parsed.success).toBe(true);
        expect(parsed.lines.length).toBeLessThanOrEqual(2);
    });
});
