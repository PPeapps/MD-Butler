# MD Butler – User Guide

**Version 1.0.0 – July 2026**

---

## 1. Introduction

MD Butler automates YAML frontmatter maintenance across your Obsidian vault.
While Templater formulas must be inserted per file, MD Butler works centrally:
define your fields and templates once — the plugin handles the rest.

---

## 2. Installation

### From the Community Plugin Store (when published)
1. Open Obsidian → **Settings** → **Community Plugins**
2. Search for "MD Butler"
3. Install and enable

### Manual Installation
1. Copy `main.js`, `manifest.json`, `styles.css` from the build folder
2. Paste into your vault's plugin folder:
   `<Vault>/.obsidian/plugins/md-butler/`
3. Restart Obsidian
4. Enable the plugin in settings

### Build from Source (for developers)
```bash
git clone <repository>
cd md-butler
npm install
npm run build
```
Build artifacts will be in the project root.

---

## 3. Getting Started

### 3.1 Enable the Plugin
After installation, toggle "MD Butler" on in the **Community Plugins** settings.

### 3.2 Open Settings
In **Plugin Settings** (under "Community Plugins" → MD Butler → gear icon) you'll find:

- **Date Format** – default: `YYYY-MM-DD ddd HH:mm:ss`
- **Processing Mode** – `newOnly` (only notes without DateCreated)
- **YAML-Groups** – group list + import (📁)
- **Metadata Fields** – list of all fields
- **Folder Filter** – exclude/include folders
- **Protected YAML Keys** – Do-Not-Touch list

### 3.3 Configure Your First Field
Default fields like `fileName`, `filePath`, `dateCreated`, `lastModified`, `noteType`, `noteId`, and `lastMoved` are pre-configured.

You can:
- Change **order** via drag & drop (☰)
- Rename **YAML keys** (e.g. `DateCreated` → `CreatedOn`)
- Enable/disable **events** per field (checkboxes)
- Change the **type**
- Enter a **template**
- Assign a **YAML-Group** via dropdown

### 3.4 Testing
1. Create a new note
2. On first open, `DateCreated` and other fields are written
3. In the **Command Palette** (`Ctrl+P`):
   - `Apply Metadata to all Notes` – processes all notes without DateCreated
   - `Force-apply metadata to all notes` – overwrites all existing values

---

## 4. Configuration in Detail

### 4.1 Date Format
Moment.js format string. Examples:
| Format | Output |
|--------|--------|
| `YYYY-MM-DD ddd HH:mm:ss` | `2026-07-02 Thu 14:30:00` |
| `DD.MM.YYYY HH:mm` | `02.07.2026 14:30` |
| `YYYY-MM-DD` | `2026-07-02` |
| `ddd, DD. MMM YYYY` | `Thu, 02. Jul 2026` |

### 4.2 Processing Mode
| Mode | Behavior |
|------|----------|
| `newOnly` (default) | On first open/bulk, only notes WITHOUT `DateCreated` are processed |
| `allFiles` | All notes are always processed (even on every open) |

Tip: For existing vaults with many files, use `newOnly` then run `Apply Metadata to all Notes`.

### 4.3 Metadata Fields

#### Built-in Fields (hardcoded)
| ID | YAML Key (default) | Group (default) | Events | Description |
|----|--------------------|-----------------|--------|-------------|
| `noteId` | `NoteID` | `note` | `open` (fixed) | UUID v4, auto-assigned |
| `fileName` | `FileName` | `note` | `open, rename, bulk` | File name without extension |
| `filePath` | `FilePath` | `note` | `open, rename, bulk` | Vault-relative path |
| `dateCreated` | `DateCreated` | `dates` | `open` (fixed) | Creation date |
| `noteType` | `NoteType` | – | `open, rename, bulk` | Select field with default options |
| `lastModified` | `LastModified` | `dates` | `rename, bulk` (modify forbidden) | Last modification date |
| `lastMoved` | `LastMoved` | `dates` | `rename` | Last move date |

#### Custom Fields (freely definable)
- **ID**: Internal identifier (freely chooseable)
- **YAML Key**: The key in frontmatter
- **Group**: YAML group (prefix for yamlKey)
- **Type**: text/select/boolean/number/multi
- **Events**: Which events trigger the field
- **Template**: Template expression or empty
- **Default Value**: Fallback if no template
- **Condition**: Condition for setting the field

