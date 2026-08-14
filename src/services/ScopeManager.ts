/**
 * Processing scope manager.
 * Determines whether a file should be processed based on the configured mode.
 * newOnly: process files without DateCreated (new notes) or files that still
 * have empty enabled fields (MD-001: fill empty values, never overwrite set ones).
 * allFiles: process every file unconditionally.
 */
import { App, TFile } from "obsidian";
import { ProcessingMode } from "../settings/settings";
import { MetadataFieldConfig } from "../types/MetadataField";
import { getNested, hasNested, isEmptyValue } from "../utils/NestedPath";

export class ScopeManager {
	static shouldProcess(
		app: App,
		file: TFile,
		mode: ProcessingMode,
		fields: MetadataFieldConfig[]
	): boolean {
		if (mode === "allFiles") {
			return true;
		}
		const cache = app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;
		if (frontmatter === undefined || frontmatter === null) {
			return true;
		}

		const hasDateCreated =
			frontmatter.DateCreated !== undefined &&
			frontmatter.DateCreated !== null &&
			!isEmptyValue(frontmatter.DateCreated);
		if (!hasDateCreated) {
			return true;
		}

		// MD-001: file is "new enough" but may still have present-but-empty
		// fields (e.g. `Note.UUID: `) that newOnly should fill.
		for (const field of fields) {
			if (!field.enabled || !field.yamlKey) continue;
			if (
				hasNested(frontmatter, field.yamlKey) &&
				isEmptyValue(getNested(frontmatter, field.yamlKey))
			) {
				return true;
			}
		}
		return false;
	}
}
