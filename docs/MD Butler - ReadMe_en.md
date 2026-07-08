# MD Butler — ReadMe

**Version:** 1.0.0
**Plugin ID:** `md-butler`
**Author:** PPeter
**Min. Obsidian Version:** 1.8.0

---

## Overview

MD Butler is an Obsidian plugin that automatically manages YAML frontmatter fields across all notes.
It reacts to events (open, modify, rename) and writes metadata according to configurable rules.

Unlike Templater formulas (`<%* %>`), MD Butler is fully asynchronous and event-driven —
no manual triggering, no formula bloat in your files.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **5 field types** | `text`, `select`, `boolean`, `number`, `multi` |
| **Event-driven** | Reacts to `open`, `modify`, `rename` – configurable per field |
| **Template engine** | `{{title}}`, `{{filePath}}`, `{{date:…}}`, `{{lookup:…}}`, `{{frontmatter:…}}` and more |
| **Cross-file lookup** | Reads frontmatter values from any vault note (`{{lookup:path,field}}`) |
| **Pipe chain** | Transform values: `{{lookup:…,noteType\|lower\|trim}}` |
| **Dataview integration** | Generate options via DataviewJS queries (`dv.pages()...`) |
| **Option sources** | Three sources for select/multi: manual list, .md file (📁), DataviewJS (📊) |
| **SelectFieldModal** | `Ctrl+P → "Edit select fields"` – convenient editing in the current note |
| **Conditional fields** | Only set fields when a condition is met (e.g. `frontmatter:status equals active`) |
| **YAML key migration** | Automatic when renaming YAML keys in settings |
| **Orphaned key cleanup** | Old, unused YAML keys are cleaned across the vault |
| **Do-Not-Touch list** | Protected YAML keys (`cssclass`, `aliases`, …) are never overwritten |
| **NoteID** | UUID v4 auto-assigned (NoteID at position 1) |
| **Processing modes** | `newOnly` (new notes only) or `allFiles` |
| **Folder filter** | Include/exclude folders with recursive subfolder matching |
| **Force-apply** | Overwrites ALL metadata (including existing) |
| **Consistency check** | Scans the entire vault for missing frontmatter fields **and inconsistent values** (value issues, e.g. select values outside the `options[]` list) |
| **Full repair** | Force-apply → Cleanup → Consistency check in one command |
| **Nested YAML Groups** | `yamlKey: "note.NoteID"` writes `note:\n  NoteID: …` – hierarchical frontmatter via dot-notation |
| **YAML-Groups config** | Group-dropdown per field + group file import (📁) |
| **Standardizer** | Scan (via ConsistencyChecker) → Preview (StandardizeModal with per-issue dropdown) → Bulk value cleanup for select/multi fields |
| **Bulk YAML Key Rename** | Rename YAML keys across all files with migration tracking and settings sync |
| **StandardizeModal** | Preview with per-issue selection (Skip/Replace) + duplicate warning before applying |

---

## Field Types in Detail

### `text`
Standard text field. Can be populated via template or have a default value.

### `select`
Dropdown field with predefined options.
- **Option sources** (priority): `optionsFile` (📁) > `optionsDataview` (📊) > `options` (manual list)
- The **Builder skips select/multi** – values come from the Writer (protects user selections)
- **Exception**: `{{lookup:…}}` templates are always resolved
- SelectFieldModal (`Ctrl+P`) allows manual selection

### `boolean`
`true`/`false` field. Template string `"true"`/`"false"` is converted to boolean.

### `number`
Numeric field. Template value is converted via `Number()`; `NaN` is ignored.

### `multi`
Array field with checkboxes (SelectFieldModal).
- Comma-separated template: `"A, B, C"` → `["A", "B", "C"]`
- Dataview options are passed through

---

## Template Engine

### Built-in Expressions

| Expression | Description |
|------------|-------------|
| `{{title}}` | File name without extension |
| `{{fileName}}` | File name with extension |
| `{{filePath}}` | Full vault-relative path |
| `{{fileFolder}}` | Parent folder of the file |
| `{{oldPath}}` | Previous path (rename only) |
| `{{oldFolder}}` | Previous folder (rename only) |
| `{{oldName}}` | Previous file name (rename only) |
| `{{date:FORMAT}}` | Current date in moment.js format |
| `{{now+7d}}` | Relative date (+7d, -3d, +1w, -2m, +1y) |
| `{{frontmatter:KEY}}` | Value of any frontmatter key in the current file (supports nested: `frontmatter:note.NoteID`) |
| `{{lookup:PATH,FIELD}}` | Frontmatter value from another file (supports nested fields) |

### Lookup Syntax

```
{{lookup:Path/to/file.md,FieldName}}
{{lookup:Path/to/file.md,FieldName | pipe1 | pipe2}}
```