#### Adding/Deleting Fields
- **+ Add Field** – Create a new custom field
- **✕** (on custom fields) – Delete the field
- **☰** (drag) – Change order

#### Enable Toggle
Each field can be toggled on/off. Disabled fields are ignored.

### 4.4 Event Configuration

Per field, you can define which events trigger an update:

| Event | Trigger |
|-------|---------|
| `open` | File is opened (queue only – no immediate write) |
| `modify` | File is saved |
| `rename` | File is renamed/moved |
| `bulk` | Used during bulk operations |

**Fixed Events**: `noteId` and `dateCreated` have hardcoded events (`open`). Their checkboxes are grayed out — these fields only react to `open`.
**Forbidden Events**: `lastModified` has `modify` forbidden (`FORBIDDEN_EVENTS`) — the plugin sets this timestamp automatically, no user trigger should override.

Default events per built-in field:
- `noteId`: `open` (fixed)
- `dateCreated`: `open` (fixed)
- `fileName`/`filePath`: `open, rename, bulk`
- `noteType`: `open, rename, bulk`
- `lastModified`: `rename, bulk` (modify forbidden)
- `lastMoved`: `rename`

### 4.5 YAML-Groups & Nested YAML

MD Butler supports hierarchical (nested) YAML frontmatter via dot-notation in yamlKey.

**Example** – flat vs. grouped:
```yaml
# Flat (no group)
NoteID: abc-123
DateCreated: 2026-07-02
FileName: Meeting

# Grouped (with group)
note:
  NoteID: abc-123
  FileName: Meeting
dates:
  DateCreated: 2026-07-02
```

The group is assigned via a per-field dropdown:
```
[Group: ▼note]  [yamlKey:  NoteID     ] → saves as "note.NoteID"
```

**Available Groups:**
- `note` – Built-in: noteId, fileName, filePath
- `dates` – Built-in: dateCreated, lastModified, lastMoved
- `special` – Default group (freely usable)
- Custom groups – added via text field + 📁 import

**Tags exception:** The `tags` field is locked to `(none)` – `tags:` always stays flat (Obsidian compatibility).

**Configuring YAML-Groups:**
- **Text field** under "YAML-Groups:" – type groups directly (one per line)
- **📁 button** – import from .md file (reads `groups:` frontmatter or plain-text list)
- **✕ button** (Clear) – Clears the text field; reverts to built-in default groups (`note, dates, special`)
- **Status display** – Shows `(from: path/to/file.md)` when groups were loaded from a file

**Migration:** When you assign a group to a field (or change groups), the yamlKey is automatically migrated. The old flat/nested key is copied and deleted.

### 4.6 Folder Filter

| Mode | Description |
|------|-------------|
| **Exclude** (default) | All folders are processed EXCEPT those listed |
| **Include** | ONLY the listed folders are processed |

- One folder per line
- Subfolders are included recursively
- For Include mode, `*` can be used as a wildcard for "all folders"
- Folder picker via 📁 button

**Important**: In Include mode WITHOUT any listed folders, no file is processed.
The plugin will show a warning.

### 4.7 Do-Not-Touch (Protected YAML Keys)

Protected YAML keys are **never** overwritten or deleted by the plugin.

Typical entries:
```
cssclass
aliases
id
tags
```

Migrations and orphaned key cleanups also respect this list.

### 4.8 Conditions

A field is only set/updated when the condition is met.

#### Frontmatter Conditions (supports nested keys)
| Operator | Example | True when… |
|----------|---------|------------|
| `exists` | `frontmatter:status exists` | Key exists (even if empty) |
| `equals` | `frontmatter:NoteType equals Project` | Value == "Project" |
| `contains` | `frontmatter:NoteType contains Pro` | Value contains "Pro" |
| `matches` | `frontmatter:NoteType matches ^Pro` | Regex matches |

#### Path Conditions
| Type | Description |
|------|-------------|
| `path` | Checks against `file.path` (e.g. `path contains _Test`) |
| `filename` | Checks against `file.name` (e.g. `filename matches ^\d{6}`) |
| `folder` | Checks against the folder (e.g. `folder equals Projects`) |

