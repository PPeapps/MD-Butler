# MD Butler — Architecture

> Obsidian plugin for automatic YAML frontmatter management.
> Event-driven, service-oriented, configurable.
> Mission: Standardization + convenience — a reliable alternative to Templater formulas.

---

## 1. System Overview

```
                          ┌─────────────────────┐
                          │   Obsidian Vault     │
                          │  (Filesystem)        │
                          └──────────┬──────────┘
                                     │
                      ┌──────────────┼──────────────┐
                      ▼              ▼              ▼
               file-open         modify          rename
                      │              │              │
                      └──────┬───────┴──────┬───────┘
                             ▼              │
                      ┌──────────┐          │
                      │  main.ts │◄─────────┘
                      │ (Plugin) │
                      └────┬─────┘
                           │
               ┌───────────┼───────────┐
               ▼           ▼           ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Guard   │ │  Guard   │ │  Guard   │
        │bulkRunng │ │internalWr│ │dedup     │
        │+force    │ │(modify)  │ │(2s/1000) │
        └──────────┘ └──────────┘ └──────────┘
                           │
                           ▼
               ┌──────────────┐    ┌─────────────┐
               │  Filter      │    │ Scope       │
               │ PathFilter   │    │ (open only) │
               │ (ex/include) │    │ (newOnly)   │
               │ + Protected  │    └─────────────┘
               └──────────────┘        │ (force
                           │           │  skipped)
                           ▼           ▼
                    ┌──────────────────────┐
                    │   Builder            │
                    │  ┌──────────────────┐│
                    │  │force -> skip     ││
                    │  │ events check     ││
                    │  ├─condition?       │──> ConditionEvaluator (nested)
                    │  ├─template?        │──> TransformEngine (nested CI)
                    │  │  ({{lookup:…}})  │
                    │  ├─type? (select/   │──> optionsFile / optionsDataview
                    │  │  multi/boolean/  │
                    │  │  number/text)    │
                    │  └─ no tmpl         │──> switch(id)
                    └──────────┬──────────┘
                               │ update{}
                               ▼
                    ┌──────────────┐
                    │ Queue +      │
                    │ BatchFlusher │
                    │ (800ms deb)  │
                    └──────┬───────┘
                           │ drain()
                           ▼
                    ┌─────────────────────────┐
                    │   Writer                │
                    │  ├─ Protect             │ (do-not-touch)
                    │  ├─ Orphaned Cleanup    │ (deep delete via deleteNested)
                    │  ├─ Migration           │ (deep copy via getNested/setNested)
                    │  ├─ DateCreated         │ (force->overwrite, deep write)
                    │  ├─ NoteID              │ (UUID v4, Position 1, migration-safe)
                    │  ├─ Type-specific       │ (select options, boolean,
                    │  │  default injection   │  number, multi defaults, deep writes)
                     │  ├─ SelectUtils         │ (optionsFile resolution)
                    │  └─ Fields              │ (force->overwrite, deep writes via
                    │                         │  setNested/getNested/deleteNested/hasNested)
                    └──────┬─────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  YAML File   │
                    │  on Disk     │
                    └──────────────┘
```

### Data Flow (unidirectional)

```
Obsidian Event
  -> handleEvent()
     1. internalWrite?             -> skip (modify guard)
     2. bulkRunning?               -> skip (bulk update running)
     3. EventDeduplicator.isDuplicate? -> skip (< 2s, max 1000)
     4. PathFilter.isExcluded?     -> skip (folder filter)
     5. ScopeManager.shouldProcess?-> skip (open only, newOnly mode)
     6. MetadataUpdateBuilder.build()
          +- field.events check         (force -> skipped)
          +- ConditionEvaluator.evaluate() (nested via getNested)
          +- field.template -> TransformEngine.resolve() (nested CI)
          -    ({{title|upper}}, {{lookup:path,field}}, ...)
          +- field.type == select/multi -> optionsFile/Dataview laden
          +- no template  -> switch(id)
        -> Record<id, value>
     7. Queue.add() / Flusher.schedule(800ms)
       -> drain() -> MetadataWriter.write()
           -> protectedYamlKeys? (never delete/overwrite)
           -> orphanedYamlKeys?  (remove via deleteNested)
           -> pendingMigrations? (copy old key via getNested/setNested + delete)
           -> force?             (overwrite DateCreated too)
          -> type defaults?     (select/boolean/number/multi Defaults via setNested)
          -> processFrontMatter(file, fm => { ... })

Force-Apply (command):
  -> forceUpdateAll()
     -> no ScopeManager check
     -> Builder.build(force=true)       -> all fields, all events
     -> Writer.write(force=true)        -> DateCreated always overwritten
     -> protectedYamlKeys respected

Full Repair (command):
  -> fullRepair()
    -> forceUpdateAll()
    -> cleanupOrphanedKeys()
    -> checkConsistency()

Edit Select Fields (command):
  -> opens SelectFieldModal for the current file
    -> renders dropdowns (select) + checkboxes (multi)
    -> loads options from optionsFile / optionsDataview
    -> reads/writes nested values via getNested/setNested
    -> writes changes directly to the file

Standardize / Normalize values (command):
  -> opens StandardizeModal
    -> StandardizerService scans all files
    -> groups ValueIssues by field
    -> shows preview: "old value → new value (count)"
    -> Fix All Issues: bulk pass

Bulk rename YAML key (command):
  -> opens BulkRenameModal
    -> Old Key / New Key (also nested)
    -> Scan: counts occurrences
    -> Rename: deep rename via getNested/setNested/deleteNested
    -> Sync: update settings when a field has the same yamlKey
```

