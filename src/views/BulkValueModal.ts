import { App, Modal, Notice, TFile } from "obsidian";
import { PathFilter } from "../services/PathFilter";
import { MetadataWriter } from "../services/MetadataWriter";
import { TransformEngine } from "../services/TransformEngine";
import { FolderSuggestModal } from "../settings/FolderSuggestModal";
import { FileSuggestModal } from "../settings/FileSuggestModal";
import { BulkProgressModal } from "./BulkProgressModal";
import { MetadataFieldConfig } from "../types/MetadataField";
import { FieldProcessingMode } from "../types/MetadataField";
import type MetadataButlerPlugin from "../main";

export class BulkValueModal extends Modal {
	private plugin: MetadataButlerPlugin;
	private writer: MetadataWriter;
	private engine: TransformEngine;

	private mode: "folder" | "selection" = "folder";
	private folderPath = "";
	private folderLabel!: HTMLElement;
	private folderContainer!: HTMLElement;
	private selectionContainer!: HTMLElement;
	private selectedFiles: TFile[] = [];
	private fileListEl!: HTMLElement;

	private fields: MetadataFieldConfig[] = [];
	private selectedFieldId = "";
	private fieldDropdown!: HTMLSelectElement;

	// value inputs
	private valueContainer!: HTMLElement;
	private textInput!: HTMLInputElement;
	private selectDropdown!: HTMLSelectElement;
	private multiChecks: Map<string, HTMLInputElement> = new Map();
	private multiExtraInput!: HTMLInputElement;

	private processingMode: FieldProcessingMode | "" = "";
	private pmDropdown!: HTMLSelectElement;

	private applyBtn!: HTMLButtonElement;
	private statusEl!: HTMLElement;

