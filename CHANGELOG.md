# Changelog

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