---

## 2. Module Architecture & Dependencies

```
+----------------------------------------------------------------------------------------------------+
|                          main.ts (~700 LOC)                                                         |
|  onload() -> registerEvents() + addCommand() (8 Commands)                                          |
|  handleEvent() -> Guard-Pipeline + Builder + Queue + Flush                                         |
|  bulkUpdateAll() -> BulkProgressModal + Write-Loop                                                 |
|  forceUpdateAll() -> BulkProgressModal + Write-Loop (force=true, no Scope)                       |
|  fullRepair() -> forceUpdateAll + cleanupOrphanedKeys + checkConsistency                           |
|  runFlush() -> Writer.write() mit protectedYamlKeys + type-specific logic                          |
|  saveSettings() -> diff yamlKey -> pendingMigrations; detect removed -> orphaned                   |
|  checkConsistency + removeCompletedMigrations / cleanupOrphanedKeys                                |
|  loadSettings() -> Migration: legacy fields, yamlGroups-Fallback                                   |
+------+------+------+------+------+------+------+------+------+------+------+------+------+-------+
       |      |      |      |      |      |      |      |      |      |      |      |      |
       v      v      v      v      v      v      v      v      v      v      v      v      v
   +-----+ +----+ +----+ +----+ +----+ +----+ +----+ +----+ +----+ +----+ +----+ +----+ +----+
   |sett.| | Ev.| |Upd.| |Bat.| |Bld.| |Wri.| |Pat.| |Sco.| |Trf.| |Con.| |Con.| |Dat.| |Std.|
   |50   | |13  | |45  | |32  | |150 | |220 | |31  | |22  | |270 | |110 | |70  | |54  | |200 |
   +--+--+ +----+ +----+ +----+ +--+-+ +--+-+ +----+ +----+ +--+-+ +----+ +----+ +----+ +----+
      |                          |      |                              |                 |
      v                          |      |                              v                 |
   +------+                      |      |                        +----------+            |
   |Meta. |<---------------------+      |                        |SelectUtils|            |
   |45 LOC|                             |                        |(50 LOC)   |            |
   +------+                             |                        +----------+            |
                                        |                        +----------+            |
                                    +--------+                   |IdUtils   |            |
                                    | Date   |                   |(8 LOC)   |            |
                                    | Utils   |                   +----------+            |
                                    | (7 LOC)|                   +----------+            |
                                    +--------+                   |NestedPath|            |
                                                                 |(80 LOC)  |            |
                                                                 +----------+            |
                                                   +-----------------------------+       |
                                                   |  SettingsTab (220)          |       |
                                                   |  +- FieldList (680)         |       |
                                                   |  +- FileSuggest (32)        |       |
                                                   |  +- FolderSuggest (38)      |       |
                                                   +-----------------------------+       |
                                                   +-----------------------------+       |
                                                   |  SelectFieldModal (140)     |       |
                                                   |  ConsistencyModal (49)     |       |
                                                   |  BulkProgressModal (42)     |       |
                                                   |  StandardizeModal (150)     |       |
                                                   |  BulkRenameModal (180)      |       |
                                                   +-----------------------------+       |
                                                                                        |
                                                                                        v
                                                                                   +----------+
                                                                                   |Standard. |
                                                                                   |Service   |
                                                                                   |(200 LOC) |
                                                                                   +----------+

Legend:
   LOC   = Lines of Code (Total: ~3.900 LOC in ~34 files) — estimate
   (NEW) = added in this release

   Module                 File                  LOC     Responsibility
   ─────────────────────────────────────────────────────────────────────
    main.ts                Plugin entry point     700     Lifecycle, 8 commands, guard pipeline, orchestration
    Settings               settings.ts             50     MetadataButlerSettings interface + defaults (+ yamlGroups, groupFile)
    SettingsTab            SettingsTab.ts         220     Settings UI layout
    FieldListComponent     FieldListComponent.ts  680     Drag-drop field editor with group dropdown, templates, events, conditions
    FileSuggestModal       FileSuggestModal.ts     32     File browser dialog
    FolderSuggestModal     FolderSuggestModal.ts   38     Folder browser dialog
    MetadataUpdateBuilder  services/              150     Builds update payload from events + field config
    MetadataWriter         services/              220     Writes updates to YAML frontmatter (deep writes)
    TransformEngine        services/              270     Resolves {{template}} expressions + pipe chains (nested CI)
    ConditionEvaluator     services/              110     Evaluates field conditions (nested-aware)
    ConsistencyChecker     services/               70     Scans vault for missing fields (nested-aware) + ValueIssues
    DataviewRunner         services/               54     Executes DataviewJS queries for dynamic options
    PathFilter             services/               31     Include/exclude folder filter
    ScopeManager           services/               22     newOnly/allFiles scope control
    EventDeduplicator      services/               27     2s dedup window, 1000 cap
    BatchFlusher           services/               32     800ms debounce drain
    UpdateQueue            services/               45     Per-file merge queue
    StandardizerService    services/              200     Value standardization / normalization vault-wide
    Events                 types/Events.ts         13     EventType + NormalizedEvent
    MetadataField          types/MetadataField.ts  45     FieldConfig + ConditionConfig + FieldType
    Queue                  types/Queue.ts           9     QueuedUpdate interface
    DateUtils              utils/DateUtils.ts       7     moment().format() helper
    IdUtils                utils/IdUtils.ts         8     UUID v4 generator
    SelectUtils            utils/SelectUtils.ts    50     Loads options from .md files
    NestedPath             utils/NestedPath.ts     80     4 pure deep-access functions (getNested, setNested, deleteNested, hasNested)
    SelectFieldModal       views/                 140     Modal for select/multi editing (nested-aware)
    ConsistencyModal       views/                  49     Consistency report modal
    BulkProgressModal      views/                  42     Bulk progress + cancel button
    StandardizeModal       views/                 150     Standardization preview + bulk fix
    BulkRenameModal        views/                 180     Bulk YAML key rename + settings sync
```

