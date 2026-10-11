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
| T-28 | Online-Check: Handlungshinweise je Befund („was tun“) und ob Musterformulierungen (Impressum, Button-Beschriftungen) angeboten werden dürfen | RA | E-097 |
| T-29 | Widerrufsbutton (seit 19.6.2026): Fundstelle im BGB, vorgeschriebene Beschriftung; Kündigungsbutton (§ 312k BGB): Beschriftung und Ablauf | RA | Katalog G.68 |
| T-30 | OS-Plattform: aktueller Status und ob Link oder Hinweis noch nötig ist | RA | Katalog G.69 |
| T-31 | Geldwäsche (Güterhändler): Schwelle für Barzahlungen als Regelwert; Immobilien- und Finanzbranche als Branchenmodul | RA | Katalog G.75 |
| T-32 | BFSG: Bilanzsumme als Alternative zum Umsatz, Liste der betroffenen Dienstleistungen und Produkte | RA | Katalog G.70 |
| T-33 | Allergene: Bezeichnungen der 14 Hauptallergene (Anhang II LMIV), Pflichtangaben bei loser Ware (LMIDV), Gestaltung des Aushangs | Lebensmittelrecht | E-099 |
| T-34 | HACCP: Vorschläge für typische Kontrollpunkte und Grenzwerte (Leitlinien für gute Hygienepraxis), Aufbewahrungsdauer der Protokolle | Lebensmittelrecht | E-099 |
| T-35 | IfSG § 43: Abstand der Folgebelehrungen, Gültigkeit der Bescheinigung des Gesundheitsamts, gilt die Pflicht auch für die Inhaberin? | RA | Katalog H.1 |
| T-36 | Branchenpakete Handwerk, Beauty, Bau, Transport, IT, Gesundheit, Immobilien: Vollständigkeit der Pflichten und Schwellen (SOKA-BAU, BaustellV, GüKG, Weiterbildung) | RA/StB | Katalog H |
| G-15 | Sammelbestätigung „vor dem Start erledigt“: Wortlaut und ob ein Hinweis zu Nachholpflichten nötig ist | RA | E-072 |

## Juristische Grundsatzfragen (blockieren Abschnitte)

| Nr. | Frage | Wer | blockiert |
|---|---|---|---|
| J-1 | ELSTER-Übermittlung über unseren Server mit Nutzerzertifikat noch Selbsthilfe nach StBerG? | RA/StB | 3, 4 |
| J-2 | Behörden-Postfach: Grenze allgemeine Erklärung ↔ Einzelfallprüfung (RDG) | RA | 9 |
| J-3 | Darstellung „nicht zutreffend“ / „trotzdem prüfen lassen“, Haftung | RA | Livegang 2 |
| J-4 | Marktplatz: Vergütungsmodell nach Berufsrecht | RA | 9 |

## Aus dem Katalog (automatisch aus `fachlich_zu_pruefen`)

