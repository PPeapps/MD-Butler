/**
 * Drag-and-drop field list with toggle, yamlKey editor, and reordering.
 * Allows users to enable/disable fields and change their YAML key mapping.
 * Template preview can target any vault file via file selector button.
 */
import {
	ToggleComponent,
	TextComponent,
	DropdownComponent,
	TFile,
	Notice,
} from "obsidian";
import {
	MetadataFieldConfig,
	FieldType,
	ConditionType,
	ConditionOperator,
} from "../types/MetadataField";
import { EventType } from "../types/Events";
import MetadataButlerPlugin from "../main";

import { FileSuggestModal } from "./FileSuggestModal";
import { loadOptionsFromFile } from "../utils/SelectUtils";
import { executeDataviewForField } from "../services/DataviewRunner";
import { getNested } from "../utils/NestedPath";

const ALL_EVENT_TYPES: EventType[] = ["open", "modify", "rename", "bulk"];
const FORBIDDEN_EVENTS: Record<string, EventType[]> = {
	lastModified: ["modify"],
};
const FIXED_EVENTS_FIELDS = new Set(["noteId", "dateCreated"]);

const DEFAULT_GROUP: Record<string, string> = {
	noteId: "note",
	noteType: "note",
	fileName: "note",
	filePath: "note",
	dateCreated: "dates",
	lastModified: "dates",
	lastMoved: "dates",
};

const CONDITION_TYPES: ConditionType[] = [
	"always",
	"frontmatter",
	"path",
	"filename",
	"folder",
];
const CONDITION_OPERATORS: ConditionOperator[] = [
	"exists",
	"equals",
	"matches",
	"contains",
];

const GROUP_LOCKED_FIELDS = new Set(["tags"]);

export class FieldListComponent {
	private previewFiles = new Map<string, TFile>();
	constructor(
		private containerEl: HTMLElement,
		private plugin: MetadataButlerPlugin
	) { }

