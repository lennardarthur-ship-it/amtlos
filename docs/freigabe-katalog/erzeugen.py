"""
Freigabe-Mappen für den Pflichtenkatalog (E-170): je Fachgebiet eine Excel-Datei, in der die prüfende Person jeden Eintrag
freigibt oder eine Änderung vermerkt, plus Prüfvermerk zum Unterschreiben.

    python3 docs/freigabe-katalog/erzeugen.py <ziel>

Zuordnung (eine Person je Eintrag, Hauptzuständigkeit): Steuern -> Steuerberater; Arbeitsschutz -> Fachkraft für
Arbeitssicherheit; Lebensmittelhygiene -> Lebensmittelfachmann; alles andere (Recht) -> Rechtsanwalt.
Nach der Rücksendung: `werkzeuge/freigabe-uebernehmen.py` (folgt) bzw. von Hand `pruefung.status: freigegeben`, `geprueft_von`,
`geprueft_am` je freigegebenem Eintrag.
"""
import glob
import os
import sys

import yaml
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

HIER = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HIER, "../.."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ZIEL = os.path.abspath(ARGS[0] if ARGS else "freigabe-katalog")
# Runde 2: nur noch nicht (in dieser Version) freigegebene Einträge, mit unserer Rückfrage je Eintrag
NUR_OFFEN = "--nur-offen" in sys.argv
IDS = set(sys.argv[sys.argv.index("--ids") + 1].split(",")) if "--ids" in sys.argv else None
NAME = sys.argv[sys.argv.index("--name") + 1] if "--name" in sys.argv else None
RUNDE = int(sys.argv[sys.argv.index("--runde") + 1]) if "--runde" in sys.argv else 2
RUECKFRAGEN = {}
if "--rueckfragen" in sys.argv:
    import json
    RUECKFRAGEN = json.load(open(sys.argv[sys.argv.index("--rueckfragen") + 1], encoding="utf-8"))
os.makedirs(ZIEL, exist_ok=True)

STEUER_GRUENDUNG = {"gruendung.fragebogen_steuerliche_erfassung", "gruendung.ust_idnr"}
ARBEITSSCHUTZ_BRANCHE = {"branche.handwerk_gefaehrdung_gewerk", "branche.bau_baustellenverordnung", "branche.beauty_hautschutzplan"}
LEBENSMITTEL_RECHT = {"branche.gastro_preisverzeichnis", "branche.gastro_mehrweg", "branche.gastro_ppwr_radar"}

PRUEFER = {
    "steuer": ("Steuern", "StB Lutz Busch (Heckler und Busch)"),
    "arbeitsschutz": ("Arbeitsschutz", "Fachkraft für Arbeitssicherheit"),
    "lebensmittel": ("Lebensmittelhygiene", "Tim Baum, Lebensmittelfachbeauftragter"),
    "recht": ("Recht", "RA Dr. Ulrich Weber (Weber & Merz)"),
}


def gebiet(d):
    i, k = d["id"], d["kategorie"]
    if k == "steuern" or i in STEUER_GRUENDUNG:
        return "steuer"
    if k == "arbeitsschutz" or i in ARBEITSSCHUTZ_BRANCHE:
        return "arbeitsschutz"
    if i.startswith("branche.gastro_") and i not in LEBENSMITTEL_RECHT:
        return "lebensmittel"
    return "recht"


def de(x):
    if isinstance(x, dict):
        return x.get("de") or ""
    return "" if x is None else str(x)


def ausloeser(a):
    if not a:
        return ""
    if "label" in a:
        return de(a["label"])
    if a.get("immer"):
        return "gilt für alle Betriebe"
    for art, wort in (("all", " UND "), ("any", " ODER ")):
        if art in a:
            return "(" + wort.join(ausloeser(t) for t in a[art]) + ")"
    if "not" in a:
        return "NICHT " + ausloeser(a["not"])
    if "feld" in a:
        w = a.get("wert")
        if isinstance(w, dict) and "regelwert" in w:
            w = "Regelwert " + w["regelwert"]
        return f"[{a['feld']} {a.get('op', '')} {'' if w is None else w}]".replace("  ", " ")
    return str(a)


