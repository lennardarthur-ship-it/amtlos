"""
Freigaben aus dem Register (docs/freigabe-katalog/freigaben.yaml) in den Katalog schreiben (E-173, E-196, E-197, E-199).

    python3 docs/freigabe-katalog/anwenden.py            # schreibt pruefung-Blöcke, druckt Übersicht
    python3 docs/freigabe-katalog/anwenden.py --pruefen  # schreibt nichts, Exit 1 wenn der Katalog vom Register abweicht
    python3 docs/freigabe-katalog/anwenden.py --bericht  # zusätzlich: je Eintrag, was ohne schriftliche Bestätigung freigegeben ist

E-211: ebenso die Regelwerte (catalog/regelwerte) aus docs/freigabe-katalog/freigaben-regelwerte.yaml (regelwerte.py).

Regel: Eine Freigabe gilt nur für die Fassung (Version), die der Prüfer gesehen hat. Ein Eintrag ist freigegeben, wenn
für seinen Bereich alle nötigen Freigaben zur aktuellen Version passen UND schriftlich bestätigt sind:
- Recht → `recht` (Rechtsanwalt); Steuern → `steuern` (Steuerberater); Arbeitsschutz → `arbeitsschutz` (Sifa);
- Lebensmittel → `hygiene` (Lebensmittelfachbeauftragter, Inhalt ohne Folgen) UND `recht` (nur Folgen bei Verstoß).
Schriftlich bestätigt (E-197) heißt: Der Block hat einen `nachweis` mit `art`, `datum` (Tag der Bestätigung), `rolle`
(= `pruefer`), `umfang` (was bestätigt ist, in unseren Worten) und `aufbewahrung: beim Gründer`. E-198/E-199: Das
Repository enthält keine Unterlagen der Prüfer (keine Mails, Berichte, ausgefüllten Dateien oder Bestätigungsblätter) und
keine Namen – Register und packages/fachlogik/src/dokumente/geprueft.ts sind der einzige Nachweis im Projekt, ohne Zitat
und ohne Dateiverweis; die Unterlagen bewahrt der Gründer auf.
- `art: mail` – Bestätigung des Prüfers per E-Mail (Textform); der Stand im Vermerk ist das Datum der Mail;
- `art: blatt` – vom Prüfer ausgefüllte Freigabe- bzw. Abgleich-Datei (Spalte Entscheidung) bzw. das unterschriebene
  Blatt, das auf Wunsch des Gründers am 25.10.2026 aus dem Projekt entfernt wurde (E-197; `umfang` sagt es);
- `art: bericht` – schriftlicher Bericht des Prüfers;
- `art: ersetzt` oder `offen` zählt nicht.
Das Datum im Vermerk (`geprueft_am`) liegt nie nach `datum`. Der pruefung-Block trägt `bestaetigt_am`.
Bei Teil-Umfängen („ohne_sanktion“ / „sanktion“) bleibt eine Freigabe gültig, wenn sich seit der freigegebenen Version
nur Felder außerhalb ihres Umfangs geändert haben (Vergleich mit der Fassung aus der git-Historie).
Einschränkungen des Prüfers je Eintrag (`einschraenkung`, z. B. „ohne arbeitsmedizinische Angaben“) und offene
Prüfpunkte (docs/freigabe-katalog/offene-punkte.yaml) kommen in den pruefung-Block; die App zeigt sie im Vermerk.
Alles andere wird `in_pruefung` (zuvor oder ohne schriftliche Bestätigung freigegeben) bzw. bleibt `entwurf`. Die App zeigt
„geprüft“ nur bei `geprueft_version == version` (apps/mobile/src/pflichten/pruefer.ts).

`--pruefen` prüft außerdem: Register vollständig (je Block art, datum, rolle, umfang, aufbewahrung; je Eintrag version,
stand, quelle; keine unbekannten Felder, kein Dateiverweis), kein Stand nach der Bestätigung, jede Version im Register
gibt es im Katalog (nicht neuer als dort); je Vorlagen-Freigabe in geprueft.ts Nachweis mit Datum = `bestaetigt_am`,
passender Rolle und Aufbewahrung, Prüfsumme = SHA-256 über die freigegebenen Teilsummen (geprueft-teilsummen.ts), heutiger
Prüfstand vorhanden (pruefstaende.ts); keine Prüfunterlagen und keine Namen im Repository (namen-sha256.json).
"""
import glob
import json
import os
import re
import subprocess
import sys

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
PRUEFEN = "--pruefen" in sys.argv
BERICHT = "--bericht" in sys.argv

