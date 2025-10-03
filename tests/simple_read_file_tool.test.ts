import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import {
    readTextFileTool,
    createGetOutlineTool,
} from "../src/tool/simple_read_file_tool";

describe("readTextFileTool", () => {
    const outlinePath = resolve(process.cwd(), "voice/01/outline.txt");

    it("returns file contents for a valid path", async () => {
        const raw = await readTextFileTool.invoke({
            filePath: outlinePath,
        });

        expect(typeof raw).toBe("string");
        const result = JSON.parse(raw as string);
        expect(result.success).toBe(true);
        expect(result.content).toContain("课程大纲");
    });

    it("returns an error payload when the file is missing", async () => {
        const raw = await readTextFileTool.invoke({
            filePath: outlinePath + ".missing",
        });

        const result = JSON.parse(raw as string);
        expect(result.success).toBe(false);
        expect(result.message).toBeTypeOf("string");
    });

    it("provides the bound outline content without requiring arguments", async () => {
        const tool = createGetOutlineTool(outlinePath);
        const raw = await tool.invoke({});

        const result = JSON.parse(raw as string);
        expect(result.success).toBe(true);
        expect(result.content).toContain("课程大纲");
    });
});
