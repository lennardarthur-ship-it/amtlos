# Prüfmappe für die anwaltliche Prüfung (Phase 1, E-156)

Stand: Oktober 2026. Diese Mappe ist für eine Anwältin oder einen Anwalt mit Schwerpunkt **Arbeitsrecht und Datenschutzrecht**, für die Fragen zum Rechtsdienstleistungsgesetz gegebenenfalls zusätzlich **Berufsrecht / Legal Tech**. Sie soll den Prüfauftrag eingrenzen und damit die Kosten planbar machen.

## Was Betriebsklar ist

Eine iPhone-App für kleine Betriebe in Deutschland (Café, Salon, Handwerk, Praxis, Laden). Sie

1. fragt im **Pflichten-Check** 10–15 Fakten zum Betrieb ab (Rechtsform, Branche, Beschäftigte, Kasse, Website …) und zeigt aus einem festen Katalog, **welche Pflichten nach diesen Angaben in Frage kommen** (regelbasiert, keine KI, keine Einzelfallprüfung),
2. bietet **Vorlagen** zum Ausfüllen (Gefährdungsbeurteilung, Nachweis nach NachwG, AVV, Datenschutzinformation …), die der Nutzer selbst ausfüllt und als PDF ausgibt,
3. erinnert an Fristen und führt Rechnungen und Belege.

Die Daten bleiben auf dem Gerät. Betriebsklar sieht keine Nutzerdaten.

## Inhalt der Mappe

| Datei | Inhalt |
|---|---|
| `vorlagen/*.pdf` | Jede Vorlage in drei Fassungen: leer, Beispiel mit Auswahl, voll ausgefüllt |
| `katalog.csv` | Alle Pflichten des Katalogs mit Titel, Kurztext, Auslöser, Rechtsgrundlage, Quellen, Prüfstatus |
| `rdg-aenderungen.md` | Formulierungen, die für das RDG schon vorsichtiger gefasst wurden (alt → neu) |
| `nutzungsbedingungen-entwurf.md` | Entwurf der Nutzungsbedingungen (aus `docs/`) |
| `datenschutzhinweis-app.md` | Datenschutzhinweis der App, wie er in der App steht |
| `website-datenschutz.html`, `website-impressum.html`, `website-hilfe.html`, `website-nutzungsbedingungen.html` | Datenschutzerklärung, Impressum, Hilfe-Seite und Nutzungsbedingungen der Website, wie sie veröffentlicht würden (Abschnitt Hosting folgt nach Wahl des Hosters; Nutzungsbedingungen als „Entwurf – noch nicht in Kraft“) |
| `PRUEFLISTE-auszug.md` | Offene fachliche Fragen aus der Entwicklung, nach Rechtsgebiet |

`node docs/pruefmappe-anwalt/erzeugen.mjs <ziel>` erzeugt die Mappe neu aus dem aktuellen Code.

## Prüfumfang – Vorschlag

### A. Vollständig prüfen (vom Gründer vorgegeben)

1. **Nachweis der wesentlichen Arbeitsbedingungen** (`nachweis_arbeitsbedingungen`) – § 2 NachwG in der Fassung seit 1.1.2025 (Textform), Vollständigkeit der Angaben, Fristen
2. **Vertrag zur Auftragsverarbeitung** (`avv`) – Art. 28 Abs. 3 DSGVO
3. **Datenschutzinformation** (`datenschutzinformation`) – Art. 13 DSGVO
4. **Gefährdungsbeurteilung** (`gefaehrdungsbeurteilung`) – §§ 5, 6 ArbSchG, § 10 MuSchG, Gefährdungsgruppen je Branche

### B. Vollständig prüfen (empfohlen, hohes Haftungsrisiko)

5. Datenschutzerklärung für die Website (`datenschutzerklaerung_website`)
6. Anamnese und Einwilligung (`anamnese_einwilligung`) – Gesundheitsdaten, Art. 9 DSGVO
7. Hinweisschild Videoüberwachung (`video_hinweisschild`)
8. Verzeichnis der Verarbeitungstätigkeiten mit TOM (`datenschutz_dokumentation`)
9. Impressum (`impressum`)
10. Arbeitszeitnachweis (`arbeitszeitnachweis`) und Hinweis auf die Ausweispflicht (`ausweis_hinweis`)
11. Belehrung nach § 43 IfSG (`ifsg_belehrung`)