Erzeugt mit `scripts/pruefliste.py`; 581 Punkte.

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
| K-029 | `branche.bau_baustellenverordnung` | H.4 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-030 | `branche.bau_baustellenverordnung` | H.4 | Schwellen (Dauer, Beschäftigte) nicht in der Spezifikation |
| K-031 | `branche.bau_baustellenverordnung` | H.4 | Rolle des Betriebs (Bauherr ↔ Auftragnehmer) |
| K-032 | `branche.bau_baustellenverordnung` | H.4 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-033 | `branche.bau_soka` | H.4 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-034 | `branche.bau_soka` | H.4 | Erfassung nach überwiegender Tätigkeit – Prüfhinweis ergänzen |
| K-035 | `branche.bau_soka` | H.4 | Meldefristen nicht in der Spezifikation |
| K-036 | `branche.bau_soka` | H.4 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-037 | `branche.bau_soka` | H.4 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-038 | `branche.beauty_hautschutzplan` | H.3 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-039 | `branche.beauty_hautschutzplan` | H.3 | Rechtsgrundlage ergänzt – prüfen |
| K-040 | `branche.beauty_hautschutzplan` | H.3 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-041 | `branche.beauty_hautschutzplan` | H.3 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-042 | `branche.beauty_hygieneplan` | H.3 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-043 | `branche.beauty_hygieneplan` | H.3 | Rechtsgrundlage je Land ergänzen |
| K-044 | `branche.beauty_hygieneplan` | H.3 | Vorlage Hygieneplan nach Prüfung (6.4) |
| K-045 | `branche.beauty_hygieneplan` | H.3 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-046 | `branche.beauty_hygieneplan` | H.3 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-047 | `branche.beauty_kosmetikverordnung` | H.3 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-048 | `branche.beauty_kosmetikverordnung` | H.3 | Notifizierung (CPNP) und Kennzeichnung ergänzen |
| K-049 | `branche.beauty_kosmetikverordnung` | H.3 | Abgrenzung Herstellung ↔ Weiterverkauf |
| K-050 | `branche.beauty_kosmetikverordnung` | H.3 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-051 | `branche.gastro_allergene` | H.1 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-052 | `branche.gastro_allergene` | H.1 | Liste der 14 Allergene (Anhang II LMIV) im Werkzeug prüfen |
| K-053 | `branche.gastro_allergene` | H.1 | Form der Information bei loser Ware (LMIDV) erläutern |
| K-054 | `branche.gastro_allergene` | H.1 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-055 | `branche.gastro_allergene` | H.1 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-056 | `branche.gastro_haccp` | H.1 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-057 | `branche.gastro_haccp` | H.1 | Grenzwerte (z. B. Kühltemperaturen) und Kontrollhäufigkeit nicht in der Spezifikation – Betrieb legt sie fest; Vorschläge fachlich ergänzen |
| K-058 | `branche.gastro_haccp` | H.1 | Leitlinien für gute Hygienepraxis je Branche verlinken |
| K-059 | `branche.gastro_haccp` | H.1 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-060 | `branche.gastro_haccp` | H.1 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-061 | `branche.gastro_ifsg_belehrung` | H.1 | Abstand der Folgebelehrungen und Höchstalter der Bescheinigung stehen nicht in der Spezifikation – ergänzen |
| K-062 | `branche.gastro_ifsg_belehrung` | H.1 | Gilt das auch für die Inhaberin selbst? |
| K-063 | `branche.gastro_ifsg_belehrung` | H.1 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-064 | `branche.gastro_lebensmittelregistrierung` | H.1 | Frist „vor Aufnahme der Tätigkeit“ als Gründungsschritt mit Termin? |
| K-065 | `branche.gastro_lebensmittelregistrierung` | H.1 | Zuständigkeit je Land |
| K-066 | `branche.gastro_lebensmittelregistrierung` | H.1 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-067 | `branche.gastro_lebensmittelregistrierung` | H.1 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-068 | `branche.gesundheit_erlaubnisse` | H.7 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-069 | `branche.gesundheit_erlaubnisse` | H.7 | Liste der Berufe und zuständigen Stellen ergänzen |
| K-070 | `branche.gesundheit_erlaubnisse` | H.7 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-071 | `branche.gesundheit_erlaubnisse` | H.7 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-072 | `branche.handwerk_gefaehrdung_gewerk` | H.2 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-073 | `branche.handwerk_gefaehrdung_gewerk` | H.2 | Vorlagen je Gewerk (BG-Handlungshilfen) – T-20 |
| K-074 | `branche.handwerk_gefaehrdung_gewerk` | H.2 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-075 | `branche.handwerk_gewaehrleistung` | H.2 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-076 | `branche.handwerk_gewaehrleistung` | H.2 | Verjährungsfristen je Werkart nicht in der Spezifikation – als Regelwerte ergänzen |
| K-077 | `branche.handwerk_gewaehrleistung` | H.2 | Ist das eine Pflicht oder ein Hinweis? Darstellung bestätigen |
| K-078 | `branche.handwerk_gewaehrleistung` | H.2 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-079 | `branche.immo_gwg` | H.8 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-080 | `branche.immo_gwg` | H.8 | Welche Tätigkeiten genau (Makler, Vermittler) – Auslöser verfeinern |
| K-081 | `branche.immo_gwg` | H.8 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-082 | `branche.immo_weiterbildung` | H.8 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-083 | `branche.immo_weiterbildung` | H.8 | „nur wo noch geltend“ – aktuellen Stand je Vorschrift prüfen |
| K-084 | `branche.immo_weiterbildung` | H.8 | Umfang (Stunden) und Zeitraum als Regelwerte |
| K-085 | `branche.immo_weiterbildung` | H.8 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-086 | `branche.immo_weiterbildung` | H.8 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-087 | `branche.it_haftung` | H.6 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-088 | `branche.it_haftung` | H.6 | Hinweis statt Pflicht – Darstellung bestätigen |
| K-089 | `branche.it_haftung` | H.6 | Rechtsgrundlagen ergänzt |
| K-090 | `branche.it_haftung` | H.6 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-091 | `branche.it_scheinselbststaendigkeit` | H.6 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-092 | `branche.it_scheinselbststaendigkeit` | H.6 | Auslöser: auch Auftraggeber-Seite (Einsatz von Freelancern) abbilden? |
| K-093 | `branche.it_scheinselbststaendigkeit` | H.6 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-094 | `branche.it_scheinselbststaendigkeit` | H.6 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-095 | `branche.transport_erlaubnis` | H.5 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-096 | `branche.transport_erlaubnis` | H.5 | Schwellen (z. B. Fahrzeuggewicht) nicht in der Spezifikation |
| K-097 | `branche.transport_erlaubnis` | H.5 | Personenbeförderung (Taxi, Mietwagen) getrennt? |
| K-098 | `branche.transport_erlaubnis` | H.5 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-099 | `branche.transport_lenkzeiten` | H.5 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-100 | `branche.transport_lenkzeiten` | H.5 | Fahrzeugklassen und Auslese-/Aufbewahrungsfristen nicht in der Spezifikation |
| K-101 | `branche.transport_lenkzeiten` | H.5 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-102 | `datenschutz.avv` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-103 | `datenschutz.avv` | F.58 | Abgrenzung Auftragsverarbeitung ↔ eigene Verantwortung (z. B. Steuerberatung) als Hinweis ergänzen |
| K-104 | `datenschutz.avv` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-105 | `datenschutz.beschaeftigtendaten` | F.62 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-106 | `datenschutz.beschaeftigtendaten` | F.62 | Anwendbarkeit von § 26 BDSG nach der Rechtsprechung des EuGH (2023) prüfen |
| K-107 | `datenschutz.beschaeftigtendaten` | F.62 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-108 | `datenschutz.beschaeftigtendaten` | F.62 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-109 | `datenschutz.betroffenenanfrage` | F.59 | Verlängerung um zwei Monate bei komplexen Anfragen (Art. 12 Abs. 3 Satz 2) abbilden? |
| K-110 | `datenschutz.betroffenenanfrage` | F.59 | Mehrere Anfragen am selben Tag ergeben eine Instanz (T-15) |
| K-111 | `datenschutz.betroffenenanfrage` | F.59 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-112 | `datenschutz.betroffenenanfrage` | F.59 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-113 | `datenschutz.datenpanne_meldung` | F.60 | 72 Stunden tagesgenau als 3 Tage ab dem Tag der Entdeckung umgesetzt; der Countdown in der App rechnet stundengenau – bestätigen |
| K-114 | `datenschutz.datenpanne_meldung` | F.60 | Benachrichtigung der Betroffenen bei hohem Risiko (Art. 34) als eigene Pflicht? |
| K-115 | `datenschutz.datenpanne_meldung` | F.60 | Zuständige Aufsichtsbehörde je Land |
| K-116 | `datenschutz.dsb` | F.61 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-117 | `datenschutz.dsb` | F.61 | Zählweise „ständig mit automatisierter Verarbeitung“ (G-05) |
| K-118 | `datenschutz.dsb` | F.61 | Benennungspflicht nach Art. 37 DSGVO unabhängig von der Zahl (z. B. Kerntätigkeit) als eigener Zweig? |
| K-119 | `datenschutz.dsb` | F.61 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-120 | `datenschutz.dsb_streichung` | F.61 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-121 | `datenschutz.dsb_streichung` | F.61 | Status offen – Radar |
| K-122 | `datenschutz.dsb_streichung` | F.61 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „mittel“) |
| K-123 | `datenschutz.dsb_streichung` | F.61 | „bis Ende 2026“ als erwartet ab 31.12.2026 eingetragen |
| K-124 | `datenschutz.dsfa` | F.62 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-125 | `datenschutz.dsfa` | F.62 | Auslöser (Gesundheitsdaten, Video) sind eine Vorauswahl – Liste der Aufsichtsbehörden (Muss-Liste) einbeziehen |
| K-126 | `datenschutz.dsfa` | F.62 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-127 | `datenschutz.informationspflichten` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-128 | `datenschutz.informationspflichten` | F.58 | Pflichtinhalte als Checkliste fachlich ergänzen |
| K-129 | `datenschutz.informationspflichten` | F.58 | Vorlage Datenschutzerklärung (6.4) erst nach Prüfung |
| K-130 | `datenschutz.informationspflichten` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-131 | `datenschutz.loeschkonzept` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-132 | `datenschutz.loeschkonzept` | F.58 | Zusammenspiel mit Aufbewahrungsfristen (C.32, G-21) erläutern |
| K-133 | `datenschutz.loeschkonzept` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-134 | `datenschutz.loeschkonzept` | F.58 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-135 | `datenschutz.tom` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-136 | `datenschutz.tom` | F.58 | Gliederung nach Art. 32 Abs. 1 DSGVO – Wortlaut prüfen |
| K-137 | `datenschutz.tom` | F.58 | Vorschlagsliste typischer Maßnahmen für Kleinbetriebe fachlich erstellen |
| K-138 | `datenschutz.tom` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-139 | `datenschutz.videoueberwachung` | F.62 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-140 | `datenschutz.videoueberwachung` | F.62 | Speicherdauer der Aufnahmen fachlich ergänzen |
| K-141 | `datenschutz.videoueberwachung` | F.62 | Beschäftigte: Mitbestimmung/Information |
| K-142 | `datenschutz.videoueberwachung` | F.62 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-143 | `datenschutz.videoueberwachung` | F.62 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-144 | `datenschutz.vvt` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-145 | `datenschutz.vvt` | F.58 | Ausnahme nach Art. 30 Abs. 5 DSGVO (unter 250 Beschäftigte) – wann greift sie? Darstellung prüfen |
| K-146 | `datenschutz.vvt` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-147 | `gesellschaft.awv_meldung` | B.21 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-148 | `gesellschaft.awv_meldung` | B.21 | Meldegrenze als Regelwert erfassen (nicht in der Spezifikation) |
| K-149 | `gesellschaft.awv_meldung` | B.21 | Meldefrist ergänzen |
| K-150 | `gesellschaft.awv_meldung` | B.21 | Auch ohne Investoren bei Auslandszahlungen über der Grenze – weiterer Auslöser? |
| K-151 | `gesellschaft.awv_meldung` | B.21 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-152 | `gesellschaft.foerderprogramme` | B.22 | Option, keine Pflicht |
| K-153 | `gesellschaft.foerderprogramme` | B.22 | Matching-Kriterien und Fristen je Programm fachlich hinterlegen |
| K-154 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Frist für die Einreichung ergänzen |
| K-155 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-156 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-157 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-158 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Einzelne Vorschriften (z. B. § 2 GmbHG Form, § 5 Stammkapital, § 7 Einzahlung) zuordnen |
| K-159 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Online-Beurkundung: Voraussetzungen und Grenzen ergänzen |
| K-160 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-161 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-162 | `gesellschaft.gf_pflichten_haftung` | B.17 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-163 | `gesellschaft.gf_pflichten_haftung` | B.17 | Inhalt der Erklärung (welche Pflichten, § 43 GmbHG) fachlich festlegen – Spezifikation nennt nur „Pflichten und Haftung erklären“ |
| K-164 | `gesellschaft.gf_pflichten_haftung` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-165 | `gesellschaft.gf_pflichten_haftung` | B.17 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-166 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-167 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Kriterien (Beteiligung, Sperrminorität) nicht in der Spezifikation – nur als Hinweis auf die Statusfeststellung darstellen |
| K-168 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-169 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-170 | `gesellschaft.handelsregister_anmeldung` | B.15 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-171 | `gesellschaft.handelsregister_anmeldung` | B.15 | Einzelvorschriften (§§ 7, 8 GmbHG) zuordnen |
| K-172 | `gesellschaft.handelsregister_anmeldung` | B.15 | Haftung vor Eintragung (Vorgesellschaft) als Hinweis ergänzen? |
| K-173 | `gesellschaft.handelsregister_anmeldung` | B.15 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-174 | `gesellschaft.handelsregister_anmeldung` | B.15 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-175 | `gesellschaft.insolvenzantragspflicht` | B.17 | Fristen nach § 15a InsO als Regelwerte erfassen (Spezifikation: „Fristen aus Regeldaten“, Werte nicht genannt) |
| K-176 | `gesellschaft.insolvenzantragspflicht` | B.17 | Darstellung: allgemeine Information, keine Prüfung des Einzelfalls (RDG) |
| K-177 | `gesellschaft.insolvenzantragspflicht` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-178 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-179 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Hinweis laut Spezifikation – sensible Sektoren und Schwellen fachlich ergänzen |
| K-180 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Zuständiges Ministerium (Bezeichnung) aktuell? |
| K-181 | `gesellschaft.jahresabschluss` | B.18 | Fristen für Aufstellung und Feststellung als Regeldaten ergänzen |
| K-182 | `gesellschaft.jahresabschluss` | B.18 | Jährliche Wiederholung abbilden, sobald Fristen feststehen |
| K-183 | `gesellschaft.jahresabschluss` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-184 | `gesellschaft.jahresabschluss` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-185 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-186 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Option, keine Pflicht – Darstellung bestätigen |
| K-187 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Inhalt der Erklärung zu § 19a EStG und VSOP fachlich festlegen |
| K-188 | `gesellschaft.offenlegung` | B.18 | Frist „binnen 12 Monaten“ als 31.12. des Folgejahres umgesetzt (Kalenderjahr) – bestätigen |
| K-189 | `gesellschaft.offenlegung` | B.18 | Verschiebung bei Fristende am Wochenende/Feiertag festlegen |
| K-190 | `gesellschaft.offenlegung` | B.18 | Kleinstkapitalgesellschaft: Merkmale nicht in der Spezifikation – nur Hinweis auf Hinterlegung |
| K-191 | `gesellschaft.offenlegung` | B.18 | Erstes Rumpfgeschäftsjahr nach Gründung: Periodenbeginn prüfen |
| K-192 | `gesellschaft.offenlegung` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-193 | `gesellschaft.offenlegung` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-194 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Frist: Termin für abweichendes Geschäftsjahr berechnen (Angabe des Geschäftsjahresendes im Profil nötig) |
| K-195 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-196 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-197 | `gesellschaft.stammkapital_einzahlen` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-198 | `gesellschaft.stammkapital_einzahlen` | B.14 | Reihenfolge „vor der Anmeldung“ bestätigen |
| K-199 | `gesellschaft.stammkapital_einzahlen` | B.14 | UG: Volleinzahlung und Bareinlage (Spezifikation nennt nur „ab 1 €“) bestätigen |
| K-200 | `gesellschaft.stammkapital_einzahlen` | B.14 | Höhe der Einzahlung bei GmbH: Anteil je Geschäftsanteil oder insgesamt? |
| K-201 | `gesellschaft.stammkapital_einzahlen` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-202 | `gesellschaft.stammkapital_einzahlen` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-203 | `gesellschaft.transparenzregister` | B.16 | Einzelvorschriften (§§ 19, 20 GwG) zuordnen |
| K-204 | `gesellschaft.transparenzregister` | B.16 | Gilt auch für GmbH & Co. KG und Personengesellschaften – Auslöser erweitern? |
| K-205 | `gesellschaft.transparenzregister` | B.16 | Frist nach Gründung und bei Änderung ergänzen |
| K-206 | `gesellschaft.transparenzregister` | B.16 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-207 | `gesellschaft.transparenzregister` | B.16 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-208 | `gesellschaft.ug_ruecklage` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-209 | `gesellschaft.ug_ruecklage` | B.14 | Ende der Rücklagepflicht (Erreichen des GmbH-Stammkapitals) ergänzen |
| K-210 | `gesellschaft.ug_ruecklage` | B.14 | Verlustvortrag bei der Berechnung berücksichtigen? |
| K-211 | `gesellschaft.ug_ruecklage` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-212 | `gesellschaft.ug_ruecklage` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-213 | `gruendung.berufsgenossenschaft` | A.8 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen (früherer Text war nicht belegt) |
| K-214 | `gruendung.berufsgenossenschaft` | A.8 | Auslöser 'immer': gilt das für alle Rechtsformen und Freiberufler ohne Beschäftigte? Ausnahmen (z. B. andere Unfallversicherungsträger) erfassen |
| K-215 | `gruendung.berufsgenossenschaft` | A.8 | Fristbeginn: Gründungsdatum vs. Aufnahme der Tätigkeit |
| K-216 | `gruendung.elster_konto` | A.5 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-217 | `gruendung.elster_konto` | A.5 | Vorbereitender Schritt ohne eigene Rechtspflicht – Darstellung bestätigen |
| K-218 | `gruendung.elster_konto` | A.5 | Gilt für alle oder nur ohne Steuerberatung? |
| K-219 | `gruendung.erlaubnis_pruefen` | A.3 | Reisegewerbekarte (§ 55 GewO) als eigene Pflicht führen? |
| K-220 | `gruendung.erlaubnis_pruefen` | A.3 | Gaststättenrecht je Land: Zuständigkeit und Erlaubnisfreiheit einzelner Länder prüfen |
| K-221 | `gruendung.erlaubnis_pruefen` | A.3 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-222 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum im Profil? bestätigen |
| K-223 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Verschiebung bei Fristende am Wochenende/Feiertag festlegen |
| K-224 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-225 | `gruendung.gewerbeanzeige` | A.2 | Frist „bei Beginn“: als spätestens am Tag des Beginns umgesetzt – bestätigen |
| K-226 | `gruendung.gewerbeanzeige` | A.2 | Ummeldung und Abmeldung: Fristen ergänzen |
| K-227 | `gruendung.gewerbeanzeige` | A.2 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-228 | `gruendung.gruendungszuschuss` | A.13 | Weitere Förderungen (Spezifikation A.13) als eigene Einträge? |
| K-229 | `gruendung.gruendungszuschuss` | A.13 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-230 | `gruendung.handwerksrolle` | A.4 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-231 | `gruendung.handwerksrolle` | A.4 | Anlage B2 (handwerksähnliche Gewerbe): ebenfalls eintragungspflichtig im Sinne der Spezifikation? Verzeichnis statt Rolle? |
| K-232 | `gruendung.handwerksrolle` | A.4 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-233 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-234 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Information ohne Handlung – als Hinweis darstellen? |
| K-235 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Beitragstermine für den Jahreskalender (I) ergänzen |
| K-236 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-237 | `gruendung.krankenversicherung` | A.10 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-238 | `gruendung.krankenversicherung` | A.10 | Für welche Rechtsformen und Rollen (z. B. GmbH-Geschäftsführer) gilt das? |
| K-239 | `gruendung.krankenversicherung` | A.10 | Nebenerwerb: was genau ist zu melden? |
| K-240 | `gruendung.krankenversicherung` | A.10 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-241 | `gruendung.krankenversicherung` | A.10 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-242 | `gruendung.rentenversicherungspflicht` | A.11 | Liste der Gruppen vollständig (§ 2 SGB VI)? |
| K-243 | `gruendung.rentenversicherungspflicht` | A.11 | Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum? |
| K-244 | `gruendung.rentenversicherungspflicht` | A.11 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-245 | `gruendung.rundfunkbeitrag` | A.9 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-246 | `gruendung.rundfunkbeitrag` | A.9 | Gilt auch für Arbeitsräume in der eigenen Wohnung? |
| K-247 | `gruendung.rundfunkbeitrag` | A.9 | Höhe nach Zahl der Beschäftigten – Staffel als Regelwert? |
| K-248 | `gruendung.rundfunkbeitrag` | A.9 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-249 | `gruendung.rundfunkbeitrag` | A.9 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-250 | `gruendung.statusfeststellung` | A.12 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-251 | `gruendung.statusfeststellung` | A.12 | Option mit Risiko-Check (Spezifikation): Kriterien des Risiko-Checks fachlich festlegen |
| K-252 | `gruendung.statusfeststellung` | A.12 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-253 | `gruendung.taetigkeit_einordnen` | A.1 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-254 | `gruendung.taetigkeit_einordnen` | A.1 | Ist das eine Pflicht oder ein vorbereitender Schritt? Darstellung als Aufgabe bestätigen |
| K-255 | `gruendung.ust_idnr` | A.6 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-256 | `gruendung.ust_idnr` | A.6 | Nur bei B2B-Geschäft oder bei jedem EU-Geschäft? |
| K-257 | `gruendung.ust_idnr` | A.6 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-258 | `gruendung.ust_idnr` | A.6 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-259 | `it_sicherheit.nis2_meldepflichten` | F.64 | Meldestufen und Fristen stehen nicht in der Spezifikation – fachlich ergänzen |
| K-260 | `it_sicherheit.nis2_meldepflichten` | F.64 | Haftung und Schulungspflicht der Geschäftsleitung als eigene Pflicht? |
| K-261 | `it_sicherheit.nis2_meldepflichten` | F.64 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-262 | `it_sicherheit.nis2_pruefen` | F.64 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-263 | `it_sicherheit.nis2_pruefen` | F.64 | Sektoren und Größenschwellen stehen nicht in der Spezifikation – als Betroffenheitscheck fachlich ergänzen |
| K-264 | `it_sicherheit.nis2_pruefen` | F.64 | Vorbereitender Schritt – Darstellung bestätigen |
| K-265 | `it_sicherheit.nis2_pruefen` | F.64 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-266 | `it_sicherheit.nis2_registrierung` | F.64 | Fundstelle im BSIG nach NIS2-Umsetzung prüfen |
| K-267 | `it_sicherheit.nis2_registrierung` | F.64 | „Nachfrist“ – was gilt für Unternehmen, die erst später betroffen werden? |
| K-268 | `it_sicherheit.nis2_registrierung` | F.64 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-269 | `ki.hochrisiko` | F.65 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-270 | `ki.hochrisiko` | F.65 | Status und Daten nach dem Digital Omnibus prüfen |
| K-271 | `ki.hochrisiko` | F.65 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „hoch“) |
| K-272 | `ki.hochrisiko` | F.65 | Welcher der beiden Termine gilt wofür? |
| K-273 | `ki.kompetenz` | F.65 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-274 | `ki.kompetenz` | F.65 | Inhalt und Umfang einer ausreichenden Schulung fachlich festlegen |
| K-275 | `ki.kompetenz` | F.65 | Genauer Beginn der Durchsetzung („ab August 2026“) – Datum ergänzen |
| K-276 | `ki.kompetenz` | F.65 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-277 | `ki.transparenz` | F.65 | Welche Fälle des Art. 50 treffen auf Kleinbetriebe zu (Chatbot, Deepfake, generierte Texte)? |
| K-278 | `ki.transparenz` | F.65 | Nach dem 2.12.2026 auf in_kraft umstellen |
| K-279 | `ki.transparenz` | F.65 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-280 | `online.barrierefreiheit` | G.70 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-281 | `online.barrierefreiheit` | G.70 | Bilanzsumme als Alternative zum Umsatz fehlt im Profil |
| K-282 | `online.barrierefreiheit` | G.70 | Zählweise (G-05) |
| K-283 | `online.barrierefreiheit` | G.70 | Welche Dienstleistungen genau (Buchungstools, Bankdienste …) – Liste ergänzen |
| K-284 | `online.barrierefreiheit` | G.70 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-285 | `online.button_loesung` | G.68 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-286 | `online.button_loesung` | G.68 | Zulässige Beschriftungen als Beispiele ergänzen |
| K-287 | `online.button_loesung` | G.68 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-288 | `online.cookie_einwilligung` | F.63 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-289 | `online.cookie_einwilligung` | F.63 | URL des Gesetzes nach Umbenennung (TTDSG → TDDDG) prüfen |
| K-290 | `online.cookie_einwilligung` | F.63 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-291 | `online.dac7` | G.74 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-292 | `online.dac7` | G.74 | Meldeschwellen der Plattformen nicht in der Spezifikation |
| K-293 | `online.dac7` | G.74 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-294 | `online.datenschutzerklaerung` | G.66 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-295 | `online.datenschutzerklaerung` | G.66 | Vorlage erst nach fachlicher Prüfung (6.4) |
| K-296 | `online.datenschutzerklaerung` | G.66 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-297 | `online.datenschutzerklaerung` | G.66 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-298 | `online.impressum` | G.66 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-299 | `online.impressum` | G.66 | Pflichtangaben je Rechtsform als Checkliste fachlich ergänzen |
| K-300 | `online.impressum` | G.66 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-301 | `online.kuendigungsbutton` | G.68 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-302 | `online.kuendigungsbutton` | G.68 | Vorgeschriebene Beschriftung und Ablauf (Bestätigungsseite) fachlich ergänzen |
| K-303 | `online.kuendigungsbutton` | G.68 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-304 | `online.marktplatz_angaben` | G.74 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-305 | `online.marktplatz_angaben` | G.74 | Rechtsgrundlagen ergänzt – prüfen |
| K-306 | `online.marktplatz_angaben` | G.74 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-307 | `online.marktplatz_angaben` | G.74 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-308 | `online.os_link` | G.69 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-309 | `online.os_link` | G.69 | Aktueller Status der OS-Plattform und der Linkpflicht – fachlich prüfen und Text anpassen |
| K-310 | `online.os_link` | G.69 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-311 | `online.os_link` | G.69 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-312 | `online.preisangaben` | G.67 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-313 | `online.preisangaben` | G.67 | Ausnahmen und Einzelheiten (z. B. Grundpreis-Einheiten) fachlich ergänzen |
| K-314 | `online.preisangaben` | G.67 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-315 | `online.vsbg_hinweis` | G.69 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-316 | `online.vsbg_hinweis` | G.69 | Zählweise (G-05) |
| K-317 | `online.vsbg_hinweis` | G.69 | Auslöser „Website oder AGB“ – AGB sind nicht im Profil |
| K-318 | `online.vsbg_hinweis` | G.69 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-319 | `online.widerrufsbelehrung` | G.68 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-320 | `online.widerrufsbelehrung` | G.68 | Muster-Widerrufsbelehrung erst nach Prüfung |
| K-321 | `online.widerrufsbelehrung` | G.68 | Ausnahmen vom Widerrufsrecht als Hinweis |
| K-322 | `online.widerrufsbelehrung` | G.68 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-323 | `online.widerrufsbelehrung` | G.68 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-324 | `online.widerrufsbutton` | G.68 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-325 | `online.widerrufsbutton` | G.68 | Fundstelle im BGB nach Umsetzung ergänzen |
| K-326 | `online.widerrufsbutton` | G.68 | Beschriftung des Buttons fachlich ergänzen |
| K-327 | `online.widerrufsbutton` | G.68 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-328 | `online.widerrufsbutton` | G.68 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-329 | `personal.anmeldezeitraum_angeben` | D.40 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-330 | `personal.anmeldezeitraum_angeben` | D.40 | Vorbereitender Schritt – Darstellung bestätigen |
| K-331 | `personal.anmeldezeitraum_angeben` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-332 | `personal.arbeitszeit_aufzeichnung` | D.42 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-333 | `personal.arbeitszeit_aufzeichnung` | D.42 | Fundstelle der BAG-Entscheidung prüfen |
| K-334 | `personal.arbeitszeit_aufzeichnung` | D.42 | Anforderungen an die Form (bis zur Neuregelung) fachlich formulieren |
| K-335 | `personal.arbeitszeit_aufzeichnung` | D.42 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-336 | `personal.arbeitszeit_aufzeichnung` | D.42 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-337 | `personal.arbeitszeit_milog` | D.42 | Fristen für Aufzeichnung und Aufbewahrung ergänzen |
| K-338 | `personal.arbeitszeit_milog` | D.42 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-339 | `personal.arbeitszeit_neuregelung` | D.42 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-340 | `personal.arbeitszeit_neuregelung` | D.42 | Status offen – Radar |
| K-341 | `personal.arbeitszeit_neuregelung` | D.42 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „mittel“) |
| K-342 | `personal.arbeitszeit_neuregelung` | D.42 | Schwelle 10 als Regelwert führen, sobald beschlossen |
| K-343 | `personal.aushangpflichtige_gesetze` | D.48 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-344 | `personal.aushangpflichtige_gesetze` | D.48 | Liste je Belegschaft (z. B. MuSchG ab wie vielen Frauen?) fachlich festlegen |
| K-345 | `personal.aushangpflichtige_gesetze` | D.48 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-346 | `personal.beitragsnachweis` | D.40 | „Arbeitstage“ als Bankarbeitstage umgesetzt – bestätigen (G-13) |
| K-347 | `personal.beitragsnachweis` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-348 | `personal.beitragsnachweis` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-349 | `personal.betriebsnummer` | D.37 | „vor der ersten Einstellung“ als spätestens am Tag vor Arbeitsbeginn umgesetzt – bestätigen |
| K-350 | `personal.betriebsnummer` | D.37 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-351 | `personal.betriebsnummer` | D.37 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-352 | `personal.entgelttransparenz_bericht` | D.47 | Status offen – Radar |
| K-353 | `personal.entgelttransparenz_bericht` | D.47 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „hoch“, weil EU-Richtlinie) |
| K-354 | `personal.entgelttransparenz_bericht` | D.47 | Zählweise und Inhalt des Berichts nach Umsetzungsgesetz |
| K-355 | `personal.hinweisgeber_meldestelle` | D.46 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-356 | `personal.hinweisgeber_meldestelle` | D.46 | Zählweise (G-05) |
| K-357 | `personal.hinweisgeber_meldestelle` | D.46 | Übergangsregeln für 50–249 Beschäftigte noch relevant? |
| K-358 | `personal.hinweisgeber_meldestelle` | D.46 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-359 | `personal.hinweisgeber_meldestelle` | D.46 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-360 | `personal.jugendarbeitsschutz` | D.44 | Erstuntersuchung als eigene Pflicht je Einstellung mit Frist? |
| K-361 | `personal.jugendarbeitsschutz` | D.44 | Arbeitszeitgrenzen als Regelwerte |
| K-362 | `personal.jugendarbeitsschutz` | D.44 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-363 | `personal.jugendarbeitsschutz` | D.44 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-364 | `personal.lohnabrechnung` | D.49 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-365 | `personal.lohnabrechnung` | D.49 | Partner noch nicht gewählt (Abschnitt 5, Integration offen) |
| K-366 | `personal.lohnabrechnung` | D.49 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-367 | `personal.lohnsteuer_anmeldung` | D.40 | Grenzen für den Anmeldezeitraum (nach Vorjahres-Lohnsteuer) stehen nicht in der Spezifikation – deshalb Angabe des Nutzers |
| K-368 | `personal.lohnsteuer_anmeldung` | D.40 | Verschiebung bei Fristende am Wochenende/Feiertag bestätigen |
| K-369 | `personal.lohnsteuer_anmeldung` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-370 | `personal.lohnsteuer_anmeldung` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-371 | `personal.mindestlohn` | D.39 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-372 | `personal.mindestlohn` | D.39 | Ausnahmen (z. B. Azubis, Praktika) als Hinweis ergänzen? |
| K-373 | `personal.mindestlohn` | D.39 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-374 | `personal.mindestlohn` | D.39 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-375 | `personal.minijob_grenze` | D.39 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-376 | `personal.minijob_grenze` | D.39 | Folgen bei Überschreiten (gelegentliches Überschreiten) ergänzen |
| K-377 | `personal.minijob_grenze` | D.39 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-378 | `personal.minijob_grenze` | D.39 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-379 | `personal.mutterschutz_gefaehrdungsbeurteilung` | D.43 | Frist „vor Arbeitsbeginn“ wie E.50 – bestätigen |
| K-380 | `personal.mutterschutz_gefaehrdungsbeurteilung` | D.43 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-381 | `personal.mutterschutz_gefaehrdungsbeurteilung` | D.43 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-382 | `personal.nachweisgesetz` | D.41 | Frist (je Angabe unterschiedlich) steht nicht in der Spezifikation – als spätestens bei Beginn eingetragen, fachlich ersetzen |
| K-383 | `personal.nachweisgesetz` | D.41 | Zulässige Form (Schriftform/elektronisch) aktuell? |
| K-384 | `personal.nachweisgesetz` | D.41 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-385 | `personal.schwangerschaft_mitteilung` | D.43 | Frist („unverzüglich“) steht nicht in der Spezifikation – als am Tag der Mitteilung eingetragen, fachlich ersetzen |
| K-386 | `personal.schwangerschaft_mitteilung` | D.43 | Zuständige Behörde je Land |
| K-387 | `personal.schwangerschaft_mitteilung` | D.43 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-388 | `personal.schwangerschaft_mitteilung` | D.43 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-389 | `personal.schwerbehinderte_anzeige` | D.45 | Quote und Höhe der Abgabe als Regelwerte |
| K-390 | `personal.schwerbehinderte_anzeige` | D.45 | Zählweise der Arbeitsplätze (G-05); wer insgesamt weniger als 20 beschäftigt, gilt als unter der Schwelle – bestätigen |
| K-391 | `personal.schwerbehinderte_anzeige` | D.45 | Verschiebung bei 31.3. am Wochenende |
| K-392 | `personal.schwerbehinderte_anzeige` | D.45 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-393 | `personal.schwerbehinderte_anzeige` | D.45 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-394 | `personal.sofortmeldung` | D.38 | „Bei Arbeitsbeginn“ als spätestens am Tag des Beginns umgesetzt – bestätigen |
| K-395 | `personal.sofortmeldung` | D.38 | Branchenliste vollständig (§ 28a Abs. 4 SGB IV)? |
| K-396 | `personal.sofortmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-397 | `personal.sv_abmeldung` | D.38 | Frist der Abmeldung steht nicht in der Spezifikation – als spätestens am Ende der Beschäftigung eingetragen, fachlich ersetzen |
| K-398 | `personal.sv_abmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-399 | `personal.sv_abmeldung` | D.38 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-400 | `personal.sv_anmeldung` | D.38 | Frist der Anmeldung steht nicht in der Spezifikation – als spätestens bei Beschäftigungsbeginn eingetragen, fachlich ersetzen |
| K-401 | `personal.sv_anmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-402 | `personal.sv_anmeldung` | D.38 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-403 | `personal.sv_beitraege` | D.40 | Minijobs: Fälligkeit bei der Minijob-Zentrale gleich? |
| K-404 | `personal.sv_beitraege` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-405 | `personal.sv_beitraege` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-406 | `personal.sv_jahresmeldung` | D.38 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-407 | `personal.sv_jahresmeldung` | D.38 | Termin der Jahresmeldung als Regeldaten ergänzen (für den Jahreskalender I) |
| K-408 | `personal.sv_jahresmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-409 | `personal.sv_jahresmeldung` | D.38 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-410 | `personal.umlagen_eau` | D.40 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-411 | `personal.umlagen_eau` | D.40 | Welche Umlage gilt für wen (z. B. U1 nach Betriebsgröße) – fachlich ergänzen |
| K-412 | `personal.umlagen_eau` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-413 | `personal.umlagen_eau` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-414 | `produkte.barrierefreiheit` | G.70 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-415 | `produkte.barrierefreiheit` | G.70 | Produktliste (§ 1 BFSG) als Auswahl ergänzen |
| K-416 | `produkte.barrierefreiheit` | G.70 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-417 | `produkte.batterien` | G.72 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-418 | `produkte.batterien` | G.72 | Zuständige Stelle und Registrierungsweg ergänzen |
| K-419 | `produkte.batterien` | G.72 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-420 | `produkte.elektrogeraete` | G.72 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-421 | `produkte.elektrogeraete` | G.72 | Wer gilt als Hersteller (Import, Eigenmarke)? |
| K-422 | `produkte.elektrogeraete` | G.72 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-423 | `produkte.geldwaesche_gueterhaendler` | G.75 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-424 | `produkte.geldwaesche_gueterhaendler` | G.75 | Schwelle für Barzahlungen nicht in der Spezifikation – als Regelwert ergänzen |
| K-425 | `produkte.geldwaesche_gueterhaendler` | G.75 | Immobilien- und Finanzbranche als Branchenmodul (H) |
| K-426 | `produkte.geldwaesche_gueterhaendler` | G.75 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-427 | `produkte.gpsr` | G.73 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-428 | `produkte.gpsr` | G.73 | Pflichten für Händler vs. Hersteller trennen |
| K-429 | `produkte.gpsr` | G.73 | Lebensmittel und Kosmetik haben eigene Regeln – Abgrenzung |
| K-430 | `produkte.gpsr` | G.73 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-431 | `produkte.verpackung` | G.71 | „Vor dem ersten Inverkehrbringen“ als Frist mit Ereignis abbilden? |
| K-432 | `produkte.verpackung` | G.71 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-433 | `steuern.aufbewahrung` | C.32 | Fristbeginn (Ende des Kalenderjahres) und Aufbewahrungsdauern als Regelwerte führen |
| K-434 | `steuern.aufbewahrung` | C.32 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-435 | `steuern.aufbewahrung` | C.32 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-436 | `steuern.bauabzugsteuer_freistellung` | C.35 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-437 | `steuern.bauabzugsteuer_freistellung` | C.35 | Auch Handwerksbetriebe mit Bauleistungen erfassen (Branche handwerk)? |
| K-438 | `steuern.bauabzugsteuer_freistellung` | C.35 | Gültigkeitsdauer der Bescheinigung und Erneuerung ergänzen |
| K-439 | `steuern.bauabzugsteuer_freistellung` | C.35 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-440 | `steuern.buchfuehrungspflicht` | C.28 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-441 | `steuern.buchfuehrungspflicht` | C.28 | e.K. und GmbH & Co. KG als HGB-buchführungspflichtig angenommen – bestätigen |
| K-442 | `steuern.buchfuehrungspflicht` | C.28 | Im Gründungsjahr und vor dem Start gibt es keine Vorjahreswerte – § 141-Grenzen dann als nicht überschritten behandelt |
| K-443 | `steuern.buchfuehrungspflicht` | C.28 | § 141 AO: Pflicht beginnt erst nach Mitteilung des Finanzamts – berücksichtigen |
| K-444 | `steuern.buchfuehrungspflicht` | C.28 | Grenze inklusive/exklusive |
| K-445 | `steuern.buchfuehrungspflicht` | C.28 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-446 | `steuern.e_bilanz` | B.18 | Frist (gekoppelt an die Steuererklärung) als Regeldaten ergänzen |
| K-447 | `steuern.e_bilanz` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-448 | `steuern.e_bilanz` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-449 | `steuern.e_rechnung_empfang` | C.30 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-450 | `steuern.e_rechnung_empfang` | C.30 | Gilt für alle Unternehmen, auch Kleinunternehmer – bestätigen |
| K-451 | `steuern.e_rechnung_empfang` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-452 | `steuern.e_rechnung_versand_2027` | C.30 | Maßgeblich ist der Umsatz 2026: bis 2026 wird auch die Prognose herangezogen – bestätigen |
| K-453 | `steuern.e_rechnung_versand_2027` | C.30 | Rechtsstatus und gueltig_ab festlegen |
| K-454 | `steuern.e_rechnung_versand_2027` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-455 | `steuern.e_rechnung_versand_2028` | C.30 | Rechtsstatus und gueltig_ab festlegen |
| K-456 | `steuern.e_rechnung_versand_2028` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-457 | `steuern.est_erklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-458 | `steuern.est_erklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-459 | `steuern.est_erklaerung` | C.27 | Personengesellschaften: Feststellungserklärung der Gesellschaft zusätzlich? |
| K-460 | `steuern.est_erklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-461 | `steuern.est_erklaerung` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-462 | `steuern.euer` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-463 | `steuern.euer` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-464 | `steuern.euer` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-465 | `steuern.euer` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-466 | `steuern.gewst_erklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-467 | `steuern.gewst_erklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-468 | `steuern.gewst_erklaerung` | C.27 | Freibetrag (C.34) als Regelwert führen |
| K-469 | `steuern.gewst_erklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-470 | `steuern.gewst_erklaerung` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-471 | `steuern.gobd_verfahrensdokumentation` | C.31 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-472 | `steuern.gobd_verfahrensdokumentation` | C.31 | Fundstelle des aktuellen GoBD-Schreibens ergänzen |
| K-473 | `steuern.gobd_verfahrensdokumentation` | C.31 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-474 | `steuern.gobd_verfahrensdokumentation` | C.31 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-475 | `steuern.kasse_tse_belegausgabe` | C.33 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-476 | `steuern.kasse_tse_belegausgabe` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-477 | `steuern.kassenmeldung` | C.33 | Bestandskassen (Meldefrist 31.7.2025): Pflicht für Kassen ohne gemeldetes Anschaffungsdatum abbilden |
| K-478 | `steuern.kassenmeldung` | C.33 | Verschiebung bei Fristende am Wochenende festlegen |
| K-479 | `steuern.kassenmeldung` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-480 | `steuern.kassenmeldung_ausserbetriebnahme` | C.33 | Mehrere Kassen: je Ereignis eine Meldung (derzeit Bezug auf die erste Außerbetriebnahme) |
| K-481 | `steuern.kassenmeldung_ausserbetriebnahme` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-482 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-483 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Vor dem Start gibt es keinen Vorjahresumsatz – Vorjahresgrenze dann nicht geprüft |
| K-484 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Prognose statt tatsächlicher Umsatz: bis Abschnitt 4 nur Profilangaben – Formulierung „nach deinen Angaben“ bestätigen |
| K-485 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Grenze inklusive/exklusive (K-18) |
| K-486 | `steuern.kleinunternehmer_warnung_80` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-487 | `steuern.kleinunternehmer_warnung_80` | C.23 | Umsatzbegriff für die Grenze (G-06): Summe der gestellten Rechnungen (netto, abzüglich Stornos) im Kalenderjahr nach Rechnungsdatum – bestätigen |
| K-488 | `steuern.kleinunternehmer_warnung_80` | C.23 | Warnstufen 80 % und 95 % aus der Spezifikation |
| K-489 | `steuern.kleinunternehmer_warnung_95` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-490 | `steuern.kleinunternehmer_warnung_95` | C.23 | Umsatzbegriff für die Grenze (G-06): Summe der gestellten Rechnungen (netto, abzüglich Stornos) im Kalenderjahr nach Rechnungsdatum – bestätigen |
| K-491 | `steuern.kleinunternehmer_warnung_95` | C.23 | Warnstufen 80 % und 95 % aus der Spezifikation |
| K-492 | `steuern.kleinunternehmerregelung` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-493 | `steuern.kleinunternehmerregelung` | C.23 | Echtzeit-Warnungen bei 80 % und 95 % (Spezifikation C.23) folgen in Abschnitt 4 mit Finanzdaten |
| K-494 | `steuern.kst_erklaerung` | B.19 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-495 | `steuern.kst_erklaerung` | B.19 | Abgabefristen mit und ohne Steuerberatung als Regeldaten (wie G-18) |
| K-496 | `steuern.kst_erklaerung` | B.19 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-497 | `steuern.kst_erklaerung` | B.19 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-498 | `steuern.rechnungen_pflichtangaben` | C.29 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-499 | `steuern.rechnungen_pflichtangaben` | C.29 | Liste der Pflichtangaben und Kleinbetragsgrenze als Inhalt ergänzen |
| K-500 | `steuern.rechnungen_pflichtangaben` | C.29 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-501 | `steuern.ust_jahreserklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-502 | `steuern.ust_jahreserklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-503 | `steuern.ust_jahreserklaerung` | C.27 | Kleinunternehmer: Erklärungspflicht prüfen |
| K-504 | `steuern.ust_jahreserklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-505 | `steuern.ust_sondervorauszahlung` | C.24 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-506 | `steuern.ust_sondervorauszahlung` | C.24 | Fälligkeitstermin und Bemessungsgrundlage der Sondervorauszahlung ergänzen (K-08) |
| K-507 | `steuern.ust_sondervorauszahlung` | C.24 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-508 | `steuern.ust_voranmeldung` | C.24 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen (früherer Text war nicht belegt) |
| K-509 | `steuern.ust_voranmeldung` | C.24 | Befreiung bis Grenze ist laut Spezifikation 'möglich' (Ermessen Finanzamt?) – Auslöser bildet das als 'gilt nicht' ab; Formulierung prüfen |
| K-510 | `steuern.ust_voranmeldung` | C.24 | Neugründer: Aussetzung der monatlichen Pflicht 2021–2026 (Radar) – Rhythmus im Gründungs- und Folgejahr festlegen |
| K-511 | `steuern.ust_voranmeldung` | C.24 | Sondervorauszahlung 1/11 bei monatlicher Dauerfristverlängerung als eigene Pflicht anlegen |
| K-512 | `steuern.ust_voranmeldung` | C.24 | Verschiebung auf nächsten Werktag und Feiertagskalender (Bundesland) bestätigen |
| K-513 | `steuern.ust_voranmeldung` | C.24 | gueltig_ab: Datum der heutigen Fassung der Grenzen eintragen |
| K-514 | `steuern.vorauszahlung_est_kst` | C.26 | Verschiebung auf den nächsten Werktag bei Zahlungsterminen bestätigen |
| K-515 | `steuern.vorauszahlung_est_kst` | C.26 | Schonfrist bei Überweisung erwähnen? |
| K-516 | `steuern.vorauszahlung_est_kst` | C.26 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-517 | `steuern.vorauszahlung_est_kst` | C.26 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-518 | `steuern.vorauszahlung_gewst` | C.26 | Verschiebung und Kalender (Gemeinde) bestätigen |
| K-519 | `steuern.vorauszahlung_gewst` | C.26 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-520 | `steuern.vorauszahlung_gewst` | C.26 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-521 | `steuern.zusammenfassende_meldung` | C.25 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-522 | `steuern.zusammenfassende_meldung` | C.25 | Meldezeitraum und Abgabefrist ergänzen |
| K-523 | `steuern.zusammenfassende_meldung` | C.25 | Kleinunternehmer ausgenommen? |
| K-524 | `steuern.zusammenfassende_meldung` | C.25 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-525 | `steuern.zusammenfassende_meldung` | C.25 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-526 | `datenschutz.dsb.schwelle_personen@1` | F.61 | gueltig_ab ist Platzhalter |
| K-527 | `datenschutz.dsb.schwelle_personen@1` | F.61 | Geplante Streichung bis Ende 2026 (Radar F.61) – gueltig_bis setzen, sobald beschlossen |
| K-528 | `gesellschaft.gmbh.stammkapital_mindest@1` | B.14 | gueltig_ab ist Platzhalter |
| K-529 | `gesellschaft.gmbh.stammkapital_mindest@1` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-530 | `gesellschaft.gmbh.mindesteinzahlung_anteil@1` | B.14 | Spezifikation: „mindestens Hälfte einzuzahlen“ – Bezug (Mindeststammkapital oder Summe der Anteile) und Einzahlung je Geschäftsanteil prüfen |
| K-531 | `gesellschaft.gmbh.mindesteinzahlung_anteil@1` | B.14 | Rechtsgrundlage ergänzt |
| K-532 | `gesellschaft.ug.stammkapital_mindest@1` | B.14 | gueltig_ab ist Platzhalter |
| K-533 | `gesellschaft.ug.stammkapital_mindest@1` | B.14 | Rechtsgrundlage ergänzt |
| K-534 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | gueltig_ab ist Platzhalter |
| K-535 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | Rechtsgrundlage ergänzt |
| K-536 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | Berechnungsbasis (Jahresüberschuss abzüglich Verlustvortrag) prüfen |
| K-537 | `online.vsbg.schwelle_beschaeftigte@1` | G.69 | gueltig_ab ist Platzhalter |
| K-538 | `online.vsbg.schwelle_beschaeftigte@1` | G.69 | „mehr als 10“: Vergleich > 10 in den Regeln |
| K-539 | `online.bfsg.kleinst_beschaeftigte@1` | G.70 | Rechtsgrundlage ergänzt |
| K-540 | `online.bfsg.kleinst_umsatz@1` | G.70 | Alternative Bilanzsumme fehlt im Profil |
| K-541 | `online.bfsg.kleinst_umsatz@1` | G.70 | Rechtsgrundlage ergänzt |
| K-542 | `personal.mindestlohn.stunde@1` | D.39 | Rechtsgrundlage (aktuelle Anpassungsverordnung) ergänzen |
| K-543 | `personal.mindestlohn.stunde@2` | D.39 | Status „beschlossen“ – Verordnung prüfen |
| K-544 | `personal.minijob.grenze_monat@1` | D.39 | Rechtsgrundlage ergänzt |
| K-545 | `personal.minijob.grenze_monat@2` | D.39 | Dynamische Kopplung an den Mindestlohn – Wert für 2027 bestätigen |
| K-546 | `personal.schwerbehinderte.schwelle_arbeitsplaetze@1` | D.45 | gueltig_ab ist Platzhalter |
| K-547 | `personal.schwerbehinderte.schwelle_arbeitsplaetze@1` | D.45 | Rechtsgrundlage ergänzt |
| K-548 | `personal.hinschg.schwelle@1` | D.46 | gueltig_ab ist Platzhalter |
| K-549 | `personal.hinschg.schwelle@1` | D.46 | Rechtsgrundlage ergänzt |
| K-550 | `personal.entgelttransparenz.berichtspflicht_schwelle@1` | D.47 | Spezifikation: „über 150 Beschäftigte“ – Vergleich > umgesetzt |
| K-551 | `personal.entgelttransparenz.berichtspflicht_schwelle@1` | D.47 | Deutsches Umsetzungsgesetz abwarten |
| K-552 | `arbeitsschutz.ersthelfer.schwelle_versicherte@1` | E.53 | gueltig_ab ist Platzhalter |
| K-553 | `arbeitsschutz.ersthelfer.schwelle_versicherte@1` | E.53 | Rechtsgrundlage ergänzt |
| K-554 | `arbeitsschutz.ersthelfer.schwelle_versicherte@1` | E.53 | Versicherte vs. Beschäftigte |
| K-555 | `steuern.ust_va.grenze_befreiung@1` | C.24 | gueltig_ab ist Platzhalter (Beginn Betrachtungszeitraum), tatsächliches Inkrafttreten der Grenze eintragen |
| K-556 | `steuern.ust_va.grenze_monatlich@1` | C.24 | gueltig_ab ist Platzhalter |
| K-557 | `steuern.ust_va.grenze_monatlich@1` | C.24 | Spezifikation: 'über 9.000 € monatlich' – Vergleich '>' bestätigen |
| K-558 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-559 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | Grenze inklusive oder exklusive ('max. 25.000 €')? |
| K-560 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-561 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | Gründungsjahr: abweichende Grenze 25.000 € als eigener Regelwert |
| K-562 | `steuern.ustg19.grenze_gruendungsjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-563 | `steuern.ustg19.grenze_gruendungsjahr@1` | C.23 | Grenze inklusive oder exklusive? |
| K-564 | `steuern.ao141.grenze_umsatz@1` | C.28 | gueltig_ab ist Platzhalter |
| K-565 | `steuern.ao141.grenze_umsatz@1` | C.28 | Bezugsjahr und Vergleich (> oder ≥) bestätigen |
| K-566 | `steuern.ao141.grenze_gewinn@1` | C.28 | gueltig_ab ist Platzhalter |
| K-567 | `steuern.ao141.grenze_gewinn@1` | C.28 | Bezugsjahr und Vergleich (> oder ≥) bestätigen |
| K-568 | `steuern.e_rechnung.grenze_vorjahresumsatz_2027@1` | C.30 | Übergangsregel-Fundstelle (§ 27 Abs. 38 UStG) ergänzt, nicht aus Spezifikation |
| K-569 | `steuern.e_rechnung.grenze_vorjahresumsatz_2027@1` | C.30 | gueltig_ab/gueltig_bis als Übergangszeitraum bestätigen |
| K-570 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-571 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-572 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | Fristbeginn (Ende des Kalenderjahres) als Regel ergänzen |
| K-573 | `steuern.aufbewahrung.buecher_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-574 | `steuern.aufbewahrung.buecher_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-575 | `steuern.aufbewahrung.geschaeftsbriefe_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-576 | `steuern.aufbewahrung.geschaeftsbriefe_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-577 | `steuern.ust.satz_regel@1` |  | [FACHLICH ZU PRÜFEN] Steuersatz steht nicht in der Spezifikation – vor Freigabe gegen das Gesetz prüfen |
| K-578 | `steuern.ust.satz_regel@1` |  | gueltig_ab ist Platzhalter |
| K-579 | `steuern.ust.satz_ermaessigt@1` |  | [FACHLICH ZU PRÜFEN] Steuersatz steht nicht in der Spezifikation – vor Freigabe gegen das Gesetz prüfen |
| K-580 | `steuern.ust.satz_ermaessigt@1` |  | Welche Leistungen ermäßigt sind, entscheidet der Nutzer – Hinweis/Hilfe fachlich formulieren |
| K-581 | `steuern.ust.satz_ermaessigt@1` |  | gueltig_ab ist Platzhalter |
