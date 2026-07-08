# MD Butler

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-7C3AED.svg)](https://obsidian.md/)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/ppeter/md-butler)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Automatically manage YAML frontmatter fields for all your notes.**
An event-driven, configurable alternative to Templater formulas.

---

## Features

- **5 field types**: `text`, `select`, `boolean`, `number`, `multi`
- **Event-driven**: reacts to `open`, `modify`, `rename`, `bulk` – configurable per field (`noteId`/`dateCreated` = `open` only, `lastModified` = `modify` disabled)
- **Template engine**: `{{title}}`, `{{filePath}}`, `{{date:…}}`, `{{lookup:path,field}}`, `{{frontmatter:key}}`, pipes (`| upper`, `| lower`, `| replace:a,b`, …)
- **Cross-file lookup**: read frontmatter values from any vault file
- **Dataview integration**: generate select/multi options via DataviewJS queries
- **SelectFieldModal**: edit select/multi fields in the current note from the command palette
- **3 option sources**: manual list, external `.md` file, or DataviewJS
- **Conditional fields**: only set fields when a condition matches (frontmatter, path, filename, folder)
- **YAML key migration**: automatic when renaming keys in settings
- **Orphaned key cleanup**: remove obsolete YAML keys across the vault
- **Protected keys**: "Do Not Touch" list – never overwrite other plugins' keys
- **NoteID**: auto-generated UUID v4
- **Processing modes**: `newOnly` (skip existing) or `allFiles`
- **Folder filters**: include/exclude with recursive subfolder matching
- **Force-apply**: overwrite all existing metadata
- **Consistency check**: scan the vault for missing fields and value issues
- **Full repair**: force-apply → cleanup → consistency check (one command)
- **Nested YAML Groups**: dot-notation yamlKeys (`note.NoteID`) → hierarchical frontmatter
- **YAML-Groups config**: group-dropdown per field + group file import (📁)
- **Standardizer**: normalize values vault-wide with preview modal
- **Bulk YAML Key Rename**: rename keys across all files with migration tracking

---

## Quick Start

1. Install MD Butler from the Community Plugins store (or manually copy `main.js`, `manifest.json`, `styles.css` to your vault's plugin folder)
2. Enable the plugin in Obsidian settings
3. Open the plugin settings to configure your fields
4. Run **"Apply Metadata to all Notes"** from the command palette (`Ctrl+P`)

---

## Template Syntax

### Built-in expressions
```
{{title}}           → file name without extension
{{fileName}}        → file name with extension
{{filePath}}        → full vault-relative path
{{fileFolder}}      → parent folder
{{oldPath}}         → previous path (rename event)
{{date:YYYY-MM-DD}} → current date in moment.js format
{{now+7d}}          → relative date (+7 days, +1w, -3m, +1y)
```

### Cross-file lookup
```
{{lookup:path/to/file.md,fieldName}}
{{lookup:/absolute/path.md,Status}}
{{lookup:../Sibling.md,NoteType}}
```
Path resolution: absolute (`/root`), relative, parent-relative (`../`).
Case-insensitive field matching. Max depth: 3 lookups. Supports nested fields.

### Local frontmatter
```
{{frontmatter:NoteType}}
{{frontmatter:note.NoteID | lower}}
```

### Pipes (transformers)
```
{{title | upper}}
{{lookup:file.md,Name | lower | trim}}
{{frontmatter:Date | date:DD.MM.YYYY}}
{{title | replace:_, }}
{{lookup:x.md,Status | default:unknown}}
```

---

## Field Types

| Type | YAML Value | Writer Behavior | Builder Behavior |
|------|-----------|----------------|-----------------|
| `text` | string | template → defaultValue | resolves template |
| `select` | string | `defaultValue ?? options[0]` (for missing keys) | **skipped** (except `{{lookup:…}}`) |
| `boolean` | `true`/`false` | `"true"` → `true`, `"false"` → `false` | resolves + converts |
| `number` | number | `Number(value)` (NaN-safe) | resolves + converts |
| `multi` | string[] | comma-split template → `["A","B"]` | **skipped** (except `{{lookup:…}}`) |

> Select and multi fields are skipped by the Builder to protect user selections –
> the Writer only sets them when the YAML key is missing.
> **Exception**: `{{lookup:…}}` templates are resolved every event.

---

## Option Sources (select/multi)

Priority (highest to lowest):
1. **`optionsFile` (📁)** – external `.md` file with `options:` frontmatter list or one-per-line text
2. **`optionsDataview` (📊)** – DataviewJS query (e.g. `dv.pages().flatMap(p => p.file.tags).distinct().sort().values`)
3. **`options`** – manual list

---

## Commands

| Command | ID | Description |
|---------|-----|-------------|
| Apply Metadata to all Notes | `apply-all` | Processes new files only (respects `processingMode`) |
| Force-apply metadata to all notes (overwrite all) | `force-apply` | Overwrites ALL metadata |
| Full repair: force-apply → cleanup → consistency check | `full-repair` | Force → Cleanup → Consistency |
| Vault Consistency Check | `check-consistency` | Scan for missing fields |
| Clean up old YAML keys | `cleanup-keys` | Remove orphaned keys |
| Edit select fields in current note | `edit-select-fields` | Open SelectFieldModal |
| Standardize / Normalize values | `standardize-values` | Open StandardizeModal |
| Bulk rename YAML key | `bulk-rename-key` | Rename keys across all files |

---

## Architecture

```
Event → Deduplicator (2s) → PathFilter → ScopeManager
  → Builder (templates/lookup) → Queue → Flusher (500ms)
    → Writer (processFrontMatter, deep writes via NestedPath)
```

Key services: `TransformEngine` (templates/pipes/lookup, nested CI), `DataviewRunner` (DataviewJS), `ConditionEvaluator`, `MetadataUpdateBuilder`, `MetadataWriter` (deep writes), `StandardizerService`, `NestedPath`.

---

## Requirements

- **Obsidian** v1.8.0+
- **Dataview** plugin (optional, for `optionsDataview` and DataviewJS features)

---

## Build from source

```bash
git clone <repo>
cd md-butler
npm install
npm run build    # outputs main.js + manifest.json + styles.css
```

---

## License

MIT