### C. Stichprobe

Alle übrigen Vorlagen (Unterweisung, Betriebsanweisung, Hygieneplan, HACCP, Allergenliste, Transparenzregister, Kassenmeldung …) und 20–30 Einträge aus `katalog.csv`, bevorzugt solche mit hoher Sanktion (`schwere: hoch`) und die Einträge mit Status „geplant/Entwurf“.

## Fragen an die Prüfung

### Rechtsdienstleistungsgesetz

1. Ist der Pflichten-Check eine **Rechtsdienstleistung** im Sinne von § 2 Abs. 1 RDG (Tätigkeit in konkreten fremden Angelegenheiten, die eine rechtliche Prüfung des Einzelfalls erfordert)? Der Check ordnet standardisierte Fakten einem festen Katalog zu; vergleichbar mit dem Vertragsgenerator in BGH, Urteil vom 9.9.2021 – I ZR 113/20 („Smartlaw“)? Gilt das auch für die Hinweise „Jetzt dran“ und „Hängt ab“?
2. Welche Formulierungen sind riskant (z. B. „Du musst …“, „Diese Pflicht gilt für dich“) und wie sollen sie lauten? Siehe `rdg-aenderungen.md`.
3. Darf der Check bei unklaren Antworten konkrete nächste Schritte empfehlen („Frag dein Gewerbeamt“), ohne die Grenze zu überschreiten?
4. Ist ein späterer **Marktplatz** mit Steuerberatern/Anwälten (Vermittlung gegen Gebühr) berufsrechtlich zulässig (§ 49b BRAO, § 9 StBerG)? (Noch nicht gebaut.)

### Haftung und Nutzungsbedingungen

5. Reicht der Entwurf der Nutzungsbedingungen (Haftungsbeschränkung, „keine Rechts- oder Steuerberatung“, Verbraucher vs. Unternehmer)? Wirksamkeit der Klauseln nach §§ 307–309 BGB, auch gegenüber Unternehmern.
6. Genügt der Hinweis in der App (Check, Pflichtdetails, jede Vorlage) oder muss er zusätzlich auf die PDFs? (Heute bewusst nicht auf den PDFs, weil das die Unterlagen des Nutzers sind, die er Kontrolleuren und Kunden zeigt.)
7. Welche Angaben braucht die Vermögensschadenhaftpflicht-Versicherung, um das Risiko „fehlerhafte Vorlage / fehlende Pflicht im Katalog“ zu decken?

### Datenschutz (Betriebsklar selbst)

8. Ist der Datenschutzhinweis der App vollständig (Art. 13 DSGVO)? Übermittlung an RevenueCat (USA) auf Grundlage der Standardvertragsklauseln Modul 2 laut Auftragsverarbeitungsvertrag von RevenueCat (Stand August 2026).
9. Ist Betriebsklar für die Daten, die Nutzer in der App über Kunden und Mitarbeiter erfassen, weder Verantwortlicher noch Auftragsverarbeiter (alles bleibt auf dem Gerät, Ende-zu-Ende-verschlüsselte Sicherung)?

### Vorlagen allgemein

10. Sind die Vorlagen als „Muster“ ausreichend gekennzeichnet? Welche Vorlagen dürfen nur mit anwaltlicher Anpassung verwendet werden?
11. Sind Rechtsgrundlagen und Fristen in den Vorlagen richtig zitiert (Stand Oktober 2026)?

## Stand nach Vorprüfung vom 21.10.2026

Eine Vorprüfung (`docs/pruefberichte/2026-10-21-vorpruefung-phase-1.pdf`) hat die Abschnitte 8 und 9 vorbereitet. Sie ist **keine unterschriebene anwaltliche Stellungnahme**; ihre Vorschläge sind als Entwurf umgesetzt und warten auf Ihre Freigabe. Geändert wurde:

**Datenschutzhinweis der App und Datenschutzerklärung der Website** (Frage 8)

