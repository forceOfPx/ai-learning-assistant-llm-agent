export let SRT_CONTEXT_WINDOW = 300;

export function setSrtContextWindow(value: number) {
	SRT_CONTEXT_WINDOW = Math.max(0, Math.floor(value));
}
