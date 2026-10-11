# PRÜFLISTE

Zentrale Liste aller Punkte mit `[FACHLICH ZU PRÜFEN]` (Spezifikation 14.4). Wer prüft: **StB** Steuerberater, **RA** Rechtsanwalt, **Sifa** Fachkraft für Arbeitssicherheit, **DSB** Datenschutz, **Tech** technisch.

Stand: 2026-10-11 (Bauabschnitt 2)

## Grundsätzliche Punkte

| Nr. | Punkt | Wer | Quelle |
|---|---|---|---|
| G-01 | Alle 75 Pflichten und alle Werte aus Spezifikation Abschnitt 4 sind ungeprüft übernommen (E-054). Jede braucht Vier-Augen-Freigabe. | StB/RA/Sifa | E-002 |
| G-02 | Zuordnung Kategorie → erforderliche Prüferqualifikation | RA | E-039 |
| G-03 | Fristverschiebung (Wochenende/Feiertag) und maßgeblicher Kalender je Pflicht | StB/RA | E-037 |
| G-04 | Kommunale Feiertage: vollständige Liste und Quelle | Tech | E-037, R-08 |
| G-05 | Zählweise der Beschäftigten je Gesetz (BDSG § 38, SGB IX, HinSchG, VSBG § 36, BFSG) | RA | fakten.json, R-07 |
| G-06 | Umsatzbegriff für die Kleinunternehmergrenze bei Echtzeit-Überwachung | StB | fakten.json |
| G-07 | Wortlaut und Darstellung von „nicht zutreffend“ und „Angabe fehlt“ | RA | J-3, E-033 |
| G-08 | Wo erscheint „ersetzt keine Steuer- oder Rechtsberatung“ (Vorschlag in 04-seitenstruktur) | RA | Spez. 8.4 |
| G-09 | Aufbewahrungs- und Löschfristen je Datenart in Amtlos selbst | StB/DSB | 02-datenmodell |
| G-10 | Audit-Log und DSGVO-Löschpflicht | DSB | R-11 |
| G-11 | Quellen-URLs abrufen und Fundstellen eintragen (aus der Arbeitsumgebung nicht erreichbar) | Redaktion | 05-risiken |
| G-12 | Feiertagsregeln der Länder in `packages/fristen/src/feiertage.ts` (inkl. Stichjahre Frauentag BE/MV, Weltkindertag TH, Reformationstag HB/HH/NI/SH) gegen die Landesgesetze prüfen; kommunale Feiertage (Augsburg, Fronleichnam in Teilen von SN/TH, Mariä Himmelfahrt in Teilen von BY) als Daten mit Quelle erfassen | Tech + RA | E-037, R-08 |
| G-13 | Was „Bankarbeitstag“ je Pflicht bedeutet (nur TARGET-Schließtage oder auch regionale Feiertage) | StB | fristen/feiertage.ts |
| G-14 | Bezugstag bei „vor Arbeitsbeginn“: spätestens der Tag davor (so umgesetzt) | Sifa/RA | docs/03 |
| G-16 | Startbestand A und C: Folgen bei Nichterfüllung fehlen in der Spezifikation fast überall – Platzhalter „noch nicht fachlich erfasst“ je Pflicht ersetzen | StB/RA | E-075 |
| G-17 | Startbestand A und C: Rechtsgrundlagen, die nicht in der Spezifikation stehen, wurden ergänzt und einzeln markiert | StB/RA | E-075 |
| G-18 | Jahreserklärungen (ESt, USt, GewSt, EÜR): Abgabefristen mit und ohne Steuerberatung als Regeldaten – bis dahin keine Termine im Jahreskalender | StB | E-075 |
| G-19 | Beschriftung der Erlaubnis-Optionen (§§ 30–55 GewO) im Onboarding prüfen | RA | fragen.ts |
| T-01 | Liefert der Identity-Provider nur bestätigte E-Mail-Adressen? Sonst `email_verified` in der API prüfen (Einladungen binden an die Adresse) | Tech | E-079 |
| T-02 | Einladungs-E-Mail: Wortlaut, Absender und ob ein Hinweis zum Datenschutz nötig ist (die Adresse stammt vom Einladenden) | DSB | E-079 |
| T-03 | Fragebogen zur steuerlichen Erfassung: Zuordnung der Profilangaben zu den Abschnitten des amtlichen Formulars | StB | E-086 |
| T-04 | Reihenfolge der Gründungsschritte für UG/GmbH (Notar, Stammkapital, Handelsregister, Gewerbeanzeige, Fragebogen) – bisher nur die Voraussetzungen aus dem Katalog, sonst nach Frist sortiert | RA/StB | E-087 |
| T-05 | Direkte ELSTER-Übermittlung: Herstellerregistrierung (ERiC) beantragen; hängt an J-1 | Tech/RA | E-086 |
| G-20 | Katalog B: Fristen (Transparenzregister, Gesellschafterliste, Jahresabschluss, § 15a InsO, AWV-Meldegrenze) fehlen in der Spezifikation – als Regeldaten ergänzen | RA/StB | E-087 |
| T-06 | Wortlaut des Kleinunternehmer-Hinweises auf Rechnungen („Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“) | StB | E-088 |
| T-07 | XRechnung BT-10 (Käuferreferenz): ohne Angabe des Kunden wird die Rechnungsnummer eingesetzt – zulässig? | StB/Tech | E-088 |
| T-08 | USt-Voranmeldung: Zuordnung der Summen zu den Kennzahlen des Formulars; Leistungs- oder Rechnungsdatum; Soll-/Ist-Versteuerung | StB | E-089 |
| T-09 | Pflichtangaben auf Rechnungen (§ 14 UStG) vollständig? Kleinbetragsrechnungen (C.29) sind noch nicht abgebildet | StB | E-088 |
| T-10 | Umsatzsteuersätze (Regelwerte `steuern.ust.satz_regel`, `…_ermaessigt`) stehen nicht in der Spezifikation – gegen das Gesetz prüfen | StB | E-088 |
| G-21 | Aufbewahrung (C.32): Fristbeginn und Lösch-/Freigabefristen für Belege und Rechnungen; bis zur Klärung wird nichts gelöscht | StB | E-088 |
| G-15 | Sammelbestätigung „vor dem Start erledigt“: Wortlaut und ob ein Hinweis zu Nachholpflichten nötig ist | RA | E-072 |

