import { App, TFile } from "obsidian";
import { getNested, setNested, hasNested } from "../utils/NestedPath";

export interface ValueFix {
	yamlKey: string;
	currentValue: string;
	newValue: string;
	fieldType: "select" | "multi";
	action?: "replace" | "remove";
}

export type ValueFixMap = Map<string, ValueFix[]>;

export class StandardizerService {
	constructor(private app: App) {}

	async apply(
		selections: ValueFixMap,
		protectedKeys: string[]
	): Promise<number> {
		let totalChanges = 0;
		for (const [filePath, fixes] of selections) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) continue;

			await this.app.fileManager.processFrontMatter(file, (fm) => {
				for (const fix of fixes) {
					if (protectedKeys.includes(fix.yamlKey)) continue;
					if (!hasNested(fm, fix.yamlKey)) continue;

					if (fix.fieldType === "multi") {
						const raw = getNested(fm, fix.yamlKey);
						if (Array.isArray(raw)) {
							const arr = raw as string[];
							const idx = arr.findIndex(
								(v) =>
									typeof v === "string" &&
									v === fix.currentValue
							);
							if (idx !== -1) {
								if (fix.action === "remove") {
									setNested(fm, fix.yamlKey, arr.filter(
										(_, i) => i !== idx
									));
								} else {
									arr[idx] = fix.newValue;
								}
								totalChanges++;
							}
						} else if (typeof raw === "string") {
							const parts = (raw as string)
								.split(",")
								.map((s) => s.trim());
							const idx = parts.findIndex(
								(v) => v === fix.currentValue
							);
							if (idx !== -1) {
								if (fix.action === "remove") {
									setNested(fm, fix.yamlKey, parts
										.filter((_, i) => i !== idx)
										.join(", "));
								} else {
									parts[idx] = fix.newValue;
									setNested(fm, fix.yamlKey, parts.join(", "));
								}
								totalChanges++;
							}
						}
					} else {
						setNested(fm, fix.yamlKey, fix.newValue);
						totalChanges++;
					}
				}
			});
		}
		return totalChanges;
	}
}
