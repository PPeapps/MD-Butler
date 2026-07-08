/**
 * Scans vault markdown files for missing enabled YAML frontmatter fields.
 * Respects PathFilter and produces a ConsistencyReport.
 */
import { App, TFile } from "obsidian";
import { MetadataFieldConfig } from "../types/MetadataField";
import { PathFilter } from "./PathFilter";
import { FilterMode } from "../settings/settings";
import { readOptionsForWriter } from "../utils/SelectUtils";
import { getNested } from "../utils/NestedPath";

export interface FileResult {
	file: TFile;
	missingFields: string[];
}

export interface ValueIssue {
	file: TFile;
	yamlKey: string;
	currentValue: string;
	expectedValues: string[];
	fieldType: "select" | "multi";
}

export interface ConsistencyReport {
	totalFiles: number;
	completeFiles: number;
	incompleteFiles: number;
	results: FileResult[];
	valueIssues: ValueIssue[];
}

export class ConsistencyChecker {
	async check(
		app: App,
		fields: MetadataFieldConfig[],
		excludedFolders: string[],
		includedFolders: string[],
		filterMode: FilterMode,
		vaultTags?: string[]
	): Promise<ConsistencyReport> {
		const enabledFields = fields.filter((f) => f.enabled);

		// Lade Options aus optionsFile für Felder, die eine Lookup-Datei nutzen
		for (const field of enabledFields) {
			if (
				(field.type === "select" || field.type === "multi") &&
				field.optionsFile &&
				(!field.options || field.options.length === 0)
			) {
				const opts = await readOptionsForWriter(field, app);
				if (opts.length > 0) field.options = opts;
			}
		}

		const optionFields = enabledFields.filter(
			(f) =>
				(f.type === "select" || f.type === "multi") &&
				((f.options?.length ?? 0) > 0 ||
					(f.id === "tags" && vaultTags))
		);
		const files = app.vault.getMarkdownFiles();
		const results: FileResult[] = [];
		const valueIssues: ValueIssue[] = [];
		let completeCount = 0;

		for (const file of files) {
			if (
				PathFilter.isExcluded(
					file.path,
					excludedFolders,
					filterMode,
					includedFolders
				)
			)
				continue;

			const cache = app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter ?? {};
			const missing: string[] = [];

			for (const field of enabledFields) {
				if (getNested(frontmatter, field.yamlKey) === undefined) {
					missing.push(field.yamlKey);
				}
			}

			if (missing.length > 0) {
				results.push({ file, missingFields: missing });
			} else {
				completeCount++;
			}

			for (const field of optionFields) {
				const raw = getNested(frontmatter, field.yamlKey);
				if (raw === undefined || raw === null) continue;

				const validOptions =
					field.options && field.options.length > 0
						? field.options.map((o) => o.trim())
						: vaultTags ?? [];
				if (validOptions.length === 0) continue;

				if (field.type === "multi") {
					const rawElements = Array.isArray(raw)
						? raw.filter(
								(v): v is string => typeof v === "string"
						  )
						: String(raw)
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean);

					// FlatMap: Komma-getrennte Elemente innerhalb von Array-Einträgen splitten
					const elements: string[] = [];
					for (const el of rawElements) {
						if (el.includes(",")) {
							elements.push(
								...el
									.split(",")
									.map((s) => s.trim())
									.filter(Boolean)
							);
						} else {
							elements.push(el);
						}
					}

					for (const element of elements) {
						if (
							!validOptions.some(
								(o) => o === element
							)
						) {
							valueIssues.push({
								file,
								yamlKey: field.yamlKey,
								currentValue: element,
								expectedValues: validOptions,
								fieldType: "multi",
							});
						}
					}
				} else {
					const val = Array.isArray(raw)
						? String(raw[0] ?? "")
						: String(raw);
					if (
						!validOptions.some(
							(o) => o === val
						)
					) {
						valueIssues.push({
							file,
							yamlKey: field.yamlKey,
							currentValue: val,
							expectedValues: validOptions,
							fieldType: "select",
						});
					}
				}
			}
		}

		return {
			totalFiles: files.length,
			completeFiles: completeCount,
			incompleteFiles: results.length,
			results,
			valueIssues,
		};
	}
}
