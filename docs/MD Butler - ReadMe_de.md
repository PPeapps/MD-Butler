# MD Butler — ReadMe

**Version:** 1.0.0
**Plugin-ID:** `md-butler`
**Autor:** PPeter
**Min. Obsidian-Version:** 1.8.0

---

## Übersicht

MD Butler ist ein Obsidian-Plugin, das automatisch YAML-Frontmatter-Felder in allen Notizen verwaltet.
Es reagiert auf Events (Öffnen, Bearbeiten, Verschieben) und schreibt Metadaten nach konfigurierbaren Regeln.

Anders als Templater-Formeln (`<%* %>`) arbeitet MD Butler vollständig asynchron und ereignisgesteuert –
ohne manuelles Auslösen, ohne Formel-Bloat in den Dateien.

---

## Kern-Features

| Feature | Beschreibung |
|---------|-------------|
| **5 Feldtypen** | `text`, `select`, `boolean`, `number`, `multi` |
| **Event-gesteuert** | Reagiert auf `open`, `modify`, `rename` – pro Feld konfigurierbar |
| **Template-Engine** | `{{title}}`, `{{filePath}}`, `{{date:…}}`, `{{lookup:…}}`, `{{frontmatter:…}}` u.v.m. |
| **Lookup über Dateien** | Liest Frontmatter-Werte aus beliebigen Notizen aus (`{{lookup:pfad,feld}}`) |
| **Pipe-Chain** | Werte transformieren: `{{lookup:…,noteType\|lower\|trim}}` |
| **Dataview-Integration** | Optionen per DataviewJS-Abfrage generieren (`dv.pages()...`) |
| **Options-Quellen** | Drei Quellen für Select/Multi: manuelle Liste, .md-Datei (📁), DataviewJS (📊) |
| **SelectFieldModal** | `Strg+P → "Edit select fields"` – bequeme Auswahl in der aktuellen Note |
| **Bedingte Felder** | Felder nur setzen wenn Bedingung erfüllt (z. B. `frontmatter:status equals aktiv`) |
| **YAML-Key-Migration** | Automatisch beim Umbenennen eines YAML-Keys in den Einstellungen |
| **Orphaned-Key-Cleanup** | Alte, nicht mehr verwendete YAML-Keys werden bereinigt |
| **Do-Not-Touch-Liste** | Geschützte YAML-Keys (`cssclass`, `aliases`, …) werden nie überschrieben |
| **NoteID** | UUID v4 wird automatisch vergeben (NoteID an Position 1) |
| **Verarbeitungsmodi** | `newOnly` (nur neue Notizen) oder `allFiles` |
| **Ordner-Filter** | Inklusive/Exklusive-Ordner mit rekursiver Prüfung |
| **Force-Apply** | Überschreibt ALLE Metadaten (auch bestehende) |
| **Consistency-Check** | Scannt das gesamte Vault auf fehlende Frontmatter-Felder **und inkonsistente Werte** (Value Issues, z. B. Select-Werte außerhalb der Options-Liste) |
| **Vollreparatur** | Force-Apply → Cleanup → Consistency-Check in einem Befehl |
| **Nested YAML Groups** | `yamlKey: "note.NoteID"` schreibt `note:\n  NoteID: …` – hierarchisches Frontmatter via Punktnotation |
| **YAML-Groups-Konfiguration** | Group-Dropdown pro Feld + Import aus .md-Datei (📁) |
| **Standardizer** | Scan (via ConsistencyChecker) → Vorschau (StandardizeModal mit Pro-Issue-Dropdown) → Bulk-Bereinigung von Select/Multi-Werten |
| **Bulk YAML Key Rename** | YAML-Keys über alle Dateien umbenennen inkl. Migration-Tracking und Settings-Sync |
| **StandardizeModal** | Vorschau mit Pro-Issue-Auswahl (Skip/Ersetzen) + Duplikat-Warnung vor dem Anwenden |

---

## Feldtypen im Detail

### `text`
Standard-Textfeld. Kann per Template befüllt werden oder einen Default-Wert haben.

### `select`
Dropdown-Feld mit vordefinierten Optionen.
- **Optionen-Quellen** (Priorität): `optionsFile` (📁) > `optionsDataview` (📊) > `options` (manuelle Liste)
- Der **Builder überspringt Select/Multi** – die Werte kommen vom Writer (schützt Benutzerauswahl)
- **Ausnahme**: `{{lookup:…}}`-Templates werden immer aufgelöst
- SelectFieldModal (`Strg+P`) erlaubt manuelle Auswahl

### `boolean`
`true`/`false`-Feld. Template wird als String `"true"` oder `"false"` konvertiert.

