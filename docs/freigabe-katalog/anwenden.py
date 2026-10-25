"""
Freigaben aus dem Register (docs/freigabe-katalog/freigaben.yaml) in den Katalog schreiben (E-173).

    python3 docs/freigabe-katalog/anwenden.py            # schreibt pruefung-Blöcke, druckt Übersicht
    python3 docs/freigabe-katalog/anwenden.py --pruefen  # schreibt nichts, Exit 1 wenn der Katalog vom Register abweicht

Regel: Eine Freigabe gilt nur für die Fassung (Version), die der Prüfer gesehen hat. Ein Eintrag ist freigegeben, wenn
für seinen Bereich alle nötigen Freigaben zur aktuellen Version passen:
- Recht → RA Dr. Weber; Steuern → StB Busch; Arbeitsschutz → T. Koch;
- Lebensmittel → T. Baum (Inhalt ohne Folgen) UND RA Dr. Weber (nur Folgen bei Verstoß).
Bei Teil-Umfängen („ohne_sanktion“ / „sanktion“) bleibt eine Freigabe gültig, wenn sich seit der freigegebenen Version
nur Felder außerhalb ihres Umfangs geändert haben (Vergleich mit der Fassung aus der git-Historie).
Alles andere wird `in_pruefung` (zuvor freigegeben) bzw. bleibt `entwurf`. Die App zeigt „geprüft“ nur bei
`geprueft_version == version` (apps/mobile/src/pflichten/pruefer.ts).
"""
import glob
import os
import re
import subprocess
import sys

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
PRUEFEN = "--pruefen" in sys.argv

STEUER_GRUENDUNG = {"gruendung.fragebogen_steuerliche_erfassung", "gruendung.ust_idnr",
                    # StB Busch 23.10.2026: Jahresabschluss der OHG, KG und e. K. (sein Vorschlag, er sieht ihn durch)
                    "gesellschaft.jahresabschluss_personenhandel"}
# E-195: elektronische Lohnsteuerbescheinigung (§ 41b EStG, § 93c AO) ist Steuerrecht – StB Busch, obwohl Kategorie „personal“
STEUER_PERSONAL = {"personal.lohnsteuerbescheinigung"}
ARBEITSSCHUTZ_BRANCHE ={"branche.handwerk_gefaehrdung_gewerk", "branche.bau_baustellenverordnung", "branche.beauty_hautschutzplan", "branche.gastro_schankanlage_fluessiggas"}
LEBENSMITTEL_RECHT = {"branche.gastro_preisverzeichnis", "branche.gastro_mehrweg", "branche.gastro_ppwr_radar", "branche.gastro_einwegkunststofffonds"}
WEBER, BUSCH, KOCH, BAUM = "RA Dr. Ulrich Weber", "StB Lutz Busch", "Thomas Koch (Fachkraft für Arbeitssicherheit)", "Tim Baum (Lebensmittelfachbeauftragter)"
NICHT_VERGLICHEN = {"version", "pruefung", "fachlich_zu_pruefen", "aenderungsnotiz"}


# E-174: arbeitsmedizinische Vorsorge (ArbMedVV) prüft RA Dr. Weber rechtlich – die Sifa hat sie als ärztliches Fachgebiet abgegeben
RECHT_STATT_ARBEITSSCHUTZ = {"arbeitsschutz.arbeitsmedizinische_vorsorge"}


def gebiet(d):
    i, k = d["id"], d["kategorie"]
    if i in RECHT_STATT_ARBEITSSCHUTZ:
        return "recht"
    if i in ARBEITSSCHUTZ_BRANCHE or k == "arbeitsschutz":
        return "arbeitsschutz"
    if k == "steuern" or i in STEUER_GRUENDUNG or i in STEUER_PERSONAL:
        return "steuer"
    if i.startswith("branche.gastro_") and i not in LEBENSMITTEL_RECHT:
        return "lebensmittel"
    return "recht"


BENOETIGT = {"recht": [(WEBER, "alles")], "steuer": [(BUSCH, "alles")], "arbeitsschutz": [(KOCH, "alles")],
             "lebensmittel": [(BAUM, "ohne_sanktion"), (WEBER, "sanktion")]}

