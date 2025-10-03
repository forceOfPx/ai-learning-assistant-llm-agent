import { readFileSync } from "node:fs";
import { SRT_CONTEXT_WINDOW } from "./const";

type JsonRecord = Record<string, unknown>;

const TIMESTAMP_REGEX = /^(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})/;

function parseTimestamp(value: string): number | null {
	const match = value.match(
		/^(?<hh>\d{2}):(?<mm>\d{2}):(?<ss>\d{2}),(?<ms>\d{3})$/
	);

	if (!match || !match.groups) {
		return null;
	}

	const hours = Number(match.groups.hh);
	const minutes = Number(match.groups.mm);
	const seconds = Number(match.groups.ss);
	const milliseconds = Number(match.groups.ms);

	return (
		hours * 60 * 60 * 1000 +
		minutes * 60 * 1000 +
		seconds * 1000 +
		milliseconds
	);
}

function loadSrtLines(filePath: string): string[] {
	const content = readFileSync(filePath, "utf-8");
	return content.split(/\r?\n/);
}

// todo: getLineNumberAtTimestamp 应该用二分查找
export function getLineNumberAtTimestamp(
	filePath: string,
	timestamp: string
): JsonRecord {
	try {
		const targetMs = parseTimestamp(timestamp);
		if (targetMs === null) {
			return {
				success: false,
				message: "Invalid timestamp format. Expected HH:MM:SS,mmm.",
			};
		}

		const lines = loadSrtLines(filePath);
		for (let i = 0; i < lines.length; i += 1) {
			const match = lines[i].match(TIMESTAMP_REGEX);
			if (!match) {
				continue;
			}
 
			const start = parseTimestamp(match[1]);
			const end = parseTimestamp(match[2]);
			if (start === null || end === null) {
				continue;
			}

			if (targetMs >= start && targetMs <= end) {
				const entryLines: { lineNumber: number; content: string }[] = [];
				let cursor = i - 1;

				while (cursor >= 0 && lines[cursor].trim().length > 0) {
					cursor -= 1;
				}
				cursor += 1;

				while (cursor < lines.length && lines[cursor].trim().length > 0) {
					entryLines.push({ lineNumber: cursor + 1, content: lines[cursor] });
					cursor += 1;
				}

				const response: JsonRecord = {
					success: true,
					lineNumber: i + 1,
					entry: entryLines,
				};
				return response;
			}
		}

		return {
			success: false,
			message: "No subtitle entry matches the provided timestamp.",
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : String(error),
		};
	}
}

export function readPreviousLines(
	filePath: string,
	lineNumber: number
): JsonRecord {
	try {
		if (lineNumber <= 1) {
			return {
				success: true,
				lines: [],
				firstLineNumber: null,
				note: "Requested line is at the start of the file.",
			};
		}

		const lines = loadSrtLines(filePath);
		const startIndex = Math.max(0, lineNumber - 1 - SRT_CONTEXT_WINDOW);
		const endIndex = Math.max(0, lineNumber - 1);

		const slice = lines.slice(startIndex, endIndex);
		return {
			success: true,
			firstLineNumber: slice.length > 0 ? startIndex + 1 : null,
			lines: slice.map((content, index) => ({
				lineNumber: startIndex + index + 1,
				content,
			})),
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : String(error),
		};
	}
}

export function readNextLines(
	filePath: string,
	lineNumber: number
): JsonRecord {
	try {
		const lines = loadSrtLines(filePath);
		if (lineNumber >= lines.length) {
			return {
				success: true,
				lines: [],
				lastLineNumber: null,
				note: "Requested line is at or beyond the end of the file.",
			};
		}

		const startIndex = Math.max(0, lineNumber);
		const endIndex = Math.min(lines.length, startIndex + SRT_CONTEXT_WINDOW);
		const slice = lines.slice(startIndex, endIndex);

		return {
			success: true,
			lastLineNumber: slice.length > 0 ? startIndex + slice.length : null,
			lines: slice.map((content, index) => ({
				lineNumber: startIndex + index + 1,
				content,
			})),
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : String(error),
		};
	}
}
