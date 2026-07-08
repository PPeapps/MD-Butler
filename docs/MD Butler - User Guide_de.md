# MD Butler – Benutzerhandbuch

**Version 1.0.0 – Juli 2026**

---

## 1. Einleitung

MD Butler automatisiert die YAML-Frontmatter-Pflege in Ihrem Obsidian-Vault.
Während Templater-Formeln pro Datei eingefügt werden müssen, arbeitet MD Butler zentral:
Sie definieren einmalig Ihre Felder und Templates – das Plugin kümmert sich um den Rest.

---

## 2. Installation

### Aus dem Community Plugin Store (wenn veröffentlicht)
1. Obsidian öffnen → **Einstellungen** → **Community Plugins**
2. Nach "MD Butler" suchen
3. Installieren und aktivieren

### Manuelle Installation
1. `main.js`, `manifest.json`, `styles.css` aus dem Build-Ordner kopieren
2. In den Plugin-Ordner Ihres Vaults einfügen:
   `<Vault>/.obsidian/plugins/md-butler/`
3. Obsidian neu starten
4. Plugin in den Einstellungen aktivieren

### Build aus dem Quellcode (für Entwickler)
```bash
git clone <repository>
cd md-butler
npm install
npm run build
```
Die Build-Artefakte liegen dann im Projektordner.

---

## 3. Erste Schritte

### 3.1 Plugin aktivieren
Nach der Installation in den **Community Plugin Einstellungen** den Schalter bei "MD Butler" aktivieren.

### 3.2 Settings öffnen
In den **Plugin-Einstellungen** (unter "Community Plugins" → MD Butler → Zahnrad) finden Sie:

- **Date Format** – Standard: `YYYY-MM-DD ddd HH:mm:ss`
- **Processing Mode** – `newOnly` (nur Notizen ohne DateCreated)
- **YAML-Groups** – Gruppen-Liste + Import (📁)
- **Metadata Fields** – Liste aller Felder
- **Folder Filter** – Exclude/Include-Ordner
- **Protected YAML Keys** – Do-Not-Touch-Liste

### 3.3 Ein erstes Feld konfigurieren
Standardmäßig sind bereits Felder wie `fileName`, `filePath`, `dateCreated`, `lastModified`, `noteType`, `noteId` und `lastMoved` vorkonfiguriert.

Sie können:
- Die **Reihenfolge** per Drag&Drop (☰) ändern
- **YAML Keys** umbenennen (z. B. `DateCreated` → `ErstelltAm`)
- **Events** pro Feld aktivieren/deaktivieren (checkboxen)
- Den **Typ** ändern
- Ein **Template** eingeben
- Die **YAML-Gruppe** per Dropdown zuweisen

### 3.4 Testen
1. Eine neue Notiz erstellen
2. Beim ersten Öffnen werden `DateCreated` und andere Felder geschrieben
3. In der **Command Palette** (`Strg+P`):
   - `Apply Metadata to all Notes` – verarbeitet alle Notizen ohne DateCreated
   - `Force-apply metadata to all notes` – überschreibt alle bestehenden Werte

---

## 4. Konfiguration im Detail

### 4.1 Date Format
Moment.js-Format-String. Beispiele:
| Format | Ergebnis |
|--------|----------|
| `YYYY-MM-DD ddd HH:mm:ss` | `2026-07-02 Thu 14:30:00` |
| `DD.MM.YYYY HH:mm` | `02.07.2026 14:30` |
| `YYYY-MM-DD` | `2026-07-02` |
| `ddd, DD. MMM YYYY` | `Thu, 02. Jul 2026` |

### 4.2 Processing Mode
| Modus | Verhalten |
|-------|-----------|
| `newOnly` (Standard) | Beim ersten Öffnen/Bulk werden nur Notizen OHNE `DateCreated` verarbeitet |
| `allFiles` | Alle Notizen werden immer verarbeitet (auch bei jedem Öffnen) |

Tipp: Für bestehende Vaults mit vielen Dateien `newOnly` verwenden und dann `Apply Metadata to all Notes` ausführen.

### 4.3 Metadaten-Felder

#### Built-in Felder (fest verdrahtet)
| ID | YAML-Key (default) | Gruppe (default) | Events | Beschreibung |
|----|--------------------|-----------------|--------|-------------|
| `noteId` | `NoteID` | `note` | `open` (fix) | UUID v4, automatisch vergeben |
| `fileName` | `FileName` | `note` | `open, rename, bulk` | Dateiname ohne Endung |
| `filePath` | `FilePath` | `note` | `open, rename, bulk` | Vault-relativer Pfad |
| `dateCreated` | `DateCreated` | `dates` | `open` (fix) | Erstellungsdatum |
| `noteType` | `NoteType` | – | `open, rename, bulk` | Select-Feld mit Default-Optionen |
| `lastModified` | `LastModified` | `dates` | `rename, bulk` (modify gesperrt) | Letztes Änderungsdatum |
| `lastMoved` | `LastMoved` | `dates` | `rename` | Datum der letzten Verschiebung |

#### Custom Fields (frei definierbar)
- **ID**: Interne Bezeichnung (frei wählbar)
- **YAML Key**: Der Key in der Frontmatter
- **Group**: YAML-Gruppe (Prefix für yamlKey)
- **Type**: text/select/boolean/number/multi
- **Events**: Bei welchen Ereignissen das Feld aktualisiert wird
- **Template**: Template-Ausdruck oder leer
- **Default Value**: Fallback wenn kein Template
- **Condition**: Bedingung für das Setzen

