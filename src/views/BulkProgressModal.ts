/**
 * Modal showing bulk-update progress with a cancel button.
 * Updates are throttled (every 50 files) to avoid UI jank.
 */
import { Modal } from "obsidian";

export class BulkProgressModal extends Modal {
	private progressEl!: HTMLElement;
	private cancelBtn!: HTMLButtonElement;
	private _cancelled = false;

	constructor(
		app: any,
		private total: number,
		private onCancel: () => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Bulk Metadata Update" });
		this.progressEl = contentEl.createEl("p", {
			text: `Processing 0 / ${this.total} files`,
		});
		this.cancelBtn = contentEl.createEl("button", { text: "Cancel" });
		this.cancelBtn.addEventListener("click", () => {
			this._cancelled = true;
			this.onCancel();
			this.cancelBtn.disabled = true;
			this.cancelBtn.setText("Cancelling...");
		});
	}

	update(current: number, _total?: number) {
		this.progressEl.setText(`Processed ${current} / ${this.total} files`);
	}

	get cancelled(): boolean {
		return this._cancelled;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
