/**
 * Plugin entry point. Handles lifecycle (onload/onunload),
 * event registration, and coordinates service orchestration.
 */
import { Notice, Plugin, TFile } from "obsidian";
import {
	MetadataButlerSettings,
	DEFAULT_SETTINGS,
} from "./settings/settings";
import { MetadataButlerSettingTab } from "./settings/SettingsTab";
import { NormalizedEvent } from "./types/Events";
import { EventDeduplicator } from "./services/EventDeduplicator";
import { UpdateQueue } from "./services/UpdateQueue";
import { BatchFlusher } from "./services/BatchFlusher";
import { MetadataUpdateBuilder } from "./services/MetadataUpdateBuilder";
import { MetadataWriter } from "./services/MetadataWriter";
import { PathFilter } from "./services/PathFilter";
import { ScopeManager } from "./services/ScopeManager";
import { TransformEngine } from "./services/TransformEngine";
import { EventType } from "./types/Events";
import { ConsistencyChecker } from "./services/ConsistencyChecker";
import { ConsistencyModal } from "./views/ConsistencyModal";
import { BulkProgressModal } from "./views/BulkProgressModal";
import { SelectFieldModal } from "./views/SelectFieldModal";
import { StandardizerService } from "./services/StandardizerService";
import { StandardizeModal } from "./views/StandardizeModal";
import { BulkRenameModal } from "./views/BulkRenameModal";
import { MetadataFieldConfig } from "./types/MetadataField";
import { getNested } from "./utils/NestedPath";
import { executeDataviewForField } from "./services/DataviewRunner";

const DEFAULT_FIELD_EVENTS: Record<string, EventType[]> = {
	noteId: ["open"],
	dateCreated: ["open"],
	noteType: ["open", "rename", "bulk"],
	lastModified: ["modify", "rename", "bulk"],
	lastMoved: ["rename"],
	fileName: ["open", "rename", "bulk"],
	filePath: ["open", "rename", "bulk"],
	source: ["open", "rename", "bulk"],
	tags: ["modify", "bulk"],
};

export default class MetadataButlerPlugin extends Plugin {
	settings!: MetadataButlerSettings;
	private bulkRunning = false;
	private internalWrite = false;
	private cancelled = false;
	private previousFields: MetadataFieldConfig[] = [];
	private deduplicator = new EventDeduplicator();
	private queue = new UpdateQueue();
	private flusher = new BatchFlusher();
	private engine = new TransformEngine(this.app);
	private builder = new MetadataUpdateBuilder(this.engine, this.app);
	private writer = new MetadataWriter(this.app);
	private checker = new ConsistencyChecker();
	private standardizer = new StandardizerService(this.app);

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		if (!this.settings.pendingMigrations) {
			this.settings.pendingMigrations = [];
		}
		if (!this.settings.orphanedYamlKeys) {
			this.settings.orphanedYamlKeys = [];
		}
		if (!this.settings.protectedYamlKeys) {
			this.settings.protectedYamlKeys = [];
		}
		if (!this.settings.yamlGroups || this.settings.yamlGroups.length === 0) {
			this.settings.yamlGroups = [...DEFAULT_SETTINGS.yamlGroups];
		}
		if (!this.settings.fields.find(f => f.id === "noteType")) {
			this.settings.fields.push({
				id: "noteType", yamlKey: "NoteType", type: "select",
				options: ["Project", "Note", "Task", "Person", "Meeting", "Reference"],
				defaultValue: "Note", enabled: true, order: 2.5,
				events: ["open", "rename", "bulk"], template: ""
			});
		}
		if (!this.settings.fields.find(f => f.id === "noteId")) {
			this.settings.fields.push({
				id: "noteId", yamlKey: "NoteID", type: "text",
				enabled: true, order: -1,
				events: ["open", "rename", "bulk"]
			});
		}
		for (const field of this.settings.fields) {
			if (!field.type) field.type = "text";
			if ((field.type === "select" || field.type === "multi") && !field.options) field.options = [];
		}
		for (const field of this.settings.fields) {
			if (!field.events) {
				field.events = DEFAULT_FIELD_EVENTS[field.id] ?? [
					"open",
					"modify",
					"rename",
					"bulk",
				];
			}
		}
		// Migration: remove modify from lastModified (Konflikt mit update-time-on-edit)
		const lmField = this.settings.fields.find(f => f.id === "lastModified");
		if (lmField && lmField.events && lmField.events.includes("modify" as any)) {
			lmField.events = lmField.events.filter(e => e !== "modify") as EventType[];
			await this.saveSettings();
		}
		this.previousFields = JSON.parse(
			JSON.stringify(this.settings.fields)
		);