---

## 3. Event-Pipeline (Detailfluss)

```
Obsidian Event
    │
    ├── file-open (workspace.on("file-open"))
    ├── modify (vault.on("modify"))
    └── rename (vault.on("rename"))
         │
         ▼
    NormalizedEvent {
        type: EventType,       // "open" | "modify" | "rename" | "bulk"
        file: TFile,
        timestamp: number,
        source: string,
        oldPath?: string
    }
         │
         ▼
    ┌─── Guard 1: internalWrite? ─────────────────────────┐
    │   If event.type === "modify" AND internalWrite=true    │
    │   → SKIP (prevents re-trigger on own writes)           │
    └──────────────────────────────────────────────────────┘
         │
         ▼
    ┌─── Guard 2: bulkRunning? ────────────────────────────┐
    │   If bulk update running → SKIP                        │
    └──────────────────────────────────────────────────────┘
         │
         ▼
    ┌─── Guard 3: EventDeduplicator.isDuplicate() ─────────┐
    │   Key: "${file.path}:${event.type}"                  │
    │   Window: 2000ms, Max: 1000 entries (FIFO)            │
    │   Wenn Duplikat → SKIP                               │
    └──────────────────────────────────────────────────────┘
         │
         ▼
    ┌─── Guard 4: PathFilter.isExcluded() ─────────────────┐
    │   exclude mode: skip if path in excludedFolders       │
    │   include mode: skip if path NOT in included          │
    │   Case-insensitive, trailing-slash tolerant          │
    └──────────────────────────────────────────────────────┘
         │
         ▼
    ┌─── Guard 5: ScopeManager.shouldProcess() ────────────┐
    │   Only checked on event.type === "open"                │
    │   newOnly mode: skip if file already has DateCreated  │
    │   allFiles mode: always process                       │
    └──────────────────────────────────────────────────────┘
         │
         ▼
    ┌─── MetadataUpdateBuilder.build() ────────────────────┐
    │                                                       │
    │   For each enabled field (sorted by order):            │
    │                                                       │
    │   1. force? → skip field.events check                │
    │      (otherwise: skip if event.type not in field.events)
    │                                                       │
    │   2. ConditionEvaluator.evaluate()?                  │
    │      → skip if condition returns false                 │
    │      → getNested(fm, frontmatterKey) for nested        │
    │                                                       │
    │   3. type == select/multi? → Optionen laden:         │
    │      optionsFile (📁) > optionsDataview (📊) > options│
    │                                                       │
    │   4. field.template?                                 │
    │      → TransformEngine.resolve(template, ctx)        │
    │        ctx = { file, eventType, dateFormat,          │
    │                oldPath, oldFolder, oldName }          │
    │      ({{lookup:…}} via app.metadataCache)            │
    │      ({{frontmatter:KEY}} nested via findNestedCI)   │
    │      ({{lookup:path,field}} nested via findNestedCI) │
    │                                                       │
    │   5. no template?                                    │
    │      → resolveValue(id, eventType, file, ...)        │
    │        switch(id):                                   │
    │          noteId        → generateNoteId()            │
    │          dateCreated   → null (Writer setzt)         │
    │          fileName      → file.basename               │
    │          filePath      → file.path                   │
    │          noteType      → null (Writer setzt Default) │
    │          lastModified  → now(dateFormat)             │
    │          lastMoved     → now(dateFormat)             │
    │          source        → null                        │
    │          tags          → null                        │
    │          custom        → null                        │
    │                                                       │
    │   Returns: Record<fieldId, value> | null             │
    └──────────────────────────────────────────────────────┘
         │
         ▼
    ┌─── Queue.add(file, update) ──────────────────────────┐
    │   Merge-Semantik: pro file.path gewinnt letztes Update│
    └──────────────────────────────────────────────────────┘
         │
         ▼
    ┌─── BatchFlusher.schedule(800ms) ─────────────────────┐
    │   Debounce: timer reset on each new event              │
    │   On Fire: runFlush() → queue drain → write each       │
    │   isFlushing lock prevents parallel flushes             │
    │   Follow-up: 100ms if new items arrive during flush    │
    └──────────────────────────────────────────────────────┘
         │
         ▼
    ┌─── MetadataWriter.write() ───────────────────────────┐
    │   processFrontMatter(file, fm => {                   │
    │                                                       │
    │   1. Orphaned Cleanup:                                │
    │      for key in orphanedYamlKeys:                     │
    │        if not protected: deleteNested(fm, key)        │
    │                                                       │
    │   2. Migration:                                       │
    │      for m in pendingMigrations:                      │
    │        if getNested(fm, m.oldKey) exists              │
    │          AND !hasNested(fm, field.yamlKey)            │
    │          AND oldKey not protected:                    │
    │          setNested(fm, field.yamlKey, oldVal)         │
    │          deleteNested(fm, m.oldKey)                   │
    │                                                       │
    │   3. NoteID (migration-safe):                         │
    │      if field.enabled AND !NoteID present:            │
    │        First check pendingMigrations:                 │
    │        If old key exists → migrate                    │
    │        Otherwise: generateNoteId() + setNested()      │
    │                                                       │
    │   4. DateCreated:                                     │
    │      if enabled AND (!hasNested(fm, key) OR force):   │
    │        setNested(fm, dcField.yamlKey, now(df))        │
    │                                                       │
    │  5. Fields (sorted by order):                         │
    │      for field in enabled fields:                     │
    │        if protectedYamlKeys.has(field.yamlKey):       │
    │        skip (even with force)                         │
    │        if update[field.id] exists:                    │
    │          setNested(fm, field.yamlKey, update[fieldId])│
    │        elif field.type:                               │
    │          select: setNested(fm, key, val ?? default ?? options[0])
    │          boolean: setNested(fm, key, val ?? bool(dv))
    │          number:  setNested(fm, key, val ?? Number(dv))
    │          multi:   setNested(fm, key, val ?? split(dv))
    │          text:    setNested(fm, key, val ?? defaultValue)
    │   })                                                  │
    └──────────────────────────────────────────────────────┘
```

