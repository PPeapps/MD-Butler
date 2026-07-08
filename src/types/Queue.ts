/**
 * Queue data structures for batched metadata updates.
 */
import { TFile } from "obsidian";

export interface QueuedUpdate {
	file: TFile;
	update: Record<string, unknown>;
	eventType?: string;
}
