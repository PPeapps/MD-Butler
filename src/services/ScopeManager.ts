/**
 * Processing scope manager.
 * Determines whether a file should be processed based on the configured mode.
 * newOnly: skip open/bulk events for files that already have DateCreated in frontmatter.
 * allFiles: process every file unconditionally.
 */
import { App, TFile } from "obsidian";
import { ProcessingMode } from "../settings/settings";

export class ScopeManager {
	static shouldProcess(
		app: App,
		file: TFile,
		mode: ProcessingMode
	): boolean {
		if (mode === "allFiles") {
			return true;
		}
		const cache = app.metadataCache.getFileCache(file);
		const hasDateCreated = cache?.frontmatter?.DateCreated;
		return !hasDateCreated;
	}
}
