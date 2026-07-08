/**
 * Suggest modal for browsing and selecting vault markdown files.
 * Filters files as the user types, returns TFile via callback.
 */
import { App, SuggestModal, TFile } from "obsidian";

export class FileSuggestModal extends SuggestModal<TFile> {
	constructor(
		app: App,
		private onSelectCallback: (file: TFile) => void
	) {
		super(app);
		this.setPlaceholder("Type or select a file…");
	}

	getSuggestions(input: string): TFile[] {
		const files = this.app.vault.getMarkdownFiles().sort((a, b) =>
			a.path.localeCompare(b.path)
		);
		if (!input) return files.slice(0, 100);
		const lower = input.toLowerCase();
		return files.filter(
			(f) =>
				f.path.toLowerCase().includes(lower) ||
				f.basename.toLowerCase().includes(lower)
		);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	onChooseSuggestion(file: TFile): void {
		this.onSelectCallback(file);
	}
}
