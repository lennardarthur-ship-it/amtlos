#!/usr/bin/env python3
"""Abdeckung der englischen Katalogtexte (E-107): fehlende und nicht mehr benutzte Einträge in catalog/uebersetzungen/en.yaml.

Aufruf: python3 scripts/uebersetzung_abdeckung.py [--fehlende-als-vorlage]
Mit --fehlende-als-vorlage werden fehlende Texte als YAML-Gerüst ausgegeben (en leer – übersetzen und einfügen).
"""
import glob
import os
import sys

import yaml

WURZEL = os.path.join(os.path.dirname(__file__), "..")


def texte(o, aus):
    if isinstance(o, dict):
        if isinstance(o.get("de"), str) and set(o) <= {"de", "en"}:
            aus.add(o["de"])
            return aus
        for v in o.values():
            texte(v, aus)
    elif isinstance(o, list):
        for v in o:
            texte(v, aus)
    return aus


def main():
    katalog = set()
    for f in glob.glob(os.path.join(WURZEL, "catalog/pflichten/*.yaml")) + glob.glob(os.path.join(WURZEL, "catalog/regelwerte/*.yaml")):
        texte(yaml.safe_load(open(f, encoding="utf-8")), katalog)
    datei = yaml.safe_load(open(os.path.join(WURZEL, "catalog/uebersetzungen/en.yaml"), encoding="utf-8"))
    vorhanden = {e["de"] for e in datei["eintraege"]}
    fehlend = sorted(katalog - vorhanden)
    ueberzaehlig = sorted(vorhanden - katalog)
    if "--fehlende-als-vorlage" in sys.argv:
        print(yaml.safe_dump([{"de": d, "en": ""} for d in fehlend], allow_unicode=True, sort_keys=False, width=200))
        return
    print(f"{len(katalog)} Texte im Katalog, {len(vorhanden)} übersetzt, {len(fehlend)} fehlen, {len(ueberzaehlig)} nicht mehr benutzt")
    for d in fehlend:
        print(f"FEHLT: {d}")
    for d in ueberzaehlig:
        print(f"ÜBERZÄHLIG: {d}")
    sys.exit(1 if fehlend else 0)


if __name__ == "__main__":
    main()
