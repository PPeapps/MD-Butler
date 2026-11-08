# Changelog

## 1.0.8 (2026-08-30) — protect existing YAML values, create empty tags

### Fixes
- **Existing YAML values are never overwritten** (MD-006) — Select, boolean, number and multi default-fills now guard via `getValueAnywhere`/`hasValueAnywhere`, which detect both nested (`Note: {NoteType: PDF}`) and flat/legacy keys (`Note.NoteType: PDF` or `NoteType: PDF`). Previously a note with a flat `NoteType` got an additional nested `Note: {NoteType: "Note"}` on any write (modal "Apply to all", force, open/modify), so the RAGtopus-pipeline value `PDF` displayed as `Note`. The present-value guard in the update loop now applies to **all** events (not only bulk); only MD Butler's own tracking fields (`Dates.Modified`, `Note.Title`/`Note.Path`, `Dates.Moved`) and `{{lookup:}}` templates may refresh existing values.
- **Force no longer touches `Dates.Created`** — `|| force` removed; force-apply no longer overwrites an existing created date.
- **`tags` is created empty** (MD-007) — a missing/empty `tags` key is now written as `tags: []` instead of never being written. Existing values (e.g. RAGtopus `[PDF, Summary]`) are never modified, and MD Butler never sets tag values.
- **`relatedMOCs` (multi with object options) is now created** (MD-008) — the multi default-fill no longer filters out fields whose `options` are a Dataview object.

### Internal
- `DEFAULT_FIELD_EVENTS.tags` extended to `["open", "modify", "bulk"]`.

---

## 1.0.7 (2026-08-18) — re-release settings hotfix

### Fixes
- **Settings UI restored** — Same fix as 1.0.6 (re-released because 1.0.6 was removed from the directory after review failure). Removed `getSettingDefinitions()` which was causing Obsidian 1.13+ to only render the two basic settings.

---

## 1.0.6 (2026-08-15) — settings hotfix

### Fixes
- **Settings UI restored** — Removed `getSettingDefinitions()` from `SettingsTab` which was causing Obsidian 1.13+ to only render the two basic settings (date format, processing mode), hiding all other options (metadata fields, folder filters, protected YAML keys). The method is only needed for settings search, not display.

---

## 1.0.5 (2026-08-14) — community review fixes

### Internal
- **Review-bot fixes** — addressed feedback from the Obsidian community review:
  - `eslint-disable` directive comments now carry a description (`no-undescribed-directive-comment`)
  - `moment` usage decoupled from moment's type declarations via a structural `MomentLike` type (fixes `no-unsafe-*` findings in the review environment)
  - `createEl("div")` / `createEl("span")` replaced with `createDiv()` / `createSpan()` (`prefer-create-el`)
  - `SettingsTab` now implements `getSettingDefinitions()` (settings appear in Obsidian 1.13+ settings search)
  - `no-new-func` explicitly disabled with justification for the Dataview JS integration and enabled in the local ESLint config
- **Release tag convention** — GitHub release tag must equal the `manifest.json` version **without** a `v` prefix (`1.0.4`, not `v1.0.4`).

---

## 1.0.4 (2026-08-14) — maintenance update

### Fixes
- **`newOnly` fills empty fields (MD-001)** — `processingMode: newOnly` now also fills fields that exist but are empty (e.g. `Note.UUID: `). Existing, non-empty values are still never overwritten.
- **Author metadata corrected (MD-005)** — `manifest.json` now uses `author: PPeapps` with `authorUrl`; empty `fundingUrl` removed (Obsidian submission requirement); README clone URL points to `https://github.com/PPeapps/MD-Butler`.

### New
- **`{{folder}}` template variable (MD-003)** — New alias for `{{fileFolder}}` that resolves to the parent folder path without the file name (e.g. `2_PROJECTS/a_Ongoing` instead of `2_PROJECTS/a_Ongoing/My Note.md`).

### Internal
- **ESLint cleanup** — 283 lint messages from `eslint-plugin-obsidianmd` fixed (no-static-styles-assignment, no-explicit-any / no-unsafe-*, sentence-case, no-misused-promises, no-manual-html-headings, …). `eslint src`, `tsc -noEmit -skipLibCheck`, and `npm run build` are green.
- **Path hardening** — `normalizePath()` applied to user-supplied paths (`{{lookup:path,…}}` templates, `optionsFile` config).

---

## 1.0.3 (2026-07-27)

### Fixes
- **Consistency Check: `totalFiles` count** — Scanned count now only includes files that pass the folder filter, not all vault files
- **Consistency Check: Copy to clipboard** — Added "Copy report to clipboard" button for easy sharing/export of consistency results
- **SelectFieldModal: Options cache** — Modal now always reloads options from `optionsFile` on open, no longer showing stale cached values

### New
- **Field requirement modes** — New `requirement` property per field: `required` (default, field must exist) or `if-exists` (only flag if key exists but is empty). `Dates.Moved` defaults to `if-exists` since it's only set when a file has been moved.

---

## 1.0.2

- BRAT compatibility fix
- data.json migration: per-field merge with DEFAULT_SETTINGS
- Array validation: `Array.isArray(this.settings.fields)` check in loadSettings()
- Documentation fully translated to English

---

## 1.0.1-release

- Initial public release on GitHub
- SelectFieldModal for editing nested YAML fields
- Dataview integration (optionsDataview)
- {{lookup:path,field}} template support

---

## 1.0.0

- Initial release
- YAML field management
- Events system (open, rename, modify, bulk)
- Conditions (always, folder, path, filename, frontmatter)
- Template support with {{title}}, {{date:*}}, {{sequence}}
- Bulk operations
- yamlGroups for nested YAML structures