STEUER_GRUENDUNG = {"gruendung.fragebogen_steuerliche_erfassung", "gruendung.ust_idnr",
                    # Steuerberater 23.10.2026: Jahresabschluss der OHG, KG und e. K. (sein Vorschlag, er sieht ihn durch)
                    "gesellschaft.jahresabschluss_personenhandel"}
# E-195: elektronische Lohnsteuerbescheinigung (§ 41b EStG, § 93c AO) ist Steuerrecht – Steuerberater, obwohl Kategorie „personal“
STEUER_PERSONAL = {"personal.lohnsteuerbescheinigung"}
ARBEITSSCHUTZ_BRANCHE = {"branche.handwerk_gefaehrdung_gewerk", "branche.bau_baustellenverordnung", "branche.beauty_hautschutzplan", "branche.gastro_schankanlage_fluessiggas"}
LEBENSMITTEL_RECHT = {"branche.gastro_preisverzeichnis", "branche.gastro_mehrweg", "branche.gastro_ppwr_radar", "branche.gastro_einwegkunststofffonds"}
# Rollen statt Personen (E-196): Schlüssel in freigaben.yaml und in `pruefung.geprueft_von`
RECHT, STEUERN, SIFA, LMH = "recht", "steuern", "arbeitsschutz", "hygiene"
ROLLEN = {RECHT: "Rechtsanwalt", STEUERN: "Steuerberater", SIFA: "Fachkraft für Arbeitssicherheit", LMH: "Lebensmittelfachbeauftragter"}
# E-233: `nicht_vor_freigabe` steuert nur, ob ein Entwurf schon im Bündel der App steht – kein Inhalt
NICHT_VERGLICHEN = {"version", "pruefung", "fachlich_zu_pruefen", "aenderungsnotiz", "nicht_vor_freigabe"}
# Wörter in `fachlich_zu_pruefen`, die eine weitere fachliche Prüfung verlangen – jeder solche Punkt muss in
# offene-punkte.yaml als offen oder erledigt eingeordnet sein (E-196)
OFFEN_STICHWORTE = [r'bestätigen lassen', r'bitte ganz prüfen', r'bitte prüfen', r'Nummer und Höhe bestätigen', r'Betriebsarzt',
                    r'gegen das Amtsblatt', r'gegenlesen', r'nicht am Wortlaut gelesen', r'nicht gelesen\)', r'Tatbestände nicht gelesen',
                    r'nicht geprüft', r'ausstehend', r'\bOffen:', r'weiterhin offen', r'nötig\?', r'erneut vorlegen', r'vor de[mn] Launch',
                    r'nach Verkündung', r'nach Umsetzungsgesetz', r'fachlich festlegen', r'fachlich erstellen', r'fachlich prüfen',
                    r'fachlich zu bestätigen', r'nicht ergänzt', r'Platzhalter', r'nicht bestätigt', r'prüfen\)?$', r'am Wortlaut prüfen',
                    r'bitte .*prüfen', r'nicht wie angegeben übernommen', r'Höhe .*nicht g', r'erneut prüfen']
TECHNIK = [r'\(Technik', r'Technik\)']

# E-174: arbeitsmedizinische Vorsorge (ArbMedVV) prüft der Rechtsanwalt rechtlich – die Sifa hat sie als ärztliches Fachgebiet abgegeben
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


BENOETIGT = {"recht": [(RECHT, "alles")], "steuer": [(STEUERN, "alles")], "arbeitsschutz": [(SIFA, "alles")],
             "lebensmittel": [(LMH, "ohne_sanktion"), (RECHT, "sanktion")]}

register = yaml.safe_load(open(os.path.join(ROOT, "docs/freigabe-katalog/freigaben.yaml"), encoding="utf-8"))


