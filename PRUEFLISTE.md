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
| T-37 | Behörden-Postfach: Erklärungstexte je Briefart (Bescheid, Mahnung, Anhörung, Auskunftsersuchen) – allgemein genug für J-2? Soll Amtlos Fristen aus dem Zugang berechnen (Bekanntgabe, § 122 AO) oder nur die Frist aus dem Brief übernehmen? | RA/StB | E-101 |
| T-38 | Frag Amtlos: Muster für Beratungsfragen (StBerG/RDG) vollständig? Hinweistext bei Verweis auf Partner | RA | E-100 |
| T-39 | Marktplatz: Wortlaut der Einwilligung in die Weitergabe, Nachweis der Berufszulassung (Kammerregister), Darstellung von Festpreisen, Werbeverbote im Berufsrecht | RA | E-102 |
| T-40 | Radar: Wahrscheinlichkeiten und erwartete Termine der Radar-Einträge (Gründungsbeschleunigung, USt-VA für Neugründer und vorhandene Entwürfe), Checklisten zur Vorbereitung | RA/StB | E-103 |
| T-41 | Push über Expo: Weiterleitung an Apple (APNs) und Google (FCM) – Drittland, AVV, Datenschutzhinweis in App und Store; Inhalt der Mitteilung (nur Titel und Datum) ausreichend datensparsam? | DSB | E-108 |
| T-42 | Englische Katalogtexte (732, KI-übersetzt): sprachlich und fachlich prüfen, besonders Fachbegriffe mit deutschem Original in Klammern | Übersetzung/RA | E-107 |
| T-43 | White-Label: Wer ist Anbieter und Verantwortlicher (Impressum, Datenschutzerklärung) unter der Partnermarke? Vertragsmuster, Haftung, Kennzeichnung „mit Amtlos“ ausreichend? | RA/DSB | E-105 |
| T-44 | Offline-Stempel: Reicht ein Gerätezeitpunkt (≤ 72 h, gekennzeichnet) für die Arbeitszeitaufzeichnung? Fenster und Kennzeichnung im Export | RA | E-108 |
| T-45 | Kanzlei legt Mandanten an: Vollmacht oder Einwilligung der Mandantin, Rollenverteilung (eigene Verantwortung der Steuerberatung vs. Auftragsverarbeitung) | RA/DSB | E-106 |
| T-46 | Rechtsseiten (Impressum, Datenschutzerklärung, Nutzungsbedingungen): anwaltliche Prüfung aller Texte, AVV-Muster für Beschäftigtendaten, Haftungsklausel, Streitbeilegungshinweis | RA/DSB | E-115 |
| T-47 | Abo: Widerrufsbelehrung nötig trotz B2B? Rechnungsstellung über Stripe (automatische Steuer, Reverse Charge für EU-Kunden), Preisangabe inkl./exkl. USt | RA/StB | E-113 |
| T-48 | Löschkonzept: Welche Nachweise müssen nach Löschung eines Unternehmens wie lange bleiben (Zeiten, Unterweisungen, Erledigungen)? Reicht die Anonymisierung? | RA/DSB | E-114 |
| T-49 | Apple-Store-Regeln: Darf die App auf das Abo am Computer hinweisen (Reader-/External-Link-Regeln)? Wird In-App-Kauf nötig, und mit welchen Folgen für Preis und Stripe? | RA / App-Store-Beratung | E-117 |
| T-50 | Pflichten zur Einstellung (Sofortmeldung, SV-Anmeldung, Erstunterweisung, Arbeitsbedingungen) erscheinen erst am ersten Arbeitstag, weil der Auslöser „Einstellung eingetreten“ ist. Bei einer Einstellung in der Zukunft fehlt die Checkliste bis dahin – die Sofortmeldung muss aber spätestens bei Arbeitsbeginn raus. Auslöser/Bezug für angekündigte Einstellungen fachlich klären. | StB / RA | E-120 (beim Test gefunden) |
| T-51 | Monatliche Sozialversicherungspflichten (Beitragsnachweis, Beiträge) erscheinen ab Gründung, sobald Beschäftigte im Profil stehen – auch für Monate vor dem ersten Arbeitstag. Bezug auf den Beschäftigungsbeginn (Ereignis „erste_einstellung“) fachlich festlegen. | StB | E-120 (beim Test gefunden) |
| T-52 | Alle 15 Unterlagen-Vorlagen der App (E-121) fachlich prüfen und freigeben: Gliederung, Feldbezeichnungen, Hilfetexte mit Beispielen, Bestätigungssätze über den Unterschriften. Den Hinweis zur Prüfung zeigt seit E-123 die App, nicht mehr das PDF. | je Bereich: Fachkraft für Arbeitssicherheit, DSB, RA (Arbeitsrecht), StB, Lebensmittelhygiene | E-121 |
| T-53 | Nachweis der Arbeitsbedingungen: Ist die Liste der Angaben nach § 2 Abs. 1 NachwG vollständig und aktuell (Stand nach den Änderungen 2022/2025)? Welche Form ist zulässig (Schriftform/Textform) – reicht das PDF mit Unterschriftsfeldern? Welche Angaben dürfen als „nur falls“ entfallen? | RA (Arbeitsrecht) | E-121 |
| T-54 | Verfahrensdokumentation: Deckt die Gliederung (Organisation, Programme, Belegeingang, Erfassung, Ausgangsrechnungen, Kasse, Aufbewahrung, Scannen, Datensicherung, Zugriff, Kontrollen, Änderungen) die GoBD-Anforderungen ab, oder braucht es die Vierteilung allgemeine Beschreibung/Anwender-/technische System-/Betriebsdokumentation? | StB | E-121 |
| T-55 | Datenschutzinformation: Gliederung nach Art. 13 DSGVO – welche Abschnitte sind immer nötig, welche nur „falls zutreffend“ (berechtigte Interessen, Drittland, Widerruf, automatisierte Entscheidungen, DSB)? Art. 14 (Daten nicht beim Betroffenen erhoben) gesondert? | DSB | E-121 |
| T-56 | Betriebsanweisung (Gefahrstoffe): Gliederung in Anwendungsbereich, Gefahren, Schutzmaßnahmen, Verhalten im Gefahrfall, Erste Hilfe, Entsorgung – passend zu TRGS 555? Gefahrstoffverzeichnis: reichen die Spalten (inkl. Gefahrenhinweise) für § 6 Abs. 12 GefStoffV? | Fachkraft für Arbeitssicherheit | E-121 |
| T-57 | Hautschutzplan (Spalten Hautschutz, Reinigung, Pflege, Handschuhe), Hygieneplan (Was, Wann, Womit, Wie, Wer), HACCP-Eigenkontrollblatt und Folgebelehrung § 43 IfSG (Inhalt, Erstbelehrung, Unterschrift): Gliederungen ausreichend? Unterschiede nach Landes-Hygieneverordnungen? | Lebensmittelhygiene / Gesundheitsamt / BGW | E-121 |
| T-58 | Steuer-Vorlagen (E-122): Rechnung (Pflichtangaben nach § 14 Abs. 4 UStG vollständig? Kleinbetragsrechnungen?), EÜR-Aufstellung (Brutto-Zufluss, Abschreibungen), Bilanz/GuV (Gliederung), USt-Voranmeldung (nur 19 %/7 %/ohne USt – reicht das, welche Sonderfälle fehlen: innergemeinschaftlich, § 13b), Kassenbuch (Anforderungen an die offene Ladenkasse), Kassenmeldung (Angaben nach § 146a Abs. 4 AO vollständig?), Aufbewahrungsplan (Fristen 10/8/6 Jahre ab 2025, Ablaufhemmung bei offener Festsetzungsfrist) | StB | E-122 |
| T-59 | Website und Verträge: Datenschutzerklärung (Gliederung), Impressum (Angaben nach § 5 DDG vollständig, Streitbeilegung), Vertrag zur Auftragsverarbeitung (Gliederung nach Art. 28 Abs. 3 DSGVO; reicht ein Feld für die Pflichten?) | DSB / RA | E-122 |
| T-60 | Datenblätter Gewerbeanmeldung (Angaben wie im amtlichen Formular?), Handelsregister (Angaben für den Notar), Transparenzregister (Angaben zu wirtschaftlich Berechtigten vollständig?) | RA / Notar | E-122 |
| T-61 | Personal: Arbeitszeitnachweis (reicht Beginn, Ende, Pause, Dauer für ArbZG/BAG und § 17 MiLoG?), Lohnkonto (Angaben nach § 4 LStDV vollständig?), Personalfragebogen (Angaben für die DEÜV-Meldung vollständig, Tätigkeitsschlüssel), Prüfprotokoll elektrische Geräte (Spalten ausreichend für DGUV V3?) | StB / Lohnbüro / Fachkraft für Arbeitssicherheit | E-122 |
| T-62 | Vorformulierte Bausteine (E-123) fachlich prüfen und freigeben, besonders alle mit Kennzeichen „unsicher“: Gefährdungen und Maßnahmen je Branche, Mutterschutz-Ergebnisse, Betriebsanweisungs-Bausteine, Hautschutz Friseur, VVT-Einträge (Rechtsgrundlagen, Löschfristen, Drittland), TOM, Datenschutzerklärung-Module, Aufsichtsbehörden je Land, AVV-Klauseln a–h, Datenpanne-Arten, NachwG-Texte, SV-Schlüssel, HACCP- und Hygiene-Einträge, IfSG-Inhalte. Quelle steht je Baustein; Recherche in `docs/recherche/2026-10-12/` | DSB, Fachkraft für Arbeitssicherheit, RA (Arbeitsrecht), StB, Lebensmittelhygiene | E-123 |
| T-63 | Gesetzeswortlaute wurden nicht gegen gesetze-im-internet.de abgeglichen (Seite war beim Erstellen nicht erreichbar): u. a. Kleinunternehmer-Hinweis § 19 Abs. 1 UStG, § 14 Abs. 4 UStG, § 5 DDG, § 2 NachwG, Art. 13 und 28 DSGVO, § 6 Abs. 12 GefStoffV, Mindestlohn 13,90 €/14,60 €, Minijob-Grenze 603 €/633 € | StB / RA | E-123 |
| T-64 | Eigene Formulierungen von Amtlos (nicht aus Quellen): Texte zur Bereitstellung der Daten (Art. 13 Abs. 2 lit. e), Satz zu automatisierten Entscheidungen, AVV-Abschnitt „Rechte und Pflichten des Auftraggebers“, Bereitstellung in der Datenschutzerklärung, Vorschläge für Arbeitsbereiche, Kündigungstext im Nachweis (§ 623, § 622 BGB, § 4 KSchG), Mengenbereiche im Gefahrstoffverzeichnis, Hinweis bei Grundstücksleistungen (§ 14 Abs. 4 Nr. 9 UStG), Normangaben DIN EN 50678/50699 im Prüfprotokoll | DSB / RA / StB / Elektrofachkraft | E-123 |
| T-65 | Offene Punkte aus dem Prüfbericht: Bereitstellung in der Datenschutzinformation ist eine Angabe für alle Verarbeitungen statt je Verarbeitung; KI-Kompetenz (Art. 4 KI-VO) kann durch den „Digital Omnibus“ abgeschwächt werden – Stand vor Freigabe prüfen | DSB / RA | E-123 |
| T-66 | Kurzbeschreibungen in Alltagssprache (`KURZ`) und Zuordnung zu Anlässen (`ANLAESSE`) prüfen – sie dürfen nichts versprechen, was die Vorlage nicht leistet (z. B. „mit allen Angaben, die das Finanzamt verlangt“ bei der Rechnung; „Wiederholte Hygiene-Belehrung“ bei § 43 IfSG). Welche Felder als „selten“ hinter „Weitere Angaben“ stehen, ebenfalls prüfen. | StB / RA / DSB | E-124 |
| T-67 | Pflichten-Check (E-126): Liefert der Katalog für typische Kleinbetriebe (Salon mit 3 Beschäftigten, Café, Handwerksbetrieb, Solo-Freelancer) die richtigen Pflichten? Besonders: Einstufung „hoch“, Termine wiederkehrender Pflichten, Auslöser der Gründungspflichten bei Betrieben, die schon länger bestehen. RDG: Ist die Darstellung „Für deinen Betrieb gelten N Pflichten“ noch Information und Werkzeug (Review Punkt 13)? | RA (RDG), StB, Fachbeirat | E-126 |
| T-68 | E-127: Reicht Festschreiben beim ersten Teilen/Drucken plus Storno für die GoBD bei Rechnungen aus (Zeitpunkt, Protokoll, Unveränderbarkeit auf dem Gerät ohne Server)? Ist das Kassenbuch als „Vorlage zum Ausdrucken“ mit dem Hinweistext richtig eingeordnet, oder gehört es aus der App? Angaben auf Rechnungen von Gesellschaften (§ 35a GmbHG, § 37a HGB) vollständig? Schwelle „seit mehr als sechs Monaten“ für abgetrennte Gründungsschritte; NIS2-Prüfpflicht im Katalog gilt auch für Freelancer ohne Beschäftigte (Auslöser prüfen). | StB, RA, Fachbeirat | E-127 |
| T-69 | E-128: (a) E-Rechnung – sind Pflichtangaben und Zuordnung (Steuerkategorien S/E, Kleinunternehmer-Hinweis, Storno als Rechnungskorrektur Typ 384 mit negativen Beträgen und Verweis auf die Ursprungsrechnung, nicht als Gutschrift Typ 381; Zahlungsart 58 SEPA-Überweisung) fachlich richtig? Ab wann müssen Betriebe E-Rechnungen ausstellen (Übergangsfristen) – die App nennt bewusst keine Daten. (b) Voranmeldung aus Rechnungen: Zuordnung nach Rechnungsdatum vs. Leistungszeitpunkt (Soll) bzw. Zahlung (Ist-Versteuerung); „steuerfrei/0 %“ in einer Summe; Hinweis, dass nur Rechnungen aus Amtlos enthalten sind. (c) „Jetzt dran“: Schwellen 14 und 45 Tage, „wichtig ohne Termin“ = Einstufung „hoch“; Erinnerung 3 Tage vorher – reicht das bei Terminen mit Vorlauf (z. B. Beitragsnachweis)? | StB, Fachbeirat | E-128 |
| T-70 | E-129 Voranmeldung: Zuordnung nach Leistungsdatum (Soll) bzw. Zahlungseingang (Ist) richtig umgesetzt? Anzahlungen bei Soll (Steuer entsteht mit Vereinnahmung, § 13 Abs. 1 Nr. 1 a Satz 4 UStG) sind nicht abgebildet. Storno im Zeitraum des Stornos (§ 17 UStG) bzw. bei Ist mit der Erstattung? Rechnungen mit Leistungszeitraum (z. B. „September bis Oktober“) werden nach Rechnungsdatum zugeordnet und gemeldet – richtig? Umsätze mit 0 % (Reverse Charge, innergemeinschaftliche Lieferung) stehen gemeinsam unter „ohne Umsatzsteuer“ – gehören in eigene Kennzahlen (Kz 21, 41 u. a.). | StB | E-129 |
| T-71 | ELSTER/ERiC (docs/08-elster-eric.md): Lizenzbedingungen im Original (Übermittlung im Auftrag?), § 87a und § 87d AO, Linux ARM64, Kennzahlen 2026 (Kz 500 statt 23), Weg A (Zertifikat des Nutzers kurz auf dem Server) oder Weg B (Übermittlung im Auftrag) – zusammen mit J-1. | RA, StB | E-129 |
| T-72 | E-Rechnung ins Ausland: Kategorien AE (Steuerschuldnerschaft des Empfängers), K (innergemeinschaftliche Lieferung mit Lieferanschrift = Empfängeranschrift) und E (Befreiung mit Hinweistext) fachlich richtig? Pflichtangaben auf Rechnungen ins EU-Ausland (§ 14a UStG) – Hinweistexte in den Bausteinen sind als unsicher markiert. Länder-Erkennung aus USt-IdNr. bei abweichendem Sitz. Drittländer (Schweiz) mit 0 % sind nur als „befreit“ möglich. | StB | E-129 |
| T-73 | Fristen der Steuererklärungen (§ 149 Abs. 2/3, § 108 Abs. 3 AO) gegen die amtliche Fassung prüfen; Übergangsfristen Art. 97 § 36 EGAO für Veranlagungszeiträume bis 2024, Vorabanforderung § 149 Abs. 4 AO, Fristverlängerung auf Antrag, Land- und Forstwirte. Gilt die Steuerberater-Frist auch, wenn nur einzelne Erklärungen beraten sind? | StB | E-129 |
| T-74 | Datenschutz und Aufbewahrung: Reicht verschlüsselte Ablage mit Schlüssel im Schlüsselbund und optionaler Face-ID-Sperre (Art. 32 DSGVO)? Löschschutz „erst nach Sicherung“ – erfüllt die App damit die Aufbewahrung (8 Jahre für Belege, Regelwert), oder braucht es eine Pflicht zur Sicherung außerhalb des Geräts (iCloud, Server)? Wochen-Sicherungen in iCloud: Löschkonzept. Zusammenführen: Konflikte bei gleicher ID mit festgeschriebener Fassung. | DSB, StB | E-129 |
| T-75 | Gestaltung der Dokumente: Brief nach DIN 5008 Form B (Maße: Anschriftfeld 45 mm von oben, 20 mm links, 85 × 45 mm; Informationsblock 125 mm; Falzmarken 105/210 mm, Lochmarke 148,5 mm) in einem gedruckten Fensterkuvert prüfen. Schriftlizenz (OFL 1.1, umbenannte Teilmengen „Amtlos Sans/Serif“) prüfen. Zahlungsaufforderung („Bitte überweisen Sie …“) und Steuernummer im Informationsblock – passt das zu jeder Rechnungsart? | Gestaltung, RA | E-129 |
| T-76 | E-130 Dokumente: (a) GiroCode nach EPC069-12 v002 (BCD/002/1/SCT, Zeichensatz UTF-8, Betrag „EUR12.34“, Verwendungszweck ≤ 140 Zeichen, Fehlerkorrektur M) – Fassung der EPC-Richtlinie im Original prüfen, Testüberweisung mit einer Banking-App. (b) USt-Voranmeldung: Kz 81 (19 %), 86 (7 %), 66 (Vorsteuer), 83 (Zahllast) gegen den Vordruck USt 1 A 2026 prüfen; Umsätze ohne USt (Kleinunternehmer, Reverse Charge, innergemeinschaftliche Lieferung) stehen ohne Kennzahl mit Hinweis. (c) Nachweis der Arbeitsbedingungen: Reihenfolge und Vollständigkeit der Punkte 1–15 gegen § 2 Abs. 1 NachwG (Fassung ab 2025, Textform). (d) Verfahrensdokumentation: Randangaben „GoBD Tz. 10.1/10.2“ (BMF-Schreiben vom 11.03.2024, Rn 151 ff.) – Abschnittsnummern statt Rn gewählt, prüfen. (e) Datenpanne: Zuordnung der Abschnitte zu Art. 33 Abs. 3 lit. a–d DSGVO; VVT-Einträge zu Art. 30 Abs. 1 lit. b–g. (f) Betriebsanweisung: Aufbau nach DGUV Information 211-010, orange Kennfarbe – Konvention, keine Pflicht; ohne GHS-Piktogramme zulässig? (g) DIN 5008 Form B wie T-75. | StB, RA, FaSi, DSB, Gestaltung | E-130 |
| T-77 | App-Paket vor dem Store: Export-Compliance für die AES-Verschlüsselung der lokalen Daten (ITSAppUsesNonExemptEncryption, Selbsteinstufung nach US-EAR / Apple-Dokumentation „Complying with Encryption Export Regulations“), App-Privacy-Angaben (keine Datenerhebung, keine Tracking-SDKs – stimmt das mit expo-notifications und iCloud?), Berechtigungstexte (Fotos, Face ID, Mitteilungen) auf Deutsch, Altersfreigabe, Impressumspflicht in der App (§ 5 DDG) und Datenschutzhinweis für die App (Art. 13 DSGVO, auch wenn keine Daten den Rechner verlassen). | RA, DSB | E-131 |
| T-78 | E-132 Amtlos Pro: Abo-Pflichtangaben auf Bezahlschirm und im Store (App Review Guideline 3.1.2, § 312k BGB Kündigungsbutton gilt für Apple-Abos?), Freikontingent und Sperren fair und nicht irreführend (UWG)? Datenschutz: RevenueCat als Auftragsverarbeiter (AVV, Drittlandtransfer USA), Angaben im Datenschutzhinweis und im App-Privacy-Formular. Landingpage: Aussagen „Unterlagen, die Prüfer erwarten“, E-Rechnungs-Fahrplan, Bildschirme mit erfundenem Salon als Beispiel gekennzeichnet. | RA, DSB | E-132 |
| T-79 | E-133 Belege und Steuerberater-Paket: (a) Vorsteuer nach Belegdatum (§ 15 Abs. 1 UStG) – richtig auch bei Ist-Versteuerung, Anzahlungen? (b) Kategorien → Zeilen der Anlage EÜR: Wortlaut in `belege.ts` (z. B. „Miete/Pacht für Geschäftsräume…“, „Kraftfahrzeugkosten und andere Fahrtkosten“) weicht von den Vorschlägen der EÜR-Vorlage (`EUER_AUSGABEN`) ab – amtlichen Wortlaut und Zeilennummern 2026 abgleichen; Bewirtung 70 %, Geschenke 50 €, GWG 800 € netto. (c) EÜR: Einnahmen netto plus vereinnahmte USt, Ausgaben netto plus gezahlte Vorsteuer, Belege ohne Vorsteuerabzug brutto – richtig? An das Finanzamt gezahlte USt fehlt noch. (d) DATEV-Buchungsstapel: alle 11 Prüfpunkte aus `pruefpunkteBuchungen()` (Kontenrahmen, BU-Schlüssel, Spaltenliste Version 700, Kopf, Stornos, Belegfeld). (e) Aufbewahrung der E-Rechnung im Original (XML byte-genau, verschlüsselt, mit Sicherung) GoBD-konform; Löschen einzelner Belege zulassen? (f) Belegfoto als Ersatz für Papier (ersetzendes Scannen) – Verfahrensdokumentation nötig. | StB | E-133 |
| T-80 | E-134 Konto und Synchronisation: (a) Hosting des Servers (EU, Anbieter, AV-Vertrag nach Art. 28 DSGVO), Identity-Provider wählen (Konto-Löschung dort, Datenübermittlung), RevenueCat mit Konto-ID statt anonymer Kennung im Datenschutzhinweis und im AV-Vertrag; (b) Datenschutzhinweis der App (Abschnitt „Konto und Synchronisation“) und Datenschutz-Label im App Store („Kontaktdaten: E-Mail“, „Kennungen: Benutzer-ID“, verknüpft, App-Funktionalität) – und `privacyManifests` in app.json für Builds mit Server ergänzen; (c) Sind Ende-zu-Ende-verschlüsselte Daten auf dem Server für Amtlos personenbezogene Daten (Auftragsverarbeitung gegenüber dem Betrieb für Kunden- und Mitarbeiterdaten)? (d) Speicherdauer nach Abo-Ende (Server prüft Pro nur beim Schreiben; Lesen bleibt) und nach Konto-Löschung (sofort); (e) GoBD: Synchronisation ersetzt keine Sicherung/Archivierung – Hinweis ausreichend? (f) Text bei doppelt vergebenen Rechnungsnummern (zwei Geräte offline) fachlich bestätigen. | RA/DSB/StB | E-134 |
| T-81 | E-135 XRechnung: Nachlass-/Rabattzeilen als positive Preise mit negativer Menge (statt negativem Preis, BR-27) und Storno mit Rabattzeile gegen den KoSIT-Validator prüfen; ob Rabatte als Zeile oder als Nachlass auf Belegebene (AllowanceCharge) darzustellen sind. | StB/Tech | E-135 |
| T-82 | E-137 Erscheinungsbild auf echtem iPhone ansehen (hell, dunkel, große Schrift/Dynamic Type, iPhone SE und Pro Max): Amtlos Serif/Sans werden geladen, SF-Symbol-Kacheln und Stempel (Haken „heavy“) sitzen mittig, Kartenschatten nicht zu stark, Bühne und Tab-Leiste mit Unschärfe, Fokusrahmen der Felder, Drück-Effekt der Knöpfe. | Gründer/Design | E-137 |
| T-83 | E-141 Native Navigation auf dem iPhone (iOS 26) prüfen: Tab-Leiste mit Glas und Verkleinern beim Scrollen; große Titel wandern beim Scrollen in die Leiste; „+“ öffnet das Menü und alle drei Einträge funktionieren; Blätter (Rechnung, Pflichten-Check, Pro, Formulare) lassen sich wegwischen, ohne Daten zu verlieren; Blatt über Blatt; Meldungen erscheinen über Blättern; Tastatur verdeckt in Blättern keine Felder; VoiceOver liest Leistenknöpfe („Schließen“, „Erstellen“, „Übersicht“). Erst nach diesem Test einreichen. | Gründer/Tech | E-141 |
| T-84 | E-142 Neues Design auf dem iPhone prüfen: Onest wird geladen (kein Systemschrift-Blitzen); Bühne reicht hinter die Statusleiste, Statusleiste hell auf der Bühne und dunkel auf Unterseiten; beim Ziehen über das Blatt-Ende kein grüner Streifen; die Kapsel verdeckt keine Inhalte und lässt die Home-Leiste frei; Abschluss einer Rechnung mit grüner Leiste, lesbarem Schließen-Knopf und Minze-Knopf; Dunkelmodus; VoiceOver liest Tabs, „Erstellen“ und die Monatskacheln. | Gründer/Tech | E-142 |
| T-85 | E-143 Vor dem Einreichen gegen Apples aktuelle Doku prüfen: Gründe im Datenschutz-Manifest (CA92.1, C617.1, 35F9.1, E174.1) und die App-Privacy-Angaben in App Store Connect (E-Mail, Name, Konto-ID, Kaufhistorie – verknüpft, nicht zum Tracking). Native Schlüsselableitung (z. B. PBKDF2/scrypt über ein natives Modul) einbauen und dann auf ≥ 600.000 Iterationen gehen (OWASP); bis dahin 150.000 in JavaScript. Aufbewahrung: 12 Wochen-Sicherungen in iCloud ausreichend? | Gründer/Tech | E-143 |
| T-86 | E-143 Prüfpaket (`scripts/pruefpaket.py` → Excel) an Anwalt bzw. Steuerberatung geben; zuerst Priorität A (68 Pflichten), dazu die 29 Regelwerte. Ergebnisse in den Katalog übernehmen und `pruefung.status` setzen. | Gründer + RA/StB | E-143 |
| T-87 | E-146 Storno: Leistungsdatum ist das Storno-Datum (`leistung_gleich` wird übernommen); ob Storno-PDF/XRechnung das ursprüngliche Leistungsdatum zeigen müssen – die USt-Korrektur nach § 17 UStG im Storno-Zeitraum bleibt davon zu trennen. Storno-XRechnung enthält Fälligkeit und Zahlungsweg (IBAN des Betriebs), das PDF nicht; „Gutschrift“-Hinweis und Grundstücks-Hinweis stehen nur im PDF. Rechnung mit negativer Summe (Nachlass > Leistung) wird als Typ 380 erzeugt. | StB/Tech | E-146 |
| T-88 | E-146 USt-Voranmeldung: Steuer wird aus Cent-Beträgen berechnet; ELSTER rechnet aus vollen Euro der Bemessungsgrundlage (z. B. 12.345,67 € → 2.345,68 € statt 2.345,55 €). Kleinunternehmer-Umsätze landen in `umsatz_frei`. Bestätigen, welche Basis die Vorlage zeigen soll. | StB | E-146 |
| T-89 | E-146 Belegtexte: Vorsteuer „mit ausgewiesener Umsatzsteuer (§ 15 UStG)“ – Kleinbetragsrechnungen bis 250 € (§ 33 UStDV) zeigen nur den Steuersatz; Belegdatum als Zeitpunkt für die Vorsteuer (Leistung/Eingang); EÜR-Hinweis „über 800 € netto: Abschreibung“ ohne Sammelposten-Option. | StB | E-146 |
| T-90 | E-146 Vorlagen fachlich: DIN EN ISO 374-6 „Friseur-Symbol“ (Hautschutz, Gefährdung Hautkontakt) belegen; „Sticharbeiten“ in der Gefährdungsbeurteilung; Betriebsanweisung ohne Gefahrenpiktogramme (TRGS 555); Gewerbeanmeldung fragt für juristische Personen keine Register-/Vertreterangaben ab (GewA 1); Rechtsgrundlage in der Kopfleiste der Handelsregister-Vorlage; Impressum nennt § 36 VSBG als Grundlage auch ohne VSBG-Abschnitt; Steuererklärungs-Vorlage summiert Vorauszahlungen verschiedener Steuerarten; Kassenbuch nimmt negative Einnahmen/Ausgaben ohne Hinweis an (Gegenbuchung?). | Sifa/RA/StB | E-146 |
| T-91 | E-146 Store-Text und Werbung: „Voranmeldung und EÜR mit einem Tipp“ und das Onboarding („…die Umsatzsteuer-Voranmeldung gleich mit“) klingen nach fertiger Abgabe; die App übernimmt Werte. „Auch ins EU-Ausland“ bei XRechnung (EU-Empfänger erwarten oft Peppol BIS). Der Store-Text sagt „ohne Konto“ – stimmt nur, solange der Build ohne Synchronisation (`EXPO_PUBLIC_API_URL`) gebaut wird. | RA/Produkt | E-146 |
| T-92 | E-146 Datenschutzinformation (Art. 13/14) übernimmt die internen VVT-Texte wörtlich – darunter Anweisungen an den Betrieb („… löschen, sobald“), Quellenvermerke („BayLDA-Muster“, „laut DSK“) und Begründungen. Eigene, an Betroffene gerichtete Texte je Verarbeitung (Löschfrist, Empfänger, Rechtsgrundlage) fachlich formulieren; Widerspruchsrecht nach Art. 21 Abs. 4 DSGVO getrennt hervorheben. | DSB | E-146 |
| T-93 | E-146 Weitere Zweifel aus der zweiten Durchsicht: EÜR wird auch für Kapitalgesellschaften erzeugt (HGB-Buchführungspflicht – Hinweis nötig?); Bilanz bei GmbH nur eine Unterschriftszeile (§ 245 HGB alle Geschäftsführer), kein Abgleich Jahresüberschuss ↔ Eigenkapital; Google Fonts extern ohne Hinweis auf USA-Übermittlung; befristeter Arbeitsvertrag mit „gesetzlicher Kündigung“ nennt § 622 BGB (§ 15 Abs. 4 TzBfG verlangt Vereinbarung); „Gutschrift“ (§ 14 Abs. 2 S. 2 UStG, Abrechnung durch den Leistungsempfänger) gegenüber Stornorechnung abgrenzen und ob die E-Rechnung dafür Typ 389 braucht; Kleinunternehmer mit Reverse-Charge-/igL-Hinweis (§ 19, § 13b UStG); Hygieneplan druckt „(Bayern: mind. begrenzt viruzid)“ unabhängig vom Bundesland. | StB/RA/DSB | E-146 |
| T-94 | E-146 HACCP-Bausteine: je Kontrollpunkt einen verbindlichen Grenzwert festlegen – roheihaltige Lebensmittel (+4 °C oder +7 °C), Heißhalten (+60 °C oder +65 °C), Geflügel („−2 bis +4 °C“), lose Ware (+7 °C oder +4 °C je nach Abgabezeitpunkt). Bis dahin stehen beide Werte ohne Quellenkürzel im Plan; die Quellen liegen im Feld `quelle`. | Lebensmittelhygiene/RA | E-146 |
| T-95 | E-146 Dritte Durchsicht, fachlich: Gutschrift druckt Steuernummer/USt-IdNr. und Kleinunternehmer-Hinweis des eigenen Betriebs – bei einer Gutschrift ist der Empfänger der Aussteller (§ 14 Abs. 4 Nr. 2 UStG); Verfahrensdokumentation lässt „E-Rechnungen werden empfangen“ abschalten (Empfangspflicht seit 1.1.2025) und verweist ohne Quelle auf „Muster 4.1–4.3“; Steuererklärungs-Vorlage nennt § 25 EStG und § 31 KStG unabhängig von der Rechtsform; Probezeit 6 Monate bei Befristung ohne Hinweis auf § 15 Abs. 3 TzBfG; Prüfprotokoll „Mängel – nicht verwenden“ druckt den Nutzungsverbot-Hinweis nicht; Handelsregister ohne Rechtsgrundlage (Vorschlag § 8 GmbHG, §§ 12, 29 HGB); Bilanz ohne Anhang (§ 264 HGB); „Art. 88 DSGVO i. V. m. § 26 BDSG“ nach EuGH C-34/21; Datenpanne „kein Risiko“ mit Verweis auf Art. 33 Abs. 5 DSGVO. | StB/RA/DSB/Sifa | E-146 |
| T-96 | E-146 Vierte Durchsicht – fehlende Pflichtfelder nach Fachrecht (nicht eigenmächtig ergänzt): Gewerbeanmeldung ohne „Grund der Anmeldung“, „Art des Betriebs“, Haupt-/Zweigniederlassung (GewA 1); Personalfragebogen ohne Geschlecht (SV-Nummer-Vergabe), Elterneigenschaft/Kinder unter 25 (PV-Zuschlag), „befristet bis“; Datenpanne ohne Zeitpunkt/Zeitraum der Verletzung; Gefahrstoffverzeichnis ohne Ablageort des Sicherheitsdatenblatts (§ 6 Abs. 12 GefStoffV); USt-VA ohne § 13b-Felder (Kz 46/47/67, z. B. Werbung bei Meta/Google); Jahres-USt ohne Zeile Nachzahlung/Erstattung; Prüfprotokoll ohne Messwerte/Schutzklasse; Allergene ohne Sortenangabe bei Getreide/Schalenfrüchten; Handelsregister KG ohne Kommanditisten/Hafteinlage; Aufbewahrung ohne Lohnkonto und Arbeitszeitaufzeichnungen; Betriebsanweisung ohne Platz für GHS-Piktogramme/Signalwort; Kassenmeldung: laufende Nummern sind keine ELSTER-Feldnummern, Anzahl zählt außer Betrieb genommene Kassen mit; Verfahrensdokumentation „Muster 4.1–4.3“ ohne Quelle; Hygieneplan „Wäsche“ 60 °C doppelt (desinfizierendes Verfahren gemeint?); Widerspruchsrecht in „Ihre Rechte“ und als eigener Abschnitt. | RA/StB/DSB/Sifa | E-146 |
| T-97 | E-147 Jahresszenario „Café Morgenrot“ (`apps/mobile/werkzeuge/jahr-szenario.mjs`), steuerlich offen: Storno über den Quartalswechsel – die Voranmeldung zählt die neue Rechnung im Leistungsquartal und den Storno im Storno-Quartal (Q2 doppelt, Q3 gemindert; Jahr stimmt) – Behandlung nach § 17/§ 14c UStG bestätigen; DATEV igL auf 8100 statt 8125 (bekannter Prüfpunkt in `buchungen.ts`); Strom/Gas ohne eigene Kategorie (landen auf Miete/4210), „Fremdleistungen“ → EÜR „Bezogene Leistungen“ für Wartung/Prüfungen fraglich; EÜR-Übernahme ohne gezahlte USt-Vorauszahlungen und AfA (Hinweis ergänzt, nicht berechnet); Zusammenfassende Meldung ohne Vorlage, Voranmeldung ohne Kz 41; Servicepersonal auf Catering-Rechnungen mit 19 %. | StB | E-147 |
| T-98 | E-147 Produktlücke (kein Fehler, bewusst nicht gebaut): Kassenumsätze fehlen in der App vollständig – beim Café rund 160.000 € netto gegenüber 5.000 € aus Rechnungen. Voranmeldung, EÜR und DATEV-Stapel sind für Betriebe mit Registrierkasse ohne manuelle Ergänzung unvollständig. Vor dem Marketing an Gastronomie/Einzelhandel klären: Kassenabschluss (Z-Bon) erfassen oder DSFinV-K-Import. | Produkt/StB | E-147 |
| T-99 | E-148 **Vorrangig:** Widerspruch § 2a SchwarzArbG – die Vorlagen Arbeitszeitnachweis (`lohn.ts`) und Nachweis der Arbeitsbedingungen (`personal.ts`) zählen Friseur- und Kosmetikbetriebe zu den Branchen nach § 2a, der Pflichten-Check (Frage und Auslöser von `personal.sofortmeldung`, `personal.arbeitszeit_milog`) nicht. Eine Seite ist falsch: entweder Vorlagentexte korrigieren oder Option/Auslöser ergänzen. | RA | E-148 |
| T-100 | E-148 Jahresszenario Salon GmbH (`jahr-szenario-salon.mjs`): Azubi unter 18 – Unterweisung halbjährlich (§ 29 JArbSchG), Katalog kennt nur jährlich; DATEV bucht privat bezahlte Belege der GmbH auf Privateinlagen 1890 (Verrechnungskonto Gesellschafter?); Gewerbeanmeldung kennt nur eine Person (zweiter Geschäftsführer); Pflicht „Jahresabschluss“ ohne Vorlage/Termin, Bilanz nur eine Unterschrift (§ 245 HGB); kein Ausbildungsvertrag (§ 11 BBiG); Kosmetikverordnung beim reinen Weiterverkauf; Ersatzrechnung nach Storno mit verrechnetem Guthaben fordert erneut zur Zahlung auf; XRechnung ohne Registereintrag/Rechtsform (BT-30/33, optional); Logfile-Speicherdauer im Verzeichnis fest 30 Tage gegen Eingabe in der Datenschutzerklärung. | RA/StB/Sifa | E-148 |
| T-101 | E-148 Jahresszenario Kleinunternehmerin (`jahr-szenario-freiberuf.mjs`): § 13b für Leistungen aus dem EU-Ausland (z. B. Adobe aus Irland) – auch Kleinunternehmer schulden die Steuer, die App kann das weder erfassen noch in die Voranmeldung bringen (Kz 46/47); Zusammenfassende Meldung wird Kleinunternehmern angezeigt (§ 18a Abs. 4 UStG?); Rechnungen an B2B-EU (NL) und Drittland (CH) drucken „steuerfrei nach § 19“ statt „nicht steuerbar“ bzw. § 14a-Hinweis; Gutschrift als Typ 389 mit vertauschten Rollen; EÜR-Zeile „nicht steuerbare Umsätze“ bleibt leer; Künstlersozialversicherung/-abgabe fehlt im Katalog; KI-Kompetenz ohne Beschäftigte, Rundfunkbeitrag bei Büro in der eigenen Wohnung; Homeoffice-Pauschale ohne Kategorie; AfA bei Kleinunternehmern vom Bruttobetrag (Hinweis?); Leistungszeitraum als Text erzeugt keine XRechnung (BT-73/74). Anrede „Sehr geehrte Damen und Herren“ auch an Privatkunden. | StB/RA | E-148 |
| T-102 | E-149 **Vorrangig (DATEV-Import):** Steuerberaterinnen-Durchsicht der Pakete: Vorsteuer geht auf Aufwandskonten ohne Steuerautomatik verloren (kein BU 9/8; Café ~6.562 €, Salon ~9.111 €), Kleinunternehmer mit BU 40 auf Nicht-Automatikkonten, Sammelkonten 1400/1600 statt 1410/1610 oder Personenkonten, igL 8100 statt 8125, keine Zahlungsbuchungen (Ist-Versteuerung, Bankabgleich), GmbH privat bezahlt auf 1890, Kontenzuordnung je Kategorie (Strom/Gas, Reparaturen, Bahn/ÖPNV, GmbH-Reisekosten, Minijob/Gehalt, GWG/Anlagen), Leistungsdatum/„Datum Zuord. Steuerperiode“ im Stapel, USt-VA in vollen Euro und Kz 41 direkt für igL. Bis zur Klärung: LIESMICH weist den Stapel als ungeprüft aus. | StB | E-149 |
| T-103 | E-149 Nutzer-Durchsicht (Friseurin): Fragen im Pflichten-Check nach Branche filtern (§ 30/§ 33i GewO, Gaststätte bei Friseuren); Friseur = zulassungspflichtiges Handwerk (Handwerksrolle, Meister, RV-Pflicht) direkt ableiten; Lohnpflichten bei Minijob „Minijob-Zentrale“ statt „Krankenkassen“; „Gewerbe oder freier Beruf“ bei eindeutiger Branche überspringen; „Weiß ich nicht“ bei Kasse/Kleinunternehmer/Website, Erklärung was als Kasse zählt; Umsatzfrage bei Gründung im laufenden Jahr („erwartest du“); Reihenfolge abhängiger Lohnschritte (Betriebsnummer → Anmeldung → Beitragsnachweis); Beispiel Arbeitsmedizin je Branche (Feuchtarbeit statt Bildschirm); Hinweis „noch nicht von Fachleuten geprüft“ – Wortlaut und Häufigkeit; Erklärtexte Vorsteuer und Soll/Ist (Vorschläge der Durchsicht liegen vor). | RA/StB | E-149 |
| T-104 | E-150 Typografie-Durchsicht, fachlich: Kleinunternehmer-Hinweis direkt unter der Summe statt nach dem Zahlungsblock; Storno-Gesamtzeile „Gutschriftsbetrag (Storno)“ und Bezug „Rechnung … vom …“ im Infoblock; USt-VA-Werte im Kasten in vollen Euro (Cent klein darunter); Feldnummern der Datenblätter auf amtliche Nummern (GewA 1, DEÜV) abbilden; GHS-Piktogramme in der Betriebsanweisung (TRGS 555); Bilanz: Unterschrift aller Geschäftsführer (§ 245 HGB), GuV-Gliederung nach § 275 HGB; Rechtsgrundlage des Café-Hygieneplans (VO (EG) 852/2004/LMHV statt Landes-Hygieneverordnung); Steuernummer/USt-IdNr. nur im Infoblock oder nur im Fuß. | StB/RA/Sifa | E-150 |
| T-105 | E-150 Strategie-Durchsicht, fachlich vor Marketing: benannte Fachprüfer mit „geprüft am“ statt des pauschalen Hinweises „noch nicht geprüft“; Bußgeldrahmen je Pflicht im Katalog; RDG/StBerG-Abgrenzung des Pflichten-Checks (BGH I ZR 113/20 „Smartlaw“ zu Generatoren); AGB mit B2B-Haftungsbegrenzung und Vermögensschadenhaftpflicht; Backlink „erstellt mit Amtlos“ in Impressum/Datenschutzerklärung wettbewerbsrechtlich prüfen; NIS2 und andere für Kleinstbetriebe fernliegende Pflichten ausblenden. | RA | E-150 |
| T-106 | E-151 Lektorat Vorlagen, inhaltliche Zweifel: (1) `datenschutz.ts:19` bietet noch „Art. 88 DSGVO i. V. m. § 26 BDSG“ an – nach EuGH C-34/21 streichen?; (2) Hygieneplan „mind. begrenzt viruzid“ ist Vorgabe aus Bayern – bundesweit, nur Bayern oder streichen?; (3) HACCP-Grenzwerte mit zwei Behördenwerten – ein Wert je Betrieb nötig; (4) Wareneingang Fleisch +4 °C vs. Lagerung max. +7 °C, „Wild“ fehlt in Lagerliste; (5) „pH-neutral“ vs. „pH-hautneutral“; (6) Stichverletzung „Hausarzt bzw. Durchgangsarzt“ – nach Arbeitsunfall D-Arzt; (7) § 2a SchwarzArbG Friseur/Kosmetik (siehe T-99); (8) Logfile-Frist VVT fest 30 Tage vs. DSE eingegebener Wert; (9) DSE-Bausteine uneinheitlich (YouTube ohne Angemessenheitsbeschluss, Google Fonts ohne § 25 TDDDG/USA); (10) Newsletter-Nachweis „Richtwert 3 Jahre“ vs. „bis zu 3 Jahre“; (11) Pecannuss LMIV-Wortlaut „illinoiesis“ vs. botanisch *illinoinensis*. | RA/Fach | E-151 |
| T-107 | E-151 App-Store: Verschlüsselung nicht von iOS (AES-256-GCM/PBKDF2 über JS-Bibliothek) – Einstufung Exportkontrolle bestätigen (`usesNonExemptEncryption: true` gesetzt); Frankreich: französische Verschlüsselungserklärung (ANSSI) einreichen oder Frankreich bis dahin ausschließen. | RA | E-151 |
| T-108 | E-151 Web-Plattform: Rolle „Mitarbeiter“ liest nach Korrektur keine Finanzen, Personaldaten, Datenpannen und Betroffenenanfragen mehr – Rollenzuschnitt datenschutzrechtlich bestätigen (Art. 5 Abs. 1 lit. c, Art. 32 DSGVO). | DSB | E-151 |
| T-109 | E-151 Szenario Online-Shop: OSS als Pflicht im Katalog (§ 3c, § 18j UStG); Kosmetikverordnung nicht nur über Branche „Beauty“ (CPNP Art. 13, GMP Art. 8, Kennzeichnung Art. 19) und kein IfSG-Hygieneplan für Herstellerinnen; OS-Link-Pflicht (VO (EU) 524/2013 nach Kenntnis zum 20.07.2025 aufgehoben, VO (EU) 2024/3228) – Eintrag streichen oder umkehren; PayPal/Stripe-Gebühren und § 13b; Marktgebühren ohne USt; OSS-Beträge in der Anlage EÜR; Wachszieher Anlage B1 HwO; Minijob-Lohnkonto bei Pauschsteuer (§ 4 Abs. 2 Nr. 8 LStDV); ausfüllbares Kassenbuch und § 146 Abs. 4 AO; ZM-Meldezeitraum und Termin (§ 18a UStG). | StB/RA | E-151 |
| T-110 | E-151 Szenario Physio-Praxis: steuerfreie Heilbehandlungen (§ 4 Nr. 14 UStG) und Kleinunternehmergrenze (§ 19 UStG); Vorsteuer-Aufteilungsschlüssel und Rundung (§ 15 Abs. 4 UStG); Aufsichtsbehörde im Impressum bei Kassenzulassung (§ 5 Abs. 1 Nr. 3 DDG); Rechtsgrundlage Hygieneplan Physiotherapie (§ 23 IfSG, Landesrecht); Patientennamen in Rechnungsliste/DATEV-Buchungstext und § 203 StGB; Kz 48 bei Ist-Versteuerung; § 630f BGB für Physiotherapie; Abfärbung bei Warenverkauf (§ 15 Abs. 3 Nr. 1 EStG); Kz-48-Erkennung nur aus Hinweistext „§ 4 Nr. 8–29“. | StB/RA | E-151 |
| T-111 | E-151 Szenario Elektro: fehlende Katalogpflichten prüfen (Lohnnachweis BG § 99 SGB VII, Installateurverzeichnis § 13 Abs. 2 NAV, Fahrzeugprüfung DGUV V70 § 57, Ausbildungsvertrag/HWK §§ 11, 36 BBiG, Nachuntersuchung § 33 JArbSchG); Elektroinstallation als Baugewerbe (§ 2a SchwarzArbG, SOKA-BAU); PV-Nullsteuersatz in EÜR und XRechnung-Kategorie (E oder Z); DATEV-Konten § 13b und Nullsteuersatz; Auslöser Bauabzugsteuer „Handwerk + Bauleistungen für Unternehmen“; Lohnsteuer-Anmeldezeitraum „keine“ bei Pauschsteuer (§ 40a EStG); Unterweisung wiederholen ohne Ereignis; halbjährliche Unterweisung Jugendlicher als Katalogpflicht; Fälligkeit nach § 193 BGB am Sitz. | StB/RA | E-151 |
| G-15 | Sammelbestätigung „vor dem Start erledigt“: Wortlaut und ob ein Hinweis zu Nachholpflichten nötig ist | RA | E-072 |
| G-22 | Audit der Erstberechnung gebündelt je Berechnungslauf statt je Pflichtinstanz? (Erstberechnung nach großem Release ≈ 35 min für 100.000 auf 2 Kernen) | Tech/Revision | E-109 |
| G-24 | prod-Release erst, wenn jeder deutsche Katalogtext eine geprüfte englische Übersetzung hat (Prüfung im Release-Trigger) | Produkt | E-107 |
| G-23 | Ratenbegrenzung über mehrere API-Instanzen (Ingress oder gemeinsamer Speicher) vor dem Livegang | Tech | E-109 |

