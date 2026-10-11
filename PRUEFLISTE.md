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
| G-15 | Sammelbestätigung „vor dem Start erledigt“: Wortlaut und ob ein Hinweis zu Nachholpflichten nötig ist | RA | E-072 |

## Juristische Grundsatzfragen (blockieren Abschnitte)

| Nr. | Frage | Wer | blockiert |
|---|---|---|---|
| J-1 | ELSTER-Übermittlung über unseren Server mit Nutzerzertifikat noch Selbsthilfe nach StBerG? | RA/StB | 3, 4 |
| J-2 | Behörden-Postfach: Grenze allgemeine Erklärung ↔ Einzelfallprüfung (RDG) | RA | 9 |
| J-3 | Darstellung „nicht zutreffend“ / „trotzdem prüfen lassen“, Haftung | RA | Livegang 2 |
| J-4 | Marktplatz: Vergütungsmodell nach Berufsrecht | RA | 9 |

## Aus dem Katalog (automatisch aus `fachlich_zu_pruefen`)

Erzeugt mit `scripts/pruefliste.py`; 147 Punkte.

| Nr. | Objekt | Katalog-Nr. | Punkt |
|---|---|---|---|
| K-001 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | Frist: 'vor Arbeitsbeginn' als Auslegung bestätigen |
| K-002 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | Auslöser neu_ausloesen_bei: Liste der Anlässe vollständig? |
| K-003 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | gueltig_ab 1996-08-21 aus Spezifikation übernommen |
| K-004 | `gruendung.berufsgenossenschaft` | A.8 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen (früherer Text war nicht belegt) |
| K-005 | `gruendung.berufsgenossenschaft` | A.8 | Auslöser 'immer': gilt das für alle Rechtsformen und Freiberufler ohne Beschäftigte? Ausnahmen (z. B. andere Unfallversicherungsträger) erfassen |
| K-006 | `gruendung.berufsgenossenschaft` | A.8 | Fristbeginn: Gründungsdatum vs. Aufnahme der Tätigkeit |
| K-007 | `gruendung.elster_konto` | A.5 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-008 | `gruendung.elster_konto` | A.5 | Vorbereitender Schritt ohne eigene Rechtspflicht – Darstellung bestätigen |
| K-009 | `gruendung.elster_konto` | A.5 | Gilt für alle oder nur ohne Steuerberatung? |
| K-010 | `gruendung.erlaubnis_pruefen` | A.3 | Reisegewerbekarte (§ 55 GewO) als eigene Pflicht führen? |
| K-011 | `gruendung.erlaubnis_pruefen` | A.3 | Gaststättenrecht je Land: Zuständigkeit und Erlaubnisfreiheit einzelner Länder prüfen |
| K-012 | `gruendung.erlaubnis_pruefen` | A.3 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-013 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum im Profil? bestätigen |
| K-014 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Verschiebung bei Fristende am Wochenende/Feiertag festlegen |
| K-015 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-016 | `gruendung.gewerbeanzeige` | A.2 | Frist „bei Beginn“: als spätestens am Tag des Beginns umgesetzt – bestätigen |
| K-017 | `gruendung.gewerbeanzeige` | A.2 | Ummeldung und Abmeldung: Fristen ergänzen |
| K-018 | `gruendung.gewerbeanzeige` | A.2 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-019 | `gruendung.gruendungszuschuss` | A.13 | Weitere Förderungen (Spezifikation A.13) als eigene Einträge? |
| K-020 | `gruendung.gruendungszuschuss` | A.13 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-021 | `gruendung.handwerksrolle` | A.4 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-022 | `gruendung.handwerksrolle` | A.4 | Anlage B2 (handwerksähnliche Gewerbe): ebenfalls eintragungspflichtig im Sinne der Spezifikation? Verzeichnis statt Rolle? |
| K-023 | `gruendung.handwerksrolle` | A.4 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-024 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-025 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Information ohne Handlung – als Hinweis darstellen? |
| K-026 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Beitragstermine für den Jahreskalender (I) ergänzen |
| K-027 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-028 | `gruendung.krankenversicherung` | A.10 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-029 | `gruendung.krankenversicherung` | A.10 | Für welche Rechtsformen und Rollen (z. B. GmbH-Geschäftsführer) gilt das? |
| K-030 | `gruendung.krankenversicherung` | A.10 | Nebenerwerb: was genau ist zu melden? |
| K-031 | `gruendung.krankenversicherung` | A.10 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-032 | `gruendung.krankenversicherung` | A.10 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-033 | `gruendung.rentenversicherungspflicht` | A.11 | Liste der Gruppen vollständig (§ 2 SGB VI)? |
| K-034 | `gruendung.rentenversicherungspflicht` | A.11 | Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum? |
| K-035 | `gruendung.rentenversicherungspflicht` | A.11 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-036 | `gruendung.rundfunkbeitrag` | A.9 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-037 | `gruendung.rundfunkbeitrag` | A.9 | Gilt auch für Arbeitsräume in der eigenen Wohnung? |
| K-038 | `gruendung.rundfunkbeitrag` | A.9 | Höhe nach Zahl der Beschäftigten – Staffel als Regelwert? |
| K-039 | `gruendung.rundfunkbeitrag` | A.9 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-040 | `gruendung.rundfunkbeitrag` | A.9 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-041 | `gruendung.statusfeststellung` | A.12 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-042 | `gruendung.statusfeststellung` | A.12 | Option mit Risiko-Check (Spezifikation): Kriterien des Risiko-Checks fachlich festlegen |
| K-043 | `gruendung.statusfeststellung` | A.12 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-044 | `gruendung.taetigkeit_einordnen` | A.1 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-045 | `gruendung.taetigkeit_einordnen` | A.1 | Ist das eine Pflicht oder ein vorbereitender Schritt? Darstellung als Aufgabe bestätigen |
| K-046 | `gruendung.ust_idnr` | A.6 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-047 | `gruendung.ust_idnr` | A.6 | Nur bei B2B-Geschäft oder bei jedem EU-Geschäft? |
| K-048 | `gruendung.ust_idnr` | A.6 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-049 | `gruendung.ust_idnr` | A.6 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-050 | `steuern.aufbewahrung` | C.32 | Fristbeginn (Ende des Kalenderjahres) und Aufbewahrungsdauern als Regelwerte führen |
| K-051 | `steuern.aufbewahrung` | C.32 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-052 | `steuern.aufbewahrung` | C.32 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-053 | `steuern.bauabzugsteuer_freistellung` | C.35 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-054 | `steuern.bauabzugsteuer_freistellung` | C.35 | Auch Handwerksbetriebe mit Bauleistungen erfassen (Branche handwerk)? |
| K-055 | `steuern.bauabzugsteuer_freistellung` | C.35 | Gültigkeitsdauer der Bescheinigung und Erneuerung ergänzen |
| K-056 | `steuern.bauabzugsteuer_freistellung` | C.35 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-057 | `steuern.buchfuehrungspflicht` | C.28 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-058 | `steuern.buchfuehrungspflicht` | C.28 | e.K. und GmbH & Co. KG als HGB-buchführungspflichtig angenommen – bestätigen |
| K-059 | `steuern.buchfuehrungspflicht` | C.28 | Im Gründungsjahr und vor dem Start gibt es keine Vorjahreswerte – § 141-Grenzen dann als nicht überschritten behandelt |
| K-060 | `steuern.buchfuehrungspflicht` | C.28 | § 141 AO: Pflicht beginnt erst nach Mitteilung des Finanzamts – berücksichtigen |
| K-061 | `steuern.buchfuehrungspflicht` | C.28 | Grenze inklusive/exklusive |
| K-062 | `steuern.buchfuehrungspflicht` | C.28 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-063 | `steuern.e_rechnung_empfang` | C.30 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-064 | `steuern.e_rechnung_empfang` | C.30 | Gilt für alle Unternehmen, auch Kleinunternehmer – bestätigen |
| K-065 | `steuern.e_rechnung_empfang` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-066 | `steuern.e_rechnung_versand_2027` | C.30 | Maßgeblich ist der Umsatz 2026: bis 2026 wird auch die Prognose herangezogen – bestätigen |
| K-067 | `steuern.e_rechnung_versand_2027` | C.30 | Rechtsstatus und gueltig_ab festlegen |
| K-068 | `steuern.e_rechnung_versand_2027` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-069 | `steuern.e_rechnung_versand_2028` | C.30 | Rechtsstatus und gueltig_ab festlegen |
| K-070 | `steuern.e_rechnung_versand_2028` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-071 | `steuern.est_erklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-072 | `steuern.est_erklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-073 | `steuern.est_erklaerung` | C.27 | Personengesellschaften: Feststellungserklärung der Gesellschaft zusätzlich? |
| K-074 | `steuern.est_erklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-075 | `steuern.est_erklaerung` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-076 | `steuern.euer` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-077 | `steuern.euer` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-078 | `steuern.euer` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-079 | `steuern.euer` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-080 | `steuern.gewst_erklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-081 | `steuern.gewst_erklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-082 | `steuern.gewst_erklaerung` | C.27 | Freibetrag (C.34) als Regelwert führen |
| K-083 | `steuern.gewst_erklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-084 | `steuern.gewst_erklaerung` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-085 | `steuern.gobd_verfahrensdokumentation` | C.31 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-086 | `steuern.gobd_verfahrensdokumentation` | C.31 | Fundstelle des aktuellen GoBD-Schreibens ergänzen |
| K-087 | `steuern.gobd_verfahrensdokumentation` | C.31 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-088 | `steuern.gobd_verfahrensdokumentation` | C.31 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-089 | `steuern.kasse_tse_belegausgabe` | C.33 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-090 | `steuern.kasse_tse_belegausgabe` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-091 | `steuern.kassenmeldung` | C.33 | Bestandskassen (Meldefrist 31.7.2025): Pflicht für Kassen ohne gemeldetes Anschaffungsdatum abbilden |
| K-092 | `steuern.kassenmeldung` | C.33 | Verschiebung bei Fristende am Wochenende festlegen |
| K-093 | `steuern.kassenmeldung` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-094 | `steuern.kassenmeldung_ausserbetriebnahme` | C.33 | Mehrere Kassen: je Ereignis eine Meldung (derzeit Bezug auf die erste Außerbetriebnahme) |
| K-095 | `steuern.kassenmeldung_ausserbetriebnahme` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-096 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-097 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Vor dem Start gibt es keinen Vorjahresumsatz – Vorjahresgrenze dann nicht geprüft |
| K-098 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Prognose statt tatsächlicher Umsatz: bis Abschnitt 4 nur Profilangaben – Formulierung „nach deinen Angaben“ bestätigen |
| K-099 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Grenze inklusive/exklusive (K-18) |
| K-100 | `steuern.kleinunternehmerregelung` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-101 | `steuern.kleinunternehmerregelung` | C.23 | Echtzeit-Warnungen bei 80 % und 95 % (Spezifikation C.23) folgen in Abschnitt 4 mit Finanzdaten |
| K-102 | `steuern.rechnungen_pflichtangaben` | C.29 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-103 | `steuern.rechnungen_pflichtangaben` | C.29 | Liste der Pflichtangaben und Kleinbetragsgrenze als Inhalt ergänzen |
| K-104 | `steuern.rechnungen_pflichtangaben` | C.29 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-105 | `steuern.ust_jahreserklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-106 | `steuern.ust_jahreserklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-107 | `steuern.ust_jahreserklaerung` | C.27 | Kleinunternehmer: Erklärungspflicht prüfen |
| K-108 | `steuern.ust_jahreserklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-109 | `steuern.ust_sondervorauszahlung` | C.24 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-110 | `steuern.ust_sondervorauszahlung` | C.24 | Fälligkeitstermin und Bemessungsgrundlage der Sondervorauszahlung ergänzen (K-08) |
| K-111 | `steuern.ust_sondervorauszahlung` | C.24 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-112 | `steuern.ust_voranmeldung` | C.24 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen (früherer Text war nicht belegt) |
| K-113 | `steuern.ust_voranmeldung` | C.24 | Befreiung bis Grenze ist laut Spezifikation 'möglich' (Ermessen Finanzamt?) – Auslöser bildet das als 'gilt nicht' ab; Formulierung prüfen |
| K-114 | `steuern.ust_voranmeldung` | C.24 | Neugründer: Aussetzung der monatlichen Pflicht 2021–2026 (Radar) – Rhythmus im Gründungs- und Folgejahr festlegen |
| K-115 | `steuern.ust_voranmeldung` | C.24 | Sondervorauszahlung 1/11 bei monatlicher Dauerfristverlängerung als eigene Pflicht anlegen |
| K-116 | `steuern.ust_voranmeldung` | C.24 | Verschiebung auf nächsten Werktag und Feiertagskalender (Bundesland) bestätigen |
| K-117 | `steuern.ust_voranmeldung` | C.24 | gueltig_ab: Datum der heutigen Fassung der Grenzen eintragen |
| K-118 | `steuern.vorauszahlung_est_kst` | C.26 | Verschiebung auf den nächsten Werktag bei Zahlungsterminen bestätigen |
| K-119 | `steuern.vorauszahlung_est_kst` | C.26 | Schonfrist bei Überweisung erwähnen? |
| K-120 | `steuern.vorauszahlung_est_kst` | C.26 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-121 | `steuern.vorauszahlung_est_kst` | C.26 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-122 | `steuern.vorauszahlung_gewst` | C.26 | Verschiebung und Kalender (Gemeinde) bestätigen |
| K-123 | `steuern.vorauszahlung_gewst` | C.26 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-124 | `steuern.vorauszahlung_gewst` | C.26 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-125 | `steuern.zusammenfassende_meldung` | C.25 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-126 | `steuern.zusammenfassende_meldung` | C.25 | Meldezeitraum und Abgabefrist ergänzen |
| K-127 | `steuern.zusammenfassende_meldung` | C.25 | Kleinunternehmer ausgenommen? |
| K-128 | `steuern.zusammenfassende_meldung` | C.25 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-129 | `steuern.zusammenfassende_meldung` | C.25 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-130 | `personal.mindestlohn.stunde@1` | D.39 | Fundstelle der geltenden Anpassungsverordnung ergänzen |
| K-131 | `personal.mindestlohn.stunde@2` | D.39 | status_recht 'beschlossen' vs. 'in_kraft' (Verordnung bereits erlassen?) |
| K-132 | `personal.minijob.grenze_monat@1` | D.39 | Dynamische Kopplung an Mindestlohn: als Berechnung oder als gepflegter Wert führen? |
| K-133 | `steuern.ust_va.grenze_befreiung@1` | C.24 | gueltig_ab ist Platzhalter (Beginn Betrachtungszeitraum), tatsächliches Inkrafttreten der Grenze eintragen |
| K-134 | `steuern.ust_va.grenze_monatlich@1` | C.24 | gueltig_ab ist Platzhalter |
| K-135 | `steuern.ust_va.grenze_monatlich@1` | C.24 | Spezifikation: 'über 9.000 € monatlich' – Vergleich '>' bestätigen |
| K-136 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-137 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | Grenze inklusive oder exklusive ('max. 25.000 €')? |
| K-138 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-139 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | Gründungsjahr: abweichende Grenze 25.000 € als eigener Regelwert |
| K-140 | `steuern.ustg19.grenze_gruendungsjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-141 | `steuern.ustg19.grenze_gruendungsjahr@1` | C.23 | Grenze inklusive oder exklusive? |
| K-142 | `steuern.ao141.grenze_umsatz@1` | C.28 | gueltig_ab ist Platzhalter |
| K-143 | `steuern.ao141.grenze_umsatz@1` | C.28 | Bezugsjahr und Vergleich (> oder ≥) bestätigen |
| K-144 | `steuern.ao141.grenze_gewinn@1` | C.28 | gueltig_ab ist Platzhalter |
| K-145 | `steuern.ao141.grenze_gewinn@1` | C.28 | Bezugsjahr und Vergleich (> oder ≥) bestätigen |
| K-146 | `steuern.e_rechnung.grenze_vorjahresumsatz_2027@1` | C.30 | Übergangsregel-Fundstelle (§ 27 Abs. 38 UStG) ergänzt, nicht aus Spezifikation |
| K-147 | `steuern.e_rechnung.grenze_vorjahresumsatz_2027@1` | C.30 | gueltig_ab/gueltig_bis als Übergangszeitraum bestätigen |
