#!/usr/bin/env python3
"""
Erzeugt catalog/pflichten/*.yaml für Katalog A (Gründung) und C (Steuern) aus Spezifikation Abschnitt 4.

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
            voraussetzungen=None, gueltig_ab=None, rg_ergaenzt=False, branchen=None):
    pp = list(pruefpunkte)
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
        **({"voraussetzungen": voraussetzungen} if voraussetzungen else {}),
        "frist": frist,
        "wiederholung": wiederholung or {"art": "einmalig"},
        "stelle": t(stelle), "kanal": kanal, "kosten": None,
        "sanktion": {"text": t(sanktion), "schwere": schwere},
        "automatisierung": automatisierung,
        **({"aktion": aktion} if aktion else {}),
        "status_recht": "in_kraft", "gueltig_ab": gueltig_ab, "gueltig_bis": None,
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
           ]}]},
  "dauerhaft", "Finanzamt", "intern_dokumentieren", "hinweis",
  [q("Umsatzsteuergesetz § 19", "ustg_1980/__19.html")],
  ["Vor dem Start gibt es keinen Vorjahresumsatz – Vorjahresgrenze dann nicht geprüft", "Prognose statt tatsächlicher Umsatz: bis Abschnitt 4 nur Profilangaben – Formulierung „nach deinen Angaben“ bestätigen", "Grenze inklusive/exklusive (K-18)"],
  sanktion="Ab dem Umsatz über der Grenze fällt Umsatzsteuer an, auch wenn du sie nicht berechnet hast.", schwere="hoch",
  aktion={"art": "abhaken"})

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

print("geschrieben:", len(list(ZIEL.glob("*.yaml"))))