#### Felder hinzufügen/löschen
- **+ Add Field** – Neues Custom Field anlegen
- **✕** (bei Custom Fields) – Feld löschen
- **☰** (Drag) – Reihenfolge ändern

#### Enable-Toggle
Jedes Feld kann an-/ausgeschaltet werden. Deaktivierte Felder werden ignoriert.

### 4.4 Event-Konfiguration

Pro Feld kann definiert werden, bei welchen Events es aktualisiert wird:

| Event | Auslöser |
|-------|----------|
| `open` | Datei wird geöffnet (nur queue – kein sofortiger Write) |
| `modify` | Datei wird gespeichert |
| `rename` | Datei wird umbenannt/verschoben |
| `bulk` | Wird bei Bulk-Operationen verwendet |

**Fixed Events**: `noteId` und `dateCreated` haben fest eingezeichnete Events (`open`). Die Checkboxen sind ausgegraut – diese Felder reagieren nur auf `open`.
**Gesperrte Events**: `lastModified` hat `modify` gesperrt (`FORBIDDEN_EVENTS`) – das Plugin setzt den Zeitstempel selbst, daher darf kein Benutzer-Trigger überschreiben.

Default-Events je Built-in-Feld:
- `noteId`: `open` (fix)
- `dateCreated`: `open` (fix)
- `fileName`/`filePath`: `open, rename, bulk`
- `noteType`: `open, rename, bulk`
- `lastModified`: `rename, bulk` (modify gesperrt)
- `lastMoved`: `rename`
- `lastMoved`: rename (nur bei Ordnerwechsel)
- `noteType`/`noteId`: open, rename, bulk

### 4.5 YAML-Groups & Nested YAML

MD Butler unterstützt hierarchisches (nested) YAML-Frontmatter via Punktnotation im yamlKey.

**Beispiel** – flach vs. gruppiert:
```yaml
# Flach (ohne Group)
NoteID: abc-123
DateCreated: 2026-07-02
FileName: Meeting

# Gruppiert (mit Group)
note:
  NoteID: abc-123
  FileName: Meeting
dates:
  DateCreated: 2026-07-02
```

Die Group wird über ein Dropdown pro Feld zugewiesen:
```
[Group: ▼note]  [yamlKey:  NoteID     ] → speichert als "note.NoteID"
```

**Vorhandene Groups:**
- `note` – Built-in: noteId, fileName, filePath
- `dates` – Built-in: dateCreated, lastModified, lastMoved
- `special` – Default-Group (frei verwendbar)
- Eigene Groups – via Textfeld + 📁-Import hinzufügbar

**Tags-Ausnahme:** Das Feld `tags` ist auf `(none)` gesperrt – `tags:` bleibt immer flach (Obsidian-Kompatibilität).

**YAML-Groups konfigurieren:**
- **Textfeld** unter "YAML-Groups:" – Groups direkt eintippen (eine pro Zeile)
- **📁-Button** – Import aus .md-Datei (liest `groups:`-Frontmatter oder Plain-Text-Liste)
- **✕-Button** (Clear) – Löscht das Textfeld – danach gelten die eingebauten Default-Gruppen (`note, dates, special`)
- **Status-Anzeige** – Zeigt `(from: pfad/zur/datei.md)` wenn die Groups aus einer Datei geladen wurden

**Migration:** Wenn Sie einem Feld eine Group zuweisen (oder wechseln), wird der yamlKey automatisch migriert. Der alte flache/nested Key wird kopiert und gelöscht.

### 4.6 Ordner-Filter

| Modus | Beschreibung |
|-------|-------------|
| **Exclude** (Standard) | Alle Ordner werden verarbeitet, AUSSER den gelisteten |
| **Include** | NUR die gelisteten Ordner werden verarbeitet |

- Eine Zeile pro Ordner
- Subordner werden rekursiv einbezogen
- Bei Include kann `*` als Wildcard für "alle Ordner" verwendet werden
- Ordner-Auswahl per 📁-Button

**Wichtig**: Bei Include-Modus OHNE gelistete Ordner wird keine Datei verarbeitet.
Das Plugin zeigt dann eine Warnung an.

### 4.7 Do-Not-Touch (Protected YAML Keys)

Geschützte YAML-Keys werden vom Plugin **nie** überschrieben oder gelöscht.

Typische Einträge:
```
cssclass
aliases
id
tags
```

Auch Migrationen und Orphaned-Key-Cleanups respektieren diese Liste.

### 4.8 Bedingungen (Conditions)

Ein Feld wird nur dann gesetzt/aktualisiert, wenn die Bedingung erfüllt ist.

#### Frontmatter-Bedingungen (unterstützt nested Keys)
| Operator | Beispiel | Wahr wenn… |
|----------|----------|-----------|
| `exists` | `frontmatter:status exists` | Key existiert (auch leer) |
| `equals` | `frontmatter:NoteType equals Project` | Wert == "Project" |
| `contains` | `frontmatter:NoteType contains Pro` | Wert enthält "Pro" |
| `matches` | `frontmatter:NoteType matches ^Pro` | Regex matched |

#### Pfad-Bedingungen
| Typ | Beschreibung |
|-----|-------------|
| `path` | Prüft gegen `file.path` (z. B. `path contains _Test`) |
| `filename` | Prüft gegen `file.name` (z. B. `filename matches ^\d{6}`) |
| `folder` | Prüft gegen den Ordner (z. B. `folder equals 3_PROJECTS`) |

