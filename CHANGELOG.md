# Changelog

## 1.0.0 — Initial Release (July 2026)

### Nested YAML Groups (hierarchical keys)

Dot-notation in yamlKey enables nested frontmatter structures:

```yaml
# Flat
NoteID: abc-123
DateCreated: 2026-07-02

# Nested (via group dropdown)
note:
  NoteID: abc-123
dates:
  DateCreated: 2026-07-02
```

**Components:**

| Component | LOC | Details |
|-----------|-----|---------|
| `NestedPath.ts` — 4 pure functions | ~80 | `getNested`, `setNested`, `deleteNested`, `hasNested` |
| Settings extension (yamlGroups, groupFile) | ~30 | Interface + defaults |
| FieldListComponent — group dropdown | ~120 | Per-field prefix, 📁 import, tags exception |
| MetadataWriter — deep writes | ~50 | All `fm[key]` → `getNested/setNested/etc.` |
| Read paths (3 services) | ~40 | ConsistencyChecker, ConditionEvaluator, TransformEngine |
| Modals (3 components) | ~30 | SelectFieldModal, StandardizerService, StandardizeModal |
| BulkRenameModal + Settings-Sync | ~40 | Deep rename + auto settings update |
| Migration flat↔nested | ~30 | `pendingMigrations` + noteId safety net |
| **Total** | **~420 LOC** | |

**Problems solved during implementation:**

| Problem | Solution |
|---------|----------|
| Empty `yamlGroups` after update | Fallback in `loadSettings()` to `DEFAULT_SETTINGS.yamlGroups` |
| Group file with plain-text values | YAML frontmatter + plain-text fallback |
| NoteID regenerates on group change | Migration check before `generateNoteId()` |
| BulkRename doesn't update settings | Settings-sync after rename |
| `removeCompletedMigrations()` fails for nested oldKeys | `frontmatter[m.oldKey]` → `getNested(frontmatter, m.oldKey)` |
| Tags should not be grouped | `GROUP_LOCKED_FIELDS = new Set(["tags"])` |
| YAML frontmatter vs plain-text for groups | `getFileCache(file)?.frontmatter?.groups` → fallback `vault.read()` + split |

### Standardizer / Field Migration

Scans the entire vault for inconsistent field values and provides preview + correction:

```yaml
Status: "active"  → "Active"   (via options list)
Status: "done"    → "Completed"
Priority: "high"  → "High"
```

**Components:**

| Component | LOC | Details |
|-----------|-----|---------|
| `StandardizerService` | ~200 | Vault scan + value comparison + bulk fix |
| `StandardizeModal` | ~150 | Preview UI grouped by field |
| `BulkRenameModal` | ~180 | Key rename + settings sync + protected key check |
| `ConsistencyChecker` — value validation | ~30 | Value issue detection extension |
| `main.ts` — 2 new commands | ~30 | `standardize-values`, `bulk-rename-key` |
| **Total** | **~590 LOC** | |

**Benefits confirmed:**
- Fixes the "wild growth" problem in manually maintained vaults
- Bulk-Key-Rename is a natural extension of `pendingMigrations`
- StandardizeModal with preview prevents surprises

**Known limitations:**
- No undo function (irreversible)
- Standardization rules based on `options[]` only — no external mapping tables

### Field Groups (integrated into Nested YAML)

The per-field group dropdown serves both the YAML structure and visual grouping. YAML groups (`note`, `dates`, `special`, custom) replace purely cosmetic field groups. No separate implementation needed.

### Statistical Overview

| Metric | Value |
|--------|-------|
| **Version** | 1.0.0 |
| **TypeScript files** | ~34 |
| **Services** | 12 (ConditionEvaluator, ConsistencyChecker, DataviewRunner, EventDeduplicator, PathFilter, ScopeManager, TransformEngine, UpdateQueue, BatchFlusher, MetadataUpdateBuilder, MetadataWriter, StandardizerService) |
| **Views/Modals** | 5 (SelectFieldModal, ConsistencyModal, BulkProgressModal, StandardizeModal, BulkRenameModal) |
| **Utilities** | 4 (DateUtils, IdUtils, SelectUtils, NestedPath) |
| **Types** | 3 (Events, MetadataField, Queue) |
| **Settings files** | 5 (settings, SettingsTab, FieldListComponent, FileSuggestModal, FolderSuggestModal) |
| **Commands** | 8 |
| **Built-in fields** | 9 |
| **Field types** | 5 (text, select, boolean, number, multi) |
| **Option sources** | 3 (manual, file, Dataview) |
| **Condition types** | 5 (always, frontmatter, path, filename, folder) |
| **Condition operators** | 4 (exists, equals, matches, contains) |
| **Template expressions** | 12 (date, now±, title, fileName, filePath, etc.) |
| **YAML groups** | 3 Default (note, dates, special) + unlimited custom |

### Open for Future Versions

**Cross-Note / Lookup Fields** — automatic dependency tracking for `{{lookup:…}}`.
Remaining challenges: dependency graph persistence, update storms, cycle detection, merge conflicts with manual edits.

---

*Initial public release.*
