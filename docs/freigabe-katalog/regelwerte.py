"""
E-211: Fachliche Prüfung der Regelwerte (catalog/regelwerte/*.yaml – Schwellen, Beträge, Sätze, Fristen in Jahren).

Wie bei Pflichten gilt ein Regelwert nur in der Version als geprüft, die der Prüfer bestätigt hat (`pruefung.status:
freigegeben`, `geprueft_von`, `geprueft_am`, `geprueft_version`, `bestaetigt_am`; apps/mobile/src/pflichten/pruefer.ts
`regelwertBestaetigt`). Nachweis ist allein das Register docs/freigabe-katalog/freigaben-regelwerte.yaml – gleicher Aufbau
wie freigaben.yaml (Block je Rolle mit `nachweis`: art, datum, rolle, umfang, aufbewahrung „beim Gründer“; je Eintrag
version, stand, quelle), ohne Namen, ohne Dateiverweis (E-197 bis E-199). anwenden.py schreibt daraus den pruefung-Block
jeder Regelwert-Version; regelwerte-uebernehmen.py trägt eine zurückgeschickte Prüfliste in einem Schritt ein.

Zuständige Rolle: Steuern (steuern.*, Minijob-Grenze) → Steuerberater; Arbeitsschutz → Fachkraft für Arbeitssicherheit;
alles andere (Gesellschafts-, Datenschutz-, Online-, Arbeits- und Branchenrecht) → Rechtsanwalt.
"""
import glob
import os
import re

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
REGISTER = os.path.join(ROOT, "docs/freigabe-katalog/freigaben-regelwerte.yaml")
ROLLEN = {"steuern": "Steuerberater", "recht": "Rechtsanwalt", "arbeitsschutz": "Fachkraft für Arbeitssicherheit"}
ZAEHLT = {"mail", "blatt", "bericht"}


def rolle(rid):
    """Rolle, die einen Regelwert fachlich bestätigt."""
    if rid.startswith("steuern.") or rid.startswith("personal.minijob."):
        return "steuern"
    if rid.startswith("arbeitsschutz."):
        return "arbeitsschutz"
    return "recht"


def laden():
    """Alle Regelwert-Versionen: Liste von (Pfad, Daten) in Dateireihenfolge."""
    out = []
    for pfad in sorted(glob.glob(os.path.join(ROOT, "catalog/regelwerte/*.yaml"))):
        for d in yaml.safe_load(open(pfad, encoding="utf-8")) or []:
            out.append((pfad, d))
    return out


def register():
    r = yaml.safe_load(open(REGISTER, encoding="utf-8")) if os.path.exists(REGISTER) else None
    return r or []


def verweise(o, ids=None):
    """IDs aller `{ regelwert: id }` in einem Objekt (Reihenfolge, ohne Doppelungen)."""
    ids = [] if ids is None else ids
    if isinstance(o, list):
        for x in o:
            verweise(x, ids)
    elif isinstance(o, dict):
        if isinstance(o.get("regelwert"), str) and o["regelwert"] not in ids:
            ids.append(o["regelwert"])
        for x in o.values():
            verweise(x, ids)
    return ids


def de(x):
    return x.get("de", "") if isinstance(x, dict) else ("" if x is None else str(x))


def wert_text(wert, einheit):
    """Wert mit Einheit wie in der App (pruefer.ts `regelwertText`)."""
    if einheit == "kalenderjahr":  # E-213: Jahreszahl ohne Tausenderpunkt
        return str(int(wert)) if float(wert).is_integer() else str(wert)
    ganz, _, rest = f"{round(wert, 2):.2f}".partition(".")
    z = re.sub(r"\B(?=(\d{3})+(?!\d))", ".", ganz) + ("" if rest == "00" else "," + rest)
    eins = wert == 1
    return {"EUR": f"{z} €", "EUR_pro_stunde": f"{z} € je Stunde", "EUR_pro_monat": f"{z} € im Monat", "prozent": f"{z} %",
            "jahre": f"{z} {'Jahr' if eins else 'Jahre'}", "monate": f"{z} {'Monat' if eins else 'Monate'}",
            "tage": f"{z} {'Tag' if eins else 'Tage'}"}.get(einheit, z)


