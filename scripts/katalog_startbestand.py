#!/usr/bin/env python3
"""
Erzeugt catalog/pflichten/*.yaml für die Kataloge A–G aus Spezifikation Abschnitt 4.

Regeln (E-054, Spezifikation 14.4):
- Inhalte (Fristen, Beträge, Auslöser) nur aus der Spezifikation.
- Nennt die Spezifikation keine Frist: frist dauerhaft + Prüfpunkt.
- Nennt sie keine Folgen: Platzhaltertext + Prüfpunkt (keine erfundenen Sanktionen).
- Rechtsgrundlage nicht aus der Spezifikation: wird ergänzt und als Prüfpunkt markiert.
- Quell-URLs sind nicht abgerufen (abgerufen: null, PRUEFLISTE G-11).
Einmal-Skript für den Startbestand; danach wird im Studio gepflegt (E-030).
"""
import sys, pathlib, yaml

ZIEL = pathlib.Path(sys.argv[1])
GII = "https://www.gesetze-im-internet.de/"
OHNE_FRIST = "Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen"
OHNE_FOLGEN = "Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen"
FOLGEN_PLATZHALTER = "Die Folgen sind noch nicht fachlich erfasst."
WERKTAG_LAND = {"regel": "naechster_werktag", "kalender": "bundesland"}
KEINE = {"regel": "keine", "kalender": "bundeseinheitlich"}
NATUERLICHE = ["einzelunternehmen", "freiberuf", "ek", "gbr", "partg", "partg_mbb", "gmbh_co_kg"]

def t(de): return {"de": de}
def q(titel, pfad): return {"titel": titel, "url": pfad if pfad.startswith("http") else GII + pfad, "abgerufen": None}
def v(feld, op, wert=None, label=None):
    b = {"feld": feld, "op": op}
    if wert is not None: b["wert"] = wert
    if label: b["label"] = t(label)
    return b
def rw(i, faktor=None): return {"regelwert": i, **({"faktor": faktor} if faktor else {})}
GRUENDUNGSDATUM = lambda versatz, zeitpunkt="spaetestens", vs=KEINE: {"typ": "relativ", "bezug": {"fakt": "profil.gruendungsdatum"}, "versatz": versatz, "zeitpunkt": zeitpunkt, "verschiebung": vs}

def pflicht(id, nr, titel, kurz, erklaerung, rechtsgrundlage, kategorie, ausloeser, frist, stelle, kanal, automatisierung,
            quellen, pruefpunkte, wiederholung=None, sanktion=None, schwere="mittel", begriffe=None, aktion=None,
            voraussetzungen=None, gueltig_ab=None, rg_ergaenzt=False, branchen=None, phase=None, status_recht="in_kraft", radar=None):
    pp = list(pruefpunkte)
    if phase is None and nr.startswith("A."): phase = "gruendung"  # Katalog A = Gründung und Registrierung
    if frist == "dauerhaft": frist = {"typ": "dauerhaft"}
    if frist["typ"] == "dauerhaft" and not any("Frist" in x for x in pp): pp.insert(0, OHNE_FRIST)
    if sanktion is None: sanktion = FOLGEN_PLATZHALTER; pp.append(OHNE_FOLGEN)
    if rg_ergaenzt: pp.append("Rechtsgrundlage ergänzt, steht nicht in der Spezifikation")
    p = {
        "schema_version": 1, "id": id, "version": 1, "katalog_nr": nr,
        "titel": t(titel), "kurz": t(kurz), "erklaerung": t(erklaerung),
        **({"begriffe": [{"begriff": t(b), "erklaerung": t(e)} for b, e in begriffe]} if begriffe else {}),
        "rechtsgrundlage": rechtsgrundlage, "kategorie": kategorie,
        **({"branchen": branchen} if branchen else {}),
        "ausloeser": ausloeser,
        **({"phase": phase} if phase else {}),
        **({"voraussetzungen": voraussetzungen} if voraussetzungen else {}),
        "frist": frist,
        "wiederholung": wiederholung or {"art": "einmalig"},
        "stelle": t(stelle), "kanal": kanal, "kosten": None,
        "sanktion": {"text": t(sanktion), "schwere": schwere},
        "automatisierung": automatisierung,
        **({"aktion": aktion} if aktion else {}),
        "status_recht": status_recht, **({"radar": radar} if radar else {}), "gueltig_ab": gueltig_ab, "gueltig_bis": None,
        "quellen": quellen,
        "fachlich_zu_pruefen": pp,
        "pruefung": {"status": "entwurf", "geprueft_von": None, "geprueft_am": None},
    }
    (ZIEL / f"{id}.yaml").write_text(
        f"# Katalog {nr} · Startbestand aus Spezifikation Abschnitt 4 (E-054), ungeprüft\n"
        + yaml.safe_dump(p, sort_keys=False, allow_unicode=True, width=120), encoding="utf-8")

# ============================================================ A. Gründung und Registrierung

pflicht("gruendung.taetigkeit_einordnen", "A.1", "Tätigkeit einordnen: freier Beruf oder Gewerbe",
  "Kläre, ob deine Tätigkeit ein freier Beruf oder ein Gewerbe ist – davon hängt ab, welche Anmeldungen du brauchst.",
  "Ob du freiberuflich oder gewerblich tätig bist, entscheidet über die Gewerbeanzeige, die Gewerbesteuer und die Mitgliedschaft in IHK oder Handwerkskammer. Solange das offen ist, kann Amtlos diese Pflichten nicht sicher bestimmen.",
  ["§ 18 EStG"], "gruendung",
  {"any": [v("profil.taetigkeit.einordnung", "nicht_vorhanden", label="Du hast noch nicht angegeben, ob deine Tätigkeit ein Gewerbe oder ein freier Beruf ist."),
           v("profil.taetigkeit.einordnung", "==", "unklar", "Du bist unsicher, ob deine Tätigkeit ein Gewerbe oder ein freier Beruf ist.")]},
  "dauerhaft", "Du selbst; im Zweifel Finanzamt oder Steuerberatung", "intern_dokumentieren", "hinweis",
  [q("Einkommensteuergesetz § 18", "estg/__18.html")],
  ["Ist das eine Pflicht oder ein vorbereitender Schritt? Darstellung als Aufgabe bestätigen"],
  begriffe=[("Freier Beruf", "Bestimmte Tätigkeiten wie Ärztin, Architekt oder Journalistin, die kein Gewerbe sind.")],
  aktion={"art": "formular", "ziel": "onboarding.taetigkeit"}, schwere="hoch", sanktion="Ohne diese Einordnung bleibt offen, welche Anmeldungen du brauchst.")

pflicht("gruendung.gewerbeanzeige", "A.2", "Gewerbe anmelden",
  "Melde dein Gewerbe bei der Gemeinde an, wenn du anfängst – und ebenso, wenn du umziehst oder aufhörst.",
  "Die Gewerbeanzeige machst du bei deiner Gemeinde, meist online. Die Gebühr hängt von der Gemeinde ab. Das Gewerbeamt informiert danach Finanzamt, IHK oder Handwerkskammer und weitere Stellen.",
  ["§ 14 GewO"], "gruendung",
  v("abgeleitet.ist_gewerbe", "==", True, "Deine Tätigkeit ist ein Gewerbe."),
  GRUENDUNGSDATUM("P0D"), "Gewerbeamt der Gemeinde", "portal", "formular_vorausfuellen",
  [q("Gewerbeordnung § 14", "gewo/__14.html")],
  ["Frist „bei Beginn“: als spätestens am Tag des Beginns umgesetzt – bestätigen", "Ummeldung und Abmeldung: Fristen ergänzen"],
  wiederholung={"art": "bei_aenderung", "neu_ausloesen_bei": [{"ereignis": "sitzverlegung"}, {"ereignis": "betriebsaufgabe"}]},
  schwere="hoch", aktion={"art": "link", "ziel": "portal.gewerbeanzeige", "nachweis_erforderlich": True})

ERLAUBNIS = ["30", "31", "33a", "33c", "33d", "33i", "34", "34a", "34b", "34c", "34d", "34e", "34f", "34h", "34i", "55"]
pflicht("gruendung.erlaubnis_pruefen", "A.3", "Erlaubnis für dein Gewerbe einholen",
  "Für manche Gewerbe brauchst du eine Erlaubnis, bevor du anfängst – zum Beispiel als Makler, im Bewachungsgewerbe oder in der Gastronomie.",
  "Erlaubnispflichtig sind unter anderem Makler, Bewachung, Versicherungs- und Finanzanlagenvermittlung (§§ 30–34i GewO), Gaststätten nach dem Gaststättenrecht der Länder und das Reisegewerbe (Reisegewerbekarte). Die Erlaubnis muss vor Aufnahme der Tätigkeit vorliegen.",
  ["§§ 30–34i GewO", "Gaststättenrecht der Länder"], "gruendung",
  {"any": [v("profil.erlaubnis.gewo_paragraphen", "enthaelt_eines", ERLAUBNIS, "Deine Tätigkeit fällt unter eine erlaubnispflichtige Vorschrift der Gewerbeordnung."),
           v("profil.erlaubnis.gaststaette", "==", True, "Du betreibst eine Gaststätte.")]},
  GRUENDUNGSDATUM("P0D", "vor_beginn"), "Zuständige Erlaubnisbehörde (je nach Gewerbe und Land)", "portal", "hinweis",
  [q("Gewerbeordnung", "gewo/")],
  ["Reisegewerbekarte (§ 55 GewO) als eigene Pflicht führen?", "Gaststättenrecht je Land: Zuständigkeit und Erlaubnisfreiheit einzelner Länder prüfen"],
  sanktion=None, schwere="hoch")

pflicht("gruendung.handwerksrolle", "A.4", "In die Handwerksrolle eintragen",
  "Wenn du ein Handwerk betreibst, musst du dich bei der Handwerkskammer eintragen lassen.",
  "Zulassungspflichtige Handwerke (Anlage A der Handwerksordnung) brauchen einen Meisterbrief oder eine Ausnahme. Zulassungsfreie Handwerke (Anlage B) müssen ebenfalls eingetragen werden.",
  ["HwO"], "gruendung",
  v("profil.handwerk.anlage", "in", ["a", "b1", "b2"], "Dein Betrieb ist ein Handwerk nach Anlage A oder B der Handwerksordnung."),
  "dauerhaft", "Handwerkskammer", "portal", "hinweis",
  [q("Handwerksordnung", "hwo/")],
  ["Anlage B2 (handwerksähnliche Gewerbe): ebenfalls eintragungspflichtig im Sinne der Spezifikation? Verzeichnis statt Rolle?"],
  begriffe=[("Handwerksrolle", "Das Verzeichnis der Handwerkskammer, in dem Handwerksbetriebe eingetragen sind.")],
  branchen=["handwerk"])

pflicht("gruendung.elster_konto", "A.5", "ELSTER-Konto beantragen",
  "Beantrage frühzeitig ein ELSTER-Konto – die Aktivierung kommt per Post und dauert einige Tage.",
  "Über ELSTER übermittelst du Steuererklärungen und Anmeldungen ans Finanzamt, als Erstes den Fragebogen zur steuerlichen Erfassung. Weil die Aktivierungsdaten per Post kommen, solltest du das Konto früh beantragen.",
  ["§ 138 AO (Voraussetzung für die elektronische Übermittlung)"], "gruendung",
  {"immer": True}, "dauerhaft", "ELSTER (Finanzverwaltung)", "portal", "hinweis",
  [q("ELSTER", "https://www.elster.de/")],
  ["Vorbereitender Schritt ohne eigene Rechtspflicht – Darstellung bestätigen", "Gilt für alle oder nur ohne Steuerberatung?"],
  sanktion="Ohne Konto kannst du den Fragebogen zur steuerlichen Erfassung nicht elektronisch übermitteln.", schwere="hoch",
  aktion={"art": "link", "ziel": "elster.registrierung"})

pflicht("gruendung.fragebogen_steuerliche_erfassung", "A.5", "Fragebogen zur steuerlichen Erfassung abgeben",
  "Innerhalb eines Monats nach dem Start meldest du dich über ELSTER beim Finanzamt an.",
  "Im Fragebogen gibst du unter anderem an, ob du die Kleinunternehmerregelung nutzt, und schätzt Umsatz und Gewinn. Danach bekommst du deine Steuernummer.",
  ["§ 138 AO"], "gruendung",
  {"immer": True}, GRUENDUNGSDATUM("P1M"), "Finanzamt", "elster", "formular_vorausfuellen",
  [q("Abgabenordnung § 138", "ao_1977/__138.html")],
  ["Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum im Profil? bestätigen", "Verschiebung bei Fristende am Wochenende/Feiertag festlegen"],
  voraussetzungen=["gruendung.elster_konto"], schwere="hoch",
  begriffe=[("Kleinunternehmerregelung", "Wer wenig Umsatz macht, kann ohne Umsatzsteuer abrechnen.")],
  aktion={"art": "uebermittlung", "ziel": "elster.fragebogen", "nachweis_erforderlich": True})

pflicht("gruendung.ust_idnr", "A.6", "Umsatzsteuer-Identifikationsnummer beantragen",
  "Wenn du Geschäfte mit Kunden in anderen EU-Ländern machst, beantragst du eine USt-IdNr. beim Bundeszentralamt für Steuern.",
  "Die Umsatzsteuer-Identifikationsnummer brauchst du für Geschäfte innerhalb der EU.",
  ["§ 27a UStG"], "gruendung",
  v("profil.kunden.regionen", "enthaelt", "eu", "Du hast Kunden in anderen EU-Ländern."),
  "dauerhaft", "Bundeszentralamt für Steuern (BZSt)", "portal", "hinweis",
  [q("Umsatzsteuergesetz § 27a", "ustg_1980/__27a.html")],
  ["Nur bei B2B-Geschäft oder bei jedem EU-Geschäft?"], rg_ergaenzt=True)

pflicht("gruendung.ihk_hwk_mitgliedschaft", "A.7", "Mitgliedschaft in IHK oder Handwerkskammer",
  "Als Gewerbetreibender bist du automatisch Mitglied der IHK oder Handwerkskammer und zahlst einen Beitrag nach deinem Ertrag.",
  "Die Mitgliedschaft entsteht automatisch mit dem Gewerbe; du musst dich nicht selbst anmelden. Die Kammer meldet sich bei dir und setzt den Beitrag fest.",
  ["IHKG", "HwO"], "gruendung",
  v("abgeleitet.ist_gewerbe", "==", True, "Deine Tätigkeit ist ein Gewerbe."),
  "dauerhaft", "IHK oder Handwerkskammer", "intern_dokumentieren", "hinweis",
  [q("Gesetz über die Industrie- und Handelskammern", "ihkg/")],
  ["Information ohne Handlung – als Hinweis darstellen?", "Beitragstermine für den Jahreskalender (I) ergänzen"], rg_ergaenzt=True,
  sanktion="Keine Handlung nötig; der Beitrag wird festgesetzt.", schwere="niedrig", aktion={"art": "abhaken"})

pflicht("gruendung.rundfunkbeitrag", "A.9", "Rundfunkbeitrag für die Betriebsstätte anmelden",
  "Melde deine Betriebsstätte beim Beitragsservice für den Rundfunkbeitrag an.",
  "Für Betriebsstätten fällt der Rundfunkbeitrag an. Die Anmeldung machst du beim Beitragsservice.",
  ["Rundfunkbeitragsstaatsvertrag"], "gruendung",
  v("profil.betriebsstaetten.anzahl", ">=", 1, "Du hast mindestens eine Betriebsstätte."),
  "dauerhaft", "ARD ZDF Deutschlandradio Beitragsservice", "portal", "hinweis",
  [q("Rundfunkbeitrag für Unternehmen", "https://www.rundfunkbeitrag.de/")],
  ["Gilt auch für Arbeitsräume in der eigenen Wohnung?", "Höhe nach Zahl der Beschäftigten – Staffel als Regelwert?"], rg_ergaenzt=True)

pflicht("gruendung.krankenversicherung", "A.10", "Krankenversicherung über die Selbstständigkeit informieren",
  "Sag deiner Krankenversicherung, dass du selbstständig bist. Hauptberuflich Selbstständige versichern sich selbst.",
  "Mit der Selbstständigkeit kann sich deine Krankenversicherung ändern. Wer hauptberuflich selbstständig ist, kümmert sich selbst um seine Versicherung und die Beiträge.",
  ["SGB V"], "gruendung",
  {"immer": True}, "dauerhaft", "Deine Krankenversicherung", "post", "hinweis",
  [q("Sozialgesetzbuch V", "sgb_5/")],
  ["Für welche Rechtsformen und Rollen (z. B. GmbH-Geschäftsführer) gilt das?", "Nebenerwerb: was genau ist zu melden?"], rg_ergaenzt=True,
  aktion={"art": "abhaken"})

pflicht("gruendung.rentenversicherungspflicht", "A.11", "Rentenversicherungspflicht melden",
  "Bestimmte Selbstständige sind rentenversicherungspflichtig und müssen sich innerhalb von drei Monaten bei der Deutschen Rentenversicherung melden.",
  "Pflichtversichert sind zum Beispiel Lehrende, Pflegepersonen, Handwerker in der Handwerksrolle und Selbstständige mit nur einem Auftraggeber. Die Meldung an die Deutsche Rentenversicherung muss innerhalb von drei Monaten erfolgen.",
  ["§ 2 SGB VI", "§ 190a SGB VI"], "gruendung",
  v("profil.rentenversicherung.pflichtgruppe", "enthaelt_eines", ["lehrende", "pflege", "handwerk_rolle", "ein_auftraggeber", "sonstige"],
    "Du gehörst zu einer Gruppe von Selbstständigen, die rentenversicherungspflichtig sein kann."),
  GRUENDUNGSDATUM("P3M"), "Deutsche Rentenversicherung", "post", "hinweis",
  [q("Sozialgesetzbuch VI § 2", "sgb_6/__2.html"), q("Sozialgesetzbuch VI § 190a", "sgb_6/__190a.html")],
  ["Liste der Gruppen vollständig (§ 2 SGB VI)?", "Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum?"],
  schwere="hoch")