#### Special Case: Conditional Cleanup
If a field has a condition, the YAML key already exists in frontmatter, but the condition is NO longer met, the key is **automatically removed**.
This prevents stale metadata from lingering.

---

## 5. Template Engine

### 5.1 Base Expressions

```
{{title}}         → File name (without extension)
{{fileName}}      → File name (with extension)
{{filePath}}      → Vault-relative path
{{fileFolder}}    → Folder path
{{oldPath}}       → Previous path (rename)
{{oldFolder}}     → Previous folder (rename)
{{oldName}}       → Previous file name (rename)
```

### 5.2 Date Expressions

```
{{date:YYYY-MM-DD}}         → Current date in custom format
{{now+7d}}                  → Today + 7 days (in configured DateFormat)
{{now-1d}}                  → Today - 1 day
{{now+2w}}                  → Today + 2 weeks
{{now-3m}}                  → Today - 3 months
{{now+1y}}                  → Today + 1 year
```

Units: `d` (days), `w` (weeks), `m` (months), `y` (years)

### 5.3 Frontmatter Lookup in the Current File

```
{{frontmatter:NoteType}}    → Value of key NoteType from the current file
{{frontmatter:note.NoteID}} → Value of a nested key
```

Case-insensitive — finds `notetype` even if the key is `NoteType`. Nested keys are matched segment-wise case-insensitively.

### 5.4 Lookup in Other Files

```
{{lookup:path/to/file.md,NoteType}}
{{lookup:_Test/Example.md,Status}}
{{lookup:/XTRAS/Lookups/NoteTypes.md,options}}
```

**Path resolution** (order):
1. Absolute path (starts with `/`) → `/Folder/File.md`
2. Path as entered (e.g. `_Test/File.md`)
3. Relative to the current file's folder → `CurrentFolder/_Test/File.md`
4. `../` for parent folders → `../Lookups/File.md`

**Case-insensitive**: lookup finds `Notetype`, `notetype`, or `noteType`. Nested keys are also resolved.

**Lookup cache**: Cached per template resolve cycle.
**Max lookup depth**: 3 (lookup in lookup in lookup).

### 5.5 Pipe Chain (Value Transformation)

```
{{title | upper}}

{{lookup:file.md,Status | lower | trim}}

{{lookup:file.md,Name | default:Unknown}}

{{frontmatter:Date | date:MM.DD.YYYY}}
```

| Pipe | Parameter | Example | Result |
|------|-----------|---------|--------|
| `upper` | – | `"hello"\|upper` | `HELLO` |
| `lower` | – | `"HELLO"\|lower` | `hello` |
| `trim` | – | `" hello "\|trim` | `hello` |
| `replace` | `old,new` | `"a-b-c"\|replace:-,/` | `a/b/c` |
| `substr` | `start` or `start,end` | `"hello"\|substr:1,4` | `ell` |
| `default` | `value` | `""\|default:unknown` | `unknown` |
| `date` | `FORMAT` | `"2026-07-02"\|date:MM.DD.` | `07.02.` |

Multiple pipes can be combined:
```
{{lookup:file.md,NoteType | lower | replace: ,_ | default:misc}}
```

### 5.6 Combined Templates

```
Created by {{title}} on {{date:MM/DD/YYYY}} at {{date:HH:mm}}
→ "Created by Meeting-Note on 07/02/2026 at 14:30"

{{lookup:_Test/260702/260702-dddd.md,NoteType | upper}}
→ "MINE" (if NoteType = "mine")
```

---

## 6. Option Sources for Select & Multi

### 6.1 Manual List (options)
One entry per line in the field configuration's text area.

### 6.2 Options File (📁 = `optionsFile`)
A `.md` file in the vault with:

**Variant A**: YAML frontmatter
```yaml
---
options:
  - Project
  - Note
  - Task
  - Meeting
---
```

**Variant B**: Plain text list (one option per line)
```
Project
Note
Task
Meeting
```

The 📁 button in the field configuration opens a file picker dialog.

### 6.3 DataviewJS (📊 = `optionsDataview`)

