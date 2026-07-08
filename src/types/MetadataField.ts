/**
 * Metadata field configuration types.
 * Defines the schema for configurable YAML frontmatter fields.
 * Built-in field IDs: fileName, fileFolder, filePath, dateCreated,
 * lastModified, lastMoved. User-defined fields use arbitrary string IDs.
 */
import { EventType } from "./Events";

export type MetadataFieldId = string;
export type FieldType = "text" | "select" | "boolean" | "number" | "multi";
export type ConditionType =
	| "always"
	| "frontmatter"
	| "path"
	| "filename"
	| "folder";
export type ConditionOperator =
	| "exists"
	| "equals"
	| "matches"
	| "contains";

export interface ConditionConfig {
	type: ConditionType;
	frontmatterKey?: string;
	operator?: ConditionOperator;
	value?: string;
}

export interface MetadataFieldConfig {
	id: MetadataFieldId;
	yamlKey: string;
	type?: FieldType;
	options?: string[];
	optionsFile?: string;
	optionsDataview?: string;
	enabled: boolean;
	order: number;
	defaultValue?: string;
	template?: string;
	events?: EventType[];
	isCustom?: boolean;
	condition?: ConditionConfig;
}
