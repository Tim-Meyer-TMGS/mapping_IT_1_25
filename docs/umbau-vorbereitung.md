# Vorbereitung des Umbaus zum SaTourN Mapping Hub

Stand: 25. September 2026

## Zielarchitektur

Der Umbau wird als rein statische GitHub-Pages-Anwendung vorbereitet:

- HTML, CSS und JavaScript im Browser,
- produktive Daten als JSON im Verzeichnis `data/`,
- keine Datenbank, kein Backend, keine Authentifizierung und keine externen Laufzeitdienste,
- URL-Zustand über `index.html` mit Query-Parametern,
- lokale Node-Skripte nur zur Datenaufbereitung und Prüfung, nicht als Produktionsabhängigkeit.

## Gelesener Bestand

Das bestehende Repository ist ein gemischter Prototyp:

- `poi.html`, `events.html`, `artikel.html`, `package.html` und `odta.html` enthalten große statische Tabellen direkt im HTML.
- `tour.html`, `gastro.html` und `vermieter.html` rendern kleine Beispieldaten aus `_data/*.yml`.
- `index.html` bindet `poi.html` ein und veröffentlicht die POI-Ansicht unter der Root-URL.
- `assets/js/filter.js` filtert nur bereits gerenderte Tabellenzeilen.
- `odta.html` enthält einen ODTA-Wertekatalog, aber keine belastbare SaTourN→ODTA-Regelmenge.
- Die alten Kern-URLs müssen beim späteren Umbau als Weiterleitungen oder App-Einstiege erhalten bleiben.

Die gelieferte Extraktion enthält 991 erkannte Mappingzeilen. Davon sind 982 aktiv und 9 auskommentiert. Zusätzlich enthält sie 6 Fallbackdefinitionen und 55 Outdooractive-Quellkategorien außerhalb der eigentlichen Mappingregeln.

## Vorbereitete Datenbasis

`tools/build-data.mjs` erzeugt aus der unveränderten Extraktion:

- `data/meta.json`,
- `data/systems.json`,
- `data/dataset-types.json`,
- `data/mappings.json`,
- `data/notices.json`,
- `data/source-categories.json`.

Dabei gelten folgende Regeln:

- Nur aktive Zeilen werden zu produktiven Regeln.
- Gleiche Quellwerte werden nur innerhalb desselben Systems, Quellkontexts, Mappingtyps und Sprachkontexts gruppiert.
- Mehrere Ziele bleiben als gemeinsames `targets[]` einer 1:n-Regel erhalten.
- Leere Ziele werden `noTarget`, explizite `*-no-import`-Marker werden `noImport`.
- Fallbacks bleiben eigene Regeln mit `behavior: "fallback"`.
- Labels und technische Quelltypen werden nicht korrigiert oder fachlich umbenannt.
- Feratel-Sprachangaben `de` und `en` bleiben erhalten.
- Die 55 separat aufgeführten Outdooractive-Quellkategorien werden nicht zu angeblich unmapped Regeln umgedeutet. Sie liegen getrennt in `source-categories.json`.

Die erzeugten JSON-Dateien sind die Arbeitsgrundlage für die neue Browser-App. Die mitgelieferte Word-Datei bleibt die fachliche Ursprungsquelle; die Extraktion ist weiterhin nur technische Arbeitshilfe.

## Bewusste offene Punkte

1. Die gelieferte Extraktion enthält keine ODTA-Exportregeln. Deshalb wurden keine SaTourN→ODTA-Zuordnungen erfunden. Vor dem vollständigen Exportbereich wird eine belastbare Mappingquelle benötigt.
2. `_feratel_Erlebnisse`, Bookingkit und Regiondo werden im UI-Katalog unter „Angebote“ zusammengeführt; ihre technischen Quelltypen bleiben in jeder Regel unverändert sichtbar.
3. Feratel-Werte werden mangels belastbarer technischer IDs mit `keyType: "unknown"` geführt. Sichtbare Bezeichnungen werden nicht fälschlich als IDs ausgegeben.
4. Die Outdooractive-Sprachlogik und der mögliche Keyword-Fallback bleiben als Hinweise, nicht als automatisch erzeugte Regeln.
5. Die alten HTML-Tabellen enthalten teilweise Inhalte, die nicht Teil der neuen Extraktion sind (insbesondere Artikel und ODTA-Wertekatalog). Vor dem Ersetzen der Seiten ist fachlich zu entscheiden, ob diese als eigenständige Kataloge weitergeführt werden.

## Umgesetzte Oberfläche

Die statische Browseranwendung ist inzwischen umgesetzt:

1. `index.html` dient als zentrale App-Shell; Layout und Browserlogik liegen unter `assets/css/app.css` und `assets/js/`.
2. Die Startseite und ihre Systemangaben werden vollständig aus `mappings.json` erzeugt.
3. Quellsicht und SaTourN-Rückwärtssicht verwenden dieselbe Regelmenge.
4. Suche, Query-URL-State, technische Detail-Accordions und responsive Darstellung sind enthalten.
5. Die bisherigen Kernseiten leiten auf passende Hub-Zustände weiter.
6. Der ODTA-Bereich zeigt den dokumentierten Datenstand, erzeugt aber bis zur Lieferung belastbarer Regeln keine erfundenen Zuordnungen.

## Lokale Befehle

```text
node tools/build-data.mjs
node tools/check-data.mjs
```

Beide Skripte benötigen keine npm-Pakete. Sie sind nicht Teil der GitHub-Pages-Laufzeit.