pflicht("gruendung.statusfeststellung", "A.12", "Statusfeststellung erwägen (Scheinselbstständigkeit)",
  "Wenn du nur einen Auftraggeber hast, kannst du bei der Clearingstelle der Rentenversicherung klären lassen, ob du wirklich selbstständig bist.",
  "Die Statusfeststellung ist eine Möglichkeit, keine Pflicht. Sie schafft Sicherheit, wenn das Risiko der Scheinselbstständigkeit besteht.",
  ["§ 7a SGB IV"], "gruendung",
  v("profil.rentenversicherung.pflichtgruppe", "enthaelt", "ein_auftraggeber", "Du arbeitest überwiegend für einen Auftraggeber."),
  "dauerhaft", "Deutsche Rentenversicherung, Clearingstelle", "post", "hinweis",
  [q("Sozialgesetzbuch IV § 7a", "sgb_4/__7a.html")],
  ["Option mit Risiko-Check (Spezifikation): Kriterien des Risiko-Checks fachlich festlegen"], rg_ergaenzt=True,
  sanktion="Keine Pflicht. Ohne Klärung bleibt das Risiko einer späteren Einstufung als Beschäftigung.", schwere="niedrig",
  begriffe=[("Scheinselbstständigkeit", "Wenn jemand formal selbstständig ist, tatsächlich aber wie ein Angestellter arbeitet.")])

pflicht("gruendung.gruendungszuschuss", "A.13", "Gründungszuschuss beantragen",
  "Wenn du Arbeitslosengeld I bekommst, kannst du einen Gründungszuschuss beantragen – vor dem Start.",
  "Der Gründungszuschuss ist eine Förderung der Agentur für Arbeit. Er muss vor Beginn der Selbstständigkeit beantragt werden.",
  ["§ 93 SGB III"], "gruendung",
  {"all": [v("profil.alg1_bezug", "==", True, "Du bekommst Arbeitslosengeld I."),
           v("abgeleitet.noch_nicht_gestartet", "==", True, "Deine Selbstständigkeit hat noch nicht begonnen.")]},
  GRUENDUNGSDATUM("P0D", "vor_beginn"), "Agentur für Arbeit", "portal", "hinweis",
  [q("Sozialgesetzbuch III § 93", "sgb_3/__93.html")],
  ["Weitere Förderungen (Spezifikation A.13) als eigene Einträge?"], rg_ergaenzt=True,
  sanktion="Keine Pflicht. Nach dem Start ist ein Antrag nicht mehr möglich.", schwere="mittel")

# ============================================================ C. Steuern und Buchhaltung

# Vor dem Start und im Gründungsjahr gibt es keinen Vorjahresumsatz/-gewinn
GESTARTET = v("abgeleitet.noch_nicht_gestartet", "==", False)
VORJAHR_VORHANDEN = {"all": [v("abgeleitet.ist_gruendungsjahr", "==", False), GESTARTET]}
KU = lambda wert, label: v("profil.ust.kleinunternehmer", "==", wert, label)
# Umsatz aus den Rechnungen in Amtlos: nur vorhanden, wenn das Unternehmen in Amtlos Rechnungen stellt.
# Fehlt er, ist der Zweig „trifft nicht zu“ statt „Angabe fehlt“ (wer außerhalb fakturiert, bekommt keine Frage-Karte).
FIN = v("finanzen.umsatz.laufendes_jahr", "vorhanden", label="Du stellst Rechnungen mit Amtlos.")
GJ = lambda wert: v("abgeleitet.ist_gruendungsjahr", "==", wert, "Du hast dein Unternehmen in diesem Jahr gegründet." if wert else None)

pflicht("steuern.kleinunternehmerregelung", "C.23", "Kleinunternehmergrenzen im Blick behalten",
  "Als Kleinunternehmer darfst du bestimmte Umsatzgrenzen nicht überschreiten – sonst endet die Regelung.",
  "Die Kleinunternehmerregelung gilt, wenn dein Umsatz im Vorjahr höchstens 25.000 € betrug und im laufenden Jahr 100.000 € nicht übersteigt. Im Gründungsjahr gilt 25.000 € für das laufende Jahr. Die Grenze ist hart: Ab dem Umsatz, der sie überschreitet, endet der Status. Wer auf die Regelung verzichtet, ist fünf Jahre daran gebunden.",
  ["§ 19 UStG"], "steuern",
  KU(True, "Du nutzt die Kleinunternehmerregelung."),
  "dauerhaft", "Du selbst; Finanzamt", "intern_dokumentieren", "hinweis",
  [q("Umsatzsteuergesetz § 19", "ustg_1980/__19.html")],
  ["Echtzeit-Warnungen bei 80 % und 95 % (Spezifikation C.23) folgen in Abschnitt 4 mit Finanzdaten"],
  sanktion="Wird eine Grenze überschritten, fällt ab diesem Umsatz Umsatzsteuer an.", schwere="mittel",
  begriffe=[("Kleinunternehmerregelung", "Wer wenig Umsatz macht, kann ohne Umsatzsteuer abrechnen.")])

pflicht("steuern.kleinunternehmer_grenze_ueberschritten", "C.23", "Kleinunternehmergrenze überschritten: Umsatzsteuer prüfen",
  "Nach deinen Angaben liegt dein Umsatz über einer Kleinunternehmergrenze. Dann musst du Umsatzsteuer berechnen.",
  "Die Kleinunternehmerregelung endet ab dem Umsatz, der die Grenze überschreitet. Prüfe mit dem Finanzamt oder deiner Steuerberatung, ab wann du Umsatzsteuer ausweisen und anmelden musst.",
  ["§ 19 UStG"], "steuern",
  {"all": [KU(True, "Du nutzt die Kleinunternehmerregelung."),
           {"any": [
             {"all": [GJ(True), v("profil.umsatz.prognose_laufendes_jahr", ">", rw("steuern.ustg19.grenze_gruendungsjahr"), "Dein erwarteter Umsatz im Gründungsjahr liegt über der Grenze für das Gründungsjahr.")]},
             {"all": [GJ(False), GESTARTET, v("profil.umsatz.vorjahr", ">", rw("steuern.ustg19.grenze_vorjahr"), "Dein Umsatz im Vorjahr lag über der Grenze.")]},
             v("profil.umsatz.prognose_laufendes_jahr", ">", rw("steuern.ustg19.grenze_laufendes_jahr"), "Dein erwarteter Umsatz in diesem Jahr liegt über der Grenze."),
             {"all": [GJ(True), FIN, v("finanzen.umsatz.laufendes_jahr", ">", rw("steuern.ustg19.grenze_gruendungsjahr"), "Nach deinen Rechnungen in Amtlos liegt dein Umsatz im Gründungsjahr über der Grenze.")]},
             {"all": [GJ(False), FIN, v("finanzen.umsatz.laufendes_jahr", ">", rw("steuern.ustg19.grenze_laufendes_jahr"), "Nach deinen Rechnungen in Amtlos liegt dein Umsatz in diesem Jahr über der Grenze.")]},
           ]}]},
  "dauerhaft", "Finanzamt", "intern_dokumentieren", "hinweis",
  [q("Umsatzsteuergesetz § 19", "ustg_1980/__19.html")],
  ["Vor dem Start gibt es keinen Vorjahresumsatz – Vorjahresgrenze dann nicht geprüft", "Prognose statt tatsächlicher Umsatz: bis Abschnitt 4 nur Profilangaben – Formulierung „nach deinen Angaben“ bestätigen", "Grenze inklusive/exklusive (K-18)"],
  sanktion="Ab dem Umsatz über der Grenze fällt Umsatzsteuer an, auch wenn du sie nicht berechnet hast.", schwere="hoch",
  aktion={"art": "abhaken"})

# Spezifikation C.23: Echtzeit-Überwachung mit Warnungen bei 80 % und 95 % der Grenze (Umsatz aus den Rechnungen in Amtlos)
def ku_warnung(stufe, ab, bis, bis_op="<"):
    grenze_gj = lambda f: rw("steuern.ustg19.grenze_gruendungsjahr", f)
    grenze_lj = lambda f: rw("steuern.ustg19.grenze_laufendes_jahr", f)
    bereich = lambda g, text: {"all": [FIN, v("finanzen.umsatz.laufendes_jahr", ">=", g(ab), text),
                                       *([v("finanzen.umsatz.laufendes_jahr", bis_op, g(bis))] if bis else [])]}
    pflicht(f"steuern.kleinunternehmer_warnung_{stufe}", "C.23", f"Kleinunternehmergrenze zu {stufe} % erreicht",
      f"Nach deinen Rechnungen in Amtlos hast du {stufe} % der Kleinunternehmergrenze erreicht.",
      "Die Kleinunternehmerregelung endet ab dem Umsatz, der die Grenze überschreitet. Amtlos zählt dafür die Rechnungen, die du in Amtlos gestellt hast. Rechnungen außerhalb von Amtlos sind nicht enthalten.",
      ["§ 19 UStG"], "steuern",
      {"all": [KU(True, "Du nutzt die Kleinunternehmerregelung."),
               {"any": [{"all": [GJ(True), bereich(grenze_gj, f"Dein Umsatz im Gründungsjahr hat {stufe} % der Grenze erreicht.")]},
                        {"all": [GJ(False), bereich(grenze_lj, f"Dein Umsatz in diesem Jahr hat {stufe} % der Grenze erreicht.")]}]}]},
      "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
      [q("Umsatzsteuergesetz § 19", "ustg_1980/__19.html")],
      ["Umsatzbegriff für die Grenze (G-06): Summe der gestellten Rechnungen (netto, abzüglich Stornos) im Kalenderjahr nach Rechnungsdatum – bestätigen",
       "Warnstufen 80 % und 95 % aus der Spezifikation"],
      sanktion="Noch keine Folge – eine Warnung, damit du rechtzeitig planen kannst.", schwere="mittel" if stufe == 80 else "hoch",
      aktion={"art": "abhaken"})

ku_warnung(80, 0.8, 0.95)
ku_warnung(95, 0.95, 1.0, "<=")  # genau an der Grenze noch Warnung; darüber gilt „Grenze überschritten“

pflicht("steuern.ust_sondervorauszahlung", "C.24", "Sondervorauszahlung zur Umsatzsteuer leisten",
  "Wenn du die Voranmeldung monatlich abgibst und eine Dauerfristverlängerung hast, zahlst du einmal im Jahr eine Sondervorauszahlung von einem Elftel.",
  "Bei monatlicher Abgabe mit Dauerfristverlängerung wird eine Sondervorauszahlung von 1/11 fällig.",
  ["§ 18 UStG"], "steuern",
  {"all": [KU(False, "Du nutzt die Kleinunternehmerregelung nicht."),
           v("profil.ust.dauerfristverlaengerung", "==", True, "Du hast eine Dauerfristverlängerung."),
           v("profil.ust.zahllast_vorjahr", ">", rw("steuern.ust_va.grenze_monatlich"), "Du gibst die Voranmeldung monatlich ab.")]},
  "dauerhaft", "Finanzamt", "elster", "formular_vorausfuellen",
  [q("Umsatzsteuergesetz § 18", "ustg_1980/__18.html")],
  ["Fälligkeitstermin und Bemessungsgrundlage der Sondervorauszahlung ergänzen (K-08)"],
  wiederholung={"art": "periodisch"})

pflicht("steuern.zusammenfassende_meldung", "C.25", "Zusammenfassende Meldung abgeben",
  "Wenn du Leistungen an Unternehmen in anderen EU-Ländern erbringst, meldest du sie in der Zusammenfassenden Meldung.",
  "Die Zusammenfassende Meldung ist bei innergemeinschaftlichen Leistungen an Unternehmen (B2B) abzugeben.",
  ["§ 18a UStG"], "steuern",
  {"all": [v("profil.kunden.segmente", "enthaelt", "b2b", "Du verkaufst an Unternehmen."),
           v("profil.kunden.regionen", "enthaelt", "eu", "Du hast Kunden in anderen EU-Ländern.")]},
  "dauerhaft", "Bundeszentralamt für Steuern", "elster", "formular_vorausfuellen",
  [q("Umsatzsteuergesetz § 18a", "ustg_1980/__18a.html")],
  ["Meldezeitraum und Abgabefrist ergänzen", "Kleinunternehmer ausgenommen?"], rg_ergaenzt=True,
  wiederholung={"art": "periodisch"})

pflicht("steuern.vorauszahlung_est_kst", "C.26", "Vorauszahlungen zur Einkommen- oder Körperschaftsteuer zahlen",
  "Wenn das Finanzamt Vorauszahlungen festgesetzt hat, zahlst du sie am 10. März, 10. Juni, 10. September und 10. Dezember.",
  "Vorauszahlungen sind Abschläge auf die Steuer des laufenden Jahres. Die Höhe steht im Vorauszahlungsbescheid.",
  ["§ 37 EStG", "§ 31 KStG"], "steuern",
  v("profil.vorauszahlung.est_kst", "==", True, "Das Finanzamt hat Vorauszahlungen festgesetzt."),
  {"typ": "wiederkehrend", "rhythmus": "keiner", "faellig": {"art": "feste_termine", "termine": ["03-10", "06-10", "09-10", "12-10"]}, "verschiebung": WERKTAG_LAND, "erinnerung": ["P7D", "P2D"]},
  "Finanzamt", "intern_dokumentieren", "hinweis",
  [q("Einkommensteuergesetz § 37", "estg/__37.html")],
  ["Verschiebung auf den nächsten Werktag bei Zahlungsterminen bestätigen", "Schonfrist bei Überweisung erwähnen?"], rg_ergaenzt=True,
  wiederholung={"art": "periodisch"}, aktion={"art": "abhaken"})

pflicht("steuern.vorauszahlung_gewst", "C.26", "Gewerbesteuer-Vorauszahlungen zahlen",
  "Wenn die Gemeinde Gewerbesteuer-Vorauszahlungen festgesetzt hat, zahlst du sie am 15. Februar, 15. Mai, 15. August und 15. November.",
  "Die Höhe steht im Bescheid deiner Gemeinde.",
  ["§ 19 GewStG"], "steuern",
  {"all": [{"any": [v("abgeleitet.ist_gewerbe", "==", True), v("abgeleitet.ist_kapitalgesellschaft", "==", True)], "label": t("Du zahlst Gewerbesteuer.")},
           v("profil.vorauszahlung.gewst", "==", True, "Die Gemeinde hat Gewerbesteuer-Vorauszahlungen festgesetzt.")]},
  {"typ": "wiederkehrend", "rhythmus": "keiner", "faellig": {"art": "feste_termine", "termine": ["02-15", "05-15", "08-15", "11-15"]}, "verschiebung": {"regel": "naechster_werktag", "kalender": "gemeinde"}, "erinnerung": ["P7D", "P2D"]},
  "Gemeinde (Steueramt)", "intern_dokumentieren", "hinweis",
  [q("Gewerbesteuergesetz § 19", "gewstg/__19.html")],
  ["Verschiebung und Kalender (Gemeinde) bestätigen"], rg_ergaenzt=True,
  wiederholung={"art": "periodisch"}, aktion={"art": "abhaken"})

JAHR_FRIST = "Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I)"
pflicht("steuern.est_erklaerung", "C.27", "Einkommensteuererklärung abgeben",
  "Einmal im Jahr gibst du elektronisch deine Einkommensteuererklärung ab.",
  "Die Einkommensteuererklärung übermittelst du elektronisch. Die Frist ist mit und ohne Steuerberatung unterschiedlich.",
  ["EStG"], "steuern",
  v("profil.rechtsform", "in", NATUERLICHE, "Du bist als Person oder über eine Personengesellschaft unternehmerisch tätig."),
  "dauerhaft", "Finanzamt", "elster", "formular_vorausfuellen",
  [q("Einkommensteuergesetz", "estg/")],
  [JAHR_FRIST, "Personengesellschaften: Feststellungserklärung der Gesellschaft zusätzlich?"], rg_ergaenzt=True,
  wiederholung={"art": "periodisch"})

pflicht("steuern.ust_jahreserklaerung", "C.27", "Umsatzsteuer-Jahreserklärung abgeben",
  "Einmal im Jahr gibst du elektronisch die Umsatzsteuer-Jahreserklärung ab.",
  "Die Jahreserklärung fasst die Umsatzsteuer des ganzen Jahres zusammen.",
  ["§ 18 UStG"], "steuern",
  KU(False, "Du nutzt die Kleinunternehmerregelung nicht."),
  "dauerhaft", "Finanzamt", "elster", "formular_vorausfuellen",
  [q("Umsatzsteuergesetz § 18", "ustg_1980/__18.html")],
  [JAHR_FRIST, "Kleinunternehmer: Erklärungspflicht prüfen"], wiederholung={"art": "periodisch"})

pflicht("steuern.gewst_erklaerung", "C.27", "Gewerbesteuererklärung abgeben",
  "Einmal im Jahr gibst du elektronisch die Gewerbesteuererklärung ab.",
  "Die Gewerbesteuer hängt vom Hebesatz deiner Gemeinde ab. Einzelunternehmen und Personengesellschaften haben einen Freibetrag.",
  ["GewStG"], "steuern",
  {"any": [v("abgeleitet.ist_gewerbe", "==", True, "Deine Tätigkeit ist ein Gewerbe."), v("abgeleitet.ist_kapitalgesellschaft", "==", True, "Dein Unternehmen ist eine Kapitalgesellschaft.")]},
  "dauerhaft", "Finanzamt", "elster", "formular_vorausfuellen",
  [q("Gewerbesteuergesetz", "gewstg/")],
  [JAHR_FRIST, "Freibetrag (C.34) als Regelwert führen"], rg_ergaenzt=True,
  wiederholung={"art": "periodisch"}, begriffe=[("Hebesatz", "Ein Prozentsatz, den jede Gemeinde selbst festlegt und der die Höhe der Gewerbesteuer bestimmt.")])

