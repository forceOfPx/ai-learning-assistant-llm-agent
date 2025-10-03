import { tool } from "@langchain/core/tools";
import type { JSONSchema } from "@langchain/core/utils/json_schema";

import {
	getLineNumberAtTimestamp,
	readNextLines,
	readPreviousLines,
} from "./read_srt";

const jsonStringify = (value: unknown): string => JSON.stringify(value);

const filePathSchema = {
	type: "string",
	description: "Absolute or relative path of the SRT file.",
} as const satisfies JSONSchema;

const timestampSchema = {
	type: "string",
	description: "Timestamp formatted as HH:MM:SS,mmm to look up within the subtitle.",
	pattern: "^\\d{2}:\\d{2}:\\d{2},\\d{3}$",
} as const satisfies JSONSchema;

const positiveIntegerSchema = {
	type: "integer",
	minimum: 1,
} as const satisfies JSONSchema;

const getLineNumberAtTimestampSchema = {
	type: "object",
	additionalProperties: false,
	required: ["filePath", "timestamp"],
	properties: {
		filePath: filePathSchema,
		timestamp: timestampSchema,
	},
} as const satisfies JSONSchema;

const readLinesSchema = {
	type: "object",
	additionalProperties: false,
	required: ["filePath", "lineNumber"],
	properties: {
		filePath: filePathSchema,
		lineNumber: {
			...positiveIntegerSchema,
			description: "1-based line number used as the reference point.",
		},
	},
} as const satisfies JSONSchema;

type GetLineNumberAtTimestampArgs = {
	filePath: string;
	timestamp: string;
};

type ReadLinesArgs = {
	filePath: string;
	lineNumber: number;
};

export const getLineNumberAtTimestampTool = tool(
	async (input) => {
		const { filePath, timestamp } =
			input as GetLineNumberAtTimestampArgs;
		return jsonStringify(getLineNumberAtTimestamp(filePath, timestamp));
	},
	{
		name: "get_line_number_at_timestamp",
		description:
			"Given an SRT file path and a timestamp (HH:MM:SS,mmm), return the matching subtitle entry and line number as JSON.",
		schema: getLineNumberAtTimestampSchema,
	}
);

export const readPreviousLinesTool = tool(
	async (input) => {
		const { filePath, lineNumber } = input as ReadLinesArgs;
		return jsonStringify(readPreviousLines(filePath, lineNumber));
	},
	{
		name: "read_previous_srt_lines",
		description:
			"Read the configured number of lines before a given SRT line number and return them as JSON.",
		schema: readLinesSchema,
	}
);

export const readNextLinesTool = tool(
	async (input) => {
		const { filePath, lineNumber } = input as ReadLinesArgs;
		return jsonStringify(readNextLines(filePath, lineNumber));
	},
	{
		name: "read_next_srt_lines",
		description:
			"Read the configured number of lines after a given SRT line number and return them as JSON.",
		schema: readLinesSchema,
	}
);
