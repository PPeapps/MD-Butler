/**
 * Settings tab UI. Combines date format, processing mode,
 * draggable field list, folder filter mode with always-visible
 * include/exclude lists, and folder browse buttons.
 */
import {
	App,
	PluginSettingTab,
	Setting,
} from "obsidian";
import MetadataButlerPlugin from "../main";
import { FilterMode, ProcessingMode } from "./settings";
import { FieldListComponent } from "./FieldListComponent";
import { FolderSuggestModal } from "./FolderSuggestModal";

export class MetadataButlerSettingTab extends PluginSettingTab {
	plugin: MetadataButlerPlugin;

	private fieldList?: FieldListComponent;

	constructor(app: App, plugin: MetadataButlerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.render();
	}

	private render(): void {
		const { containerEl } = this;
		containerEl.empty();

		/* ── Date & Processing ──────────────────────────── */

		new Setting(containerEl)
			.setName("Date format")
			.setDesc("Moment.js format used for all metadata dates")
			.addText((text) =>
				text
					.setPlaceholder("Yyyy-mm-dd ddd hh:mm:ss")
					.setValue(this.plugin.settings.dateFormat)					.onChange(async (value) => {
						this.plugin.settings.dateFormat =
							value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Processing mode")
			.setDesc(
				"Newonly: only process notes without datecreated. Allfiles: process all notes."
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("newOnly", "New notes only")
					.addOption("allFiles", "All files")
					.setValue(this.plugin.settings.processingMode)
					.onChange(async (value) => {
						this.plugin.settings.processingMode =
							value as ProcessingMode;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("hr");

		/* ── Metadata Fields ────────────────────────────── */

		new Setting(containerEl).setName("Metadata fields").setHeading();

		const fieldContainer = containerEl.createDiv(
			"md-butler-field-container"
		);

		this.fieldList = new FieldListComponent(
			fieldContainer,
			this.plugin
		);

		this.fieldList.render();

		containerEl.createEl("hr");

		/* ── Folder Filter ──────────────────────────────── */

		new Setting(containerEl)
			.setName("Folder filter mode")
			.setDesc(
				"Exclude: skip files in the listed folders. Include: only process files in the listed folders."
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("exclude", "Exclude")
					.addOption("include", "Include")
					.setValue(this.plugin.settings.filterMode)
					.onChange(async (value) => {
						this.plugin.settings.filterMode =
							value as FilterMode;
						await this.plugin.saveSettings();
						this.render();
					})
			);

		/* ── Excluded Folders (always visible) ──────────── */

		const isExcludeActive =
			this.plugin.settings.filterMode === "exclude";

		new Setting(containerEl).setName("Excluded folders").setHeading();

		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc(
				"One folder per line. Subfolders are excluded recursively."
			)
			.addTextArea((text) => {
				text.setPlaceholder(
					"Templates\narchive\njournal/daily"
				)
					.setValue(
						this.plugin.settings.excludedFolders.join(
							"\n"
						)
					)					.onChange(async (value) => {
						this.plugin.settings.excludedFolders =
							value
								.split("\n")
								.map((v) => v.trim())
								.filter(Boolean);
						await this.plugin.saveSettings();
					});
				text.inputEl.disabled = !isExcludeActive;
			})
			.addButton((btn) =>
				btn
					.setIcon("plus")
					.setTooltip("Browse folders…")
					.setDisabled(!isExcludeActive)
					.onClick(() => {
						new FolderSuggestModal(
							this.app,
							(folder) => {
								const current =
									this.plugin.settings
										.excludedFolders;
								if (!current.includes(folder)) {
									current.push(folder);
									this.plugin.settings.excludedFolders =
										current;
									void this.plugin.saveSettings();
									this.render();
								}
							}
						).open();
					})
			);

		/* ── Included Folders (always visible) ──────────── */

		const isIncludeActive =
			this.plugin.settings.filterMode === "include";

		new Setting(containerEl).setName("Included folders").setHeading();

		new Setting(containerEl)
			.setName("Included folders")
			.setDesc(
				"One folder per line. Use * as wildcard to include all folders."
			)
			.addTextArea((text) => {
				text.setPlaceholder("Notes\nprojects\n*")
					.setValue(
						this.plugin.settings.includedFolders.join(
							"\n"
						)
					)
					.onChange(async (value) => {
						this.plugin.settings.includedFolders =
							value
								.split("\n")
								.map((v) => v.trim())
								.filter(Boolean);
						await this.plugin.saveSettings();
					});
				text.inputEl.disabled = !isIncludeActive;
			})
			.addButton((btn) =>
				btn
					.setIcon("plus")
					.setTooltip("Browse folders…")
					.setDisabled(!isIncludeActive)
					.onClick(() => {
						new FolderSuggestModal(
							this.app,
							(folder) => {
								const current =
									this.plugin.settings
										.includedFolders;
								if (!current.includes(folder)) {
									current.push(folder);
									this.plugin.settings.includedFolders =
										current;
									void this.plugin.saveSettings();
									this.render();
								}
							}
						).open();
					})
			);

		/* ── Protected YAML Keys (Do-Not-Touch) ─────────── */

		new Setting(containerEl).setName("Protected YAML keys").setHeading();

		new Setting(containerEl)
			.setName("Protected YAML keys")
			.setDesc(
				"One key per line. The plugin will never delete or overwrite these YAML keys — protects data from other plugins."
			)
			.addTextArea((text) => {
				text.setPlaceholder("Cssclass\naliases\nID")
					.setValue(
						this.plugin.settings.protectedYamlKeys?.join(
							"\n"
						) ?? ""
					)
					.onChange(async (value) => {
						this.plugin.settings.protectedYamlKeys =
							value
								.split("\n")
								.map((v) => v.trim())
								.filter(Boolean);
						await this.plugin.saveSettings();
					});
			});

		containerEl.createEl("hr");
	}
}
