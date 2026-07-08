import { Modal, Notice, TFile, TextComponent } from "obsidian";
import { PathFilter } from "../services/PathFilter";
import { getNested, setNested, deleteNested, hasNested } from "../utils/NestedPath";

export class BulkRenameModal extends Modal {
	private oldKey = "";
	private newKey = "";
	private affectedFiles: TFile[] = [];
	private scanned = false;

	private oldInput!: TextComponent;
	private newInput!: TextComponent;
	private scanBtn!: HTMLButtonElement;
	private renameBtn!: HTMLButtonElement;
	private resultEl!: HTMLElement;

	constructor(
		app: any,
		private plugin: any
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Rename YAML Key" });

		contentEl.createEl("p", {
			text: "Renames a YAML key across all files in your vault.",
		});

		contentEl.createEl("label", { text: "Old YAML key:" });
		this.oldInput = new TextComponent(contentEl);
		this.oldInput
			.setPlaceholder("e.g. oldKey")
			.setValue(this.oldKey)
			.onChange((v) => {
				this.oldKey = v.trim();
				this.scanned = false;
			});
		this.oldInput.inputEl.style.width = "100%";

		contentEl.createEl("br");
		contentEl.createEl("label", { text: "New YAML key:" });
		this.newInput = new TextComponent(contentEl);
		this.newInput
			.setPlaceholder("e.g. newKey")
			.setValue(this.newKey)
			.onChange((v) => {
				this.newKey = v.trim();
				this.scanned = false;
			});
		this.newInput.inputEl.style.width = "100%";

		contentEl.createEl("br");
		contentEl.createEl("br");

		this.scanBtn = contentEl.createEl("button", { text: "Scan" });
		this.scanBtn.addEventListener("click", () => this.onScan());

		this.resultEl = contentEl.createDiv();
		this.resultEl.style.marginTop = "1em";

		contentEl.createEl("hr");

		const warn = contentEl.createEl("p");
		warn.style.color = "var(--color-orange, #ff9800)";
		warn.setText(
			"⚠ This action cannot be undone. Files will be modified immediately."
		);

		this.renameBtn = contentEl.createEl("button", {
			text: "Rename in 0 files",
		});
		this.renameBtn.style.marginTop = "0.5em";
		this.renameBtn.disabled = true;
		this.renameBtn.addEventListener("click", () => this.onRename());
	}

	private async onScan() {
		if (!this.oldKey) {
			new Notice("Please enter an old YAML key.");
			return;
		}
		if (!this.newKey) {
			new Notice("Please enter a new YAML key.");
			return;
		}
		if (this.oldKey === this.newKey) {
			new Notice("Old and new key are the same.");
			return;
		}

		const protect = new Set(
			this.plugin.settings.protectedYamlKeys ?? []
		);
		if (protect.has(this.oldKey)) {
			new Notice(
				`"${this.oldKey}" is a protected key and cannot be renamed.`
			);
			return;
		}
		if (protect.has(this.newKey)) {
			new Notice(
				`"${this.newKey}" is a protected key and cannot be overwritten.`
			);
			return;
		}

		this.scanBtn.setText("Scanning…");
		this.scanBtn.disabled = true;

		// Defer to let UI update
		await new Promise((r) => setTimeout(r, 50));

		const files = this.app.vault.getMarkdownFiles();
		const settings = this.plugin.settings;
		const found: TFile[] = [];

		for (const file of files) {
			if (
				PathFilter.isExcluded(
					file.path,
					settings.excludedFolders,
					settings.filterMode,
					settings.includedFolders
				)
			)
				continue;

			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (fm && hasNested(fm, this.oldKey)) {
				found.push(file);
			}
		}

		this.affectedFiles = found;
		this.scanned = true;
		this.renderResults();
		this.scanBtn.setText("Scan");
		this.scanBtn.disabled = false;
	}

	private renderResults() {
		this.resultEl.empty();

		if (this.affectedFiles.length === 0) {
			this.resultEl.createEl("p", {
				text: `No files found with key "${this.oldKey}".`,
			});
			this.renameBtn.setText("Rename in 0 files");
			this.renameBtn.disabled = true;
			return;
		}

		const count = this.resultEl.createEl("p", {
			text: `Found "${this.oldKey}" in ${this.affectedFiles.length} file${this.affectedFiles.length !== 1 ? "s" : ""}.`,
		});
		count.style.fontWeight = "bold";

		const details = this.resultEl.createEl("details");
		const summary = details.createEl("summary", {
			text: "Show files",
		});
		summary.style.cursor = "pointer";

		for (const file of this.affectedFiles) {
			details.createEl("p", {
				text: file.path,
			}).style.marginLeft = "1em";
		}

		this.renameBtn.setText(
			`Rename in ${this.affectedFiles.length} file${this.affectedFiles.length !== 1 ? "s" : ""}`
		);
		this.renameBtn.disabled = false;
	}

	private async onRename() {
		if (!this.scanned || this.affectedFiles.length === 0) return;

		this.renameBtn.disabled = true;
		this.renameBtn.setText("Renaming…");

		const protect = new Set(
			this.plugin.settings.protectedYamlKeys ?? []
		);
		let count = 0;

		for (const file of this.affectedFiles) {
			let changed = false;
			try {
				await this.app.fileManager.processFrontMatter(
					file,
					(fm) => {
						if (hasNested(fm, this.oldKey) && !protect.has(this.oldKey)) {
							if (!protect.has(this.newKey)) {
								setNested(fm, this.newKey, getNested(fm, this.oldKey));
								deleteNested(fm, this.oldKey);
								changed = true;
							}
						}
					}
				);
			} catch (e) {
				console.error(
					"BulkRename: failed for",
					file.path,
					e
				);
			}
			if (changed) count++;
		}

		new Notice(
			`Renamed "${this.oldKey}" → "${this.newKey}" in ${count} file${count !== 1 ? "s" : ""}.`
		);

		const matchedField = this.plugin.settings.fields.find(
			(f: any) => f.yamlKey === this.oldKey
		);
		if (matchedField) {
			matchedField.yamlKey = this.newKey;
			if (!this.plugin.settings.pendingMigrations) {
				this.plugin.settings.pendingMigrations = [];
			}
			const existing = this.plugin.settings.pendingMigrations.find(
				(m: any) => m.fieldId === matchedField.id
			);
			if (existing) {
				existing.oldKey = this.oldKey;
			} else {
				this.plugin.settings.pendingMigrations.push({
					fieldId: matchedField.id,
					oldKey: this.oldKey,
				});
			}
			await this.plugin.saveSettings();
			new Notice(
				`Settings updated: "${matchedField.id}" → yamlKey "${this.newKey}"`
			);
		}

		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
