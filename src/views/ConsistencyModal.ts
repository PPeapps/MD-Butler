/**
 * Modal displaying vault consistency check results.
 * Green for complete files, red for incomplete with missing field list.
 * Shows value issues for select/multi fields with non-matching values.
 */
import { Modal } from "obsidian";
import {
	ConsistencyReport,
	ValueIssue,
} from "../services/ConsistencyChecker";

export class ConsistencyModal extends Modal {
	constructor(
		app: any,
		private report: ConsistencyReport
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Vault Consistency Check" });

		const summary = contentEl.createDiv();
		summary.createEl("p", {
			text: `Scanned: ${this.report.totalFiles} files`,
		});

		const c = summary.createEl("p", {
			text: `Complete: ${this.report.completeFiles} files`,
		});
		c.style.color = "var(--color-green, #4caf50)";

		const i = summary.createEl("p", {
			text: `Incomplete: ${this.report.incompleteFiles} files`,
		});
		i.style.color = "var(--color-red, #f44336)";

		const vi = summary.createEl("p", {
			text: `Value issues: ${this.report.valueIssues.length}`,
		});
		vi.style.color = "var(--color-orange, #ff9800)";

		const hasIssues =
			this.report.incompleteFiles > 0 ||
			this.report.valueIssues.length > 0;
		if (!hasIssues) {
			contentEl.createEl("p", { text: "All files are consistent!" });
			return;
		}

		if (this.report.valueIssues.length > 0) {
			this.renderValueIssues();
		}

		if (this.report.incompleteFiles > 0) {
			contentEl.createEl("h3", { text: "Incomplete Files" });
			const list = contentEl.createEl("ul");
			for (const r of this.report.results) {
				const li = list.createEl("li");
				li.createEl("strong", { text: r.file.path });
				li.createEl("br");
				li.createEl("span", {
					text: `Missing: ${r.missingFields.join(", ")}`,
				});
			}
		}
	}

	private renderValueIssues() {
		const { contentEl } = this;
		contentEl.createEl("h3", {
			text: `Value Issues (${this.report.valueIssues.length})`,
		});

		const grouped = this.groupByField(this.report.valueIssues);
		for (const [yamlKey, issues] of grouped) {
			const section = contentEl.createEl("details");
			const summary = section.createEl("summary", {
				text: `${yamlKey} (${issues.length})`,
			});
			summary.style.fontWeight = "bold";

			for (const issue of issues) {
				const p = section.createEl("p");
				p.style.marginLeft = "1em";
				p.style.marginTop = "0.3em";
				p.style.marginBottom = "0.3em";
				p.createEl("span", {
					text: `${issue.file.path}: `,
				});
				const bad = p.createEl("code", {
					text: `"${issue.currentValue}"`,
				});
				bad.style.color = "var(--color-red, #f44336)";
				p.append(" → expected: ");
				const exp = p.createEl("code", {
					text: `[${issue.expectedValues.join(", ")}]`,
				});
				exp.style.color = "var(--color-green, #4caf50)";
			}
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

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