BUCHFUEHRUNG = {"any": [
  v("abgeleitet.ist_kapitalgesellschaft", "==", True, "Dein Unternehmen ist eine Kapitalgesellschaft."),
  v("profil.rechtsform", "in", ["ek", "gmbh_co_kg"], "Dein Unternehmen ist im Handelsregister eingetragen."),
  {"all": [VORJAHR_VORHANDEN, v("profil.umsatz.vorjahr", ">", rw("steuern.ao141.grenze_umsatz"), "Dein Umsatz im Vorjahr lag über der Grenze für die Buchführungspflicht.")]},
  {"all": [VORJAHR_VORHANDEN, v("profil.gewinn.vorjahr", ">", rw("steuern.ao141.grenze_gewinn"), "Dein Gewinn im Vorjahr lag über der Grenze für die Buchführungspflicht.")]},
]}
pflicht("steuern.buchfuehrungspflicht", "C.28", "Doppelte Buchführung",
  "Du musst Bücher nach den Regeln der doppelten Buchführung führen und einen Jahresabschluss machen.",
  "Buchführungspflichtig ist, wer nach dem Handelsgesetzbuch dazu verpflichtet ist oder die Grenzen nach § 141 AO überschreitet (800.000 € Umsatz oder 80.000 € Gewinn). Amtlos erstellt keine Bilanz selbst, sondern übergibt an deine Steuerberatung (E-051).",
  ["HGB", "§ 141 AO"], "steuern",
  BUCHFUEHRUNG, "dauerhaft", "Du selbst bzw. deine Steuerberatung", "partner", "partner",
  [q("Abgabenordnung § 141", "ao_1977/__141.html"), q("Handelsgesetzbuch § 238", "hgb/__238.html")],
  ["e.K. und GmbH & Co. KG als HGB-buchführungspflichtig angenommen – bestätigen", "Im Gründungsjahr und vor dem Start gibt es keine Vorjahreswerte – § 141-Grenzen dann als nicht überschritten behandelt", "§ 141 AO: Pflicht beginnt erst nach Mitteilung des Finanzamts – berücksichtigen", "Grenze inklusive/exklusive"],
  schwere="hoch")

pflicht("steuern.euer", "C.27", "Einnahmen-Überschuss-Rechnung (Anlage EÜR) abgeben",
  "Einmal im Jahr ermittelst du deinen Gewinn mit der Anlage EÜR und übermittelst sie elektronisch.",
  "Wer nicht zur doppelten Buchführung verpflichtet ist, ermittelt den Gewinn mit der Einnahmen-Überschuss-Rechnung.",
  ["§ 4 Abs. 3 EStG"], "steuern",
  {"not": BUCHFUEHRUNG, "label": t("Du bist nicht zur doppelten Buchführung verpflichtet.")},
  "dauerhaft", "Finanzamt", "elster", "formular_vorausfuellen",
  [q("Einkommensteuergesetz § 4", "estg/__4.html")],
  [JAHR_FRIST], rg_ergaenzt=True, wiederholung={"art": "periodisch"})

pflicht("steuern.rechnungen_pflichtangaben", "C.29", "Rechnungen mit allen Pflichtangaben schreiben",
  "Deine Rechnungen müssen bestimmte Angaben enthalten. Als Kleinunternehmer brauchst du einen Hinweis auf § 19 UStG.",
  "Welche Angaben eine Rechnung braucht, regelt § 14 UStG. Für Kleinbetragsrechnungen gelten Erleichterungen. Kleinunternehmer weisen auf die Steuerbefreiung nach § 19 UStG hin.",
  ["§ 14 UStG", "§ 19 UStG"], "steuern",
  {"immer": True}, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Umsatzsteuergesetz § 14", "ustg_1980/__14.html")],
  ["Liste der Pflichtangaben und Kleinbetragsgrenze als Inhalt ergänzen"], aktion={"art": "abhaken"})

pflicht("steuern.e_rechnung_empfang", "C.30", "E-Rechnungen empfangen können",
  "Seit 2025 musst du elektronische Rechnungen (XRechnung, ZUGFeRD) von anderen Unternehmen empfangen können.",
  "Eine E-Rechnung ist ein strukturierter Datensatz. Eine PDF-Rechnung ist keine E-Rechnung.",
  ["§ 14 UStG"], "steuern",
  {"immer": True}, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Umsatzsteuergesetz § 14", "ustg_1980/__14.html")],
  ["Gilt für alle Unternehmen, auch Kleinunternehmer – bestätigen"], gueltig_ab="2025-01-01",
  begriffe=[("E-Rechnung", "Eine Rechnung als strukturierter Datensatz, den Software automatisch lesen kann.")], aktion={"art": "abhaken"})

pflicht("steuern.e_rechnung_versand_2027", "C.30", "E-Rechnungen versenden (ab 2027)",
  "Ab dem 1. Januar 2027 musst du an Unternehmen E-Rechnungen schicken, wenn dein Vorjahresumsatz über 800.000 € liegt.",
  "Die Pflicht zum Versand strukturierter E-Rechnungen (XRechnung oder ZUGFeRD) gilt ab 1.1.2027 für Unternehmen mit mehr als 800.000 € Vorjahresumsatz. Kleinunternehmer sind befreit. Eine PDF-Rechnung ist keine E-Rechnung.",
  ["§ 14 UStG"], "steuern",
  {"all": [v("profil.kunden.segmente", "enthaelt", "b2b", "Du verkaufst an Unternehmen."),
           KU(False, "Du nutzt die Kleinunternehmerregelung nicht."),
           {"any": [v("profil.umsatz.vorjahr", ">", rw("steuern.e_rechnung.grenze_vorjahresumsatz_2027"), "Dein Umsatz im Vorjahr lag über 800.000 €."),
                    v("profil.umsatz.prognose_laufendes_jahr", ">", rw("steuern.e_rechnung.grenze_vorjahresumsatz_2027"), "Dein erwarteter Umsatz in diesem Jahr liegt über 800.000 €.")]}]},
  {"typ": "absolut", "datum": "2027-01-01", "verschiebung": KEINE, "erinnerung": ["P90D", "P30D"]},
  "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Umsatzsteuergesetz § 14", "ustg_1980/__14.html")],
  ["Maßgeblich ist der Umsatz 2026: bis 2026 wird auch die Prognose herangezogen – bestätigen", "Rechtsstatus und gueltig_ab festlegen"],
  aktion={"art": "abhaken"}, schwere="hoch")

pflicht("steuern.e_rechnung_versand_2028", "C.30", "E-Rechnungen versenden (ab 2028)",
  "Ab dem 1. Januar 2028 schickst du an Unternehmen nur noch E-Rechnungen – Kleinunternehmer sind befreit.",
  "Ab 1.1.2028 gilt die Pflicht zum Versand strukturierter E-Rechnungen für alle Unternehmen im B2B-Geschäft, außer Kleinunternehmern nach § 19 UStG.",
  ["§ 14 UStG"], "steuern",
  {"all": [v("profil.kunden.segmente", "enthaelt", "b2b", "Du verkaufst an Unternehmen."), KU(False, "Du nutzt die Kleinunternehmerregelung nicht.")]},
  {"typ": "absolut", "datum": "2028-01-01", "verschiebung": KEINE, "erinnerung": ["P180D", "P60D"]},
  "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Umsatzsteuergesetz § 14", "ustg_1980/__14.html")],
  ["Rechtsstatus und gueltig_ab festlegen"], aktion={"art": "abhaken"})

pflicht("steuern.gobd_verfahrensdokumentation", "C.31", "GoBD einhalten und Verfahrensdokumentation führen",
  "Bewahre Belege nachvollziehbar und unveränderbar auf und beschreibe in einer Verfahrensdokumentation, wie du das machst.",
  "Die GoBD regeln, wie Bücher und Belege elektronisch geführt und aufbewahrt werden. Die Verfahrensdokumentation beschreibt deine Abläufe.",
  ["GoBD (BMF-Schreiben)", "§ 146 AO", "§ 147 AO"], "steuern",
  {"immer": True}, "dauerhaft", "Du selbst", "intern_dokumentieren", "dokument_generator",
  [q("Bundesministerium der Finanzen", "https://www.bundesfinanzministerium.de/")],
  ["Fundstelle des aktuellen GoBD-Schreibens ergänzen"], rg_ergaenzt=True,
  begriffe=[("GoBD", "Regeln der Finanzverwaltung, wie Bücher und Belege elektronisch geführt und aufbewahrt werden.")])

pflicht("steuern.aufbewahrung", "C.32", "Unterlagen aufbewahren",
  "Bewahre Belege und Rechnungen 8 Jahre, Jahresabschlüsse und Bücher 10 Jahre und Geschäftsbriefe 6 Jahre auf.",
  "Buchungsbelege einschließlich Rechnungen: 8 Jahre. Jahresabschlüsse, Bücher und Organisationsunterlagen: 10 Jahre. Handels- und Geschäftsbriefe: 6 Jahre. Amtlos zeigt dir, wann du Unterlagen löschen darfst.",
  ["§ 147 AO", "§ 257 HGB"], "steuern",
  {"immer": True}, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Abgabenordnung § 147", "ao_1977/__147.html"), q("Handelsgesetzbuch § 257", "hgb/__257.html")],
  ["Fristbeginn (Ende des Kalenderjahres) und Aufbewahrungsdauern als Regelwerte führen"], rg_ergaenzt=True)

pflicht("steuern.kassenmeldung", "C.33", "Elektronische Kasse beim Finanzamt melden",
  "Melde jede elektronische Kasse innerhalb eines Monats nach der Anschaffung über ELSTER – je Betriebsstätte.",
  "Elektronische Kassen müssen dem Finanzamt gemeldet werden, innerhalb eines Monats nach Anschaffung oder Außerbetriebnahme. Bestandskassen waren bis 31.7.2025 zu melden.",
  ["§ 146a AO"], "steuern",
  v("profil.kasse.elektronisch", "==", True, "Du nutzt eine elektronische Kasse."),
  {"typ": "relativ", "bezug": {"ereignis": "kasse_angeschafft"}, "versatz": "P1M", "zeitpunkt": "spaetestens", "verschiebung": KEINE},
  "Finanzamt", "elster", "formular_vorausfuellen",
  [q("Abgabenordnung § 146a", "ao_1977/__146a.html")],
  ["Bestandskassen (Meldefrist 31.7.2025): Pflicht für Kassen ohne gemeldetes Anschaffungsdatum abbilden", "Verschiebung bei Fristende am Wochenende festlegen"],
  wiederholung={"art": "bei_aenderung", "neu_ausloesen_bei": [{"ereignis": "kasse_angeschafft"}]}, schwere="hoch")

pflicht("steuern.kassenmeldung_ausserbetriebnahme", "C.33", "Außerbetriebnahme einer Kasse melden",
  "Wenn du eine elektronische Kasse nicht mehr nutzt, meldest du das innerhalb eines Monats über ELSTER.",
  "Auch die Außerbetriebnahme einer elektronischen Kasse muss dem Finanzamt innerhalb eines Monats gemeldet werden.",
  ["§ 146a AO"], "steuern",
  {"ereignis": "kasse_ausser_betrieb", "op": "eingetreten", "label": t("Du hast eine Kasse außer Betrieb genommen.")},
  {"typ": "relativ", "bezug": {"ereignis": "kasse_ausser_betrieb"}, "versatz": "P1M", "zeitpunkt": "spaetestens", "verschiebung": KEINE},
  "Finanzamt", "elster", "formular_vorausfuellen",
  [q("Abgabenordnung § 146a", "ao_1977/__146a.html")],
  ["Mehrere Kassen: je Ereignis eine Meldung (derzeit Bezug auf die erste Außerbetriebnahme)"],
  wiederholung={"art": "bei_aenderung", "neu_ausloesen_bei": [{"ereignis": "kasse_ausser_betrieb"}]})

pflicht("steuern.kasse_tse_belegausgabe", "C.33", "Kasse mit TSE betreiben und Belege ausgeben",
  "Deine elektronische Kasse braucht eine technische Sicherheitseinrichtung (TSE), und du musst Belege ausgeben.",
  "Elektronische Aufzeichnungssysteme müssen durch eine zertifizierte technische Sicherheitseinrichtung geschützt sein. Zu jedem Geschäftsvorfall ist ein Beleg auszugeben.",
  ["§ 146a AO"], "steuern",
  v("profil.kasse.elektronisch", "==", True, "Du nutzt eine elektronische Kasse."),
  "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Abgabenordnung § 146a", "ao_1977/__146a.html")],
  [], begriffe=[("TSE", "Technische Sicherheitseinrichtung, die Kassendaten gegen Manipulation schützt.")], aktion={"art": "abhaken"})

pflicht("steuern.bauabzugsteuer_freistellung", "C.35", "Freistellungsbescheinigung für Bauleistungen beantragen",
  "Wenn du Bauleistungen erbringst, beantragst du beim Finanzamt eine Freistellungsbescheinigung, damit deine Auftraggeber keine Bauabzugsteuer einbehalten.",
  "Ohne Freistellungsbescheinigung müssen Auftraggeber einen Teil deiner Rechnung als Bauabzugsteuer einbehalten.",
  ["§ 48b EStG"], "steuern",
  v("profil.taetigkeit.branchen", "enthaelt", "bau", "Du erbringst Bauleistungen."),
  "dauerhaft", "Finanzamt", "post", "hinweis",
  [q("Einkommensteuergesetz § 48b", "estg/__48b.html")],
  ["Auch Handwerksbetriebe mit Bauleistungen erfassen (Branche handwerk)?", "Gültigkeitsdauer der Bescheinigung und Erneuerung ergänzen"],
  branchen=["bau", "handwerk"])

# ============================================================ B. Kapitalgesellschaften und Startups (UG/GmbH)

KAPG = v("abgeleitet.ist_kapitalgesellschaft", "==", True, "Dein Unternehmen ist eine UG oder GmbH.")
NICHT_EINGETRAGEN = v("profil.gesellschaft.handelsregister", "!=", "eingetragen", "Deine Gesellschaft ist noch nicht im Handelsregister eingetragen.")
UG = v("profil.rechtsform", "==", "ug", "Dein Unternehmen ist eine UG (haftungsbeschränkt).")
JAEHRLICH_NACH_GJ = lambda monate, tag: {"typ": "wiederkehrend", "rhythmus": "jaehrlich", "faellig": {"art": "tag_nach_periodenende", "monate_nach": monate, "tag": tag}, "verschiebung": KEINE}

pflicht("gesellschaft.gesellschaftsvertrag_notar", "B.14", "Gesellschaftsvertrag beim Notar beurkunden",
  "Für eine UG oder GmbH lässt du den Gesellschaftsvertrag notariell beurkunden – auch online möglich.",
  "Die Gründung einer GmbH oder UG beginnt mit dem Gesellschaftsvertrag, den ein Notar beurkundet. Die Beurkundung ist auch online möglich. Für die GmbH beträgt das Stammkapital mindestens 25.000 €, davon ist mindestens die Hälfte einzuzahlen. Eine UG kann ab 1 € gegründet werden.",
  ["GmbHG"], "gesellschaft",
  {"all": [KAPG, NICHT_EINGETRAGEN]},
  "dauerhaft", "Notarin oder Notar", "notar", "hinweis",
  [q("GmbH-Gesetz", "gmbhg/")],
  ["Einzelne Vorschriften (z. B. § 2 GmbHG Form, § 5 Stammkapital, § 7 Einzahlung) zuordnen", "Online-Beurkundung: Voraussetzungen und Grenzen ergänzen"],
  rg_ergaenzt=True, schwere="hoch",
  begriffe=[("Stammkapital", "Das Kapital, das die Gesellschafter bei der Gründung einer GmbH oder UG mindestens aufbringen.")],
  aktion={"art": "abhaken", "nachweis_erforderlich": True}, phase="gruendung")

pflicht("gesellschaft.stammkapital_einzahlen", "B.14", "Stammkapital einzahlen",
  "Zahl das Stammkapital auf das Geschäftskonto ein, bevor die Gesellschaft zum Handelsregister angemeldet wird.",
  "Bei der GmbH ist mindestens die Hälfte des Mindeststammkapitals von 25.000 € einzuzahlen. Bei der UG ab 1 € wird das Stammkapital voll eingezahlt.",
  ["GmbHG"], "gesellschaft",
  {"all": [KAPG, NICHT_EINGETRAGEN]},
  "dauerhaft", "Du und deine Mitgesellschafter; Bank", "intern_dokumentieren", "hinweis",
  [q("GmbH-Gesetz", "gmbhg/")],
  ["Reihenfolge „vor der Anmeldung“ bestätigen", "UG: Volleinzahlung und Bareinlage (Spezifikation nennt nur „ab 1 €“) bestätigen", "Höhe der Einzahlung bei GmbH: Anteil je Geschäftsanteil oder insgesamt?"],
  rg_ergaenzt=True, schwere="hoch", voraussetzungen=["gesellschaft.gesellschaftsvertrag_notar"],
  aktion={"art": "abhaken", "nachweis_erforderlich": True}, phase="gruendung")

pflicht("gesellschaft.handelsregister_anmeldung", "B.15", "Gesellschaft im Handelsregister eintragen lassen",
  "Der Notar meldet die Gesellschaft zum Handelsregister an; mit der Eintragung entsteht die GmbH oder UG.",
  "Zur Anmeldung gehört die Gesellschafterliste. Spätere Änderungen, etwa im Gesellschaftsvertrag oder bei der Geschäftsführung, werden ebenfalls notariell angemeldet.",
  ["HGB", "GmbHG"], "gesellschaft",
  {"all": [KAPG, NICHT_EINGETRAGEN]},
  "dauerhaft", "Registergericht (über den Notar)", "notar", "hinweis",
  [q("GmbH-Gesetz", "gmbhg/"), q("Handelsgesetzbuch", "hgb/")],
  ["Einzelvorschriften (§§ 7, 8 GmbHG) zuordnen", "Haftung vor Eintragung (Vorgesellschaft) als Hinweis ergänzen?"],
  rg_ergaenzt=True, schwere="hoch", voraussetzungen=["gesellschaft.stammkapital_einzahlen"],
  aktion={"art": "formular", "ziel": "onboarding.gesellschaft"}, phase="gruendung")