## Juristische Grundsatzfragen (blockieren Abschnitte)

| Nr. | Frage | Wer | blockiert |
|---|---|---|---|
| J-1 | ELSTER-Übermittlung über unseren Server mit Nutzerzertifikat noch Selbsthilfe nach StBerG? | RA/StB | 3, 4 |
| J-2 | Behörden-Postfach: Grenze allgemeine Erklärung ↔ Einzelfallprüfung (RDG) | RA | 9 |
| J-3 | Darstellung „nicht zutreffend“ / „trotzdem prüfen lassen“, Haftung | RA | Livegang 2 |
| J-4 | Marktplatz: Vergütungsmodell nach Berufsrecht | RA | 9 |

## Aus dem Katalog (automatisch aus `fachlich_zu_pruefen`)

Erzeugt mit `scripts/pruefliste.py`; 247 Punkte.

| Nr. | Objekt | Katalog-Nr. | Punkt |
|---|---|---|---|
| K-001 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | Frist: 'vor Arbeitsbeginn' als Auslegung bestätigen |
| K-002 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | Auslöser neu_ausloesen_bei: Liste der Anlässe vollständig? |
| K-003 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | gueltig_ab 1996-08-21 aus Spezifikation übernommen |
| K-004 | `gesellschaft.awv_meldung` | B.21 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-005 | `gesellschaft.awv_meldung` | B.21 | Meldegrenze als Regelwert erfassen (nicht in der Spezifikation) |
| K-006 | `gesellschaft.awv_meldung` | B.21 | Meldefrist ergänzen |
| K-007 | `gesellschaft.awv_meldung` | B.21 | Auch ohne Investoren bei Auslandszahlungen über der Grenze – weiterer Auslöser? |
| K-008 | `gesellschaft.awv_meldung` | B.21 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-009 | `gesellschaft.foerderprogramme` | B.22 | Option, keine Pflicht |
| K-010 | `gesellschaft.foerderprogramme` | B.22 | Matching-Kriterien und Fristen je Programm fachlich hinterlegen |
| K-011 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Frist für die Einreichung ergänzen |
| K-012 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-013 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-014 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-015 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Einzelne Vorschriften (z. B. § 2 GmbHG Form, § 5 Stammkapital, § 7 Einzahlung) zuordnen |
| K-016 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Online-Beurkundung: Voraussetzungen und Grenzen ergänzen |
| K-017 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-018 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-019 | `gesellschaft.gf_pflichten_haftung` | B.17 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-020 | `gesellschaft.gf_pflichten_haftung` | B.17 | Inhalt der Erklärung (welche Pflichten, § 43 GmbHG) fachlich festlegen – Spezifikation nennt nur „Pflichten und Haftung erklären“ |
| K-021 | `gesellschaft.gf_pflichten_haftung` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-022 | `gesellschaft.gf_pflichten_haftung` | B.17 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-023 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-024 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Kriterien (Beteiligung, Sperrminorität) nicht in der Spezifikation – nur als Hinweis auf die Statusfeststellung darstellen |
| K-025 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-026 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-027 | `gesellschaft.handelsregister_anmeldung` | B.15 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-028 | `gesellschaft.handelsregister_anmeldung` | B.15 | Einzelvorschriften (§§ 7, 8 GmbHG) zuordnen |
| K-029 | `gesellschaft.handelsregister_anmeldung` | B.15 | Haftung vor Eintragung (Vorgesellschaft) als Hinweis ergänzen? |
| K-030 | `gesellschaft.handelsregister_anmeldung` | B.15 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-031 | `gesellschaft.handelsregister_anmeldung` | B.15 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-032 | `gesellschaft.insolvenzantragspflicht` | B.17 | Fristen nach § 15a InsO als Regelwerte erfassen (Spezifikation: „Fristen aus Regeldaten“, Werte nicht genannt) |
| K-033 | `gesellschaft.insolvenzantragspflicht` | B.17 | Darstellung: allgemeine Information, keine Prüfung des Einzelfalls (RDG) |
| K-034 | `gesellschaft.insolvenzantragspflicht` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-035 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-036 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Hinweis laut Spezifikation – sensible Sektoren und Schwellen fachlich ergänzen |
| K-037 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Zuständiges Ministerium (Bezeichnung) aktuell? |
| K-038 | `gesellschaft.jahresabschluss` | B.18 | Fristen für Aufstellung und Feststellung als Regeldaten ergänzen |
| K-039 | `gesellschaft.jahresabschluss` | B.18 | Jährliche Wiederholung abbilden, sobald Fristen feststehen |
| K-040 | `gesellschaft.jahresabschluss` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-041 | `gesellschaft.jahresabschluss` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-042 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-043 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Option, keine Pflicht – Darstellung bestätigen |
| K-044 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Inhalt der Erklärung zu § 19a EStG und VSOP fachlich festlegen |
| K-045 | `gesellschaft.offenlegung` | B.18 | Frist „binnen 12 Monaten“ als 31.12. des Folgejahres umgesetzt (Kalenderjahr) – bestätigen |
| K-046 | `gesellschaft.offenlegung` | B.18 | Verschiebung bei Fristende am Wochenende/Feiertag festlegen |
| K-047 | `gesellschaft.offenlegung` | B.18 | Kleinstkapitalgesellschaft: Merkmale nicht in der Spezifikation – nur Hinweis auf Hinterlegung |
| K-048 | `gesellschaft.offenlegung` | B.18 | Erstes Rumpfgeschäftsjahr nach Gründung: Periodenbeginn prüfen |
| K-049 | `gesellschaft.offenlegung` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-050 | `gesellschaft.offenlegung` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-051 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Frist: Termin für abweichendes Geschäftsjahr berechnen (Angabe des Geschäftsjahresendes im Profil nötig) |
| K-052 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-053 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-054 | `gesellschaft.stammkapital_einzahlen` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-055 | `gesellschaft.stammkapital_einzahlen` | B.14 | Reihenfolge „vor der Anmeldung“ bestätigen |
| K-056 | `gesellschaft.stammkapital_einzahlen` | B.14 | UG: Volleinzahlung und Bareinlage (Spezifikation nennt nur „ab 1 €“) bestätigen |
| K-057 | `gesellschaft.stammkapital_einzahlen` | B.14 | Höhe der Einzahlung bei GmbH: Anteil je Geschäftsanteil oder insgesamt? |
| K-058 | `gesellschaft.stammkapital_einzahlen` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-059 | `gesellschaft.stammkapital_einzahlen` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-060 | `gesellschaft.transparenzregister` | B.16 | Einzelvorschriften (§§ 19, 20 GwG) zuordnen |
| K-061 | `gesellschaft.transparenzregister` | B.16 | Gilt auch für GmbH & Co. KG und Personengesellschaften – Auslöser erweitern? |
| K-062 | `gesellschaft.transparenzregister` | B.16 | Frist nach Gründung und bei Änderung ergänzen |
| K-063 | `gesellschaft.transparenzregister` | B.16 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-064 | `gesellschaft.transparenzregister` | B.16 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-065 | `gesellschaft.ug_ruecklage` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-066 | `gesellschaft.ug_ruecklage` | B.14 | Ende der Rücklagepflicht (Erreichen des GmbH-Stammkapitals) ergänzen |
| K-067 | `gesellschaft.ug_ruecklage` | B.14 | Verlustvortrag bei der Berechnung berücksichtigen? |
| K-068 | `gesellschaft.ug_ruecklage` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-069 | `gesellschaft.ug_ruecklage` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-070 | `gruendung.berufsgenossenschaft` | A.8 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen (früherer Text war nicht belegt) |
| K-071 | `gruendung.berufsgenossenschaft` | A.8 | Auslöser 'immer': gilt das für alle Rechtsformen und Freiberufler ohne Beschäftigte? Ausnahmen (z. B. andere Unfallversicherungsträger) erfassen |
| K-072 | `gruendung.berufsgenossenschaft` | A.8 | Fristbeginn: Gründungsdatum vs. Aufnahme der Tätigkeit |
| K-073 | `gruendung.elster_konto` | A.5 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-074 | `gruendung.elster_konto` | A.5 | Vorbereitender Schritt ohne eigene Rechtspflicht – Darstellung bestätigen |
| K-075 | `gruendung.elster_konto` | A.5 | Gilt für alle oder nur ohne Steuerberatung? |
| K-076 | `gruendung.erlaubnis_pruefen` | A.3 | Reisegewerbekarte (§ 55 GewO) als eigene Pflicht führen? |
| K-077 | `gruendung.erlaubnis_pruefen` | A.3 | Gaststättenrecht je Land: Zuständigkeit und Erlaubnisfreiheit einzelner Länder prüfen |
| K-078 | `gruendung.erlaubnis_pruefen` | A.3 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-079 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum im Profil? bestätigen |
| K-080 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Verschiebung bei Fristende am Wochenende/Feiertag festlegen |
| K-081 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-082 | `gruendung.gewerbeanzeige` | A.2 | Frist „bei Beginn“: als spätestens am Tag des Beginns umgesetzt – bestätigen |
| K-083 | `gruendung.gewerbeanzeige` | A.2 | Ummeldung und Abmeldung: Fristen ergänzen |
| K-084 | `gruendung.gewerbeanzeige` | A.2 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-085 | `gruendung.gruendungszuschuss` | A.13 | Weitere Förderungen (Spezifikation A.13) als eigene Einträge? |
| K-086 | `gruendung.gruendungszuschuss` | A.13 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-087 | `gruendung.handwerksrolle` | A.4 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-088 | `gruendung.handwerksrolle` | A.4 | Anlage B2 (handwerksähnliche Gewerbe): ebenfalls eintragungspflichtig im Sinne der Spezifikation? Verzeichnis statt Rolle? |
| K-089 | `gruendung.handwerksrolle` | A.4 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-090 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-091 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Information ohne Handlung – als Hinweis darstellen? |
| K-092 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Beitragstermine für den Jahreskalender (I) ergänzen |
| K-093 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-094 | `gruendung.krankenversicherung` | A.10 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-095 | `gruendung.krankenversicherung` | A.10 | Für welche Rechtsformen und Rollen (z. B. GmbH-Geschäftsführer) gilt das? |
| K-096 | `gruendung.krankenversicherung` | A.10 | Nebenerwerb: was genau ist zu melden? |
| K-097 | `gruendung.krankenversicherung` | A.10 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-098 | `gruendung.krankenversicherung` | A.10 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-099 | `gruendung.rentenversicherungspflicht` | A.11 | Liste der Gruppen vollständig (§ 2 SGB VI)? |
| K-100 | `gruendung.rentenversicherungspflicht` | A.11 | Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum? |
| K-101 | `gruendung.rentenversicherungspflicht` | A.11 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-102 | `gruendung.rundfunkbeitrag` | A.9 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-103 | `gruendung.rundfunkbeitrag` | A.9 | Gilt auch für Arbeitsräume in der eigenen Wohnung? |
| K-104 | `gruendung.rundfunkbeitrag` | A.9 | Höhe nach Zahl der Beschäftigten – Staffel als Regelwert? |
| K-105 | `gruendung.rundfunkbeitrag` | A.9 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-106 | `gruendung.rundfunkbeitrag` | A.9 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-107 | `gruendung.statusfeststellung` | A.12 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-108 | `gruendung.statusfeststellung` | A.12 | Option mit Risiko-Check (Spezifikation): Kriterien des Risiko-Checks fachlich festlegen |
| K-109 | `gruendung.statusfeststellung` | A.12 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-110 | `gruendung.taetigkeit_einordnen` | A.1 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-111 | `gruendung.taetigkeit_einordnen` | A.1 | Ist das eine Pflicht oder ein vorbereitender Schritt? Darstellung als Aufgabe bestätigen |
| K-112 | `gruendung.ust_idnr` | A.6 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-113 | `gruendung.ust_idnr` | A.6 | Nur bei B2B-Geschäft oder bei jedem EU-Geschäft? |
| K-114 | `gruendung.ust_idnr` | A.6 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-115 | `gruendung.ust_idnr` | A.6 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-116 | `steuern.aufbewahrung` | C.32 | Fristbeginn (Ende des Kalenderjahres) und Aufbewahrungsdauern als Regelwerte führen |
| K-117 | `steuern.aufbewahrung` | C.32 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-118 | `steuern.aufbewahrung` | C.32 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-119 | `steuern.bauabzugsteuer_freistellung` | C.35 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-120 | `steuern.bauabzugsteuer_freistellung` | C.35 | Auch Handwerksbetriebe mit Bauleistungen erfassen (Branche handwerk)? |
| K-121 | `steuern.bauabzugsteuer_freistellung` | C.35 | Gültigkeitsdauer der Bescheinigung und Erneuerung ergänzen |
| K-122 | `steuern.bauabzugsteuer_freistellung` | C.35 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-123 | `steuern.buchfuehrungspflicht` | C.28 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-124 | `steuern.buchfuehrungspflicht` | C.28 | e.K. und GmbH & Co. KG als HGB-buchführungspflichtig angenommen – bestätigen |
| K-125 | `steuern.buchfuehrungspflicht` | C.28 | Im Gründungsjahr und vor dem Start gibt es keine Vorjahreswerte – § 141-Grenzen dann als nicht überschritten behandelt |
| K-126 | `steuern.buchfuehrungspflicht` | C.28 | § 141 AO: Pflicht beginnt erst nach Mitteilung des Finanzamts – berücksichtigen |
| K-127 | `steuern.buchfuehrungspflicht` | C.28 | Grenze inklusive/exklusive |
| K-128 | `steuern.buchfuehrungspflicht` | C.28 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-129 | `steuern.e_bilanz` | B.18 | Frist (gekoppelt an die Steuererklärung) als Regeldaten ergänzen |
| K-130 | `steuern.e_bilanz` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-131 | `steuern.e_bilanz` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-132 | `steuern.e_rechnung_empfang` | C.30 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-133 | `steuern.e_rechnung_empfang` | C.30 | Gilt für alle Unternehmen, auch Kleinunternehmer – bestätigen |
| K-134 | `steuern.e_rechnung_empfang` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-135 | `steuern.e_rechnung_versand_2027` | C.30 | Maßgeblich ist der Umsatz 2026: bis 2026 wird auch die Prognose herangezogen – bestätigen |
| K-136 | `steuern.e_rechnung_versand_2027` | C.30 | Rechtsstatus und gueltig_ab festlegen |
| K-137 | `steuern.e_rechnung_versand_2027` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-138 | `steuern.e_rechnung_versand_2028` | C.30 | Rechtsstatus und gueltig_ab festlegen |
| K-139 | `steuern.e_rechnung_versand_2028` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-140 | `steuern.est_erklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-141 | `steuern.est_erklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-142 | `steuern.est_erklaerung` | C.27 | Personengesellschaften: Feststellungserklärung der Gesellschaft zusätzlich? |
| K-143 | `steuern.est_erklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-144 | `steuern.est_erklaerung` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-145 | `steuern.euer` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-146 | `steuern.euer` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-147 | `steuern.euer` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-148 | `steuern.euer` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-149 | `steuern.gewst_erklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-150 | `steuern.gewst_erklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-151 | `steuern.gewst_erklaerung` | C.27 | Freibetrag (C.34) als Regelwert führen |
| K-152 | `steuern.gewst_erklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-153 | `steuern.gewst_erklaerung` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-154 | `steuern.gobd_verfahrensdokumentation` | C.31 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-155 | `steuern.gobd_verfahrensdokumentation` | C.31 | Fundstelle des aktuellen GoBD-Schreibens ergänzen |
| K-156 | `steuern.gobd_verfahrensdokumentation` | C.31 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-157 | `steuern.gobd_verfahrensdokumentation` | C.31 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-158 | `steuern.kasse_tse_belegausgabe` | C.33 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-159 | `steuern.kasse_tse_belegausgabe` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-160 | `steuern.kassenmeldung` | C.33 | Bestandskassen (Meldefrist 31.7.2025): Pflicht für Kassen ohne gemeldetes Anschaffungsdatum abbilden |
| K-161 | `steuern.kassenmeldung` | C.33 | Verschiebung bei Fristende am Wochenende festlegen |
| K-162 | `steuern.kassenmeldung` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-163 | `steuern.kassenmeldung_ausserbetriebnahme` | C.33 | Mehrere Kassen: je Ereignis eine Meldung (derzeit Bezug auf die erste Außerbetriebnahme) |
| K-164 | `steuern.kassenmeldung_ausserbetriebnahme` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-165 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-166 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Vor dem Start gibt es keinen Vorjahresumsatz – Vorjahresgrenze dann nicht geprüft |
| K-167 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Prognose statt tatsächlicher Umsatz: bis Abschnitt 4 nur Profilangaben – Formulierung „nach deinen Angaben“ bestätigen |
| K-168 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Grenze inklusive/exklusive (K-18) |
| K-169 | `steuern.kleinunternehmer_warnung_80` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-170 | `steuern.kleinunternehmer_warnung_80` | C.23 | Umsatzbegriff für die Grenze (G-06): Summe der gestellten Rechnungen (netto, abzüglich Stornos) im Kalenderjahr nach Rechnungsdatum – bestätigen |
| K-171 | `steuern.kleinunternehmer_warnung_80` | C.23 | Warnstufen 80 % und 95 % aus der Spezifikation |
| K-172 | `steuern.kleinunternehmer_warnung_95` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-173 | `steuern.kleinunternehmer_warnung_95` | C.23 | Umsatzbegriff für die Grenze (G-06): Summe der gestellten Rechnungen (netto, abzüglich Stornos) im Kalenderjahr nach Rechnungsdatum – bestätigen |
| K-174 | `steuern.kleinunternehmer_warnung_95` | C.23 | Warnstufen 80 % und 95 % aus der Spezifikation |
| K-175 | `steuern.kleinunternehmerregelung` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-176 | `steuern.kleinunternehmerregelung` | C.23 | Echtzeit-Warnungen bei 80 % und 95 % (Spezifikation C.23) folgen in Abschnitt 4 mit Finanzdaten |
| K-177 | `steuern.kst_erklaerung` | B.19 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-178 | `steuern.kst_erklaerung` | B.19 | Abgabefristen mit und ohne Steuerberatung als Regeldaten (wie G-18) |
| K-179 | `steuern.kst_erklaerung` | B.19 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-180 | `steuern.kst_erklaerung` | B.19 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-181 | `steuern.rechnungen_pflichtangaben` | C.29 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-182 | `steuern.rechnungen_pflichtangaben` | C.29 | Liste der Pflichtangaben und Kleinbetragsgrenze als Inhalt ergänzen |
| K-183 | `steuern.rechnungen_pflichtangaben` | C.29 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-184 | `steuern.ust_jahreserklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-185 | `steuern.ust_jahreserklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-186 | `steuern.ust_jahreserklaerung` | C.27 | Kleinunternehmer: Erklärungspflicht prüfen |
| K-187 | `steuern.ust_jahreserklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-188 | `steuern.ust_sondervorauszahlung` | C.24 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-189 | `steuern.ust_sondervorauszahlung` | C.24 | Fälligkeitstermin und Bemessungsgrundlage der Sondervorauszahlung ergänzen (K-08) |
| K-190 | `steuern.ust_sondervorauszahlung` | C.24 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-191 | `steuern.ust_voranmeldung` | C.24 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen (früherer Text war nicht belegt) |
| K-192 | `steuern.ust_voranmeldung` | C.24 | Befreiung bis Grenze ist laut Spezifikation 'möglich' (Ermessen Finanzamt?) – Auslöser bildet das als 'gilt nicht' ab; Formulierung prüfen |
| K-193 | `steuern.ust_voranmeldung` | C.24 | Neugründer: Aussetzung der monatlichen Pflicht 2021–2026 (Radar) – Rhythmus im Gründungs- und Folgejahr festlegen |
| K-194 | `steuern.ust_voranmeldung` | C.24 | Sondervorauszahlung 1/11 bei monatlicher Dauerfristverlängerung als eigene Pflicht anlegen |
| K-195 | `steuern.ust_voranmeldung` | C.24 | Verschiebung auf nächsten Werktag und Feiertagskalender (Bundesland) bestätigen |
| K-196 | `steuern.ust_voranmeldung` | C.24 | gueltig_ab: Datum der heutigen Fassung der Grenzen eintragen |
| K-197 | `steuern.vorauszahlung_est_kst` | C.26 | Verschiebung auf den nächsten Werktag bei Zahlungsterminen bestätigen |
| K-198 | `steuern.vorauszahlung_est_kst` | C.26 | Schonfrist bei Überweisung erwähnen? |
| K-199 | `steuern.vorauszahlung_est_kst` | C.26 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-200 | `steuern.vorauszahlung_est_kst` | C.26 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-201 | `steuern.vorauszahlung_gewst` | C.26 | Verschiebung und Kalender (Gemeinde) bestätigen |
| K-202 | `steuern.vorauszahlung_gewst` | C.26 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-203 | `steuern.vorauszahlung_gewst` | C.26 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-204 | `steuern.zusammenfassende_meldung` | C.25 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-205 | `steuern.zusammenfassende_meldung` | C.25 | Meldezeitraum und Abgabefrist ergänzen |
| K-206 | `steuern.zusammenfassende_meldung` | C.25 | Kleinunternehmer ausgenommen? |
| K-207 | `steuern.zusammenfassende_meldung` | C.25 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-208 | `steuern.zusammenfassende_meldung` | C.25 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-209 | `gesellschaft.gmbh.stammkapital_mindest@1` | B.14 | gueltig_ab ist Platzhalter |
| K-210 | `gesellschaft.gmbh.stammkapital_mindest@1` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-211 | `gesellschaft.gmbh.mindesteinzahlung_anteil@1` | B.14 | Spezifikation: „mindestens Hälfte einzuzahlen“ – Bezug (Mindeststammkapital oder Summe der Anteile) und Einzahlung je Geschäftsanteil prüfen |
| K-212 | `gesellschaft.gmbh.mindesteinzahlung_anteil@1` | B.14 | Rechtsgrundlage ergänzt |
| K-213 | `gesellschaft.ug.stammkapital_mindest@1` | B.14 | gueltig_ab ist Platzhalter |
| K-214 | `gesellschaft.ug.stammkapital_mindest@1` | B.14 | Rechtsgrundlage ergänzt |
| K-215 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | gueltig_ab ist Platzhalter |
| K-216 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | Rechtsgrundlage ergänzt |
| K-217 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | Berechnungsbasis (Jahresüberschuss abzüglich Verlustvortrag) prüfen |
| K-218 | `personal.mindestlohn.stunde@1` | D.39 | Fundstelle der geltenden Anpassungsverordnung ergänzen |
| K-219 | `personal.mindestlohn.stunde@2` | D.39 | status_recht 'beschlossen' vs. 'in_kraft' (Verordnung bereits erlassen?) |
| K-220 | `personal.minijob.grenze_monat@1` | D.39 | Dynamische Kopplung an Mindestlohn: als Berechnung oder als gepflegter Wert führen? |
| K-221 | `steuern.ust_va.grenze_befreiung@1` | C.24 | gueltig_ab ist Platzhalter (Beginn Betrachtungszeitraum), tatsächliches Inkrafttreten der Grenze eintragen |
| K-222 | `steuern.ust_va.grenze_monatlich@1` | C.24 | gueltig_ab ist Platzhalter |
| K-223 | `steuern.ust_va.grenze_monatlich@1` | C.24 | Spezifikation: 'über 9.000 € monatlich' – Vergleich '>' bestätigen |
| K-224 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-225 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | Grenze inklusive oder exklusive ('max. 25.000 €')? |
| K-226 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-227 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | Gründungsjahr: abweichende Grenze 25.000 € als eigener Regelwert |
| K-228 | `steuern.ustg19.grenze_gruendungsjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-229 | `steuern.ustg19.grenze_gruendungsjahr@1` | C.23 | Grenze inklusive oder exklusive? |
| K-230 | `steuern.ao141.grenze_umsatz@1` | C.28 | gueltig_ab ist Platzhalter |
| K-231 | `steuern.ao141.grenze_umsatz@1` | C.28 | Bezugsjahr und Vergleich (> oder ≥) bestätigen |
| K-232 | `steuern.ao141.grenze_gewinn@1` | C.28 | gueltig_ab ist Platzhalter |
| K-233 | `steuern.ao141.grenze_gewinn@1` | C.28 | Bezugsjahr und Vergleich (> oder ≥) bestätigen |
| K-234 | `steuern.e_rechnung.grenze_vorjahresumsatz_2027@1` | C.30 | Übergangsregel-Fundstelle (§ 27 Abs. 38 UStG) ergänzt, nicht aus Spezifikation |
| K-235 | `steuern.e_rechnung.grenze_vorjahresumsatz_2027@1` | C.30 | gueltig_ab/gueltig_bis als Übergangszeitraum bestätigen |
| K-236 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-237 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-238 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | Fristbeginn (Ende des Kalenderjahres) als Regel ergänzen |
| K-239 | `steuern.aufbewahrung.buecher_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-240 | `steuern.aufbewahrung.buecher_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-241 | `steuern.aufbewahrung.geschaeftsbriefe_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-242 | `steuern.aufbewahrung.geschaeftsbriefe_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-243 | `steuern.ust.satz_regel@1` |  | [FACHLICH ZU PRÜFEN] Steuersatz steht nicht in der Spezifikation – vor Freigabe gegen das Gesetz prüfen |
| K-244 | `steuern.ust.satz_regel@1` |  | gueltig_ab ist Platzhalter |
| K-245 | `steuern.ust.satz_ermaessigt@1` |  | [FACHLICH ZU PRÜFEN] Steuersatz steht nicht in der Spezifikation – vor Freigabe gegen das Gesetz prüfen |
| K-246 | `steuern.ust.satz_ermaessigt@1` |  | Welche Leistungen ermäßigt sind, entscheidet der Nutzer – Hinweis/Hilfe fachlich formulieren |
| K-247 | `steuern.ust.satz_ermaessigt@1` |  | gueltig_ab ist Platzhalter |