A DataviewJS query returning an array of strings:

```javascript
dv.pages().flatMap(p => p.file.tags).distinct().sort().values
```

```javascript
dv.pages('"3_PROJECTS"').map(p => p.file.name)
```

```javascript
dv.pages('#status').map(p => p.Status).distinct().sort().values
```

**Execution**:
- 📊 button opens the editor
- ▶ Execute runs the query and sets the options
- Auto-executed on plugin startup if no `optionsFile` is set

**Notes**:
- The code is executed as `new Function("dv", "return " + code)`
- Multi-line code needs an explicit `return` statement
- Dataview DataArray is automatically converted to an Array

### 6.4 Priority

When resolving options, the order is:

1. **`optionsFile`** (📁) – Highest priority. If set, Dataview options are ignored.
2. **`optionsDataview`** (📊) – Medium priority. Executed on plugin startup.
3. **`options`** (manual list) – Lowest priority.

---

## 7. Modals

MD Butler uses five different modal windows for user interaction:

---

### 7.1 SelectFieldModal – Selection Editor

The SelectFieldModal lets you edit all **select** and **multi** fields of the currently open note without touching the YAML frontmatter directly.

#### Invocation
- **Command Palette** (`Ctrl+P`): `Edit select fields in current note`
- Only available when a file is open

#### UI Description

```
┌─ MD Butler — Meeting Note ──────────────────────┐
│                                                  │
│   NoteType                                       │
│   from: XTRAS/NoteTypes.md                       │
│   [Project  ▼]                                   │
│                                                  │
│   Priority                                       │
│   [Medium ▼]                                     │
│                                                  │
│   Technologies                                   │
│   from: XTRAS/TechStack.md                       │
│   ☑ TypeScript                                   │
│   ☑ React                                        │
│   ☐ Python                                       │
│   ☑ Docker                                       │
│                                                  │
│   Status                                         │
│   (No options available)    [➕ Create file]      │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Title bar**: shows `MD Butler — <filename>`
- **One row per field**: YAML key as the label, controls below
- **Select fields**: Dropdown with all available options
- **Multi fields**: Checkboxes (any number of values can be selected)
- **Option source**: If the field uses an options file, `from: <path>` is displayed
- **"Create file" button**: Only shown when the configured options file does not exist
- **Nested YAML**: Values are correctly read/written (including nested keys like `project.Status`)

#### Options are Loaded Dynamically

When the modal opens, options for all select/multi fields are refreshed:

1. **Options file (📁)**: The `.md` file is read — both `options:` frontmatter and plain text lists
2. **Options Dataview (📊)**: The DataviewJS query is re-executed
3. **Manual list**: Already-configured options are used as-is

> **Note**: Options are loaded fresh when the modal opens — not from cache.
> Changes to the options file are visible immediately.

#### Write Behavior

- Changes are written **immediately** via `processFrontMatter`
- **Select**: The chosen value replaces the previous YAML value
- **Multi**: All checked values are written as an array, unchecked values are removed
- The modal does not need to be closed — values are persisted after every change

#### Use Cases

| Situation | Benefit |
|-----------|---------|
| **Quick categorization** | Change NoteType, Status, or Priority via dropdown — no YAML editing |
| **Multiple technologies** | Multi-field with checkboxes for projects, skills, tags |
| **Options file missing** | The "➕ Create file" button creates a skeleton options file |
| **Overview of all select fields** | See all select/multi values of a note in one view |
| **Correct values after Bulk-Apply** | Quickly reset individual fields after a Force-Apply |

---

### 7.2 BulkProgressModal – Progress Display

The BulkProgressModal appears during long-running bulk operations to show progress and offer cancellation.

#### Triggering Commands

- `Apply Metadata to all Notes`
- `Force-apply metadata to all notes`
- `Clean up old YAML keys`
- `Standardize / Normalize values` (during bulk)
- `Bulk rename YAML key`

#### UI Description

```
┌─ Bulk Metadata Update ──────────────────────────┐
│                                                  │
│   Processing 127 / 340 files                     │
│                                                  │
│   [ Cancel ]                                     │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Title**: `Bulk Metadata Update`
- **Progress text**: `Processing X / Y files` (updated every 50 files)
- **Cancel button**: Aborts the operation (button becomes disabled, text "Cancelling...")