#### Sonderfall: Conditional Cleanup
Wenn ein Feld eine Bedingung hat, der YAML-Key aber bereits in der Frontmatter existiert und die Bedingung NICHT mehr erfüllt ist, wird der Key **automatisch entfernt**.
So bleiben keine veralteten Metadaten zurück.

---

## 5. Template-Engine

### 5.1 Basis-Ausdrücke

```
{{title}}         → Dateiname (ohne Endung)
{{fileName}}      → Dateiname (mit Endung)
{{filePath}}      → vault-relativer Pfad
{{fileFolder}}    → Ordnerpfad
{{oldPath}}       → alter Pfad (rename)
{{oldFolder}}     → alter Ordner (rename)
{{oldName}}       → alter Dateiname (rename)
```

### 5.2 Datums-Ausdrücke

```
{{date:YYYY-MM-DD}}         → aktuelles Datum in eigenem Format
{{now+7d}}                  → heute + 7 Tage (im konfigurierten DateFormat)
{{now-1d}}                  → heute - 1 Tag
{{now+2w}}                  → heute + 2 Wochen
{{now-3m}}                  → heute - 3 Monate
{{now+1y}}                  → heute + 1 Jahr
```

Einheiten: `d` (Tage), `w` (Wochen), `m` (Monate), `y` (Jahre)

### 5.3 Frontmatter-Lookup in der eigenen Datei

```
{{frontmatter:NoteType}}    → Wert des Keys NoteType aus der aktuellen Datei
{{frontmatter:note.NoteID}} → Wert eines nested Keys
```

Case-insensitive – findet auch `notetype` wenn der Key `NoteType` heißt. Nested Keys werden segmentweise case-insensitive verglichen.

### 5.4 Lookup in anderen Dateien

```
{{lookup:Pfad/zur/Datei.md,NoteType}}
{{lookup:_Test/Beispiel.md,Status}}
{{lookup:/XTRAS/Lookups/NoteTypes.md,options}}
```

**Pfad-Auflösung** (Reihenfolge):
1. Absoluter Pfad (beginnt mit `/`) → `/Ordner/Datei.md`
2. Pfad wie eingegeben (z. B. `_Test/Datei.md`)
3. Relativ zum Ordner der aktuellen Datei → `AktuellerOrdner/_Test/Datei.md`
4. `../` für Elternordner → `../Lookups/Datei.md`

**Case-Insensitive**: Der Lookup findet `Notetype`, `notetype` oder `noteType`. Auch nested Keys werden aufgelöst.

**Lookup-Cache**: Pro Template-Resolve-Durchlauf wird gecached.
**Maximale Lookup-Tiefe**: 3 (Lookup in Lookup in Lookup).

### 5.5 Pipe-Chain (Wertetransformation)

```
{{title | upper}}

{{lookup:Datei.md,Status | lower | trim}}

{{lookup:Datei.md,Name | default:Unbekannt}}

{{frontmatter:Date | date:DD.MM.YYYY}}
```

| Pipe | Parameter | Beispiel | Ergebnis |
|------|-----------|----------|----------|
| `upper` | – | `"hallo"\|upper` | `HALLO` |
| `lower` | – | `"HALLO"\|lower` | `hallo` |
| `trim` | – | `" hallo "\|trim` | `hallo` |
| `replace` | `alt,neu` | `"a-b-c"\|replace:-,/` | `a/b/c` |
| `substr` | `start` oder `start,ende` | `"hallo"\|substr:1,4` | `all` |
| `default` | `wert` | `""\|default:unbekannt` | `unbekannt` |
| `date` | `FORMAT` | `"2026-07-02"\|date:DD.MM.` | `02.07.` |

Mehrere Pipes kombinierbar:
```
{{lookup:Datei.md,NoteType | lower | replace: ,_ | default:divers}}
```

### 5.6 Kombinations-Templates

```
Erstellt von {{title}} am {{date:DD.MM.YYYY}} um {{date:HH:mm}}
→ "Erstellt von Meeting-Notiz am 02.07.2026 um 14:30"

{{lookup:_Test/260702/260702-dddd.md,NoteType | upper}}
→ "MINE" (wenn NoteType = "mine")
```

---

## 6. Options-Quellen für Select & Multi

### 6.1 Manuelle Liste (options)
Ein Eintrag pro Zeile im Textfeld der Feld-Konfiguration.

### 6.2 Options-Datei (📁 = `optionsFile`)
Eine .md-Datei im Vault mit:

**Variante A**: YAML-Frontmatter
```yaml
---
options:
  - Projekt
  - Note
  - Aufgabe
  - Meeting
---
```

**Variante B**: Einfache Textliste (eine Option pro Zeile)
```
Projekt
Note
Aufgabe
Meeting
```

Die 📁-Schaltfläche in der Feld-Konfiguration öffnet einen Datei-Dialog.

### 6.3 DataviewJS (📊 = `optionsDataview`)

Eine DataviewJS-Abfrage, die ein Array von Strings zurückgibt:

```javascript
dv.pages().flatMap(p => p.file.tags).distinct().sort().values
```

```javascript
dv.pages('"3_PROJECTS"').map(p => p.file.name)
```

```javascript
dv.pages('#status').map(p => p.Status).distinct().sort().values
```

**Ausführung**:
- 📊-Button öffnet den Editor
- ▶ Ausführen startet die Query und setzt die Optionen
- Automatisch beim Plugin-Start wenn kein `optionsFile` gesetzt ist