---

## 4. Settings & Data Model

### MetadataButlerSettings (settings/settings.ts)

```typescript
interface MetadataButlerSettings {
    dateFormat: string;                    // Moment.js-Format, Default: "YYYY-MM-DD ddd HH:mm:ss"
    fields: MetadataFieldConfig[];         // 9 defaults + unlimited custom
    excludedFolders: string[];             // Excluded folders (exclude mode)
    includedFolders: string[];             // Included folders (include mode)
    filterMode: FilterMode;                // "exclude" | "include"
    processingMode: ProcessingMode;        // "newOnly" | "allFiles"
    pendingMigrations?: PendingMigration[]; // Persistent YAML key migrations
    orphanedYamlKeys?: string[];           // Keys from deleted fields
    protectedYamlKeys?: string[];          // Do-not-touch list
    yamlGroups?: string[];                 // YAML groups (e.g. ["note", "dates", "special"])
    groupFile?: string;                    // Optional path to .md with groups list
}
```

### MetadataFieldConfig (types/MetadataField.ts)

```typescript
interface MetadataFieldConfig {
    id: string;                    // Interner Identifier (z. B. "fileName", "noteType")
    yamlKey: string;               // YAML-Output-Key (z. B. "FileName", "note.NoteID")
    type?: FieldType;              // "text" | "select" | "boolean" | "number" | "multi"
    options?: string[];            // Manuelle Options-Liste (select/multi)
    optionsFile?: string;          // Path to .md file with options
    optionsDataview?: string;      // DataviewJS query for dynamic options
    enabled: boolean;              // On/off switch
    order: number;                 // Display/write order (Drag-Drop)
    defaultValue?: string;         // Fallback value
    template?: string;             // {{expression}} with optional pipe chains
    events?: EventType[];          // ["open", "modify", "rename", "bulk"]
    isCustom?: boolean;            // User-created vs. built-in
    condition?: ConditionConfig;   // Conditional application rule
    // group is NOT stored separately — derived from yamlKey prefix
}
```

### ConditionConfig (types/MetadataField.ts)

