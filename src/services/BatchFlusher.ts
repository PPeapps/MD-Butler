/**
 * Debounced batch flush scheduler.
 * Accumulates queued updates and flushes them after a configurable delay.
 * handleEvent() guards against duplicate schedules during flush via isFlushing.
 */
export class BatchFlusher {
	private timer: number | null = null;
	isFlushing = false;

	schedule(delay: number, flushFn: () => Promise<void>): void {
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
		}

		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.isFlushing = true;
			flushFn().catch((err) => {
				console.error("[MD Butler] Flusher: unhandled error in flushFn", err);
			}).finally(() => {
				this.isFlushing = false;
			});
		}, delay) as unknown as number;
	}

	cancel(): void {
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
	}

	isScheduled(): boolean {
		return this.timer !== null;
	}
}