**Hinweise**:
- Der Code wird als `new Function("dv", "return " + code)` ausgeführt
- Für mehrzeiligen Code muss ein explizites `return` verwendet werden
- Dataview DataArray wird automatisch in ein Array konvertiert

### 6.4 Priorität

Bei der Options-Auflösung gilt:

1. **`optionsFile`** (📁) – Höchste Priorität. Wenn gesetzt, werden Dataview-Optionen ignoriert.
2. **`optionsDataview`** (📊) – Mittlere Priorität. Wird beim Plugin-Start ausgeführt.
3. **`options`** (manuelle Liste) – Niedrigste Priorität.

---

## 7. Modals

MD Butler verwendet fünf verschiedene Modalfenster für die Benutzerinteraktion:

---

### 7.1 SelectFieldModal – Selektions-Editor

Das SelectFieldModal erlaubt die manuelle Bearbeitung aller **Select-** und **Multi-Felder** der aktuell geöffneten Notiz – ohne die YAML-Frontmatter direkt editieren zu müssen.

#### Aufruf
- **Command Palette** (`Strg+P`): `Edit select fields in current note`
- Nur verfügbar wenn eine Datei geöffnet ist

#### UI-Beschreibung

```
┌─ MD Butler — Meeting-Notiz ─────────────────────┐
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
│   (Keine Optionen verfügbar)  [➕ Datei erstellen]│
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Titelzeile**: Zeigt `MD Butler — <Dateiname>`
- **Pro Feld eine Zeile**: YAML-Key als Name, darunter die Steuerelemente
- **Select-Felder**: Dropdown mit allen Optionen
- **Multi-Felder**: Checkboxen (beliebig viele Werte anwählbar)
- **Optionsquelle**: Wenn das Feld eine Options-Datei nutzt, wird `from: <Pfad>` angezeigt
- **"Datei erstellen"-Button**: Erscheint nur wenn die konfigurierte Options-Datei nicht existiert
- **Nested YAML**: Werte werden korrekt gelesen/geschrieben (auch bei Keys wie `project.Status`)

#### Optionen werden dynamisch geladen

Beim Öffnen des Modals werden die Optionen aller Select/Multi-Felder aktualisiert:

1. **Options-Datei (📁)**: Die `.md`-Datei wird eingelesen – sowohl `options:`-Frontmatter als auch einfache Textlisten
2. **Options-Dataview (📊)**: Die DataviewJS-Query wird erneut ausgeführt
3. **Manuelle Liste**: Bereits konfigurierte Optionen werden verwendet

> **Hinweis**: Die Optionen werden beim Öffnen des Modals frisch geladen – nicht aus dem Cache.
> Änderungen an der Options-Datei sind sofort sichtbar.

#### Schreibverhalten

- Änderungen werden **sofort** per `processFrontMatter` geschrieben
- **Select**: Der ausgewählte Wert ersetzt den bisherigen YAML-Wert
- **Multi**: Alle angehakten Werte werden als Array geschrieben, nicht angehakte entfernt
- Das Modal muss nicht geschlossen werden – die Werte sind nach jeder Änderung persistent

#### Anwendungsfälle

| Situation | Nutzen |
|-----------|--------|
| **Schnelle Kategorisierung** | NoteType, Status oder Priority per Dropdown ändern – ohne YAML-Edit |
| **Mehrere Technologien auswählen** | Multi-Feld mit Checkboxen für Projekte, Skills, Tags |
| **Options-Datei fehlt** | Der "➕ Datei erstellen"-Button legt eine leere Options-Datei mit Vorlage an |
| **Blick auf alle Select-Felder** | In einer einzigen Ansicht alle Select/Multi-Werte einer Notiz prüfen |
| **Werte nach Bulk-Apply korrigieren** | Nach einem Force-Apply können einzelne Felder schnell zurückgesetzt werden |

#### Verhalten in Grenzfällen

- **Keine Select/Multi-Felder konfiguriert**: Meldung *"Keine Select- oder Multi-Felder in den Einstellungen."*
- **Options-Datei gelöscht**: Der "Datei erstellen"-Button wird angezeigt
- **Kein Frontmatter vorhanden**: Alle Felder werden als leere/Standardwerte angezeigt
- **Multi-Feld ohne Auswahl**: Leeres Array `[]` wird geschrieben

---

### 7.2 BulkProgressModal – Fortschrittsanzeige

Das BulkProgressModal erscheint bei länger laufenden Bulk-Operationen, um den Benutzer über den Fortschritt zu informieren und die Möglichkeit zum Abbrechen zu geben.

#### Auslösende Befehle

- `Apply Metadata to all Notes`
- `Force-apply metadata to all notes`
- `Clean up old YAML keys`
- `Standardize / Normalize values` (bei Bulk)
- `Bulk rename YAML key`

#### UI-Beschreibung

```
┌─ Bulk Metadata Update ──────────────────────────┐
│                                                  │
│   Processing 127 / 340 files                     │
│                                                  │
│   [ Cancel ]                                     │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Titel**: `Bulk Metadata Update`
- **Fortschrittstext**: `Processing X / Y files` (aktualisiert alle 50 Dateien)
- **Cancel-Button**: Bricht die Operation ab (Button wird deaktiviert + Text "Cancelling...")

#### Verhalten bei Abbruch

1. `[Cancel]` klicken → Button wird deaktiviert, Text auf "Cancelling..."
2. Die Schleife beendet die aktuelle Datei, bricht dann ab
3. Es erscheint ein Hinweis: *"Cancelled after X files."*
4. Bereits geschriebene Dateien bleiben erhalten (kein Rollback)

