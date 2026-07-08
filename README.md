# MD Butler

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-7C3AED.svg)](https://obsidian.md/)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/ppeter/md-butler)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Automatically manage YAML frontmatter fields for all your notes.**  
An event-driven, configurable alternative to Templater formulas.

## Features

- **5 field types**: `text`, `select`, `boolean`, `number`, `multi`
- **Event-driven**: reacts to `open`, `modify`, `rename`, `bulk` – configurable per field
- **Template engine**: `{{title}}`, `{{filePath}}`, `{{date:…}}`, `{{lookup:path,field}}`, `{{frontmatter:key}}`, pipes (`| upper`, `| lower`, `| replace:a,b`, …)
- **Nested YAML Groups**: dot-notation yamlKeys (`note.NoteID`) → hierarchical frontmatter with group dropdown per field
- **Standardizer**: normalize field values vault-wide with preview modal and per-issue selection
- **Bulk YAML Key Rename**: rename keys across all files with migration tracking and settings sync
- **Cross-file lookup**: read frontmatter values from any vault file
- **Dataview integration**: generate select/multi options via DataviewJS queries
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

## Installation

1. Install from Obsidian Community Plugins (or manually copy `main.js`, `manifest.json`, `styles.css` to `<vault>/.obsidian/plugins/md-butler/`)
2. Enable the plugin in Obsidian settings
3. Configure your fields in the plugin settings
4. Run **"Apply Metadata to all Notes"** from the command palette (`Ctrl+P`)

## Quick Start

```yaml
# Example: after configuration, every new note automatically gets:
note:
  NoteID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
  FileName: My Note
dates:
  DateCreated: 2026-07-08 ddd 14:30:00
```

## Documentation

| Language | File |
|----------|------|
| English | [User Guide](docs/MD%20Butler%20-%20User%20Guide_en.md) · [ReadMe](docs/MD%20Butler%20-%20ReadMe_en.md) |
| German  | [Benutzerhandbuch](docs/MD%20Butler%20-%20User%20Guide_de.md) · [ReadMe](docs/MD%20Butler%20-%20ReadMe_de.md) |
| Technical | [Architecture](docs/architecture.md) · [Future Extensions](docs/Potential%20f%C3%BCr%20zuk%C3%BCnftige%20Erweiterungen.md) |

## Requirements

- **Obsidian** v1.8.0+
- **Dataview** plugin (optional, for `optionsDataview` and DataviewJS features)

## Build from source

```bash
git clone <repo>
cd md-butler
npm install
npm run build    # outputs main.js + manifest.json + styles.css
```

## License

MIT
