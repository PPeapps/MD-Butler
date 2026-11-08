/**
 * Processing scope manager.
 * Determines whether a file should be processed based on the configured mode
 * and per-field processingMode (MD-004).
 * newOnly: process files without DateCreated (new notes) or files that still
 * have empty/missing enabled fields (MD-001: fill empty values, never overwrite set ones).
 * allFiles: process every file unconditionally.
 */
import { App, TFile } from "obsidian";
import { ProcessingMode } from "../settings/settings";
import { MetadataFieldConfig } from "../types/MetadataField";
import { isEmptyValue, getValueAnywhere, hasValueAnywhere } from "../utils/NestedPath";

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

		// Per-field "always" → process every file for that field.
		for (const field of fields) {
			if (!field.enabled || !field.yamlKey) continue;
			if (field.processingMode === "always") {
				return true;
			}
		}

		// DateCreated fallback (legacy top-level / disabled field).
		const dcField = fields.find((f) => f.id === "dateCreated");
		let hasDateCreated = false;
		if (dcField?.enabled && dcField.yamlKey) {
			hasDateCreated =
				hasValueAnywhere(frontmatter, dcField.yamlKey) &&
				!isEmptyValue(getValueAnywhere(frontmatter, dcField.yamlKey));
		} else {
			hasDateCreated =
				frontmatter.DateCreated !== undefined &&
				frontmatter.DateCreated !== null &&
				!isEmptyValue(frontmatter.DateCreated);
		}
		if (!hasDateCreated) {
			return true;
		}

		// MD-001 + MD-004: file may still have missing/empty fields depending
		// on per-field processingMode. `if-exists` fields are skipped.
		for (const field of fields) {
			if (!field.enabled || !field.yamlKey) continue;
			if (field.requirement === "if-exists") continue;
			const pm = field.processingMode ?? "ifEmpty";
			const hasVal = hasValueAnywhere(frontmatter, field.yamlKey);
			if (pm === "newOnly") {
				if (!hasVal) return true;
			} else {
				// ifEmpty / default
				const current = getValueAnywhere(frontmatter, field.yamlKey);
				if (isEmptyValue(current)) return true;
			}
		}
		return false;
	}
}