```typescript
interface ConditionConfig {
    type: ConditionType;           // "always" | "frontmatter" | "path" | "filename" | "folder"
    frontmatterKey?: string;       // For frontmatter type (also nested: "note.NoteType")
    operator?: ConditionOperator;  // "exists" | "equals" | "matches" | "contains"
    value?: string;                // Vergleichswert
}
```

### PendingMigration (settings/settings.ts)

```typescript
interface PendingMigration {
    fieldId: string;               // Which field was changed
    oldKey: string;                // Previous yamlKey (flat or nested, e.g. "NoteID" or "note.NoteID")
}
```

### Default Fields

| id | yamlKey | enabled | order | type | group | options | events |
|---|---|---|---|---|---|---|---|
| noteId | NoteID | true | -1 | — | note | — | open, rename, bulk |
| fileName | FileName | true | 0 | — | note | — | open, rename, bulk |
| filePath | FilePath | true | 1 | — | note | — | open, rename, bulk |
| dateCreated | DateCreated | true | 2 | — | dates | — | open, rename, bulk |
| noteType | NoteType | true | 2.5 | select | — | Project, Note, Task, Person, Meeting, Reference | open, rename, bulk |
| lastModified | LastModified | true | 3 | — | dates | — | modify, rename, bulk |
| lastMoved | LastMoved | true | 4 | — | dates | — | rename |
| source | Source | false | 5 | — | — | — | open, rename, bulk |
| tags | Tags | false | 6 | — | — | — | modify, bulk |

**Default YAML-Groups:**
```typescript
yamlGroups: ["note", "dates", "special"]
```

**GROUP_LOCKED_FIELDS** (Tags bleiben flach):
```typescript
const GROUP_LOCKED_FIELDS = new Set(["tags"]);
```

### Persistence

- Settings via `Plugin.loadData() / saveData()` → `data.json`
- `data.json` in `.obsidian/plugins/md-butler/`
- Migrations, orphaned keys, protected keys persistent
- **yamlGroups** persistent (default fallback in `loadSettings()`)
- **No** persistence of templates, lookup cache, or dependency graphs

---

## 5. Template-Engine (TransformEngine ~270 LOC)

### Architecture Notes

```
{{expression | pipe1 | pipe2}}
         │
         ▼
  ┌──────────────┐
  │  Resolve     │
  │  Expression  │
  └──────┬───────┘
         │ string | null
         ▼
  ┌──────────────┐
  │  Apply Pipe  │
  │  Chain       │
  └──────┬───────┘
         │ string | null
         ▼
      result
```

### Supported Expressions (nested frontmatter/lookup)

| Expression | Example | Result |
|----------|----------|----------|
| `{{date:FORMAT}}` | `{{date:YYYY-MM-DD}}` | `2026-07-02` |
| `{{now+Nd}}` | `{{now+7d}}` | `2026-07-09` |
| `{{now-Nd}}` | `{{now-1w}}` | `2026-06-25` |
| `{{title}}` | — | File name without extension |
| `{{fileName}}` | — | File name with extension |
| `{{fileFolder}}` | — | Parent folder path |
| `{{filePath}}` | — | Vault-relativer Pfad |
| `{{oldPath}}` | — | Vorheriger Pfad (rename only) |
| `{{oldFolder}}` | — | Previous folder (rename only) |
| `{{oldName}}` | — | Previous name (rename only) |
| `{{frontmatter:key}}` | `{{frontmatter:note.NoteID}}` | Value of any frontmatter key (also nested) |
| `{{lookup:PATH,FIELD}}` | `{{lookup:Person/Anton.md,note.NoteID}}` | Value from another file (also nested) |

### Key Innovation: findNestedCI

For nested keys `findNestedCI()` is used — segment-wise case-insensitive matching:

```typescript
function findNestedCI(obj: any, path: string): any {
    const segments = path.split(".");
    let current = obj;
    for (const seg of segments) {
        const lower = seg.toLowerCase();
        const found = Object.entries(current)
            .find(([k]) => k.toLowerCase() === lower);
        if (!found) return undefined;
        current = found[1];
    }
    return current;
}
```

### Lookup mechanism (nested-capable)

```
{{lookup:Person/Anton.md,note.NoteID}}
         │
         ▼
  ┌─────────────────────────────────────┐
  │  1. Resolve path:                    │
  │     absolute (/root)                 │
  │     relative (../Sibling.md)         │
  │     relative to file's parent folder │
  ├─────────────────────────────────────┤
  │  2. Load file via metadataCache      │
  ├─────────────────────────────────────┤
  │  3. Search frontmatter for field:    │
    │     exact via getNested(fm, key)  │
    │     then fallback findNestedCI(fm, key)
  ├─────────────────────────────────────┤
  │  4. Cache result (per cycle)         │
  ├─────────────────────────────────────┤
  │  5. Max 3 levels deep                │
  │     (Lookup in Lookup)              │
  └─────────────────────────────────────┘
```

---

## 6. Commands & UI

### Registered commands in main.ts