pflicht("gesellschaft.gesellschafterliste_aktualisieren", "B.15", "Gesellschafterliste aktualisieren",
  "Wenn sich im Gesellschafterkreis etwas ändert, muss eine neue Gesellschafterliste zum Handelsregister – über den Notar.",
  "Änderungen im Gesellschafterkreis werden notariell abgewickelt; die aktualisierte Gesellschafterliste wird beim Handelsregister eingereicht.",
  ["GmbHG"], "gesellschaft",
  {"all": [KAPG, {"ereignis": "gesellschafterwechsel", "op": "eingetreten", "label": t("Im Gesellschafterkreis hat sich etwas geändert.")}]},
  "dauerhaft", "Notarin oder Notar; Registergericht", "notar", "hinweis",
  [q("GmbH-Gesetz § 40", "gmbhg/__40.html")],
  ["Frist für die Einreichung ergänzen"], rg_ergaenzt=True, schwere="mittel",
  wiederholung={"art": "bei_aenderung", "neu_ausloesen_bei": [{"ereignis": "gesellschafterwechsel"}]})

pflicht("gesellschaft.transparenzregister", "B.16", "Wirtschaftlich Berechtigte ans Transparenzregister melden",
  "Melde, wer hinter deiner Gesellschaft steht, und halte die Angaben aktuell.",
  "Gesellschaften müssen ihre wirtschaftlich Berechtigten dem Transparenzregister mitteilen und die Angaben bei Änderungen aktualisieren.",
  ["GwG"], "gesellschaft",
  KAPG, "dauerhaft", "Transparenzregister (Bundesanzeiger Verlag)", "portal", "hinweis",
  [q("Transparenzregister", "https://www.transparenzregister.de/"), q("Geldwäschegesetz", "gwg_2017/")],
  ["Einzelvorschriften (§§ 19, 20 GwG) zuordnen", "Gilt auch für GmbH & Co. KG und Personengesellschaften – Auslöser erweitern?", "Frist nach Gründung und bei Änderung ergänzen"],
  rg_ergaenzt=True, schwere="hoch",
  wiederholung={"art": "bei_aenderung", "neu_ausloesen_bei": [{"ereignis": "gesellschafterwechsel"}]},
  begriffe=[("Wirtschaftlich Berechtigte", "Die Menschen, denen eine Gesellschaft letztlich gehört oder die sie kontrollieren.")],
  aktion={"art": "link", "ziel": "portal.transparenzregister", "nachweis_erforderlich": True}, phase="gruendung")

pflicht("gesellschaft.gf_sozialversicherungsstatus", "B.17", "Sozialversicherungsstatus der Geschäftsführung klären",
  "Kläre, ob Geschäftsführerinnen und Geschäftsführer sozialversicherungspflichtig sind – zum Beispiel mit einer Statusfeststellung.",
  "Ob eine Geschäftsführerin oder ein Geschäftsführer sozialversicherungspflichtig beschäftigt ist, hängt vom Einzelfall ab. Sicherheit schafft eine Statusfeststellung bei der Deutschen Rentenversicherung.",
  ["§ 7a SGB IV"], "gesellschaft",
  KAPG, "dauerhaft", "Deutsche Rentenversicherung, Clearingstelle", "post", "hinweis",
  [q("Sozialgesetzbuch IV § 7a", "sgb_4/__7a.html")],
  ["Kriterien (Beteiligung, Sperrminorität) nicht in der Spezifikation – nur als Hinweis auf die Statusfeststellung darstellen"],
  rg_ergaenzt=True, schwere="mittel")

pflicht("gesellschaft.gf_pflichten_haftung", "B.17", "Pflichten und Haftung der Geschäftsführung kennen",
  "Als Geschäftsführerin oder Geschäftsführer hast du besondere Pflichten und kannst persönlich haften.",
  "Die Geschäftsführung einer GmbH oder UG hat gesetzliche Pflichten. Wer sie verletzt, kann persönlich haften. Amtlos erklärt die Pflichten allgemein; für deinen Einzelfall hilft eine Rechtsberatung.",
  ["GmbHG"], "gesellschaft",
  KAPG, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("GmbH-Gesetz", "gmbhg/")],
  ["Inhalt der Erklärung (welche Pflichten, § 43 GmbHG) fachlich festlegen – Spezifikation nennt nur „Pflichten und Haftung erklären“"],
  rg_ergaenzt=True, schwere="mittel", aktion={"art": "abhaken"})

pflicht("gesellschaft.insolvenzantragspflicht", "B.17", "Insolvenzantragspflicht kennen",
  "Bei Zahlungsunfähigkeit oder Überschuldung muss die Geschäftsführung rechtzeitig Insolvenz beantragen.",
  "Die Insolvenzantragspflicht nach § 15a InsO trifft die Geschäftsführung. Die genauen Fristen stehen als geprüfte Regeldaten in Amtlos, sobald sie fachlich freigegeben sind.",
  ["§ 15a InsO"], "gesellschaft",
  KAPG, "dauerhaft", "Insolvenzgericht", "post", "hinweis",
  [q("Insolvenzordnung § 15a", "inso/__15a.html")],
  ["Fristen nach § 15a InsO als Regelwerte erfassen (Spezifikation: „Fristen aus Regeldaten“, Werte nicht genannt)", "Darstellung: allgemeine Information, keine Prüfung des Einzelfalls (RDG)"],
  schwere="hoch", sanktion=None)

pflicht("gesellschaft.jahresabschluss", "B.18", "Jahresabschluss aufstellen und feststellen",
  "Nach jedem Geschäftsjahr erstellst du Bilanz und Gewinn- und Verlustrechnung; die Gesellschafter stellen den Abschluss fest.",
  "Zum Jahresabschluss gehören Bilanz und Gewinn- und Verlustrechnung. Die Gesellschafter stellen ihn fest. Die Bilanz geht außerdem elektronisch als E-Bilanz ans Finanzamt.",
  ["HGB", "GmbHG"], "gesellschaft",
  KAPG, "dauerhaft", "Du und die Gesellschafter; Finanzamt (E-Bilanz)", "intern_dokumentieren", "hinweis",
  [q("Handelsgesetzbuch", "hgb/")],
  ["Fristen für Aufstellung und Feststellung als Regeldaten ergänzen", "Jährliche Wiederholung abbilden, sobald Fristen feststehen"],
  rg_ergaenzt=True, schwere="hoch",
  begriffe=[("E-Bilanz", "Die Bilanz in elektronischer Form, die ans Finanzamt übermittelt wird.")])

pflicht("steuern.e_bilanz", "B.18", "E-Bilanz ans Finanzamt übermitteln",
  "Die Bilanz deiner Gesellschaft übermittelst du elektronisch ans Finanzamt.",
  "Die E-Bilanz ist die elektronische Übermittlung von Bilanz und Gewinn- und Verlustrechnung an das Finanzamt.",
  ["§ 5b EStG"], "steuern",
  KAPG, "dauerhaft", "Finanzamt", "elster", "hinweis",
  [q("Einkommensteuergesetz § 5b", "estg/__5b.html")],
  ["Frist (gekoppelt an die Steuererklärung) als Regeldaten ergänzen"], rg_ergaenzt=True, schwere="mittel")

pflicht("gesellschaft.offenlegung", "B.18", "Jahresabschluss offenlegen",
  "Den Jahresabschluss reichst du spätestens zwölf Monate nach Ende des Geschäftsjahres beim Unternehmensregister ein.",
  "Kapitalgesellschaften müssen ihren Jahresabschluss beim Unternehmensregister offenlegen, binnen zwölf Monaten nach Ende des Geschäftsjahres. Kleinstkapitalgesellschaften können ihn stattdessen hinterlegen.",
  ["§ 325 HGB"], "gesellschaft",
  {"all": [KAPG, v("profil.gesellschaft.geschaeftsjahr", "==", "kalenderjahr", "Dein Geschäftsjahr ist das Kalenderjahr.")]},
  JAEHRLICH_NACH_GJ(12, 31), "Unternehmensregister", "portal", "hinweis",
  [q("Handelsgesetzbuch § 325", "hgb/__325.html"), q("Unternehmensregister", "https://www.unternehmensregister.de/")],
  ["Frist „binnen 12 Monaten“ als 31.12. des Folgejahres umgesetzt (Kalenderjahr) – bestätigen", "Verschiebung bei Fristende am Wochenende/Feiertag festlegen",
   "Kleinstkapitalgesellschaft: Merkmale nicht in der Spezifikation – nur Hinweis auf Hinterlegung", "Erstes Rumpfgeschäftsjahr nach Gründung: Periodenbeginn prüfen"],
  rg_ergaenzt=True, schwere="hoch", wiederholung={"art": "periodisch"},
  begriffe=[("Offenlegung", "Der Jahresabschluss wird öffentlich zugänglich beim Unternehmensregister eingereicht.")],
  aktion={"art": "link", "ziel": "portal.unternehmensregister", "nachweis_erforderlich": True})

pflicht("gesellschaft.offenlegung_abweichendes_gj", "B.18", "Jahresabschluss offenlegen (abweichendes Geschäftsjahr)",
  "Den Jahresabschluss reichst du spätestens zwölf Monate nach Ende deines Geschäftsjahres beim Unternehmensregister ein.",
  "Bei einem vom Kalenderjahr abweichenden Geschäftsjahr berechnet Amtlos den Termin noch nicht; die Frist beträgt zwölf Monate nach Ende des Geschäftsjahres.",
  ["§ 325 HGB"], "gesellschaft",
  {"all": [KAPG, v("profil.gesellschaft.geschaeftsjahr", "==", "abweichend", "Dein Geschäftsjahr weicht vom Kalenderjahr ab.")]},
  "dauerhaft", "Unternehmensregister", "portal", "hinweis",
  [q("Handelsgesetzbuch § 325", "hgb/__325.html")],
  ["Frist: Termin für abweichendes Geschäftsjahr berechnen (Angabe des Geschäftsjahresendes im Profil nötig)"], rg_ergaenzt=True, schwere="hoch")

pflicht("gesellschaft.ug_ruecklage", "B.14", "Rücklage der UG bilden",
  "Eine UG muss jedes Jahr ein Viertel ihres Jahresüberschusses in eine Rücklage stellen.",
  "Die UG (haftungsbeschränkt) muss 25 % ihres Jahresüberschusses in eine gesetzliche Rücklage einstellen.",
  ["§ 5a GmbHG"], "gesellschaft",
  UG, "dauerhaft", "Du selbst (im Jahresabschluss)", "intern_dokumentieren", "hinweis",
  [q("GmbH-Gesetz § 5a", "gmbhg/__5a.html")],
  ["Ende der Rücklagepflicht (Erreichen des GmbH-Stammkapitals) ergänzen", "Verlustvortrag bei der Berechnung berücksichtigen?"],
  rg_ergaenzt=True, schwere="mittel")

pflicht("steuern.kst_erklaerung", "B.19", "Körperschaftsteuererklärung abgeben",
  "Einmal im Jahr gibst du für deine Gesellschaft elektronisch die Körperschaftsteuererklärung ab.",
  "Kapitalgesellschaften zahlen Körperschaftsteuer und geben dafür jährlich eine Erklärung ab. Die Fristen stehen als Regeldaten in Amtlos, sobald sie fachlich freigegeben sind.",
  ["KStG"], "steuern",
  KAPG, "dauerhaft", "Finanzamt", "elster", "hinweis",
  [q("Körperschaftsteuergesetz", "kstg_1977/")],
  ["Abgabefristen mit und ohne Steuerberatung als Regeldaten (wie G-18)"], rg_ergaenzt=True, schwere="hoch")

pflicht("gesellschaft.mitarbeiterbeteiligung", "B.20", "Mitarbeiterbeteiligung prüfen (Option)",
  "Wenn du Mitarbeitende am Unternehmen beteiligen willst, gibt es dafür besondere Regeln und Modelle wie VSOP.",
  "Für Mitarbeiterbeteiligungen gibt es steuerliche Sonderregeln (§ 19a EStG) und virtuelle Modelle (VSOP). Amtlos erklärt die Modelle; Vorlagen folgen mit dem Dokumentengenerator.",
  ["§ 19a EStG"], "gesellschaft",
  {"all": [KAPG, v("abgeleitet.hat_beschaeftigte", "==", True, "Du hast Beschäftigte.")]},
  "dauerhaft", "Du selbst; Steuerberatung", "intern_dokumentieren", "hinweis",
  [q("Einkommensteuergesetz § 19a", "estg/__19a.html")],
  ["Option, keine Pflicht – Darstellung bestätigen", "Inhalt der Erklärung zu § 19a EStG und VSOP fachlich festlegen"],
  sanktion="Keine Pflicht.", schwere="niedrig",
  begriffe=[("VSOP", "Virtuelles Beteiligungsprogramm: Mitarbeitende werden wirtschaftlich beteiligt, ohne echte Anteile zu bekommen.")])

pflicht("gesellschaft.awv_meldung", "B.21", "Auslandszahlungen nach AWV melden",
  "Bei grenzüberschreitenden Zahlungen über der Meldegrenze – zum Beispiel Investorengeld aus dem Ausland – besteht eine Meldepflicht.",
  "Die Außenwirtschaftsverordnung verlangt Meldungen bei grenzüberschreitenden Zahlungen über einer Meldegrenze. Die Grenze steht als Regelwert in Amtlos, sobald sie fachlich freigegeben ist.",
  ["AWV"], "gesellschaft",
  v("profil.gesellschafter.auslaendische_investoren", "==", True, "Du hast Investoren aus dem Ausland."),
  "dauerhaft", "Deutsche Bundesbank", "portal", "hinweis",
  [q("Außenwirtschaftsverordnung", "awv_2013/")],
  ["Meldegrenze als Regelwert erfassen (nicht in der Spezifikation)", "Meldefrist ergänzen", "Auch ohne Investoren bei Auslandszahlungen über der Grenze – weiterer Auslöser?"],
  schwere="mittel")

pflicht("gesellschaft.investitionspruefung_hinweis", "B.21", "Investitionsprüfung in sensiblen Sektoren beachten",
  "Wenn ausländische Investoren in ein Unternehmen in einem sensiblen Sektor einsteigen, kann eine Investitionsprüfung nötig sein.",
  "Bei Beteiligungen ausländischer Investoren an Unternehmen in sensiblen Sektoren kann der Staat die Investition prüfen. Amtlos gibt hier nur einen allgemeinen Hinweis.",
  ["AWG", "AWV"], "gesellschaft",
  v("profil.gesellschafter.auslaendische_investoren", "==", True, "Du hast Investoren aus dem Ausland."),
  "dauerhaft", "Bundesministerium für Wirtschaft und Klimaschutz", "post", "hinweis",
  [q("Außenwirtschaftsgesetz", "awg_2013/")],
  ["Hinweis laut Spezifikation – sensible Sektoren und Schwellen fachlich ergänzen", "Zuständiges Ministerium (Bezeichnung) aktuell?"],
  sanktion="Keine eigene Handlung, solange kein sensibler Sektor betroffen ist.", schwere="niedrig")

pflicht("gesellschaft.foerderprogramme", "B.22", "Förderprogramme prüfen (Option)",
  "Für Startups gibt es Förderprogramme wie EXIST, INVEST, KfW-Programme und Programme der Länder.",
  "Amtlos zeigt passende Förderprogramme, sobald das Matching nach Profil fachlich hinterlegt ist. Fristen und Antragsunterlagen hängen vom Programm ab.",
  ["Förderrichtlinien des Bundes und der Länder"], "gesellschaft",
  {"any": [KAPG, v("abgeleitet.noch_nicht_gestartet", "==", True, "Du gründest gerade.")]},
  "dauerhaft", "Fördergeber (z. B. BMWK, KfW, Länder)", "portal", "hinweis",
  [q("Förderdatenbank des Bundes", "https://www.foerderdatenbank.de/")],
  ["Option, keine Pflicht", "Matching-Kriterien und Fristen je Programm fachlich hinterlegen"],
  sanktion="Keine Pflicht.", schwere="niedrig")

# ============================================================ D. Personal und Lohn

HAT_B = v("abgeleitet.hat_beschaeftigte", "==", True, "Du beschäftigst mindestens eine Person.")
EINSTELLUNG = {"ereignis": "einstellung", "op": "eingetreten", "label": t("Du stellst jemanden ein.")}
AUSTRITT = {"ereignis": "austritt", "op": "eingetreten", "label": t("Eine Beschäftigung endet.")}
JE = lambda ereignis, versatz="P0D", zeitpunkt="spaetestens", vs=KEINE: {"typ": "relativ", "bezug": {"ereignis": ereignis}, "versatz": versatz, "zeitpunkt": zeitpunkt, "je_ereignis": True, "verschiebung": vs}
SOFORT = v("profil.personal.sofortmeldebranchen", "enthaelt_eines", ["bau", "gastronomie", "personenbefoerderung", "gebaeudereinigung", "messebau", "fleischwirtschaft", "sicherheitsgewerbe"], "Dein Betrieb gehört zu einer Branche mit Sofortmeldepflicht.")
MINIJOB = v("profil.beschaeftigte.minijob", ">=", 1, "Du beschäftigst Minijobber.")
# Zählweisen je Gesetz sind offen (G-05). Wer insgesamt unter der Schwelle liegt, liegt auch nach jeder Zählweise darunter.
SCHWELLE = lambda zaehlung, regelwert, text: {"all": [v("profil.beschaeftigte.gesamt", ">=", rw(regelwert), None), v(zaehlung, ">=", rw(regelwert), text)]}