ZAEHLT = {"mail", "blatt", "bericht"}
ARTEN = ZAEHLT | {"ersetzt", "offen"}
NACHWEIS_FELDER = {"art", "datum", "rolle", "umfang", "aufbewahrung"}
EINTRAG_FELDER = {"version", "stand", "quelle", "einschraenkung"}
AUFBEWAHRUNG = "beim Gründer"
# E-198/E-199: keine Mails, Berichte, ausgefüllten Dateien oder Bestätigungsblätter der Prüfer im Repository – und kein
# Verweis auf eine solche Datei im Register oder in geprueft.ts
MAILDATEI = re.compile(r"(\.eml|\.msg|\.mbox|mail[^/]*\.txt)$", re.I)
DATEIVERWEIS = re.compile(r"docs/pruefberichte|versand-|freigabe-vorlagen/|\.(xlsx|xls|pdf|eml|msg|jpe?g|png|txt|md|docx?)\b", re.I)
UNTERLAGEN_ORDNER = ("docs/pruefberichte/", "docs/freigabe-katalog/versand-")
UNTERLAGEN_ENDUNG = re.compile(r"\.(xlsx|xls|xlsm|pdf|eml|msg|mbox|docx?|odt|ods)$", re.I)  # im ganzen Repository
SCAN_ENDUNG = re.compile(r"\.(jpe?g|png|heic|tiff?)$", re.I)  # unter docs/ (Scans)
# Texte zur Prüfung: hier zählen auch Namen, die zugleich gewöhnliche Wörter sind („mehrdeutig“ in namen-sha256.json)
PRUEFTEXTE = ("docs/freigabe-katalog/freigaben.yaml", "docs/freigabe-katalog/offene-punkte.yaml", "packages/fachlogik/src/dokumente/geprueft.ts",
              "apps/mobile/src/pflichten/pruefer.ts", "docs/freigabe-katalog/freigaben-regelwerte.yaml")


def bestaetigt(r):
    """Tag der schriftlichen Bestätigung, wenn der Block einen zählenden Nachweis hat (E-197) – sonst None."""
    n = r.get("nachweis") or {}
    return str(n["datum"]) if n.get("art") in ZAEHLT else None


def nachweis_pruefen(r):
    """E-198/E-199: Jeder Block hat einen Nachweis mit art, datum, rolle, umfang und aufbewahrung – ohne Dateiverweis und
    ohne Zitat; jeder Eintrag hat version, stand und quelle und liegt nicht nach der Bestätigung (bei Mail: ihr Datum)."""
    n = r.get("nachweis") or {}
    wo = f"freigaben.yaml: Block {r['pruefer']}/{r['umfang']}"
    for k in ("art", "datum", "rolle", "umfang", "aufbewahrung"):
        assert n.get(k), f"{wo}: nachweis ohne {k}"
    assert set(n) <= NACHWEIS_FELDER, f"{wo}: unbekannte Felder im nachweis {sorted(set(n) - NACHWEIS_FELDER)} (keine Datei, kein Zitat – E-199)"
    assert n["art"] in ARTEN, f"{wo}: unbekannte Art {n['art']}"
    assert n["rolle"] == r["pruefer"], f"{wo}: nachweis.rolle {n['rolle']} passt nicht"
    assert n["aufbewahrung"] == AUFBEWAHRUNG, f"{wo}: aufbewahrung muss „{AUFBEWAHRUNG}“ sein (E-199)"
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(n["datum"])), f"{wo}: nachweis.datum {n['datum']}"
    for k in ("umfang", "hinweis", "felder_hinweis"):
        x = str(n.get(k, "")) + " " + str(r.get(k, ""))
        assert not DATEIVERWEIS.search(x), f"{wo}: {k} verweist auf eine Datei (E-199)"
    am = bestaetigt(r)
    for i, f in r["eintraege"].items():
        assert set(f) <= EINTRAG_FELDER, f"freigaben.yaml: {i} – unbekannte Felder {sorted(set(f) - EINTRAG_FELDER)} (kein Zitat – E-198)"
        assert isinstance(f.get("version"), int) and f.get("stand") and f.get("quelle"), f"freigaben.yaml: {i} – version, stand und quelle nötig"
        assert not DATEIVERWEIS.search(str(f["quelle"])), f"freigaben.yaml: {i} – Quelle verweist auf eine Datei (E-199): {f['quelle']}"
        assert str(f["stand"]) <= str(n["datum"]) or not am, f"freigaben.yaml: {i} Stand {f['stand']} nach der Bestätigung {n['datum']}"
        if n["art"] == "mail":
            assert str(f["stand"]) == am, f"freigaben.yaml: {i} Stand {f['stand']} ist nicht das Datum der Mail {am}"