---

### 7.3 ConsistencyModal – Konsistenz-Prüfung

Das ConsistencyModal zeigt die Ergebnisse des `Vault Consistency Check` in einer übersichtlichen Zusammenfassung.

#### UI-Beschreibung

```
┌─ Vault Consistency Check ───────────────────────┐
│                                                  │
│   Scanned: 340 files                             │
│   Complete: 312 files          (grün)            │
│   Incomplete: 28 files         (rot)             │
│   Value Issues: 15 files       (orange)          │
│                                                  │
│   ── Incomplete Files ──                         │
│   • _Inbox/Idee.md                               │
│     Missing: Status, Priority                    │
│   • _Inbox/Notiz.md                              │
│     Missing: NoteType                            │
│   • 3_PROJECTS/App/README.md                     │
│     Missing: ProjectStatus, Technologies         │
│   ...                                            │
│                                                  │
│   ── Value Issues ──  (orange)                   │
│   ▼ Status (8 issues)                            │
│     ▶ _Inbox/Idee.md – "active" (erwartet:       │
│       Active/Inactive/Completed)                 │
│     ▶ _Inbox/Notiz.md – "done" (erwartet:        │
│       Active/Inactive/Completed)                 │
│     ...                                          │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Zusammenfassung**: Anzahl gescannter, vollständiger und unvollständiger Dateien
- **Vollständig (grün)**: Alle aktivierten Felder sind vorhanden
- **Unvollständig (rot)**: Es fehlen ein oder mehrere Felder – mit detaillierter Liste
- **Value Issues (orange)**: Felder mit Werten außerhalb der `options[]`-Liste (nur bei select/multi), mit expandierbaren `<details>`-Elementen pro Datei
- **Pro Datei**: Dateipfad + Liste der fehlenden YAML-Keys (nicht Feld-IDs)
- **Nested YAML**: Fehlende nested Keys werden korrekt erkannt

---

### 7.4 StandardizeModal – Standardisierungs-Vorschau

Das StandardizeModal zeigt vor der Ausführung einer Wert-Standardisierung eine detaillierte Vorschau aller anstehenden Änderungen.

#### Aufruf
- **Command Palette** (`Strg+P`): `Standardize / Normalize values`

#### UI-Beschreibung

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

- **Scannen**: ConsistencyChecker.scan() sucht nach Werten außerhalb der `options[]`-Liste (select/multi) oder im falschen Format (boolean/number)
- **Pro Issue ein Dropdown**: Wählen Sie entweder `Skip` (nicht ändern) oder den gewünschten Ersatzwert aus der `options[]`-Liste
- **Duplikat-Warnung (⚠)**: Zeigt Dateien an, die nach der Korrektur doppelte YAML-Einträge hätten (gleicher Wert, gleicher Key). Diese Duplikate werden beim Anwenden automatisch entfernt
- **Apply X fixes**: Wendet nur die nicht-`Skip`-Einträge an (mit BulkProgressModal)
- **Kein Rollback**: Nach Bestätigung werden die Änderungen direkt in die Frontmutter geschrieben

#### Anwendungsfälle

| Situation | Nutzen |
|-----------|--------|
| **Inkonsistente Select-Werte** | `"Active"`, `"active"`, `"ACTIVE"` → automatisch normalisieren |
| **Nach Migration** | Veraltete Werte aus Alt-Systemen bereinigen |
| **Vor Dataview-Auswertung** | Saubere, einheitliche Werte für zuverlässige Queries |

---

### 7.5 BulkRenameModal – YAML-Key-Rename

Das BulkRenameModal erlaubt das Umbenennen eines YAML-Keys über alle Dateien des Vaults hinweg.

> **Warnung**: Diese Aktion ist **irreversibel**. Es gibt kein UNDO. Vor der Ausführung wird empfohlen, ein Backup des Vaults zu erstellen.

#### Aufruf
- **Command Palette** (`Strg+P`): `Bulk rename YAML key`

#### UI-Beschreibung

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

- **⚠ Warnung**: Roter Hinweis "This action is irreversible!" zu Beginn
- **Old Key**: Der aktuelle YAML-Key (auch nested: `note.NoteID`)
- **New Key**: Der neue YAML-Key (auch nested: `dates.NoteID`)
- **Sync settings**: Automatisch das passende Feld in den Settings aktualisieren + Migration eintragen
- **Scan**: Zählt Vorkommen des alten Keys + zeigt "Scanned: X / Y files" an
- **Rename**: Erst aktivierbar NACH erfolgreichem Scan. Führt Umbenennung durch (mit BulkProgressModal)

#### Verhalten bei geschützten Keys

Wenn der Old Key in der protectedYamlKeys-Liste steht, wird eine Warnung angezeigt und der Vorgang abgebrochen.

#### Settings-Sync

Nach dem Rename wird geprüft, ob ein Feld in den Settings denselben yamlKey hat:
1. `field.yamlKey = this.newKey`
2. Migrationseintrag in `pendingMigrations` wird erstellt/fortgeführt
3. Settings werden gespeichert
4. Notice: `Settings updated: "dateCreated" → yamlKey "CreatedOn"`

---

### 7.6 FileSuggestModal – Dateiauswahl

Das FileSuggestModal ist ein durchsuchbares Auswahlfenster für Markdown-Dateien im Vault. Es wird an mehreren Stellen in den Einstellungen verwendet.

#### Aufruf-Kontexte

| Kontext | Wo | Beschreibung |
|---------|----|-------------|
| **Template-Vorschau** (text-Felder) | 📁-Button neben dem Template-Eingabefeld | Wählt eine Datei aus, gegen die das Template live previewt wird |
| **Options-Datei** (select/multi-Felder) | 📁-Button neben den Optionen | Wählt eine `.md`-Datei aus, deren Inhalt als Optionsliste dient |

#### UI-Beschreibung

```
┌─ Type or select a file… ───────────────────────┐
│  [src/___________________________]               │
│                                                  │
│  _Test/260702/260702-dddd.md                     │
│  _Test/260702/260702-notiz1.md                   │
│  3_PROJECTS/App/README.md                        │
│  Journal/2026-07-02.md                           │
│  XTRAS/Lookups/NoteTypes.md                      │
│  XTRAS/Lookups/ProjectStatus.md                  │
│  ...                                             │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Suchfeld**: Während der Eingabe wird die Liste in Echtzeit gefiltert (nach Pfad oder Dateiname)
- **Liste**: Maximal 100 Einträge, sortiert nach Pfad
- **Auswahl**: Klick auf einen Eintrag schließt das Modal und übergibt die Datei an die aufrufende Funktion

