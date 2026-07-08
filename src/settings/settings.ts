/**
 * Settings interface and defaults for the metadata updater plugin.
 */
import { MetadataFieldConfig } from "../types/MetadataField";

export type ProcessingMode = "newOnly" | "allFiles";
export type FilterMode = "exclude" | "include";

export interface PendingMigration {
	fieldId: string;
	oldKey: string;
}

export interface MetadataButlerSettings {
	dateFormat: string;
	fields: MetadataFieldConfig[];
	excludedFolders: string[];
	includedFolders: string[];
	filterMode: FilterMode;
	processingMode: ProcessingMode;
	pendingMigrations?: PendingMigration[];
	orphanedYamlKeys?: string[];
	protectedYamlKeys?: string[];
	yamlGroups: string[];
	groupFile?: string;
}

export const DEFAULT_SETTINGS: MetadataButlerSettings = {
	dateFormat: "YYYY-MM-DD ddd HH:mm:ss",
	fields: [
		{ id: "noteId",       yamlKey: "note.NoteID",       enabled: true,  order: -1, events: ["open"] },
		{ id: "fileName",     yamlKey: "note.FileName",     enabled: true,  order: 0, events: ["open", "rename", "bulk"] },
		{ id: "filePath",     yamlKey: "note.FilePath",     enabled: true,  order: 1, events: ["open", "rename", "bulk"] },
		{ id: "dateCreated",  yamlKey: "dates.DateCreated", enabled: true,  order: 2, events: ["open"] },
		{ id: "noteType",     yamlKey: "note.NoteType",     enabled: true,  order: 2.5, type: "select", options: ["Project", "Note", "Task", "Person", "Meeting", "Reference"], defaultValue: "Note", events: ["open", "rename", "bulk"] },
		{ id: "lastModified", yamlKey: "dates.LastModified",enabled: true,  order: 3, events: ["rename", "bulk"] },
		{ id: "lastMoved",    yamlKey: "dates.LastMoved",    enabled: true,  order: 4, events: ["rename"] },
		{ id: "source",       yamlKey: "Source",            enabled: false, order: 5, events: ["open", "rename", "bulk"], isCustom: true, defaultValue: "" },
		{ id: "tags",         yamlKey: "Tags",              enabled: false, order: 6, events: ["modify", "bulk"],        isCustom: true, defaultValue: "" },
	],
	excludedFolders: [],
	includedFolders: [],
	filterMode: "exclude",
	processingMode: "newOnly",
	pendingMigrations: [],
	orphanedYamlKeys: [],
	protectedYamlKeys: [],
	yamlGroups: ["note", "dates", "special"],
};
