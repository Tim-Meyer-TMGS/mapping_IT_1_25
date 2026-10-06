# SaTourN Mapping Hub

Der SaTourN Mapping Hub läuft als rein statische Browseranwendung auf GitHub Pages. Die Oberfläche lädt die normalisierte Arbeitsgrundlage unter `data/`; Bestandsaufnahme und fachliche Grenzen stehen in `docs/umbau-vorbereitung.md`.

## Mappingdaten neu erzeugen und prüfen

Voraussetzung für die lokalen Hilfsskripte ist Node.js. Es werden keine npm-Pakete benötigt.

```bash
node tools/build-data.mjs
node tools/check-data.mjs
```

Die Skripte sind ausschließlich Entwicklungshilfen. Die veröffentlichte Seite lädt statische JSON-Dateien und benötigt weder Node.js noch ein Backend.

## Navigation und Datenfelder

Die Startseite bietet zwei Einstiege: „Zuordnung suchen“ führt von Quellsystem und
Quellwert zum dokumentierten Ziel. „Felder und Mappings“ öffnet den Katalog.
Zusätzlich bleiben alle Datensatzarten
mit Feldanzahl, Mappinganzahl und Quellen direkt erreichbar.
Die geführte Suche erlaubt ein unbekanntes Quellsystem, schlägt ausschließlich
dokumentierte Quellwerte vor und verlangt bei mehreren Datensatzarten eine Auswahl.
Nur exakte Quellwerte bestätigen eine Regel; Teiltreffer dienen als Vorschläge.
Fehlende Regeln sind keine Aussage über das tatsächliche Importverhalten.
Eine Datensatzart öffnet ihre Übersicht. Datenfelder und Mappings haben eigene
filterbare Tabellen; Feld- und Regeldetails sind in beide Richtungen verlinkt.
Routing und Fallbacks sind zusätzliche Bereiche, sofern Regeln vorliegen.

| URL-State | Ansicht |
| --- | --- |
| `?view=guide` | Geführte Quellwertsuche |
| `?view=guide&system=outdooractive&source=Reiten` | Zuordnung anzeigen |
| `?view=catalog` | Direkter Katalogeinstieg |
| `?type=poi` | POI-Übersicht |
| `?type=poi&view=fields` | Gruppierter Feldkatalog |
| `?type=poi&view=fields&field=Kategorie` | Felddetails und eingehende Mappings |
| `?type=poi&view=mapping` | Mappingliste |
| `?type=poi&view=mapping&system=outdooractive&source=Reiten` | Gefilterte Mappingliste |
| `?type=poi&view=mapping&term=REGEL-ID` | Mappingdetails |
| `?q=Reiten` | Globale Suche: Mappings, Datenfelder und Feldwerte |

Weitere Filter: `dimension`, `field`, `target`, `filter`, `group`, `page`.
Die Mappingliste zeigt zunächst Quellsystem und Suche; „Weitere Filter“ öffnet
die gezielten Filter und zeigt deren aktive Anzahl. Aktive Zusatzfilter werden
beim Laden aufgeklappt. Felddetails begrenzen Werte und eingehende Regeln auf je
30 Einträge pro Seite. `valueFilter`/`valuePage` und `ruleFilter`/`rulePage` steuern
beide Listen unabhängig. Die Anzeigeordnung beginnt mit Basisdaten, Texten,
Klassifikation, Kontakt und Öffnungszeiten, ohne die Klassifizierungsregeln zu ändern.
`from` bewahrt die ursprüngliche Auswahl für Rücklinks aus Feld- und Regeldetails.
Alte `view=model`-/`view=structure`-Links öffnen Datenfelder. `direction=inbound`
und `property=category/feature` bleiben unterstützt. Die alten HTML-Einstiegsseiten
führen zur jeweiligen Übersicht. Zurück/Vorwärts stellt den URL-State wieder her.

Feldgruppen und Suchalias sind explizite Navigationsregeln in
`assets/js/field-groups.js` (erste passende Regel gewinnt), keine offizielle
Feldsemantik. Interne Mappingnotizen stehen ausschließlich in geschlossenen
technischen Details; Provenienz und Rohtext sind separat aufklappbar.

Der JSON-LD-Download enthält alle Datentypen und Regeln.
Feldtypen werden aus den verfügbaren Testwerten abgeleitet
und ausdrücklich als abgeleitet ausgewiesen. Der CSV-Auszug enthält höchstens drei
kurze Werte je Feld; diese Ableitung ist daher keine vollständige Schemaprüfung.
Leere oder uneindeutige Felder bleiben unbestimmt. Pflichtangaben und Kardinalitäten
werden nicht ergänzt. Testwerte und Testvokabulare werden weder geladen noch
angezeigt oder exportiert. Feldwerte stammen ausschließlich aus dokumentierten
Mapping-Zielwerten; sie sind kein vollständiges offizielles Vokabular. Sprachen
und Nutzungszahlen stehen als Metadaten zur Verfügung. Die Oberfläche lädt nur
`data/field-definitions.json` und die Mappingdokumentation. Die ursprünglichen
Testdateien bleiben für die lokale Ableitung erhalten. Die übermittelte ODTA-Spezifikation dient als Strukturvorlage,
nicht als Nachweis einer SaTourN-zu-ODTA-Zuordnung.

Prüfung der Ansicht und vollständigen Datenübernahme:

```bash
node tools/build-field-types.mjs
node tools/check-data.mjs
python tools/check_authoritative_data.py
node tools/check-model.mjs
```

Optional kann als erstes Argument der Pfad zu Chrome oder Edge angegeben werden.
Dann prüft das Skript zusätzlich die Nutzungspfade A–H im Desktop- und Mobilformat:
Navigation, geführte Suche, Feld- und globale Suche, Mappingfilter, technische Details,
Zurück/Vorwärts, alte Deep Links, Download und Seitenüberlauf. Es erzeugt
Screenshots in einem ausgegebenen temporären Verzeichnis. Keine npm-Abhängigkeiten.

`check-data.mjs` prüft den älteren Bestand mit 848 Regeln. Der produktiv geladene
autoritative Bestand enthält 855 Mappings, 55 Routing- und 6 Fallbackregeln und
wird von `check_authoritative_data.py` und `check-model.mjs` geprüft.

Fachliche Lücken: kein Feldkatalog für Touren/Angebote; teilweise unbekannte
Zielfelder; keine belegten ODTA-Exportmappings; keine verbindlichen Pflichtangaben
oder Kardinalitäten. Felder ohne belegte Typableitung zeigen keinen Datentyp.

## Lokal starten
Für den Hub selbst genügt Node.js, ohne zusätzliche Pakete:

```bash
node tools/serve.mjs
```

Vorschau: http://127.0.0.1:4173/ (anderer Port als Argument möglich).
Der Server ist nur lokal erreichbar und liefert die Oberfläche sowie ihre beiden
Datendateien aus. Quellen, Testdaten und Git-Metadaten werden nicht ausgeliefert.
Die Veröffentlichung bleibt eine statische GitHub-Pages-Anwendung.

Für den vollständigen Jekyll-Build einschließlich Altseiten:
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