pflicht("personal.betriebsnummer", "D.37", "Betriebsnummer beantragen",
  "Bevor du die erste Person einstellst, brauchst du eine Betriebsnummer von der Bundesagentur für Arbeit.",
  "Die Betriebsnummer identifiziert deinen Betrieb in allen Meldungen zur Sozialversicherung. Du beantragst sie beim Betriebsnummern-Service der Bundesagentur für Arbeit, bevor die erste Person bei dir anfängt.",
  ["§ 18i SGB IV"], "personal",
  {"any": [HAT_B, {"ereignis": "erste_einstellung", "op": "geplant", "label": t("Du planst die erste Einstellung.")}, {"ereignis": "erste_einstellung", "op": "eingetreten", "label": t("Du hast die erste Person eingestellt.")}]},
  {"typ": "relativ", "bezug": {"ereignis": "erste_einstellung"}, "versatz": "P0D", "zeitpunkt": "vor_beginn", "verschiebung": KEINE},
  "Bundesagentur für Arbeit, Betriebsnummern-Service", "portal", "hinweis",
  [q("Sozialgesetzbuch IV § 18i", "sgb_4/__18i.html")],
  ["„vor der ersten Einstellung“ als spätestens am Tag vor Arbeitsbeginn umgesetzt – bestätigen"], rg_ergaenzt=True, schwere="hoch", phase="gruendung",
  begriffe=[("Betriebsnummer", "Eine achtstellige Nummer, unter der dein Betrieb bei der Sozialversicherung geführt wird.")])

pflicht("personal.sv_anmeldung", "D.38", "Beschäftigte bei der Sozialversicherung anmelden",
  "Jede neue beschäftigte Person meldest du bei der Krankenkasse an.",
  "Die Anmeldung zur Sozialversicherung (DEÜV) geht an die Krankenkasse der beschäftigten Person, bei Minijobs an die Minijob-Zentrale. Die Meldung läuft über ein systemgeprüftes Lohnprogramm.",
  ["§ 28a SGB IV", "DEÜV"], "personal",
  EINSTELLUNG, JE("einstellung"), "Krankenkasse bzw. Minijob-Zentrale (über Lohnprogramm)", "partner", "partner",
  [q("Sozialgesetzbuch IV § 28a", "sgb_4/__28a.html")],
  ["Frist der Anmeldung steht nicht in der Spezifikation – als spätestens bei Beschäftigungsbeginn eingetragen, fachlich ersetzen"],
  voraussetzungen=["personal.betriebsnummer"], schwere="hoch", rg_ergaenzt=True)

pflicht("personal.sv_abmeldung", "D.38", "Beschäftigte bei der Sozialversicherung abmelden",
  "Endet eine Beschäftigung, meldest du die Person bei der Krankenkasse ab.",
  "Die Abmeldung (DEÜV) geht an die Krankenkasse bzw. die Minijob-Zentrale, über das Lohnprogramm.",
  ["§ 28a SGB IV", "DEÜV"], "personal",
  AUSTRITT, JE("austritt"), "Krankenkasse bzw. Minijob-Zentrale (über Lohnprogramm)", "partner", "partner",
  [q("Sozialgesetzbuch IV § 28a", "sgb_4/__28a.html")],
  ["Frist der Abmeldung steht nicht in der Spezifikation – als spätestens am Ende der Beschäftigung eingetragen, fachlich ersetzen"], schwere="hoch", rg_ergaenzt=True)

pflicht("personal.sv_jahresmeldung", "D.38", "Jahresmeldung zur Sozialversicherung",
  "Für jede beschäftigte Person geht einmal im Jahr eine Jahresmeldung an die Krankenkasse.",
  "Die Jahresmeldung (DEÜV) übermittelt das Lohnprogramm für alle, die über den Jahreswechsel beschäftigt sind.",
  ["§ 28a SGB IV", "DEÜV"], "personal",
  HAT_B, "dauerhaft", "Krankenkasse (über Lohnprogramm)", "partner", "partner",
  [q("Sozialgesetzbuch IV § 28a", "sgb_4/__28a.html")],
  ["Termin der Jahresmeldung als Regeldaten ergänzen (für den Jahreskalender I)"], rg_ergaenzt=True)

pflicht("personal.sofortmeldung", "D.38", "Sofortmeldung bei Arbeitsbeginn",
  "In deiner Branche meldest du neue Beschäftigte spätestens bei Arbeitsbeginn sofort an.",
  "In den Branchen nach § 28a Abs. 4 SGB IV – unter anderem Bau, Gastronomie, Personenbeförderung, Gebäudereinigung, Messebau, Fleischwirtschaft und Sicherheitsgewerbe – ist eine Sofortmeldung bei Arbeitsbeginn Pflicht.",
  ["§ 28a Abs. 4 SGB IV"], "personal",
  {"all": [SOFORT, EINSTELLUNG]}, JE("einstellung"), "Deutsche Rentenversicherung (über Lohnprogramm)", "partner", "partner",
  [q("Sozialgesetzbuch IV § 28a", "sgb_4/__28a.html")],
  ["„Bei Arbeitsbeginn“ als spätestens am Tag des Beginns umgesetzt – bestätigen", "Branchenliste vollständig (§ 28a Abs. 4 SGB IV)?"],
  voraussetzungen=["personal.betriebsnummer"], schwere="hoch", branchen=["bau", "gastronomie_lebensmittel", "transport_logistik"])

pflicht("personal.mindestlohn", "D.39", "Mindestlohn zahlen",
  "Du zahlst allen Beschäftigten mindestens den gesetzlichen Mindestlohn.",
  "Der Mindestlohn beträgt 13,90 € je Stunde ab 1.1.2026 und 14,60 € ab 1.1.2027. Amtlos führt die Werte mit Gültigkeitszeitraum.",
  ["MiLoG"], "personal",
  HAT_B, "dauerhaft", "Du selbst; Kontrolle durch den Zoll (Finanzkontrolle Schwarzarbeit)", "intern_dokumentieren", "hinweis",
  [q("Mindestlohngesetz", "milog/")],
  ["Ausnahmen (z. B. Azubis, Praktika) als Hinweis ergänzen?"], rg_ergaenzt=True, schwere="hoch", aktion={"art": "abhaken"})

pflicht("personal.minijob_grenze", "D.39", "Minijob-Grenze beachten",
  "Minijobber dürfen im Monat nicht mehr als die Minijob-Grenze verdienen: 603 € (2026), 633 € (2027).",
  "Die Minijob-Grenze ist an den Mindestlohn gekoppelt. Amtlos führt die Werte mit Gültigkeitszeitraum.",
  ["§ 8 SGB IV"], "personal",
  MINIJOB, "dauerhaft", "Minijob-Zentrale", "intern_dokumentieren", "hinweis",
  [q("Sozialgesetzbuch IV § 8", "sgb_4/__8.html")],
  ["Folgen bei Überschreiten (gelegentliches Überschreiten) ergänzen"], rg_ergaenzt=True, aktion={"art": "abhaken"})

pflicht("personal.lohnsteuer_anmeldung", "D.40", "Lohnsteuer anmelden",
  "Bis zum 10. nach Ende des Anmeldezeitraums meldest du die Lohnsteuer beim Finanzamt an.",
  "Den Anmeldezeitraum (monatlich, vierteljährlich oder jährlich) bestimmt das Finanzamt nach der Lohnsteuer des Vorjahres. Trag ihn in deinem Profil ein; Amtlos berechnet daraus die Termine.",
  ["§ 41a EStG"], "personal",
  {"all": [HAT_B, v("profil.personal.lohnsteuer_anmeldezeitraum", "vorhanden", label="Du hast deinen Anmeldezeitraum angegeben.")]},
  {"typ": "wiederkehrend",
   "rhythmus": {"waehle": [
     {"wenn": v("profil.personal.lohnsteuer_anmeldezeitraum", "==", "monatlich"), "dann": "monatlich"},
     {"wenn": v("profil.personal.lohnsteuer_anmeldezeitraum", "==", "quartalsweise"), "dann": "quartalsweise"},
   ], "sonst": "jaehrlich"},
   "faellig": {"art": "tag_nach_periodenende", "monate_nach": 1, "tag": 10}, "verschiebung": WERKTAG_LAND},
  "Finanzamt", "elster", "hinweis",
  [q("Einkommensteuergesetz § 41a", "estg/__41a.html")],
  ["Grenzen für den Anmeldezeitraum (nach Vorjahres-Lohnsteuer) stehen nicht in der Spezifikation – deshalb Angabe des Nutzers", "Verschiebung bei Fristende am Wochenende/Feiertag bestätigen"],
  rg_ergaenzt=True, schwere="hoch", wiederholung={"art": "periodisch"})

pflicht("personal.anmeldezeitraum_angeben", "D.40", "Anmeldezeitraum der Lohnsteuer angeben",
  "Damit Amtlos die Termine der Lohnsteuer-Anmeldung berechnen kann, brauchst du den Anmeldezeitraum.",
  "Den Anmeldezeitraum teilt dir das Finanzamt mit. Du findest ihn in deinen Unterlagen zur Lohnsteuer oder fragst deine Steuerberatung.",
  ["§ 41a EStG"], "personal",
  {"all": [HAT_B, v("profil.personal.lohnsteuer_anmeldezeitraum", "nicht_vorhanden", label="Der Anmeldezeitraum fehlt noch.")]},
  "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Einkommensteuergesetz § 41a", "estg/__41a.html")],
  ["Vorbereitender Schritt – Darstellung bestätigen"], rg_ergaenzt=True, sanktion="Ohne Anmeldezeitraum kann Amtlos keine Termine berechnen.",
  aktion={"art": "formular", "ziel": "onboarding.beschaeftigte"})

pflicht("personal.sv_beitraege", "D.40", "Sozialversicherungsbeiträge zahlen",
  "Die Beiträge zur Sozialversicherung sind am drittletzten Bankarbeitstag des Monats fällig.",
  "Fällig sind die Beiträge am drittletzten Bankarbeitstag des laufenden Monats. Das Lohnprogramm berechnet sie; die Krankenkassen ziehen sie in der Regel ein.",
  ["§ 23 SGB IV"], "personal",
  HAT_B, {"typ": "wiederkehrend", "rhythmus": "monatlich", "faellig": {"art": "n_letzter_bankarbeitstag", "n": 3}, "verschiebung": {"regel": "keine", "kalender": "bankarbeitstage"}},
  "Krankenkassen", "partner", "partner",
  [q("Sozialgesetzbuch IV § 23", "sgb_4/__23.html")],
  ["Minijobs: Fälligkeit bei der Minijob-Zentrale gleich?"], rg_ergaenzt=True, schwere="hoch", wiederholung={"art": "periodisch"})

pflicht("personal.beitragsnachweis", "D.40", "Beitragsnachweis übermitteln",
  "Zwei Arbeitstage vor Fälligkeit der Beiträge übermittelst du den Beitragsnachweis an die Krankenkassen.",
  "Der Beitragsnachweis kündigt der Krankenkasse die Beiträge an. Er muss zwei Arbeitstage vor dem Fälligkeitstag vorliegen und wird vom Lohnprogramm übermittelt.",
  ["§ 28f SGB IV"], "personal",
  HAT_B, {"typ": "wiederkehrend", "rhythmus": "monatlich", "faellig": {"art": "n_letzter_bankarbeitstag", "n": 3, "arbeitstage_vorher": 2}, "verschiebung": {"regel": "keine", "kalender": "bankarbeitstage"}},
  "Krankenkassen (über Lohnprogramm)", "partner", "partner",
  [q("Sozialgesetzbuch IV § 28f", "sgb_4/__28f.html")],
  ["„Arbeitstage“ als Bankarbeitstage umgesetzt – bestätigen (G-13)"], rg_ergaenzt=True, schwere="hoch", wiederholung={"art": "periodisch"})

pflicht("personal.umlagen_eau", "D.40", "Umlagen U1/U2/U3 und eAU-Abruf",
  "Für Beschäftigte zahlst du Umlagen (U1, U2, U3) und rufst Arbeitsunfähigkeitsbescheinigungen elektronisch ab.",
  "Die Umlagen finanzieren die Erstattung von Entgeltfortzahlung, Mutterschaftsleistungen und das Insolvenzgeld. Die eAU rufst du bei der Krankenkasse ab, meist über das Lohnprogramm.",
  ["AAG", "§ 109 SGB IV"], "personal",
  HAT_B, "dauerhaft", "Krankenkassen", "partner", "hinweis",
  [q("Aufwendungsausgleichsgesetz", "aag/")],
  ["Welche Umlage gilt für wen (z. B. U1 nach Betriebsgröße) – fachlich ergänzen"], rg_ergaenzt=True,
  begriffe=[("eAU", "Elektronische Arbeitsunfähigkeitsbescheinigung, die du bei der Krankenkasse abrufst.")])

pflicht("personal.nachweisgesetz", "D.41", "Arbeitsbedingungen schriftlich festhalten",
  "Für jede neue beschäftigte Person hältst du die wesentlichen Arbeitsbedingungen schriftlich oder in zulässiger Form fest.",
  "Das Nachweisgesetz verlangt, dass die wesentlichen Arbeitsbedingungen dokumentiert und der beschäftigten Person ausgehändigt werden.",
  ["NachwG"], "personal",
  EINSTELLUNG, JE("einstellung"), "Du selbst", "intern_dokumentieren", "dokument_generator",
  [q("Nachweisgesetz", "nachwg/")],
  ["Frist (je Angabe unterschiedlich) steht nicht in der Spezifikation – als spätestens bei Beginn eingetragen, fachlich ersetzen", "Zulässige Form (Schriftform/elektronisch) aktuell?"],
  schwere="mittel", aktion={"art": "dokument", "ziel": "vorlage.nachweis_arbeitsbedingungen"})

pflicht("personal.arbeitszeit_aufzeichnung", "D.42", "Arbeitszeit aufzeichnen",
  "Du zeichnest die Arbeitszeit deiner Beschäftigten auf.",
  "Nach der Rechtsprechung des Bundesarbeitsgerichts besteht bereits eine Pflicht zur Arbeitszeiterfassung. Amtlos bietet eine Zeiterfassung, die auf die geplante Neuregelung vorbereitet ist.",
  ["§ 3 Abs. 2 Nr. 1 ArbSchG (BAG, 13.9.2022 – 1 ABR 22/21)"], "personal",
  HAT_B, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Arbeitsschutzgesetz § 3", "arbschg/__3.html")],
  ["Fundstelle der BAG-Entscheidung prüfen", "Anforderungen an die Form (bis zur Neuregelung) fachlich formulieren"], rg_ergaenzt=True,
  aktion={"art": "link", "ziel": "app.zeiterfassung"})

pflicht("personal.arbeitszeit_milog", "D.42", "Arbeitszeit nach § 17 MiLoG aufzeichnen",
  "Für Minijobber und in Sofortmeldebranchen musst du Beginn, Ende und Dauer der Arbeitszeit aufzeichnen.",
  "§ 17 MiLoG verlangt Aufzeichnungen für geringfügig Beschäftigte und für Beschäftigte in den Branchen mit Sofortmeldepflicht.",
  ["§ 17 MiLoG"], "personal",
  {"all": [HAT_B, {"any": [MINIJOB, SOFORT]}]}, "dauerhaft", "Du selbst; Kontrolle durch den Zoll", "intern_dokumentieren", "hinweis",
  [q("Mindestlohngesetz § 17", "milog/__17.html")],
  ["Fristen für Aufzeichnung und Aufbewahrung ergänzen"], schwere="hoch", aktion={"art": "link", "ziel": "app.zeiterfassung"})

pflicht("personal.arbeitszeit_neuregelung", "D.42", "Elektronische Arbeitszeiterfassung (geplante Neuregelung)",
  "Geplant ist eine Pflicht zur elektronischen Arbeitszeiterfassung, mit Übergangsfristen nach Betriebsgröße.",
  "Laut Entwurf (Juni 2026) soll ab 1.1.2027 elektronisch erfasst werden, mit Übergangsfristen nach Betriebsgröße; Betriebe bis 10 Beschäftigte sollen keine elektronische Pflicht haben. Noch kein Gesetz.",
  ["Entwurf zur Änderung des ArbZG (Juni 2026)"], "personal",
  {"all": [HAT_B, v("profil.beschaeftigte.gesamt", ">", 10, "Du beschäftigst mehr als 10 Personen.")]}, "dauerhaft", "–", "intern_dokumentieren", "hinweis",
  [q("Arbeitszeitgesetz", "arbzg/")],
  ["Status offen – Radar", "Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „mittel“)", "Schwelle 10 als Regelwert führen, sobald beschlossen"], status_recht="entwurf", gueltig_ab="2027-01-01",
  radar={"wahrscheinlichkeit": "mittel", "erwartet_ab": "2027-01-01"},
  sanktion="Noch keine – geplante Regelung.", schwere="mittel")

pflicht("personal.mutterschutz_gefaehrdungsbeurteilung", "D.43", "Mutterschutz in der Gefährdungsbeurteilung",
  "Unabhängig davon, ob jemand schwanger ist, beurteilst du die Arbeitsplätze auch nach dem Mutterschutzgesetz.",
  "Die anlassunabhängige Gefährdungsbeurteilung nach dem Mutterschutzgesetz ist Teil der allgemeinen Gefährdungsbeurteilung.",
  ["§ 10 MuSchG"], "personal",
  HAT_B, {"typ": "relativ", "bezug": {"ereignis": "erste_einstellung"}, "versatz": "P0D", "zeitpunkt": "vor_beginn", "verschiebung": KEINE},
  "Du selbst", "intern_dokumentieren", "dokument_generator",
  [q("Mutterschutzgesetz § 10", "muschg_2018/__10.html")],
  ["Frist „vor Arbeitsbeginn“ wie E.50 – bestätigen"], rg_ergaenzt=True, voraussetzungen=["arbeitsschutz.gefaehrdungsbeurteilung"])

