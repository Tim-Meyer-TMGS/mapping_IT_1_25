#!/usr/bin/env python3
"""
Extract tables from legacy HTML exports into CSV files for Jekyll (_data/).

Usage:
  python3 scripts/extract_tables.py

Input:
  legacy_html/*.html

Output:
  _data/*.csv

Notes:
- The CSV structure is intentionally "rendering-close" and stores for each cell:
  text, class, style + row_class.
- This preserves visual/semantic markers like `new`, `removed`, `depth-*`, `topcat`
  and indentation via `padding-left`.

Dependencies:
  pip install beautifulsoup4
"""
from __future__ import annotations
from pathlib import Path
import csv
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / "legacy_html"
OUT = ROOT / "_data"

# Map legacy HTML file -> [(csv_base, table_index, kind)]
PLAN = {
    "index.html":   [("poi_mapping", 0, "mapping")],
    "gastro.html":  [("gastro_mapping", 0, "mapping")],
    "events.html":  [("events_mapping", 0, "mapping")],
    "vermieter.html":[("vermieter_mapping", 0, "mapping")],
    "tour.html":    [("tour_mapping", 0, "mapping"), ("tour_changes", 1, "changes")],
    "artikel.html": [("artikel_mapping", 0, "mapping"), ("artikel_changes", 1, "changes")],
    # NOTE: package.html in the export contains the ODTA/Globale-Pauschale table:
    "package.html": [("odta_mapping", 0, "mapping")],
}

def read_html(path: Path) -> BeautifulSoup:
    return BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")

def extract_tables(soup: BeautifulSoup):
    tables = []
    for table in soup.find_all("table"):
        headers = [th.get_text(" ", strip=True) for th in table.find_all("th")]
        rows = []
        for tr in table.find_all("tr"):
            if tr.find_parent("thead"):
                continue
            tds = tr.find_all("td")
            if not tds:
                continue
            row = {"row_class": " ".join(tr.get("class", [])) if tr.get("class") else "", "cells": []}
            for td in tds:
                txt = td.get_text()
                txt = txt.replace("\xa0", " ").strip("\n")
                row["cells"].append({
                    "text": txt,
                    "class": " ".join(td.get("class", [])) if td.get("class") else "",
                    "style": td.get("style", "") or "",
                })
            rows.append(row)
        tables.append({"headers": headers, "rows": rows})
    return tables

def write_mapping_csv(rows, path: Path):
    headers = ["row_class"]
    for i in range(1, 5):
        headers += [f"col{i}_text", f"col{i}_class", f"col{i}_style"]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for r in rows:
            out = {"row_class": r.get("row_class", "")}
            cells = r["cells"] + [{"text":"","class":"","style":""}] * (4 - len(r["cells"]))
            for i, c in enumerate(cells[:4], start=1):
                out[f"col{i}_text"] = c.get("text","")
                out[f"col{i}_class"] = c.get("class","")
                out[f"col{i}_style"] = c.get("style","")
            w.writerow(out)

def write_changes_csv(rows, path: Path):
    headers = ["row_class"]
    for i in range(1, 3):
        headers += [f"col{i}_text", f"col{i}_class", f"col{i}_style"]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for r in rows:
            out = {"row_class": r.get("row_class", "")}
            cells = r["cells"] + [{"text":"","class":"","style":""}] * (2 - len(r["cells"]))
            for i, c in enumerate(cells[:2], start=1):
                out[f"col{i}_text"] = c.get("text","")
                out[f"col{i}_class"] = c.get("class","")
                out[f"col{i}_style"] = c.get("style","")
            w.writerow(out)

def main():
    OUT.mkdir(parents=True, exist_ok=True)

    for html_name, tables in PLAN.items():
        html_path = LEGACY / html_name
        if not html_path.exists():
            raise SystemExit(f"Missing input: {html_path}")

        soup = read_html(html_path)
        extracted = extract_tables(soup)

        for base, idx, kind in tables:
            if idx >= len(extracted):
                raise SystemExit(f"{html_name}: table index {idx} not found (only {len(extracted)} tables).")
            rows = extracted[idx]["rows"]
            out_path = OUT / f"{base}.csv"
            if kind == "mapping":
                write_mapping_csv(rows, out_path)
            else:
                write_changes_csv(rows, out_path)

    print("OK: CSV files written to", OUT)

if __name__ == "__main__":
    main()