- **Path resolution**: absolute (`/Folder/File.md`), relative (`../Folder/File.md`), relative to the current file's folder
- **Cache**: lookups are cached per resolve cycle
- **Max depth**: 3 levels (lookup in lookup)
- **Case-insensitive**: field names are compared exactly first, then lowercase fallback

### Pipe Chain

| Pipe | Example | Description |
|------|---------|-------------|
| `upper` | `{{title\|upper}}` | Convert to uppercase |
| `lower` | `{{title\|lower}}` | Convert to lowercase |
| `trim` | `{{title\|trim}}` | Remove whitespace |
| `replace:a,b` | `{{title\|replace: ,_}}` | Replace substring |
| `substr:0,5` | `{{title\|substr:0,5}}` | Substring |
| `default:text` | `{{lookup:…\|default:Unknown}}` | Fallback value |
| `date:FORMAT` | `{{…\|date:MM.DD.YYYY}}` | Format date (moment.js) |

### Examples

```
{{date:YYYY-MM-DD}}

Hello {{title}}

{{lookup:/XTRAS/Lookups/Status.md,Status | lower | default:unknown}}

{{frontmatter:NoteType}}

{{now+7d}}
```

---

## Settings

### Date & Processing

| Setting | Description |
|---------|-------------|
| **Date Format** | Moment.js format string for all date values |
| **Processing Mode** | `newOnly` – only notes WITHOUT `DateCreated`; `allFiles` – all notes |

### Metadata Fields

Each field has:
- **Internal ID** (fixed for built-in, editable for custom)
- **YAML Key** – the actual key in frontmatter (supports dot-notation for nesting)
- **Type** – text/select/boolean/number/multi
- **Events** – checkboxes for open/modify/rename/bulk
  - `noteId` and `dateCreated` have **fixed events**: `open` only
  - `lastModified` has `modify` **disabled** – set automatically by the plugin
- **Template** – expression (see Template Engine)
- **Default Value** – fallback when no template is set (for `boolean`: dropdown none/true/false)
- **Condition** – condition (see below)
- **Enable toggle** – on/off
- **Drag handle** ☰ – change order
- **Group dropdown** – assign field to a YAML group (e.g. `note`, `dates`, `special`) — prefix to yamlKey

For **select** and **multi** additionally:
- Options text field (one per line)
- 📁 button – load options from .md file
- 📊 button – DataviewJS editor + ▶ Execute

### YAML-Groups

Configured in the settings header (text field + 📁 import):
- **Default groups**: `note`, `dates`, `special`
- **Per-field group dropdown**: selects the group prefix for the yamlKey
- **Group file import** (📁): reads YAML frontmatter `groups:` array or plain-text list (one value per line)
- **Tags exception**: `tags` field is locked to `(none)` – `tags:` always stays flat for Obsidian compatibility

### Conditions

| Type | Operator | Description |
|------|----------|-------------|
| `always` | – | Always executed |
| `frontmatter` | `exists` | Check if a frontmatter key exists (supports nested) |
| `frontmatter` | `equals` | Key == value (supports nested) |
| `frontmatter` | `contains` | Key contains value (supports nested) |
| `frontmatter` | `matches` | Key matches regex (supports nested) |
| `path` | equals/contains/matches | File path |
| `filename` | equals/contains/matches | File name |
| `folder` | equals/contains/matches | File folder |

### Folder Filter

| Mode | Behavior |
|------|----------|
| **Exclude** | Files in listed folders are ignored |
| **Include** | ONLY files in listed folders are processed |

### Do-Not-Touch (Protected YAML Keys)

YAML keys that are NEVER overwritten or deleted by the plugin.
Useful for keys from other plugins: `cssclass`, `aliases`, `id`, `tags`, etc.

---

## Commands (Command Palette)

| Command | Description |
|---------|-------------|
| **Apply Metadata to all Notes** | New notes only (respects processingMode) |
| **Force-apply metadata to all notes (overwrite all)** | Overwrites all values |
| **Vault Consistency Check** | Scan for missing fields |
| **Clean up old YAML keys** | Remove orphaned keys |
| **Edit select fields in current note** | Opens SelectFieldModal |
| **Full repair: force-apply → cleanup → consistency check** | Force → Cleanup → Check |
| **Standardize / Normalize values** | Opens StandardizeModal with value report and fixes |
| **Bulk rename YAML key** | Rename a YAML key across all vault files |

---

## Architecture (for Developers)

```
Event (open/modify/rename)
  → EventDeduplicator (2s window)
    → PathFilter (exclude/include)
      → ScopeManager (newOnly/allFiles)
        → MetadataUpdateBuilder (template resolve)
          → UpdateQueue (merge)
            → BatchFlusher (500ms debounce)
              → MetadataWriter (frontmatter write)
```

### Services