- Verantwortlicher aus den Anbieterangaben: Lang Ventures UG (haftungsbeschränkt), Gomaringer Str. 33, 72770 Reutlingen, vertreten durch Lennard Lang (Geschäftsführer) – in der App, auf der Website und im Impressum (dort zusätzlich die Rechtsform; Register und USt-IdNr. folgen nach der Eintragung).
- Drittland: „Standardvertragsklauseln der EU-Kommission (Durchführungsbeschluss (EU) 2021/914, Modul 2), Art. 46 Abs. 2 lit. c DSGVO“ mit Fundstelle im Amtsblatt und der Adresse des Auftragsverarbeitungsvertrags von RevenueCat. Das Data Privacy Framework ist **nicht** genannt: Am 21.10.2026 ließ sich eine Teilnahme von RevenueCat nicht belegen (DPA und Datenschutzerklärung von RevenueCat erwähnen es nicht).
- Speicherdauer bei RevenueCat: nur, was stimmt – für die Dauer unseres Vertrags, Löschung einzelner Kennungen auf unsere Anforderung, nach Vertragsende Löschung oder Rückgabe. Eine feste Frist nach Abo-Ende ist eine offene Produktentscheidung.
- „Deine Rechte“ nennt die zuständige Aufsichtsbehörde (Sitz Reutlingen → Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg).
- Erinnerungen: ausdrücklich nur lokal, keine Push-Mitteilungen über einen Server.
- Sync-Zusatz (noch nicht ausgeliefert): Platzhalter für die Aufbewahrung der Server-Backups; ein AVV für die Synchronisation ist als Aufgabe vor dem Sync-Build vorgesehen (Frage 9).
- Website „Diese Website“: Der Kurz-Check rechnet nur im Browser (keine Übertragung, keine Speicherung), Schriften liegen auf dem eigenen Server, Hosting folgt nach Wahl des Hosters.

**Nutzungsbedingungen** (Frage 5) – jetzt „Fassung zur Freigabe“, weiter unveröffentlicht

- Ziffer 1.1 mit Anbieterangaben, neue Ziffer 1.4 zur Einbeziehung (§ 305 Abs. 2 BGB), 2.3 ergänzt, 3.1 Familienfreigabe, neue 3.5 Nutzerpflichten, 4.3 neu gefasst (Widerruf über Apple), neue 5.4 („Wir werten keine Inhalte deiner Unterlagen aus.“), 6.2/6.3 Änderungsgründe, Information und Beendigungsrecht (§ 327r BGB), 7.2 Verjährung gegenüber Unternehmern, 8.3 als „insbesondere“-Beispiel, 10.2 Gerichtsstand Reutlingen, 10.4 VSBG-Satz, 11.2 Rechte Dritter, neue Ziffer 12 Dienste Dritter (RevenueCat, iCloud).
- **Offen zur Entscheidung:** Haftungshöchstbetrag gegenüber Unternehmern bei leichter Fahrlässigkeit – Festbetrag (z. B. 5.000 €) ja/nein. Bis dahin gilt nur die Grenze „vertragstypischer, vorhersehbarer Schaden“ aus 8.2.
- Die Bedingungen sind als Seite `nutzungsbedingungen.html` gebaut (als Entwurf gekennzeichnet, nicht verlinkt, noindex).

**Zustimmung in der App** – vorbereitet, aber ausgeschaltet

- Beim ersten Start und nach jeder neuen Fassung: Hinweis mit Link zu den Bedingungen und zum Datenschutzhinweis, ein anfangs leeres Kästchen „Ich akzeptiere die Nutzungsbedingungen.“ und „Weiter“. Kein Konto; gespeichert werden nur Fassung und Zeitpunkt auf dem Gerät. Bestehende Daten bleiben unverändert.
- Aktiv erst, wenn Sie die Bedingungen freigeben (`NUTZUNGSBEDINGUNGEN.freigegeben`). Bis dahin gilt in der App Apples Standard-Lizenzvertrag.

## Was wir nach der Prüfung ändern

Jede Anmerkung wird umgesetzt, in `ENTSCHEIDUNGEN.md` dokumentiert und in `PRUEFLISTE.md` mit Datum und Prüfer als erledigt markiert. Geprüfte Pflichten bekommen im Katalog `pruefung.status: geprueft`, `geprueft_von`, `geprueft_am` – die App zeigt dann nicht mehr „noch nicht von Fachleuten geprüft“.