#### Cancel Behavior

1. Click `[Cancel]` → button disabled, text changes to "Cancelling..."
2. The current file finishes processing, then the loop stops
3. A notice appears: *"Cancelled after X files."*
4. Already written files are kept (no rollback)

---

### 7.3 ConsistencyModal – Consistency Report

The ConsistencyModal shows the results of the `Vault Consistency Check` in a clear summary.

#### UI Description

```
┌─ Vault Consistency Check ───────────────────────┐
│                                                  │
│   Scanned: 340 files                             │
│   Complete: 312 files          (green)           │
│   Incomplete: 28 files         (red)             │
│   Value Issues: 15 files       (orange)          │
│                                                  │
│   ── Incomplete Files ──                         │
│   • _Inbox/Idea.md                               │
│     Missing: Status, Priority                    │
│   • _Inbox/Note.md                               │
│     Missing: NoteType                            │
│   • 3_PROJECTS/App/README.md                     │
│     Missing: ProjectStatus, Technologies         │
│   ...                                            │
│                                                  │
│   ── Value Issues ──  (orange)                   │
│   ▼ Status (8 issues)                            │
│     ▶ _Inbox/Idea.md – "active" (expected:       │
│       Active/Inactive/Completed)                 │
│     ▶ _Inbox/Note.md – "done" (expected:         │
│       Active/Inactive/Completed)                 │
│     ...                                          │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Summary**: Number of scanned, complete, and incomplete files
- **Complete (green)**: All enabled fields are present
- **Incomplete (red)**: One or more fields missing — with detailed list per file
- **Value Issues (orange)**: Fields with values outside the `options[]` list (select/multi only), with expandable `<details>` elements per file
- **Per file**: File path + list of missing YAML keys (not field IDs)
- **Nested YAML**: Missing nested keys are correctly detected

---

### 7.4 StandardizeModal – Standardization Preview

The StandardizeModal shows a detailed preview of all pending value changes before executing value standardization.

#### Invocation
- **Command Palette** (`Ctrl+P`): `Standardize / Normalize values`

#### UI Description

```
┌─ Standardize Values ────────────────────────────┐
│                                                  │
│   Scanned: 340 files                             │
│   Issues found: 127                              │
│   Header-Files: 3 files contain duplicates       │
│   ⚠ Already exists → will be removed            │
│                                                  │
│   ── Status (42 issues) ──                       │
│   ▶ active    ─┐ [▼ Skip____________]          │
│                 │  Skip                         │
│     (23x)      │  Active                        │
│                │  Inactive                      │
│                │  Completed                     │
│   ▶ done      ─┤ [▼ Completed________]          │
│     (12x)      │                                │
│   ▶ yes       ─┤ [▼ Active___________]          │
│     (7x)       │                                │
│                                                  │
│   ▼ header.md                                    │
│     ⚠ Status: "Active" → duplicates existing     │
│     entry. Will be removed on apply.             │
│                                                  │
│   ▼ another.md                                   │
│     ⚠ Status: "Active" → duplicates existing     │
│                                                  │
│   [Apply X fixes]  [Cancel]                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Scan**: ConsistencyChecker.scan() looks for values outside the `options[]` list (select/multi) or wrong format (boolean/number)
- **Per-issue dropdown**: Choose either `Skip` (keep as-is) or the desired replacement value from the `options[]` list
- **Duplicate warning (⚠)**: Shows files that would have duplicate YAML entries after correction (same value, same key). Duplicates are automatically removed on apply
- **Apply X fixes**: Only applies non-`Skip` entries (with BulkProgressModal)
- **No rollback**: Changes are written directly to frontmatter after confirmation

#### Use Cases

| Situation | Benefit |
|-----------|---------|
| **Inconsistent select values** | `"Active"`, `"active"`, `"ACTIVE"` → automatically normalize |
| **After migration** | Clean up legacy values from previous systems |
| **Before Dataview queries** | Clean, uniform values for reliable queries |

---

### 7.5 BulkRenameModal – YAML Key Rename

The BulkRenameModal allows renaming a YAML key across all files in the vault.

