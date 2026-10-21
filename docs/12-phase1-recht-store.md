# 12 · Phase 1: Recht und App-Store-Pflicht – was du tun musst

Stand: 2026-10-21 (E-156). Alles, was der Code vorbereiten kann, ist vorbereitet. Was hier steht, kannst nur du erledigen: als Gründer, mit deiner Firma, deinem Apple-Konto, einem Anwalt oder einer Versicherung. `node apps/mobile/werkzeuge/store-check.mjs` zeigt jederzeit, was noch fehlt.

Reihenfolge: 1 → 2 → 3. Die Firma braucht man für das Apple-Konto, das Apple-Konto für den Store-Eintrag, beides für Impressum und Datenschutzerklärung.

## 1. Firma und Anbieterangaben

### 1.1 Rechtsform entscheiden

| | Einzelunternehmen | UG (haftungsbeschränkt) | GmbH |
|---|---|---|---|
| Haftung | persönlich, mit dem ganzen Privatvermögen | auf das Gesellschaftsvermögen beschränkt (Ausnahmen: Geschäftsführerhaftung, § 43 GmbHG, § 15b InsO) | wie UG |
| Kapital | keins | ab 1 €; ein Viertel des Jahresüberschusses in die Rücklage, bis 25.000 € erreicht sind (§ 5a Abs. 3 GmbHG) | 25.000 €, davon mindestens 12.500 € bei Anmeldung eingezahlt (§§ 5, 7 Abs. 2 GmbHG) |
| Gründung | Gewerbeanmeldung | Notar (Musterprotokoll möglich), Handelsregister, Transparenzregister (§ 20 GwG) | wie UG |
| Apple-Konto | **nur als Einzelperson** – im App Store steht dein Name als Verkäufer | als Organisation, Firma steht als Verkäufer | wie UG |
| Laufend | EÜR | Bilanz, Offenlegung (§ 325 HGB), Körperschaft- und Gewerbesteuer | wie UG |

