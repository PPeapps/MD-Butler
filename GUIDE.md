# MD Butler — User Guide

MD Butler is an automatic YAML frontmatter manager for Obsidian. It listens for file events (open, modify, rename) and keeps your metadata fields in sync — no Templater formulas, no manual edits.

---

## 1. Quick Start

1. **Install** the plugin via [BRAT](https://github.com/TfTHacker/obsidian42-brat) (recommended) or copy the files manually to `.obsidian/plugins/md-butler/`
2. **Enable** it in Settings → Community Plugins
3. Open **Settings → MD Butler**
4. Set your **Date Format** (e.g. `YYYY-MM-DD`)
5. Choose **Processing Mode** — start with `New notes only`

That's it. Open any note and the enabled fields will be written automatically.

> **Note:** MD Butler is not yet listed in the official Obsidian Community Plugins directory.
> Use the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) for installation and automatic
> updates, or install manually from the [latest release](https://github.com/PPeapps/MD-Butler/releases).

---

## 2. How It Works

```
File Event (open / modify / rename)
  │
  ├── Guard 1: internalWrite?              → skip (plugin's own writes)
  ├── Guard 2: deduplicator (< 2s)?        → skip (duplicate event)
  ├── Guard 3: path filter (excluded)?     → skip (folder excluded)
  └── Guard 4: scope (newOnly + has key)?  → skip (already processed)
       │
       ▼
  MetadataUpdateBuilder.build()
    ├── field.events check                 → skip (event not bound)
    ├── condition check                    → skip (condition fails)
    ├── template → TransformEngine         → resolve {{…}} expressions
    └── no template → resolveValue(id)     → built-in value logic
       │
       ▼
  Queue → Flusher (800ms) → Writer
    └── processFrontMatter(file, fm => {
          1. cleanup orphaned keys
          2. migrate old yamlKey → new yamlKey
          3. set DateCreated if missing
          4. init select field defaults
          5. write enabled field values
          6. set defaultValue for conditioned custom fields
          7. auto-remove keys for failed conditions
        })
```

---

## 3. Date Format & Processing Mode

### Date Format

Uses **moment.js** syntax. Applied to `DateCreated`, `LastModified`, `LastMoved`, and any `{{date:…}}` template.

| Pattern | Example Output |
|---------|---------------|
| `YYYY-MM-DD` | `2026-06-19` |
| `DD.MM.YYYY` | `19.06.2026` |
| `YYYY-MM-DD ddd HH:mm:ss` | `2026-06-19 Thu 14:30:00` |
| `dddd, MMMM Do YYYY` | `Thursday, June 19th 2026` |
| `ISO` | `2026-06-19T14:30:00+02:00` |
| `YYYY-MM-DD HH:mm` | `2026-06-19 14:30` |

### Processing Mode

```
newOnly:
  ├─ File already has DateCreated → SKIP (already processed)
  └─ No DateCreated yet           → WRITE (first open)

allFiles:
  └─ Always WRITE (every matching event)
```

- **`newOnly`** — Recommended. Only processes files that don't have `DateCreated` yet. Once set, future events on that file skip the pipeline (unless a rename event occurs). Safe for existing vaults.
- **`allFiles`** — Processes every file on every matching event. Useful when you want `LastModified` to update on every edit.

---

## 4. The Three Time Keys: DateCreated, LastModified, LastMoved

| Key | Trigger Events | Overwrite Behavior | Purpose |
|-----|---------------|-------------------|---------|
| **DateCreated** | open, rename, bulk | Only if missing (or force) | Timestamp of first Obsidian open |
| **LastModified** | modify, rename, bulk | Always on matching events | Timestamp of last content edit |
| **LastMoved** | rename (folder change only) | Always on matching events | Timestamp of last folder move |

**DateCreated** fires on the first `open` event after the note is created. In `newOnly` mode it won't be touched again. In `allFiles` mode it's still only written when missing — it never overwrites an existing value unless you use Force-Apply.

**LastModified** updates every time you edit and save the note (`modify` event). It also updates on `rename` when the file name changes.

**LastMoved** is special: it only fires on `rename` events where the **parent folder** changed. If you rename a file inside the same folder, `LastMoved` does not update — only `LastModified` does.

```
Same folder rename:
  /Projects/Note.md  →  /Projects/Note_v2.md
  ├─ LastModified: updated
  └─ LastMoved: unchanged

Folder move:
  /Projects/Note.md  →  /Archive/Note.md
  ├─ LastModified: updated
  └─ LastMoved: updated
```

---

## 5. Anatomy of a Metadata Field

Each field row in Settings shows these controls:

| Control | Type | Meaning |
|---------|------|---------|
| ☰ **drag handle** | Reorder | Determines YAML key order in the frontmatter |
| **Field ID** | Text (read-only for built-in) | Internal identifier used by the plugin |
| **YAML Key** | Text input | The actual key written to frontmatter — editable for all fields, including built-in ones. Renaming triggers automatic key migration (see §10) |
| **Type dropdown** | `text` / `select` | Free-form value vs. controlled vocabulary |
| **Options** (select only) | Textarea (one per line) | The allowed values for this dropdown field |
| **Default Value** (select) | Text input | Fallback when YAML key is missing — falls back to first option if empty |
| **Template** (text) | Text input + live preview | `{{date:…}}`, `{{title}}`, pipe chains — resolved by the TransformEngine |
| **Template** (select) | Dropdown of field options | One option to always set as default for new notes (or `(none)`) |
| **Events** | 4 checkboxes | `open` `modify` `rename` `bulk` — bind this field to specific events |
| **Condition** | `+` button / `⚙` collapse | Collapsible editor: type, operator, value |
| **Default Value** (text, no template) | Text input | Written once when the YAML key is missing |
| **Enable toggle** | On/Off | Quickly disable a field without deleting it |
| **Delete button** | `✕` (custom fields only) | Remove the field entirely |

### Event matrix for built-in fields

| Field | Default Events | Notes |
|-------|---------------|-------|
| `fileName` | open, rename, bulk | |
| `filePath` | open, rename, bulk | |
| `dateCreated` | open, rename, bulk | Only written when missing |
| `noteType` | open, rename, bulk | Select field, template controls default |
| `lastModified` | modify, rename, bulk | |
| `lastMoved` | rename | Only on folder change |
| `source` | open, rename, bulk | Disabled by default |
| `tags` | modify, bulk | Disabled by default |

### Understanding select vs text

- **Text**: The template (or defaultValue) can contain anything — a date, a file property, a pipe chain. The value is resolved and written as a string.
- **Select**: The value must be one of the predefined options. The template dropdown picks from those options only. The writer ensures the value is always one of the permitted values.

---

## 6. Template Reference

### Expressions

| Expression | Example | Result |
|-----------|---------|--------|
| `{{date:FORMAT}}` | `{{date:YYYY-MM-DD}}` | `2026-06-19` |
| `{{now+Nd}}` | `{{now+7d}}` | `2026-06-26` |
| `{{now-Nd}}` | `{{now-1w}}` | `2026-06-12` |
| `{{title}}` | — | File name without extension |
| `{{fileName}}` | — | File name with extension |
| `{{fileFolder}}` | — | Parent folder path |
| `{{filePath}}` | — | Full vault path |
| `{{oldPath}}` | — | Previous path (rename only) |
| `{{oldFolder}}` | — | Previous folder (rename only) |
| `{{oldName}}` | — | Previous file name (rename only) |
| `{{frontmatter:key}}` | `{{frontmatter:cssclass}}` | Value of any frontmatter key |

### Relative date units

`d` = days, `w` = weeks, `M` = months, `y` = years.

Examples: `{{now-1d}}`, `{{now+2w}}`, `{{now-3M}}`, `{{now+1y}}`.

### Pipe Functions

| Pipe | Example | Input → Output |
|------|---------|---------------|
| `upper` | `{{title \| upper}}` | `my note` → `MY NOTE` |
| `lower` | `{{title \| lower}}` | `My Note` → `my note` |
| `trim` | `{{title \| trim}}` | `" My Note "` → `My Note` |
| `replace:X,Y` | `{{title \| replace: ,-}}` | `My Note` → `My-Note` |
| `default:VAL` | `{{frontmatter:x \| default:N/A}}` | `undefined` → `N/A` |
| `substr:S,E` | `{{title \| substr:0,3}}` | `My Note` → `My ` |
| `date:FMT` | `{{date:ISO \| date:DD.MM.YYYY}}` | `2026-06-19T…` → `19.06.2026` |

### Chaining examples

| Template | Result |
|----------|--------|
| `{{title \| upper}}` | `MY NOTE` |
| `{{title \| replace: ,- \| lower}}` | `my-note` |
| `{{date:YYYY-MM-DD \| replace:-,.}}` | `2026.06.19` |
| `{{frontmatter:title \| default:Untitled \| trim \| upper}}` | `UNTITLED` |

---

## 7. Conditions Reference

### Types and operators

| Type | Operators | Evaluates Against |
|------|-----------|-------------------|
| `always` | — | Always true (default) |
| `frontmatter` | exists, equals, matches, contains | A frontmatter key value |
| `path` | equals, matches, contains | Full file path |
| `filename` | equals, matches, contains | File name |
| `folder` | equals, matches, contains | Parent folder |

- `exists` — true if the frontmatter key exists (any value)
- `equals` — exact string match
- `matches` — regex match (invalid regex returns false safely)
- `contains` — substring match

### Auto-removal

When a field has a condition, the plugin **removes** the YAML key from the frontmatter as soon as the condition no longer matches.

```
Condition = "NoteType equals Project"

Current NoteType: "Project"
  ✓ Condition passes → field is written (or kept as-is)

Current NoteType: "Meeting"
  ✗ Condition fails → YAML key is deleted on next event

Next event (modify / open / rename):
  ├─ Condition: NoteType = Project?  → false
  └─ Key is in frontmatter?          → yes → delete it
```

This happens atomically inside `processFrontMatter` on every event that triggers a write. No manual cleanup needed.

---

## 8. Folder Filters (exclude / include)

Filter events by folder. Two modes:

### Exclude mode

> "Process all files EXCEPT those in these folders."

```
Vault root/
  ├─ Templates/          ← excluded
  ├─ Archive/            ← excluded
  ├─ Projects/           ← processed
  └─ Journal/            ← processed
```

Use when you want MD Butler everywhere **except** a few folders that contain non-standard notes.

### Include mode

> "Only process files IN these folders."

```
Vault root/
  ├─ Templates/          ← not included → skipped
  ├─ Daily/              ← not included → skipped
  ├─ Projects/           ← included → processed
  └─ Journal/            ← included → processed
```

Use when you want MD Butler **only** in specific parts of your vault.

### Comparison

| File | exclude `Templates/` | include `Projects,Journal` |
|------|---------------------|---------------------------|
| `Templates/Note.md` | ✗ excluded | ✗ not included |
| `Journal/2026-06-19.md` | ✓ processed | ✓ included |
| `Projects/App.md` | ✓ processed | ✓ included |
| `Inbox/Idea.md` | ✓ processed | ✗ not included |

- Case-insensitive: `journal/` matches `Journal/`
- Recursive: excluding `Projects/` also excludes `Projects/Sub/File.md`
- Wildcard: `*` can be used in include mode to match all folders

---

## 9. Sample Use Cases

### Use Case 1: Automatic timestamps on every note

**Goal**: Every note gets `DateCreated` on first open and `LastModified` on every edit.

**Settings**:
- Processing Mode: `newOnly`
- `dateCreated` → enabled, events: `open, rename, bulk`
- `lastModified` → enabled, events: `modify, rename, bulk`

**Before** (new note):
```yaml
---
title: My Note
---
```

**After first open**:
```yaml
---
title: My Note
DateCreated: 2026-06-19
LastModified: 2026-06-19
---
```

**After edit**:
```yaml
---
title: My Note
DateCreated: 2026-06-19
LastModified: 2026-06-20
---
```

`DateCreated` stays at the original value. `LastModified` updates on every save.

---

### Use Case 2: Status field only for Projects

**Goal**: A custom text field `ProjectStatus` that only appears when `NoteType` is `Project`. When NoteType changes to something else, the field disappears.

**Setup**:
1. Create a new custom field:
   - ID: `projectStatus`
   - YAML Key: `ProjectStatus`
   - Type: `text`
   - Default Value: `Active`
   - No template
2. Set condition: `frontmatter / NoteType / equals / Project`
3. Events: `open, modify, rename, bulk`

**Before** (NoteType = Meeting):
```yaml
---
NoteType: Meeting
---
```

**After** (NoteType stays Meeting — condition fails → key is absent):
```yaml
---
NoteType: Meeting
---
```
No `ProjectStatus` — condition doesn't match, so the Writer never adds it. If it was there before (from a previous Project state), auto-removal deletes it.

**After changing to Project** (manually or via noteType select field):
```yaml
---
NoteType: Project
ProjectStatus: Active
---
```

**After changing back to Meeting**:
```yaml
---
NoteType: Meeting
---
```
Next event triggers auto-removal: `ProjectStatus` is deleted.

---

### Use Case 3: Priority dropdown with default "Medium"

**Goal**: A select field `Priority` with three options. New notes get `Medium` by default; the user can pick anything.

**Setup**:
1. Create a new custom field:
   - ID: `priority`
   - YAML Key: `Priority`
   - Type: `select`
   - Options (one per line):
     ```
     Low
     Medium
     High
     ```
   - Default Value: `Medium`
   - Template: `(none)`
2. Events: `open, modify, rename, bulk`

**Before** (new note):
```yaml
---
title: My Task
---
```

**After first open**:
```yaml
---
title: My Task
Priority: Medium
---
```

The Writer sets `Medium` because the YAML key is missing and `defaultValue` is `Medium`. If `defaultValue` were empty, it would fall back to `Low` (the first option).

If the user changes the template dropdown from `(none)` to `High`, every new note would get `Priority: High` instead — the template overrides `defaultValue`.

---

### Use Case 4: FilePath stays in sync

**Goal**: `FilePath` always reflects the current vault path, even after moving the note.

**Setup**:
- `filePath` → enabled, events: `open, rename, bulk`

**Before** (file at `/Projects/Note.md`):
```yaml
---
FilePath: Projects/Note.md
---
```

**After moving to `/Archive/Note.md`**:
```yaml
---
FilePath: Archive/Note.md
---
```

The `rename` event triggers the Builder, which resolves the current file path and updates the frontmatter. No manual editing needed.

---

### Use Case 5: MeetingDate for meeting notes

**Goal**: A `MeetingDate` field is added automatically, but only when `NoteType` is `Meeting`. The value is today's date.

**Setup**:
1. Create a new custom field:
   - ID: `meetingDate`
   - YAML Key: `MeetingDate`
   - Type: `text`
   - Template: `{{date:YYYY-MM-DD}}`
2. Set condition: `frontmatter / NoteType / equals / Meeting`
3. Events: `open, modify, rename, bulk`

**Before** (NoteType = Project):
```yaml
---
NoteType: Project
---
```

**After changing to Meeting**:
```yaml
---
NoteType: Meeting
MeetingDate: 2026-06-19
---
```

If `MeetingDate` already existed from a previous session and the note is now a Project, the condition fails → auto-removal deletes it.

---

### Use Case 6: Exclude Templates folder

**Goal**: Files in the `Templates/` folder should never be touched by MD Butler.

**Setup**:
1. Folder Filter Mode: `exclude`
2. Excluded Folders:
   ```
   Templates
   ```

**How it works**:
```
file created in Templates/ → PathFilter checks "excluded?" → yes → skip
file moved to Templates/  → PathFilter checks "excluded?" → yes → skip
file moved out of Templ.  → PathFilter checks "excluded?" → no  → process
```

The filter is checked for every event. Moving a file **out** of an excluded folder makes it eligible again.

---

### Use Case 7: Only process Projects and Journal

**Goal**: MD Butler should only operate on notes in `Projects/` and `Journal/`. Everything else is ignored.

**Setup**:
1. Folder Filter Mode: `include`
2. Included Folders:
   ```
   Projects
   Journal
   ```

**How it works**:
```
file in Projects/          → PathFilter checks "included?" → yes → process
file in Journal/           → PathFilter checks "included?" → yes → process
file in Inbox/             → PathFilter checks "included?" → no  → skip
file moved from Inbox to
  Projects/                → PathFilter checks "included?" → yes → process (rename)
```

---

### Use Case 8: One command to fix everything

**Goal**: Something went wrong with metadata — dates are wrong, keys are missing, old YAML keys are cluttering files. Fix everything with one command.

**Command**: `md-butler:full-repair`

**What it does**:
```
full-repair
  1. force-apply      → overwrite ALL fields (ignores scope, respects protected keys)
  2. cleanup-keys     → remove orphaned YAML keys from deleted fields
  3. check-consistency → scan vault and show which files are still missing fields
```

Use this after:
- Changing a field template (to apply the new template to all existing notes)
- Renaming a YAML key (to migrate old keys vault-wide)
- Enabling a new field (to backfill missing values)
- Recovering from a corrupted `data.json`

> **Warning**: Force-apply overwrites existing values. Protected YAML keys are safe.

---

## 9a. Field Requirement Modes

Jedes Feld hat einen `requirement`-Modus, der steuert, wie der Vault Consistency Check das Feld behandelt:

| Modus | Verhalten |
|-------|-----------|
| `required` (Default) | Feld **muss** existieren — wird als fehlend gemeldet, wenn der YAML-Key nicht vorhanden ist |
| `if-exists` | Feld wird nur gemeldet, wenn der YAML-Key **existiert, aber leer** ist (`null`, `""`, `{}`) |

**Wann `if-exists` nutzen?** Für Felder, die nur unter bestimmten Umständen gesetzt werden und deren Abwesenheit kein Fehler ist:

- `LastMoved` — wird nur gesetzt, wenn eine Datei tatsächlich verschoben wurde
- Optionale Metadaten, die später manuell ergänzt werden

**Beispiel:** `Dates.Moved` in `data.json`:
```json
{
  "id": "lastMoved",
  "yamlKey": "Dates.Moved",
  "requirement": "if-exists",
  "type": "text"
}
```
Eine Datei ohne `Dates.Moved` wird **nicht** als incomplete gemeldet. Existiert `Dates.Moved:` (leer), wird sie gemeldet.

Der Modus wird in den Einstellungen pro Feld per Dropdown gewählt (Required / If-exists).

---

## 10. YAML Key Migration

When you **rename a field's YAML Key** in Settings, the plugin remembers the old key:

```
Vorher: id: projectStatus → yamlKey: ProjectStatus
Nachher: id: projectStatus → yamlKey: Project-Status

Or rename a built-in field:

```
Vorher: id: lastModified → yamlKey: LastModified
Nachher: id: lastModified → yamlKey: Modified
```
```

The migration is stored in `data.json` under `pendingMigrations`. On the next write to each file:

```
processFrontMatter:
  ├─ fm["Project-Status"] = fm["ProjectStatus"]   # copy old→new
  └─ delete fm["ProjectStatus"]                     # remove old key
```

Only if the new key doesn't exist yet — existing values are never overwritten.

You can also clean up orphaned keys from **deleted** fields with the `md-butler:cleanup-keys` command.

---

## 11. Protected YAML Keys

Some YAML keys are managed by other plugins:

- `cssclass` — Obsidian appearance
- `aliases` — Obsidian aliases
- `id` — Dataview, Kanban, etc.
- `tags` — Obsidian tags

Add these to **Protected YAML Keys** (one per line). The plugin will:

- Never overwrite them
- Never delete them (even during auto-removal or cleanup)

```
Protected YAML Keys:
  cssclass
  aliases
  id
  tags
```

This makes MD Butler safe to use alongside Templater, Dataview, Linter, and any other plugin that writes to frontmatter.

---

## 12. Commands

| Command ID | Name | When to use |
|-----------|------|-------------|
| `md-butler:apply-all` | Apply Metadata to all Notes | After initial config — run once to backfill all files |
| `md-butler:force-apply` | Force-apply metadata to all notes | After changing a template — overwrites existing values everywhere |
| `md-butler:full-repair` | Full repair | One command for force → cleanup → consistency check |
| `md-butler:check-consistency` | Vault Consistency Check | After migration or to find files with missing fields |
| `md-butler:cleanup-keys` | Clean up old YAML keys | After deleting a field — removes leftover keys vault-wide |
| `md-butler:edit-select-fields` | Edit select fields in current note | Opens the Select Field Editor for the currently active note |
| `md-butler:standardize-values` | Standardize / Normalize values | Opens the Value Standardizer to fix inconsistent values vault-wide |
| `md-butler:bulk-rename-key` | Bulk rename YAML key | Opens the Key Rename dialog to rename a YAML key across all files |

---

## 12a. Modals & Dialogs

Several commands open a modal dialog. Here is what each one does and how to use it.

| Modal | Opened by | Purpose |
|-------|-----------|---------|
| **Select Field Editor** | `md-butler:edit-select-fields` | Edit `select` and `multi` fields of the current note |
| **Consistency Report** | `md-butler:check-consistency` | Shows which files are missing fields or have invalid values |
| **Bulk Progress** | `apply-all`, `force-apply`, `full-repair` | Shows bulk-operation progress and allows cancelling |
| **Value Standardizer** | `md-butler:standardize-values` | Preview and fix inconsistent field values vault-wide |
| **Key Rename** | `md-butler:bulk-rename-key` | Rename a YAML key across all files |

### Select Field Editor

Opens for the currently active note and shows one dropdown per enabled `select` field and one set of
checkboxes per enabled `multi` field.

- **Options** are loaded from `optionsFile` (📁) or `optionsDataview` (📊) when configured, otherwise from the manual `options` list. Options are always freshly reloaded when the dialog opens.
- **Nested fields** (e.g. `note.NoteType`) are read and written correctly.
- Select a value → it is written to the note's frontmatter immediately.
- If the note has no select/multi fields configured, the dialog shows a hint instead.

### Consistency Report

Result of `md-butler:check-consistency`. Shows a summary and a detail list.

- **Summary:** Scanned / Complete / Incomplete files + number of value issues.
- **Incomplete Files:** Red list of files with their missing field names.
- **Value Issues:** Orange, expandable per YAML key — shows `"current" → expected: [...]` for each file.
- **Copy to clipboard:** Button at the top creates a plain-text version of the whole report — useful for sharing or documenting a migration.

> **Tip:** In `if-exists` requirement mode a field is only flagged when its key exists but is empty
> (`null`, `""`, `{}`). A completely missing key is *not* reported. See §9a.

### Bulk Progress

Shows `Processed X / N files` while a bulk operation runs.

- **Cancel** aborts the operation — already processed files are kept, remaining ones are skipped.
- After cancellation the button reads "Cancelling..." and is disabled.

### Value Standardizer

Scans the whole vault for values that do not match the configured `options` list (select/multi) or are
not parseable (boolean/number). Only runs on enabled fields.

- **Preview:** Issues are grouped by YAML key, then by file. For each issue you pick the correct value.
- **Apply:** Writes the selected values back to all affected files in one pass.
- **No undo:** Changes are permanent — review the preview carefully.
- **Protected keys** are never touched.

### Key Rename

Renames a YAML key across the whole vault (also nested keys like `note.NoteID`).

1. Enter the **old** and **new** YAML key.
2. Click **Scan** — shows how many files are affected (button label updates, e.g. "Rename in 23 files").
3. Click **Rename** — all files are updated immediately.
   - ⚠ **Irreversible.** Files are modified as soon as you click.
   - If a field in Settings uses the same key, its `yamlKey` is updated automatically and the old key is tracked for migration.

---

## 13. Workflows & Best Practices

### MD Butler + Templater

MD Butler is a complement to Templater, not a replacement:

| Aspect | Templater | MD Butler |
|--------|-----------|-----------|
| Trigger | Manual template insertion | Automatic file events |
| Scope | Per-note templates at creation | Vault-wide continuous maintenance |
| Rename tracking | Not built-in | Automatic on rename |
| Conditionals | Not available | 5 types × 4 operators |
| Auto-removal | Not available | Yes, when conditions fail |

**Recommended split**:
- Use **Templater** for note content (`tp.file.content`, dynamic sections, prompts)
- Use **MD Butler** for metadata maintenance (dates, paths, custom fields)
- Disable Templater's dynamic YAML fields — let MD Butler handle them reliably

### Incremental adoption

1. **Start small**: Enable only `DateCreated` + `LastModified` on `newOnly` mode
2. **Add structure**: Enable `FilePath` + `FileName` — they fill in automatically on open/rename
3. **Try select fields**: Enable `noteType` with default `"Note"` — categorise your notes gradually
4. **Add conditions**: Create a custom field that only shows for certain `noteType` values
5. **Tune filters**: Exclude `Templates/` or `Archive/` folders
6. **Bulk apply**: Run `apply-all` to backfill everything

### Vault-wide vs per-folder

- Vault-wide config works for most users — just exclude non-note folders
- Use **include mode** + per-folder conditions if different areas need different fields
- Use **conditions** (folder type) to limit specific fields to specific folders without changing the global filter