pflicht("personal.schwangerschaft_mitteilung", "D.43", "Schwangerschaft der Aufsichtsbehörde mitteilen",
  "Teilt dir eine Beschäftigte ihre Schwangerschaft mit, informierst du die Aufsichtsbehörde.",
  "Die Mitteilung an die zuständige Aufsichtsbehörde ist Pflicht des Arbeitgebers.",
  ["§ 27 MuSchG"], "personal",
  {"ereignis": "schwangerschaft_mitgeteilt", "op": "eingetreten", "label": t("Eine Beschäftigte hat dir ihre Schwangerschaft mitgeteilt.")},
  JE("schwangerschaft_mitgeteilt"), "Aufsichtsbehörde für Mutterschutz (je Land)", "post", "hinweis",
  [q("Mutterschutzgesetz § 27", "muschg_2018/__27.html")],
  ["Frist („unverzüglich“) steht nicht in der Spezifikation – als am Tag der Mitteilung eingetragen, fachlich ersetzen", "Zuständige Behörde je Land"], rg_ergaenzt=True, schwere="hoch")

pflicht("personal.jugendarbeitsschutz", "D.44", "Jugendarbeitsschutz beachten",
  "Für Jugendliche gelten Erstuntersuchung, Arbeitszeitgrenzen und eine Aushangpflicht.",
  "Wer Jugendliche beschäftigt, braucht vorab eine ärztliche Erstuntersuchung, muss besondere Arbeitszeitgrenzen einhalten und das Jugendarbeitsschutzgesetz aushängen.",
  ["JArbSchG"], "personal",
  v("profil.beschaeftigte.jugendlich", ">=", 1, "Du beschäftigst Jugendliche."), "dauerhaft", "Du selbst; Gewerbeaufsicht", "intern_dokumentieren", "hinweis",
  [q("Jugendarbeitsschutzgesetz", "jarbschg/")],
  ["Erstuntersuchung als eigene Pflicht je Einstellung mit Frist?", "Arbeitszeitgrenzen als Regelwerte"], rg_ergaenzt=True, schwere="hoch")

pflicht("personal.schwerbehinderte_anzeige", "D.45", "Anzeige und Ausgleichsabgabe (Schwerbehinderte)",
  "Ab 20 Arbeitsplätzen zeigst du jedes Jahr bis 31.3. die Beschäftigung schwerbehinderter Menschen an und zahlst gegebenenfalls die Ausgleichsabgabe.",
  "Betriebe ab 20 Arbeitsplätzen haben eine Beschäftigungsquote. Die Anzeige und die Ausgleichsabgabe sind bis zum 31. März für das Vorjahr fällig.",
  ["SGB IX"], "personal",
  SCHWELLE("abgeleitet.beschaeftigte.arbeitsplaetze_sgb9", "personal.schwerbehinderte.schwelle_arbeitsplaetze", "Du hast mindestens 20 Arbeitsplätze im Sinne des SGB IX."),
  {"typ": "wiederkehrend", "rhythmus": "jaehrlich", "faellig": {"art": "feste_termine", "termine": ["03-31"]}, "verschiebung": WERKTAG_LAND},
  "Agentur für Arbeit / Integrationsamt", "portal", "hinweis",
  [q("Sozialgesetzbuch IX", "sgb_9_2018/")],
  ["Quote und Höhe der Abgabe als Regelwerte", "Zählweise der Arbeitsplätze (G-05); wer insgesamt weniger als 20 beschäftigt, gilt als unter der Schwelle – bestätigen", "Verschiebung bei 31.3. am Wochenende"],
  rg_ergaenzt=True, schwere="hoch", wiederholung={"art": "periodisch"})

pflicht("personal.hinweisgeber_meldestelle", "D.46", "Interne Meldestelle einrichten (Hinweisgeberschutz)",
  "Ab 50 Beschäftigten richtest du eine interne Meldestelle für Hinweisgeber ein.",
  "Das Hinweisgeberschutzgesetz verlangt ab 50 Beschäftigten eine interne Meldestelle.",
  ["HinSchG"], "personal",
  SCHWELLE("abgeleitet.beschaeftigte.zaehlung_hinschg", "personal.hinschg.schwelle", "Du hast mindestens 50 Beschäftigte im Sinne des HinSchG."),
  "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Hinweisgeberschutzgesetz", "hinschg/")],
  ["Zählweise (G-05)", "Übergangsregeln für 50–249 Beschäftigte noch relevant?"], rg_ergaenzt=True, schwere="hoch")

pflicht("personal.entgelttransparenz_bericht", "D.47", "Bericht zur Entgelttransparenz (geplant)",
  "Arbeitgeber mit mehr als 150 Beschäftigten sollen zum 7.6.2027 über die Entgeltgleichheit berichten.",
  "Die EU-Entgelttransparenzrichtlinie war bis 7.6.2026 umzusetzen; das deutsche Gesetz steht aus. Bis dahin gilt das bisherige Entgelttransparenzgesetz weiter.",
  ["Richtlinie (EU) 2023/970", "EntgTranspG"], "personal",
  {"all": [v("profil.beschaeftigte.gesamt", ">", rw("personal.entgelttransparenz.berichtspflicht_schwelle"), "Du beschäftigst mehr als 150 Personen.")]},
  {"typ": "absolut", "datum": "2027-06-07", "verschiebung": KEINE}, "–", "intern_dokumentieren", "hinweis",
  [q("Entgelttransparenzgesetz", "entgtranspg/")],
  ["Status offen – Radar", "Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „hoch“, weil EU-Richtlinie)", "Zählweise und Inhalt des Berichts nach Umsetzungsgesetz"], status_recht="geplant",
  radar={"wahrscheinlichkeit": "hoch", "erwartet_ab": "2027-06-07"}, sanktion="Noch keine – geplante Regelung.")

pflicht("personal.aushangpflichtige_gesetze", "D.48", "Aushangpflichtige Gesetze aushängen",
  "Je nach Belegschaft hängst du bestimmte Gesetze im Betrieb aus, zum Beispiel ArbZG, AGG, MuSchG und JArbSchG.",
  "Welche Gesetze auszuhängen sind, hängt von der Belegschaft ab. Amtlos stellt die Liste zusammen.",
  ["ArbZG", "AGG", "MuSchG", "JArbSchG"], "personal",
  HAT_B, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Arbeitszeitgesetz", "arbzg/")],
  ["Liste je Belegschaft (z. B. MuSchG ab wie vielen Frauen?) fachlich festlegen"], schwere="niedrig", aktion={"art": "abhaken"})

pflicht("personal.lohnabrechnung", "D.49", "Lohnabrechnung über geprüfte Software",
  "Meldungen zur Sozialversicherung erfordern zertifizierte Software – Amtlos arbeitet dafür mit einem Lohnpartner.",
  "Die Lohnabrechnung selbst macht ein systemgeprüfter Partner; Amtlos liefert Stammdaten und Fristen.",
  ["§ 18 DEÜV (Systemprüfung)"], "personal",
  HAT_B, "dauerhaft", "Lohnpartner oder Steuerberatung", "partner", "partner",
  [q("Datenerfassungs- und -übermittlungsverordnung", "de_v/")],
  ["Partner noch nicht gewählt (Abschnitt 5, Integration offen)"], rg_ergaenzt=True, sanktion="Ohne geprüfte Software sind die Meldungen nicht möglich.")

# ============================================================ E. Arbeitsschutz (E.50 Gefährdungsbeurteilung besteht bereits)

pflicht("arbeitsschutz.erstunterweisung", "E.51", "Vor Arbeitsbeginn unterweisen",
  "Jede neue Person unterweist du vor dem ersten Arbeitstag zu den Gefahren und Schutzmaßnahmen.",
  "Die Unterweisung erklärt die Gefährdungen am Arbeitsplatz und die Schutzmaßnahmen aus der Gefährdungsbeurteilung. Amtlos protokolliert sie digital mit Unterschrift.",
  ["§ 12 ArbSchG", "DGUV Vorschrift 1"], "arbeitsschutz",
  EINSTELLUNG, JE("einstellung", zeitpunkt="vor_beginn"), "Du selbst", "intern_dokumentieren", "dokument_generator",
  [q("Arbeitsschutzgesetz § 12", "arbschg/__12.html")],
  ["„vor Arbeitsaufnahme“ als spätestens am Tag davor umgesetzt – bestätigen"], schwere="hoch",
  voraussetzungen=["arbeitsschutz.gefaehrdungsbeurteilung"], aktion={"art": "link", "ziel": "app.unterweisungen", "nachweis_erforderlich": True})

pflicht("arbeitsschutz.unterweisung_wiederholen", "E.51", "Unterweisung jährlich wiederholen",
  "Mindestens einmal im Jahr wiederholst du die Unterweisung.",
  "Ein Jahr nach jeder Unterweisung erinnert Amtlos an die Wiederholung. Mit der neuen Unterweisung ist die alte erledigt.",
  ["§ 12 ArbSchG", "DGUV Vorschrift 1"], "arbeitsschutz",
  {"all": [HAT_B, {"ereignis": "unterweisung_durchgefuehrt", "op": "eingetreten", "label": t("Du hast eine Unterweisung durchgeführt.")}]},
  JE("unterweisung_durchgefuehrt", "P1Y"), "Du selbst", "intern_dokumentieren", "dokument_generator",
  [q("Arbeitsschutzgesetz § 12", "arbschg/__12.html")],
  ["„Mindestens jährlich“ als ein Jahr nach der letzten Unterweisung umgesetzt – bestätigen", "Kürzere Fristen für Jugendliche (JArbSchG) ergänzen"], schwere="mittel",
  aktion={"art": "link", "ziel": "app.unterweisungen", "nachweis_erforderlich": True})

pflicht("arbeitsschutz.fasi_betriebsarzt", "E.52", "Fachkraft für Arbeitssicherheit und Betriebsarzt",
  "Du brauchst eine sicherheitstechnische und betriebsärztliche Betreuung – für Kleinbetriebe auch im Unternehmermodell.",
  "Das Arbeitssicherheitsgesetz und die DGUV Vorschrift 2 verlangen eine Betreuung durch eine Fachkraft für Arbeitssicherheit und einen Betriebsarzt. Kleinbetriebe können das Unternehmermodell der Berufsgenossenschaft nutzen.",
  ["ASiG", "DGUV Vorschrift 2"], "arbeitsschutz",
  HAT_B, "dauerhaft", "Berufsgenossenschaft; Betreuungsdienst", "partner", "partner",
  [q("Arbeitssicherheitsgesetz", "asig/")],
  ["Grenzen für das Unternehmermodell je BG ergänzen"], rg_ergaenzt=True, schwere="hoch")

pflicht("arbeitsschutz.erste_hilfe", "E.53", "Erste Hilfe und Brandschutz organisieren",
  "Ab 2 Versicherten brauchst du Ersthelfer, Verbandmaterial und ein Verbandbuch; außerdem Brandschutzhelfer.",
  "Ersthelfer ab 2 Versicherten, Erste-Hilfe-Material, Verbandbuch und Brandschutzhelfer nach ASR A2.2.",
  ["DGUV Vorschrift 1", "ASR A2.2"], "arbeitsschutz",
  v("profil.beschaeftigte.gesamt", ">=", rw("arbeitsschutz.ersthelfer.schwelle_versicherte"), "Du hast mindestens 2 Versicherte."),
  "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("ASR A2.2", "https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A2-2.html")],
  ["„Versicherte“ = Beschäftigte? (Unternehmer zählt mit?)", "Anzahl Ersthelfer und Brandschutzhelfer je Betriebsgröße als Regelwerte"], rg_ergaenzt=True, schwere="mittel")

pflicht("arbeitsschutz.dguv_v3", "E.54", "Elektrische Geräte prüfen lassen",
  "Elektrische Geräte und Anlagen lässt du regelmäßig prüfen (DGUV Vorschrift 3).",
  "Elektrische Betriebsmittel müssen in bestimmten Abständen geprüft werden. Amtlos erinnert an die Prüffristen, sobald sie als Regeldaten hinterlegt sind.",
  ["DGUV Vorschrift 3"], "arbeitsschutz",
  {"all": [HAT_B, v("profil.arbeitsschutz.elektrische_geraete", "==", True, "Ihr nutzt elektrische Geräte im Betrieb.")]}, "dauerhaft", "Elektrofachkraft", "partner", "hinweis",
  [q("DGUV Vorschrift 3", "https://publikationen.dguv.de/regelwerk/dguv-vorschriften/")],
  ["Prüffristen je Geräteart als Regelwerte (nicht in der Spezifikation)"], schwere="mittel")

pflicht("arbeitsschutz.gefahrstoffe", "E.55", "Gefahrstoffverzeichnis und Betriebsanweisungen",
  "Wenn ihr mit Gefahrstoffen arbeitet, führst du ein Verzeichnis und schreibst Betriebsanweisungen.",
  "Die Gefahrstoffverordnung verlangt ein Verzeichnis der Gefahrstoffe und Betriebsanweisungen für die Beschäftigten.",
  ["GefStoffV"], "arbeitsschutz",
  {"all": [HAT_B, v("profil.arbeitsschutz.gefahrstoffe", "==", True, "Ihr arbeitet mit Gefahrstoffen.")]}, "dauerhaft", "Du selbst", "intern_dokumentieren", "dokument_generator",
  [q("Gefahrstoffverordnung", "gefstoffv_2010/")],
  [], rg_ergaenzt=False, schwere="hoch", branchen=["beauty_kosmetik", "handwerk", "bau"])

pflicht("arbeitsschutz.arbeitsmedizinische_vorsorge", "E.56", "Arbeitsmedizinische Vorsorge anbieten",
  "Du bietest arbeitsmedizinische Vorsorge an, zum Beispiel die Angebotsvorsorge bei Bildschirmarbeit.",
  "Die Verordnung zur arbeitsmedizinischen Vorsorge regelt Pflicht-, Angebots- und Wunschvorsorge. Bei Bildschirmarbeit ist Vorsorge anzubieten.",
  ["ArbMedVV"], "arbeitsschutz",
  HAT_B, "dauerhaft", "Betriebsarzt", "partner", "hinweis",
  [q("Verordnung zur arbeitsmedizinischen Vorsorge", "arbmedvv/")],
  ["Anlässe und Fristen je Vorsorgeart fachlich ergänzen"], rg_ergaenzt=False, schwere="mittel")

pflicht("arbeitsschutz.unfallanzeige", "E.57", "Arbeitsunfall der Berufsgenossenschaft anzeigen",
  "Ist jemand nach einem Arbeitsunfall mehr als drei Tage arbeitsunfähig, zeigst du den Unfall binnen drei Tagen der BG an.",
  "Die Unfallanzeige ist nötig, wenn die Arbeitsunfähigkeit mehr als drei Tage dauert. Amtlos legt die Frist ab dem Unfalltag an; ob die Grenze erreicht ist, entscheidest du beim Erledigen.",
  ["§ 193 SGB VII"], "arbeitsschutz",
  {"ereignis": "arbeitsunfall", "op": "eingetreten", "label": t("Es gab einen Arbeitsunfall.")},
  JE("arbeitsunfall", "P3D"), "Berufsgenossenschaft", "portal", "hinweis",
  [q("Sozialgesetzbuch VII § 193", "sgb_7/__193.html")],
  ["Fristbeginn: Unfalltag oder Kenntnis der AU über drei Tage? bestätigen", "AU-Tage aus dem Ereignis (Payload au_tage) in die Bedingung aufnehmen, sobald Ereignis-Payload auswertbar ist"],
  rg_ergaenzt=True, schwere="hoch")


# ============================================================ F. Datenschutz, IT-Sicherheit, KI (Bauabschnitt 6)

DATENARTEN = ["kundendaten", "beschaeftigtendaten", "gesundheitsdaten", "videoueberwachung", "newsletter", "tracking"]
VERARBEITET = {"any": [v("profil.datenverarbeitung.arten", "enthaelt_eines", DATENARTEN, "Du verarbeitest Daten über Menschen (z. B. Kunden oder Beschäftigte)."), HAT_B]}
DATENART = lambda art, text: v("profil.datenverarbeitung.arten", "enthaelt", art, text)
DSGVO = lambda art: q(f"DSGVO Art. {art}", f"https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679")
KI_VO = q("KI-Verordnung (EU) 2024/1689", "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R1689")
NIS2_JA = v("profil.nis2.betroffen", "==", "ja", "Dein Unternehmen fällt unter NIS2.")
KI_NUTZT = {"any": [v("profil.ki.nutzung", "==", True, "Ihr nutzt KI-Werkzeuge."), v("profil.ki.eigene_produkte", "==", True, "Ihr bietet eigene KI-Produkte an.")]}
KI_EIGEN = v("profil.ki.eigene_produkte", "==", True, "Ihr bietet eigene KI-Produkte oder -Funktionen an.")

pflicht("datenschutz.vvt", "F.58", "Verzeichnis der Verarbeitungstätigkeiten führen",
  "Du führst ein Verzeichnis, welche Daten über Menschen du wofür verarbeitest.",
  "Das Verzeichnis beschreibt je Verarbeitung Zweck, betroffene Personen, Datenarten, Empfänger und Löschfristen. Amtlos hilft beim Anlegen und erzeugt das Verzeichnis als PDF.",
  ["Art. 30 DSGVO"], "datenschutz",
  VERARBEITET, "dauerhaft", "Du selbst", "intern_dokumentieren", "dokument_generator",
  [DSGVO(30)],
  ["Ausnahme nach Art. 30 Abs. 5 DSGVO (unter 250 Beschäftigte) – wann greift sie? Darstellung prüfen"], schwere="mittel",
  begriffe=[("Verarbeitungstätigkeit", "Ein Vorgang, bei dem du Daten über Menschen nutzt, z. B. Kundenverwaltung oder Lohnabrechnung.")],
  aktion={"art": "link", "ziel": "app.vvt", "nachweis_erforderlich": True})