register = yaml.safe_load(open(os.path.join(ROOT, "docs/freigabe-katalog/freigaben.yaml"), encoding="utf-8"))
# mehrere Blöcke je Prüfer/Umfang möglich (z. B. Nachtrag, der Erklärung und Stelle bestätigt)
BLOECKE = [(r["pruefer"], r["umfang"], set(r.get("felder_fehlen") or []), r["eintraege"]) for r in register]
frei = {}
for _p, _u, _fehl, _e in BLOECKE:
    for _i, _f in _e.items():
        frei.setdefault((_p, _u), {})[_i] = _f  # jüngster Block gewinnt (für Anzeige/Abgleich)
SONDERFELDER = {"erklaerung", "stelle"}

_hist = {}


def fassung(pfad, version):
    """Inhalt des Eintrags in der genannten Version aus der git-Historie (jüngster Stand mit dieser Version)."""
    if pfad not in _hist:
        rel = os.path.relpath(pfad, ROOT)
        commits = subprocess.run(["git", "log", "--format=%H", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.split()
        _hist[pfad] = []
        for c in commits:
            t = subprocess.run(["git", "show", f"{c}:{rel}"], cwd=ROOT, capture_output=True, text=True).stdout
            try:
                _hist[pfad].append(yaml.safe_load(t))
            except yaml.YAMLError:
                pass
    for d in _hist[pfad]:
        if d and d.get("version") == version:
            return d
    return None


def gueltig(pfad, d, f, umfang):
    if not f:
        return False
    if f["version"] == d["version"]:
        return True
    if umfang == "alles":
        return False
    alt = fassung(pfad, f["version"])
    if not alt:
        return False
    felder = (set(alt) | set(d)) - NICHT_VERGLICHEN
    if umfang == "ohne_sanktion":
        felder -= {"sanktion"}
    elif umfang == "sanktion":
        felder = {"sanktion"}
    return all(alt.get(k) == d.get(k) for k in felder)


def abgedeckt(pfad, d, p, u):
    """Sind alle Felder im Umfang für die aktuelle Version freigegeben (inkl. Erklärung und Stelle)?"""
    noetig = {"rest"} if u == "sanktion" else {"rest"} | SONDERFELDER
    gedeckt = set()
    for bp, bu, fehl, e in BLOECKE:
        if (bp, bu) == (p, u) and gueltig(pfad, d, e.get(d["id"]), u):
            gedeckt |= ({"rest"} | SONDERFELDER) - fehl
    return noetig <= gedeckt


abweichung, uebersicht = [], {"freigegeben": 0, "in_pruefung": 0, "entwurf": 0}
for pfad in sorted(glob.glob(os.path.join(ROOT, "catalog/pflichten/*.yaml"))):
    text = open(pfad, encoding="utf-8").read()
    d = yaml.safe_load(text)
    noetig = BENOETIGT[gebiet(d)]
    passt = [(p, u, frei.get((p, u), {}).get(d["id"])) for p, u in noetig]
    if all(abgedeckt(pfad, d, p, u) for p, u, _ in passt):
        stand = max(f["stand"] for _, _, f in passt)
        block = "pruefung:\n  status: freigegeben\n  geprueft_von:\n" + "".join(f"    - {p}\n" for p, _, _ in passt) + f"  geprueft_am: '{stand}'\n  geprueft_version: {d['version']}\n"
        status = "freigegeben"
    else:
        irgendeine = any(f for _, _, f in passt)
        status = "in_pruefung" if irgendeine else "entwurf"
        block = f"pruefung:\n  status: {status}\n  geprueft_von: null\n  geprueft_am: null\n"
    uebersicht[status] += 1
    neu, n = re.subn(r"^pruefung:.*?(?=^[^\s#-]|\Z)", block, text, count=1, flags=re.M | re.S)
    assert n == 1, d["id"]
    if neu != text:
        abweichung.append(d["id"])
        if not PRUEFEN:
            open(pfad, "w", encoding="utf-8").write(neu)

print(uebersicht, f"geändert: {len(abweichung)}")
if PRUEFEN and abweichung:
    print("Katalog weicht vom Freigabe-Register ab:", ", ".join(abweichung[:20]))
    sys.exit(1)
