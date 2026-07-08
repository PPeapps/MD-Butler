/**
 * Shared event types for the metadata update pipeline.
 * Single source of truth for all event-related type definitions.
 */
import { TFile } from "obsidian";

export type EventType = "open" | "modify" | "rename" | "bulk";

export interface NormalizedEvent {
	type: EventType;
	file: TFile;
	timestamp: number;
	source: string;
	oldPath?: string;
}