---

### 7.7 FolderSuggestModal – Ordnerauswahl

Das FolderSuggestModal ist ein durchsuchbares Auswahlfenster für Ordner im Vault. Es wird in den Ordner-Filter-Einstellungen verwendet.

#### Aufruf-Kontext

| Kontext | Wo | Beschreibung |
|---------|----|-------------|
| **Excluded Folders** | 📁-Button neben der Ausschlussliste | Wählt einen Ordner zum Ausschließen aus |
| **Included Folders** | 📁-Button neben der Einschlussliste | Wählt einen Ordner zum Einschließen aus |

#### UI-Beschreibung

```
┌─ Type or select a folder… ─────────────────────┐
│  [3_Pro____________________________]              │
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

- **Suchfeld**: Filtert Ordner in Echtzeit nach Namen
- **Sortierung**: Nach Tiefe (flache Ordner zuerst), dann alphabetisch
- **Root-Ordner** (`/`) ist nicht in der Liste enthalten

---

## 8. Befehle (Command Palette)

| Befehl (wie im Menü) | Kurzbefehl (ID) | Beschreibung |
|---------------------|-----------------|-------------|
| Apply Metadata to all Notes | `md-butler:apply-all` | Verarbeitet alle Dateien ohne DateCreated (respektiert Ordner-Filter und Scope) |
| Force-apply metadata to all notes (overwrite all) | `md-butler:force-apply` | Überschreibt ALLE Metadaten in allen Dateien |
| Full repair: force-apply → cleanup → consistency check | `md-butler:full-repair` | Force → Cleanup → Consistency-Check in einem Durchlauf |
| Vault Consistency Check | `md-butler:check-consistency` | Scannt alle Dateien auf fehlende Felder |
| Clean up old YAML keys | `md-butler:cleanup-keys` | Entfernt verwaiste YAML-Keys |
| Edit select fields in current note | `md-butler-edit-select-fields` | Öffnet SelectFieldModal (nur bei geöffneter Datei) |
| Standardize / Normalize values | `md-butler:standardize-values` | Öffnet StandardizeModal mit Wert-Report und Fixes |
| Bulk rename YAML key | `md-butler:bulk-rename-key` | Öffnet BulkRenameModal für Key-Umbenennung |

### Bulk-Operationen im Detail

**Apply Metadata to all Notes**:
- Respektiert `processingMode`: newOnly überspringt Dateien mit DateCreated
- Respektiert `filterMode` und Ordner-Filter
- Schaltet `bulkRunning`-Flag (unterdrückt Events während der Operation)
- Zeigt Fortschritts-Modal mit Cancel-Button

**Force-apply metadata to all notes (overwrite all)**:
- Überschreibt ALLE Werte, auch wenn bereits vorhanden
- Überschreibt auch DateCreated (force=true)
- Ignoriert `processingMode` (verarbeitet immer alle Dateien)
- Respektiert Ordner-Filter

---

## 9. Anwendungsbeispiele

Die folgenden Szenarien zeigen, wie MD Butler im Alltag eingesetzt wird – vom einfachen Zeitstempel bis zum verschachtelten Lookup.

---

### 9.1 Automatische Zeitstempel auf jeder Notiz

**Ziel**: Jede Notiz erhält `DateCreated` beim ersten Öffnen und `LastModified` bei jeder Bearbeitung.

**Konfiguration**:
- Processing Mode: `newOnly`
- `dateCreated` → enabled, Events: `open, rename, bulk`
- `lastModified` → enabled, Events: `modify, rename, bulk`

**Ablauf (schematisch)**:
```
Notiz erstellt          → [open]  → DateCreated: 2026-07-02
                                     LastModified: 2026-07-02
Notiz bearbeitet       → [modify] → LastModified: 2026-07-03
Notiz bearbeitet       → [modify] → LastModified: 2026-07-05
Notiz verschoben       → [rename] → DateCreated: bleibt
                                     LastModified: 2026-07-05
```

**Vorher** (neue Notiz):
```yaml
---
title: Meeting-Notiz
---
```

**Nach dem ersten Öffnen** (mit Nested YAML, wenn Gruppen aktiviert):
```yaml
---
title: Meeting-Notiz
note:
  NoteID: abc-123-xyz
