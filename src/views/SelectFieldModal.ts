import { App, Modal, TFile, Setting, normalizePath } from "obsidian";
import { MetadataFieldConfig } from "../types/MetadataField";
import { loadOptionsFromFile } from "../utils/SelectUtils";
import { getNested, setNested } from "../utils/NestedPath";
import type MetadataButlerPlugin from "../main";

function toSafeString(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return "";
}

export class SelectFieldModal extends Modal {
	private fields: MetadataFieldConfig[] = [];
	private currentValues: Record<string, unknown> = {};
	private note: TFile;
	private plugin: MetadataButlerPlugin;

	constructor(app: App, plugin: MetadataButlerPlugin, note: TFile) {
		super(app);
		this.plugin = plugin;
		this.note = note;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: `MD Butler — ${this.note.basename}` });

		this.fields = this.plugin.settings.fields.filter(
			(f: MetadataFieldConfig) => f.enabled && (f.type === "select" || f.type === "multi")
		);

		if (this.fields.length === 0) {
			contentEl.createEl("p", {
				text: "Keine select- oder multi-felder in den einstellungen."
			});
			return;
		}

		for (const f of this.fields) {
			if (f.optionsFile) {
				await loadOptionsFromFile(f, this.app);
			}
		}

		const cache = this.app.metadataCache.getFileCache(this.note)?.frontmatter || {};
		for (const f of this.fields) {
			this.currentValues[f.yamlKey] = getNested(cache, f.yamlKey);
		}

		await this.renderFields(contentEl);
	}

	private async renderFields(container: HTMLElement) {
		for (const field of this.fields) {
			if (!field.options || field.options.length === 0) continue;

			if (field.type === "select") {
				await this.renderSelectField(container, field);
			} else if (field.type === "multi") {
				await this.renderMultiField(container, field);
			}
		}
	}

	private async renderSelectField(container: HTMLElement, field: MetadataFieldConfig) {
		const currentValue: unknown = this.currentValues[field.yamlKey];
		const setting = new Setting(container)
			.setName(field.yamlKey);

		if (field.optionsFile) {
			setting.setDesc(`from: ${field.optionsFile}`);
		}

		if (field.optionsFile && !(this.app.vault.getAbstractFileByPath(normalizePath(field.optionsFile)) instanceof TFile)) {
			const createBtn = setting.descEl.createEl("button", {
				text: "➕ Datei erstellen",
				cls: "md-butler-create-btn"
			});
			createBtn.addEventListener("click", () => {
				void (async () => {
					const content = "---\noptions:\n  - New Option\n---\n";
					await this.app.vault.create(field.optionsFile!, content);
					await loadOptionsFromFile(field, this.app);
					await this.onOpen();
				})();
			});
		}

		setting.addDropdown(cb => {
			cb.addOptions(
				Object.fromEntries(field.options!.map(o => [o, o]))
			);
			if (currentValue !== undefined && field.options!.includes(toSafeString(currentValue))) {
				cb.setValue(toSafeString(currentValue));
			}
			cb.onChange(async (val: string) => {
				await this.writeValue(field.yamlKey, val);
			});
		});
	}

	private async renderMultiField(container: HTMLElement, field: MetadataFieldConfig) {
		const currentRaw: unknown = this.currentValues[field.yamlKey];
		const currentArr: string[] = Array.isArray(currentRaw)
			? currentRaw.filter((v): v is string => typeof v === "string")
			: typeof currentRaw === "string"
				? [currentRaw]
				: [];

		const setting = new Setting(container)
			.setName(field.yamlKey);

		if (field.optionsFile) {
			setting.setDesc(`from: ${field.optionsFile}`);
		}

		const toggleContainer = setting.descEl.createDiv({ cls: "md-butler-multi-toggles" });

		for (const opt of field.options!) {
			const isSelected = currentArr.includes(opt);
			const toggle = toggleContainer.createEl("label", {
				text: ` ${opt}`,
				cls: "md-butler-toggle-label"
			});
			const cb = toggle.createEl("input", {
				attr: { type: "checkbox" }
			});
			cb.checked = isSelected;
			cb.addEventListener("change", () => {
				void (async () => {
					const updated = this.getUpdatedMultiValues(field.yamlKey, opt, cb.checked);
					await this.writeValue(field.yamlKey, updated);
				})();
			});
		}
	}

	private getUpdatedMultiValues(yamlKey: string, option: string, add: boolean): string[] {
		const raw: unknown = this.currentValues[yamlKey];
		const current: string[] = Array.isArray(raw)
			? raw.filter((v): v is string => typeof v === "string")
			: [];
		if (add && !current.includes(option)) {
			current.push(option);
		} else if (!add) {
			const idx = current.indexOf(option);
			if (idx !== -1) current.splice(idx, 1);
		}
		return current;
	}
	private getCurrentValue(yamlKey: string): string | undefined {
		const fm = this.app.metadataCache.getFileCache(this.note)?.frontmatter;
		if (fm) {
			const val: unknown = getNested(fm, yamlKey);
			if (val !== undefined) return toSafeString(val);
		}
		return undefined;
	}

	private async writeValue(yamlKey: string, value: string | string[]): Promise<void> {
		await this.app.fileManager.processFrontMatter(this.note, (fm: Record<string, unknown>) => {
			setNested(fm, yamlKey, value);
		});
	}
}
