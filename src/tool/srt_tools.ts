import { tool } from "@langchain/core/tools";
import type { JSONSchema } from "@langchain/core/utils/json_schema";

import {
	getLineNumberAtTimestamp,
	readNextLines,
	readPreviousLines,
} from "./read_srt";

const jsonStringify = (value: unknown): string => JSON.stringify(value);

const timestampSchema = {
	type: "string",
	description: "Timestamp formatted as HH:MM:SS,mmm to look up within the subtitle.",
	pattern: "^\\d{2}:\\d{2}:\\d{2},\\d{3}$",
} as const satisfies JSONSchema;

const positiveIntegerSchema = {
	type: "integer",
	minimum: 1,
	description: "1-based line number used as the reference point.",
} as const satisfies JSONSchema;

const getLineNumberAtTimestampSchema = {
	type: "object",
	additionalProperties: false,
	required: ["timestamp"],
	properties: {
		timestamp: timestampSchema,
	},
} as const satisfies JSONSchema;

const readLinesSchema = {
	type: "object",
	additionalProperties: false,
	required: ["lineNumber"],
	properties: {
		lineNumber: positiveIntegerSchema,
	},
} as const satisfies JSONSchema;

type GetLineNumberAtTimestampArgs = {
	timestamp: string;
};

type ReadLinesArgs = {
	lineNumber: number;
};

function ensureFilePath(filePath: string) {
	if (!filePath) {
		throw new Error("SRT file path must be provided when creating the tool.");
	}
	return filePath;
}

export function createGetLineNumberAtTimestampTool(filePath: string) {
	const boundPath = ensureFilePath(filePath);
	return tool(
		async (input) => {
			const { timestamp } = input as GetLineNumberAtTimestampArgs;
			console.log(
				"[tool:get_line_number_at_timestamp]",
				JSON.stringify({ filePath: boundPath, timestamp })
			);
			return jsonStringify(
				getLineNumberAtTimestamp(boundPath, timestamp)
			);
		},
		{
			name: "get_line_number_at_timestamp",
			description:
				"Given a timestamp (HH:MM:SS,mmm), return the matching subtitle entry and line number as JSON.",
			schema: getLineNumberAtTimestampSchema,
		}
	);
}

export function createReadPreviousLinesTool(filePath: string) {
	const boundPath = ensureFilePath(filePath);
	return tool(
		async (input) => {
			const { lineNumber } = input as ReadLinesArgs;
			console.log(
				"[tool:read_previous_srt_lines]",
				JSON.stringify({ filePath: boundPath, lineNumber })
			);
			return jsonStringify(readPreviousLines(boundPath, lineNumber));
		},
		{
			name: "read_previous_srt_lines",
			description:
				"Read the configured number of lines before a given SRT line number and return them as JSON.",
			schema: readLinesSchema,
		}
	);
}

export function createReadNextLinesTool(filePath: string) {
	const boundPath = ensureFilePath(filePath);
	return tool(
		async (input) => {
			const { lineNumber } = input as ReadLinesArgs;
			console.log(
				"[tool:read_next_srt_lines]",
				JSON.stringify({ filePath: boundPath, lineNumber })
			);
			return jsonStringify(readNextLines(boundPath, lineNumber));
		},
		{
			name: "read_next_srt_lines",
			description:
				"Read the configured number of lines after a given SRT line number and return them as JSON.",
			schema: readLinesSchema,
		}
	);
}

export function createSrtTools(filePath: string) {
	return [
		createGetLineNumberAtTimestampTool(filePath),
		createReadPreviousLinesTool(filePath),
		createReadNextLinesTool(filePath),
	];
}