dates:
  DateCreated: 2026-07-02 Thu 14:30:00
  LastModified: 2026-07-02 Thu 14:30:00
---
```

**Nach einer Bearbeitung**:
```yaml
---
title: Meeting-Notiz
dates:
  DateCreated: 2026-07-02 Thu 14:30:00   ← bleibt unverändert
  LastModified: 2026-07-03 Fri 09:15:00  ← aktualisiert
---
```

---

### 9.2 Status-Feld nur für Projekt-Notizen (Conditional Field)

**Ziel**: Ein Select-Feld `ProjectStatus` erscheint nur bei Notizen mit `NoteType: Project`.
Wechselt der NoteType zu etwas anderem, verschwindet das Feld automatisch.

**Konfiguration**:
- Neues Custom Field: ID `projectStatus`, YAML-Key `ProjectStatus`
- Type: `select`, Optionen: `Active, On Hold, Completed, Cancelled`
- Default Value: `Active`
- Condition: `frontmatter / NoteType / equals / Project`
- Events: `open, modify, rename, bulk`

**Logik (schematisch)**:
```
NoteType: Project
  → Bedingung erfüllt?  → JA → ProjectStatus wird geschrieben/behalten
  → ProjectStatus fehlt? → JA → Default "Active" wird gesetzt

NoteType: Meeting
  → Bedingung erfüllt?  → NEIN
  → ProjectStatus existiert? → JA → Wird automatisch gelöscht
```

---

### 9.3 Lookup: Notiztyp aus einer Quelldatei übernehmen

**Ziel**: Eine Quelldatei (`260702-dddd.md`) hat den Frontmatter-Wert `NoteType: mine`.
Alle anderen Notizen im selben Ordner sollen diesen Wert per Lookup übernehmen.

**Konfiguration** des Feldes `noteType`:
- Type: `select`
- Template: `{{lookup:260702-dddd.md,NoteType}}`
- Options: `mine, yours, theirs`
- Events: `open, rename, bulk`

---

### 9.4 Prioritäten-Dropdown mit Standard "Medium"

**Ziel**: Ein Select-Feld `Priority` mit drei Optionen. Neue Notizen erhalten automatisch `Medium`, der Benutzer kann jederzeit umschalten.

**Konfiguration**:
- Neues Custom Field: ID `priority`, YAML-Key `Priority`
- Type: `select`
- Options: `Low, Medium, High`
- Default Value: `Medium`

---

### 9.5 Tags aus Dataview generieren (Options-Datei + Dataview)

**Ziel**: Ein Select-Feld `Category` bezieht seine Optionen dynamisch aus allen Tags im Vault.
Neue Tags tauchen automatisch in der Auswahlliste auf.

---

### 9.6 Meeting-Datum per Bedingung + Template

**Ziel**: Nur wenn `NoteType: Meeting` ist, wird automatisch das aktuelle Datum in `MeetingDate` gesetzt.
Wechselt der Typ, verschwindet das Feld.

---

### 9.7 Multi-Feld für Projekt-Technologien

**Ziel**: Ein Multi-Feld `Technologies` mit Checkbox-Auswahl. Mehrere Werte möglich.

---

### 9.8 Lookup-Pipeline: Dateinamen bereinigen

**Ziel**: Aus einem `{{lookup:…}}`-Wert sollen Leerzeichen durch Unterstriche ersetzt und alles kleingeschrieben werden.

---

### 9.9 Vollreparatur nach Lookup-Änderung

**Ziel**: Sie haben den `NoteType` in der Lookup-Quelldatei von `"mine"` auf `"yours"` geändert.
Alle Zielnotizen müssen sofort aktualisiert werden.

---

### 9.10 Select + Options-Datei: Status aus externer Pflegedatei

**Ziel**: Der `Status` eines Projekts wird aus einer zentralen `.md`-Datei bezogen.
Änderungen in der Pflegedatei wirken sich sofort auf die Auswahlmöglichkeiten aus.

---

### 9.11 Nested YAML: Gruppen-Wechsel eines Feldes

**Ziel**: Bisher war `yamlKey: "DateCreated"` (flach). Sie weisen dem Feld die Gruppe `dates` zu → `yamlKey: "dates.DateCreated"`.

**Konfiguration**:
- Group-Dropdown von `(none)` auf `dates` ändern
- Der yamlKey wird automatisch von `DateCreated` zu `dates.DateCreated`

**Migration (automatisch)**:
```
Beim nächsten Write:
  1. getNested(fm, "DateCreated") → findet Wert "2026-07-02"
  2. setNested(fm, "dates.DateCreated", "2026-07-02")
  3. deleteNested(fm, "DateCreated")
```

**Vorher**:
```yaml
---
DateCreated: 2026-07-02
---
```

**Nachher**:
```yaml
---
dates:
  DateCreated: 2026-07-02