	constructor(app: App, plugin: MetadataButlerPlugin, initialFiles?: TFile[]) {
		super(app);
		this.plugin = plugin;
		this.writer = new MetadataWriter(app);
		this.engine = new TransformEngine(app);
		if (initialFiles && initialFiles.length > 0) {
			this.mode = "selection";
			this.selectedFiles = [...initialFiles];
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Set field value" });

		this.fields = this.plugin.settings.fields.filter((f) => f.enabled);

		// Scope toggle
		const scopeRow = contentEl.createDiv({ cls: "md-butler-field-row" });
		scopeRow.createSpan({ text: "Scope:" });
		const scopeSelect = scopeRow.createEl("select");
		const optFolder = scopeSelect.createEl("option", { text: "Folder" });
		optFolder.value = "folder";
		const optSel = scopeSelect.createEl("option", { text: "Selected files" });
		optSel.value = "selection";
		scopeSelect.value = this.mode;
		scopeSelect.addEventListener("change", () => {
			this.mode = scopeSelect.value as "folder" | "selection";
			this.updateModeUI();
		});

		// Folder selection
		this.folderContainer = contentEl.createDiv();
		const folderRow = this.folderContainer.createDiv({ cls: "md-butler-field-row" });
		folderRow.createSpan({ text: "Folder:" });
		const pickBtn = folderRow.createEl("button", { text: "Choose folder…" });
		this.folderLabel = folderRow.createSpan({ text: " (none)" });
		pickBtn.addEventListener("click", () => {
			new FolderSuggestModal(this.app, (path: string) => {
				this.folderPath = path;
				this.folderLabel.setText(` ${path}`);
			}).open();
		});

		// Selection
		this.selectionContainer = contentEl.createDiv();
		const selHeader = this.selectionContainer.createDiv({ cls: "md-butler-field-row" });
		selHeader.createSpan({ text: "Files:" });
		const addBtn = selHeader.createEl("button", { text: "Add file…" });
		addBtn.addEventListener("click", () => {
			new FileSuggestModal(this.app, (file: TFile) => {
				if (!this.selectedFiles.find((f) => f.path === file.path)) {
					this.selectedFiles.push(file);
				}
				this.renderFileList();
			}).open();
		});
		this.fileListEl = this.selectionContainer.createDiv();
		this.renderFileList();

		this.updateModeUI();

		// Field selection
		const fieldRow = contentEl.createDiv({ cls: "md-butler-field-row" });
		fieldRow.createSpan({ text: "Field:" });
		this.fieldDropdown = fieldRow.createEl("select");
		this.fieldDropdown.addClass("md-butler-full-width");
		const defOpt = this.fieldDropdown.createEl("option", { text: "(Select field)" });
		defOpt.value = "";
		for (const f of this.fields) {
			const opt = this.fieldDropdown.createEl("option", { text: `${f.id} (${f.yamlKey})` });
			opt.value = f.id;
		}
		this.fieldDropdown.addEventListener("change", () => {
			this.selectedFieldId = this.fieldDropdown.value;
			this.renderValueInputs();
		});

		// Value inputs container
		this.valueContainer = contentEl.createDiv();
		this.renderValueInputs();

		// Processing mode
		const pmRow = contentEl.createDiv({ cls: "md-butler-field-row" });
		pmRow.createSpan({ text: "Processing:" });
		this.pmDropdown = pmRow.createEl("select");
		const pmOpts: Array<[string, string]> = [
			["", "Default (field/global)"],
			["ifEmpty", "If empty"],
			["newOnly", "New only (missing)"],
			["always", "Always (overwrite)"],
		];
		for (const [v, l] of pmOpts) {
			const o = this.pmDropdown.createEl("option", { text: l });
			o.value = v;
		}
		this.pmDropdown.addEventListener("change", () => {
			this.processingMode = this.pmDropdown.value as FieldProcessingMode | "";
		});

		// Status
		this.statusEl = contentEl.createEl("p", { text: "" });

		// Apply button
		const btnRow = contentEl.createDiv({ cls: "md-butler-field-row" });
		this.applyBtn = btnRow.createEl("button", { text: "Apply" });
		this.applyBtn.addEventListener("click", () => {
			void this.onApply();
		});
	}

	private getSelectedField(): MetadataFieldConfig | undefined {
		return this.fields.find((f) => f.id === this.selectedFieldId);
	}

	private renderValueInputs() {
		this.valueContainer.empty();
		this.multiChecks.clear();
		const field = this.getSelectedField();
		if (!field) {
			this.valueContainer.createEl("p", { text: "Select a field first." });
			return;
		}

		if (field.type === "select") {
			const row = this.valueContainer.createDiv({ cls: "md-butler-field-row" });
			row.createSpan({ text: "Value:" });
			this.selectDropdown = row.createEl("select");
			const noneOpt = this.selectDropdown.createEl("option", { text: "(None)" });
			noneOpt.value = "";
			for (const o of field.options ?? []) {
				const opt = this.selectDropdown.createEl("option", { text: o });
				opt.value = o;
			}
			// template text input
			const tmplRow = this.valueContainer.createDiv({ cls: "md-butler-field-row" });
			tmplRow.createSpan({ text: "Or template:" });
			this.textInput = tmplRow.createEl("input", { type: "text" });
			this.textInput.placeholder = "{{title}}, {{folder}}, …";
			this.textInput.addClass("md-butler-full-width");
		} else if (field.type === "multi") {
			if (field.options && field.options.length > 0) {
				const row = this.valueContainer.createDiv({ cls: "md-butler-field-row" });
				row.createSpan({ text: "Options:" });
				const wrap = this.valueContainer.createDiv();
				for (const o of field.options) {
					const label = wrap.createEl("label");
					const cb = label.createEl("input", { type: "checkbox" });
					this.multiChecks.set(o, cb);
					label.appendText(` ${o}`);
				}
			}
			const tmplRow = this.valueContainer.createDiv({ cls: "md-butler-field-row" });
			tmplRow.createSpan({ text: "Or template/extra (comma-sep):" });
			this.textInput = tmplRow.createEl("input", { type: "text" });
			this.textInput.placeholder = "{{folder}}, extra, …";
			this.textInput.addClass("md-butler-full-width");
		} else {
			const row = this.valueContainer.createDiv({ cls: "md-butler-field-row" });
			row.createSpan({ text: "Value:" });
			this.textInput = row.createEl("input", { type: "text" });
			this.textInput.addClass("md-butler-full-width");
			this.textInput.placeholder = "Value or template ({{title}}, {{folder}}, …)";
		}
	}

private updateModeUI() {
		this.folderContainer.style.display = this.mode === "folder" ? "block" : "none";
		this.selectionContainer.style.display = this.mode === "selection" ? "block" : "none";
	}

	private renderFileList() {
		this.fileListEl.empty();
		if (this.selectedFiles.length === 0) {
			this.fileListEl.createEl("p", { text: "No files selected." });
			return;
		}
		for (const f of this.selectedFiles) {
			const row = this.fileListEl.createDiv({ cls: "md-butler-field-row" });
			row.createSpan({ text: f.path });
			const rm = row.createEl("button", { text: "✕" });
			rm.addEventListener("click", () => {
				this.selectedFiles = this.selectedFiles.filter((x) => x.path !== f.path);
				this.renderFileList();
			});
		}
	}

	private async onApply() {
		const field = this.getSelectedField();
		if (!field) {
			new Notice("Please select a field.");
			return;
		}

		let files: TFile[] = [];
		if (this.mode === "selection") {
			if (this.selectedFiles.length === 0) {
				new Notice("Please add at least one file.");
				return;
			}
			files = [...this.selectedFiles];
		} else {
			if (!this.folderPath) {
				new Notice("Please choose a folder first.");
				return;
			}
			files = this.app.vault
				.getMarkdownFiles()
				.filter((f) => f.path === this.folderPath || f.path.startsWith(this.folderPath + "/"));
		}
		files = files.filter((f) => !PathFilter.isExcluded(f.path, this.plugin.settings.excludedFolders, this.plugin.settings.filterMode, this.plugin.settings.includedFolders));

		if (files.length === 0) {
			new Notice("No Markdown files in this folder.");
			return;
		}

		// Determine value
		let baseValue: unknown = undefined;
		if (field.type === "select") {
			const tmpl = this.textInput?.value?.trim();
			if (tmpl) baseValue = tmpl;
			else baseValue = this.selectDropdown?.value ?? "";
		} else if (field.type === "multi") {
			const selected: string[] = [];
			for (const [opt, cb] of this.multiChecks.entries()) {
				if (cb.checked) selected.push(opt);
			}
			const tmpl = this.textInput?.value?.trim();
			if (selected.length > 0) baseValue = selected;
			else if (tmpl) baseValue = tmpl;
			else baseValue = [];
		} else {
			baseValue = this.textInput?.value ?? "";
		}

		const pmOverride: FieldProcessingMode | undefined =
			this.processingMode === "" ? undefined : this.processingMode;

		// Override processingMode on a cloned fields array
		const fieldsOverride = this.plugin.settings.fields.map((f) => {
			if (f.id !== field.id) return f;
			return { ...f, processingMode: pmOverride ?? f.processingMode };
		});

		this.applyBtn.disabled = true;
		this.applyBtn.setText("Applying…");
		this.plugin.bulkRunning = true;
		const modal = new BulkProgressModal(this.app, files.length, () => {
			this.plugin.cancelled = true;
		});
		modal.open();
		let count = 0;
		let tick = 0;
		try {
			for (const file of files) {
				if (this.plugin.cancelled) break;
				// Resolve value per file if template
				let resolvedValue: unknown = baseValue;
				if (typeof baseValue === "string" && baseValue.includes("{{")) {
					resolvedValue = this.engine.resolve(baseValue, {
						file,
						eventType: "bulk",
						dateFormat: this.plugin.settings.dateFormat,
					});
					// type conversion
					if (field.type === "number") {
						const n = Number(resolvedValue);
						resolvedValue = Number.isNaN(n) ? resolvedValue : n;
					} else if (field.type === "boolean") {
						resolvedValue = String(resolvedValue) === "true";
					}
				} else if (Array.isArray(baseValue)) {
					resolvedValue = (baseValue as unknown[]).map((v) => {
						if (typeof v === "string" && v.includes("{{")) {
							const r = this.engine.resolve(v, {
								file,
								eventType: "bulk",
								dateFormat: this.plugin.settings.dateFormat,
							});
							return r;
						}
						return v;
					});
				}

				const update: Record<string, unknown> = {};
				if (resolvedValue !== undefined && resolvedValue !== null) {
					update[field.id] = resolvedValue;
				}

				try {
					await this.writer.write(
						file,
						update,
						fieldsOverride,
						this.plugin.settings.dateFormat,
						undefined,
						undefined,
						this.plugin.settings.pendingMigrations,
						this.plugin.settings.orphanedYamlKeys,
						false,
						this.plugin.settings.protectedYamlKeys,
						"bulk"
					);
					count++;
				} catch (e) {
					console.error("BulkValue: write failed for", file.path, e);
				}
				tick++;
				if (tick % 50 === 0) modal.update(count, files.length);
			}
		} finally {
			this.plugin.bulkRunning = false;
			modal.close();
		}

		new Notice(`Applied value to ${count} of ${files.length} notes.`);
		this.applyBtn.disabled = false;
		this.applyBtn.setText("Apply");
		this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}