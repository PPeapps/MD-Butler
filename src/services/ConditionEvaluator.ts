import { App, TFile } from "obsidian";
import { ConditionConfig } from "../types/MetadataField";
import { getNested } from "../utils/NestedPath";

export class ConditionEvaluator {
	static evaluate(
		file: TFile,
		condition: ConditionConfig | undefined,
		app: App
	): boolean {
		return ConditionEvaluator.evaluateWithFrontmatter(
			file,
			condition,
			app
		);
	}

	static evaluateWithFrontmatter(
		file: TFile,
		condition: ConditionConfig | undefined,
		app: App,
		fm?: Record<string, any>
	): boolean {
		if (!condition || condition.type === "always") return true;

		switch (condition.type) {
			case "frontmatter":
				return ConditionEvaluator.evalFrontmatter(
					file,
					condition,
					app,
					fm
				);
			case "path":
				return ConditionEvaluator.evalString(
					file.path,
					condition
				);
			case "filename":
				return ConditionEvaluator.evalString(
					file.name,
					condition
				);
			case "folder":
				return ConditionEvaluator.evalString(
					file.parent?.path ?? "",
					condition
				);
			default:
				return true;
		}
	}

	private static evalFrontmatter(
		file: TFile,
		condition: ConditionConfig,
		app: App,
		fm?: Record<string, any>
	): boolean {
		const key = condition.frontmatterKey;
		if (!key) return false;
		const frontmatter = fm !== undefined ? fm : (app.metadataCache.getFileCache(file)?.frontmatter ?? {});
		const val = getNested(frontmatter, key);

		if (condition.operator === "exists") {
			return val !== undefined;
		}
		if (val === undefined || val === null) return false;
		return ConditionEvaluator.matchValue(
			String(val),
			condition
		);
	}

	private static evalString(
		target: string,
		condition: ConditionConfig
	): boolean {
		const cmp = condition.value ?? "";
		return ConditionEvaluator.matchValue(target, {
			...condition,
			value: cmp,
		});
	}

	private static matchValue(
		target: string,
		condition: ConditionConfig
	): boolean {
		const cmp = condition.value ?? "";
		switch (condition.operator) {
			case "equals":
				return target === cmp;
			case "matches":
				try {
					return new RegExp(cmp).test(target);
				} catch {
					return false;
				}
		case "contains":
			return target.includes(cmp);
		default:
			return false;
		}
	}
}
