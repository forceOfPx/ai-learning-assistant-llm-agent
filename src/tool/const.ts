export let SRT_CONTEXT_WINDOW = 300;

export function setSrtContextWindow(value: number) {
	SRT_CONTEXT_WINDOW = Math.max(0, Math.floor(value));
}

export let SRT_INIT_WINDOW = 100;

export function setSrtInitWindow(value: number) {
	SRT_INIT_WINDOW = Math.max(0, Math.floor(value));
}
