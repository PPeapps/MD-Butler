import { App, TFile } from "obsidian";
import { MetadataFieldConfig } from "../types/MetadataField";
import { PendingMigration } from "../settings/settings";
import { now } from "../utils/DateUtils";
import { ConditionEvaluator } from "./ConditionEvaluator";
import { readOptionsForWriter } from "../utils/SelectUtils";
import { generateNoteId } from "../utils/IdUtils";
import { getNested, setNested, deleteNested, hasNested } from "../utils/NestedPath";

export class MetadataWriter {
	constructor(private app: App) {}

	async write(
		file: TFile,
		update: Record<string, unknown>,
		fields: MetadataFieldConfig[],
		dateFormat: string,
		onBeforeWrite?: () => void,
		onAfterWrite?: () => void,
		pendingMigrations?: PendingMigration[],
		orphanedYamlKeys?: string[],
		force?: boolean,
		protectedYamlKeys?: string[],
		eventType?: string
	): Promise<void> {
		onBeforeWrite?.();
		try {
			for (const sf of fields.filter(f => f.type === "select" && f.enabled)) {
				if ((!sf.options || sf.options.length === 0) && sf.optionsFile) {
					const opts = await readOptionsForWriter(sf, this.app);
					if (opts.length > 0) sf.options = opts;
				}
			}

			const exists = await this.app.vault.adapter.exists(file.path).catch(() => false);
			if (!exists) {
				return;
			}

			const dcField = fields.find((f) => f.id === "dateCreated");
			const dateCreatedEnabled = dcField?.enabled ?? true;
			const protect = new Set(protectedYamlKeys ?? []);
			const isProtected = (key: string) => protect.has(key);

			await this.app.fileManager.processFrontMatter(file, (fm) => {
				if (orphanedYamlKeys && orphanedYamlKeys.length > 0) {
					for (const key of orphanedYamlKeys) {
						if (!isProtected(key)) deleteNested(fm, key);
					}
				}

				if (pendingMigrations && pendingMigrations.length > 0) {
					for (const m of pendingMigrations) {
						const field = fields.find(
							(f) => f.id === m.fieldId
						);
						if (!field) continue;
						if (isProtected(m.oldKey)) continue;
						const oldVal = getNested(fm, m.oldKey);
						if (
							oldVal !== undefined &&
							!hasNested(fm, field.yamlKey)
						) {
							setNested(fm, field.yamlKey, oldVal);
							deleteNested(fm, m.oldKey);
						}
					}
				}

				if (dateCreatedEnabled && dcField) {
					if (!hasNested(fm, dcField.yamlKey) || force) {
						setNested(fm, dcField.yamlKey, now(dateFormat));
					}
				}

			const selectFields = fields.filter(
				(f): f is MetadataFieldConfig & { options: string[] } =>
					f.type === "select" && f.enabled && (f.options?.length ?? 0) > 0
			);
			for (const sf of selectFields) {
				if (!sf.yamlKey) continue;
				if (isProtected(sf.yamlKey)) continue;
				if (hasNested(fm, sf.yamlKey)) continue;
				const val = (sf.template && !sf.template.includes("{{"))
					? sf.template
					: (sf.defaultValue ?? sf.options[0]);
				setNested(fm, sf.yamlKey, val);
			}

				const boolFields = fields.filter(
					f => f.type === "boolean" && f.enabled
				);
				for (const bf of boolFields) {
					if (!bf.yamlKey || isProtected(bf.yamlKey)) continue;
					if (hasNested(fm, bf.yamlKey)) continue;
					const raw = (bf.template && !bf.template.includes("{{"))
						? bf.template
						: bf.defaultValue;
					if (raw !== undefined && raw !== "") {
						setNested(fm, bf.yamlKey, raw === "true");
					}
				}

				const numFields = fields.filter(
					f => f.type === "number" && f.enabled
				);
				for (const nf of numFields) {
					if (!nf.yamlKey || isProtected(nf.yamlKey)) continue;
					if (hasNested(fm, nf.yamlKey)) continue;
					const raw = (nf.template && !nf.template.includes("{{"))
						? nf.template
						: nf.defaultValue;
					if (raw !== undefined && raw !== "") {
						const num = Number(raw);
						if (!Number.isNaN(num)) {
							setNested(fm, nf.yamlKey, num);
						}
					}
				}

				const multiFields = fields.filter(
					f => f.type === "multi" && f.enabled && (f.options?.length ?? 0) > 0
				);
				for (const mf of multiFields) {
					if (!mf.yamlKey || isProtected(mf.yamlKey)) continue;
					if (hasNested(fm, mf.yamlKey)) continue;
					const raw = (mf.template && !mf.template.includes("{{"))
						? mf.template
						: mf.defaultValue;
					if (raw && raw.trim()) {
						setNested(fm, mf.yamlKey, raw
							.split(",")
							.map(s => s.trim())
							.filter(Boolean));
					} else if (mf.defaultValue) {
						setNested(fm, mf.yamlKey, [mf.defaultValue]);
					}
				}

				const orderedFields = [...fields]
					.filter((f) => f.enabled)
					.sort((a, b) => a.order - b.order);

				for (const field of orderedFields) {
					if (isProtected(field.yamlKey)) continue;
				const value = update[field.id];
				if (value !== undefined && value !== null) {
					if (!force && eventType === "bulk" && hasNested(fm, field.yamlKey) && !field.template?.includes("{{lookup:")) {
						continue;
					}
					setNested(fm, field.yamlKey, value);
						continue;
					}
					if (
						field.isCustom &&
						field.defaultValue !== undefined &&
						!hasNested(fm, field.yamlKey)
					) {
						if (
							!field.condition ||
							ConditionEvaluator.evaluateWithFrontmatter(
								file, field.condition, this.app, fm
							)
						) {
							setNested(fm, field.yamlKey, field.defaultValue);
						}
					}
				}

				for (const field of orderedFields) {
					if (!field.condition || isProtected(field.yamlKey)) continue;
					if (!hasNested(fm, field.yamlKey)) continue;
					if (
						!ConditionEvaluator.evaluateWithFrontmatter(
							file, field.condition, this.app, fm
						)
					) {
						deleteNested(fm, field.yamlKey);
					}
				}

				const noteIdField = fields.find(f => f.id === "noteId" && f.enabled);
				if (noteIdField) {
					const yamlKey = noteIdField.yamlKey;
					if (!hasNested(fm, yamlKey)) {
						const mig = pendingMigrations?.find(m => m.fieldId === "noteId");
						const oldVal = mig ? getNested(fm, mig.oldKey) : undefined;
						if (oldVal !== undefined) {
							setNested(fm, yamlKey, oldVal);
							deleteNested(fm, mig!.oldKey);
						} else {
							setNested(fm, yamlKey, generateNoteId());
						}
						const isNested = yamlKey.includes(".");
						if (isNested) {
							const group = yamlKey.split(".")[0]!;
							const ordered: Record<string, unknown> = {};
							ordered[group] = fm[group];
							for (const key of Object.keys(fm)) {
								if (key !== group) ordered[key] = fm[key];
							}
							Object.keys(fm).forEach(k => delete (fm as Record<string, unknown>)[k]);
							Object.assign(fm, ordered);
						} else {
							const ordered: Record<string, unknown> = {};
							ordered[yamlKey] = fm[yamlKey] as string;
							for (const key of Object.keys(fm)) {
								if (key !== yamlKey) ordered[key] = fm[key];
							}
							Object.keys(fm).forEach(k => delete (fm as Record<string, unknown>)[k]);
							Object.assign(fm, ordered);
						}
					}
				}
			});
		} finally {
			onAfterWrite?.();
		}
	}
}
