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
| T-11 | XRechnung ohne USt-IdNr.: die Steuernummer wird als Verkäuferkennung (BT-29) eingesetzt, damit BR-CO-26 erfüllt ist – fachlich bestätigen | StB/Tech | E-088 |
| G-21 | Aufbewahrung (C.32): Fristbeginn und Lösch-/Freigabefristen für Belege und Rechnungen; bis zur Klärung wird nichts gelöscht | StB | E-088 |
| T-12 | Lohnpartner: Auswahl, Schnittstelle (Stammdaten, Zeiten), Rollenverteilung; bis dahin CSV-Export – Felder für das Lohnbüro bestätigen | StB/Produkt | E-090 |
| T-13 | Unterweisung: genügt die Bestätigung per eingetipptem Namen (einfache elektronische Signatur) als Nachweis gegenüber Aufsicht und BG? Inhalt des Protokolls | Sifa/RA | E-092 |
| T-14 | Zeiterfassung: Umfang der Aufzeichnungspflicht (MiLoG/Minijob, ArbZG), Aufbewahrungsdauer der Zeiteinträge, Pausenregeln; Löschung nach Fristablauf | RA/StB | E-092 |
| T-15 | `je_ereignis`: mehrere Einstellungen am selben Tag ergeben eine Instanz – genügt das für SV-Anmeldung/Sofortmeldung, oder je Person getrennt? | StB | E-091 |
| T-16 | Zählweise der Beschäftigten für das Profil (Azubis, Minijobs, Teilzeit anteilig?) je Gesetz – derzeit zählt jede Person voll | RA | E-090, G-05 |
| T-17 | Schwellenwert-Wächter: Wortlaut „zu prüfen“ und ob ein Hinweis zur Zählweise je Pflicht nötig ist | RA | E-093 |
| T-18 | Gefährdungsfaktoren: Gliederung und Wortlaut nach § 5 Abs. 3 ArbSchG; ergänzende Faktoren (z. B. Brand- und Explosionsgefährdung) | Sifa | E-094 |
| T-19 | Risikoeinstufung gering/mittel/hoch: genügt das, oder eine anerkannte Methode (z. B. Risikomatrix)? | Sifa | E-094 |
| T-20 | Branchenvorlagen für die Gefährdungsbeurteilung (Gastronomie, Handwerk, Büro, Handel) – Inhalte und Quellen (BG-Handlungshilfen) | Sifa/BG | E-094 |
| T-21 | Verbandbuch, Ersthelfer-Ausbildung, Unfallanzeige ab mehr als drei Tagen Arbeitsunfähigkeit: Unfallanzeige wird derzeit bei jedem gemeldeten Arbeitsunfall ausgelöst | Sifa/RA | Katalog E.57 |
| T-22 | VVT: Pflichtfelder nach Art. 30 DSGVO vollständig? Vorschlagsbezeichnungen aus dem Profil passend? | DSB | E-095 |
| T-23 | Datenpanne: 72 Stunden tagesgenau als 3 Tage im Katalog, stundengenau in der App; Gliederung des Meldeentwurfs nach Art. 33 Abs. 3; Benachrichtigung Betroffener (Art. 34) als eigene Pflicht | DSB/RA | E-095 |
| T-24 | TOM: Gliederung nach Art. 32 Abs. 1; Vorschlagsliste typischer Maßnahmen für Kleinbetriebe | DSB | E-095 |
| T-25 | KI-Kompetenz (Art. 4 KI-VO): Inhalt und Umfang einer ausreichenden Schulung; Gliederungsvorschlag im Formular prüfen | RA | E-095 |
| T-26 | NIS2: geführter Betroffenheitscheck (Sektoren, Größenschwellen), Meldestufen und -fristen, Pflichten der Geschäftsleitung | RA/Tech | E-095 |
| T-27 | Betroffenenanfragen: Verlängerung um zwei Monate, Identitätsprüfung, Speicherdauer der Anfragedaten | DSB | E-095 |
| G-15 | Sammelbestätigung „vor dem Start erledigt“: Wortlaut und ob ein Hinweis zu Nachholpflichten nötig ist | RA | E-072 |

## Juristische Grundsatzfragen (blockieren Abschnitte)

| Nr. | Frage | Wer | blockiert |
|---|---|---|---|
| J-1 | ELSTER-Übermittlung über unseren Server mit Nutzerzertifikat noch Selbsthilfe nach StBerG? | RA/StB | 3, 4 |
| J-2 | Behörden-Postfach: Grenze allgemeine Erklärung ↔ Einzelfallprüfung (RDG) | RA | 9 |
| J-3 | Darstellung „nicht zutreffend“ / „trotzdem prüfen lassen“, Haftung | RA | Livegang 2 |
| J-4 | Marktplatz: Vergütungsmodell nach Berufsrecht | RA | 9 |

## Aus dem Katalog (automatisch aus `fachlich_zu_pruefen`)

Erzeugt mit `scripts/pruefliste.py`; 438 Punkte.

