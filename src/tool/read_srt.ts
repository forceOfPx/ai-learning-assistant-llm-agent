import { readFileSync, statSync } from "node:fs";
import { SRT_CONTEXT_WINDOW, SRT_INIT_WINDOW } from "./const";

type JsonRecord = Record<string, unknown>;

const TIMESTAMP_REGEX = /^(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})/;

type SrtEntry = {
	start: number;
	end: number;
	timestampLine: number;
	entryLines: { lineNumber: number; content: string }[];
};

type SrtCacheValue = {
	version: number;
	lines: string[];
	entries: SrtEntry[];
};

const srtCache = new Map<string, SrtCacheValue>();

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
	return getSrtData(filePath).lines;
}

function extractEntries(lines: string[]): SrtEntry[] {
	const entries: SrtEntry[] = [];

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

		let entryStart = i;
		while (entryStart > 0 && lines[entryStart - 1].trim().length > 0) {
			entryStart -= 1;
		}

		const entryLines: { lineNumber: number; content: string }[] = [];
		let cursor = entryStart;

		while (cursor < lines.length && lines[cursor].trim().length > 0) {
			entryLines.push({ lineNumber: cursor + 1, content: lines[cursor] });
			cursor += 1;
		}

		entries.push({
			start,
			end,
			timestampLine: i,
			entryLines,
		});
	}

	return entries;
}

function getSrtData(filePath: string): SrtCacheValue {
	const stats = statSync(filePath);
	const version = stats.mtimeMs;
	const cached = srtCache.get(filePath);

	if (cached && cached.version === version) {
		return cached;
	}

	const content = readFileSync(filePath, "utf-8");
	const lines = content.split(/\r?\n/);
	const entries = extractEntries(lines);
	const value: SrtCacheValue = { version, lines, entries };

	srtCache.set(filePath, value);
	return value;
}

export function getLinesAtTimestamp(
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

		const { lines, entries } = getSrtData(filePath);
		let left = 0;
		let right = entries.length - 1;
		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			const entry = entries[mid];
			if (targetMs < entry.start) {
				right = mid - 1;
				continue;
			}
			if (targetMs > entry.end) {
				left = mid + 1;
				continue;
			}
			
			// 获取匹配的字幕条目的行号
			const matchedLineNumber = entry.timestampLine + 1;
			
			// 计算前后扩展的范围
			const startLineIndex = Math.max(0, matchedLineNumber - 1 - SRT_INIT_WINDOW);
			const endLineIndex = Math.min(lines.length, matchedLineNumber - 1 + SRT_INIT_WINDOW + 1);
			
			// 提取扩展范围内的内容
			const contextLines = lines.slice(startLineIndex, endLineIndex);
			
			return {
				success: true,
				startLine: startLineIndex + 1,
				endLine: endLineIndex,
				entry: entry.entryLines,
				contextLines: contextLines.join('\n'),
			};
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
