import { App, Notice } from "obsidian";
import { MetadataFieldConfig } from "../types/MetadataField";

interface DataviewApi {
	pages(source?: string): unknown;
}

function getDataviewApi(app: App): DataviewApi {
	const plugins = (app as unknown as { plugins?: { plugins?: Record<string, unknown> } }).plugins;
	const dataview = plugins?.plugins?.dataview;
	const api = (dataview as { api?: unknown } | undefined)?.api;
	if (!dataview || !api) {
		throw new Error("Dataview plugin not found.");
	}
	return api as DataviewApi;
}

export async function executeDataviewQuery(
	code: string,
	app: App
): Promise<string[]> {
	const dvApi = getDataviewApi(app);

	// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func -- Dataview's JS API only exposes querying through evaluated expressions; the code string is user-defined in the plugin settings
	const fn = new Function("dv", "return " + code) as (dv: unknown) => unknown;
	const result: unknown = fn(dvApi);

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

	const iterable = tryIterable(result);
	if (iterable !== null) {
		return iterable;
	}

	if (typeof result === "object" && result !== null) {
		const withArray = result as { array?: unknown };
		if (typeof withArray.array === "function") {
			const arr = (withArray.array as () => unknown[])();
			return arr ?? [];
		}
	}

	throw new Error(
		`Query result is not an array (type: ${typeof result}, constructor: ${getConstructorName(result)}).`
	);
}

function tryIterable(result: unknown): unknown[] | null {
	if (typeof (result as { [Symbol.iterator]?: unknown })[Symbol.iterator] !== "function") {
		return null;
	}
	try {
		return Array.from(result as Iterable<unknown>);
	} catch {
		return null;
	}
}

function getConstructorName(result: unknown): string {
	const ctor = (result as { constructor?: { name?: string } }).constructor;
	return ctor?.name ?? "unknown";
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