| Command ID | Name (as in menu) | Implementation | Scope |
|-----------|--------------------|---------------|-------|
| `md-butler:apply-all` | Apply Metadata to all Notes | `bulkUpdateAll()` | Respects Filter + Scope |
| `md-butler:force-apply` | Force-apply metadata to all notes (overwrite all) | `forceUpdateAll()` | Respects Filter, ignores Scope |
| `md-butler:full-repair` | Full repair: force-apply → cleanup → consistency check | `fullRepair()` | Chain of all operations |
| `md-butler:check-consistency` | Vault Consistency Check | `checkConsistency()` | Respects Filter |
| `md-butler:cleanup-keys` | Clean up old YAML keys | `cleanupOrphanedKeys()` | Respects Filter + Protected Keys |
| `md-butler:edit-select-fields` | Edit select fields in current note | opens `SelectFieldModal` | Current file only |
| `md-butler:standardize-values` | Standardize / Normalize values | opens `StandardizeModal` | Vault-wide |
| `md-butler:bulk-rename-key` | Bulk rename YAML key | opens `BulkRenameModal` | Vault-wide |

### Standardizer Flow

```
standardizeValues()
    │
    ├── Get all markdown files from vault
    ├── StandardizerService.scan():
    │   For each file:
    │   ├── Versions frontmatter cache
    │   ├── For each enabled select/multi/boolean/number field:
    │   │   ├── getNested(fm, field.yamlKey) → raw
    │   │   ├── If raw NOT in options[] (select/multi) or
    │   │   │   raw not parseable (boolean/number):
    │   │   │   → ValueIssue: { file, fieldId, yamlKey, oldValue, newValue }
    │   └── collect issues
    ├── If no issues → Notice("No value issues found.")
    ├── Otherwise → open StandardizeModal with grouped issues
    │
    └── Fix All Issues → Bulk-Loop:
        For each file with issues:
        ├── processFrontMatter(file, fm => {
        │   for issue of fileIssues:
        │     setNested(fm, issue.yamlKey, issue.newValue)
        │ })
        └── count++
```

### BulkRename Flow

```
bulkRenameKey()
    │
    ├── Open BulkRenameModal
    │   ├── User enters oldKey + newKey
    │   ├── Scan: counts occurrences of oldKey via getNested
    │   ├── If protectedYamlKeys.contains(oldKey) → Warning + abort
    │   ├── If oldKey === newKey → "No change."
    │   ├── Click "Rename"
    │
    └── Bulk loop:
        For each file:
        ├── processFrontMatter(file, fm => {
        │   if hasNested(fm, oldKey):
        │     setNested(fm, newKey, getNested(fm, oldKey))
        │     deleteNested(fm, oldKey)
        │ })
        └── count++
        │
        └── Settings sync:
            For each enabled field:
            If field.yamlKey === oldKey:
              field.yamlKey = newKey
              pendingMigrations.push({ fieldId: field.id, oldKey })
              saveSettings()
```

### Settings UI Tab (YAML-Groups)

```
SettingsTab (MetadataButlerSettingTab)
    │
    ├── Date Format              → TextInput (moment.js-Pattern)
    ├── Processing Mode          → Dropdown: newOnly / allFiles
    ├── YAML-Groups              → TextArea + 📁 File (import from .md)
    │   │                           (Default: note, dates, special)
    │   ├── Group import reads groups: from frontmatter or plain text
    │   └── Tags exception: GROUP_LOCKED_FIELDS
    ├── Metadata Fields          → FieldListComponent (Drag-Drop)
    │   ├── Drag-Handle          → ☰
    │   ├── Field ID             → built-in: label | custom: editable
    │   ├── YAML Key             → TextInput
    │   ├── Group                → Dropdown (note / dates / special / ...)
    │   │                           (none) = flat key
    │   │                           Tags: (none) locked
    │   ├── Type                 → Dropdown: text / select / boolean / number / multi
    │   ├── Options (select/multi) → TextArea + 📁 File + 📊 Dataview
    │   ├── Default Value        → TextInput
    │   ├── Template             → TextInput + Live-Preview + 📁 File-Selector
    │   ├── Events               → 4 checkboxes (open, modify, rename, bulk)
    │   ├── Condition            → +/-/⚙ Button → inline Type/Operator/Value editor
    │   ├── Toggle               → enable/disable field
    │   └── Delete               → ✕ (custom fields only)
    │
    ├── Folder Filter Mode       → Dropdown: exclude / include
    ├── Excluded Folders         → TextArea + 📁 Browse
    ├── Included Folders         → TextArea + 📁 Browse
    └── Protected YAML Keys      → TextArea (ein Key pro Zeile)
```

### Modals (5)

| Modal | File | LOC | Purpose |
|-------|-------|-----|-------|
| `SelectFieldModal` | views/ | 140 | Edit select/multi fields in the current note (nested) |
| `BulkProgressModal` | views/ | 42 | Progress display + cancel for bulk operations |
| `ConsistencyModal` | views/ | 49 | Results of vault consistency check (green/red/orange) |
| `StandardizeModal` | views/ | 150 | Preview + bulk fix of value standardization |
| `BulkRenameModal` | views/ | 180 | YAML key rename across all files + settings sync |