		// DataviewJS-Optionen laden (leise — nur Log bei Fehler)
		for (const field of this.settings.fields) {
			if (
				(field.type === "select" || field.type === "multi") &&
				field.optionsDataview &&
				!field.optionsFile
			) {
				try {
					await executeDataviewForField(field, this.app);
				} catch (e) {
					console.warn("MD Butler: Dataview-Load-Fehler:", (e as Error).message);
				}
			}
		}
	}

	async saveSettings() {
		for (const field of this.settings.fields) {
			const prev = this.previousFields.find(
				(f) => f.id === field.id
			);
			if (prev && prev.yamlKey !== field.yamlKey) {
				const existing = this.settings.pendingMigrations!.find(
					(m) => m.fieldId === field.id
				);
				if (existing) {
					existing.oldKey = prev.yamlKey;
				} else {
					this.settings.pendingMigrations!.push({
						fieldId: field.id,
						oldKey: prev.yamlKey,
					});
				}
			}
		}
		for (const prev of this.previousFields) {
			const current = this.settings.fields.find(
				(f) => f.id === prev.id
			);
			if (!current) {
				if (
					!this.settings.orphanedYamlKeys!.includes(
						prev.yamlKey
					)
				) {
					this.settings.orphanedYamlKeys!.push(
						prev.yamlKey
					);
				}
			}
		}
		this.previousFields = JSON.parse(
			JSON.stringify(this.settings.fields)
		);
		await this.saveData(this.settings);
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MetadataButlerSettingTab(this.app, this));
		this.registerEvents();
		this.addCommand({
			id: "md-butler:apply-all",
			name: "Apply Metadata to all Notes",
			callback: async () => await this.bulkUpdateAll(),
		});
		this.addCommand({
			id: "md-butler:check-consistency",
			name: "Vault Consistency Check",
			callback: () => this.checkConsistency(),
		});
		this.addCommand({
			id: "md-butler:cleanup-keys",
			name: "Clean up old YAML keys",
			callback: async () => await this.cleanupOrphanedKeys(),
		});
		this.addCommand({
			id: "md-butler-edit-select-fields",
			name: "Edit select fields in current note",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return false;
				if (!checking) {
					new SelectFieldModal(this.app, this, activeFile).open();
				}
				return true;
			},
		});
		this.addCommand({
			id: "md-butler:force-apply",
			name: "Force-apply metadata to all notes (overwrite all)",
			callback: async () => await this.forceUpdateAll(),
		});
		this.addCommand({
			id: "md-butler:full-repair",
			name: "Full repair: force-apply → cleanup → consistency check",
			callback: async () => await this.fullRepair(),
		});
		this.addCommand({
			id: "md-butler:standardize",
			name: "Standardize field values",
			callback: async () => await this.standardizeValues(),
		});
		this.addCommand({
			id: "md-butler:rename-key",
			name: "Rename YAML key (bulk)",
			callback: () => {
				new BulkRenameModal(this.app, this).open();
			},
		});
	}

	private registerEvents() {
		this.registerEvent(
			this.app.workspace.on(
				"file-open" as any,
				(file: TFile | null) => {
					try {
						if (!file) return;
						this.handleEvent({
							type: "open",
							file,
							timestamp: Date.now(),
							source: "file-open",
						});
					} catch (e) {
						console.error("[MD Butler] error in file-open handler:", e);
					}
				}
			)
		);

		this.registerEvent(
			this.app.vault.on("modify" as any, (file: any) => {
				try {
					if (!(file instanceof TFile)) return;
					this.handleEvent({
						type: "modify",
						file,
						timestamp: Date.now(),
						source: "modify",
					});
				} catch (e) {
					console.error("[MD Butler] error in modify handler:", e);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on(
				"rename" as any,
				(file: any, oldPath: string) => {
					try {
						if (!(file instanceof TFile)) return;
						this.handleEvent({
							type: "rename",
							file,
							oldPath,
							timestamp: Date.now(),
							source: "rename",
						});
					} catch (e) {
						console.error("[MD Butler] error in rename handler:", e);
					}
				}
			)
		);
	}

	private handleEvent(event: NormalizedEvent) {
		if (event.type === "modify" && this.internalWrite) {
			return;
		}
		if (this.bulkRunning) {
			return;
		}
		if (this.deduplicator.isDuplicate(event)) {
			return;
		}
		if (
			PathFilter.isExcluded(
				event.file.path,
				this.settings.excludedFolders,
				this.settings.filterMode,
				this.settings.includedFolders
			)
		) {
			return;
		}

		if (
			event.type === "open" &&
			!ScopeManager.shouldProcess(
				this.app,
				event.file,
				this.settings.processingMode
			)
		) {
			return;
		}

		const update = this.builder.build(
			event.file,
			event,
			this.settings.fields,
			this.settings.dateFormat,
			false
		);

		const hasTypeWithDefault = this.settings.fields.some(f => f.enabled && (
			f.id === "dateCreated" ||
			(f.type === "select" && (f.options?.length ?? 0) > 0) ||
			f.type === "multi" ||
			f.type === "boolean" ||
			f.type === "number"
		));
		const needsWrite = update !== null || hasTypeWithDefault;
		if (!needsWrite) return;

		this.queue.add(event.file, update ?? {}, event.type);

		if (event.type === "open") {
			return;
		}

		if (this.flusher.isFlushing) return;

		this.flusher.schedule(500, async () => {
			await this.runFlush();
		});
	}

	private async runFlush() {
		const items = this.queue.drain();
		if (items.length === 0) return;

		for (const item of items) {
			this.internalWrite = true;
			try {
				await this.writer.write(
					item.file,
					item.update,
					this.settings.fields,
					this.settings.dateFormat,
					undefined,
					undefined,
					this.settings.pendingMigrations,
					this.settings.orphanedYamlKeys,
					false,
					this.settings.protectedYamlKeys,
					item.eventType
				);
			} catch (e) {
				console.error(
					"md-butler: write failed for",
					item.file.path,
					e
				);
			} finally {
				this.internalWrite = false;
			}
		}

		if (this.queue.size() > 0) {
			this.flusher.schedule(100, async () => {
				await this.runFlush();
			});
		}
	}

	private warnIncludeWithoutFolders(): boolean {
		if (
			this.settings.filterMode === "include" &&
			(!this.settings.includedFolders ||
				this.settings.includedFolders.length === 0)
		) {
			new Notice(
				"MD Butler: filterMode 'include' but no folders selected — no files will match."
			);
			return true;
		}
		return false;
	}

	private async bulkUpdateAll() {
		if (this.warnIncludeWithoutFolders()) return;
		const files = this.app.vault.getMarkdownFiles();
		this.cancelled = false;
		const modal = new BulkProgressModal(
			this.app,
			files.length,
			() => (this.cancelled = true)
		);
		modal.open();
		let count = 0;
		let tick = 0;
		for (const file of files) {
			if (this.cancelled) break;
			if (
				PathFilter.isExcluded(
					file.path,
					this.settings.excludedFolders,
					this.settings.filterMode,
					this.settings.includedFolders
				)
			)
				continue;
			if (
				!ScopeManager.shouldProcess(
					this.app,
					file,
					this.settings.processingMode
				)
			)
				continue;

			const event: NormalizedEvent = {
				type: "bulk",
				file,
				timestamp: Date.now(),
				source: "command",
			};
			const update = this.builder.build(
				file,
				event,
				this.settings.fields,
				this.settings.dateFormat,
				false
			);

			const needsWrite = update !== null ||
				this.settings.fields.some(f => f.enabled && (
					f.id === "dateCreated" ||
					(f.type === "select" && (f.options?.length ?? 0) > 0) ||
					f.type === "multi" ||
					f.type === "boolean" ||
					f.type === "number"
				));
			if (!needsWrite) continue;

			this.bulkRunning = true;
			try {
				await this.writer.write(
					file,
					update ?? {},
					this.settings.fields,
					this.settings.dateFormat,
					undefined,
					undefined,
					this.settings.pendingMigrations,
					this.settings.orphanedYamlKeys,
					false,
					this.settings.protectedYamlKeys,
					"bulk"
				);
				count++;
			} catch (e) {
				console.error(
					"md-butler: bulk write failed for",
					file.path,
					e
				);
			} finally {
				this.bulkRunning = false;
			}
			tick++;
			if (tick % 50 === 0) {
				modal.update(count, files.length);
			}
		}
		modal.close();
		await this.removeCompletedMigrations();
		if (this.cancelled) {
			new Notice(`Cancelled after ${count} files.`);
		} else {
			new Notice(
				`Applied metadata to ${count} of ${files.length} notes.`
			);
		}
	}

	previewTemplate(
		template: string,
		file?: TFile | null
	): string | null {
		const target = file ?? this.app.workspace.getActiveFile();
		if (!target) return null;
		const ctx = {
			file: target,
			eventType: "open" as const,
			dateFormat: this.settings.dateFormat,
		};
		return this.engine.resolve(template, ctx);
	}

	private getVaultTags(): string[] | undefined {
		try {
			const tags: Record<string, number> = (
				this.app.metadataCache as any
			).getTags();
			if (!tags) return undefined;
			return Object.keys(tags).map((t) => t.replace(/^#/, ""));
		} catch {
			return undefined;
		}
	}

	private async checkConsistency() {
		const report = await this.checker.check(
			this.app,
			this.settings.fields,
			this.settings.excludedFolders,
			this.settings.includedFolders,
			this.settings.filterMode,
			this.getVaultTags()
		);
		new ConsistencyModal(this.app, report).open();
		await this.removeCompletedMigrations();
	}

	private async standardizeValues() {
		const report = await this.checker.check(
			this.app,
			this.settings.fields,
			this.settings.excludedFolders,
			this.settings.includedFolders,
			this.settings.filterMode,
			this.getVaultTags()
		);
		if (report.valueIssues.length === 0) {
			new Notice("No value issues found. All field values match configured options.");
			return;
		}
		new StandardizeModal(
			this.app,
			report.valueIssues,
			this.standardizer,
			this.settings.protectedYamlKeys ?? []
		).open();
	}

	private async cleanupOrphanedKeys() {
		if (this.warnIncludeWithoutFolders()) return;
		const files = this.app.vault.getMarkdownFiles();
		const orphans = this.settings.orphanedYamlKeys ?? [];
		if (orphans.length === 0) {
			new Notice("No orphaned YAML keys to clean up.");
			return;
		}
		const protect = new Set(
			this.settings.protectedYamlKeys ?? []
		);
		this.cancelled = false;
		const modal = new BulkProgressModal(
			this.app,
			files.length,
			() => (this.cancelled = true)
		);
		modal.open();
		let count = 0;
		let tick = 0;
		for (const file of files) {
			if (this.cancelled) break;
			if (
				PathFilter.isExcluded(
					file.path,
					this.settings.excludedFolders,
					this.settings.filterMode,
					this.settings.includedFolders
				)
			)
				continue;
			let hasChanges = false;
			this.bulkRunning = true;
			try {
				await this.app.fileManager.processFrontMatter(
					file,
					(fm) => {
						for (const key of orphans) {
							if (key in fm && !protect.has(key)) {
								delete fm[key];
								hasChanges = true;
							}
						}
					}
				);
			} catch (e) {
				console.error(
					"md-butler: cleanup failed for",
					file.path,
					e
				);
			} finally {
				this.bulkRunning = false;
			}
			if (hasChanges) count++;
			tick++;
			if (tick % 50 === 0) {
				modal.update(count, files.length);
			}
		}
		modal.close();
		await this.removeCompletedMigrations();
		this.settings.orphanedYamlKeys = [];
		await this.saveSettings();
		if (this.cancelled) {
			new Notice(`Cleanup cancelled after ${count} files.`);
		} else {
			new Notice(
				`Cleaned up old YAML keys in ${count} files.`
			);
		}
	}

	private async forceUpdateAll() {
		if (this.warnIncludeWithoutFolders()) return;
		const files = this.app.vault.getMarkdownFiles();
		this.cancelled = false;
		const modal = new BulkProgressModal(
			this.app,
			files.length,
			() => (this.cancelled = true)
		);
		modal.open();
		let count = 0;
		let tick = 0;
		for (const file of files) {
			if (this.cancelled) break;
			if (
				PathFilter.isExcluded(
					file.path,
					this.settings.excludedFolders,
					this.settings.filterMode,
					this.settings.includedFolders
				)
			)
				continue;

			const event: NormalizedEvent = {
				type: "bulk",
				file,
				timestamp: Date.now(),
				source: "command",
			};
			const update = this.builder.build(
				file,
				event,
				this.settings.fields,
				this.settings.dateFormat,
				true
			);
			if (!update) continue;

			this.bulkRunning = true;
			try {
				await this.writer.write(
					file,
					update,
					this.settings.fields,
					this.settings.dateFormat,
					undefined,
					undefined,
					this.settings.pendingMigrations,
					this.settings.orphanedYamlKeys,
					true,
					this.settings.protectedYamlKeys,
					"bulk"
				);
				count++;
			} catch (e) {
				console.error(
					"md-butler: force write failed for",
					file.path,
					e
				);
			} finally {
				this.bulkRunning = false;
			}
			tick++;
			if (tick % 50 === 0) {
				modal.update(count, files.length);
			}
		}
		modal.close();
		await this.removeCompletedMigrations();
		if (this.cancelled) {
			new Notice(`Force-apply cancelled after ${count} files.`);
		} else {
			new Notice(
				`Force-applied metadata to ${count} of ${files.length} notes.`
			);
		}
	}

	private async fullRepair() {
		new Notice("Full repair: force-applying metadata…");
		await this.forceUpdateAll();
		new Notice("Full repair: cleaning up orphaned keys…");
		await this.cleanupOrphanedKeys();
		new Notice("Full repair: checking consistency…");
		await this.checkConsistency();
		new Notice("Full repair complete.");
	}

	private async removeCompletedMigrations() {
		const pending = this.settings.pendingMigrations ?? [];
		let changed = false;
		for (const m of [...pending]) {
			const field = this.settings.fields.find(
				(f) => f.id === m.fieldId
			);
			if (!field) continue;
			let found = false;
			for (const file of this.app.vault.getMarkdownFiles()) {
				const cache =
					this.app.metadataCache.getFileCache(file);
				if (getNested(cache?.frontmatter ?? {}, m.oldKey) !== undefined) {
					found = true;
					break;
				}
			}
			if (!found) {
				this.settings.pendingMigrations =
					this.settings.pendingMigrations!.filter(
						(p) => p.fieldId !== m.fieldId
					);
				changed = true;
			}
		}
		if (changed) {
			await this.saveSettings();
		}
	}

	onunload() {
		this.flusher.cancel();
		this.deduplicator.clear();
	}
}
