import { readFileSync } from "node:fs";

import { tool } from "@langchain/core/tools";
import type { JSONSchema } from "@langchain/core/utils/json_schema";

const jsonStringify = (value: unknown): string => JSON.stringify(value);

const filePathSchema = {
	type: "string",
	description: "Absolute or relative path of the text file to read.",
} as const satisfies JSONSchema;

const readTextFileSchema = {
	type: "object",
	additionalProperties: false,
	required: ["filePath"],
	properties: {
		filePath: filePathSchema,
	},
} as const satisfies JSONSchema;

const emptyObjectSchema = {
	type: "object",
	additionalProperties: false,
	properties: {},
} as const satisfies JSONSchema;

type ReadTextFileArgs = {
	filePath: string;
};

type NoArgs = Record<string, never>;

function readTextFilePayload(filePath: string) {
	try {
		const content = readFileSync(filePath, "utf-8");
		return { success: true as const, content };
	} catch (error) {
		return {
			success: false as const,
			message: error instanceof Error ? error.message : String(error),
		};
	}
}

export const readTextFileTool = tool(
	async (input) => {
		const { filePath } = input as ReadTextFileArgs;
		console.log("[tool:read_text_file]", JSON.stringify({ filePath }));
		return jsonStringify(readTextFilePayload(filePath));
	},
	{
		name: "read_text_file",
		description: "Read the entire contents of a UTF-8 text file and return it as JSON.",
		schema: readTextFileSchema,
	}
);

export function createGetOutlineTool(filePath: string) {
	return tool(
		async (input: unknown) => {
			void (input as NoArgs);
			console.log(
				"[tool:get_course_outline]",
				JSON.stringify({ filePath })
			);
			return jsonStringify(readTextFilePayload(filePath));
		},
		{
			name: "get_course_outline",
			description: "Return the full text of the configured course outline file.",
			schema: emptyObjectSchema,
		}
	);
}