---

## 7. Important Design Decisions

### 7.1 Event deduplication (unchanged)

### 7.2 Batch writing (unchanged)

### 7.3 YAML key migration (persistent, now deep)

- `saveSettings()` detects yamlKey diffs → stores `PendingMigration` in `data.json`
- **Writer:** Copies via `getNested(fm, oldKey)` / `setNested(fm, newKey, val)` — works for flat and nested keys
- **Cleanup:** `removeCompletedMigrations()` scans vault via `getNested(fm, m.oldKey)`
- **noteId safety:** Before `generateNoteId()` checks `pendingMigrations` for old NoteID key

### 7.4 Do-not-touch list (unchanged)

### 7.5 Conditional fields (ConditionEvaluator)

- Conditions support nested keys via `getNested(fm, frontmatterKey)` → `"note.NoteType"` is correctly resolved

### 7.6 Per-field types (FieldType) (unchanged)

### 7.7 Force-Apply vs. Normal Apply (unchanged)

### 7.8 Nested YAML via Dot-Notation

- **Decision:** Dots in yamlKey = nesting level. No escape mechanism.
- **Implementation:** 4 pure functions in `NestedPath.ts` – `getNested`, `setNested`, `deleteNested`, `hasNested`
- **Rollout:** All `fm[key]` accesses in Writer, Builder, Services and Modals replaced
- **Group dropdown:** Per field a dropdown that sets the prefix. `(none)` = flat.
- **Tags exception:** `GROUP_LOCKED_FIELDS = new Set(["tags"])` – `tags` stays flat
- **Migration:** flat→nested and nested→flat via same `pendingMigrations` system
- **noteId:** Stable on group change (check before `generateNoteId()`)

### 7.9 Standardizer / Value Normalization

- **Decision:** No mapping tables — standardization based on `options[]` (select/multi) and type checking (boolean/number)
- **Preview:** StandardizeModal shows grouped preview before execution
- **No rollback:** After "Fix All Issues" changes are permanent
- **Bulk key rename:** Extends `pendingMigrations` — rename is synced to Settings

### 7.10 YAML Groups Configuration

- **Two sources:** `yamlGroups: string[]` in `data.json` (persistent) + optional `groupFile` import
- **Import:** 📁 button reads `groups:` array from frontmatter or plain text (one line per value)
- **Fallback:** In `loadSettings()`: if `yamlGroups` empty → `DEFAULT_SETTINGS.yamlGroups`
- **No separate UI for Field Groups:** Per-field group dropdown replaces the originally planned standalone feature

---

## 8. Error Handling Strategy (extended)

| Layer | Strategy |
|-------|-----------|
| Per-file write | try/catch around `processFrontMatter`; error logged, processing continues |
| Bulk operation | try/catch per file; counter continues; final notice with count |
| RegEx evaluation | try/catch in ConditionEvaluator.matchValue(); invalid RegExp → false |
| Template resolution | Pipe error → null → field is skipped |
| Settings save | try/catch in onChange handlers; no error propagation to UI |
| **Nested access** | **NestedPath functions are type-safe — `setNested` creates missing intermediate objects** |
| **Migration legacy issues** | **`removeCompletedMigrations()` uses `getNested` instead of flat access** |

### Error Sources (extended)

```
Write failures:
  - processFrontMatter throws exception (corrupt file, access denied)
  - File deleted mid-bulk (TFile becomes stale)

Template failures:
  - Invalid regex in condition
  - Missing frontmatter key → null → default or skip
  - Pipe function receives unexpected input

Nested failures:
  - Intermediate object missing → setNested creates it automatically
  - Partial object is scalar → overwrite (no error, but data loss)

Settings failures:
  - data.json corruption
  - Disk full / Permission denied
```

---

## 9. Build & Deployment

### Build pipeline (unchanged)

```
npm run build
    ├── tsc -noEmit -skipLibCheck   (Type-Checking)
    └── node esbuild.config.mjs production  (Bundling)

esbuild config:
    ├── entry: src/main.ts
    ├── outfile: main.js
    ├── format: cjs
    ├── target: es2021
    ├── external: obsidian, electron, @codemirror/*, @lezer/*
    ├── sourcemap: false (production)
    ├── minify: true (production)
    └── treeShaking: true
```

### Release Artifacts (required)

| File | Required | Description |
|-------|----------|-------------|
| `main.js` | Yes | Bundled plugin code (~59KB) |
| `manifest.json` | Yes | Plugin metadata |
| `styles.css` | No | UI styling |

### Project Structure

