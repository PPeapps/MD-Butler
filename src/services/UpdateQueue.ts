/**
 * Per-file update queue with merge semantics.
 * Only the latest update per file is kept; writes are coalesced.
 */
import { TFile } from "obsidian";
import { QueuedUpdate } from "../types/Queue";

export class UpdateQueue {
	private queue = new Map<string, QueuedUpdate>();

	add(
		file: TFile,
		update: Record<string, unknown>,
		eventType?: string
	): void {
		const existing = this.queue.get(file.path);

		if (existing) {
			existing.update = {
				...existing.update,
				...this.clean(update),
			};
			if (eventType) existing.eventType = eventType;
		} else {
			this.queue.set(file.path, {
				file,
				update: this.clean(update),
				eventType,
			});
		}
	}

	drain(): QueuedUpdate[] {
		const items = Array.from(this.queue.values());
		this.queue.clear();
		return items;
	}

	size(): number {
		return this.queue.size;
	}

	private clean(update: Record<string, unknown>): Record<string, unknown> {
		const cleaned: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(update)) {
			if (value === undefined || value === null) continue;
			cleaned[key] = value;
		}
		return cleaned;
	}
}
