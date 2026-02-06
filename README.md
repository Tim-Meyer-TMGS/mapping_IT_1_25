# SaTourN Mapping (Jekyll)

## Lokal starten
Voraussetzung: Ruby + Bundler (siehe unten in den Installationshinweisen).

```bash
bundle install
bundle exec jekyll serve
```

Dann im Browser öffnen: http://127.0.0.1:4000

## Inhalte pflegen
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

## XML → YAML
Unter `tools/xml_to_yaml.py` ist ein Grundgerüst, um XML-Mappings nach YAML zu konvertieren.
Da XML-Schemata je Projekt variieren, musst du ggf. die XPath/Tag-Namen anpassen.
