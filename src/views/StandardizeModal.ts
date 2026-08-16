import { App, Modal, Notice, TFile } from "obsidian";
import { ValueIssue } from "../services/ConsistencyChecker";
import {
	StandardizerService,
	ValueFix,
	ValueFixMap,
} from "../services/StandardizerService";
import { getNested } from "../utils/NestedPath";

export class StandardizeModal extends Modal {
	private fixes: ValueFixMap = new Map();
	private applyBtn!: HTMLButtonElement;

	constructor(
		app: App,
		private issues: ValueIssue[],
		private standardizer: StandardizerService,
		private protectedKeys: string[]
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Standardize field values" });
		contentEl.createEl("p", {
			text: `Found ${this.issues.length} value issue${this.issues.length !== 1 ? "s" : ""}. Select the correct value for each issue below.`,
		});

		const byField = this.groupByField(this.issues);
		const sortedFields = [...byField.entries()].sort((a, b) =>
			a[0].localeCompare(b[0])
		);
		for (const [yamlKey, issues] of sortedFields) {
			const fieldSection = contentEl.createEl("details");
			const summary = fieldSection.createEl("summary", {
				text: `${yamlKey} (${issues.length})`,
			});
			summary.addClass("md-butler-bold");
			summary.addClass("md-butler-pointer");

			// Group issues within this field by file
			const byFile = this.groupByFile(issues);
			const sortedFiles = [...byFile.entries()].sort((a, b) =>
				a[0].localeCompare(b[0])
			);
			for (const [filePath, fileIssues] of sortedFiles) {
				const fileSection = fieldSection.createDiv();
				fileSection.addClass("md-butler-standardize-file");

				const pathEl = fileSection.createSpan({
					text: filePath,
				});
				pathEl.addClass("md-butler-standardize-path");

				for (const issue of fileIssues) {
					const row = fileSection.createDiv();
					row.addClass("md-butler-standardize-row");

					row.createSpan({
						text: `✕ `,
					});
					const bad = row.createEl("code", {
						text: `"${issue.currentValue}"`,
					});
					bad.addClass("md-butler-bad-value");
					row.createSpan({ text: " → " });

					const select = row.createEl("select");
					select.addClass("md-butler-select-ml");

					const skipOpt = select.createEl("option", {
						text: "Skip",
					});
					skipOpt.value = "";

					for (const opt of issue.expectedValues) {
						const optEl = select.createEl("option", {
							text: opt,
						});
						optEl.value = opt;
					}

					const warnEl = row.createSpan();
					warnEl.addClass("md-butler-warn-text");
					warnEl.addClass("md-butler-hidden");
					warnEl.setText("⚠ Already exists → will be removed");

					select.addEventListener("change", () => {
						const isDup =
							select.value &&
							this.isDuplicate(
								issue.file,
								issue.yamlKey,
								select.value,
								issue.fieldType
							);
						warnEl.toggleClass("md-butler-hidden", !isDup);
						this.updateFix(
							issue.file.path,
							issue.yamlKey,
							issue.currentValue,
							issue.fieldType,
							select.value,
							isDup ? "remove" : undefined
						);
					});
				}
			}
		}

		contentEl.createEl("hr");
		this.applyBtn = contentEl.createEl("button", {
			text: "Apply 0 changes",
		});
		this.applyBtn.addClass("md-butler-mt-1");
		this.applyBtn.disabled = true;
		this.applyBtn.addEventListener("click", () => {
			void this.onApply();
		});
	}

	private updateFix(
		filePath: string,
		yamlKey: string,
		currentValue: string,
		fieldType: "select" | "multi",
		newValue: string,
		action?: "replace" | "remove"
	) {
		const fileFixes = this.fixes.get(filePath) ?? [];

		if (!newValue) {
			const idx = fileFixes.findIndex(
				(f) =>
					f.yamlKey === yamlKey &&
					f.currentValue === currentValue
			);
			if (idx !== -1) {
				fileFixes.splice(idx, 1);
				if (fileFixes.length === 0) {
					this.fixes.delete(filePath);
				}
			}
			this.updateApplyBtn();
			return;
		}

		const fix: ValueFix = {
			yamlKey,
			currentValue,
			newValue,
			fieldType,
			action,
		};
		const idx = fileFixes.findIndex(
			(f) =>
				f.yamlKey === yamlKey && f.currentValue === currentValue
		);
		if (idx !== -1) {
			fileFixes[idx] = fix;
		} else {
			fileFixes.push(fix);
		}
		this.fixes.set(filePath, fileFixes);
		this.updateApplyBtn();
	}

	private updateApplyBtn() {
		let count = 0;
		for (const [, fixes] of this.fixes) {
			count += fixes.length;
		}
		this.applyBtn.textContent = `Apply ${count} change${count !== 1 ? "s" : ""}`;
		this.applyBtn.disabled = count === 0;
	}

	private async onApply() {
		this.applyBtn.disabled = true;
		this.applyBtn.textContent = "Applying…";
		try {
			const total = await this.standardizer.apply(
				this.fixes,
				this.protectedKeys
			);
			new Notice(`Standardized ${total} value${total !== 1 ? "s" : ""}.`);
			this.close();
		} catch (e) {
			console.error("Standardizer apply failed:", e);
			new Notice("Standardization failed. Check console for details.");
			this.applyBtn.disabled = false;
			this.updateApplyBtn();
		}
	}

	private groupByField(
		issues: ValueIssue[]
	): Map<string, ValueIssue[]> {
		const map = new Map<string, ValueIssue[]>();
		for (const issue of issues) {
			const existing = map.get(issue.yamlKey);
			if (existing) {
				existing.push(issue);
			} else {
				map.set(issue.yamlKey, [issue]);
			}
		}
		return map;
	}

	private groupByFile(
		issues: ValueIssue[]
	): Map<string, ValueIssue[]> {
		const map = new Map<string, ValueIssue[]>();
		for (const issue of issues) {
			const existing = map.get(issue.file.path);
			if (existing) {
				existing.push(issue);
			} else {
				map.set(issue.file.path, [issue]);
			}
		}
		return map;
	}

	private isDuplicate(
		file: TFile,
		yamlKey: string,
		selectedValue: string,
		fieldType: "select" | "multi"
	): boolean {
		if (fieldType !== "multi" || !selectedValue) return false;
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter ?? {};
		const raw: unknown = getNested(fm, yamlKey);

		if (Array.isArray(raw)) {
			return raw.some(
				(v: unknown) => typeof v === "string" && v === selectedValue
			);
		}
		if (typeof raw === "string") {
			return raw
				.split(",")
				.map((s) => s.trim())
				.some((v) => v === selectedValue);
		}
		return false;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