def _woerter(text):
    w = re.findall(r"[a-zäöüß]+", text.lower())
    return w, [f"{a} {b}" for a, b in zip(w, w[1:])]


def keine_pruefunterlagen():
    """E-198/E-199: keine Unterlagen von oder für Prüfer im Repository (Mails, Berichte, ausgefüllte Dateien, Pakete) und
    kein Name eines Prüfers (Abgleich über SHA-256, namen-sha256.json)."""
    import hashlib
    dateien = [d for d in subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=ROOT, capture_output=True, text=True).stdout.splitlines()
               if "node_modules" not in d and os.path.isfile(os.path.join(ROOT, d))]
    treffer = [d for d in dateien if d.startswith(UNTERLAGEN_ORDNER) or UNTERLAGEN_ENDUNG.search(d) or (d.startswith("docs/") and (MAILDATEI.search(d) or SCAN_ENDUNG.search(d)))
               or re.search(r"(^|/)E-Mail[^/]*\.txt$", d) or (d.startswith("docs/freigabe-vorlagen/") and not d.endswith(".py"))]
    h = json.load(open(os.path.join(ROOT, "docs/freigabe-katalog/namen-sha256.json"), encoding="utf-8"))
    einzeln, paare, mehrdeutig = set(h["einzeln"]), set(h["paare"]), set(h["mehrdeutig"])
    sha = lambda s: hashlib.sha256(s.encode("utf-8")).hexdigest()
    for d in dateien:
        try:
            text = open(os.path.join(ROOT, d), encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        w, p = _woerter(text)
        streng = einzeln | mehrdeutig if d in PRUEFTEXTE else einzeln
        if any(sha(x) in streng for x in set(w)) or any(sha(x) in paare for x in set(p)):
            treffer.append(f"{d} (Name eines Prüfers)")
    return treffer


# mehrere Blöcke je Prüfer/Umfang möglich (z. B. Nachtrag, der Erklärung und Stelle bestätigt)
BLOECKE = [(r["pruefer"], r["umfang"], set(r.get("felder_fehlen") or []), r["eintraege"], bestaetigt(r)) for r in register]
for _r in register:
    assert _r["pruefer"] in ROLLEN, f"freigaben.yaml: unbekannte Rolle {_r['pruefer']}"
    assert "unterschrift" not in _r and "unterschrieben_am" not in _r, "freigaben.yaml: Unterschriftsfelder durch `nachweis` ersetzt (E-197)"
    assert set(_r) <= {"pruefer", "umfang", "nachweis", "hinweis", "eintraege", "gesehen", "felder_fehlen", "felder_hinweis"}, f"freigaben.yaml: unbekannte Felder {sorted(_r)}"
    nachweis_pruefen(_r)
frei = {}
for _p, _u, _fehl, _e, _am in BLOECKE:
    for _i, _f in _e.items():
        frei.setdefault((_p, _u), {})[_i] = _f  # jüngster Block gewinnt (für Anzeige/Abgleich)
SONDERFELDER = {"erklaerung", "stelle"}

_offen_roh = yaml.safe_load(open(os.path.join(ROOT, "docs/freigabe-katalog/offene-punkte.yaml"), encoding="utf-8"))
OFFEN = _offen_roh.get("offen") or []
ERLEDIGT = _offen_roh.get("erledigt") or []

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


def deckung(pfad, d, p, u, nur_bestaetigt):
    """(abgedeckt, Stand, Tag der Bestätigung, Einschränkungen) für Prüfer p mit Umfang u in der aktuellen Version."""
    noetig = {"rest"} if u == "sanktion" else {"rest"} | SONDERFELDER
    gedeckt, staende, bestaetigungen, einschr = set(), [], [], []
    for bp, bu, fehl, e, am in BLOECKE:
        if (bp, bu) != (p, u) or (nur_bestaetigt and not am):
            continue
        f = e.get(d["id"])
        if gueltig(pfad, d, f, u):
            gedeckt |= ({"rest"} | SONDERFELDER) - fehl
            staende.append(str(f["stand"]))
            if am:
                bestaetigungen.append(am)
            if f.get("einschraenkung"):
                einschr.append(f["einschraenkung"])
    ok = noetig <= gedeckt
    return ok, (max(staende) if ok else None), (max(bestaetigungen) if ok and bestaetigungen else None), sorted(set(einschr))


def abgedeckt(pfad, d, p, u, nur_bestaetigt=False):
    """Sind alle Felder im Umfang für die aktuelle Version freigegeben (inkl. Erklärung und Stelle)?"""
    return deckung(pfad, d, p, u, nur_bestaetigt)[0]


def offene_punkte(d):
    """Themen offener Prüfpunkte des Eintrags; prüft, dass jeder Stichwort-Punkt eingeordnet ist."""
    themen, fehlend = [], []
    for x in d.get("fachlich_zu_pruefen") or []:
        x = str(x)
        if any(re.search(t, x) for t in TECHNIK) or not any(re.search(o, x) for o in OFFEN_STICHWORTE):
            continue
        anfang = x[:60]
        o = [p for p in OFFEN if p["id"] == d["id"] and p["punkt"] == anfang]
        if o:
            themen.append(o[0]["thema"])
        elif not any(p["id"] == d["id"] and p["punkt"] == anfang for p in ERLEDIGT):
            fehlend.append(anfang)
    return themen, fehlend


def auswerten(pfad, d):
    """Prüfstand eines Eintrags: Status, Block für den Katalog und Angaben für Bericht und Nachprüfliste."""
    noetig = BENOETIGT[gebiet(d)]
    signiert = [(p, u) + deckung(pfad, d, p, u, True)[1:] + (deckung(pfad, d, p, u, True)[0],) for p, u in noetig]
    themen, fehlend = offene_punkte(d)
    info = {"id": d["id"], "version": d["version"], "rollen": [p for p, _ in noetig], "offen": themen, "nicht_eingeordnet": fehlend,
            "ohne_nachweis": [], "einschraenkung": []}
    for p, u in noetig:
        if not abgedeckt(pfad, d, p, u, True) and abgedeckt(pfad, d, p, u, False):
            info["ohne_nachweis"].append({"rolle": p, "umfang": u})
    if all(s[-1] for s in signiert):
        # geteilte Prüfung: Stand nie nach der Bestätigung einer der beteiligten Rollen (E-197)
        stand = min(s[2] for s in signiert)
        am = max(s[3] for s in signiert)
        einschr = sorted({e for s in signiert for e in s[4]})
        info["einschraenkung"] = einschr
        block = ("pruefung:\n  status: freigegeben\n  geprueft_von:\n" + "".join(f"    - {p}\n" for p, _ in noetig)
                 + f"  geprueft_am: '{stand}'\n  geprueft_version: {d['version']}\n  bestaetigt_am: '{am}'\n")
        if einschr:
            block += f"  einschraenkung: {json.dumps('; '.join(einschr), ensure_ascii=False)}\n"
        if themen:
            block += "  offen:\n" + "".join(f"    - {json.dumps(t, ensure_ascii=False)}\n" for t in themen)
        status = "freigegeben"
    else:
        irgendeine = any(frei.get((p, u), {}).get(d["id"]) for p, u in noetig)
        status = "in_pruefung" if irgendeine else "entwurf"
        block = f"pruefung:\n  status: {status}\n  geprueft_von: null\n  geprueft_am: null\n"
    info["status"] = status
    return status, block, info


def vorlagen_nachweis_pruefen():
    """E-197 bis E-199: Jede Vorlagen-Freigabe in geprueft.ts hat einen Nachweis mit art (mail, bericht, blatt), datum
    (= bestaetigt_am), rolle (= Rolle der Freigabe), umfang und aufbewahrung „beim Gründer“ – ohne Dateiverweis, ohne Zitat;
    der Stand liegt nie nach der Bestätigung. Prüfsummen: `pruefsumme` ist der SHA-256 über die freigegebenen Teilsummen
    (geprueft-teilsummen.ts), `pruefsumme_alt` hat 64 Hexziffern, und der heutige Prüfstand steht in pruefstaende.ts."""
    import hashlib
    d = os.path.join(ROOT, "packages/fachlogik/src/dokumente")
    ts = open(os.path.join(d, "geprueft.ts"), encoding="utf-8").read()
    teil = {m.group(1): json.loads(m.group(2)) for m in re.finditer(r'^ {2}"([\w#]+)": (\{[^\n]*\}),$', open(os.path.join(d, "geprueft-teilsummen.ts"), encoding="utf-8").read(), re.M)}
    heute = {m.group(1) for m in re.finditer(r'^ {2}"([\w#]+)": \{ summe: "[0-9a-f]{64}"', open(os.path.join(d, "pruefstaende.ts"), encoding="utf-8").read(), re.M)}
    fehler, schluessel, vorlage, weitere = [], [], None, 0
    for zeile in ts.splitlines():
        m = re.match(r" {2}(\w+): \{", zeile)
        if m:
            vorlage, weitere = m.group(1), 0
        if "stand:" not in zeile or "pruefsumme:" not in zeile:
            continue
        # E-202: mehrere weitere Freigaben je Vorlage (je eine Zeile) – „#1“, „#2“ usw. in der Reihenfolge der Zeilen
        if not re.match(r" {2}\w+: \{ stand:", zeile):
            weitere += 1
        k = vorlage if re.match(r" {2}\w+: \{ stand:", zeile) else f"{vorlage}#{weitere}"
        schluessel.append(k)
        stand = re.search(r'stand: "([\d-]+)"', zeile).group(1)
        rolle = re.search(r'stand: "[\d-]+", rolle: "(\w+)"', zeile)
        am = re.search(r'bestaetigt_am: ("[\d-]+"|null)', zeile)
        n = re.search(r'nachweis: \{ art: "(\w+)", datum: "([\d-]+)", rolle: "(\w+)", umfang: "((?:[^"\\]|\\.)+)", aufbewahrung: "([^"]+)" \}', zeile)
        ps = re.search(r'pruefsumme: "([0-9a-f]*)"', zeile).group(1)
        alt = re.search(r'pruefsumme_alt: "([0-9a-f]*)"', zeile)
        if not rolle or rolle.group(1) not in ROLLEN:
            fehler.append(f"{k}: ohne bekannte Rolle")
            continue
        if not am or am.group(1) == "null" or not n:
            fehler.append(f"{k}: ohne Nachweis (art, datum, rolle, umfang, aufbewahrung)")
            continue
        art, datum, nrolle, umfang, aufbewahrung = n.groups()
        am = am.group(1).strip('"')
        if art not in ("mail", "bericht", "blatt"):
            fehler.append(f"{k}: unbekannte Art {art}")
        if datum != am:
            fehler.append(f"{k}: nachweis.datum {datum} ≠ bestaetigt_am {am}")
        if nrolle != rolle.group(1):
            fehler.append(f"{k}: nachweis.rolle {nrolle} ≠ {rolle.group(1)}")
        if stand > am:
            fehler.append(f"{k}: Stand {stand} nach der Bestätigung {am}")
        if aufbewahrung != AUFBEWAHRUNG:
            fehler.append(f"{k}: aufbewahrung muss „{AUFBEWAHRUNG}“ sein")
        if re.search(r'\b(blatt|beleg|nachweis_text|zitat): ', zeile) or DATEIVERWEIS.search(zeile):
            fehler.append(f"{k}: Dateiverweis oder Zitat in geprueft.ts (E-199)")
        if len(ps) != 64 or not alt or len(alt.group(1)) != 64:
            fehler.append(f"{k}: Prüfsumme bzw. alte Prüfsumme ohne 64 Hexziffern")
        elif k not in teil:
            fehler.append(f"{k}: keine freigegebenen Teilsummen (geprueft-teilsummen.ts)")
        elif hashlib.sha256("\n".join(f"{g}={s}" for g, s in sorted(teil[k].items())).encode("utf-8")).hexdigest() != ps:
            fehler.append(f"{k}: Prüfsumme passt nicht zu den freigegebenen Teilsummen")
        if k not in heute:
            fehler.append(f"{k}: kein heutiger Prüfstand (pruefstaende.ts – werkzeuge/pruefstaende-erzeugen.mjs)")
    if sorted(schluessel) != sorted(teil):
        fehler.append(f"Freigaben und Teilsummen passen nicht zusammen: {sorted(set(schluessel) ^ set(teil))}")
    return fehler


def register_katalog_pruefen(katalog):
    """Jeder Eintrag im Register steht im Katalog, mit einer Version, die es dort gibt (nicht neuer als die aktuelle)."""
    fehler = []
    for _r in register:
        for i, f in _r["eintraege"].items():
            if i not in katalog:
                fehler.append(f"{_r['pruefer']}/{_r['umfang']}: {i} fehlt im Katalog")
            elif f["version"] > katalog[i]["version"]:
                fehler.append(f"{_r['pruefer']}/{_r['umfang']}: {i} v{f['version']} neuer als der Katalog (v{katalog[i]['version']})")
    return fehler


def alle():
    for pfad in sorted(glob.glob(os.path.join(ROOT, "catalog/pflichten/*.yaml"))):
        text = open(pfad, encoding="utf-8").read()
        yield pfad, text, yaml.safe_load(text)


if __name__ == "__main__":
    abweichung, uebersicht, berichte, ungeordnet = [], {"freigegeben": 0, "in_pruefung": 0, "entwurf": 0}, [], []
    for pfad, text, d in alle():
        status, block, info = auswerten(pfad, d)
        uebersicht[status] += 1
        berichte.append(info)
        ungeordnet += [f"{d['id']}: {x}" for x in info["nicht_eingeordnet"]]
        neu, n = re.subn(r"^pruefung:.*?(?=^[^\s#-]|\Z)", block, text, count=1, flags=re.M | re.S)
        assert n == 1, d["id"]
        if neu != text:
            abweichung.append(d["id"])
            if not PRUEFEN:
                open(pfad, "w", encoding="utf-8").write(neu)

    je_rolle = {r: sum(1 for b in berichte if b["status"] == "freigegeben" and r in b["rollen"]) for r in ROLLEN}
    print(uebersicht, f"geändert: {len(abweichung)}", "je Rolle:", je_rolle)
    # E-211: Regelwerte aus ihrem eigenen Register (freigaben-regelwerte.yaml), gleiche Regeln für den Nachweis
    import regelwerte as _rw
    rw_uebersicht, rw_abweichung, rw_fehler = _rw.anwenden(not PRUEFEN, nachweis_pruefen)
    print("Regelwerte:", rw_uebersicht, f"geändert: {len(rw_abweichung)}")
    if rw_fehler:
        print("Register der Regelwerte fehlerhaft:", *rw_fehler, sep="\n  ")
        sys.exit(1)
    if PRUEFEN and rw_abweichung:
        print("Regelwerte weichen vom Register ab:", ", ".join(rw_abweichung[:20]))
        sys.exit(1)
    if BERICHT:
        for b in berichte:
            if b["ohne_nachweis"] or b["offen"] or b["einschraenkung"]:
                print(json.dumps(b, ensure_ascii=False))
    if ungeordnet:
        print("Prüfpunkte ohne Einordnung in offene-punkte.yaml:", *ungeordnet, sep="\n  ")
        sys.exit(1)
    unterlagen = keine_pruefunterlagen()
    if unterlagen:
        print("Prüfunterlagen oder Namen im Repository (E-199: Unterlagen von und für Prüfer bewahrt der Gründer auf):", *unterlagen, sep="\n  ")
        sys.exit(1)
    kfehler = register_katalog_pruefen({b["id"]: b for b in berichte})
    if kfehler:
        print("Register passt nicht zum Katalog:", *kfehler, sep="\n  ")
        sys.exit(1)
    vfehler = vorlagen_nachweis_pruefen()
    if vfehler:
        print("Vorlagen-Freigaben ohne passenden Nachweis oder mit falscher Prüfsumme (geprueft.ts):", *vfehler, sep="\n  ")
        sys.exit(1)
    if PRUEFEN and abweichung:
        print("Katalog weicht vom Freigabe-Register ab:", ", ".join(abweichung[:20]))
        sys.exit(1)