### `number`
Numerisches Feld. Template-Wert wird via `Number()` konvertiert; `NaN` wird ignoriert.

### `multi`
Array-Feld mit Checkboxen (SelectFieldModal).
- Komma-getrennte Liste im Template: `"A, B, C"` → `["A", "B", "C"]`
- Dataview-Optionen werden durchgereicht

---

## Template-Engine

### Eingebaute Ausdrücke

| Ausdruck | Beschreibung |
|----------|-------------|
| `{{title}}` | Dateiname ohne Erweiterung |
| `{{fileName}}` | Dateiname mit Erweiterung |
| `{{filePath}}` | Vollständiger Pfad relativ zum Vault |
| `{{fileFolder}}` | Ordner der Datei |
| `{{oldPath}}` | Alter Pfad (nur bei rename) |
| `{{oldFolder}}` | Alter Ordner (nur bei rename) |
| `{{oldName}}` | Alter Dateiname (nur bei rename) |
| `{{date:FORMAT}}` | Aktuelles Datum in moment.js-Format |
| `{{now+7d}}` | Relatives Datum (+7d, -3d, +1w, -2m, +1y) |
| `{{frontmatter:KEY}}` | Wert eines beliebigen Frontmatter-Keys der aktuellen Datei (unterstützt nested: `frontmatter:note.NoteID`) |
| `{{lookup:PFAD,FELD}}` | Wert eines Frontmatter-Keys aus einer anderen Datei (unterstützt nested Felder) |

### Lookup-Syntax

```
{{lookup:Pfad/zur/Datei.md,Feldname}}
{{lookup:Pfad/zur/Datei.md,Feldname | pipe1 | pipe2}}
```

- **Pfadauflösung**: absolut (`/Ordner/Datei.md`), relativ (`../Ordner/Datei.md`), bezogen zum aktuellen Dateiordner
- **Cache**: Lookups werden pro Resolve-Durchlauf gecached
- **Maximale Tiefe**: 3 Ebenen (Lookup in Lookup)
- **Case-Insensitive**: Feldnamen werden zuerst exakt, dann lowercase-verglichen

### Pipe-Chain

| Pipe | Beispiel | Beschreibung |
|------|----------|-------------|
| `upper` | `{{title\|upper}}` | In Großbuchstaben |
| `lower` | `{{title\|lower}}` | In Kleinbuchstaben |
| `trim` | `{{title\|trim}}` | Whitespace entfernen |
| `replace:a,b` | `{{title\|replace: ,_}}` | Ersetzen |
| `substr:0,5` | `{{title\|substr:0,5}}` | Teilstring |
| `default:text` | `{{lookup:…\|default:Unbekannt}}` | Fallback-Wert |
| `date:FORMAT` | `{{…\|date:DD.MM.YYYY}}` | Datum formatieren (moment.js) |

### Beispiele

```
{{date:DD.MM.YYYY}}

Hallo {{title}}

{{lookup:/XTRAS/Lookups/Status.md,Status | lower | default:unbekannt}}

{{frontmatter:NoteType}}

{{now+7d}}
```

---

## Einstellungen

### Datum & Verarbeitung

| Einstellung | Beschreibung |
|-------------|-------------|
| **Date Format** | Moment.js-Format für alle Datums-Werte |
| **Processing Mode** | `newOnly` – nur Notizen OHNE `DateCreated`; `allFiles` – alle Notizen |

### Metadaten-Felder

Jedes Feld hat:
- **Interne ID** (fest bei Built-in, editierbar bei Custom)
- **YAML Key** – der tatsächliche Key in der Frontmatter (unterstützt Punktnotation für Verschachtelung)
- **Typ** – text/select/boolean/number/multi
- **Events** – Checkboxen für open/modify/rename/bulk
  - `noteId` und `dateCreated` haben **fixe Events**: nur `open`
  - `lastModified` hat `modify` **deaktiviert** – wird automatisch vom Plugin gesetzt
- **Template** – Ausdruck (siehe Template-Engine)
- **Default Value** – Fallback wenn kein Template gesetzt (bei `boolean`: Dropdown none/true/false)
- **Condition** – Bedingung (siehe unten)
- **Enable-Toggle** – Ein/Aus
- **Drag-Handle** ☰ – Reihenfolge ändern
- **Group-Dropdown** – Feld einer YAML-Gruppe zuordnen (z.B. `note`, `dates`, `special`) – Prefix für yamlKey

Bei **select** und **multi** zusätzlich:
- Optionen-Textfeld (eine pro Zeile)
- 📁-Button – Optionen aus .md-Datei laden
- 📊-Button – DataviewJS-Editor + ▶ Ausführen

