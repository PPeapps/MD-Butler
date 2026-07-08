import { App, Notice } from "obsidian";
import { MetadataFieldConfig } from "../types/MetadataField";

export async function executeDataviewQuery(
	code: string,
	app: App
): Promise<string[]> {
	const dvApi = (app as any).plugins?.plugins?.dataview?.api;
	if (!dvApi) {
		throw new Error("Dataview plugin not found.");
	}

	const fn = new Function("dv", "return " + code);
	const result = fn(dvApi);

	if (result instanceof Promise) {
		return processResult(await result);
	}
	return processResult(result);
}

function processResult(result: unknown): string[] {
	const arr = toArray(result);
	return arr.map(String).filter((s) => s.length > 0);
}

function toArray(result: unknown): unknown[] {
	if (result == null) {
		throw new Error("Query returned null or undefined.");
	}

	if (Array.isArray(result)) {
		return result;
	}

	try {
		return Array.from(result as Iterable<unknown>);
	} catch {}

	if (typeof result === "object" && typeof (result as any).array === "function") {
		return (result as any).array();
	}

	throw new Error(
		`Query result is not an array (type: ${typeof result}, constructor: ${(result as any)?.constructor?.name ?? "unknown"}).`
	);
}

export async function executeDataviewForField(
	field: MetadataFieldConfig,
	app: App
): Promise<void> {
	if (!field.optionsDataview) return;

	try {
		const options = await executeDataviewQuery(field.optionsDataview, app);
		field.options = options;
		new Notice(
			`MD Butler: ${options.length} Optionen per Dataview geladen.`
		);
	} catch (e) {
		console.warn("MD Butler: Dataview-Fehler:", (e as Error).message);
		new Notice(`MD Butler: Dataview-Fehler: ${(e as Error).message}`);
	}
}
