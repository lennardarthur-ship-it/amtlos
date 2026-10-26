"""
E-211: Zurückgeschickte Prüfliste der Regelwerte (scripts/regelwerte-pruefpaket.py) in einem Schritt eintragen: Block im
Register docs/freigabe-katalog/freigaben-regelwerte.yaml (Nachweis ohne Namen, E-197 bis E-199) und `pruefung` der
Regelwert-Versionen im Katalog (wie anwenden.py), danach das Bündel der App.

    python3 docs/freigabe-katalog/regelwerte-uebernehmen.py <rücklauf.xlsx> --art mail --datum JJJJ-MM-TT [--mit-anmerkung id1,id2]
        [--umfang "…"] [--probe]

- Die Rolle ergibt sich aus der Datei (Titel der Anleitung) und muss zu jedem Regelwert passen (regelwerte.rolle).
- Übernommen werden Zeilen mit Ergebnis „richtig“, deren ID, Version und „Wert + Einheit“ noch dem Katalog entsprechen
  (sonst hat sich der Wert seit dem Versand geändert → neu vorlegen). Zeilen mit Anmerkung nur, wenn ihre ID in
  --mit-anmerkung steht (Anmerkung gelesen, nichts zu ändern).
- „falsch → …“: nichts wird geändert; die Zeilen werden aufgelistet (Wert als neue Version anlegen, erneut vorlegen).
- --art: mail (Bestätigung per Mail; Stand = Datum der Mail), blatt (ausgefüllte Datei) oder bericht. --probe schreibt nichts.
"""
import os
import re
import subprocess
import sys

import openpyxl

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import regelwerte as rw  # noqa: E402

ARG = sys.argv[1:]


def opt(name, standard=None):
    return ARG[ARG.index(name) + 1] if name in ARG else standard


if not ARG or ARG[0].startswith("--"):
    raise SystemExit(__doc__)
mappe, art, datum = ARG[0], opt("--art"), opt("--datum")
assert art in rw.ZAEHLT, "--art mail, blatt oder bericht"
assert datum and re.fullmatch(r"\d{4}-\d{2}-\d{2}", datum), "--datum JJJJ-MM-TT"
mit_anmerkung = {x.strip() for x in (opt("--mit-anmerkung", "") or "").split(",") if x.strip()}
PROBE = "--probe" in ARG

wb = openpyxl.load_workbook(mappe)
titel = str(wb["Anleitung"]["A1"].value or "")
rolle = next((r for r, name in rw.ROLLEN.items() if titel.endswith(name)), None)
assert rolle, f"Rolle aus dem Titel „{titel}“ nicht erkannt"
ws = wb["Regelwerte"]
kopf = [str(c.value or "") for c in ws[1]]
spalte = {k: kopf.index(k) for k in ("ID", "Version", "Wert + Einheit", "Anmerkung")}
spalte["Ergebnis"] = next(i for i, k in enumerate(kopf) if k.startswith("Ergebnis"))
katalog = {(d["id"], d["version"]): d for _, d in rw.laden()}

richtig, falsch, offen, abweichend, anmerkung = [], [], [], [], []
for z in ws.iter_rows(min_row=2, values_only=True):
    rid = z[spalte["ID"]]
    if not rid:
        continue
    ver, wert = z[spalte["Version"]], str(z[spalte["Wert + Einheit"]] or "")
    erg, anm = str(z[spalte["Ergebnis"]] or "").strip(), str(z[spalte["Anmerkung"]] or "").strip()
    d = katalog.get((rid, ver))
    if not erg:
        offen.append(rid)
    elif erg.lower().startswith("falsch"):
        falsch.append((rid, ver, wert, erg, anm))
    elif not erg.lower().startswith("richtig"):
        offen.append(f"{rid} (Ergebnis „{erg}“ unklar)")
    elif not d or rw.wert_text(d["wert"], d.get("einheit", "")) != wert:
        abweichend.append(f"{rid}@{ver}")
    elif rw.rolle(rid) != rolle:
        abweichend.append(f"{rid}@{ver} (gehört zur Rolle {rw.rolle(rid)})")
    elif anm and rid not in mit_anmerkung:
        anmerkung.append((rid, anm))
    else:
        richtig.append((rid, ver))

print(f"{rw.ROLLEN[rolle]}: {len(richtig)} richtig, {len(falsch)} falsch, {len(anmerkung)} mit Anmerkung, {len(abweichend)} abweichend, {len(offen)} ohne Ergebnis")
for rid, ver, wert, erg, anm in falsch:
    print(f"  falsch: {rid}@{ver} ({wert}) – {erg}{' – ' + anm if anm else ''}  → Wert als neue Version anlegen und erneut vorlegen")
for rid, anm in anmerkung:
    print(f"  Anmerkung lesen: {rid} – {anm}  → ohne Änderung übernehmen mit --mit-anmerkung {rid}")
for x in abweichend:
    print(f"  nicht übernommen (Wert, Version oder Rolle passt nicht mehr zum Katalog): {x}")
if not richtig:
    raise SystemExit("Nichts zu übernehmen.")

# Register: neuer Block (mehrere Versionen derselben ID → je Version ein Block)
umfang = opt("--umfang", f"Regelwerte laut Prüfliste mit Ergebnis „richtig“ ({len(richtig)} Werte)")
assert "\n" not in umfang
gruppen = []
for rid, ver in richtig:
    for g in gruppen:
        if rid not in g:
            g[rid] = ver
            break
    else:
        gruppen.append({rid: ver})
quelle = "Bestätigung per Mail zur ausgefüllten Prüfliste Regelwerte (beim Gründer)" if art == "mail" else "ausgefüllte Prüfliste Regelwerte (beim Gründer)"
text = ""
for g in gruppen:
    text += (f"- pruefer: {rolle}\n  umfang: alles\n  nachweis:\n    art: {art}\n    datum: '{datum}'\n    rolle: {rolle}\n"
             f"    umfang: {umfang}\n    aufbewahrung: beim Gründer\n  eintraege:\n")
    for rid, ver in g.items():
        text += f"    {rid}:\n      version: {ver}\n      stand: '{datum}'\n      quelle: {quelle}\n"
if PROBE:
    print(text)
    raise SystemExit(0)
alt = open(rw.REGISTER, encoding="utf-8").read()
neu = re.sub(r"^\[\]\s*$", "", alt, flags=re.M).rstrip("\n") + "\n" + text
open(rw.REGISTER, "w", encoding="utf-8").write(neu)

import anwenden  # noqa: E402  (prüft das ganze Register und schreibt die pruefung-Zeilen der Regelwerte)
uebersicht, geaendert, fehler = rw.anwenden(True, anwenden.nachweis_pruefen)
if fehler:
    open(rw.REGISTER, "w", encoding="utf-8").write(alt)
    rw.anwenden(True, anwenden.nachweis_pruefen)
    raise SystemExit("Register fehlerhaft, nichts übernommen:\n  " + "\n  ".join(fehler))
print("Regelwerte:", uebersicht, "geändert:", ", ".join(geaendert))
try:
    subprocess.run(["node", os.path.join(rw.ROOT, "apps/mobile/werkzeuge/katalog-buendel.mjs")], check=True)
except (subprocess.CalledProcessError, FileNotFoundError):
    print("Bündel der App bitte neu erzeugen: pnpm build && node apps/mobile/werkzeuge/katalog-buendel.mjs")
print("Danach: python3 docs/freigabe-katalog/anwenden.py --pruefen, node apps/mobile/werkzeuge/store-check.mjs")