### YAML-Groups

Konfiguriert im Settings-Header (Textfeld + 📁-Import):
- **Default-Gruppen**: `note`, `dates`, `special`
- **Per-Feld Group-Dropdown**: wählt Gruppen-Prefix für den yamlKey
- **Group-Datei-Import** (📁): liest YAML-Frontmatter `groups:`-Array oder Plain-Text-Liste (ein Wert pro Zeile)
- **Tags-Ausnahme**: `tags`-Feld ist auf `(none)` gesperrt – `tags:` bleibt flach für Obsidian-Kompatibilität

### Bedingungen (Conditions)

| Typ | Operator | Beschreibung |
|-----|----------|-------------|
| `always` | – | Wird immer ausgeführt |
| `frontmatter` | `exists` | Prüft ob ein Frontmatter-Key existiert (unterstützt nested) |
| `frontmatter` | `equals` | Key == Wert (unterstützt nested) |
| `frontmatter` | `contains` | Key enthält Wert (unterstützt nested) |
| `frontmatter` | `matches` | Key matched Regex (unterstützt nested) |
| `path` | equals/contains/matches | Pfad der Datei |
| `filename` | equals/contains/matches | Dateiname |
| `folder` | equals/contains/matches | Ordner der Datei |

### Ordner-Filter

| Modus | Verhalten |
|-------|-----------|
| **Exclude** | Dateien in den gelisteten Ordnern werden ignoriert |
| **Include** | NUR Dateien in den gelisteten Ordnern werden verarbeitet |

### Do-Not-Touch (Protected YAML Keys)

YAML-Keys, die NIEMALS vom Plugin überschrieben oder gelöscht werden.
Praktisch für Keys anderer Plugins: `cssclass`, `aliases`, `id`, `tags` usw.

---

## Befehle (Command Palette)

| Befehl | Beschreibung |
|--------|-------------|
| **Apply Metadata to all Notes** | Nur neue Notizen (processingMode) |
| **Force-apply metadata to all notes (overwrite all)** | Überschreibt alle Werte |
| **Vault Consistency Check** | Scan auf fehlende Felder |
| **Clean up old YAML keys** | Entfernt verwaiste Keys |
| **Edit select fields in current note** | Öffnet SelectFieldModal |
| **Full repair: force-apply → cleanup → consistency check** | Force → Cleanup → Check |
| **Standardize / Normalize values** | Öffnet StandardizeModal mit Wert-Report und Fixes |
| **Bulk rename YAML key** | YAML-Key über alle Vault-Dateien umbenennen |

---

## Architektur (für Entwickler)

```
Event (open/modify/rename)
  → EventDeduplicator (2s-Fenster)
    → PathFilter (Exclude/Include)
      → ScopeManager (newOnly/allFiles)
        → MetadataUpdateBuilder (Template-Resolve)
          → UpdateQueue (Merge)
            → BatchFlusher (500ms Debounce)
              → MetadataWriter (Frontmatter-Schreiben)
```

### Services

| Service | Aufgabe |
|---------|---------|
| `EventDeduplicator` | Verhindert Doppel-Events innerhalb 2s |
| `UpdateQueue` | Merge-Queue: nur neuestes Update pro Datei |
| `BatchFlusher` | 500ms Debounce vor dem Schreiben |
| `MetadataUpdateBuilder` | Baut Update-Payload (führt Templates aus) |
| `MetadataWriter` | Schreibt via `processFrontMatter` (Deep Writes: `setNested`/`getNested`/`deleteNested`/`hasNested`) |
| `TransformEngine` | Template-Resolver mit Lookup, Pipes, Datum (nested-fähig via `findNestedCI`) |
| `DataviewRunner` | Führt DataviewJS-Queries aus |
| `ConditionEvaluator` | Prüft Bedingungen (nested-fähig via `getNested`) |
| `PathFilter` | Ordner-Filter (exclude/include) |
| `ScopeManager` | newOnly/allFiles |
| `ConsistencyChecker` | Vault-Scan auf fehlende Felder **und Value Issues** (Werte außerhalb der `options[]`-Liste), nested-fähig via `getNested` |
| `StandardizerService` | Wert-Standardisierung / Normalisierung Vault-weit |
| `NestedPath` (utils) | 4 reine Funktionen für tiefen YAML-Zugriff |

### Wichtige Implementierungsdetails

- **Select/Multi Builder-Skip**: Der Builder überspringt select/multi-Felder (außer `{{lookup:…}}`).
  Der Writer setzt den Default-Wert. Schützt Benutzerauswahl vor Überschreiben.
