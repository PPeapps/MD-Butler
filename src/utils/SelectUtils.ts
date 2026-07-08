import { App, TFile, Notice } from "obsidian";
import { MetadataFieldConfig } from "../types/MetadataField";

export async function loadOptionsFromFile(
	field: MetadataFieldConfig,
	app: App
): Promise<void> {
	if (!field.optionsFile) return;
	const file = app.vault.getAbstractFileByPath(field.optionsFile);
	if (!(file instanceof TFile)) {
		new Notice(`MD Butler: Options-Datei nicht gefunden: ${field.optionsFile}`);
		return;
	}
	const content = await app.vault.read(file);
	const fm = app.metadataCache.getFileCache(file)?.frontmatter;
	if (fm?.options && Array.isArray(fm.options)) {
		field.options = fm.options.map(String);
		return;
	}
	const lines = content
		.split("\n")
		.map(l => l.trim())
		.filter(l => l.length > 0 && !l.startsWith("---"));
	if (lines.length > 0) {
		field.options = lines;
		return;
	}
	new Notice(`MD Butler: Keine "options:"-Liste in ${field.optionsFile}`);
	field.options = [];
}

export async function readOptionsForWriter(
	field: MetadataFieldConfig,
	app: App
): Promise<string[]> {
	if (!field.optionsFile) return field.options ?? [];
	const file = app.vault.getAbstractFileByPath(field.optionsFile);
	if (!(file instanceof TFile)) return field.options ?? [];
	try {
		const content = await app.vault.read(file);
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (fm?.options && Array.isArray(fm.options)) {
			return fm.options.map(String);
		}
		const lines = content
			.split("\n")
			.map(l => l.trim())
			.filter(l => l.length > 0 && !l.startsWith("---"));
		if (lines.length > 0) return lines;
	} catch { /* silent */ }
	return [];
}
