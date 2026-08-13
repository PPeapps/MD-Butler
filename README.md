# MD Butler

<p align="center">
  <img src="logo.png" alt="MD Butler" width="200"/>
</p>

**MD Butler** is an Obsidian plugin that automatically manages YAML frontmatter fields for all your notes. Event-driven, configurable, and a reliable alternative to Templater formulas for consistent metadata.

## Features

- **Event-driven metadata**: Automatically update metadata on file open, modify, rename, or bulk operations
- **Configurable fields**: 8 built-in fields (FileName, FilePath, DateCreated, NoteType, LastModified, LastMoved, Source, Tags) plus unlimited custom fields
- **Template system**: Powerful `{{template}}` expressions with pipe-chain functions (`{{title | upper | replace:a,b}}`)
  - Date formatting: `{{date:YYYY-MM-DD}}`, `{{now+7d}}`
  - Frontmatter access: `{{frontmatter:key}}`
  - File properties: `{{title}}`, `{{fileName}}`, `{{filePath}}`, `{{oldPath}}`, `{{oldName}}`, `{{oldFolder}}`
  - Pipe functions: `upper`, `lower`, `trim`, `replace:X,Y`, `default:VAL`, `substr:S,E`, `date:FMT`
- **Conditional fields**: Apply fields only when conditions are met (frontmatter, path, filename, or folder rules). Auto-removes the YAML key when the condition no longer matches
- **Event binding**: Per-field event checkboxes (open, modify, rename, bulk)
- **Folder filtering**: Include or exclude entire folder trees
- **Processing scope**: "New notes only" (skip files with DateCreated) or "All files"
- **Force apply**: Overwrite all metadata across the vault
- **Full repair**: Force-apply → cleanup orphaned keys → consistency check — all in one command
- **Do-Not-Touch list**: Protect specific YAML keys from being deleted or overwritten
- **YAML key migration**: Automatically migrate old YAML keys to new ones when you rename a field
- **Orphaned key cleanup**: Remove leftover YAML keys from deleted fields
- **Consistency check**: Scans your vault and reports files with missing fields
- **Field requirement modes**: `required` (default) or `if-exists` — `if-exists` only flags a field when the YAML key exists but is empty (useful for fields like LastMoved that are only set under certain circumstances)
- **Drag-and-drop UI**: Reorder fields easily in settings

## Installation

### From Obsidian Community Plugins (pending)

1. Open Obsidian Settings → Community Plugins
2. Browse and search for "MD Butler"
3. Install and enable

### Manual installation

1. Download the latest release from GitHub
2. Copy `main.js`, `manifest.json`, and `styles.css` to `VaultFolder/.obsidian/plugins/md-butler/`
3. Reload Obsidian and enable the plugin

## Commands

| Command | ID | Description |
|---------|----|-------------|
| Apply Metadata to all Notes | `md-butler:apply-all` | Update metadata for all notes respecting scope & filters |
| Force-apply metadata to all notes | `md-butler:force-apply` | Overwrite all metadata fields (ignores scope) |
| Full repair | `md-butler:full-repair` | Force-apply → cleanup → consistency check |
| Vault Consistency Check | `md-butler:check-consistency` | Scan vault for missing fields |
| Clean up old YAML keys | `md-butler:cleanup-keys` | Remove orphaned YAML keys from deleted fields |

## Settings

| Setting | Description |
|---------|-------------|
| Date Format | Moment.js format string for all date values |
| Processing Mode | "New notes only" or "All files" |
| Metadata Fields | Drag-and-drop list of enabled fields with templates, events, and conditions |
| Excluded Folders | Folders to skip (when in exclude mode) |
| Included Folders | Folders to process (when in include mode) |
| Protected YAML Keys | Keys the plugin must never delete or overwrite |

## Field Types

### Built-in fields

| Field ID | YAML Key | Default Events | Description |
|----------|----------|---------------|-------------|
| fileName | FileName | open, rename, bulk | Current file name without extension |
| filePath | FilePath | open, rename, bulk | Full vault path to the file |
| dateCreated | DateCreated | open, rename, bulk | Date the file was first created |
| noteType | NoteType | open, rename, bulk | Select field: Project, Note (default), Task, Person, Meeting, Reference |
| lastModified | LastModified | modify, rename, bulk | Date the file was last modified |
| lastMoved | LastMoved | rename | Date the file was last renamed/moved (`requirement: if-exists`) |
| source | Source | open, rename, bulk | Custom field (disabled by default) |
| tags | Tags | modify, bulk | Custom field (disabled by default) |

### Select fields

Fields can be `type: "text"` (default) or `type: "select"`. Select fields have:
- Configurable `options[]` — the allowed values (one per line in settings)
- `defaultValue` — set once for new notes if no template is active
- Template dropdown — pick one option to always overwrite with that value
- Smart default: when template is "(none)", the writer sets `defaultValue ?? options[0]` for new notes

Built-in NoteType is a select field. Create your own (Status, Priority, Area, etc.).

### Custom fields

Create unlimited custom fields with:
- Custom YAML key name
- Type selection (text or select)
- Template expression or default value
- Event binding (open/modify/rename/bulk)
- Conditions for selective application
- Drag-and-drop reordering

### Requirement modes

Each field has a `requirement` mode that controls how the Vault Consistency Check flags it:

| Mode | Behavior |
|------|----------|
| `required` (default) | Field must exist — reported as missing if the YAML key is absent |
| `if-exists` | Field is only flagged if the YAML key exists but is empty (`null`, `""`, or `{}`) |

Use `if-exists` for fields that are only set under certain circumstances and should not be flagged when simply absent — e.g. `LastMoved` (only set when a file has been moved) or optional metadata that is added later.

## Template Reference

```
{{date:YYYY-MM-DD}}              → 2026-06-17
{{now+7d}}                       → 2026-06-24 (relative date)
{{now-1w}}                       → 2026-06-10 (relative date, supports d/w/M/y)
{{title}}                        → File name without extension
{{fileName}}                     → File name with extension
{{fileFolder}}                   → Parent folder path
{{filePath}}                     → Full vault path
{{oldPath}}                      → Previous path (rename events only)
{{oldFolder}}                    → Previous folder (rename events only)
{{oldName}}                      → Previous file name (rename events only)
{{frontmatter:key}}              → Value of any frontmatter key
{{title | upper}}                → UPPERCASE
{{title | lower}}                → lowercase
{{title | trim}}                 → trimmed
{{title | replace:a,b}}          → Replace all 'a' with 'b'
{{title | default:Untitled}}     → Fallback if empty
{{title | substr:0,5}}           → First 5 characters
{{date:YYYY | upper}}            → Chained: format then uppercase
```

## Conditions Reference

| Type | Operators | Description |
|------|-----------|-------------|
| always | — | Always apply (default) |
| frontmatter | exists, equals, matches, contains | Check a frontmatter key value |
| path | equals, matches, contains | Check file path |
| filename | equals, matches, contains | Check file name |
| folder | equals, matches, contains | Check parent folder |

Fields with conditions are **auto-removed** from frontmatter when their condition no longer matches — the YAML key is deleted on the next event that triggers a write.

## Development

```bash
# Clone the repo
git clone https://github.com/PPeter/md-butler
cd md-butler

# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

## Requirements

- Obsidian v1.8.0 or later
- No external dependencies (uses Obsidian API only)

## License

MIT