## Juristische Grundsatzfragen (blockieren Abschnitte)

| Nr. | Frage | Wer | blockiert |
|---|---|---|---|
| J-1 | ELSTER-Übermittlung über unseren Server mit Nutzerzertifikat noch Selbsthilfe nach StBerG? | RA/StB | 3, 4 |
| J-2 | Behörden-Postfach: Grenze allgemeine Erklärung ↔ Einzelfallprüfung (RDG) | RA | 9 |
| J-3 | Darstellung „nicht zutreffend“ / „trotzdem prüfen lassen“, Haftung | RA | Livegang 2 |
| J-4 | Marktplatz: Vergütungsmodell nach Berufsrecht | RA | 9 |

## Aus dem Katalog (automatisch aus `fachlich_zu_pruefen`)

Erzeugt mit `scripts/pruefliste.py`; 594 Punkte.

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
| K-124 | `datenschutz.dsb_streichung` | F.61 | Vorbereitungs-Checkliste fachlich prüfen |
| K-125 | `datenschutz.dsfa` | F.62 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-126 | `datenschutz.dsfa` | F.62 | Auslöser (Gesundheitsdaten, Video) sind eine Vorauswahl – Liste der Aufsichtsbehörden (Muss-Liste) einbeziehen |
| K-127 | `datenschutz.dsfa` | F.62 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-128 | `datenschutz.informationspflichten` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-129 | `datenschutz.informationspflichten` | F.58 | Pflichtinhalte als Checkliste fachlich ergänzen |
| K-130 | `datenschutz.informationspflichten` | F.58 | Vorlage Datenschutzerklärung (6.4) erst nach Prüfung |
| K-131 | `datenschutz.informationspflichten` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-132 | `datenschutz.loeschkonzept` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-133 | `datenschutz.loeschkonzept` | F.58 | Zusammenspiel mit Aufbewahrungsfristen (C.32, G-21) erläutern |
| K-134 | `datenschutz.loeschkonzept` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-135 | `datenschutz.loeschkonzept` | F.58 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-136 | `datenschutz.tom` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-137 | `datenschutz.tom` | F.58 | Gliederung nach Art. 32 Abs. 1 DSGVO – Wortlaut prüfen |
| K-138 | `datenschutz.tom` | F.58 | Vorschlagsliste typischer Maßnahmen für Kleinbetriebe fachlich erstellen |
| K-139 | `datenschutz.tom` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-140 | `datenschutz.videoueberwachung` | F.62 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-141 | `datenschutz.videoueberwachung` | F.62 | Speicherdauer der Aufnahmen fachlich ergänzen |
| K-142 | `datenschutz.videoueberwachung` | F.62 | Beschäftigte: Mitbestimmung/Information |
| K-143 | `datenschutz.videoueberwachung` | F.62 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-144 | `datenschutz.videoueberwachung` | F.62 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-145 | `datenschutz.vvt` | F.58 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-146 | `datenschutz.vvt` | F.58 | Ausnahme nach Art. 30 Abs. 5 DSGVO (unter 250 Beschäftigte) – wann greift sie? Darstellung prüfen |
| K-147 | `datenschutz.vvt` | F.58 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-148 | `gesellschaft.awv_meldung` | B.21 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-149 | `gesellschaft.awv_meldung` | B.21 | Meldegrenze als Regelwert erfassen (nicht in der Spezifikation) |
| K-150 | `gesellschaft.awv_meldung` | B.21 | Meldefrist ergänzen |
| K-151 | `gesellschaft.awv_meldung` | B.21 | Auch ohne Investoren bei Auslandszahlungen über der Grenze – weiterer Auslöser? |
| K-152 | `gesellschaft.awv_meldung` | B.21 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-153 | `gesellschaft.foerderprogramme` | B.22 | Option, keine Pflicht |
| K-154 | `gesellschaft.foerderprogramme` | B.22 | Matching-Kriterien und Fristen je Programm fachlich hinterlegen |
| K-155 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Frist für die Einreichung ergänzen |
| K-156 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-157 | `gesellschaft.gesellschafterliste_aktualisieren` | B.15 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-158 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-159 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Einzelne Vorschriften (z. B. § 2 GmbHG Form, § 5 Stammkapital, § 7 Einzahlung) zuordnen |
| K-160 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Online-Beurkundung: Voraussetzungen und Grenzen ergänzen |
| K-161 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-162 | `gesellschaft.gesellschaftsvertrag_notar` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-163 | `gesellschaft.gf_pflichten_haftung` | B.17 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-164 | `gesellschaft.gf_pflichten_haftung` | B.17 | Inhalt der Erklärung (welche Pflichten, § 43 GmbHG) fachlich festlegen – Spezifikation nennt nur „Pflichten und Haftung erklären“ |
| K-165 | `gesellschaft.gf_pflichten_haftung` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-166 | `gesellschaft.gf_pflichten_haftung` | B.17 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-167 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-168 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Kriterien (Beteiligung, Sperrminorität) nicht in der Spezifikation – nur als Hinweis auf die Statusfeststellung darstellen |
| K-169 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-170 | `gesellschaft.gf_sozialversicherungsstatus` | B.17 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-171 | `gesellschaft.handelsregister_anmeldung` | B.15 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-172 | `gesellschaft.handelsregister_anmeldung` | B.15 | Einzelvorschriften (§§ 7, 8 GmbHG) zuordnen |
| K-173 | `gesellschaft.handelsregister_anmeldung` | B.15 | Haftung vor Eintragung (Vorgesellschaft) als Hinweis ergänzen? |
| K-174 | `gesellschaft.handelsregister_anmeldung` | B.15 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-175 | `gesellschaft.handelsregister_anmeldung` | B.15 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-176 | `gesellschaft.insolvenzantragspflicht` | B.17 | Fristen nach § 15a InsO als Regelwerte erfassen (Spezifikation: „Fristen aus Regeldaten“, Werte nicht genannt) |
| K-177 | `gesellschaft.insolvenzantragspflicht` | B.17 | Darstellung: allgemeine Information, keine Prüfung des Einzelfalls (RDG) |
| K-178 | `gesellschaft.insolvenzantragspflicht` | B.17 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-179 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-180 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Hinweis laut Spezifikation – sensible Sektoren und Schwellen fachlich ergänzen |
| K-181 | `gesellschaft.investitionspruefung_hinweis` | B.21 | Zuständiges Ministerium (Bezeichnung) aktuell? |
| K-182 | `gesellschaft.jahresabschluss` | B.18 | Fristen für Aufstellung und Feststellung als Regeldaten ergänzen |
| K-183 | `gesellschaft.jahresabschluss` | B.18 | Jährliche Wiederholung abbilden, sobald Fristen feststehen |
| K-184 | `gesellschaft.jahresabschluss` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-185 | `gesellschaft.jahresabschluss` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-186 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-187 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Option, keine Pflicht – Darstellung bestätigen |
| K-188 | `gesellschaft.mitarbeiterbeteiligung` | B.20 | Inhalt der Erklärung zu § 19a EStG und VSOP fachlich festlegen |
| K-189 | `gesellschaft.offenlegung` | B.18 | Frist „binnen 12 Monaten“ als 31.12. des Folgejahres umgesetzt (Kalenderjahr) – bestätigen |
| K-190 | `gesellschaft.offenlegung` | B.18 | Verschiebung bei Fristende am Wochenende/Feiertag festlegen |
| K-191 | `gesellschaft.offenlegung` | B.18 | Kleinstkapitalgesellschaft: Merkmale nicht in der Spezifikation – nur Hinweis auf Hinterlegung |
| K-192 | `gesellschaft.offenlegung` | B.18 | Erstes Rumpfgeschäftsjahr nach Gründung: Periodenbeginn prüfen |
| K-193 | `gesellschaft.offenlegung` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-194 | `gesellschaft.offenlegung` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-195 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Frist: Termin für abweichendes Geschäftsjahr berechnen (Angabe des Geschäftsjahresendes im Profil nötig) |
| K-196 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-197 | `gesellschaft.offenlegung_abweichendes_gj` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-198 | `gesellschaft.stammkapital_einzahlen` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-199 | `gesellschaft.stammkapital_einzahlen` | B.14 | Reihenfolge „vor der Anmeldung“ bestätigen |
| K-200 | `gesellschaft.stammkapital_einzahlen` | B.14 | UG: Volleinzahlung und Bareinlage (Spezifikation nennt nur „ab 1 €“) bestätigen |
| K-201 | `gesellschaft.stammkapital_einzahlen` | B.14 | Höhe der Einzahlung bei GmbH: Anteil je Geschäftsanteil oder insgesamt? |
| K-202 | `gesellschaft.stammkapital_einzahlen` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-203 | `gesellschaft.stammkapital_einzahlen` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-204 | `gesellschaft.transparenzregister` | B.16 | Einzelvorschriften (§§ 19, 20 GwG) zuordnen |
| K-205 | `gesellschaft.transparenzregister` | B.16 | Gilt auch für GmbH & Co. KG und Personengesellschaften – Auslöser erweitern? |
| K-206 | `gesellschaft.transparenzregister` | B.16 | Frist nach Gründung und bei Änderung ergänzen |
| K-207 | `gesellschaft.transparenzregister` | B.16 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-208 | `gesellschaft.transparenzregister` | B.16 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-209 | `gesellschaft.ug_ruecklage` | B.14 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-210 | `gesellschaft.ug_ruecklage` | B.14 | Ende der Rücklagepflicht (Erreichen des GmbH-Stammkapitals) ergänzen |
| K-211 | `gesellschaft.ug_ruecklage` | B.14 | Verlustvortrag bei der Berechnung berücksichtigen? |
| K-212 | `gesellschaft.ug_ruecklage` | B.14 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-213 | `gesellschaft.ug_ruecklage` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-214 | `gruendung.berufsgenossenschaft` | A.8 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen (früherer Text war nicht belegt) |
| K-215 | `gruendung.berufsgenossenschaft` | A.8 | Auslöser 'immer': gilt das für alle Rechtsformen und Freiberufler ohne Beschäftigte? Ausnahmen (z. B. andere Unfallversicherungsträger) erfassen |
| K-216 | `gruendung.berufsgenossenschaft` | A.8 | Fristbeginn: Gründungsdatum vs. Aufnahme der Tätigkeit |
| K-217 | `gruendung.elster_konto` | A.5 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-218 | `gruendung.elster_konto` | A.5 | Vorbereitender Schritt ohne eigene Rechtspflicht – Darstellung bestätigen |
| K-219 | `gruendung.elster_konto` | A.5 | Gilt für alle oder nur ohne Steuerberatung? |
| K-220 | `gruendung.erlaubnis_pruefen` | A.3 | Reisegewerbekarte (§ 55 GewO) als eigene Pflicht führen? |
| K-221 | `gruendung.erlaubnis_pruefen` | A.3 | Gaststättenrecht je Land: Zuständigkeit und Erlaubnisfreiheit einzelner Länder prüfen |
| K-222 | `gruendung.erlaubnis_pruefen` | A.3 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-223 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum im Profil? bestätigen |
| K-224 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Verschiebung bei Fristende am Wochenende/Feiertag festlegen |
| K-225 | `gruendung.fragebogen_steuerliche_erfassung` | A.5 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-226 | `gruendung.gewerbeanzeige` | A.2 | Frist „bei Beginn“: als spätestens am Tag des Beginns umgesetzt – bestätigen |
| K-227 | `gruendung.gewerbeanzeige` | A.2 | Ummeldung und Abmeldung: Fristen ergänzen |
| K-228 | `gruendung.gewerbeanzeige` | A.2 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-229 | `gruendung.gruendungsbeschleunigung_radar` | A.0 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-230 | `gruendung.gruendungsbeschleunigung_radar` | A.0 | Status offen – Radar |
| K-231 | `gruendung.gruendungsbeschleunigung_radar` | A.0 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „niedrig“) |
| K-232 | `gruendung.gruendungsbeschleunigung_radar` | A.0 | Quelle (Vorhaben der Bundesregierung) ergänzen |
| K-233 | `gruendung.gruendungszuschuss` | A.13 | Weitere Förderungen (Spezifikation A.13) als eigene Einträge? |
| K-234 | `gruendung.gruendungszuschuss` | A.13 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-235 | `gruendung.handwerksrolle` | A.4 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-236 | `gruendung.handwerksrolle` | A.4 | Anlage B2 (handwerksähnliche Gewerbe): ebenfalls eintragungspflichtig im Sinne der Spezifikation? Verzeichnis statt Rolle? |
| K-237 | `gruendung.handwerksrolle` | A.4 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-238 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-239 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Information ohne Handlung – als Hinweis darstellen? |
| K-240 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Beitragstermine für den Jahreskalender (I) ergänzen |
| K-241 | `gruendung.ihk_hwk_mitgliedschaft` | A.7 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-242 | `gruendung.krankenversicherung` | A.10 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-243 | `gruendung.krankenversicherung` | A.10 | Für welche Rechtsformen und Rollen (z. B. GmbH-Geschäftsführer) gilt das? |
| K-244 | `gruendung.krankenversicherung` | A.10 | Nebenerwerb: was genau ist zu melden? |
| K-245 | `gruendung.krankenversicherung` | A.10 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-246 | `gruendung.krankenversicherung` | A.10 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-247 | `gruendung.rentenversicherungspflicht` | A.11 | Liste der Gruppen vollständig (§ 2 SGB VI)? |
| K-248 | `gruendung.rentenversicherungspflicht` | A.11 | Fristbeginn: Aufnahme der Tätigkeit = Gründungsdatum? |
| K-249 | `gruendung.rentenversicherungspflicht` | A.11 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-250 | `gruendung.rundfunkbeitrag` | A.9 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-251 | `gruendung.rundfunkbeitrag` | A.9 | Gilt auch für Arbeitsräume in der eigenen Wohnung? |
| K-252 | `gruendung.rundfunkbeitrag` | A.9 | Höhe nach Zahl der Beschäftigten – Staffel als Regelwert? |
| K-253 | `gruendung.rundfunkbeitrag` | A.9 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-254 | `gruendung.rundfunkbeitrag` | A.9 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-255 | `gruendung.statusfeststellung` | A.12 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-256 | `gruendung.statusfeststellung` | A.12 | Option mit Risiko-Check (Spezifikation): Kriterien des Risiko-Checks fachlich festlegen |
| K-257 | `gruendung.statusfeststellung` | A.12 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-258 | `gruendung.taetigkeit_einordnen` | A.1 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-259 | `gruendung.taetigkeit_einordnen` | A.1 | Ist das eine Pflicht oder ein vorbereitender Schritt? Darstellung als Aufgabe bestätigen |
| K-260 | `gruendung.ust_idnr` | A.6 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-261 | `gruendung.ust_idnr` | A.6 | Nur bei B2B-Geschäft oder bei jedem EU-Geschäft? |
| K-262 | `gruendung.ust_idnr` | A.6 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-263 | `gruendung.ust_idnr` | A.6 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-264 | `it_sicherheit.nis2_meldepflichten` | F.64 | Meldestufen und Fristen stehen nicht in der Spezifikation – fachlich ergänzen |
| K-265 | `it_sicherheit.nis2_meldepflichten` | F.64 | Haftung und Schulungspflicht der Geschäftsleitung als eigene Pflicht? |
| K-266 | `it_sicherheit.nis2_meldepflichten` | F.64 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-267 | `it_sicherheit.nis2_pruefen` | F.64 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-268 | `it_sicherheit.nis2_pruefen` | F.64 | Sektoren und Größenschwellen stehen nicht in der Spezifikation – als Betroffenheitscheck fachlich ergänzen |
| K-269 | `it_sicherheit.nis2_pruefen` | F.64 | Vorbereitender Schritt – Darstellung bestätigen |
| K-270 | `it_sicherheit.nis2_pruefen` | F.64 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-271 | `it_sicherheit.nis2_registrierung` | F.64 | Fundstelle im BSIG nach NIS2-Umsetzung prüfen |
| K-272 | `it_sicherheit.nis2_registrierung` | F.64 | „Nachfrist“ – was gilt für Unternehmen, die erst später betroffen werden? |
| K-273 | `it_sicherheit.nis2_registrierung` | F.64 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-274 | `ki.hochrisiko` | F.65 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-275 | `ki.hochrisiko` | F.65 | Status und Daten nach dem Digital Omnibus prüfen |
| K-276 | `ki.hochrisiko` | F.65 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „hoch“) |
| K-277 | `ki.hochrisiko` | F.65 | Welcher der beiden Termine gilt wofür? |
| K-278 | `ki.hochrisiko` | F.65 | Vorbereitungs-Checkliste fachlich prüfen |
| K-279 | `ki.kompetenz` | F.65 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-280 | `ki.kompetenz` | F.65 | Inhalt und Umfang einer ausreichenden Schulung fachlich festlegen |
| K-281 | `ki.kompetenz` | F.65 | Genauer Beginn der Durchsetzung („ab August 2026“) – Datum ergänzen |
| K-282 | `ki.kompetenz` | F.65 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-283 | `ki.transparenz` | F.65 | Welche Fälle des Art. 50 treffen auf Kleinbetriebe zu (Chatbot, Deepfake, generierte Texte)? |
| K-284 | `ki.transparenz` | F.65 | Nach dem 2.12.2026 auf in_kraft umstellen |
| K-285 | `ki.transparenz` | F.65 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-286 | `ki.transparenz` | F.65 | Vorbereitungs-Checkliste fachlich prüfen |
| K-287 | `online.barrierefreiheit` | G.70 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-288 | `online.barrierefreiheit` | G.70 | Bilanzsumme als Alternative zum Umsatz fehlt im Profil |
| K-289 | `online.barrierefreiheit` | G.70 | Zählweise (G-05) |
| K-290 | `online.barrierefreiheit` | G.70 | Welche Dienstleistungen genau (Buchungstools, Bankdienste …) – Liste ergänzen |
| K-291 | `online.barrierefreiheit` | G.70 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-292 | `online.button_loesung` | G.68 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-293 | `online.button_loesung` | G.68 | Zulässige Beschriftungen als Beispiele ergänzen |
| K-294 | `online.button_loesung` | G.68 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-295 | `online.cookie_einwilligung` | F.63 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-296 | `online.cookie_einwilligung` | F.63 | URL des Gesetzes nach Umbenennung (TTDSG → TDDDG) prüfen |
| K-297 | `online.cookie_einwilligung` | F.63 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-298 | `online.dac7` | G.74 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-299 | `online.dac7` | G.74 | Meldeschwellen der Plattformen nicht in der Spezifikation |
| K-300 | `online.dac7` | G.74 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-301 | `online.datenschutzerklaerung` | G.66 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-302 | `online.datenschutzerklaerung` | G.66 | Vorlage erst nach fachlicher Prüfung (6.4) |
| K-303 | `online.datenschutzerklaerung` | G.66 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-304 | `online.datenschutzerklaerung` | G.66 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-305 | `online.impressum` | G.66 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-306 | `online.impressum` | G.66 | Pflichtangaben je Rechtsform als Checkliste fachlich ergänzen |
| K-307 | `online.impressum` | G.66 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-308 | `online.kuendigungsbutton` | G.68 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-309 | `online.kuendigungsbutton` | G.68 | Vorgeschriebene Beschriftung und Ablauf (Bestätigungsseite) fachlich ergänzen |
| K-310 | `online.kuendigungsbutton` | G.68 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-311 | `online.marktplatz_angaben` | G.74 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-312 | `online.marktplatz_angaben` | G.74 | Rechtsgrundlagen ergänzt – prüfen |
| K-313 | `online.marktplatz_angaben` | G.74 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-314 | `online.marktplatz_angaben` | G.74 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-315 | `online.os_link` | G.69 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-316 | `online.os_link` | G.69 | Aktueller Status der OS-Plattform und der Linkpflicht – fachlich prüfen und Text anpassen |
| K-317 | `online.os_link` | G.69 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-318 | `online.os_link` | G.69 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-319 | `online.preisangaben` | G.67 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-320 | `online.preisangaben` | G.67 | Ausnahmen und Einzelheiten (z. B. Grundpreis-Einheiten) fachlich ergänzen |
| K-321 | `online.preisangaben` | G.67 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-322 | `online.vsbg_hinweis` | G.69 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-323 | `online.vsbg_hinweis` | G.69 | Zählweise (G-05) |
| K-324 | `online.vsbg_hinweis` | G.69 | Auslöser „Website oder AGB“ – AGB sind nicht im Profil |
| K-325 | `online.vsbg_hinweis` | G.69 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-326 | `online.widerrufsbelehrung` | G.68 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-327 | `online.widerrufsbelehrung` | G.68 | Muster-Widerrufsbelehrung erst nach Prüfung |
| K-328 | `online.widerrufsbelehrung` | G.68 | Ausnahmen vom Widerrufsrecht als Hinweis |
| K-329 | `online.widerrufsbelehrung` | G.68 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-330 | `online.widerrufsbelehrung` | G.68 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-331 | `online.widerrufsbutton` | G.68 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-332 | `online.widerrufsbutton` | G.68 | Fundstelle im BGB nach Umsetzung ergänzen |
| K-333 | `online.widerrufsbutton` | G.68 | Beschriftung des Buttons fachlich ergänzen |
| K-334 | `online.widerrufsbutton` | G.68 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-335 | `online.widerrufsbutton` | G.68 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-336 | `personal.anmeldezeitraum_angeben` | D.40 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-337 | `personal.anmeldezeitraum_angeben` | D.40 | Vorbereitender Schritt – Darstellung bestätigen |
| K-338 | `personal.anmeldezeitraum_angeben` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-339 | `personal.arbeitszeit_aufzeichnung` | D.42 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-340 | `personal.arbeitszeit_aufzeichnung` | D.42 | Fundstelle der BAG-Entscheidung prüfen |
| K-341 | `personal.arbeitszeit_aufzeichnung` | D.42 | Anforderungen an die Form (bis zur Neuregelung) fachlich formulieren |
| K-342 | `personal.arbeitszeit_aufzeichnung` | D.42 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-343 | `personal.arbeitszeit_aufzeichnung` | D.42 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-344 | `personal.arbeitszeit_milog` | D.42 | Fristen für Aufzeichnung und Aufbewahrung ergänzen |
| K-345 | `personal.arbeitszeit_milog` | D.42 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-346 | `personal.arbeitszeit_neuregelung` | D.42 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-347 | `personal.arbeitszeit_neuregelung` | D.42 | Status offen – Radar |
| K-348 | `personal.arbeitszeit_neuregelung` | D.42 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „mittel“) |
| K-349 | `personal.arbeitszeit_neuregelung` | D.42 | Schwelle 10 als Regelwert führen, sobald beschlossen |
| K-350 | `personal.arbeitszeit_neuregelung` | D.42 | Vorbereitungs-Checkliste fachlich prüfen |
| K-351 | `personal.aushangpflichtige_gesetze` | D.48 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-352 | `personal.aushangpflichtige_gesetze` | D.48 | Liste je Belegschaft (z. B. MuSchG ab wie vielen Frauen?) fachlich festlegen |
| K-353 | `personal.aushangpflichtige_gesetze` | D.48 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-354 | `personal.beitragsnachweis` | D.40 | „Arbeitstage“ als Bankarbeitstage umgesetzt – bestätigen (G-13) |
| K-355 | `personal.beitragsnachweis` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-356 | `personal.beitragsnachweis` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-357 | `personal.betriebsnummer` | D.37 | „vor der ersten Einstellung“ als spätestens am Tag vor Arbeitsbeginn umgesetzt – bestätigen |
| K-358 | `personal.betriebsnummer` | D.37 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-359 | `personal.betriebsnummer` | D.37 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-360 | `personal.entgelttransparenz_bericht` | D.47 | Status offen – Radar |
| K-361 | `personal.entgelttransparenz_bericht` | D.47 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „hoch“, weil EU-Richtlinie) |
| K-362 | `personal.entgelttransparenz_bericht` | D.47 | Zählweise und Inhalt des Berichts nach Umsetzungsgesetz |
| K-363 | `personal.entgelttransparenz_bericht` | D.47 | Vorbereitungs-Checkliste fachlich prüfen |
| K-364 | `personal.hinweisgeber_meldestelle` | D.46 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-365 | `personal.hinweisgeber_meldestelle` | D.46 | Zählweise (G-05) |
| K-366 | `personal.hinweisgeber_meldestelle` | D.46 | Übergangsregeln für 50–249 Beschäftigte noch relevant? |
| K-367 | `personal.hinweisgeber_meldestelle` | D.46 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-368 | `personal.hinweisgeber_meldestelle` | D.46 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-369 | `personal.jugendarbeitsschutz` | D.44 | Erstuntersuchung als eigene Pflicht je Einstellung mit Frist? |
| K-370 | `personal.jugendarbeitsschutz` | D.44 | Arbeitszeitgrenzen als Regelwerte |
| K-371 | `personal.jugendarbeitsschutz` | D.44 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-372 | `personal.jugendarbeitsschutz` | D.44 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-373 | `personal.lohnabrechnung` | D.49 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-374 | `personal.lohnabrechnung` | D.49 | Partner noch nicht gewählt (Abschnitt 5, Integration offen) |
| K-375 | `personal.lohnabrechnung` | D.49 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-376 | `personal.lohnsteuer_anmeldung` | D.40 | Grenzen für den Anmeldezeitraum (nach Vorjahres-Lohnsteuer) stehen nicht in der Spezifikation – deshalb Angabe des Nutzers |
| K-377 | `personal.lohnsteuer_anmeldung` | D.40 | Verschiebung bei Fristende am Wochenende/Feiertag bestätigen |
| K-378 | `personal.lohnsteuer_anmeldung` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-379 | `personal.lohnsteuer_anmeldung` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-380 | `personal.mindestlohn` | D.39 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-381 | `personal.mindestlohn` | D.39 | Ausnahmen (z. B. Azubis, Praktika) als Hinweis ergänzen? |
| K-382 | `personal.mindestlohn` | D.39 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-383 | `personal.mindestlohn` | D.39 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-384 | `personal.minijob_grenze` | D.39 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-385 | `personal.minijob_grenze` | D.39 | Folgen bei Überschreiten (gelegentliches Überschreiten) ergänzen |
| K-386 | `personal.minijob_grenze` | D.39 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-387 | `personal.minijob_grenze` | D.39 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-388 | `personal.mutterschutz_gefaehrdungsbeurteilung` | D.43 | Frist „vor Arbeitsbeginn“ wie E.50 – bestätigen |
| K-389 | `personal.mutterschutz_gefaehrdungsbeurteilung` | D.43 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-390 | `personal.mutterschutz_gefaehrdungsbeurteilung` | D.43 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-391 | `personal.nachweisgesetz` | D.41 | Frist (je Angabe unterschiedlich) steht nicht in der Spezifikation – als spätestens bei Beginn eingetragen, fachlich ersetzen |
| K-392 | `personal.nachweisgesetz` | D.41 | Zulässige Form (Schriftform/elektronisch) aktuell? |
| K-393 | `personal.nachweisgesetz` | D.41 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-394 | `personal.schwangerschaft_mitteilung` | D.43 | Frist („unverzüglich“) steht nicht in der Spezifikation – als am Tag der Mitteilung eingetragen, fachlich ersetzen |
| K-395 | `personal.schwangerschaft_mitteilung` | D.43 | Zuständige Behörde je Land |
| K-396 | `personal.schwangerschaft_mitteilung` | D.43 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-397 | `personal.schwangerschaft_mitteilung` | D.43 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-398 | `personal.schwerbehinderte_anzeige` | D.45 | Quote und Höhe der Abgabe als Regelwerte |
| K-399 | `personal.schwerbehinderte_anzeige` | D.45 | Zählweise der Arbeitsplätze (G-05); wer insgesamt weniger als 20 beschäftigt, gilt als unter der Schwelle – bestätigen |
| K-400 | `personal.schwerbehinderte_anzeige` | D.45 | Verschiebung bei 31.3. am Wochenende |
| K-401 | `personal.schwerbehinderte_anzeige` | D.45 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-402 | `personal.schwerbehinderte_anzeige` | D.45 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-403 | `personal.sofortmeldung` | D.38 | „Bei Arbeitsbeginn“ als spätestens am Tag des Beginns umgesetzt – bestätigen |
| K-404 | `personal.sofortmeldung` | D.38 | Branchenliste vollständig (§ 28a Abs. 4 SGB IV)? |
| K-405 | `personal.sofortmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-406 | `personal.sv_abmeldung` | D.38 | Frist der Abmeldung steht nicht in der Spezifikation – als spätestens am Ende der Beschäftigung eingetragen, fachlich ersetzen |
| K-407 | `personal.sv_abmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-408 | `personal.sv_abmeldung` | D.38 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-409 | `personal.sv_anmeldung` | D.38 | Frist der Anmeldung steht nicht in der Spezifikation – als spätestens bei Beschäftigungsbeginn eingetragen, fachlich ersetzen |
| K-410 | `personal.sv_anmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-411 | `personal.sv_anmeldung` | D.38 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-412 | `personal.sv_beitraege` | D.40 | Minijobs: Fälligkeit bei der Minijob-Zentrale gleich? |
| K-413 | `personal.sv_beitraege` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-414 | `personal.sv_beitraege` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-415 | `personal.sv_jahresmeldung` | D.38 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-416 | `personal.sv_jahresmeldung` | D.38 | Termin der Jahresmeldung als Regeldaten ergänzen (für den Jahreskalender I) |
| K-417 | `personal.sv_jahresmeldung` | D.38 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-418 | `personal.sv_jahresmeldung` | D.38 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-419 | `personal.umlagen_eau` | D.40 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-420 | `personal.umlagen_eau` | D.40 | Welche Umlage gilt für wen (z. B. U1 nach Betriebsgröße) – fachlich ergänzen |
| K-421 | `personal.umlagen_eau` | D.40 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-422 | `personal.umlagen_eau` | D.40 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-423 | `produkte.barrierefreiheit` | G.70 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-424 | `produkte.barrierefreiheit` | G.70 | Produktliste (§ 1 BFSG) als Auswahl ergänzen |
| K-425 | `produkte.barrierefreiheit` | G.70 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-426 | `produkte.batterien` | G.72 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-427 | `produkte.batterien` | G.72 | Zuständige Stelle und Registrierungsweg ergänzen |
| K-428 | `produkte.batterien` | G.72 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-429 | `produkte.elektrogeraete` | G.72 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-430 | `produkte.elektrogeraete` | G.72 | Wer gilt als Hersteller (Import, Eigenmarke)? |
| K-431 | `produkte.elektrogeraete` | G.72 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-432 | `produkte.geldwaesche_gueterhaendler` | G.75 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-433 | `produkte.geldwaesche_gueterhaendler` | G.75 | Schwelle für Barzahlungen nicht in der Spezifikation – als Regelwert ergänzen |
| K-434 | `produkte.geldwaesche_gueterhaendler` | G.75 | Immobilien- und Finanzbranche als Branchenmodul (H) |
| K-435 | `produkte.geldwaesche_gueterhaendler` | G.75 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-436 | `produkte.gpsr` | G.73 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-437 | `produkte.gpsr` | G.73 | Pflichten für Händler vs. Hersteller trennen |
| K-438 | `produkte.gpsr` | G.73 | Lebensmittel und Kosmetik haben eigene Regeln – Abgrenzung |
| K-439 | `produkte.gpsr` | G.73 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-440 | `produkte.verpackung` | G.71 | „Vor dem ersten Inverkehrbringen“ als Frist mit Ereignis abbilden? |
| K-441 | `produkte.verpackung` | G.71 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-442 | `steuern.aufbewahrung` | C.32 | Fristbeginn (Ende des Kalenderjahres) und Aufbewahrungsdauern als Regelwerte führen |
| K-443 | `steuern.aufbewahrung` | C.32 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-444 | `steuern.aufbewahrung` | C.32 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-445 | `steuern.bauabzugsteuer_freistellung` | C.35 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-446 | `steuern.bauabzugsteuer_freistellung` | C.35 | Auch Handwerksbetriebe mit Bauleistungen erfassen (Branche handwerk)? |
| K-447 | `steuern.bauabzugsteuer_freistellung` | C.35 | Gültigkeitsdauer der Bescheinigung und Erneuerung ergänzen |
| K-448 | `steuern.bauabzugsteuer_freistellung` | C.35 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-449 | `steuern.buchfuehrungspflicht` | C.28 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-450 | `steuern.buchfuehrungspflicht` | C.28 | e.K. und GmbH & Co. KG als HGB-buchführungspflichtig angenommen – bestätigen |
| K-451 | `steuern.buchfuehrungspflicht` | C.28 | Im Gründungsjahr und vor dem Start gibt es keine Vorjahreswerte – § 141-Grenzen dann als nicht überschritten behandelt |
| K-452 | `steuern.buchfuehrungspflicht` | C.28 | § 141 AO: Pflicht beginnt erst nach Mitteilung des Finanzamts – berücksichtigen |
| K-453 | `steuern.buchfuehrungspflicht` | C.28 | Grenze inklusive/exklusive |
| K-454 | `steuern.buchfuehrungspflicht` | C.28 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-455 | `steuern.e_bilanz` | B.18 | Frist (gekoppelt an die Steuererklärung) als Regeldaten ergänzen |
| K-456 | `steuern.e_bilanz` | B.18 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-457 | `steuern.e_bilanz` | B.18 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-458 | `steuern.e_rechnung_empfang` | C.30 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-459 | `steuern.e_rechnung_empfang` | C.30 | Gilt für alle Unternehmen, auch Kleinunternehmer – bestätigen |
| K-460 | `steuern.e_rechnung_empfang` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-461 | `steuern.e_rechnung_versand_2027` | C.30 | Maßgeblich ist der Umsatz 2026: bis 2026 wird auch die Prognose herangezogen – bestätigen |
| K-462 | `steuern.e_rechnung_versand_2027` | C.30 | Rechtsstatus und gueltig_ab festlegen |
| K-463 | `steuern.e_rechnung_versand_2027` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-464 | `steuern.e_rechnung_versand_2028` | C.30 | Rechtsstatus und gueltig_ab festlegen |
| K-465 | `steuern.e_rechnung_versand_2028` | C.30 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-466 | `steuern.est_erklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-467 | `steuern.est_erklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-468 | `steuern.est_erklaerung` | C.27 | Personengesellschaften: Feststellungserklärung der Gesellschaft zusätzlich? |
| K-469 | `steuern.est_erklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-470 | `steuern.est_erklaerung` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-471 | `steuern.euer` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-472 | `steuern.euer` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-473 | `steuern.euer` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-474 | `steuern.euer` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-475 | `steuern.gewst_erklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-476 | `steuern.gewst_erklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-477 | `steuern.gewst_erklaerung` | C.27 | Freibetrag (C.34) als Regelwert führen |
| K-478 | `steuern.gewst_erklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-479 | `steuern.gewst_erklaerung` | C.27 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-480 | `steuern.gobd_verfahrensdokumentation` | C.31 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-481 | `steuern.gobd_verfahrensdokumentation` | C.31 | Fundstelle des aktuellen GoBD-Schreibens ergänzen |
| K-482 | `steuern.gobd_verfahrensdokumentation` | C.31 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-483 | `steuern.gobd_verfahrensdokumentation` | C.31 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-484 | `steuern.kasse_tse_belegausgabe` | C.33 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-485 | `steuern.kasse_tse_belegausgabe` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-486 | `steuern.kassenmeldung` | C.33 | Bestandskassen (Meldefrist 31.7.2025): Pflicht für Kassen ohne gemeldetes Anschaffungsdatum abbilden |
| K-487 | `steuern.kassenmeldung` | C.33 | Verschiebung bei Fristende am Wochenende festlegen |
| K-488 | `steuern.kassenmeldung` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-489 | `steuern.kassenmeldung_ausserbetriebnahme` | C.33 | Mehrere Kassen: je Ereignis eine Meldung (derzeit Bezug auf die erste Außerbetriebnahme) |
| K-490 | `steuern.kassenmeldung_ausserbetriebnahme` | C.33 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-491 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-492 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Vor dem Start gibt es keinen Vorjahresumsatz – Vorjahresgrenze dann nicht geprüft |
| K-493 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Prognose statt tatsächlicher Umsatz: bis Abschnitt 4 nur Profilangaben – Formulierung „nach deinen Angaben“ bestätigen |
| K-494 | `steuern.kleinunternehmer_grenze_ueberschritten` | C.23 | Grenze inklusive/exklusive (K-18) |
| K-495 | `steuern.kleinunternehmer_warnung_80` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-496 | `steuern.kleinunternehmer_warnung_80` | C.23 | Umsatzbegriff für die Grenze (G-06): Summe der gestellten Rechnungen (netto, abzüglich Stornos) im Kalenderjahr nach Rechnungsdatum – bestätigen |
| K-497 | `steuern.kleinunternehmer_warnung_80` | C.23 | Warnstufen 80 % und 95 % aus der Spezifikation |
| K-498 | `steuern.kleinunternehmer_warnung_95` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-499 | `steuern.kleinunternehmer_warnung_95` | C.23 | Umsatzbegriff für die Grenze (G-06): Summe der gestellten Rechnungen (netto, abzüglich Stornos) im Kalenderjahr nach Rechnungsdatum – bestätigen |
| K-500 | `steuern.kleinunternehmer_warnung_95` | C.23 | Warnstufen 80 % und 95 % aus der Spezifikation |
| K-501 | `steuern.kleinunternehmerregelung` | C.23 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-502 | `steuern.kleinunternehmerregelung` | C.23 | Echtzeit-Warnungen bei 80 % und 95 % (Spezifikation C.23) folgen in Abschnitt 4 mit Finanzdaten |
| K-503 | `steuern.kst_erklaerung` | B.19 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-504 | `steuern.kst_erklaerung` | B.19 | Abgabefristen mit und ohne Steuerberatung als Regeldaten (wie G-18) |
| K-505 | `steuern.kst_erklaerung` | B.19 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-506 | `steuern.kst_erklaerung` | B.19 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-507 | `steuern.rechnungen_pflichtangaben` | C.29 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-508 | `steuern.rechnungen_pflichtangaben` | C.29 | Liste der Pflichtangaben und Kleinbetragsgrenze als Inhalt ergänzen |
| K-509 | `steuern.rechnungen_pflichtangaben` | C.29 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-510 | `steuern.ust_jahreserklaerung` | C.27 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-511 | `steuern.ust_jahreserklaerung` | C.27 | Abgabefristen (mit und ohne Steuerberatung) fehlen in der Spezifikation – als jährliche Regeldaten ergänzen (Jahreskalender I) |
| K-512 | `steuern.ust_jahreserklaerung` | C.27 | Kleinunternehmer: Erklärungspflicht prüfen |
| K-513 | `steuern.ust_jahreserklaerung` | C.27 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-514 | `steuern.ust_sondervorauszahlung` | C.24 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-515 | `steuern.ust_sondervorauszahlung` | C.24 | Fälligkeitstermin und Bemessungsgrundlage der Sondervorauszahlung ergänzen (K-08) |
| K-516 | `steuern.ust_sondervorauszahlung` | C.24 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-517 | `steuern.ust_va_neugruender_radar` | C.21 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-518 | `steuern.ust_va_neugruender_radar` | C.21 | Status offen – Radar |
| K-519 | `steuern.ust_va_neugruender_radar` | C.21 | Wahrscheinlichkeit steht nicht in der Spezifikation (Platzhalter „mittel“) |
| K-520 | `steuern.ust_va_neugruender_radar` | C.21 | Vorbereitungs-Checkliste fachlich prüfen |
| K-521 | `steuern.ust_voranmeldung` | C.24 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen (früherer Text war nicht belegt) |
| K-522 | `steuern.ust_voranmeldung` | C.24 | Befreiung bis Grenze ist laut Spezifikation 'möglich' (Ermessen Finanzamt?) – Auslöser bildet das als 'gilt nicht' ab; Formulierung prüfen |
| K-523 | `steuern.ust_voranmeldung` | C.24 | Neugründer: Aussetzung der monatlichen Pflicht 2021–2026 (Radar) – Rhythmus im Gründungs- und Folgejahr festlegen |
| K-524 | `steuern.ust_voranmeldung` | C.24 | Sondervorauszahlung 1/11 bei monatlicher Dauerfristverlängerung als eigene Pflicht anlegen |
| K-525 | `steuern.ust_voranmeldung` | C.24 | Verschiebung auf nächsten Werktag und Feiertagskalender (Bundesland) bestätigen |
| K-526 | `steuern.ust_voranmeldung` | C.24 | gueltig_ab: Datum der heutigen Fassung der Grenzen eintragen |
| K-527 | `steuern.vorauszahlung_est_kst` | C.26 | Verschiebung auf den nächsten Werktag bei Zahlungsterminen bestätigen |
| K-528 | `steuern.vorauszahlung_est_kst` | C.26 | Schonfrist bei Überweisung erwähnen? |
| K-529 | `steuern.vorauszahlung_est_kst` | C.26 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-530 | `steuern.vorauszahlung_est_kst` | C.26 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-531 | `steuern.vorauszahlung_gewst` | C.26 | Verschiebung und Kalender (Gemeinde) bestätigen |
| K-532 | `steuern.vorauszahlung_gewst` | C.26 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-533 | `steuern.vorauszahlung_gewst` | C.26 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-534 | `steuern.zusammenfassende_meldung` | C.25 | Frist nicht in der Spezifikation genannt – Frist und Verschiebung fachlich ergänzen |
| K-535 | `steuern.zusammenfassende_meldung` | C.25 | Meldezeitraum und Abgabefrist ergänzen |
| K-536 | `steuern.zusammenfassende_meldung` | C.25 | Kleinunternehmer ausgenommen? |
| K-537 | `steuern.zusammenfassende_meldung` | C.25 | Folgen bei Nichterfüllung nicht in der Spezifikation genannt – Sanktion fachlich ergänzen |
| K-538 | `steuern.zusammenfassende_meldung` | C.25 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-539 | `datenschutz.dsb.schwelle_personen@1` | F.61 | gueltig_ab ist Platzhalter |
| K-540 | `datenschutz.dsb.schwelle_personen@1` | F.61 | Geplante Streichung bis Ende 2026 (Radar F.61) – gueltig_bis setzen, sobald beschlossen |
| K-541 | `gesellschaft.gmbh.stammkapital_mindest@1` | B.14 | gueltig_ab ist Platzhalter |
| K-542 | `gesellschaft.gmbh.stammkapital_mindest@1` | B.14 | Rechtsgrundlage ergänzt, steht nicht in der Spezifikation |
| K-543 | `gesellschaft.gmbh.mindesteinzahlung_anteil@1` | B.14 | Spezifikation: „mindestens Hälfte einzuzahlen“ – Bezug (Mindeststammkapital oder Summe der Anteile) und Einzahlung je Geschäftsanteil prüfen |
| K-544 | `gesellschaft.gmbh.mindesteinzahlung_anteil@1` | B.14 | Rechtsgrundlage ergänzt |
| K-545 | `gesellschaft.ug.stammkapital_mindest@1` | B.14 | gueltig_ab ist Platzhalter |
| K-546 | `gesellschaft.ug.stammkapital_mindest@1` | B.14 | Rechtsgrundlage ergänzt |
| K-547 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | gueltig_ab ist Platzhalter |
| K-548 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | Rechtsgrundlage ergänzt |
| K-549 | `gesellschaft.ug.ruecklage_anteil@1` | B.14 | Berechnungsbasis (Jahresüberschuss abzüglich Verlustvortrag) prüfen |
| K-550 | `online.vsbg.schwelle_beschaeftigte@1` | G.69 | gueltig_ab ist Platzhalter |
| K-551 | `online.vsbg.schwelle_beschaeftigte@1` | G.69 | „mehr als 10“: Vergleich > 10 in den Regeln |
| K-552 | `online.bfsg.kleinst_beschaeftigte@1` | G.70 | Rechtsgrundlage ergänzt |
| K-553 | `online.bfsg.kleinst_umsatz@1` | G.70 | Alternative Bilanzsumme fehlt im Profil |
| K-554 | `online.bfsg.kleinst_umsatz@1` | G.70 | Rechtsgrundlage ergänzt |
| K-555 | `personal.mindestlohn.stunde@1` | D.39 | Rechtsgrundlage (aktuelle Anpassungsverordnung) ergänzen |
| K-556 | `personal.mindestlohn.stunde@2` | D.39 | Status „beschlossen“ – Verordnung prüfen |
| K-557 | `personal.minijob.grenze_monat@1` | D.39 | Rechtsgrundlage ergänzt |
| K-558 | `personal.minijob.grenze_monat@2` | D.39 | Dynamische Kopplung an den Mindestlohn – Wert für 2027 bestätigen |
| K-559 | `personal.schwerbehinderte.schwelle_arbeitsplaetze@1` | D.45 | gueltig_ab ist Platzhalter |
| K-560 | `personal.schwerbehinderte.schwelle_arbeitsplaetze@1` | D.45 | Rechtsgrundlage ergänzt |
| K-561 | `personal.hinschg.schwelle@1` | D.46 | gueltig_ab ist Platzhalter |
| K-562 | `personal.hinschg.schwelle@1` | D.46 | Rechtsgrundlage ergänzt |
| K-563 | `personal.entgelttransparenz.berichtspflicht_schwelle@1` | D.47 | Spezifikation: „über 150 Beschäftigte“ – Vergleich > umgesetzt |
| K-564 | `personal.entgelttransparenz.berichtspflicht_schwelle@1` | D.47 | Deutsches Umsetzungsgesetz abwarten |
| K-565 | `arbeitsschutz.ersthelfer.schwelle_versicherte@1` | E.53 | gueltig_ab ist Platzhalter |
| K-566 | `arbeitsschutz.ersthelfer.schwelle_versicherte@1` | E.53 | Rechtsgrundlage ergänzt |
| K-567 | `arbeitsschutz.ersthelfer.schwelle_versicherte@1` | E.53 | Versicherte vs. Beschäftigte |
| K-568 | `steuern.ust_va.grenze_befreiung@1` | C.24 | gueltig_ab ist Platzhalter (Beginn Betrachtungszeitraum), tatsächliches Inkrafttreten der Grenze eintragen |
| K-569 | `steuern.ust_va.grenze_monatlich@1` | C.24 | gueltig_ab ist Platzhalter |
| K-570 | `steuern.ust_va.grenze_monatlich@1` | C.24 | Spezifikation: 'über 9.000 € monatlich' – Vergleich '>' bestätigen |
| K-571 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-572 | `steuern.ustg19.grenze_vorjahr@1` | C.23 | Grenze inklusive oder exklusive ('max. 25.000 €')? |
| K-573 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-574 | `steuern.ustg19.grenze_laufendes_jahr@1` | C.23 | Gründungsjahr: abweichende Grenze 25.000 € als eigener Regelwert |
| K-575 | `steuern.ustg19.grenze_gruendungsjahr@1` | C.23 | gueltig_ab ist Platzhalter |
| K-576 | `steuern.ustg19.grenze_gruendungsjahr@1` | C.23 | Grenze inklusive oder exklusive? |
| K-577 | `steuern.ao141.grenze_umsatz@1` | C.28 | gueltig_ab ist Platzhalter |
| K-578 | `steuern.ao141.grenze_umsatz@1` | C.28 | Bezugsjahr und Vergleich (> oder ≥) bestätigen |
| K-579 | `steuern.ao141.grenze_gewinn@1` | C.28 | gueltig_ab ist Platzhalter |
| K-580 | `steuern.ao141.grenze_gewinn@1` | C.28 | Bezugsjahr und Vergleich (> oder ≥) bestätigen |
| K-581 | `steuern.e_rechnung.grenze_vorjahresumsatz_2027@1` | C.30 | Übergangsregel-Fundstelle (§ 27 Abs. 38 UStG) ergänzt, nicht aus Spezifikation |
| K-582 | `steuern.e_rechnung.grenze_vorjahresumsatz_2027@1` | C.30 | gueltig_ab/gueltig_bis als Übergangszeitraum bestätigen |
| K-583 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-584 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-585 | `steuern.aufbewahrung.belege_jahre@1` | C.32 | Fristbeginn (Ende des Kalenderjahres) als Regel ergänzen |
| K-586 | `steuern.aufbewahrung.buecher_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-587 | `steuern.aufbewahrung.buecher_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-588 | `steuern.aufbewahrung.geschaeftsbriefe_jahre@1` | C.32 | gueltig_ab ist Platzhalter |
| K-589 | `steuern.aufbewahrung.geschaeftsbriefe_jahre@1` | C.32 | Rechtsgrundlagen ergänzt |
| K-590 | `steuern.ust.satz_regel@1` |  | [FACHLICH ZU PRÜFEN] Steuersatz steht nicht in der Spezifikation – vor Freigabe gegen das Gesetz prüfen |
| K-591 | `steuern.ust.satz_regel@1` |  | gueltig_ab ist Platzhalter |
| K-592 | `steuern.ust.satz_ermaessigt@1` |  | [FACHLICH ZU PRÜFEN] Steuersatz steht nicht in der Spezifikation – vor Freigabe gegen das Gesetz prüfen |
| K-593 | `steuern.ust.satz_ermaessigt@1` |  | Welche Leistungen ermäßigt sind, entscheidet der Nutzer – Hinweis/Hilfe fachlich formulieren |
| K-594 | `steuern.ust.satz_ermaessigt@1` |  | gueltig_ab ist Platzhalter |