| Service | Role |
|---------|------|
| `EventDeduplicator` | Prevents duplicate events within 2s |
| `UpdateQueue` | Merge queue: only latest update per file |
| `BatchFlusher` | 500ms debounce before writing |
| `MetadataUpdateBuilder` | Builds update payload (resolves templates) |
| `MetadataWriter` | Writes via `processFrontMatter` (deep writes: `setNested`/`getNested`/`deleteNested`/`hasNested`) |
| `TransformEngine` | Template resolver with lookup, pipes, date (nested-aware via `findNestedCI`) |
| `DataviewRunner` | Executes DataviewJS queries |
| `ConditionEvaluator` | Evaluates conditions (nested-aware via `getNested`) |
| `PathFilter` | Folder filter (exclude/include) |
| `ScopeManager` | newOnly/allFiles |
| `ConsistencyChecker` | Vault scan for missing fields **and value issues** (values outside the `options[]` list), nested-aware via `getNested` |
| `StandardizerService` | Value standardization / normalization vault-wide |
| `NestedPath` (utils) | 4 pure functions for nested YAML access |

### Important Implementation Details

- **Select/Multi Builder skip**: The builder skips select/multi fields (except `{{lookup:…}}`).
  The Writer sets the default value. Protects user selections from being overwritten.
- **Case-insensitive lookup**: `executeLookup()` tries exact match first, then `toLowerCase()` fallback.
- **Option priority**: `optionsFile` (📁) highest → `optionsDataview` (📊) medium → `options` (manual) lowest.
- **Writer template guard**: `!template.includes("{{")` – raw templates are never written.
- **`saveSettings()`**: Never called in `loadSettings()` or `onload()` (prevents data corruption).
- **Nested YAML**: All `fm[key]` access replaced with `getNested(fm, key)` / `setNested(fm, key, val)` / `deleteNested(fm, key)` / `hasNested(fm, key)`.
- **noteId safety**: Before generating a new noteId, code checks pendingMigrations for old-key value — prevents duplicate IDs when group changes.
- **BulkRename settings sync**: After renaming yamlKeys in files, settings are updated automatically.

---

## File Structure (Source Code)

```
src/
  main.ts                    # Plugin entry, event registration, bulk commands
  types/
    Events.ts                # Event types
    MetadataField.ts         # Field configuration (FieldType, ConditionConfig, …)
    Queue.ts                 # Queue types
  services/
    EventDeduplicator.ts     # Event deduplication
    UpdateQueue.ts           # Update queue
    BatchFlusher.ts          # Debounce flusher
    MetadataUpdateBuilder.ts # Update payload builder
    MetadataWriter.ts        # Frontmatter writer (deep writes)
    TransformEngine.ts       # Template engine (lookup, pipes, date, nested CI)
    DataviewRunner.ts        # DataviewJS executor
    ConditionEvaluator.ts    # Conditions (nested-aware)
    PathFilter.ts            # Folder filter
    ScopeManager.ts          # Processing scope
    ConsistencyChecker.ts    # Consistency scan (nested-aware)
    StandardizerService.ts   # Value standardization/normalization
  views/
    SelectFieldModal.ts      # Select/multi editing (nested-aware)
    ConsistencyModal.ts      # Consistency results
    BulkProgressModal.ts     # Progress display
    StandardizeModal.ts      # Standardization preview + apply
    BulkRenameModal.ts       # Bulk YAML key rename
  settings/
    settings.ts              # Settings interface + defaults (+ yamlGroups, groupFile, pendingMigrations)
    SettingsTab.ts           # Settings UI
    FieldListComponent.ts    # Field list (drag&drop, options, templates, group dropdown)
    FolderSuggestModal.ts    # Folder picker
    FileSuggestModal.ts      # File picker
  utils/
    DateUtils.ts             # Date formatting
    IdUtils.ts               # UUID generation
    SelectUtils.ts           # Options file loader
    NestedPath.ts            # Deep YAML access helpers
```

---

## Tips & Notes

- **Restart after changes**: After a build, restart Obsidian (reload the plugin)
- **Deployment**: Copy `main.js`, `manifest.json`, `styles.css` to your vault's plugin folder
- **DataviewJS**: Simple return expressions (`dv.pages()....`). Multi-line code needs explicit `return`.
- **Options file**: .md file with `---\noptions:\n  - Value1\n  - Value2\n---` or a plain list (one option per line)
- **Lookup paths**: For relative paths, the starting folder is the current file's folder
- **`{{lookup:…}}` auto-update**: The value is re-resolved on every open/modify event (no dependency tracking yet – planned for a future version)
- **Force-apply**: REALLY overwrites everything – including select/multi selections (since they are re-set via lookup)
- **Nested YAML**: Change `yamlKey` from `NoteID` to `note.NoteID` to automatically create hierarchical frontmatter. The `tags` field is locked to flat for Obsidian compatibility.