	public render(): void {
		this.containerEl.empty();

		/* Groups Config */
		const groupsRow = this.containerEl.createDiv({
			cls: "md-butler-field-row",
			attr: { style: "margin-bottom: 4px;" }
		});
		groupsRow.createSpan({ text: "YAML-Groups:", cls: "md-butler-field-id" });
		new TextComponent(groupsRow)
			.setValue(this.plugin.settings.yamlGroups.join(", "))
			.setPlaceholder("comma-sep. group names")
			.onChange(async (value) => {
				this.plugin.settings.yamlGroups = value.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
				await this.plugin.saveSettings();
				this.render();
			});

		/* Group File Button */
		const fileRow = this.containerEl.createDiv({
			cls: "md-butler-field-row",
			attr: { style: "margin-bottom: 8px;" }
		});
		const fileBtn = fileRow.createEl("button", {
			text: "📁",
			cls: "md-butler-file-btn",
			attr: { title: "Gruppen aus .md-Datei importieren" }
		});
		const statusText = fileRow.createSpan({
			text: this.plugin.settings.groupFile ? `(from: ${this.plugin.settings.groupFile})` : ""
		});
		if (this.plugin.settings.groupFile) {
			const clearBtn = fileRow.createEl("button", {
				text: "✕",
				cls: "md-butler-clear-btn",
				attr: { title: "Group-Datei-Referenz entfernen" }
			});
			clearBtn.addEventListener("click", async () => {
				this.plugin.settings.groupFile = undefined;
				await this.plugin.saveSettings();
				this.render();
			});
		}
		fileBtn.addEventListener("click", async () => {
			new FileSuggestModal(this.plugin.app, async (file: TFile) => {
				this.plugin.settings.groupFile = file.path;
				let items: string[] = [];
				const fm = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
				if (fm?.groups && Array.isArray(fm.groups)) {
					items = fm.groups.map(String);
				} else {
					try {
						const content = await this.plugin.app.vault.read(file);
						items = content
							.split("\n")
							.map(l => l.trim())
							.filter(l => l.length > 0 && !l.startsWith("---"));
					} catch { /* silent */ }
				}
				for (const g of items) {
					if (!this.plugin.settings.yamlGroups.includes(g)) {
						this.plugin.settings.yamlGroups.push(g);
					}
				}
				await this.plugin.saveSettings();
				this.render();
			}).open();
		});

		const groups = this.plugin.settings.yamlGroups;

		const fields = [...this.plugin.settings.fields].sort(
			(a, b) => a.order - b.order
		);

		fields.forEach((field, index) => {
			const row = this.containerEl.createDiv({
				cls: "md-butler-field-row",
				attr: {
					style:
						"display: flex; flex-wrap: wrap; align-items: center; gap: 4px;",
				},
			});

			row.draggable = true;

			/* Drag Handle */
			row.createSpan({
				text: "☰",
				cls: "md-butler-drag-handle",
			});

			/* Internal Field ID */
			if (field.isCustom) {
				const idContainer = row.createDiv();
				new TextComponent(idContainer)
					.setValue(field.id)
					.onChange(async (value) => {
						field.id = value.trim() || field.id;
						await this.plugin.saveSettings();
					});
			} else {
				row.createSpan({
					text: field.id,
					cls: "md-butler-field-id",
				});
			}

				const yamlContainer = row.createDiv();
			const dotIdx = field.yamlKey.indexOf(".");
			const knownGroup = dotIdx > 0 && groups.includes(field.yamlKey.slice(0, dotIdx))
				? field.yamlKey.slice(0, dotIdx) : null;
			const currentGroup = knownGroup ?? "(none)";
			const restKey = knownGroup ? field.yamlKey.slice(dotIdx + 1) : field.yamlKey;

			if (GROUP_LOCKED_FIELDS.has(field.id)) {
				yamlContainer.createSpan({ text: "(none)", cls: "md-butler-field-id" });
			} else {
				new DropdownComponent(yamlContainer)
					.addOption("(none)", "(none)")
					.addOptions(Object.fromEntries(groups.map(g => [g, g])))
					.setValue(currentGroup)
					.onChange(async (group) => {
						const rk = field.yamlKey.includes(".")
							? field.yamlKey.slice(field.yamlKey.indexOf(".") + 1)
							: field.yamlKey;
						field.yamlKey = group === "(none)" ? rk : group + "." + rk;
						await this.plugin.saveSettings();
						this.render();
					});
			}

			new TextComponent(yamlContainer)
				.setValue(restKey)
				.setPlaceholder("key")
				.onChange(async (value) => {
					const currentKey = field.yamlKey ?? "";
					const prefix = currentKey.includes(".") ? currentKey.split(".")[0]! : null;
					const g = prefix && groups.includes(prefix) ? prefix : null;
					field.yamlKey = g ? g + "." + value.trim() : value.trim();
					await this.plugin.saveSettings();
				});

			/* Type Dropdown */
			const typeContainer = row.createDiv();
			new DropdownComponent(typeContainer)
				.addOption("text", "text")
				.addOption("select", "select")
				.addOption("boolean", "boolean")
				.addOption("number", "number")
				.addOption("multi", "multi")
				.setValue(field.type ?? "text")
				.onChange(async (v) => {
					field.type = v as FieldType;
					if (v === "select" || v === "multi") {
						if (!field.options) field.options = [];
					} else {
						field.options = undefined;
						if (v !== "boolean" && v !== "number") {
							field.defaultValue = undefined;
						}
					}
					await this.plugin.saveSettings();
					this.render();
				});

			/* Template / Options (based on type) */
			if (field.type === "select") {
				/* Options Textarea */
				const optContainer = row.createDiv();
				new TextComponent(optContainer)
					.setValue(field.options?.join("\n") ?? "")
					.setPlaceholder("comma-sep. or one per line")
					.onChange(async (value) => {
						field.options = value.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
						await this.plugin.saveSettings();
					});

				/* Options File Button (select fields only) */
				const fileRow = row.createDiv({ cls: "md-butler-field-row" });
				const fileBtn = fileRow.createEl("button", {
					text: "📁",
					cls: "md-butler-file-btn",
					attr: { title: "Options aus .md-Datei laden" }
				});
				const statusText = fileRow.createSpan({
					text: field.optionsFile ? `(from: ${field.optionsFile})` : ""
				});
				if (field.optionsFile) {
					const clearFileBtn = fileRow.createEl("button", {
						text: "✕",
						cls: "md-butler-clear-btn",
						attr: { title: "Options-Datei entfernen" }
					});
					clearFileBtn.addEventListener("click", async () => {
						field.optionsFile = undefined;
						field.options = [];
						await this.plugin.saveSettings();
						this.render();
					});
				}
				fileBtn.addEventListener("click", async () => {
					new FileSuggestModal(this.plugin.app, async (file: TFile) => {
						field.optionsFile = file.path;
						await loadOptionsFromFile(field, this.plugin.app);
						await this.plugin.saveSettings();
						this.render();
					}).open();
				});

				/* DataviewJS Button + Query (select) */
				const dvBtn = fileRow.createEl("button", {
					text: "📊",
					cls: "md-butler-dataview-btn",
					attr: { title: "Optionen per DataviewJS generieren" }
				});
				let dvExpanded = false;
				const dvContainer = row.createDiv({
					attr: { style: "display: none; flex: 0 0 100%;" }
				});
				dvBtn.addEventListener("click", () => {
					dvExpanded = !dvExpanded;
					dvContainer.style.display = dvExpanded ? "block" : "none";
				});
				const dvTextarea = new TextComponent(dvContainer);
				dvTextarea
					.setValue(field.optionsDataview ?? "")
					.setPlaceholder("dv.pages()...")
					.onChange(async (v) => {
						field.optionsDataview = v.trim() || undefined;
						await this.plugin.saveSettings();
					});
				dvTextarea.inputEl.setAttr("rows", 4);
				const execBtn = dvContainer.createEl("button", {
					text: "▶ Ausführen",
					cls: "md-butler-exec-btn",
				});
				execBtn.addEventListener("click", async () => {
					await executeDataviewForField(field, this.plugin.app);
					await this.plugin.saveSettings();
					this.render();
				});

				/* Default Value (select fields) */
				const defContainer = row.createDiv();
				new TextComponent(defContainer)
					.setValue(field.defaultValue ?? "")
					.setPlaceholder("Default value (first option if empty)")
					.onChange(async (value) => {
						field.defaultValue = value.trim() || undefined;
						await this.plugin.saveSettings();
					});

				/* Template Dropdown (select fields) */
				const tmplContainer = row.createDiv();
				const opts = field.options ?? [];
				const tmplDropdown = new DropdownComponent(tmplContainer);
				tmplDropdown.addOption("", "(none)");
				for (const o of opts) {
					tmplDropdown.addOption(o, o);
				}
				tmplDropdown.setValue(field.template ?? "");
				tmplDropdown.onChange(async (v) => {
					field.template = v || "";
					if (field.template) field.defaultValue = undefined;
					await this.plugin.saveSettings();
					this.render();
				});
			} else if (field.type === "multi") {
				/* Options Textarea (multi) */
				const optContainer = row.createDiv();
				new TextComponent(optContainer)
					.setValue(field.options?.join("\n") ?? "")
					.setPlaceholder("comma-sep. or one per line")
					.onChange(async (value) => {
						field.options = value.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
						await this.plugin.saveSettings();
					});

				/* Options File Button + Dataview (multi) */
				const fileRow = row.createDiv({ cls: "md-butler-field-row" });
				const fileBtn = fileRow.createEl("button", {
					text: "📁",
					cls: "md-butler-file-btn",
					attr: { title: "Options aus .md-Datei laden" }
				});
				const statusText = fileRow.createSpan({
					text: field.optionsFile ? `(from: ${field.optionsFile})` : ""
				});
				if (field.optionsFile) {
					const clearFileBtn = fileRow.createEl("button", {
						text: "✕",
						cls: "md-butler-clear-btn",
						attr: { title: "Options-Datei entfernen" }
					});
					clearFileBtn.addEventListener("click", async () => {
						field.optionsFile = undefined;
						field.options = [];
						await this.plugin.saveSettings();
						this.render();
					});
				}
				fileBtn.addEventListener("click", async () => {
					new FileSuggestModal(this.plugin.app, async (file: TFile) => {
						field.optionsFile = file.path;
						await loadOptionsFromFile(field, this.plugin.app);
						await this.plugin.saveSettings();
						this.render();
					}).open();
				});
				const dvBtn = fileRow.createEl("button", {
					text: "📊",
					cls: "md-butler-dataview-btn",
					attr: { title: "Optionen per DataviewJS generieren" }
				});
				let dvExpanded = false;
				const dvContainer = row.createDiv({
					attr: { style: "display: none; flex: 0 0 100%;" }
				});
				dvBtn.addEventListener("click", () => {
					dvExpanded = !dvExpanded;
					dvContainer.style.display = dvExpanded ? "block" : "none";
				});
				const dvTextarea = new TextComponent(dvContainer);
				dvTextarea
					.setValue(field.optionsDataview ?? "")
					.setPlaceholder("dv.pages()...")
					.onChange(async (v) => {
						field.optionsDataview = v.trim() || undefined;
						await this.plugin.saveSettings();
					});
				dvTextarea.inputEl.setAttr("rows", 4);
				const execBtn = dvContainer.createEl("button", {
					text: "▶ Ausführen",
					cls: "md-butler-exec-btn",
				});
				execBtn.addEventListener("click", async () => {
					await executeDataviewForField(field, this.plugin.app);
					await this.plugin.saveSettings();
					this.render();
				});

				/* Default Value (multi) */
				const defContainer = row.createDiv();
				new TextComponent(defContainer)
					.setValue(field.defaultValue ?? "")
					.setPlaceholder("Default: A, B, C")
					.onChange(async (value) => {
						field.defaultValue = value.trim() || undefined;
						await this.plugin.saveSettings();
					});

				/* Template (multi) */
				const tmplContainer = row.createDiv();
				new TextComponent(tmplContainer)
					.setValue(field.template ?? "")
					.setPlaceholder("Template ({{title}}, {{date:…}}, …)")
					.onChange(async (value) => {
						field.template = value.trim() || undefined;
						if (field.template) field.defaultValue = undefined;
						await this.plugin.saveSettings();
					});
			} else if (field.type === "boolean") {
				/* Default Value (boolean) */
				const defContainer = row.createDiv();
				new DropdownComponent(defContainer)
					.addOption("", "(none)")
					.addOption("true", "true")
					.addOption("false", "false")
					.setValue(field.defaultValue ?? "")
					.onChange(async (v) => {
						field.defaultValue = v || undefined;
						await this.plugin.saveSettings();
					});

				/* Template (boolean) */
				const tmplContainer = row.createDiv();
				new TextComponent(tmplContainer)
					.setValue(field.template ?? "")
					.setPlaceholder("Template ({{title}}, {{date:…}}, …)")
					.onChange(async (value) => {
						field.template = value.trim() || undefined;
						if (field.template) field.defaultValue = undefined;
						await this.plugin.saveSettings();
					});
			} else if (field.type === "number") {
				/* Default Value (number) */
				const defContainer = row.createDiv();
				const numInput = new TextComponent(defContainer);
				numInput.inputEl.type = "number";
				numInput.setValue(field.defaultValue ?? "")
					.setPlaceholder("42")
					.onChange(async (value) => {
						field.defaultValue = value.trim() || undefined;
						await this.plugin.saveSettings();
					});

				/* Template (number) */
				const tmplContainer = row.createDiv();
				new TextComponent(tmplContainer)
					.setValue(field.template ?? "")
					.setPlaceholder("Template ({{title}}, {{date:…}}, …)")
					.onChange(async (value) => {
						field.template = value.trim() || undefined;
						if (field.template) field.defaultValue = undefined;
						await this.plugin.saveSettings();
					});
			} else {
				const templateContainer = row.createDiv();
				const templateInput = new TextComponent(templateContainer)
					.setValue(field.template ?? "")
					.setPlaceholder(
						"Template ({{title}}, {{date:…}}, {{now+7d}}, …)"
					)
					.onChange(async (value) => {
						field.template = value.trim() || undefined;
						if (field.template) field.defaultValue = undefined;
						await this.plugin.saveSettings();
						updatePreview();
					});

				const previewSpan = templateContainer.createSpan({
					attr: {
						style:
							"margin-left: 8px; font-size: 0.85em; opacity: 0.7;",
					},
				});
				const fileBtn = templateContainer.createEl("button", {
					text: "📁",
					cls: "md-butler-file-btn",
					attr: {
						style:
							"font-size: 0.85em; margin-left: 4px; cursor: pointer;",
						title: "Preview against a different file",
					},
				});
				fileBtn.addEventListener("click", () => {
					new FileSuggestModal(
						this.plugin.app,
						(file: TFile) => {
							this.previewFiles.set(field.id, file);
							updatePreview();
						}
					).open();
				});
				const getPreviewFile = (): TFile | null => {
					return this.previewFiles.get(field.id) ?? null;
				};
				const updatePreview = () => {
					const raw = templateInput.getValue().trim();
					if (!raw) {
						previewSpan.setText("");
						return;
					}
					const result = this.plugin.previewTemplate(
						raw,
						getPreviewFile()
					);
					previewSpan.setText(
						result !== null ? `→ ${result}` : "—"
					);
				};
				updatePreview();
			}

			/* Events (all fields) — full width, wraps to new line */
			const eventsContainer = row.createDiv({
				attr: { style: "flex: 0 0 100%; margin-top: 4px;" },
			});

			if (FIXED_EVENTS_FIELDS.has(field.id)) {
				const fixedEvents = field.events ?? ALL_EVENT_TYPES;
				eventsContainer.createSpan({
					text: `Events: ${fixedEvents.join(", ")} (fixed)`,
					attr: { style: "opacity: 0.6; font-size: 0.9em;" }
				});
			} else {
				const currentEvents = field.events ?? ALL_EVENT_TYPES;
				const forbidden = FORBIDDEN_EVENTS[field.id] ?? [];
				for (const et of ALL_EVENT_TYPES) {
					if (forbidden.includes(et)) continue;
					const label = eventsContainer.createEl("label");
					label.style.marginRight = "12px";
					label.style.cursor = "pointer";
					const cb = label.createEl("input", {
						attr: { type: "checkbox" },
					});
					cb.checked = currentEvents.includes(et);
					cb.addEventListener("change", () => {
						const cur = field.events ?? ALL_EVENT_TYPES;
						if (cb.checked && !cur.includes(et)) {
							field.events = [...cur, et];
						} else if (!cb.checked && cur.includes(et)) {
							field.events = cur.filter((e) => e !== et);
						}
						this.plugin.saveSettings();
					});
					label.appendText(` ${et}`);
				}
			}

			/* Condition — collapsible inline row */
			const conditionBtn = row.createEl("button", {
				text: field.condition ? "⚙" : "+",
				cls: "md-butler-condition-btn",
				attr: {
					style:
						"font-size: 0.85em; margin-left: 4px; cursor: pointer;",
				},
			});
			let conditionExpanded = false;
			const conditionBody = row.createDiv({
				attr: {
					style:
						"flex: 0 0 100%; display: none; gap: 4px; align-items: center;",
				},
			});
			conditionBtn.addEventListener("click", () => {
				conditionExpanded = !conditionExpanded;
				conditionBody.style.display = conditionExpanded
					? "flex"
					: "none";
				if (!conditionExpanded && !field.condition) {
					conditionBtn.setText("+");
				} else if (field.condition) {
					conditionBtn.setText("⚙");
				}
			});
			(() => {
				if (!field.condition) {
					field.condition = { type: "always" };
				}
				const cond = field.condition;

				const typeDropdown = new DropdownComponent(
					conditionBody
				);
				for (const t of CONDITION_TYPES) {
					typeDropdown.addOption(t, t);
				}
				typeDropdown.setValue(cond.type);
				typeDropdown.onChange(async (val) => {
					cond.type = val as ConditionType;
					if (val !== "frontmatter") {
						cond.frontmatterKey = undefined;
					}
					if (val === "always") {
						cond.operator = undefined;
						cond.value = undefined;
					}
					await this.plugin.saveSettings();
					renderConditionUI();
				});

				const fmKeyInput = new TextComponent(conditionBody);
				fmKeyInput.setPlaceholder("frontmatter key");
				const opDropdown = new DropdownComponent(
					conditionBody
				);
				for (const o of CONDITION_OPERATORS) {
					opDropdown.addOption(o, o);
				}
				const valInput = new TextComponent(conditionBody);
				valInput.setPlaceholder("value");

				const renderConditionUI = () => {
					const isFm =
						cond.type === "frontmatter";
					fmKeyInput.inputEl.style.display = isFm
						? "inline"
						: "none";
					if (isFm) {
						fmKeyInput.setValue(
							cond.frontmatterKey ?? ""
						);
					}

					const showOpVal =
						cond.type !== "always";
					opDropdown.selectEl.style.display = showOpVal
						? "inline"
						: "none";
					valInput.inputEl.style.display = showOpVal
						? "inline"
						: "none";
					if (showOpVal) {
						if (!cond.operator) cond.operator = "contains";
						opDropdown.setValue(cond.operator);
						valInput.setValue(cond.value ?? "");
					}

					const hideVal =
						!showOpVal ||
						cond.operator === "exists";
					valInput.inputEl.style.display = hideVal
						? "none"
						: "inline";
				};

				fmKeyInput.onChange(async (val) => {
					cond.frontmatterKey =
						val.trim() || undefined;
					await this.plugin.saveSettings();
				});
				opDropdown.onChange(async (val) => {
					cond.operator =
						val as ConditionOperator;
					renderConditionUI();
					await this.plugin.saveSettings();
				});
				valInput.onChange(async (val) => {
					cond.value = val.trim() || undefined;
					await this.plugin.saveSettings();
				});

				renderConditionUI();
			})();

			/* Default Value (custom text fields only, hidden when template is set) */
			if (field.isCustom && field.type !== "select" && !field.template) {
				const defaultContainer = row.createDiv();
				new TextComponent(defaultContainer)
					.setValue(field.defaultValue ?? "")
					.setPlaceholder("default")
					.onChange(async (value) => {
						field.defaultValue =
							value.trim() || undefined;
						await this.plugin.saveSettings();
					});
			}

			/* Enabled Toggle */
			const toggleContainer = row.createDiv();
			new ToggleComponent(toggleContainer)
				.setValue(field.enabled)
				.onChange(async (value) => {
					field.enabled = value;
					await this.plugin.saveSettings();
				});

			/* Delete Button (custom fields only) */
			if (field.isCustom) {
				const deleteBtn = row.createEl("button", {
					text: "✕",
					cls: "md-butler-delete-btn",
				});
				deleteBtn.addEventListener("click", async () => {
					this.plugin.settings.fields =
						this.plugin.settings.fields.filter(
							(f) => f !== field
						);
					await this.plugin.saveSettings();
					this.render();
				});
			}

			/* DRAG START */
			row.addEventListener("dragstart", (event) => {
				row.classList.add("dragging");
				event.dataTransfer?.setData(
					"text/plain",
					index.toString()
				);
				event.dataTransfer!.effectAllowed = "move";
			});

			/* DRAG END */
			row.addEventListener("dragend", () => {
				row.classList.remove("dragging");
			});

			/* DRAG OVER */
			row.addEventListener("dragover", (event) => {
				event.preventDefault();
				row.classList.add("drag-over");
			});

			/* DRAG LEAVE */
			row.addEventListener("dragleave", () => {
				row.classList.remove("drag-over");
			});

			/* DROP */
			row.addEventListener("drop", async (event) => {
				event.preventDefault();
				row.classList.remove("drag-over");
				const fromIndex = Number(
					event.dataTransfer?.getData("text/plain")
				);
				const toIndex = index;
				if (
					Number.isNaN(fromIndex) ||
					fromIndex === toIndex
				) {
					return;
				}
				await this.moveField(fromIndex, toIndex);
			});
		});

		/* Add Field Button */
		const addBtn = this.containerEl.createEl("button", {
			text: "+ Add Field",
			cls: "md-butler-add-field-btn",
		});
		addBtn.addEventListener("click", async () => {
			const existing = this.plugin.settings.fields;
			const maxOrder = existing.reduce(
				(max, f) => Math.max(max, f.order),
				-1
			);
			let counter = 0;
			let newId = "customField";
			while (existing.some((f) => f.id === newId)) {
				counter++;
				newId = `customField${counter}`;
			}
			const newField: MetadataFieldConfig = {
				id: newId,
				yamlKey:
					newId.charAt(0).toUpperCase() +
					newId.slice(1),
				enabled: true,
				order: maxOrder + 1,
				defaultValue: "",
				events: [...ALL_EVENT_TYPES],
				isCustom: true,
			};
			existing.push(newField);
			await this.plugin.saveSettings();
			this.render();
		});
	}

	private async moveField(
		fromIndex: number,
		toIndex: number
	): Promise<void> {
		const fields = [...this.plugin.settings.fields].sort(
			(a, b) => a.order - b.order
		);
		const [moved] = fields.splice(fromIndex, 1);
		if (!moved) return;
		fields.splice(toIndex, 0, moved);
		fields.forEach((field, index) => {
			field.order = index;
		});
		this.plugin.settings.fields = fields;
		await this.plugin.saveSettings();
		this.render();
	}
}
