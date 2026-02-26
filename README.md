# SaTourN Mapping (Jekyll)

Dieses Repository stellt die Mapping-Tabellen als **statische Jekyll-Website** bereit.
Alle Tabellen werden aus **CSV-Dateien in `_data/`** gerendert (kein Live-Zugriff auf Schnittstellen).

## Struktur

- `_data/*.csv`  
  Enthält die Tabelleninhalte (inkl. Klassen/Styles wie `new`, `removed`, `depth-*`, `topcat`).
- `index.md`, `gastro.md`, `tour.md`, `events.md`, `artikel.md`, `vermieter.md`, `odta.md`  
  Seiten, die jeweils eine oder mehrere CSV-Tabellen einbinden.
- `_includes/table_mapping.html`, `_includes/table_changes.html`  
  Wiederverwendbare Templates zur Tabellenausgabe.
- `assets/css/style.scss`  
  Gemeinsames Styling (anlehnend an die ursprünglichen HTML-Dateien).

## Lokal starten

Voraussetzungen: Ruby + Bundler

```bash
bundle install
bundle exec jekyll serve
```

Dann im Browser: `http://localhost:4000`

## Daten pflegen

- Mapping-Tabellen liegen in `_data/*_mapping.csv`
- Änderungslisten liegen in `_data/*_changes.csv`

Wichtig: Die CSV-Spaltenstruktur ist bewusst „ausführungsnah“, damit keine Information (inkl. Markierungen wie `new/removed` und Einrückungen via `padding-left`) verloren geht.

## Deployment (GitHub Pages)

Das Repo kann direkt als GitHub Pages Site deployed werden (Jekyll Build).
Optional ist ein Workflow enthalten: `.github/workflows/pages.yml`.

## CSV neu aus HTML erzeugen (optional)

Wenn die HTML-Exports aktualisiert werden, können die CSVs automatisch regeneriert werden:

```bash
pip install -r scripts/requirements.txt
python3 scripts/extract_tables.py
```