def frist(f):
    if not f:
        return ""
    t = f.get("typ")
    if t == "dauerhaft":
        return "laufend (keine feste Frist)"
    teile = [t]
    for k in ("bezug", "versatz", "zeitpunkt", "datum", "termin", "monat", "tag", "rrule"):
        if k in f:
            v = f[k]
            teile.append(f"{k}: {v.get('fakt', v) if isinstance(v, dict) else v}")
    return "; ".join(str(x) for x in teile)


eintraege = []
for pfad in sorted(glob.glob(os.path.join(ROOT, "catalog/pflichten/*.yaml"))):
    d = yaml.safe_load(open(pfad, encoding="utf-8"))
    pr = d.get("pruefung") or {}
    if IDS is not None and d["id"] not in IDS:
        continue
    if NUR_OFFEN and pr.get("status") == "freigegeben" and pr.get("geprueft_version") == d.get("version"):
        continue
    eintraege.append(d)
eintraege.sort(key=lambda d: [int(x) if x.isdigit() else x for x in str(d.get("katalog_nr", "")).replace(".", " ").split()])

KOPF = ["Nr", "ID", "Version", "Titel", "Kurztext", "Erklärung", "Zuständige Stelle", "Wann es gilt (Auslöser)", "Frist", "Rechtsgrundlage", "Folgen bei Verstoß", "Schwere",
        "Rechtsstand", "Quellen", "Offene Fachfragen (unser Vermerk)", "Entscheidung", "Änderung / Anmerkung"]
BREITE = [7, 30, 8, 34, 50, 70, 24, 40, 26, 34, 50, 9, 12, 40, 55, 16, 50]
if RUECKFRAGEN:
    KOPF.insert(13, "Unsere Rückfrage / was wir umgesetzt haben")
    BREITE.insert(13, 60)
GELB = PatternFill("solid", fgColor="FFF4CC")
GRAU = PatternFill("solid", fgColor="EDEDED")

