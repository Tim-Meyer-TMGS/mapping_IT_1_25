#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Konvertiert Mapping-XML nach Jekyll YAML (_data/*.yml).

Hinweis:
- Das XML-Schema in eurem Projekt ist nicht hier eingebettet.
- Passe daher in `extract_rows()` die Tag-/Attributnamen an.

Beispiel-Aufruf:
  python3 tools/xml_to_yaml.py --in Gastgeber.xml --out _data/vermieter.yml

"""

import argparse
import xml.etree.ElementTree as ET
import yaml

def extract_rows(root):
    """Passe diese Funktion an euer XML an.

    Erwartetes Ergebnis: Liste von Dicts mit Keys:
      oa, satourn, odta, schema, category, status, depth, changed
    """
    rows = []

    # Beispiel: <mapping><item><oa>..</oa><satourn>..</satourn><odta>..</odta><schema>..</schema></item></mapping>
    for item in root.findall(".//item"):
        row = {
            "oa": (item.findtext("oa") or "").strip(),
            "satourn": (item.findtext("satourn") or "").strip(),
            "odta": (item.findtext("odta") or "").strip(),
            "schema": (item.findtext("schema") or "").strip(),
            "category": (item.findtext("category") or "").strip(),
            "status": (item.findtext("status") or "ok").strip(),
            "depth": int((item.findtext("depth") or "0").strip()),
            "changed": ((item.findtext("changed") or "false").strip().lower() == "true"),
        }
        rows.append(row)

    if not rows:
        raise SystemExit("Keine <item>-Einträge gefunden. Bitte extract_rows() an euer XML-Schema anpassen.")

    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True, help="Input XML")
    ap.add_argument("--out", dest="outp", required=True, help="Output YAML")
    args = ap.parse_args()

    tree = ET.parse(args.inp)
    root = tree.getroot()

    rows = extract_rows(root)

    with open(args.outp, "w", encoding="utf-8") as f:
        yaml.safe_dump(rows, f, allow_unicode=True, sort_keys=False)

    print(f"Wrote {len(rows)} rows -> {args.outp}")

if __name__ == "__main__":
    main()