pflicht("datenschutz.tom", "F.58", "Technische und organisatorische Maßnahmen festlegen",
  "Du legst fest und dokumentierst, wie du die Daten schützt, zum Beispiel mit Verschlüsselung, Zugriffsrechten und Datensicherung.",
  "Die Maßnahmen (TOM) müssen dem Risiko angemessen sein. Amtlos gliedert sie nach den Schutzzielen der DSGVO; du trägst ein, was umgesetzt ist.",
  ["Art. 32 DSGVO"], "datenschutz",
  VERARBEITET, "dauerhaft", "Du selbst", "intern_dokumentieren", "dokument_generator",
  [DSGVO(32)],
  ["Gliederung nach Art. 32 Abs. 1 DSGVO – Wortlaut prüfen", "Vorschlagsliste typischer Maßnahmen für Kleinbetriebe fachlich erstellen"], schwere="mittel",
  begriffe=[("TOM", "Technische und organisatorische Maßnahmen zum Schutz personenbezogener Daten.")],
  aktion={"art": "link", "ziel": "app.tom", "nachweis_erforderlich": True})

pflicht("datenschutz.avv", "F.58", "Auftragsverarbeitungsverträge abschließen",
  "Mit Dienstleistern, die für dich Daten verarbeiten (z. B. Cloud, Lohnbüro, Newsletter-Tool), schließt du einen Auftragsverarbeitungsvertrag.",
  "Der Vertrag regelt, wie der Dienstleister die Daten nach deinen Weisungen verarbeitet. Amtlos führt die Liste deiner Dienstleister und legt die Verträge ab.",
  ["Art. 28 DSGVO"], "datenschutz",
  {"all": [VERARBEITET, v("profil.datenschutz.dienstleister", "==", True, "Du nutzt Dienstleister, die für dich Daten verarbeiten.")]},
  "dauerhaft", "Du selbst mit dem Dienstleister", "intern_dokumentieren", "hinweis",
  [DSGVO(28)],
  ["Abgrenzung Auftragsverarbeitung ↔ eigene Verantwortung (z. B. Steuerberatung) als Hinweis ergänzen"], schwere="mittel",
  begriffe=[("Auftragsverarbeitung", "Ein Dienstleister verarbeitet Daten in deinem Auftrag und nach deinen Weisungen.")],
  aktion={"art": "link", "ziel": "app.dienstleister"})

pflicht("datenschutz.informationspflichten", "F.58", "Über die Datenverarbeitung informieren",
  "Wenn du Daten erhebst, informierst du die Menschen darüber – etwa in einer Datenschutzerklärung oder einem Informationsblatt.",
  "Die Information nennt unter anderem Zweck, Rechtsgrundlage, Empfänger, Speicherdauer und die Rechte der Betroffenen.",
  ["Art. 13 DSGVO", "Art. 14 DSGVO"], "datenschutz",
  VERARBEITET, "dauerhaft", "Du selbst", "intern_dokumentieren", "dokument_generator",
  [DSGVO(13)],
  ["Pflichtinhalte als Checkliste fachlich ergänzen", "Vorlage Datenschutzerklärung (6.4) erst nach Prüfung"], schwere="mittel")

pflicht("datenschutz.loeschkonzept", "F.58", "Löschkonzept festlegen",
  "Du legst fest, wann welche Daten gelöscht werden – unter Beachtung der Aufbewahrungsfristen.",
  "Daten dürfen nur so lange gespeichert werden, wie es für den Zweck nötig ist. Gesetzliche Aufbewahrungspflichten (z. B. für Rechnungen) gehen vor.",
  ["Art. 5 Abs. 1 lit. e DSGVO", "Art. 17 DSGVO"], "datenschutz",
  VERARBEITET, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [DSGVO(17)],
  ["Zusammenspiel mit Aufbewahrungsfristen (C.32, G-21) erläutern"], rg_ergaenzt=True, schwere="niedrig",
  aktion={"art": "link", "ziel": "app.vvt"})

pflicht("datenschutz.betroffenenanfrage", "F.59", "Anfrage einer betroffenen Person beantworten",
  "Fragt jemand nach seinen Daten oder verlangt Löschung, antwortest du innerhalb eines Monats.",
  "Betroffene haben unter anderem Rechte auf Auskunft, Berichtigung, Löschung und Widerspruch. Amtlos zeigt die Frist ab Eingang und führt die Anfrage bis zur Antwort.",
  ["Art. 12 Abs. 3 DSGVO", "Art. 15–22 DSGVO"], "datenschutz",
  {"ereignis": "betroffenenanfrage", "op": "eingetreten", "label": t("Eine betroffene Person hat eine Anfrage gestellt.")},
  JE("betroffenenanfrage", "P1M"), "Du selbst", "intern_dokumentieren", "hinweis",
  [DSGVO(12)],
  ["Verlängerung um zwei Monate bei komplexen Anfragen (Art. 12 Abs. 3 Satz 2) abbilden?", "Mehrere Anfragen am selben Tag ergeben eine Instanz (T-15)"], rg_ergaenzt=True, schwere="hoch",
  aktion={"art": "link", "ziel": "app.betroffenenanfragen"})

pflicht("datenschutz.datenpanne_meldung", "F.60", "Datenpanne der Aufsichtsbehörde melden",
  "Bei einer Datenpanne meldest du sie binnen 72 Stunden der Datenschutz-Aufsichtsbehörde.",
  "Die Frist beginnt, sobald du von der Panne erfährst. Keine Meldung ist nötig, wenn voraussichtlich kein Risiko für die Betroffenen besteht – das entscheidest und dokumentierst du. Amtlos zeigt einen Countdown und erstellt einen Meldeentwurf.",
  ["Art. 33 DSGVO"], "datenschutz",
  {"ereignis": "datenpanne", "op": "eingetreten", "label": t("Du hast eine Datenpanne entdeckt.")},
  JE("datenpanne", "P3D"), "Datenschutz-Aufsichtsbehörde des Landes", "portal", "dokument_generator",
  [DSGVO(33)],
  ["72 Stunden tagesgenau als 3 Tage ab dem Tag der Entdeckung umgesetzt; der Countdown in der App rechnet stundengenau – bestätigen", "Benachrichtigung der Betroffenen bei hohem Risiko (Art. 34) als eigene Pflicht?", "Zuständige Aufsichtsbehörde je Land"],
  schwere="hoch", sanktion="Die Folgen sind noch nicht fachlich erfasst.",
  aktion={"art": "link", "ziel": "app.datenpanne", "nachweis_erforderlich": True})

pflicht("datenschutz.dsb", "F.61", "Datenschutzbeauftragten benennen",
  "Sind in der Regel mindestens 20 Personen ständig mit der automatisierten Verarbeitung von Daten beschäftigt, benennst du einen Datenschutzbeauftragten.",
  "Die Pflicht folgt aus § 38 BDSG bzw. Art. 37 DSGVO. Die Bundesregierung plant, § 38 BDSG bis Ende 2026 zu streichen; ein Gesetz gibt es noch nicht.",
  ["§ 38 BDSG", "Art. 37 DSGVO"], "datenschutz",
  SCHWELLE("abgeleitet.beschaeftigte.zaehlung_bdsg38", "datenschutz.dsb.schwelle_personen", "Mindestens 20 Personen sind ständig mit automatisierter Datenverarbeitung beschäftigt."),
  "dauerhaft", "Du selbst; Meldung der Kontaktdaten an die Aufsichtsbehörde", "intern_dokumentieren", "hinweis",
  [q("Bundesdatenschutzgesetz § 38", "bdsg_2018/__38.html")],
  ["Zählweise „ständig mit automatisierter Verarbeitung“ (G-05)", "Benennungspflicht nach Art. 37 DSGVO unabhängig von der Zahl (z. B. Kerntätigkeit) als eigener Zweig?"], schwere="hoch")

pflicht("datenschutz.dsb_streichung", "F.61", "Wegfall der Schwelle nach § 38 BDSG (geplant)",
  "Die Bundesregierung plant, die Benennungspflicht ab 20 Personen nach § 38 BDSG zu streichen.",
  "Geplant bis Ende 2026, noch kein Gesetz. Die Pflichten nach Art. 37 DSGVO blieben bestehen.",
  ["§ 38 BDSG"], "datenschutz",
  SCHWELLE("abgeleitet.beschaeftigte.zaehlung_bdsg38", "datenschutz.dsb.schwelle_personen", "Mindestens 20 Personen sind ständig mit automatisierter Datenverarbeitung beschäftigt."),
  "dauerhaft", "–", "intern_dokumentieren", "hinweis",
  [q("Bundesdatenschutzgesetz § 38", "bdsg_2018/__38.html")],
  ["Status offen – Radar", "Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „mittel“)", "„bis Ende 2026“ als erwartet ab 31.12.2026 eingetragen"],
  status_recht="geplant", radar={"wahrscheinlichkeit": "mittel", "erwartet_ab": "2026-12-31"}, sanktion="Keine – geplante Erleichterung.", schwere="niedrig")

pflicht("datenschutz.dsfa", "F.62", "Prüfen, ob eine Datenschutz-Folgenabschätzung nötig ist",
  "Verarbeitest du besonders sensible Daten oder überwachst du mit Video, prüfst du, ob eine Datenschutz-Folgenabschätzung nötig ist.",
  "Bei voraussichtlich hohem Risiko für die Betroffenen ist vorab eine Folgenabschätzung durchzuführen und zu dokumentieren.",
  ["Art. 35 DSGVO"], "datenschutz",
  {"any": [DATENART("gesundheitsdaten", "Du verarbeitest Gesundheitsdaten."), DATENART("videoueberwachung", "Du setzt Videoüberwachung ein.")]},
  "dauerhaft", "Du selbst; ggf. Datenschutzbeauftragter", "intern_dokumentieren", "hinweis",
  [DSGVO(35)],
  ["Auslöser (Gesundheitsdaten, Video) sind eine Vorauswahl – Liste der Aufsichtsbehörden (Muss-Liste) einbeziehen"], schwere="hoch")

pflicht("datenschutz.videoueberwachung", "F.62", "Videoüberwachung kennzeichnen und begründen",
  "Wenn du Videoüberwachung einsetzt, machst du sie erkennbar und dokumentierst den Zweck.",
  "Videoüberwachung braucht einen berechtigten Zweck, muss erkennbar sein (Hinweisschild) und gehört ins Verzeichnis der Verarbeitungstätigkeiten.",
  ["§ 4 BDSG", "Art. 6, 13 DSGVO"], "datenschutz",
  DATENART("videoueberwachung", "Du setzt Videoüberwachung ein."), "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Bundesdatenschutzgesetz § 4", "bdsg_2018/__4.html")],
  ["Speicherdauer der Aufnahmen fachlich ergänzen", "Beschäftigte: Mitbestimmung/Information"], rg_ergaenzt=True, schwere="mittel")

pflicht("datenschutz.beschaeftigtendaten", "F.62", "Beschäftigtendaten schützen",
  "Daten deiner Beschäftigten verarbeitest du nur, soweit es für das Arbeitsverhältnis nötig ist.",
  "Für Beschäftigtendaten gelten besondere Regeln. Amtlos selbst speichert nur das Nötigste (Name, Beschäftigungsart, Eintritt und Austritt).",
  ["§ 26 BDSG", "Art. 88 DSGVO"], "datenschutz",
  {"any": [HAT_B, DATENART("beschaeftigtendaten", "Du verarbeitest Daten von Beschäftigten.")]}, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Bundesdatenschutzgesetz § 26", "bdsg_2018/__26.html")],
  ["Anwendbarkeit von § 26 BDSG nach der Rechtsprechung des EuGH (2023) prüfen"], rg_ergaenzt=True, schwere="niedrig")

pflicht("online.cookie_einwilligung", "F.63", "Einwilligung für Cookies und Tracking einholen",
  "Setzt deine Website Tracking oder nicht notwendige Cookies ein, holst du vorher die Einwilligung der Besucher ein.",
  "Nach § 25 TDDDG ist für das Speichern und Auslesen von Informationen auf dem Endgerät grundsätzlich eine Einwilligung nötig, außer es ist unbedingt erforderlich. Der Consent-Check deiner Website folgt mit dem Online-Check (Abschnitt 7).",
  ["§ 25 TDDDG"], "online",
  DATENART("tracking", "Deine Website nutzt Tracking."), "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz § 25", "ttdsg/__25.html")],
  ["URL des Gesetzes nach Umbenennung (TTDSG → TDDDG) prüfen"], schwere="hoch")

pflicht("it_sicherheit.nis2_pruefen", "F.64", "Prüfen, ob NIS2 für dich gilt",
  "Kläre, ob dein Unternehmen nach Sektor und Größe unter die NIS2-Regeln fällt.",
  "NIS2 betrifft Unternehmen bestimmter Sektoren ab einer bestimmten Größe. Wer betroffen ist, muss sich beim BSI registrieren und Sicherheitsvorfälle melden. Beantworte die Frage im Profil, sobald du es weißt.",
  ["NIS2-Richtlinie (EU) 2022/2555", "BSIG"], "it_sicherheit",
  {"any": [v("profil.nis2.betroffen", "nicht_vorhanden", label="Du hast noch nicht angegeben, ob NIS2 für dich gilt."),
           v("profil.nis2.betroffen", "==", "unklar", "Du bist unsicher, ob NIS2 für dich gilt.")]},
  "dauerhaft", "Du selbst; Hilfe beim BSI", "intern_dokumentieren", "hinweis",
  [q("NIS2-Richtlinie", "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32022L2555")],
  ["Sektoren und Größenschwellen stehen nicht in der Spezifikation – als Betroffenheitscheck fachlich ergänzen", "Vorbereitender Schritt – Darstellung bestätigen"], rg_ergaenzt=True,
  sanktion="Ohne diese Klärung bleibt offen, ob Registrierung und Meldepflichten gelten.", schwere="mittel",
  aktion={"art": "formular", "ziel": "onboarding.daten"})

pflicht("it_sicherheit.nis2_registrierung", "F.64", "Beim BSI registrieren (NIS2)",
  "Fällt dein Unternehmen unter NIS2, registrierst du es beim BSI. Die Nachfrist endete am 31.7.2026.",
  "Die Registrierung ist Voraussetzung für die Meldewege bei Sicherheitsvorfällen.",
  ["BSIG (NIS2UmsuCG)"], "it_sicherheit",
  NIS2_JA, {"typ": "absolut", "datum": "2026-07-31", "verschiebung": KEINE}, "Bundesamt für Sicherheit in der Informationstechnik (BSI)", "portal", "hinweis",
  [q("BSI-Gesetz", "bsig_2009/")],
  ["Fundstelle im BSIG nach NIS2-Umsetzung prüfen", "„Nachfrist“ – was gilt für Unternehmen, die erst später betroffen werden?"], rg_ergaenzt=True,
  sanktion="Bußgelder bis 10 Mio. € bzw. 2 % des Umsatzes sind möglich.", schwere="hoch")

pflicht("it_sicherheit.nis2_meldepflichten", "F.64", "Sicherheitsvorfälle melden (NIS2)",
  "Erhebliche Sicherheitsvorfälle meldest du dem BSI in festen Stufen und Fristen.",
  "Wer unter NIS2 fällt, muss erhebliche Sicherheitsvorfälle melden und Risikomanagement-Maßnahmen umsetzen. Die Geschäftsleitung haftet für die Umsetzung.",
  ["BSIG (NIS2UmsuCG)"], "it_sicherheit",
  NIS2_JA, "dauerhaft", "BSI", "portal", "hinweis",
  [q("BSI-Gesetz", "bsig_2009/")],
  ["Meldestufen und Fristen stehen nicht in der Spezifikation – fachlich ergänzen", "Haftung und Schulungspflicht der Geschäftsleitung als eigene Pflicht?"], rg_ergaenzt=True,
  sanktion="Bußgelder bis 10 Mio. € bzw. 2 % des Umsatzes sind möglich.", schwere="hoch")

pflicht("ki.kompetenz", "F.65", "KI-Kompetenz der Beschäftigten sicherstellen",
  "Wer im Unternehmen mit KI arbeitet, braucht ausreichende KI-Kompetenz – sorge für Schulung und halte sie fest.",
  "Die Pflicht nach Art. 4 KI-Verordnung gilt seit 2.2.2025, durchgesetzt wird sie ab August 2026. Amtlos bietet Schulungen mit Bestätigung als Nachweis.",
  ["Art. 4 KI-VO"], "ki",
  KI_NUTZT, "dauerhaft", "Du selbst", "intern_dokumentieren", "dokument_generator",
  [KI_VO],
  ["Inhalt und Umfang einer ausreichenden Schulung fachlich festlegen", "Genauer Beginn der Durchsetzung („ab August 2026“) – Datum ergänzen"], gueltig_ab="2025-02-02", schwere="mittel",
  begriffe=[("KI-Kompetenz", "Wissen und Fähigkeiten, um KI-Systeme sachkundig einzusetzen und ihre Chancen und Risiken zu kennen.")],
  aktion={"art": "link", "ziel": "app.schulungen", "nachweis_erforderlich": True})

pflicht("ki.transparenz", "F.65", "KI-Inhalte und KI-Interaktion kennzeichnen",
  "Ab 2.12.2026 gelten Transparenz- und Kennzeichnungspflichten, etwa für Chatbots und KI-erzeugte Inhalte.",
  "Nach Art. 50 KI-Verordnung müssen Menschen erkennen können, dass sie mit einer KI interagieren oder Inhalte KI-erzeugt sind.",
  ["Art. 50 KI-VO"], "ki",
  KI_EIGEN, {"typ": "absolut", "datum": "2026-12-02", "verschiebung": KEINE}, "Du selbst", "intern_dokumentieren", "hinweis",
  [KI_VO],
  ["Welche Fälle des Art. 50 treffen auf Kleinbetriebe zu (Chatbot, Deepfake, generierte Texte)?", "Nach dem 2.12.2026 auf in_kraft umstellen"], gueltig_ab="2026-12-02",
  status_recht="beschlossen", radar={"wahrscheinlichkeit": "sicher", "erwartet_ab": "2026-12-02"}, schwere="mittel")