uebersicht = []
for schluessel, (name, person) in PRUEFER.items():
    teil = [d for d in eintraege if gebiet(d) == schluessel] if IDS is None else (eintraege if schluessel == "recht" else [])
    wb = Workbook()
    ws = wb.active
    ws.title = "Einträge"
    ws.append(KOPF)
    for c in ws[1]:
        c.font = Font(bold=True)
        c.fill = GRAU
        c.alignment = Alignment(wrap_text=True, vertical="top")
    for d in teil:
        s = d.get("sanktion") or {}
        quellen = " ".join(q.get("url", "") for q in (d.get("quellen") or []))
        fzp = "\n".join(f"• {t}" for t in (d.get("fachlich_zu_pruefen") or []))
        ws.append([d.get("katalog_nr"), d["id"], d.get("version"), de(d.get("titel")), de(d.get("kurz")), de(d.get("erklaerung")), de(d.get("stelle")), ausloeser(d.get("ausloeser")),
                   frist(d.get("frist")), "; ".join(d.get("rechtsgrundlage") or []), de(s.get("text")), s.get("schwere", ""),
                   d.get("status_recht", ""), quellen, fzp] + ([RUECKFRAGEN.get(d["id"], "")] if RUECKFRAGEN else []) + ["", ""])
    for i, b in enumerate(BREITE, start=1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = b
    for zeile in ws.iter_rows(min_row=2):
        for c in zeile:
            c.alignment = Alignment(wrap_text=True, vertical="top")
        zeile[-2].fill = GELB
        zeile[-1].fill = GELB
    dv = DataValidation(type="list", formula1='"freigegeben,ändern,streichen"', allow_blank=True)
    ws.add_data_validation(dv)
    if teil:
        sp = ws.cell(1, len(KOPF) - 1).column_letter
        dv.add(f"{sp}2:{sp}{len(teil) + 1}")
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = ws.dimensions

    hw = wb.create_sheet("So geht's")
    for zeile in [
        [f"Freigabe Pflichtenkatalog Betriebsklar – {name}"],
        [""],
        ["Betriebsklar (iPhone-App, Lang Ventures UG (haftungsbeschränkt) i. G.) zeigt kleinen Betrieben aus einem festen Katalog, welche Pflichten typischerweise gelten (regelbasiert, keine KI, keine Einzelfallprüfung)."],
        [f"Diese Datei enthält die {len(teil)} noch offenen Einträge Ihres Fachgebiets (Runde {RUNDE}). Alle anderen sind nach Ihrer ersten Rückmeldung umgesetzt und freigegeben. In der Spalte „Unsere Rückfrage“ steht je Eintrag, was wir umgesetzt haben, wo wir nach dem Gesetzeswortlaut von Ihrem Hinweis abweichen oder was neu ist. Bitte je Zeile in der gelben Spalte „Entscheidung“ wählen: freigegeben / ändern / streichen."] if NUR_OFFEN else [f"Diese Datei enthält die {len(teil)} Einträge Ihres Fachgebiets. Bitte je Zeile in der gelben Spalte „Entscheidung“ wählen: freigegeben / ändern / streichen, bei „ändern“ die Änderung daneben eintragen."],
        ["Die Spalte „Folgen bei Verstoß“ haben wir am 22.10.2026 vorab aus dem Gesetzeswortlaut ergänzt (Fundstelle steht dabei; Vermerk in „Offene Fachfragen“). Bitte besonders hier prüfen."],
        ["„Offene Fachfragen“ sind unsere eigenen Zweifel zum Eintrag – bitte beantworten oder als erledigt markieren."],
        ["Geprüft wird: Rechtsgrundlage, Auslöser (für wen gilt es), Frist, Folgen, Kurztext in einfacher Sprache. Die App formuliert bedingt („gilt typischerweise, wenn …“) und verweist auf Beratung."],
        ["Nach der Rücksendung tragen wir je freigegebenem Eintrag Ihren Namen und das Datum ein; der Hinweis „fachlich noch nicht geprüft“ entfällt dann für diesen Eintrag."],
        ["Bitte am Ende das Blatt „Prüfvermerk“ ausfüllen und unterschreiben (Scan genügt)."],
    ]:
        hw.append(zeile)
    hw.column_dimensions["A"].width = 140
    hw["A1"].font = Font(bold=True, size=13)
    for r in hw.iter_rows():
        for c in r:
            c.alignment = Alignment(wrap_text=True, vertical="top")

    pv = wb.create_sheet("Prüfvermerk")
    for zeile in [
        ["Prüfvermerk"],
        [""],
        [f"Ich habe die {len(teil)} Einträge im Blatt „Einträge“ fachlich geprüft. Mit „freigegeben“ markierte Einträge sind in Rechtsgrundlage, Auslöser, Frist und Folgen zutreffend; für „ändern“ gelten meine Anmerkungen."],
        ["Stand der Prüfung (Datum):", ""],
        ["Name, Funktion:", person],
        ["Ort, Datum, Unterschrift:", ""],
        [""],
        ["Darf Betriebsklar in der App bei den freigegebenen Einträgen angeben „fachlich geprüft von <Name>, <Funktion> (Stand <Datum>)“?", "ja / nein / anderer Wortlaut:"],
    ]:
        pv.append(zeile)
    pv.column_dimensions["A"].width = 90
    pv.column_dimensions["B"].width = 50
    pv["A1"].font = Font(bold=True, size=13)
    for r in pv.iter_rows():
        for c in r:
            c.alignment = Alignment(wrap_text=True, vertical="top")

    if not teil:
        continue
    if NAME:
        name = NAME
    if "--person" in sys.argv:
        person = sys.argv[sys.argv.index("--person") + 1]
    datei = f"Betriebsklar-Freigabe-Katalog-{name.replace(' ', '')}{f'-Runde{RUNDE}' if NUR_OFFEN else ''}.xlsx"
    wb.save(os.path.join(ZIEL, datei))
    offen = sum(1 for d in teil if "noch nicht fachlich erfasst" in de((d.get("sanktion") or {}).get("text")))
    uebersicht.append((name, person, len(teil), offen, datei))

with open(os.path.join(ZIEL, "UEBERSICHT.md"), "w", encoding="utf-8") as f:
    f.write("# Freigabe Pflichtenkatalog – Übersicht\n\n| Fachgebiet | Prüfer | Einträge | davon Folgen noch offen | Datei |\n|---|---|---|---|---|\n")
    for z in uebersicht:
        f.write("| " + " | ".join(str(x) for x in z) + " |\n")
    f.write(f"\nGesamt: {len(eintraege)} Einträge.\n")
for z in uebersicht:
    print(*z, sep=" | ")
