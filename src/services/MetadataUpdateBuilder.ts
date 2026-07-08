/**
 * Builds metadata update payloads from Obsidian file events.
 * Maps field IDs to values based on event type (open/modify/rename).
 * If a field has a template, the TransformEngine resolves it.
 * Fields with conditions are skipped when the condition evaluates to false.
 */
import { App, TFile } from "obsidian";
import { NormalizedEvent } from "../types/Events";
import { MetadataFieldConfig } from "../types/MetadataField";
import { now } from "../utils/DateUtils";
import { TransformEngine, TransformContext } from "./TransformEngine";
import { ConditionEvaluator } from "./ConditionEvaluator";

export class MetadataUpdateBuilder {
	constructor(
		private engine: TransformEngine,
		private app: App
	) {}

	build(
		file: TFile,
		event: NormalizedEvent,
		fields: MetadataFieldConfig[],
		dateFormat: string,
		force?: boolean
	): Record<string, unknown> | null {
		const update: Record<string, unknown> = {};
		const enabledFields = [...fields]
			.filter((f) => f.enabled)
			.sort((a, b) => a.order - b.order);

		const oldFolder =
			event.oldPath !== undefined
				? event.oldPath.split("/").slice(0, -1).join("/")
				: undefined;
		const newFolder = file.parent?.path ?? "";
		const oldName =
			event.oldPath !== undefined
				? event.oldPath.split("/").pop() ?? ""
				: undefined;
		const newName = file.name;

		const eventType = force ? "bulk" : event.type;

		for (const field of enabledFields) {
			if (!force && field.events && !field.events.includes(event.type)) {
				continue;
			}
			if (
				!ConditionEvaluator.evaluate(
					file,
					field.condition,
					this.app
				)
			) {
				continue;
			}

			let value: unknown;

			// Select + multi: Writer's default handler manages values,
			// so template values don't overwrite user selections on every event.
			// Exception: {{lookup:...}} templates are resolved per event
			if (field.type !== "select" && field.type !== "multi" || field.template?.includes("{{lookup:")) {
				if (field.template) {
					const transformCtx: TransformContext = {
						file,
						eventType,
						dateFormat,
						oldPath: event.oldPath,
						oldFolder,
						oldName,
					};
					value = this.engine.resolve(field.template, transformCtx);
				} else {
					value = this.resolveValue(
						field.id,
						eventType,
						file,
						dateFormat,
						{ oldFolder, newFolder, oldName, newName }
					);
				}

				if (value !== undefined && value !== null) {
					// Typkonvertierung nach Template-Resolve
					if (field.type === "boolean" && typeof value === "string") {
						value = value === "true";
					} else if (field.type === "number" && typeof value === "string") {
						const num = Number(value);
						value = Number.isNaN(num) ? undefined : num;
					}
					update[field.id] = value;
				}
			}
		}

		const result = Object.keys(update).length > 0 ? update : null;
		return result;
	}

	private resolveValue(
		id: string,
		eventType: string,
		file: TFile,
		dateFormat: string,
		ctx: {
			oldFolder?: string;
			newFolder: string;
			oldName?: string;
			newName: string;
		}
	): unknown {
		switch (id) {
		case "dateCreated":
			return null;

		case "noteId":
			return null;

		case "noteType":
			return null;

		case "fileName":
				if (eventType === "open" || eventType === "bulk")
					return file.basename;
				if (eventType === "rename" && ctx.oldName !== ctx.newName)
					return file.basename;
				return null;

			case "filePath":
				if (
					eventType === "open" ||
					eventType === "rename" ||
					eventType === "bulk"
				)
					return file.path;
				return null;

			case "lastModified":
				if (eventType === "modify" || eventType === "bulk")
					return now(dateFormat);
				if (eventType === "rename" && ctx.oldName !== ctx.newName)
					return now(dateFormat);
				return null;

			case "lastMoved":
				if (
					eventType === "rename" &&
					ctx.oldFolder !== ctx.newFolder
				)
					return now(dateFormat);
				return null;

			default:
				return null;
		}
	}
}
