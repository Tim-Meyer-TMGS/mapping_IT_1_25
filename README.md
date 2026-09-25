# SaTourN Mapping Hub

Der SaTourN Mapping Hub läuft als rein statische Browseranwendung auf GitHub Pages. Die Oberfläche lädt die normalisierte Arbeitsgrundlage unter `data/`; Bestandsaufnahme und fachliche Grenzen stehen in `docs/umbau-vorbereitung.md`.

## Mappingdaten neu erzeugen und prüfen

Voraussetzung für die lokalen Hilfsskripte ist Node.js. Es werden keine npm-Pakete benötigt.

```bash
node tools/build-data.mjs
node tools/check-data.mjs
```

Die Skripte sind ausschließlich Entwicklungshilfen. Die veröffentlichte Seite lädt statische JSON-Dateien und benötigt weder Node.js noch ein Backend.

## Bestehender Prototyp

## Lokal starten
Voraussetzung: Ruby + Bundler (siehe unten in den Installationshinweisen).

```bash
bundle install
bundle exec jekyll serve
```

Dann im Browser öffnen: http://127.0.0.1:4000

## Bisherige Beispieldaten
Die Tabellen werden aus `_data/*.yml` gerendert:

- `_data/poi.yml`
- `_data/gastro.yml`
- `_data/tour.yml`
- `_data/events.yml`
- `_data/vermieter.yml`

Jeder Eintrag ist ein Objekt mit Feldern wie:
- `oa` (String oder Array)
- `satourn`
- `odta`
- `schema`
- `category`
- `status` (z.B. `ok`, `warn`, `bad`)
- `depth` (0..3)
- `changed` (true/false)

Diese Dateien gehören zum Altprototyp und sind nicht die Datenquelle des neuen Hubs.

## XML → YAML (Altbestand)
Unter `tools/xml_to_yaml.py` ist ein Grundgerüst, um XML-Mappings nach YAML zu konvertieren.
Da XML-Schemata je Projekt variieren, musst du ggf. die XPath/Tag-Namen anpassen. Für den vorbereiteten Hub ist stattdessen `tools/build-data.mjs` maßgeblich.