# Verwendung außerhalb des Katalogs (Code), damit Prüfer sehen, wo ein Wert sonst wirkt
CODE_VERWENDUNG = {
    "steuern.aufbewahrung.belege_jahre": "App: Aufbewahrungsfrist im Hinweis beim Löschen von Belegen und aller Daten",
    "steuern.ust.satz_regel": "Server-API Finanzen: Umsatzsteuersatz für Rechnungen (nicht in der App)",
    "steuern.ust.satz_ermaessigt": "Server-API Finanzen: Umsatzsteuersatz für Rechnungen (nicht in der App)",
    "steuern.ustg19.grenze_laufendes_jahr": "Server-API Finanzen: Warnung zur Kleinunternehmergrenze (nicht in der App)",
    "steuern.ustg19.grenze_gruendungsjahr": "Server-API Finanzen: Warnung zur Kleinunternehmergrenze (nicht in der App)",
}


# Text-Erwähnung: Wert steht im Text einer Pflicht zum selben Thema (Thema je Regelwert über die ID der Pflicht, damit
# gleiche Zahlen anderer Themen – z. B. 25.000 € Stammkapital und Kleinunternehmergrenze – nicht vermischt werden)
THEMA = {
    "steuern.ustg19.": r"kleinunternehmer", "steuern.ust_va.": r"steuern\.ust_", "steuern.ao141.": r"buchfuehrung|e_bilanz|euer|jahresabschluss",
    "steuern.hgb241a.": r"buchfuehrung|e_bilanz|euer|jahresabschluss", "steuern.e_rechnung.": r"e_rechnung", "steuern.aufbewahrung.": r"aufbewahrung",
    "gesellschaft.gmbh.stammkapital": r"gesellschaftsvertrag|stammkapital|ug_ruecklage", "gesellschaft.ug.stammkapital": r"gesellschaftsvertrag|stammkapital",
    "gesellschaft.gmbh.mindesteinzahlung": r"stammkapital", "gesellschaft.ug.ruecklage": r"ug_ruecklage",
    "personal.mindestlohn.": r"mindestlohn", "personal.minijob.": r"minijob|rentenversicherung",
    "branche.gewaehrleistung.": r"gewaehrleistung", "datenschutz.dsb.": r"datenschutz\.dsb", "online.vsbg.": r"vsbg", "online.bfsg.": r"barrierefrei",
    "personal.schwerbehinderte.": r"schwerbehindert", "personal.hinschg.": r"hinweisgeber", "personal.entgelttransparenz.": r"entgelttransparenz",
    "arbeitsschutz.ersthelfer.": r"erste_hilfe|ersthelfer",
}


def verwendung(pflichten):
    """Je Regelwert-ID: Liste (art, pflicht_id, titel) mit art ∈ Auslöser, Frist, Text (Wert im Text einer Pflicht zum Thema)."""
    je = {}
    werte = {d["id"]: d for _, d in laden()}
    for p in pflichten:
        for teil, art in (("ausloeser", "Auslöser"), ("frist", "Frist")):
            for rid in verweise(p.get(teil)):
                je.setdefault(rid, []).append((art, p["id"], de(p.get("titel"))))
        text = " ".join(de(p.get(k)) for k in ("titel", "kurz", "erklaerung"))
        for rid, d in werte.items():
            thema = next((t for k, t in THEMA.items() if rid.startswith(k)), None)
            # Anzahlen (z. B. „2“, „20“) sind im Text nicht eindeutig zu finden – nur über Auslöser und Frist
            if not thema or d.get("einheit") == "anzahl" or not re.search(thema, p["id"]) or any(x[1] == p["id"] for x in je.get(rid, [])):
                continue
            w = wert_text(d["wert"], "EUR" if d.get("einheit", "").startswith("EUR") else d.get("einheit", ""))
            if re.search(r"(?<![\d.,])" + re.escape(w), text):
                je.setdefault(rid, []).append(("Text", p["id"], de(p.get("titel"))))
    return je


def pflichten_laden():
    return [yaml.safe_load(open(f, encoding="utf-8")) for f in sorted(glob.glob(os.path.join(ROOT, "catalog/pflichten/*.yaml")))]


