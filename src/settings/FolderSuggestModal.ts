/**
 * Suggest modal for browsing and selecting vault folders.
 * Filters folders as the user types, appends selection via callback.
 */
import { App, SuggestModal, TFolder } from "obsidian";

export class FolderSuggestModal extends SuggestModal<string> {
	constructor(
		app: App,
		private onSelectCallback: (folderPath: string) => void
	) {
		super(app);
		this.setPlaceholder("Type or select a folder…");
	}

	getSuggestions(input: string): string[] {
		const folders: string[] = [];
		for (const file of this.app.vault.getAllLoadedFiles()) {
			if (file instanceof TFolder && file.path !== "") {
				folders.push(file.path);
			}
		}
		folders.sort((a, b) => {
			const aDepth = a.split("/").length;
			const bDepth = b.split("/").length;
			if (aDepth !== bDepth) return aDepth - bDepth;
			return a.localeCompare(b);
		});
		if (!input) return folders;
		return folders.filter((f) =>
			f.toLowerCase().includes(input.toLowerCase())
		);
	}

	renderSuggestion(folderPath: string, el: HTMLElement): void {
		el.setText(folderPath);
	}

	onChooseSuggestion(folderPath: string): void {
		this.onSelectCallback(folderPath);
	}
}