Apple sagt dazu wörtlich: „If you are a sole proprietor/single-person business, you must join as an individual and your legal name will appear as the seller“ und „We don’t accept DBAs, fictitious businesses, trade names, or branches.“ ([Apple Account Help](https://developer.apple.com/support/enrollment/)).

**Empfehlung zum Abwägen (keine Rechts- oder Steuerberatung):** Betriebsklar verkauft Vorlagen und Hinweise zu Rechtspflichten. Wer die Haftung für Fehler begrenzen will, gründet eine UG oder GmbH. Lass die Wahl von einem Steuerberater durchrechnen.

### 1.2 Anmelden

1. **UG/GmbH:** Notartermin, Geschäftskonto, Stammkapital einzahlen, Eintragung abwarten. Danach Transparenzregister.
2. **Gewerbe anmelden** beim Gewerbeamt deines Sitzes (§ 14 GewO). IHK-Mitgliedschaft folgt automatisch.
3. **Finanzamt:** „Fragebogen zur steuerlichen Erfassung“ über ELSTER (innerhalb eines Monats, § 138 AO). Dabei USt-IdNr. beantragen – die gehört ins Impressum, wenn vorhanden.

### 1.3 Apple-Konto als Organisation

1. **D-U-N-S-Nummer** prüfen oder kostenlos beantragen (über den Link auf [Apple Account Help](https://developer.apple.com/support/enrollment/)). Name und Anschrift müssen genau wie im Handelsregister stehen. Dauert einige Tage.
2. **Apple Developer Program** als Organisation beitreten (Apple ruft zur Prüfung an). Besteht schon ein Konto als Privatperson: bei Apple die Umstellung auf eine Organisation beantragen.
3. **Small Business Program** beantragen (15 % statt 30 % Provision).
4. **Verträge, Steuern, Bankverbindung** in App Store Connect ausfüllen („Paid Apps Agreement“) – sonst lassen sich keine Abos verkaufen.
5. Danach eintragen: `apps/mobile/eas.json` → `ascAppId`, `appleTeamId`.

### 1.4 Anbieterangaben in den Code

Schick mir die Angaben – oder trag sie selbst ein in `apps/mobile/src/rechtliches.ts` → `ANBIETER`:

- Firma mit Rechtsform, ladungsfähige Anschrift (kein Postfach), vertretungsberechtigte Person(en), E-Mail
- Telefon (empfohlen: § 5 DDG verlangt eine schnelle elektronische Kontaktaufnahme), Register und Registernummer, USt-IdNr.

App, Website-Impressum, Datenschutzerklärung und Support-Seite nehmen alle diese eine Quelle.

### 1.5 Website online stellen

1. Domain sichern (vorläufig betriebsklar.de, siehe docs/14-marke.md – amtlos.de ist vergeben; vorher Markenrecherche bei DPMA/EUIPO).
2. Hoster für statische Seiten wählen, mit Server in der EU und Auftragsverarbeitungsvertrag (Art. 28 DSGVO).
3. Mir Domain und Hoster nennen: Ich trage `seite.json → url` und `LINKS` (website, datenschutz, support) ein und ergänze in der Datenschutzerklärung den Abschnitt „Diese Website“ (Server-Protokolle beim Hoster).
4. `node apps/website/bauen.mjs` und den Ordner `apps/website/dist` hochladen. Der Build bricht ab, solange etwas fehlt.

## 2. Datenschutz

1. **Datenschutzhinweis prüfen lassen** (Anwalt Datenschutzrecht): Text in `apps/mobile/src/rechtliches.ts` → `DATENSCHUTZ`. Die Garantie für die USA-Übermittlung und die Speicherdauer bei RevenueCat sind jetzt aus dem Auftragsverarbeitungsvertrag von RevenueCat eingetragen (siehe unten). Nach der Freigabe setze ich `freigegeben: true`.
2. **RevenueCat:** im Dashboard den Data Processing Addendum annehmen ([revenuecat.com/dpa](https://www.revenuecat.com/dpa)). Stand August 2026: Standardvertragsklauseln Modul 2 (Durchführungsbeschluss (EU) 2021/914), Daten bis Vertragsende; Rückgabe oder Löschung nach Vertragsende, wenn wir sie innerhalb von 30 Tagen nach Vertragsende verlangen, Backups nach RevenueCats Sicherungsroutinen (ohne Frist). Unterauftragnehmer in den USA, u. a. AWS, Google, Snowflake. Einzelne Kunden lassen sich über die API endgültig löschen (`DELETE /v1/subscribers/{app_user_id}`, läuft asynchron). Das EU-U.S. Data Privacy Framework nennen weder DPA noch Datenschutzerklärung von RevenueCat – im Datenschutzhinweis steht es deshalb nicht (Stand 21.10.2026).
3. **App Store Connect → App-Datenschutz:** genau wie im Privacy Manifest (`apps/mobile/app.json`) – siehe Abschnitt 2.1.
4. **Verschlüsselung (Exportkontrolle):** siehe Abschnitt 2.2.
5. **Vorprüfung vom 21.10.2026 (Abschnitt 8) umgesetzt:** Verantwortlicher mit Vertretung aus `ANBIETER` (App und Website), SCC mit Fundstelle und DPA-Adresse, zuständige Aufsichtsbehörde (Sitz Reutlingen → LfDI Baden-Württemberg, Lautenschlagerstraße 20, 70173 Stuttgart), Speicherdauer bei RevenueCat ohne erfundene Frist, Push nur lokal. `freigegeben` bleibt `false` bis zur anwaltlichen Freigabe.
6. **AVV für die Synchronisation anbieten** (vor dem ersten Build mit Sync): Nach der Vorprüfung (Frage 9, EuGH C-413/23 P) sind Metadaten (Dateinamen, Größen, Zeitpunkte) und Konto-Daten für uns personenbezogen, auch wenn die Inhalte Ende-zu-Ende-verschlüsselt sind. Dem Betrieb einen Auftragsverarbeitungsvertrag (Art. 28 DSGVO) für Kunden- und Mitarbeiterdaten anbieten, Hoster und Anmeldedienst als Unterauftragsverarbeiter nennen. Im Sync-Zusatz des Datenschutzhinweises stehen Hoster, Anmeldedienst und die Aufbewahrung der Server-Backups noch als Platzhalter – der Store-Check meldet sie für Builds mit Server.

**Kandidaten für die PRUEFLISTE** (aus der Vorprüfung, noch nicht eingetragen):

| Punkt | Wer |
|---|---|
| Frist nach Abo-Ende festlegen, nach der die Kaufdaten bei RevenueCat gelöscht werden (Produktentscheidung + Löschung über die RevenueCat-API), dann in „Speicherdauer“ nennen | Gründer, RA |
| AVV für die Synchronisation anbieten (Betrieb als Verantwortlicher, Hoster und Anmeldedienst als Unterauftragsverarbeiter) – vor dem Sync-Build | RA, DSB |
| Aufbewahrung der Server-Backups im Sync-Zusatz eintragen (Platzhalter) | Gründer |
| DPF-Teilnahme von RevenueCat auf dataprivacyframework.gov prüfen; falls gelistet, Art. 45 DSGVO als primäre Grundlage nennen (T-112) | Gründer |
| Haftungshöchstbetrag gegenüber Unternehmern: Festbetrag (z. B. 5.000 €) ja/nein (Nutzungsbedingungen Ziffer 8.2) | Gründer, RA |

### 2.1 App-Datenschutz in App Store Connect

Für den Build **ohne** Synchronisation (Standard):

| Frage | Antwort |
|---|---|
| Sammelst du Daten? | Ja |
| Datentyp | **Käufe → Kaufhistorie** |
| Verwendung | App-Funktionalität; Analysen (RevenueCat wertet Käufe für die Abo-Verwaltung aus) |
| Mit der Identität verknüpft? | Ja |
| Für Tracking verwendet? | Nein |
| Alle anderen Datentypen | nicht gesammelt (Unterlagen, Kunden, Mitarbeiter bleiben auf dem Gerät) |

Für einen Build **mit** Synchronisation zusätzlich: Kontaktdaten → E-Mail-Adresse und Name, Kennungen → Benutzer-ID, jeweils App-Funktionalität, verknüpft, kein Tracking (`app.config.ts`).

### 2.2 Verschlüsselung (Export-Compliance)

Betriebsklar verschlüsselt Daten auf dem Gerät und in Sicherungen mit AES-256 aus der Bibliothek `@noble/ciphers` – ein Standardverfahren, aber **nicht** das des Apple-Betriebssystems. Deshalb steht in `app.json` `usesNonExemptEncryption: true`.

Antworten in App Store Connect nach Apples Tabelle ([Export compliance documentation](https://developer.apple.com/help/app-store-connect/reference/export-compliance-documentation-for-encryption)):

1. „Verwendet die App Verschlüsselung?“ → **Ja**.
2. Art → **„Standardalgorithmus, nicht im Apple-Betriebssystem enthalten“**.
3. Folge laut Apple: **französische Verschlüsselungserklärung** hochladen – „only required if you're distributing your app on the App Store in France“. Frankreich kontrolliert u. a. „Secure Storage“-Apps (ANSSI).
4. **USA:** Ob eine jährliche Selbstauskunft beim BIS (Self-Classification Report) nötig ist oder eine Ausnahme greift (z. B. weil Verschlüsselung nicht die Hauptfunktion ist), sagt Apple nicht. Das klärt ein Exportkontroll-Berater (PRUEFLISTE T-122).

**Zwei Wege zur Wahl:** (a) Frankreich vom Vertrieb ausnehmen, bis die Erklärung abgegeben ist, oder (b) die Erklärung bei der ANSSI einreichen. Für den deutschen Markt ändert das nichts.

## 3. Haftung für Vorlagen und Pflichten

1. **Anwaltliche Prüfung** (Arbeitsrecht und Datenschutz): die Prüfmappe liegt in `docs/pruefmappe-anwalt/` (Vorlagen als PDF, Katalog als Liste, Fragenkatalog inklusive RDG). Die kritischen Vorlagen vollständig, den Rest stichprobenartig.
2. **Nutzungsbedingungen:** „Fassung zur Freigabe“ in `docs/nutzungsbedingungen-entwurf.md` (Vorprüfung vom 21.10.2026, Abschnitt 9, eingearbeitet). Erst nach anwaltlicher Freigabe gilt sie: dann `NUTZUNGSBEDINGUNGEN.freigegeben: true` in `apps/mobile/src/rechtliches.ts`. Das schaltet um, was heute vorbereitet ist: App und Bezahlschirm verlinken `nutzungsbedingungen.html` statt Apples Standard-EULA (`LINKS.nutzung` bleibt als Rückfall stehen), die Website zeigt die Seite ohne „Entwurf“ und verlinkt sie, und die App fragt beim nächsten Start einmal nach der Zustimmung (§ 305 Abs. 2 BGB: Kästchen, Link zu Bedingungen und Datenschutzhinweis, gespeichert werden Fassung und Zeitpunkt; bei einer neuen `fassung` erneut). Zusätzlich in App Store Connect bei „Lizenzvertrag“ die eigenen Bedingungen hinterlegen und die Adresse in der Store-Beschreibung (`store/de.json`) anpassen. Der Store-Check meldet „Eigene Nutzungsbedingungen freigegeben“, solange der Schalter aus ist.
3. **RDG:** Fragen im Fragenkatalog der Prüfmappe. Formulierungen in der App sind schon vorsichtig („kommt in Frage“, „nach deinen Angaben“); nach der Antwort des Anwalts passe ich sie an.
4. **Vermögensschadenhaftpflicht** bzw. IT-/Berufshaftpflicht abschließen – Angebote mehrerer Versicherer vergleichen, Tätigkeit genau beschreiben („Software mit Hinweisen zu Rechtspflichten und Vorlagen, keine Rechts- oder Steuerberatung“).
5. **Marke** anmelden (DPMA oder EUIPO), wenn die Recherche frei ist.

## 4. Nach dem Start: Löschfrist bei RevenueCat einhalten (E-159)

Der Datenschutzhinweis verspricht: Daten bei RevenueCat werden spätestens vier Monate nach Abo-Ende gelöscht. Dafür einmal im Monat:

1. In RevenueCat unter „Scheduled Data Exports“ den Export (Version 3) einrichten und die neueste CSV herunterladen.
2. Probelauf: `node werkzeuge/revenuecat-loeschen.mjs export.csv` – zeigt die fälligen App-Kennungen (Abo-Ende vor mehr als 90 Tagen).
3. Löschen: `REVENUECAT_SECRET_KEY=sk_… node werkzeuge/revenuecat-loeschen.mjs export.csv --ausfuehren` (geheimer Schlüssel aus RevenueCat → Projekt → API-Schlüssel; nie ins Repository).

Prüfen, ob die Scheduled Data Exports im gebuchten RevenueCat-Tarif enthalten sind; sonst die Liste der abgelaufenen Kunden anders beschaffen.