pflicht("ki.hochrisiko", "F.65", "Pflichten für Hochrisiko-KI (verschoben)",
  "Für Hochrisiko-KI-Systeme gelten umfangreiche Pflichten – verschoben auf 2.12.2027 bzw. 2.8.2028.",
  "Der „Digital Omnibus“ hat die Hochrisiko-Pflichten verschoben. Betroffen sind vor allem Anbieter und Betreiber von KI in sensiblen Bereichen.",
  ["KI-VO, Kapitel III"], "ki",
  KI_EIGEN, "dauerhaft", "–", "intern_dokumentieren", "hinweis",
  [KI_VO],
  ["Status und Daten nach dem Digital Omnibus prüfen", "Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „hoch“)", "Welcher der beiden Termine gilt wofür?"],
  status_recht="beschlossen", radar={"wahrscheinlichkeit": "hoch", "erwartet_ab": "2027-12-02"}, sanktion="Noch keine – Pflichten gelten später.", schwere="mittel")


# ============================================================ G. Online, Handel und Produkte (Bauabschnitt 7)

B2C = v("profil.kunden.segmente", "enthaelt", "b2c", "Du verkaufst an Verbraucher.")
WEBSITE = {"any": [v("profil.online.website", "==", True, "Du hast eine Website."),
                   v("profil.vertrieb.kanaele", "enthaelt_eines", ["onlineshop", "app"], "Du verkaufst über einen Onlineshop oder eine App.")]}
FERNABSATZ = v("profil.vertrieb.kanaele", "enthaelt_eines", ["onlineshop", "marktplatz", "abo", "app"], "Du schließt Verträge online oder per App.")
ONLINESHOP = v("profil.vertrieb.kanaele", "enthaelt_eines", ["onlineshop", "app"], "Du verkaufst über einen Onlineshop oder eine App.")
PRODUKT = lambda art, text: v("profil.produkte.arten", "enthaelt", art, text)
WARE = v("profil.produkte.arten", "enthaelt_eines", ["physisch", "elektrogeraete", "batterien", "kosmetik", "lebensmittel"], "Du verkaufst Waren.")

pflicht("online.impressum", "G.66", "Impressum auf der Website",
  "Auf deiner Website stellst du ein Impressum mit den Pflichtangaben bereit – leicht erkennbar und immer erreichbar.",
  "Das Impressum nennt unter anderem Name, Anschrift und Kontakt, bei Gesellschaften auch Vertretung und Register. Der Online-Check prüft, ob es verlinkt ist.",
  ["§ 5 DDG"], "online",
  WEBSITE, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Digitale-Dienste-Gesetz § 5", "ddg/__5.html")],
  ["Pflichtangaben je Rechtsform als Checkliste fachlich ergänzen"], schwere="hoch",
  aktion={"art": "link", "ziel": "app.onlinecheck"})

pflicht("online.datenschutzerklaerung", "G.66", "Datenschutzerklärung auf der Website",
  "Auf deiner Website informierst du in einer Datenschutzerklärung über die Verarbeitung von Daten.",
  "Die Datenschutzerklärung muss von jeder Seite erreichbar sein. Inhaltlich folgt sie den Informationspflichten der DSGVO (Katalog F).",
  ["Art. 13 DSGVO"], "online",
  WEBSITE, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [DSGVO(13)],
  ["Vorlage erst nach fachlicher Prüfung (6.4)"], rg_ergaenzt=True, schwere="hoch",
  aktion={"art": "link", "ziel": "app.onlinecheck"})

pflicht("online.preisangaben", "G.67", "Preise richtig angeben",
  "Gegenüber Verbrauchern gibst du Gesamtpreise an, bei Waren nach Gewicht, Volumen oder Länge auch den Grundpreis.",
  "Die Preisangabenverordnung regelt, wie Preise gegenüber Verbrauchern anzugeben sind.",
  ["PAngV"], "online",
  B2C, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Preisangabenverordnung", "pangv_2022/")],
  ["Ausnahmen und Einzelheiten (z. B. Grundpreis-Einheiten) fachlich ergänzen"], schwere="mittel")

pflicht("online.widerrufsbelehrung", "G.68", "Über das Widerrufsrecht belehren",
  "Bei Verträgen mit Verbrauchern über Fernabsatz belehrst du über das Widerrufsrecht.",
  "Verbraucher haben bei Fernabsatzverträgen in der Regel ein Widerrufsrecht, über das du vor Vertragsschluss informieren musst.",
  ["§ 312d BGB", "§ 355 BGB"], "online",
  {"all": [B2C, FERNABSATZ]}, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Bürgerliches Gesetzbuch § 312d", "bgb/__312d.html")],
  ["Muster-Widerrufsbelehrung erst nach Prüfung", "Ausnahmen vom Widerrufsrecht als Hinweis"], rg_ergaenzt=True, schwere="hoch")

pflicht("online.button_loesung", "G.68", "Bestellbutton eindeutig beschriften (Button-Lösung)",
  "Der Button, mit dem Verbraucher kostenpflichtig bestellen, muss eindeutig auf die Zahlungspflicht hinweisen.",
  "Nach § 312j BGB kommt ohne eindeutige Beschriftung kein wirksamer Vertrag zustande.",
  ["§ 312j BGB"], "online",
  {"all": [B2C, ONLINESHOP]}, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Bürgerliches Gesetzbuch § 312j", "bgb/__312j.html")],
  ["Zulässige Beschriftungen als Beispiele ergänzen"], schwere="hoch")

pflicht("online.kuendigungsbutton", "G.68", "Kündigungsbutton bei Abos",
  "Können Verbraucher auf deiner Website Abos abschließen, brauchst du einen Kündigungsbutton.",
  "§ 312k BGB verlangt eine einfache Kündigungsmöglichkeit über die Website für Dauerschuldverhältnisse, die online geschlossen werden können.",
  ["§ 312k BGB"], "online",
  {"all": [B2C, v("profil.vertrieb.kanaele", "enthaelt", "abo", "Du bietest Abos an.")]}, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Bürgerliches Gesetzbuch § 312k", "bgb/__312k.html")],
  ["Vorgeschriebene Beschriftung und Ablauf (Bestätigungsseite) fachlich ergänzen"], schwere="hoch",
  aktion={"art": "link", "ziel": "app.onlinecheck"})

pflicht("online.widerrufsbutton", "G.68", "Widerrufsbutton für Online-Verträge",
  "Seit 19.6.2026 brauchen B2C-Online-Verträge mit Widerrufsrecht einen Widerrufsbutton – zweistufig, ohne Login, mit Eingangsbestätigung auf einem dauerhaften Datenträger.",
  "Verbraucher müssen den Widerruf online so einfach erklären können wie den Vertragsschluss.",
  ["BGB (Umsetzung der Richtlinie (EU) 2023/2673)"], "online",
  {"all": [B2C, FERNABSATZ]}, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Richtlinie (EU) 2023/2673", "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32023L2673")],
  ["Fundstelle im BGB nach Umsetzung ergänzen", "Beschriftung des Buttons fachlich ergänzen"], rg_ergaenzt=True, gueltig_ab="2026-06-19", schwere="hoch",
  aktion={"art": "link", "ziel": "app.onlinecheck"})

pflicht("online.vsbg_hinweis", "G.69", "Hinweis zur Verbraucherstreitbeilegung",
  "Mit mehr als 10 Beschäftigten informierst du auf Website und in AGB, ob du an Streitbeilegungsverfahren teilnimmst.",
  "Die Hinweispflicht nach § 36 VSBG gilt für Unternehmer mit mehr als 10 Beschäftigten, die eine Website unterhalten oder AGB verwenden.",
  ["§ 36 VSBG"], "online",
  {"all": [B2C, v("profil.beschaeftigte.gesamt", ">", rw("online.vsbg.schwelle_beschaeftigte")), v("abgeleitet.beschaeftigte.zaehlung_vsbg", ">", rw("online.vsbg.schwelle_beschaeftigte"), "Du hast mehr als 10 Beschäftigte im Sinne des VSBG.")]},
  "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Verbraucherstreitbeilegungsgesetz § 36", "vsbg/__36.html")],
  ["Zählweise (G-05)", "Auslöser „Website oder AGB“ – AGB sind nicht im Profil"], schwere="mittel")

pflicht("online.os_link", "G.69", "Link zur OS-Plattform prüfen",
  "Prüfe, ob der frühere Link zur Online-Streitbeilegungsplattform der EU auf deiner Website noch aktuell ist.",
  "Die Spezifikation verlangt, den Status des früheren OS-Plattform-Links zu prüfen und aktuell zu halten. Der Online-Check meldet, ob der Link auf deiner Website steht.",
  ["Verordnung (EU) Nr. 524/2013"], "online",
  {"all": [B2C, ONLINESHOP]}, "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Verordnung (EU) Nr. 524/2013", "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32013R0524")],
  ["Aktueller Status der OS-Plattform und der Linkpflicht – fachlich prüfen und Text anpassen"], rg_ergaenzt=True, schwere="niedrig",
  aktion={"art": "link", "ziel": "app.onlinecheck"})

pflicht("online.barrierefreiheit", "G.70", "Barrierefreiheit von Onlineshop und Buchungstools (BFSG)",
  "Seit 28.6.2025 müssen bestimmte Dienstleistungen wie Onlineshops barrierefrei sein – mit Barrierefreiheitserklärung.",
  "Ausgenommen sind Kleinstunternehmen mit weniger als 10 Beschäftigten und höchstens 2 Mio. € Umsatz oder Bilanzsumme – diese Ausnahme gilt für Dienstleistungen. Der Online-Check macht automatisierte Basistests nach WCAG.",
  ["BFSG"], "online",
  {"all": [B2C, ONLINESHOP, {"any": [
     {"all": [v("profil.beschaeftigte.gesamt", ">=", rw("online.bfsg.kleinst_beschaeftigte")), v("abgeleitet.beschaeftigte.zaehlung_bfsg", ">=", rw("online.bfsg.kleinst_beschaeftigte"), "Du hast mindestens 10 Beschäftigte im Sinne des BFSG.")]},
     v("profil.umsatz.vorjahr", ">", rw("online.bfsg.kleinst_umsatz"), "Dein Umsatz lag über 2 Mio. €.")]}]},
  "dauerhaft", "Marktüberwachung der Länder", "intern_dokumentieren", "hinweis",
  [q("Barrierefreiheitsstärkungsgesetz", "bfsg/")],
  ["Bilanzsumme als Alternative zum Umsatz fehlt im Profil", "Zählweise (G-05)", "Welche Dienstleistungen genau (Buchungstools, Bankdienste …) – Liste ergänzen"],
  gueltig_ab="2025-06-28", schwere="hoch", aktion={"art": "link", "ziel": "app.onlinecheck"})

pflicht("produkte.barrierefreiheit", "G.70", "Prüfen, ob deine Produkte unter das BFSG fallen",
  "Für bestimmte Produkte (z. B. Computer, Smartphones, E-Book-Reader) gelten Barrierefreiheitsanforderungen – die Kleinstunternehmen-Ausnahme gilt dafür nicht verlässlich.",
  "Das BFSG nennt die betroffenen Produkte abschließend. Prüfe, ob deine Produkte dazugehören.",
  ["BFSG"], "produkte",
  PRODUKT("elektrogeraete", "Du verkaufst Elektrogeräte."), "dauerhaft", "Du selbst; Hersteller", "intern_dokumentieren", "hinweis",
  [q("Barrierefreiheitsstärkungsgesetz", "bfsg/")],
  ["Produktliste (§ 1 BFSG) als Auswahl ergänzen"], gueltig_ab="2025-06-28", schwere="mittel")

pflicht("produkte.verpackung", "G.71", "Verpackungen registrieren und lizenzieren",
  "Bevor du verpackte Waren erstmals in Verkehr bringst, registrierst du dich im LUCID-Register und beteiligst dich an einem System.",
  "Das Verpackungsgesetz verlangt Registrierung bei der Zentralen Stelle Verpackungsregister (LUCID) und Systembeteiligung vor dem ersten Inverkehrbringen.",
  ["VerpackG"], "produkte",
  PRODUKT("verpackung", "Du bringst verpackte Waren in Verkehr."), "dauerhaft", "Zentrale Stelle Verpackungsregister (LUCID)", "portal", "hinweis",
  [q("Verpackungsgesetz", "verpackg/")],
  ["„Vor dem ersten Inverkehrbringen“ als Frist mit Ereignis abbilden?"], schwere="hoch")

pflicht("produkte.elektrogeraete", "G.72", "Elektrogeräte bei der stiftung ear registrieren",
  "Bevor du Elektrogeräte verkaufst, registrierst du dich bei der stiftung ear.",
  "Hersteller und Händler, die als Hersteller gelten, müssen sich nach dem ElektroG vor dem Verkauf registrieren.",
  ["ElektroG"], "produkte",
  PRODUKT("elektrogeraete", "Du verkaufst Elektrogeräte."), "dauerhaft", "stiftung elektro-altgeräte register (ear)", "portal", "hinweis",
  [q("Elektro- und Elektronikgerätegesetz", "elektrog_2015/")],
  ["Wer gilt als Hersteller (Import, Eigenmarke)?"], schwere="hoch")

pflicht("produkte.batterien", "G.72", "Batterien registrieren (BattDG)",
  "Bevor du Batterien oder Geräte mit Batterien verkaufst, registrierst du dich nach dem Batteriegesetz.",
  "Hersteller von Batterien müssen sich vor dem Inverkehrbringen registrieren.",
  ["BattDG"], "produkte",
  PRODUKT("batterien", "Du verkaufst Batterien oder Geräte mit Batterien."), "dauerhaft", "Zuständige Stelle nach BattDG", "portal", "hinweis",
  [q("Batterierecht-Durchführungsgesetz", "battdg/")],
  ["Zuständige Stelle und Registrierungsweg ergänzen"], schwere="hoch")

pflicht("produkte.gpsr", "G.73", "Produktsicherheit (GPSR): Angaben und verantwortliche Person",
  "Für Verbraucherprodukte brauchst du eine verantwortliche Person in der EU, Herstellerangaben und Sicherheitsinformationen – auch im Onlineshop.",
  "Die Produktsicherheitsverordnung gilt seit 13.12.2024. Im Onlineshop müssen Herstellerangaben und Sicherheitsinformationen beim Angebot stehen.",
  ["Verordnung (EU) 2023/988 (GPSR)"], "produkte",
  {"all": [B2C, WARE]}, "dauerhaft", "Du selbst; Hersteller", "intern_dokumentieren", "hinweis",
  [q("Verordnung (EU) 2023/988", "https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32023R0988")],
  ["Pflichten für Händler vs. Hersteller trennen", "Lebensmittel und Kosmetik haben eigene Regeln – Abgrenzung"], gueltig_ab="2024-12-13", schwere="hoch",
  aktion={"art": "link", "ziel": "app.onlinecheck"})

pflicht("online.marktplatz_angaben", "G.74", "Händlerangaben auf Marktplätzen",
  "Auf Online-Marktplätzen stellst du deine Händlerangaben vollständig bereit.",
  "Marktplätze verlangen Angaben zu deinem Unternehmen und zeigen sie Kunden an; viele davon sind gesetzlich vorgeschrieben.",
  ["§ 5 DDG", "Art. 30 DSA"], "online",
  v("profil.vertrieb.kanaele", "enthaelt", "marktplatz", "Du verkaufst über Online-Marktplätze."), "dauerhaft", "Du selbst", "intern_dokumentieren", "hinweis",
  [q("Digitale-Dienste-Gesetz § 5", "ddg/__5.html")],
  ["Rechtsgrundlagen ergänzt – prüfen"], rg_ergaenzt=True, schwere="mittel")

pflicht("online.dac7", "G.74", "Meldungen der Plattformen an das Finanzamt (DAC7) verstehen",
  "Marktplätze melden Verkäufer und Umsätze an das Bundeszentralamt für Steuern – deine Angaben in der Steuererklärung sollten dazu passen.",
  "Nach dem Plattformen-Steuertransparenzgesetz (DAC7) melden Plattformen bestimmte Verkäufer. Amtlos erklärt, was gemeldet wird.",
  ["PStTG"], "online",
  v("profil.vertrieb.kanaele", "enthaelt", "marktplatz", "Du verkaufst über Online-Marktplätze."), "dauerhaft", "–", "intern_dokumentieren", "hinweis",
  [q("Plattformen-Steuertransparenzgesetz", "psttg/")],
  ["Meldeschwellen der Plattformen nicht in der Spezifikation"], rg_ergaenzt=True, sanktion="Keine eigene Pflicht – Erklärung der Plattformmeldungen.", schwere="niedrig")

pflicht("produkte.geldwaesche_gueterhaendler", "G.75", "Geldwäschegesetz bei hohen Bargeschäften",
  "Als Güterhändler hast du bei Bargeschäften ab der Schwelle des Geldwäschegesetzes Sorgfaltspflichten.",
  "Dazu gehören unter anderem die Identifizierung der Vertragspartner und ein Risikomanagement. Die Schwelle steht im Gesetz; Amtlos führt sie nach fachlicher Prüfung als Regelwert.",
  ["GwG"], "produkte",
  {"all": [WARE, v("profil.handel.hohe_bargeschaefte", "==", True, "Du nimmst hohe Barzahlungen für Waren an.")]}, "dauerhaft", "Du selbst; Aufsicht der Länder", "intern_dokumentieren", "hinweis",
  [q("Geldwäschegesetz", "gwg_2017/")],
  ["Schwelle für Barzahlungen nicht in der Spezifikation – als Regelwert ergänzen", "Immobilien- und Finanzbranche als Branchenmodul (H)"], schwere="hoch")

print("geschrieben:", len(list(ZIEL.glob("*.yaml"))))
