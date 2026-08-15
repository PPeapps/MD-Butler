# Changelog

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