> **Warning**: This action is **irreversible**. There is no UNDO. It is recommended to back up your vault before proceeding.

#### Invocation
- **Command Palette** (`Ctrl+P`): `Bulk rename YAML key`

#### UI Description

```
┌─ Bulk Rename YAML Key ─────────────────────────┐
│                                                  │
│   ⚠ This action is irreversible!                 │
│                                                  │
│   Old Key: [DateCreated________]                 │
│   New Key: [CreatedOn__________]                 │
│                                                  │
│   ☑ Sync settings if a field has this key        │
│                                                  │
│   Scanned: 0 / 0 files                           │
│                                                  │
│   [Scan]  [Rename] (disabled until scan)         │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **⚠ Warning**: Red "This action is irreversible!" notice at the top
- **Old Key**: The current YAML key (also nested: `note.NoteID`)
- **New Key**: The new YAML key (also nested: `dates.NoteID`)
- **Sync settings**: Automatically update the matching field in settings + create migration entry
- **Scan**: Count occurrences of the old key + shows "Scanned: X / Y files"
- **Rename**: Only enabled AFTER a successful scan. Execute the rename (with BulkProgressModal)

#### Protected Key Handling

If the Old Key is in the protectedYamlKeys list, a warning is shown and the operation is aborted.

#### Settings Sync

After rename, the code checks if a field has the same yamlKey:
1. `field.yamlKey = this.newKey`
2. Migration entry created/updated in `pendingMigrations`
3. Settings saved
4. Notice: `Settings updated: "dateCreated" → yamlKey "CreatedOn"`

---

### 7.6 FileSuggestModal – File Picker

The FileSuggestModal is a searchable selection dialog for markdown files in the vault. It is used in several places in the settings UI.

#### Invocation Contexts

| Context | Where | Description |
|---------|-------|-------------|
| **Template preview** (text fields) | 📁 button next to the template input | Selects a file to preview the template against |
| **Options file** (select/multi fields) | 📁 button next to the options | Selects a `.md` file whose content serves as the option list |

#### UI Description

```
┌─ Type or select a file… ───────────────────────┐
│  [src/___________________________]               │
│                                                  │
│  _Test/260702/260702-dddd.md                     │
│  _Test/260702/260702-note1.md                    │
│  3_PROJECTS/App/README.md                        │
│  Journal/2026-07-02.md                           │
│  XTRAS/Lookups/NoteTypes.md                      │
│  XTRAS/Lookups/ProjectStatus.md                  │
│  ...                                             │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Search field**: Filters the list in real-time as you type (matches path or file name)
- **List**: Up to 100 entries, sorted by path
- **Selection**: Clicking an entry closes the modal and passes the file to the calling function

---

### 7.7 FolderSuggestModal – Folder Picker

The FolderSuggestModal is a searchable selection dialog for folders in the vault. It is used in the folder filter settings.

#### Invocation Context

| Context | Where | Description |
|---------|-------|-------------|
| **Excluded Folders** | 📁 button next to the exclude list | Selects a folder to exclude from processing |
| **Included Folders** | 📁 button next to the include list | Selects a folder to include for processing |

#### UI Description