---
```

---

### 9.12 Standardisierung: Inkonsistente Werte bereinigen

**Ziel**: Im Vault existieren verschiedene Schreibweisen für `Priority`: `"High"`, `"high"`, `"HIGH"`. Alle sollen auf `"High"` normalisiert werden.

**Ablauf**:
1. Befehl: `Standardize / Normalize values`
2. Scan zeigt: `high → High (12x)`, `HIGH → High (5x)`
3. "Fix All Issues" klicken
4. BulkProgressModal zeigt Fortschritt
5. Alle Werte sind einheitlich `High`

---

### 9.13 BulkRename: YAML-Key überall umbenennen

**Ziel**: Sie möchten `yamlKey: "DateCreated"` in allen Dateien zu `CreatedOn` umbenennen.

**Ablauf**:
1. Befehl: `Bulk rename YAML key`
2. Old Key: `DateCreated`
3. New Key: `CreatedOn`
4. Scan: `Found in 127 files`
5. Rename ausführen
6. Settings werden automatisch syncronisiert

---

## 10. Migration & Bereinigung

### YAML-Key-Migration
Wenn Sie einen YAML-Key in den Einstellungen umbenennen (auch bei Group-Wechsel):
1. Der alte Key wird in `pendingMigrations` gespeichert
2. Beim nächsten Write wird der alte Wert in den neuen Key kopiert (via `getNested`/`setNested`)
3. Der alte Key wird gelöscht (via `deleteNested`)
4. Nachdem keine Datei mehr den alten Key hat, wird die Migration als abgeschlossen markiert

### Orphaned-Key-Cleanup
Wenn ein Feld gelöscht wird:
1. Der YAML-Key wird in `orphanedYamlKeys` gespeichert
2. Der Befehl `Clean up old YAML keys` entfernt den Key aus allen Dateien
3. Danach wird die Liste geleert

### Consistency Check
Scannt alle Dateien (respektiert Ordner-Filter) und zeigt:
- Wie viele Dateien vollständig sind
- Welche Dateien welche Felder vermissen lassen
- Ermöglicht gezieltes Nachbearbeiten

---

## 11. Tipps & Best Practices

### 11.1 Für Einsteiger
1. Mit den **Standard-Feldern** beginnen (fileName, filePath, dateCreated, noteType)
2. `Apply Metadata to all Notes` ausführen
3. Danach Custom Fields hinzufügen
4. Nach Bedarf YAML-Groups zuweisen

### 11.2 Für Select-Felder
- Immer einen **Default-Wert** setzen (oder die erste Option als Standard nutzen)
- Bei vielen Optionen: **Options-Datei** (📁) verwenden
- Für dynamische Optionen: **DataviewJS** (📊) verwenden
- **Regular Bulk** überschreibt Select-Felder NICHT (schützt Benutzerauswahl)
- **Force-Apply** überschreibt Select-Felder (Vorsicht!)

### 11.3 Für Lookups
- Lookup-Pfade möglichst **absolut** (`/Ordner/Datei.md`) angeben
- Bei relativen Pfaden: immer den Ordner der Quelldatei bedenken
- Lookup-Werte werden bei jedem Event neu aufgelöst (aktuell keine Abhängigkeitsverfolgung)
- Bei Fehlern: `null` → Template schlägt fehl → Feld wird nicht geschrieben

### 11.4 Performance
- Die **Event-Queue** (2s-Fenster) verhindert Overload
- **Bulk-Operationen** zeigen Fortschritt und können abgebrochen werden
- **Do-Not-Touch** große Dateien mit vielen Metadaten anderer Plugins
- **Options-Dateien** werden nur bei Bedarf geladen (nicht beim Plugin-Start)

### 11.5 Bekannte Einschränkungen
- Lookup hat KEINE automatische Abhängigkeitsverfolgung (kein Live-Update wenn sich die Quelldatei ändert)
- DataviewJS braucht einfache Return-Ausdrücke (oder explizites `return` bei mehrzeiligen Queries)
- Das Plugin lädt KEINE eigenen Daten beim Start, die Optionen-Dateien werden gecached

---

## 12. Fehlerbehebung

### "failed to open"-Meldung
Dies ist ein **Obsidian-Kern-Bug** (kein MD Butler-Fehler). Tritt sporadisch auf und ist harmlos.

### Dataview-Fehler
- "Dataview plugin not found" → Dataview-Plugin ist nicht installiert/aktiviert
- "Query result is not an array" → Die Query muss ein Array zurückgeben
- Überprüfen Sie die Dataview-Konsole (Strg+Shift+I)

### Lookup liefert keinen Wert
1. Existiert die Quelldatei?
2. Hat die Quelldatei den gesuchten Frontmatter-Key?
3. Groß-/Kleinschreibung? (wird case-insensitive geprüft)
4. Lookup-Tiefe > 3? Dann wird abgebrochen.

### Plugin reagiert nicht
1. Plugin in den Einstellungen deaktivieren/reaktivieren
2. Obsidian neustarten
3. Logs prüfen (Strg+Shift+I → Console)

### Select/Multi-Werte werden überschrieben
- Normales Apply überschreibt Select/Multi NICHT (Builder überspringt sie)
- Force-Apply überschreibt ALLES (bewusst so designed für Reparatur-Fälle)
- Bei `{{lookup:…}}`-Templates werden Select/Multi-Werte immer aktualisiert (gewollt)

---

## 13. Versionsgeschichte

| Version | Neuerungen |
|---------|-----------|
| **1.0.0** | Nested YAML Groups (Punktnotation, Group-Dropdown, Group-Import), Standardizer (Wert-Normalisierung, Bulk-Key-Rename), Tags-Ausnahme, noteId-Migrationssicherung, BulkRename Settings-Sync, `findNestedCI` in TransformEngine, 5 Feldtypen (text/select/boolean/number/multi), 3 Options-Quellen, 5 Condition-Typen, 8 Commands, Event-gesteuerte Architektur (open/modify/rename/bulk), dateiübergreifender Lookup (`{{lookup:…}}`), Dataview-Integration, Template-Engine mit Pipes |
