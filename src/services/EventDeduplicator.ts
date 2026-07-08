/**
 * Deduplicates rapid-fire events within a 2-second window.
 * Prevents redundant metadata writes from chained Obsidian events.
 * Caps internal map at 1000 entries to prevent memory leaks.
 */
import { NormalizedEvent } from "../types/Events";

export class EventDeduplicator {
	private recent = new Map<string, number>();
	private readonly MAX_SIZE = 1000;

	isDuplicate(event: NormalizedEvent): boolean {
		const key = `${event.file.path}:${event.type}`;
		const now = Date.now();
		const last = this.recent.get(key);

		if (last && now - last < 2000) {
			return true;
		}

		this.recent.set(key, now);

		if (this.recent.size > this.MAX_SIZE) {
			const oldest = this.recent.keys().next().value;
			if (oldest !== undefined) this.recent.delete(oldest);
		}

		return false;
	}

	clear(): void {
		this.recent.clear();
	}
}