```
┌─ Type or select a folder… ─────────────────────┐
│  [3_Pro____________________________)              │
│                                                  │
│  3_PROJECTS                                      │
│  3_PROJECTS/App                                  │
│  3_PROJECTS/Website                              │
│  _Test                                           │
│  _Test/260702                                    │
│  ...                                             │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Search field**: Filters folders in real-time by name
- **Sort order**: By depth (shallow folders first), then alphabetically
- **Root folder** (`/`) is excluded from the list

---

## 8. Commands (Command Palette)

| Command (as shown in menu) | ID | Description |
|---------------------------|-----|-------------|
| Apply Metadata to all Notes | `md-butler:apply-all` | Processes all files without DateCreated (respects folder filter and scope) |
| Force-apply metadata to all notes (overwrite all) | `md-butler:force-apply` | Overwrites ALL metadata in all files |
| Full repair: force-apply → cleanup → consistency check | `md-butler:full-repair` | Force → Cleanup → Consistency check in one pass |
| Vault Consistency Check | `md-butler:check-consistency` | Scans all files for missing fields |
| Clean up old YAML keys | `md-butler:cleanup-keys` | Removes orphaned YAML keys |
| Edit select fields in current note | `md-butler-edit-select-fields` | Opens SelectFieldModal (only when a file is open) |
| Standardize / Normalize values | `md-butler:standardize-values` | Opens StandardizeModal with value report and fixes |
| Bulk rename YAML key | `md-butler:bulk-rename-key` | Opens BulkRenameModal for key rename |

### Bulk Operations in Detail

**Apply Metadata to all Notes**:
- Respects `processingMode`: newOnly skips files with DateCreated
- Respects `filterMode` and folder filter
- Sets `bulkRunning` flag (suppresses events during the operation)
- Shows progress modal with Cancel button

**Force-apply metadata to all notes (overwrite all)**:
- Overwrites ALL values, even if already present
- Also overwrites DateCreated (force=true)
- Ignores `processingMode` (always processes all files)
- Respects folder filter

---

## 9. Use Cases & Examples

The following scenarios show MD Butler in everyday use — from simple timestamps to nested lookups.

---

### 9.1 Automatic Timestamps on Every Note

**Goal**: Every note gets `DateCreated` on first open and `LastModified` on every edit.

**Setup**:
- Processing Mode: `newOnly`
- `dateCreated` → enabled, events: `open, rename, bulk`
- `lastModified` → enabled, events: `modify, rename, bulk`

**Before** (new note):
```yaml
---
title: Meeting Note
---
```

**After first open** (with Nested YAML, if groups are enabled):
```yaml
---
title: Meeting Note
note:
  NoteID: abc-123-xyz
dates:
  DateCreated: 2026-07-02 Thu 14:30:00
  LastModified: 2026-07-02 Thu 14:30:00
---
```

---

### 9.2 Status Field Only for Project Notes (Conditional Field)

**Goal**: A select field `ProjectStatus` only appears when `NoteType: Project`.
If NoteType changes to something else, the field disappears automatically.

---

### 9.3 Lookup: Inherit NoteType from a Source File

**Goal**: A source file has `NoteType: mine`. All other notes in the same folder inherit this value via lookup.

---

### 9.4 Priority Dropdown with Default "Medium"

**Goal**: A select field `Priority` with three options. New notes get `Medium` automatically.

---

### 9.5 Generate Tags from Dataview (Options File + Dataview)

**Goal**: A select field `Category` pulls its options dynamically from all tags in the vault.

---

### 9.6 Meeting Date via Condition + Template

**Goal**: Only when `NoteType: Meeting` is set, the current date is written to `MeetingDate`.

---

### 9.7 Multi-Field for Project Technologies

**Goal**: A multi field `Technologies` with checkbox selection.

---

### 9.8 Lookup Pipeline: Clean File Name

**Goal**: A `{{lookup:…}}` value should have spaces replaced by underscores and be lowercased.

---

### 9.9 Full Repair After Lookup Change

**Goal**: You changed the `NoteType` in the lookup source file. All target notes need immediate updating.

---

### 9.10 Select + Options File: Status from External Source

**Goal**: The `Status` of a project is managed via a central `.md` options file.

---

### 9.11 Nested YAML: Changing a Field's Group

**Goal**: Previously `yamlKey: "DateCreated"` (flat). You assign the group `dates` → `yamlKey: "dates.DateCreated"`.

**Setup**:
- Change group dropdown from `(none)` to `dates`
- yamlKey automatically changes from `DateCreated` to `dates.DateCreated`

**Migration (automatic)**:
```
On next write:
  1. getNested(fm, "DateCreated") → finds value "2026-07-02"
  2. setNested(fm, "dates.DateCreated", "2026-07-02")
  3. deleteNested(fm, "DateCreated")
```

**Before**:
```yaml
---
DateCreated: 2026-07-02
---
```

**After**:
```yaml
---
dates:
  DateCreated: 2026-07-02
