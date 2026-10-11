#!/usr/bin/env python3
"""Erneuert in PRUEFLISTE.md den Abschnitt „Aus dem Katalog“ aus den fachlich_zu_pruefen-Feldern in catalog/."""
import glob, pathlib, yaml

wurzel = pathlib.Path(__file__).resolve().parent.parent
zeilen = []
for f in sorted(glob.glob(str(wurzel / "catalog/pflichten/*.yaml"))):
    d = yaml.safe_load(open(f, encoding="utf-8"))
    zeilen += [(d["id"], d.get("katalog_nr", ""), x) for x in d.get("fachlich_zu_pruefen", [])]
for f in sorted(glob.glob(str(wurzel / "catalog/regelwerte/*.yaml"))):
    for d in yaml.safe_load(open(f, encoding="utf-8")):
        zeilen += [(f"{d['id']}@{d['version']}", d.get("katalog_nr", ""), x) for x in d.get("fachlich_zu_pruefen", [])]
tabelle = "\n".join(f"| K-{i + 1:03d} | `{a}` | {b} | {c.replace('|', '/')} |" for i, (a, b, c) in enumerate(zeilen))
kopf = "## Aus dem Katalog (automatisch aus `fachlich_zu_pruefen`)"
p = wurzel / "PRUEFLISTE.md"
t = p.read_text(encoding="utf-8")
t = t[: t.index(kopf)] + f"{kopf}\n\nErzeugt mit `scripts/pruefliste.py`; {len(zeilen)} Punkte.\n\n| Nr. | Objekt | Katalog-Nr. | Punkt |\n|---|---|---|---|\n{tabelle}\n"
p.write_text(t, encoding="utf-8")
print(len(zeilen), "Katalog-Prüfpunkte")