def bloecke_pruefen(bloecke, nachweis_pruefen):
    """Register prüfen: Rolle passt zum Regelwert, Nachweis vollständig (gleiche Regeln wie freigaben.yaml), Version vorhanden."""
    fehler = []
    versionen = {}
    for _, d in laden():
        versionen.setdefault(d["id"], set()).add(d["version"])
    for b in bloecke:
        if b.get("pruefer") not in ROLLEN:
            fehler.append(f"freigaben-regelwerte.yaml: unbekannte Rolle {b.get('pruefer')}")
            continue
        if set(b) - {"pruefer", "umfang", "nachweis", "hinweis", "eintraege"}:
            fehler.append(f"freigaben-regelwerte.yaml: unbekannte Felder {sorted(set(b))}")
        if b.get("umfang") != "alles":
            fehler.append(f"freigaben-regelwerte.yaml: Block {b['pruefer']} – umfang muss „alles“ sein")
        try:
            nachweis_pruefen(b)
        except AssertionError as e:
            fehler.append(str(e).replace("freigaben.yaml", "freigaben-regelwerte.yaml"))
        for rid, f in (b.get("eintraege") or {}).items():
            if rid not in versionen:
                fehler.append(f"freigaben-regelwerte.yaml: {rid} gibt es nicht in catalog/regelwerte")
            elif f.get("version") not in versionen[rid]:
                fehler.append(f"freigaben-regelwerte.yaml: {rid} v{f.get('version')} gibt es nicht")
            if rolle(rid) != b["pruefer"]:
                fehler.append(f"freigaben-regelwerte.yaml: {rid} bestätigt die Rolle {rolle(rid)}, nicht {b['pruefer']}")
    return fehler


def block_fuer(d, bloecke):
    """pruefung-Zeile (Flow-Stil wie im Katalog) und Status einer Regelwert-Version aus dem Register."""
    r = rolle(d["id"])
    treffer = [(b, b["eintraege"][d["id"]]) for b in bloecke if b.get("pruefer") == r and d["id"] in (b.get("eintraege") or {})
               and (b["eintraege"][d["id"]] or {}).get("version") == d["version"]]
    gezaehlt = [(str(b["nachweis"]["datum"]), str(f["stand"])) for b, f in treffer if (b.get("nachweis") or {}).get("art") in ZAEHLT]
    if gezaehlt:
        am, stand = max(gezaehlt)
        return "freigegeben", (f'{{ status: freigegeben, geprueft_von: [{r}], geprueft_am: "{stand}", geprueft_version: {d["version"]}, '
                               f'bestaetigt_am: "{am}" }}')
    status = "in_pruefung" if treffer else "entwurf"
    return status, f"{{ status: {status}, geprueft_von: null, geprueft_am: null }}"


def anwenden(schreiben, nachweis_pruefen):
    """Register → pruefung-Zeilen in catalog/regelwerte. Gibt (Übersicht, geänderte Versionen, Fehler) zurück."""
    bloecke = register()
    fehler = bloecke_pruefen(bloecke, nachweis_pruefen)
    uebersicht, geaendert = {"freigegeben": 0, "in_pruefung": 0, "entwurf": 0}, []
    for pfad in sorted(glob.glob(os.path.join(ROOT, "catalog/regelwerte/*.yaml"))):
        daten = {(d["id"], d["version"]): d for d in yaml.safe_load(open(pfad, encoding="utf-8")) or []}
        zeilen = open(pfad, encoding="utf-8").read().split("\n")
        rid = ver = None
        for i, z in enumerate(zeilen):
            m = re.match(r"^ {2}id: (\S+)$", z)
            if m:
                rid = m.group(1)
            m = re.match(r"^ {2}version: (\d+)$", z)
            if m:
                ver = int(m.group(1))
            if z.startswith("  pruefung:"):
                d = daten[(rid, ver)]
                status, block = block_fuer(d, bloecke)
                uebersicht[status] += 1
                neu = f"  pruefung: {block}"
                if neu != z:
                    geaendert.append(f"{rid}@{ver}")
                    zeilen[i] = neu
                rid = ver = None
        if schreiben:
            text = "\n".join(zeilen)
            if text != open(pfad, encoding="utf-8").read():
                open(pfad, "w", encoding="utf-8").write(text)
    return uebersicht, geaendert, fehler