| Nr. | Objekt | Katalog-Nr. | Punkt |
|---|---|---|---|
| K-001 | `arbeitsschutz.arbeitsmedizinische_vorsorge` | E.56 | Anlässe und Fristen je Vorsorgeart fachlich ergänzen |
| K-002 | `arbeitsschutz.arbeitsmedizinische_vorsorge` | E.56 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-003 | `arbeitsschutz.dguv_v3` | E.54 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-004 | `arbeitsschutz.dguv_v3` | E.54 | Prüffristen je Geräteart als Regelwerte (nicht in der Spezifikation) |
| K-005 | `arbeitsschutz.dguv_v3` | E.54 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-006 | `arbeitsschutz.erste_hilfe` | E.53 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-007 | `arbeitsschutz.erste_hilfe` | E.53 | „Versicherte“ = Beschäftigte? (Unternehmer zählt mit?) |
| K-008 | `arbeitsschutz.erste_hilfe` | E.53 | Anzahl Ersthelfer und Brandschutzhelfer je Betriebsgröße als Regelwerte |
| K-009 | `arbeitsschutz.erste_hilfe` | E.53 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-010 | `arbeitsschutz.erste_hilfe` | E.53 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-011 | `arbeitsschutz.erstunterweisung` | E.51 | „vor Arbeitsaufnahme“ als spätestens am Tag davor umgesetzt – bestätigen |
| K-012 | `arbeitsschutz.erstunterweisung` | E.51 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-013 | `arbeitsschutz.fasi_betriebsarzt` | E.52 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-014 | `arbeitsschutz.fasi_betriebsarzt` | E.52 | Grenzen für das Unternehmermodell je BG ergänzen |
| K-015 | `arbeitsschutz.fasi_betriebsarzt` | E.52 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-016 | `arbeitsschutz.fasi_betriebsarzt` | E.52 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-017 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | Frist: 'vor Arbeitsbeginn' als Auslegung bestätigen |
| K-018 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | Auslöser neu_ausloesen_bei: Liste der Anlässe vollständig? |
| K-019 | `arbeitsschutz.gefaehrdungsbeurteilung` | E.50 | gueltig_ab 1996-08-21 aus Spezifikation übernommen |
| K-020 | `arbeitsschutz.gefahrstoffe` | E.55 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-021 | `arbeitsschutz.gefahrstoffe` | E.55 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-022 | `arbeitsschutz.unfallanzeige` | E.57 | Fristbeginn: Unfalltag oder Kenntnis der AU über drei Tage? bestätigen |
| K-023 | `arbeitsschutz.unfallanzeige` | E.57 | AU-Tage aus dem Ereignis (Payload au_tage) in die Bedingung aufnehmen, sobald Ereignis-Payload auswertbar ist |
| K-024 | `arbeitsschutz.unfallanzeige` | E.57 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-025 | `arbeitsschutz.unfallanzeige` | E.57 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-026 | `arbeitsschutz.unterweisung_wiederholen` | E.51 | „Mindestens jährlich“ als ein Jahr nach der letzten Unterweisung umgesetzt – bestätigen |
| K-027 | `arbeitsschutz.unterweisung_wiederholen` | E.51 | Kürzere Fristen für Jugendliche (JArbSchG) ergänzen |
| K-028 | `arbeitsschutz.unterweisung_wiederholen` | E.51 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-029 | `datenschutz.avv` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-030 | `datenschutz.avv` | F.58 | Abgrenzung Auftragsverarbeitung ↔ eigene Verantwortung (z. B. Steuerberatung) als Hinweis ergänzen |
| K-031 | `datenschutz.avv` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-032 | `datenschutz.beschaeftigtendaten` | F.62 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-033 | `datenschutz.beschaeftigtendaten` | F.62 | Anwendbarkeit von § 26 BDSG nach der Rechtsprechung des EuGH (2023) prüfen |
| K-034 | `datenschutz.beschaeftigtendaten` | F.62 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-035 | `datenschutz.beschaeftigtendaten` | F.62 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-036 | `datenschutz.betroffenenanfrage` | F.59 | Verlängerung um zwei Monate bei komplexen Anfragen (Art. 12 Abs. 3 Satz 2) abbilden? |
| K-037 | `datenschutz.betroffenenanfrage` | F.59 | Mehrere Anfragen am selben Tag ergeben eine Instanz (T-15) |
| K-038 | `datenschutz.betroffenenanfrage` | F.59 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-039 | `datenschutz.betroffenenanfrage` | F.59 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-040 | `datenschutz.datenpanne_meldung` | F.60 | 72 Stunden tagesgenau als 3 Tage ab dem Tag der Entdeckung umgesetzt; der Countdown in der App rechnet stundengenau – bestätigen |
| K-041 | `datenschutz.datenpanne_meldung` | F.60 | Benachrichtigung der Betroffenen bei hohem Risiko (Art. 34) als eigene Pflicht? |
| K-042 | `datenschutz.datenpanne_meldung` | F.60 | Zuständige Aufsichtsbehörde je Land |
| K-043 | `datenschutz.dsb` | F.61 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-044 | `datenschutz.dsb` | F.61 | Zählweise „ständig mit automatisierter Verarbeitung“ (G-05) |
| K-045 | `datenschutz.dsb` | F.61 | Benennungspflicht nach Art. 37 DSGVO unabhängig von der Zahl (z. B. Kerntätigkeit) als eigener Zweig? |
| K-046 | `datenschutz.dsb` | F.61 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-047 | `datenschutz.dsb_streichung` | F.61 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-048 | `datenschutz.dsb_streichung` | F.61 | Status offen – Radar |
| K-049 | `datenschutz.dsb_streichung` | F.61 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „mittel“) |
| K-050 | `datenschutz.dsb_streichung` | F.61 | „bis Ende 2026“ als erwartet ab 31.12.2026 eingetragen |
| K-051 | `datenschutz.dsfa` | F.62 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-052 | `datenschutz.dsfa` | F.62 | Auslöser (Gesundheitsdaten, Video) sind eine Vorauswahl – Liste der Aufsichtsbehörden (Muss-Liste) einbeziehen |
| K-053 | `datenschutz.dsfa` | F.62 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-054 | `datenschutz.informationspflichten` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-055 | `datenschutz.informationspflichten` | F.58 | Pflichtinhalte als Checkliste fachlich ergänzen |
| K-056 | `datenschutz.informationspflichten` | F.58 | Vorlage Datenschutzerklärung (6.4) erst nach Prüfung |
| K-057 | `datenschutz.informationspflichten` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-058 | `datenschutz.loeschkonzept` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-059 | `datenschutz.loeschkonzept` | F.58 | Zusammenspiel mit Aufbewahrungsfristen (C.32, G-21) erläutern |
| K-060 | `datenschutz.loeschkonzept` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-061 | `datenschutz.loeschkonzept` | F.58 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-062 | `datenschutz.tom` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-063 | `datenschutz.tom` | F.58 | Gliederung nach Art. 32 Abs. 1 DSGVO – Wortlaut prüfen |
| K-064 | `datenschutz.tom` | F.58 | Vorschlagsliste typischer Maßnahmen für Kleinbetriebe fachlich erstellen |
| K-065 | `datenschutz.tom` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-066 | `datenschutz.videoueberwachung` | F.62 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-067 | `datenschutz.videoueberwachung` | F.62 | Speicherdauer der Aufnahmen fachlich ergänzen |
| K-068 | `datenschutz.videoueberwachung` | F.62 | Beschäftigte: Mitbestimmung/Information |
| K-069 | `datenschutz.videoueberwachung` | F.62 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-070 | `datenschutz.videoueberwachung` | F.62 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-071 | `datenschutz.vvt` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-072 | `datenschutz.vvt` | F.58 | Ausnahme nach Art. 30 Abs. 5 DSGVO (unter 250 Beschäftigte) – wann greift sie? Darstellung prüfen |
| K-073 | `datenschutz.vvt` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-074 | `gesellschaft.awv_meldung` | B.21 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-075 | `gesellschaft.awv_meldung` | B.21 | Meldegrenze als Regelwert erfassen (nicht in der Spezifikation) |
| K-076 | `gesellschaft.awv_meldung` | B.21 | Meldefrist ergänzen |
| K-077 | `gesellschaft.awv_meldung` | B.21 | Auch ohne Investoren bei Auslandszahlungen über der Grenze – weiterer Auslöser? |
| K-078 | `gesellschaft.awv_meldung` | B.21 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-079 | `gesellschaft.foerderprogramme` | B.22 | Option, keine Pflicht |
| K-080 | `gesellschaft.foerderprogramme` | B.22 | Matching-Kriterien und Fristen je Programm fachlich hinterlegen |
| K-081 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Frist für die Einreichung ergänzen |
| K-082 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-083 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-084 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-085 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Einzelne Vorschriften (z. B. § 2 GmbHG Form, § 5 Stammkapital, § 7 Einzahlung) zuordnen |
| K-086 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Online-Beurkundung: Voraussetzungen und Grenzen ergänzen |
| K-087 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-088 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-089 | `gesellschaft.gf_pflichten_haftung` | B.17 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-090 | `gesellschaft.gf_pflichten_haftung` | B.17 | Inhalt der Erklärung (welche Pflichten, § 43 GmbHG) fachlich festlegen – Spezifikation nennt nur „Pflichten und Haftung erklären“ |
| K-091 | `gesellschaft.gf_pflichten_haftung` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-092 | `gesellschaft.gf_pflichten_haftung` | B.17 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-093 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-094 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Kriterien (Beteiligung, Sperrminorität) nicht in der Spezifikation – nur als Hinweis auf die Statusfeststellung darstellen |
| K-095 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-096 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-097 | `gesellschaft.handelsregister_anmeldung` | B.15 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-098 | `gesellschaft.handelsregister_anmeldung` | B.15 | Einzelvorschriften (§§ 7, 8 GmbHG) zuordnen |
| K-099 | `gesellschaft.handelsregister_anmeldung` | B.15 | Haftung vor Eintragung (Vorgesellschaft) als Hinweis ergänzen? |
| K-100 | `gesellschaft.handelsregister_anmeldung` | B.15 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-101 | `gesellschaft.handelsregister_anmeldung` | B.15 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-102 | `gesellschaft.insolvenzantragspflicht` | B.17 | Fristen nach § 15a InsO als Regelwerte erfassen (Spezifikation: „Fristen aus Regeldaten“, Werte nicht genannt) |
| K-103 | `gesellschaft.insolvenzantragspflicht` | B.17 | Darstellung: allgemeine Information, keine Prüfung des Einzelfalls (RDG) |
| K-104 | `gesellschaft.insolvenzantragspflicht` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-105 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-106 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Hinweis laut Spezifikation – sensible Sektoren und Schwellen fachlich ergänzen |
| K-107 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Zuständiges Ministerium (Bezeichnung) aktuell? |
| K-108 | `gesellschaft.jahresabschluss` | B.18 | Fristen für Aufstellung und Feststellung als Regeldaten ergänzen |
| K-109 | `gesellschaft.jahresabschluss` | B.18 | Jährliche Wiederholung abbilden, sobald Fristen feststehen |
| K-110 | `gesellschaft.jahresabschluss` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-111 | `gesellschaft.jahresabschluss` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-112 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-113 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Option, keine Pflicht – Darstellung bestätigen |
| K-114 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Inhalt der Erklärung zu § 19a EStG und VSOP fachlich festlegen |
| K-115 | `gesellschaft.offenlegung` | B.18 | Frist „binnen 12 Monaten“ als 31.12. des Folgejahres umgesetzt (Kalenderjahr) – bestätigen |
| K-116 | `gesellschaft.offenlegung` | B.18 | Verschiebung bei Fristende am Wochenende/Feiertag festlegen |
| K-117 | `gesellschaft.offenlegung` | B.18 | Kleinstkapitalgesellschaft: Merkmale nicht in der Spezifikation – nur Hinweis auf Hinterlegung |
| K-118 | `gesellschaft.offenlegung` | B.18 | Erstes Rumpfgeschäftsjahr nach Gründung: Periodenbeginn prüfen |
| K-119 | `gesellschaft.offenlegung` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-120 | `gesellschaft.offenlegung` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-121 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Frist: Termin für abweichendes Geschäftsjahr berechnen (Angabe des Geschäftsjahresendes im Profil nötig) |
| K-122 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-123 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-124 | `gesellschaft.stammkapital_einzahlen` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-125 | `gesellschaft.stammkapital_einzahlen` | B.14 | Reihenfolge „vor der Anmeldung“ bestätigen |
| K-126 | `gesellschaft.stammkapital_einzahlen` | B.14 | UG: Volleinzahlung und Bareinlage (Spezifikation nennt nur „ab 1 €“) bestätigen |
| K-127 | `gesellschaft.stammkapital_einzahlen` | B.14 | Höhe der Einzahlung bei GmbH: Anteil je Geschäftsanteil oder insgesamt? |
| K-128 | `gesellschaft.stammkapital_einzahlen` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-129 | `gesellschaft.stammkapital_einzahlen` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-130 | `gesellschaft.transparenzregister` | B.16 | Einzelvorschriften (§§ 19, 20 GwG) zuordnen |
| K-131 | `gesellschaft.transparenzregister` | B.16 | Gilt auch für GmbH & Co. KG und Personengesellschaften – Auslöser erweitern? |
| K-132 | `gesellschaft.transparenzregister` | B.16 | Frist nach Gründung und bei Änderung ergänzen |
| K-133 | `gesellschaft.transparenzregister` | B.16 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-134 | `gesellschaft.transparenzregister` | B.16 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-135 | `gesellschaft.ug_ruecklage` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-136 | `gesellschaft.ug_ruecklage` | B.14 | Ende der Rücklagepflicht (Erreichen des GmbH-Stammkapitals) ergänzen |
| K-137 | `gesellschaft.ug_ruecklage` | B.14 | Verlustvortrag bei der Berechnung berücksichtigen? |
| K-138 | `gesellschaft.ug_ruecklage` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-139 | `gesellschaft.ug_ruecklage` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-140 | `gruendung.berufsgenossenschaft` | A.8 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen (früherer Text war nicht belegt) |
| K-141 | `gruendung.berufsgenossenschaft` | A.8 | Auslöser 'immer': gilt das für alle Rechtsformen und Freiberufler ohne Beschäftigte? Ausnahmen (z. B. andere Unfallversicherungsträger) erfassen |
| K-142 | `gruendung.berufsgenossenschaft` | A.8 | Fristbeginn: Gründungsdatum vs. Aufnahme der Tätigkeit |
| K-143 | `gruendung.elster_konto` | A.5 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-144 | `gruendung.elster_konto` | A.5 | Vorbereitender Schritt ohne eigene Rechtspflicht – Darstellung bestätigen |
| K-145 | `gruendung.elster_konto` | A.5 | Gilt für alle oder nur ohne Steuerberatung? |
| K-146 | `gruendung.erlaubnis_pruefen` | A.3 | Reisegewerbekarte (§ 55 GewO) als eigene Pflicht führen? |
| K-147 | `gruendung.erlaubnis_pruefen` | A.3 | Gaststättenrecht je Land: Zuständigkeit und Erlaubnisfreiheit einzelner Länder prüfen |
| K-148 | `gruendung.erlaubnis_pruefen` | A.3 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-149 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum im Profil? bestätigen |
| K-150 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Verschiebung bei Fristende am Wochenende/Feiertag festlegen |
| K-151 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-152 | `gruendung.gewerbeanzeige` | A.2 | Frist „bei Beginn“: als spätestens am Tag des Beginns umgesetzt – bestätigen |
| K-153 | `gruendung.gewerbeanzeige` | A.2 | Ummeldung und Abmeldung: Fristen ergänzen |
| K-154 | `gruendung.gewerbeanzeige` | A.2 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-155 | `gruendung.gruendungszuschuss` | A.13 | Weitere Förderungen (Spezifikation A.13) als eigene Einträge? |
| K-156 | `gruendung.gruendungszuschuss` | A.13 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-157 | `gruendung.handwerksrolle` | A.4 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-158 | `gruendung.handwerksrolle` | A.4 | Anlage B2 (handwerksähnliche Gewerbe): ebenfalls eintragungspflichtig im Sinne der Spezifikation? Verzeichnis statt Rolle? |
| K-159 | `gruendung.handwerksrolle` | A.4 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-160 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-161 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Information ohne Handlung – als Hinweis darstellen? |
| K-162 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Beitragstermine für den Jahreskalender (I) ergänzen |
| K-163 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-164 | `gruendung.krankenversicherung` | A.10 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-165 | `gruendung.krankenversicherung` | A.10 | Für welche Rechtsformen und Rollen (z. B. GmbH-Geschäftsführer) gilt das? |
| K-166 | `gruendung.krankenversicherung` | A.10 | Nebenerwerb: was genau ist zu melden? |
| K-167 | `gruendung.krankenversicherung` | A.10 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-168 | `gruendung.krankenversicherung` | A.10 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-169 | `gruendung.rentenversicherungspflicht` | A.11 | Liste der Gruppen vollständig (§ 2 SGB VI)? |
| K-170 | `gruendung.rentenversicherungspflicht` | A.11 | Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum? |
| K-171 | `gruendung.rentenversicherungspflicht` | A.11 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-172 | `gruendung.rundfunkbeitrag` | A.9 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-173 | `gruendung.rundfunkbeitrag` | A.9 | Gilt auch für Arbeitsräume in der eigenen Wohnung? |
| K-174 | `gruendung.rundfunkbeitrag` | A.9 | Höhe nach Zahl der Beschäftigten – Staffel als Regelwert? |
| K-175 | `gruendung.rundfunkbeitrag` | A.9 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-176 | `gruendung.rundfunkbeitrag` | A.9 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-177 | `gruendung.statusfeststellung` | A.12 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-178 | `gruendung.statusfeststellung` | A.12 | Option mit Risiko-Check (Spezifikation): Kriterien des Risiko-Checks fachlich festlegen |
| K-179 | `gruendung.statusfeststellung` | A.12 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-180 | `gruendung.taetigkeit_einordnen` | A.1 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-181 | `gruendung.taetigkeit_einordnen` | A.1 | Ist das eine Pflicht oder ein vorbereitender Schritt? Darstellung als Aufgabe bestätigen |
| K-182 | `gruendung.ust_idnr` | A.6 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-183 | `gruendung.ust_idnr` | A.6 | Nur bei B2B-Geschäft oder bei jedem EU-Geschäft? |
| K-184 | `gruendung.ust_idnr` | A.6 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-185 | `gruendung.ust_idnr` | A.6 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-186 | `it_sicherheit.nis2_meldepflichten` | F.64 | Meldestufen und Fristen stehen nicht in der Spezifikation – fachlich ergänzen |
| K-187 | `it_sicherheit.nis2_meldepflichten` | F.64 | Haftung und Schulungspflicht der Geschäftsleitung als eigene Pflicht? |
| K-188 | `it_sicherheit.nis2_meldepflichten` | F.64 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-189 | `it_sicherheit.nis2_pruefen` | F.64 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-190 | `it_sicherheit.nis2_pruefen` | F.64 | Sektoren und Größenschwellen stehen nicht in der Spezifikation – als Betroffenheitscheck fachlich ergänzen |
| K-191 | `it_sicherheit.nis2_pruefen` | F.64 | Vorbereitender Schritt – Darstellung bestätigen |
| K-192 | `it_sicherheit.nis2_pruefen` | F.64 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-193 | `it_sicherheit.nis2_registrierung` | F.64 | Fundstelle im BSIG nach NIS2-Umsetzung prüfen |
| K-194 | `it_sicherheit.nis2_registrierung` | F.64 | „Nachfrist“ – was gilt für Unternehmen, die erst später betroffen werden? |
| K-195 | `it_sicherheit.nis2_registrierung` | F.64 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-196 | `ki.hochrisiko` | F.65 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-197 | `ki.hochrisiko` | F.65 | Status und Daten nach dem Digital Omnibus prüfen |
| K-198 | `ki.hochrisiko` | F.65 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „hoch“) |
| K-199 | `ki.hochrisiko` | F.65 | Welcher der beiden Termine gilt wofür? |
| K-200 | `ki.kompetenz` | F.65 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-201 | `ki.kompetenz` | F.65 | Inhalt und Umfang einer ausreichenden Schulung fachlich festlegen |
| K-202 | `ki.kompetenz` | F.65 | Genauer Beginn der Durchsetzung („ab August 2026“) – Datum ergänzen |
| K-203 | `ki.kompetenz` | F.65 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-204 | `ki.transparenz` | F.65 | Welche Fälle des Art. 50 treffen auf Kleinbetriebe zu (Chatbot, Deepfake, generierte Texte)? |
| K-205 | `ki.transparenz` | F.65 | Nach dem 2.12.2026 auf in_kraft umstellen |
| K-206 | `ki.transparenz` | F.65 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-207 | `online.cookie_einwilligung` | F.63 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-208 | `online.cookie_einwilligung` | F.63 | URL des Gesetzes nach Umbenennung (TTDSG → TDDDG) prüfen |
| K-209 | `online.cookie_einwilligung` | F.63 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-210 | `personal.anmeldezeitraum_angeben` | D.40 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-211 | `personal.anmeldezeitraum_angeben` | D.40 | Vorbereitender Schritt – Darstellung bestätigen |
| K-212 | `personal.anmeldezeitraum_angeben` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-213 | `personal.arbeitszeit_aufzeichnung` | D.42 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-214 | `personal.arbeitszeit_aufzeichnung` | D.42 | Fundstelle der BAG-Entscheidung prüfen |
| K-215 | `personal.arbeitszeit_aufzeichnung` | D.42 | Anforderungen an die Form (bis zur Neuregelung) fachlich formulieren |
| K-216 | `personal.arbeitszeit_aufzeichnung` | D.42 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-217 | `personal.arbeitszeit_aufzeichnung` | D.42 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-218 | `personal.arbeitszeit_milog` | D.42 | Fristen für Aufzeichnung und Aufbewahrung ergänzen |
| K-219 | `personal.arbeitszeit_milog` | D.42 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-220 | `personal.arbeitszeit_neuregelung` | D.42 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-221 | `personal.arbeitszeit_neuregelung` | D.42 | Status offen – Radar |
| K-222 | `personal.arbeitszeit_neuregelung` | D.42 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „mittel“) |
| K-223 | `personal.arbeitszeit_neuregelung` | D.42 | Schwelle 10 als Regelwert führen, sobald beschlossen |
| K-224 | `personal.aushangpflichtige_gesetze` | D.48 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-225 | `personal.aushangpflichtige_gesetze` | D.48 | Liste je Belegschaft (z. B. MuSchG ab wie vielen Frauen?) fachlich festlegen |
| K-226 | `personal.aushangpflichtige_gesetze` | D.48 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-227 | `personal.beitragsnachweis` | D.40 | „Arbeitstage“ als Bankarbeitstage umgesetzt – bestätigen (G-13) |
| K-228 | `personal.beitragsnachweis` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-229 | `personal.beitragsnachweis` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-230 | `personal.betriebsnummer` | D.37 | „vor der ersten Einstellung“ als spätestens am Tag vor Arbeitsbeginn umgesetzt – bestätigen |
| K-231 | `personal.betriebsnummer` | D.37 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-232 | `personal.betriebsnummer` | D.37 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-233 | `personal.entgelttransparenz_bericht` | D.47 | Status offen – Radar |
| K-234 | `personal.entgelttransparenz_bericht` | D.47 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „hoch“, weil EU-Richtlinie) |
| K-235 | `personal.entgelttransparenz_bericht` | D.47 | Zählweise und Inhalt des Berichts nach Umsetzungsgesetz |
| K-236 | `personal.hinweisgeber_meldestelle` | D.46 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-237 | `personal.hinweisgeber_meldestelle` | D.46 | Zählweise (G-05) |
| K-238 | `personal.hinweisgeber_meldestelle` | D.46 | Übergangsregeln für 50–249 Beschäftigte noch relevant? |
| K-239 | `personal.hinweisgeber_meldestelle` | D.46 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-240 | `personal.hinweisgeber_meldestelle` | D.46 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-241 | `personal.jugendarbeitsschutz` | D.44 | Erstuntersuchung als eigene Pflicht je Einstellung mit Frist? |
| K-242 | `personal.jugendarbeitsschutz` | D.44 | Arbeitszeitgrenzen als Regelwerte |
| K-243 | `personal.jugendarbeitsschutz` | D.44 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-244 | `personal.jugendarbeitsschutz` | D.44 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-245 | `personal.lohnabrechnung` | D.49 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-246 | `personal.lohnabrechnung` | D.49 | Partner noch nicht gewählt (Abschnitt 5, Integration offen) |
| K-247 | `personal.lohnabrechnung` | D.49 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-248 | `personal.lohnsteuer_anmeldung` | D.40 | Grenzen für den Anmeldezeitraum (nach Vorjahres-Lohnsteuer) stehen nicht in der Spezifikation – deshalb Angabe des Nutzers |
| K-249 | `personal.lohnsteuer_anmeldung` | D.40 | Verschiebung bei Fristende am Wochenende/Feiertag bestätigen |
| K-250 | `personal.lohnsteuer_anmeldung` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-251 | `personal.lohnsteuer_anmeldung` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-252 | `personal.mindestlohn` | D.39 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-253 | `personal.mindestlohn` | D.39 | Ausnahmen (z. B. Azubis, Praktika) als Hinweis ergänzen? |
| K-254 | `personal.mindestlohn` | D.39 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-255 | `personal.mindestlohn` | D.39 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-256 | `personal.minijob_grenze` | D.39 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-257 | `personal.minijob_grenze` | D.39 | Folgen bei Überschreiten (gelegentliches Überschreiten) ergänzen |
| K-258 | `personal.minijob_grenze` | D.39 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-259 | `personal.minijob_grenze` | D.39 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-260 | `personal.mutterschutz_gefaehrdungsbeurteilung` | D.43 | Frist „vor Arbeitsbeginn“ wie E.50 – bestätigen |
| K-261 | `personal.mutterschutz_gefaehrdungsbeurteilung` | D.43 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-262 | `personal.mutterschutz_gefaehrdungsbeurteilung` | D.43 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-263 | `personal.nachweisgesetz` | D.41 | Frist (je Angabe unterschiedlich) steht nicht in der Spezifikation – als spätestens bei Beginn eingetragen, fachlich ersetzen |
| K-264 | `personal.nachweisgesetz` | D.41 | Zulässige Form (Schriftform/elektronisch) aktuell? |
| K-265 | `personal.nachweisgesetz` | D.41 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-266 | `personal.schwangerschaft_mitteilung` | D.43 | Frist („unverzüglich“) steht nicht in der Spezifikation – als am Tag der Mitteilung eingetragen, fachlich ersetzen |
| K-267 | `personal.schwangerschaft_mitteilung` | D.43 | Zuständige Behörde je Land |
| K-268 | `personal.schwangerschaft_mitteilung` | D.43 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-269 | `personal.schwangerschaft_mitteilung` | D.43 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-270 | `personal.schwerbehinderte_anzeige` | D.45 | Quote und Höhe der Abgabe als Regelwerte |
| K-271 | `personal.schwerbehinderte_anzeige` | D.45 | Zählweise der Arbeitsplätze (G-05); wer insgesamt weniger als 20 beschäftigt, gilt als unter der Schwelle – bestätigen |
| K-272 | `personal.schwerbehinderte_anzeige` | D.45 | Verschiebung bei 31.3. am Wochenende |
| K-273 | `personal.schwerbehinderte_anzeige` | D.45 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-274 | `personal.schwerbehinderte_anzeige` | D.45 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-275 | `personal.sofortmeldung` | D.38 | „Bei Arbeitsbeginn“ als spätestens am Tag des Beginns umgesetzt – bestätigen |
| K-276 | `personal.sofortmeldung` | D.38 | Branchenliste vollständig (§ 28a Abs. 4 SGB IV)? |
| K-277 | `personal.sofortmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-278 | `personal.sv_abmeldung` | D.38 | Frist der Abmeldung steht nicht in der Spezifikation – als spätestens am Ende der Beschäftigung eingetragen, fachlich ersetzen |
| K-279 | `personal.sv_abmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-280 | `personal.sv_abmeldung` | D.38 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-281 | `personal.sv_anmeldung` | D.38 | Frist der Anmeldung steht nicht in der Spezifikation – als spätestens bei Beschäftigungsbeginn eingetragen, fachlich ersetzen |
| K-282 | `personal.sv_anmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-283 | `personal.sv_anmeldung` | D.38 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-284 | `personal.sv_beitraege` | D.40 | Minijobs: Fälligkeit bei der Minijob-Zentrale gleich? |
| K-285 | `personal.sv_beitraege` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-286 | `personal.sv_beitraege` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-287 | `personal.sv_jahresmeldung` | D.38 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-288 | `personal.sv_jahresmeldung` | D.38 | Termin der Jahresmeldung als Regeldaten ergänzen (für den Jahreskalender I) |
| K-289 | `personal.sv_jahresmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-290 | `personal.sv_jahresmeldung` | D.38 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-291 | `personal.umlagen_eau` | D.40 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-292 | `personal.umlagen_eau` | D.40 | Welche Umlage gilt für wen (z. B. U1 nach Betriebsgröße) – fachlich ergänzen |
| K-293 | `personal.umlagen_eau` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-294 | `personal.umlagen_eau` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-295 | `steuern.aufbewahrung` | C.32 | Fristbeginn (Ende des Kalenderjahres) und Aufbewahrungsdauern als Regelwerte führen |
| K-296 | `steuern.aufbewahrung` | C.32 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-297 | `steuern.aufbewahrung` | C.32 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-298 | `steuern.bauabzugsteuer_freistellung` | C.35 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-299 | `steuern.bauabzugsteuer_freistellung` | C.35 | Auch Handwerksbetriebe mit Bauleistungen erfassen (Branche handwerk)? |
| K-300 | `steuern.bauabzugsteuer_freistellung` | C.35 | Gültigkeitsdauer der Bescheinigung und Erneuerung ergänzen |
| K-301 | `steuern.bauabzugsteuer_freistellung` | C.35 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-302 | `steuern.buchfuehrungspflicht` | C.28 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-303 | `steuern.buchfuehrungspflicht` | C.28 | e.K. und GmbH & Co. KG als HGB-buchführungspflichtig angenommen – bestätigen |
| K-304 | `steuern.buchfuehrungspflicht` | C.28 | Im Gründungsjahr und vor dem Start gibt es keine Vorjahreswerte – § 141-Grenzen dann als nicht überschritten behandelt |
| K-305 | `steuern.buchfuehrungspflicht` | C.28 | § 141 AO: Pflicht beginnt erst nach Mitteilung des Finanzamts – berücksichtigen |
| K-306 | `steuern.buchfuehrungspflicht` | C.28 | Grenze inklusive/exklusive |
| K-307 | `steuern.buchfuehrungspflicht` | C.28 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-308 | `steuern.e_bilanz` | B.18 | Frist (gekoppelt an die Steuererklärung) als Regeldaten ergänzen |
| K-309 | `steuern.e_bilanz` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-310 | `steuern.e_bilanz` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-311 | `steuern.e_rechnung_empfang` | C.30 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-312 | `steuern.e_rechnung_empfang` | C.30 | Gilt für alle Unternehmen, auch Kleinunternehmer – bestätigen |
| K-313 | `steuern.e_rechnung_empfang` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-314 | `steuern.e_rechnung_versand_2027` | C.30 | Maßgeblich ist der Umsatz 2026: bis 2026 wird auch die Prognose herangezogen – bestätigen |
| K-315 | `steuern.e_rechnung_versand_2027` | C.30 | Rechtsstatus und gueltig_ab festlegen |
| K-316 | `steuern.e_rechnung_versand_2027` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-317 | `steuern.e_rechnung_versand_2028` | C.30 | Rechtsstatus und gueltig_ab festlegen |
| K-318 | `steuern.e_rechnung_versand_2028` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-319 | `steuern.est_erklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-320 | `steuern.est_erklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-321 | `steuern.est_erklaerung` | C.27 | Personengesellschaften: Feststellungserklärung der Gesellschaft zusätzlich? |
| K-322 | `steuern.est_erklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-323 | `steuern.est_erklaerung` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-324 | `steuern.euer` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-325 | `steuern.euer` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-326 | `steuern.euer` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-327 | `steuern.euer` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-328 | `steuern.gewst_erklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-329 | `steuern.gewst_erklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-330 | `steuern.gewst_erklaerung` | C.27 | Freibetrag (C.34) als Regelwert führen |
| K-331 | `steuern.gewst_erklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-332 | `steuern.gewst_erklaerung` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-333 | `steuern.gobd_verfahrensdokumentation` | C.31 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-334 | `steuern.gobd_verfahrensdokumentation` | C.31 | Fundstelle des aktuellen GoBD-Schreibens ergänzen |
| K-335 | `steuern.gobd_verfahrensdokumentation` | C.31 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-336 | `steuern.gobd_verfahrensdokumentation` | C.31 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-337 | `steuern.kasse_tse_belegausgabe` | C.33 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-338 | `steuern.kasse_tse_belegausgabe` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-339 | `steuern.kassenmeldung` | C.33 | Bestandskassen (Meldefrist 31.7.2025): Pflicht für Kassen ohne gemeldetes Anschaffungsdatum abbilden |
| K-340 | `steuern.kassenmeldung` | C.33 | Verschiebung bei Fristende am Wochenende festlegen |
| K-341 | `steuern.kassenmeldung` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-342 | `steuern.kassenmeldung_ausserbetriebnahme` | C.33 | Mehrere Kassen: je Ereignis eine Meldung (derzeit Bezug auf die erste Außerbetriebnahme) |
| K-343 | `steuern.kassenmeldung_ausserbetriebnahme` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-344 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-345 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Vor dem Start gibt es keinen Vorjahresumsatz – Vorjahresgrenze dann nicht geprüft |
| K-346 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Prognose statt tatsächlicher Umsatz: bis Abschnitt 4 nur Profilangaben – Formulierung „nach deinen Angaben“ bestätigen |
| K-347 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Grenze inklusive/exklusive (K-18) |
| K-348 | `steuern.kleinunternehmer_warnung_80` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-349 | `steuern.kleinunternehmer_warnung_80` | C.23 | Umsatzbegriff für die Grenze (G-06): Summe der gestellten Rechnungen (netto, abzüglich Stornos) im Kalenderjahr nach Rechnungsdatum – bestätigen |
| K-350 | `steuern.kleinunternehmer_warnung_80` | C.23 | Warnstufen 80 % und 95 % aus der Spezifikation |
| K-351 | `steuern.kleinunternehmer_warnung_95` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-352 | `steuern.kleinunternehmer_warnung_95` | C.23 | Umsatzbegriff für die Grenze (G-06): Summe der gestellten Rechnungen (netto, abzüglich Stornos) im Kalenderjahr nach Rechnungsdatum – bestätigen |
| K-353 | `steuern.kleinunternehmer_warnung_95` | C.23 | Warnstufen 80 % und 95 % aus der Spezifikation |
| K-354 | `steuern.kleinunternehmerregelung` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-355 | `steuern.kleinunternehmerregelung` | C.23 | Echtzeit-Warnungen bei 80 % und 95 % (Spezifikation C.23) folgen in Abschnitt 4 mit Finanzdaten |
| K-356 | `steuern.kst_erklaerung` | B.19 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-357 | `steuern.kst_erklaerung` | B.19 | Abgabefristen mit und ohne Steuerberatung als Regeldaten (wie G-18) |
| K-358 | `steuern.kst_erklaerung` | B.19 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-359 | `steuern.kst_erklaerung` | B.19 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-360 | `steuern.rechnungen_pflichtangaben` | C.29 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-361 | `steuern.rechnungen_pflichtangaben` | C.29 | Liste der Pflichtangaben und Kleinbetragsgrenze als Inhalt ergänzen |
| K-362 | `steuern.rechnungen_pflichtangaben` | C.29 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-363 | `steuern.ust_jahreserklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-364 | `steuern.ust_jahreserklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-365 | `steuern.ust_jahreserklaerung` | C.27 | Kleinunternehmer: Erklärungspflicht prüfen |
| K-366 | `steuern.ust_jahreserklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-367 | `steuern.ust_sondervorauszahlung` | C.24 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-368 | `steuern.ust_sondervorauszahlung` | C.24 | Fälligkeitstermin und Bemessungsgrundlage der Sondervorauszahlung ergänzen (K-08) |
| K-369 | `steuern.ust_sondervorauszahlung` | C.24 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-370 | `steuern.ust_voranmeldung` | C.24 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen (früherer Text war nicht belegt) |
| K-371 | `steuern.ust_voranmeldung` | C.24 | Befreiung bis Grenze ist laut Spezifikation 'möglich' (Ermessen Finanzamt?) – Auslöser bildet das als 'gilt nicht' ab; Formulierung prüfen |
| K-372 | `steuern.ust_voranmeldung` | C.24 | Neugründer: Aussetzung der monatlichen Pflicht 2021–2026 (Radar) – Rhythmus im Gründungs- und Folgejahr festlegen |
| K-373 | `steuern.ust_voranmeldung` | C.24 | Sondervorauszahlung 1/11 bei monatlicher Dauerfristverlängerung als eigene Pflicht anlegen |
| K-374 | `steuern.ust_voranmeldung` | C.24 | Verschiebung auf nächsten Werktag und Feiertagskalender (Bundesland) bestätigen |
| K-375 | `steuern.ust_voranmeldung` | C.24 | gueltig_ab: Datum der heutigen Fassung der Grenzen eintragen |
| K-376 | `steuern.vorauszahlung_est_kst` | C.26 | Verschiebung auf den nächsten Werktag bei Zahlungsterminen bestätigen |
| K-377 | `steuern.vorauszahlung_est_kst` | C.26 | Schonfrist bei Überweisung erwähnen? |
| K-378 | `steuern.vorauszahlung_est_kst` | C.26 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-379 | `steuern.vorauszahlung_est_kst` | C.26 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-380 | `steuern.vorauszahlung_gewst` | C.26 | Verschiebung und Kalender (Gemeinde) bestätigen |
| K-381 | `steuern.vorauszahlung_gewst` | C.26 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-382 | `steuern.vorauszahlung_gewst` | C.26 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-383 | `steuern.zusammenfassende_meldung` | C.25 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-384 | `steuern.zusammenfassende_meldung` | C.25 | Meldezeitraum und Abgabefrist ergänzen |
| K-385 | `steuern.zusammenfassende_meldung` | C.25 | Kleinunternehmer ausgenommen? |
| K-386 | `steuern.zusammenfassende_meldung` | C.25 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-387 | `steuern.zusammenfassende_meldung` | C.25 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-388 | `datenschutz.dsb.schwelle_personen@1` | F.61 | gueltig_ab ist Platzhalter |
| K-389 | `datenschutz.dsb.schwelle_personen@1` | F.61 | Geplante Streichung bis Ende 2026 (Radar F.61) – gueltig_bis setzen, sobald beschlossen |
| K-390 | `gesellschaft.gmbh.stammkapital_mindest@1` | B.14 | gueltig_ab ist Platzhalter |
| K-391 | `gesellschaft.gmbh.stammkapital_mindest@1` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-392 | `gesellschaft.gmbh.mindesteinzahlung_anteil@1` | B.14 | Spezifikation: „mindestens Hälfte einzuzahlen“ – Bezug (Mindeststammkapital oder Summe der Anteile) und Einzahlung je Geschäftsanteil prüfen |
| K-393 | `gesellschaft.gmbh.mindesteinzahlung_anteil@1` | B.14 | Rechtsgrundlage ergänzt |
| K-394 | `gesellschaft.ug.stammkapital_mindest@1` | B.14 | gueltig_ab ist Platzhalter |
| K-395 | `gesellschaft.ug.stammkapital_mindest@1` | B.14 | Rechtsgrundlage ergänzt |
| K-396 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | gueltig_ab ist Platzhalter |
| K-397 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | Rechtsgrundlage ergänzt |
| K-398 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | Berechnungsbasis (Jahresüberschuss abzüglich Verlustvortrag) prüfen |
| K-399 | `personal.mindestlohn.stunde@1` | D.39 | Rechtsgrundlage (aktuelle Anpassungsverordnung) ergänzen |
| K-400 | `personal.mindestlohn.stunde@2` | D.39 | Status „beschlossen“ – Verordnung prüfen |
| K-401 | `personal.minijob.grenze_monat@1` | D.39 | Rechtsgrundlage ergänzt |
| K-402 | `personal.minijob.grenze_monat@2` | D.39 | Dynamische Kopplung an den Mindestlohn – Wert für 2027 bestätigen |
| K-403 | `personal.schwerbehinderte.schwelle_arbeitsplaetze@1` | D.45 | gueltig_ab ist Platzhalter |
| K-404 | `personal.schwerbehinderte.schwelle_arbeitsplaetze@1` | D.45 | Rechtsgrundlage ergänzt |
| K-405 | `personal.hinschg.schwelle@1` | D.46 | gueltig_ab ist Platzhalter |
| K-406 | `personal.hinschg.schwelle@1` | D.46 | Rechtsgrundlage ergänzt |
| K-407 | `personal.entgelttransparenz.berichtspflicht_schwelle@1` | D.47 | Spezifikation: „über 150 Beschäftigte“ – Vergleich > umgesetzt |
| K-408 | `personal.entgelttransparenz.berichtspflicht_schwelle@1` | D.47 | Deutsches Umsetzungsgesetz abwarten |
| K-409 | `arbeitsschutz.ersthelfer.schwelle_versicherte@1` | E.53 | gueltig_ab ist Platzhalter |
| K-410 | `arbeitsschutz.ersthelfer.schwelle_versicherte@1` | E.53 | Rechtsgrundlage ergänzt |
| K-411 | `arbeitsschutz.ersthelfer.schwelle_versicherte@1` | E.53 | Versicherte vs. Beschäftigte |
| K-412 | `steuern.ust_va.grenze_befreiung@1` | C.24 | gueltig_ab ist Platzhalter (Beginn Betrachtungszeitraum), tatsächliches Inkrafttreten der Grenze eintragen |
| K-413 | `steuern.ust_va.grenze_monatlich@1` | C.24 | gueltig_ab ist Platzhalter |
| K-414 | `steuern.ust_va.grenze_monatlich@1` | C.24 | Spezifikation: 'über 9.000 € monatlich' – Vergleich '>' bestätigen |
| K-415 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-416 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | Grenze inklusive oder exklusive ('max. 25.000 €')? |
| K-417 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-418 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | Gründungsjahr: abweichende Grenze 25.000 € als eigener Regelwert |
| K-419 | `steuern.ustg19.grenze_gruendungsjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-420 | `steuern.ustg19.grenze_gruendungsjahr@1` | C.23 | Grenze inklusive oder exklusive? |
| K-421 | `steuern.ao141.grenze_umsatz@1` | C.28 | gueltig_ab ist Platzhalter |
| K-422 | `steuern.ao141.grenze_umsatz@1` | C.28 | Bezugsjahr und Vergleich (> oder ≥) bestätigen |
| K-423 | `steuern.ao141.grenze_gewinn@1` | C.28 | gueltig_ab ist Platzhalter |
| K-424 | `steuern.ao141.grenze_gewinn@1` | C.28 | Bezugsjahr und Vergleich (> oder ≥) bestätigen |
| K-425 | `steuern.e_rechnung.grenze_vorjahresumsatz_2027@1` | C.30 | Übergangsregel-Fundstelle (§ 27 Abs. 38 UStG) ergänzt, nicht aus Spezifikation |
| K-426 | `steuern.e_rechnung.grenze_vorjahresumsatz_2027@1` | C.30 | gueltig_ab/gueltig_bis als Übergangszeitraum bestätigen |
| K-427 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-428 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-429 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | Fristbeginn (Ende des Kalenderjahres) als Regel ergänzen |
| K-430 | `steuern.aufbewahrung.buecher_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-431 | `steuern.aufbewahrung.buecher_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-432 | `steuern.aufbewahrung.geschaeftsbriefe_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-433 | `steuern.aufbewahrung.geschaeftsbriefe_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-434 | `steuern.ust.satz_regel@1` |  | [FACHLICH ZU PRÜFEN] Steuersatz steht nicht in der Spezifikation – vor Freigabe gegen das Gesetz prüfen |
| K-435 | `steuern.ust.satz_regel@1` |  | gueltig_ab ist Platzhalter |
| K-436 | `steuern.ust.satz_ermaessigt@1` |  | [FACHLICH ZU PRÜFEN] Steuersatz steht nicht in der Spezifikation – vor Freigabe gegen das Gesetz prüfen |
| K-437 | `steuern.ust.satz_ermaessigt@1` |  | Welche Leistungen ermäßigt sind, entscheidet der Nutzer – Hinweis/Hilfe fachlich formulieren |
| K-438 | `steuern.ust.satz_ermaessigt@1` |  | gueltig_ab ist Platzhalter |