```
md-butler/
    ├── src/
    │   ├── main.ts                   # ~700 LOC
    │   ├── types/
    │   │   ├── Events.ts
    │   │   ├── MetadataField.ts
    │   │   └── Queue.ts
    │   ├── services/
    │   │   ├── EventDeduplicator.ts
    │   │   ├── UpdateQueue.ts
    │   │   ├── BatchFlusher.ts
    │   │   ├── MetadataUpdateBuilder.ts
    │   │   ├── MetadataWriter.ts
    │   │   ├── TransformEngine.ts
    │   │   ├── DataviewRunner.ts
    │   │   ├── ConditionEvaluator.ts
    │   │   ├── PathFilter.ts
    │   │   ├── ScopeManager.ts
    │   │   ├── ConsistencyChecker.ts
    │       │   └── StandardizerService.ts
    │   ├── views/
    │   │   ├── SelectFieldModal.ts
    │   │   ├── ConsistencyModal.ts
    │   │   ├── BulkProgressModal.ts
    │   │   ├── StandardizeModal.ts
    │   │   └── BulkRenameModal.ts
    │   ├── settings/
    │   │   ├── settings.ts
    │   │   ├── SettingsTab.ts
    │   │   ├── FieldListComponent.ts
    │   │   ├── FolderSuggestModal.ts
    │   │   └── FileSuggestModal.ts
    │   └── utils/
    │       ├── DateUtils.ts
    │       ├── IdUtils.ts
    │       ├── SelectUtils.ts
    │       └── NestedPath.ts
    ├── main.js
    ├── manifest.json
    ├── styles.css
    ├── package.json
    ├── tsconfig.json
    ├── esbuild.config.mjs
    ├── version-bump.mjs
    ├── versions.json
    ├── eslint.config.mts
    ├── .editorconfig
    ├── .gitignore
    ├── .npmrc
    ├── CHANGELOG.md
    ├── README.md
    ├── LICENSE
    └── AGENTS.md
```

### Community Plugin Checklist (unchanged)

- [x] Valides `manifest.json` mit id, name, version, minAppVersion
- [x] `main.js` < 100KB (approx. 35KB estimated)
- [x] No external network calls
- [x] No obfuscated code
- [x] `isDesktopOnly: false` (mobil-kompatibel)
- [x] Beschreibendes README.md
- [x] MIT-Lizenz
- [x] Changelog
- [x] No malicious code patterns
- [x] Only Obsidian Core API (no extra dependencies)

---

## 10. Version History

| Version | Date | Changes |
|---------|-------|-----------|
| 0.4–0.6 | — | Initial refactoring, services, filter, scope, dedup |
| 0.7.0 | — | Transform Engine ({{template}}) |
| 0.8.0 | — | Per-field event binding |
| 0.10.0 | — | Renamed to Metadata Butler |
| 0.10.1 | — | Consistency Check + Modal |
| 0.10.2 | — | Migration + BulkProgressModal |
| 0.11.0 | — | Template pipe chains ({{x \| upper}}) |
| 0.12.0 | — | Persistent migration + Orphaned Cleanup |
| 0.13.0 | — | Conditional Fields + ConditionEvaluator |
| 0.13.1 | — | Auto-Cleanup + FileSuggestModal |
| 0.14.0 | — | Force-Apply + Do-Not-Touch + Full Repair |
| **1.0.0** | **2026-07-07** | **Nested YAML Groups, Standardizer, BulkRename, yamlGroups, Deep Writes — Initial public release** |

### Key Changes

| Category | Change |
|----------|--------|
| **New files** | NestedPath.ts, StandardizerService.ts, StandardizeModal.ts, BulkRenameModal.ts (+4) |
| **New concepts** | Nested YAML (dot-notation), YAML Groups (group dropdown), value standardization, bulk key rename |
| **New settings** | `yamlGroups`, `groupFile` |
| **New commands** | "Standardize / Normalize values", "Bulk rename YAML key" |
| **Changed services** | Writer (deep writes), ConsistencyChecker (deep), ConditionEvaluator (deep), TransformEngine (findNestedCI) |
| **Changed modals** | SelectFieldModal (deep), BulkRenameModal + Settings-Sync |

### Migration Notes

- Legacy fields without `type` are set to `"text"` in `loadSettings()`
- `yamlGroups` is automatically filled with defaults if empty
- `GROUP_LOCKED_FIELDS = new Set(["tags"])` — tags always stay flat
- `pendingMigrations` works unchanged — also for nested keys
- No data migration required — all existing settings are preserved

---

## 11. Statistical Overview

| Metric | Value |
|--------|-------|
| **Total LOC** | ~3.900 |
| **TypeScript files** | ~34 |
| **Services** | 12 |
| **Views/Modals** | 5 |
| **Utils** | 4 |
| **Settings files** | 5 |
| **Commands** | 8 |
| **Built-in fields** | 9 |
| **Field types** | 5 |
| **Option sources** | 3 |
| **Condition types** | 5 |
| **Condition operators** | 4 |
| **Template expressions** | 12 (nested-aware) |
| **YAML groups** | 3 default + unlimited custom |

---

*Status: 2026-07-07*
*Plugin version: 1.0.0*
*Total codebase: ~3.900 LOC in ~34 TypeScript files (estimate)*