---
```

---

### 9.12 Standardization: Fix Inconsistent Values

**Goal**: The vault has varying spellings for `Priority`: `"High"`, `"high"`, `"HIGH"`. All should be normalized to `"High"`.

**Flow**:
1. Command: `Standardize / Normalize values`
2. Scan shows: `high → High (12x)`, `HIGH → High (5x)`
3. Click "Fix All Issues"
4. BulkProgressModal shows progress
5. All values are now uniformly `High`

---

### 9.13 BulkRename: Rename YAML Key Everywhere

**Goal**: You want to rename `yamlKey: "DateCreated"` to `CreatedOn` in all files.

**Flow**:
1. Command: `Bulk rename YAML key`
2. Old Key: `DateCreated`
3. New Key: `CreatedOn`
4. Scan: `Found in 127 files`
5. Execute rename
6. Settings are automatically synchronized

---

## 10. Migration & Cleanup

### YAML Key Migration
When you rename a YAML key in settings (including group changes):
1. The old key is stored in `pendingMigrations`
2. On the next write, the old value is copied to the new key (via `getNested`/`setNested`)
3. The old key is deleted (via `deleteNested`)
4. Once no file has the old key, the migration is marked complete

### Orphaned Key Cleanup
When a field is deleted:
1. The YAML key is stored in `orphanedYamlKeys`
2. The `Clean up old YAML keys` command removes the key from all files
3. The list is then cleared

### Consistency Check
Scans all files (respecting folder filter) and shows:
- How many files are complete
- Which files are missing which fields
- Enables targeted follow-up processing

---

## 11. Tips & Best Practices

### 11.1 For Beginners
1. Start with the **default fields** (fileName, filePath, dateCreated, noteType)
2. Run `Apply Metadata to all Notes`
3. Add custom fields afterwards
4. Assign YAML-Groups as needed

### 11.2 For Select Fields
- Always set a **default value** (or use the first option as default)
- For many options: use an **options file** (📁)
- For dynamic options: use **DataviewJS** (📊)
- **Regular bulk** does NOT overwrite select fields (protects user selections)
- **Force-apply** overwrites select fields (caution!)

### 11.3 For Lookups
- Use **absolute paths** (`/Folder/File.md`) when possible
- For relative paths: consider the source file's folder
- Lookup values are re-resolved on every event (no dependency tracking yet)
- On error: `null` → template fails → field is not written

### 11.4 Performance
- The **event queue** (2s window) prevents overload
- **Bulk operations** show progress and can be cancelled
- **Do-Not-Touch** large files with metadata from other plugins
- **Options files** are loaded on-demand (not on plugin startup)

### 11.5 Known Limitations
- Lookup has NO automatic dependency tracking (no live update when the source file changes)
- DataviewJS needs simple return expressions (or explicit `return` for multi-line queries)
- The plugin does NOT load its own data on startup; options files are cached

---

## 12. Troubleshooting

### "failed to open" Message
This is an **Obsidian core bug** (not an MD Butler error). Occurs sporadically and is harmless.

### Dataview Errors
- "Dataview plugin not found" → Dataview plugin is not installed/activated
- "Query result is not an array" → The query must return an array
- Check the Dataview console (Ctrl+Shift+I)

### Lookup Returns No Value
1. Does the source file exist?
2. Does the source file have the requested frontmatter key?
3. Case sensitivity? (checked case-insensitively)
4. Lookup depth > 3? Aborted.

### Plugin Not Responding
1. Disable/re-enable the plugin in settings
2. Restart Obsidian
3. Check logs (Ctrl+Shift+I → Console)

### Select/Multi Values Are Overwritten
- Normal apply does NOT overwrite select/multi (Builder skips them)
- Force-apply overwrites EVERYTHING (intentionally designed for repair scenarios)
- With `{{lookup:…}}` templates, select/multi values are always updated (intended behavior)

---

## 13. Version History

| Version | New Features |
|---------|-------------|
| **1.0.0** | Nested YAML Groups (dot-notation, group dropdown, group import), Standardizer (value normalization, bulk key rename), tags lock, noteId migration safety, BulkRename settings sync, `findNestedCI` in TransformEngine, 5 field types (text/select/boolean/number/multi), 3 option sources, 5 condition types, 8 commands, event-driven architecture (open/modify/rename/bulk), cross-file lookup (`{{lookup:…}}`), Dataview integration, template engine with pipes |