- **Case-Insensitive Lookup**: `executeLookup()` sucht zuerst exakt, dann via `toLowerCase()`.
- **Options-Priorität**: `optionsFile` (📁) höchste → `optionsDataview` (📊) mittel → `options` (manuell) niedrigste.
- **Template-Guard im Writer**: `!template.includes("{{")` – Roh-Templates werden nie geschrieben.
- **`saveSettings()`**: Wird nie in `loadSettings()` oder `onload()` aufgerufen (sonst Datenkorruption).
- **Nested YAML**: Alle `fm[key]`-Zugriffe ersetzt durch `getNested(fm, key)` / `setNested(fm, key, val)` / `deleteNested(fm, key)` / `hasNested(fm, key)`.
- **noteId-Sicherheit**: Vor Generierung einer neuen noteId prüft der Code `pendingMigrations` auf alten Wert – verhindert doppelte IDs bei Group-Wechsel.
- **BulkRename Settings-Sync**: Nach Umbenennung von yamlKeys in Dateien werden die Settings automatisch aktualisiert.

---

## Datei-Struktur (Quellcode)

```
src/
  main.ts                    # Plugin-Einstieg, Event-Registrierung, Bulk-Befehle
  types/
    Events.ts                # Event-Typen
    MetadataField.ts         # Feld-Konfiguration (FieldType, ConditionConfig, …)
    Queue.ts                 # Queue-Typen
  services/
    EventDeduplicator.ts     # Event-Entduplizierung
    UpdateQueue.ts           # Update-Queue
    BatchFlusher.ts          # Debounce-Flusher
    MetadataUpdateBuilder.ts # Update-Payload-Bau
    MetadataWriter.ts        # Frontmatter-Schreiben (Deep Writes)
    TransformEngine.ts       # Template-Engine (Lookup, Pipes, Datum, nested CI)
    DataviewRunner.ts        # DataviewJS-Executor
    ConditionEvaluator.ts    # Bedingungen (nested-fähig)
    PathFilter.ts            # Ordner-Filter
    ScopeManager.ts          # Processing-Scope
    ConsistencyChecker.ts    # Consistency-Scan (nested-fähig)
    StandardizerService.ts   # Wert-Standardisierung / Normalisierung
  views/
    SelectFieldModal.ts      # Select/Multi-Bearbeitung (nested-fähig)
    ConsistencyModal.ts      # Consistency-Ergebnisse
    BulkProgressModal.ts     # Fortschrittsanzeige
    StandardizeModal.ts      # Standardisierungs-Vorschau + Anwenden
    BulkRenameModal.ts       # Bulk YAML-Key-Rename
  settings/
    settings.ts              # Settings-Interface + Defaults (+ yamlGroups, groupFile, pendingMigrations)
    SettingsTab.ts           # Settings-UI
    FieldListComponent.ts    # Feld-Liste (Drag&Drop, Optionen, Templates, Group-Dropdown)
    FolderSuggestModal.ts    # Ordner-Auswahl
    FileSuggestModal.ts      # Datei-Auswahl
  utils/
    DateUtils.ts             # Datumsformatierung
    IdUtils.ts               # UUID-Generierung
    SelectUtils.ts           # Options-Datei-Lader
    NestedPath.ts            # Deep-YAML-Zugriff-Helfer
```

---

## Tipps & Hinweise

- **Neustart nach Änderungen**: Nach einem Build Obsidian neu starten (Plugin neu laden)
- **Deployment**: `main.js`, `manifest.json`, `styles.css` in den Vault-Plugin-Ordner kopieren
- **DataviewJS**: Einfache Return-Ausdrücke (`dv.pages()....`). Mehrzeiliger Code braucht explizites `return`.
- **Options-Datei**: .md-Datei mit `---\noptions:\n  - Wert1\n  - Wert2\n---` oder als einfache Liste (eine Option pro Zeile)
- **Lookup-Pfade**: Bei relativen Pfaden ist der Ausgangsordner der Ordner der aktuellen Datei
- **`{{lookup:…}}`-Auto-Update**: Der Wert wird bei jedem Open/Modify-Event neu aufgelöst (keine Abhängigkeitsverfolgung – geplant für zukünftige Version)
- **Force-Apply**: Überschreibt WIRKLICH alles – auch Select/Multi-Auswahlen (da sie per Lookup neu gesetzt werden)
- **Nested YAML**: Ändern Sie `yamlKey` von `NoteID` zu `note.NoteID` für automatisch hierarchisches Frontmatter. Das `tags`-Feld bleibt flach für Obsidian-Kompatibilität.
