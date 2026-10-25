# 15 · Partnerkanzleien: „Steuerberatung finden“

Stand: 2026-10-21. Vorsorglich gebaut und **verborgen**: Die gebündelte Liste `KANZLEIEN` ist leer, deshalb zeigt die
App den Bereich nirgends. Markierungen: **[mit Anwalt klären]** = vor dem ersten Listungsvertrag von Rechtsanwalt prüfen
lassen.

## 1. Modell

- Die App zeigt Steuerberatungskanzleien, die mit dem Steuerberater-Paket der App arbeiten (DATEV-Buchungsstapel,
  Listen, E-Rechnungen, Belege).
- **Vergütung:** Die Kanzlei zahlt eine **feste Listungsgebühr** (z. B. je Jahr) – unabhängig davon, ob, wie viele und
  welche Mandate entstehen. **Keine Provision, kein Erfolgshonorar, keine Gebühr je Anfrage oder je Mandat**, keine
  bezahlte Platzierung nach Mandaten. Die Reihenfolge ist die der Liste.
- **Rolle der App:** Sie bleibt ein Werkzeug zur Selbsthilfe. Die Kanzlei berät unter eigenem Namen und in eigener
  Verantwortung; die App vermittelt kein Mandat, ist an Beauftragung und Bezahlung nicht beteiligt und sendet nichts von
  sich aus.
- **Daten:** Gehen nur an eine Kanzlei, wenn der Nutzer sie selbst sendet – „Paket an … senden“ öffnet das Teilen-Menü
  des iPhones, „Kontakt aufnehmen“ die eigene Mail-App bzw. das Telefon. Kein Server, kein Formular, kein Tracking.
- **Free/Pro:** Liste und Kontakt sind für alle frei (Verweis, keine Funktion). Das Steuerberater-Paket selbst bleibt
  Pro wie bisher – auch, wenn es an eine gelistete Kanzlei geht.

### Rechtsgrundlage (Prüfbericht Rechtsanwalt, 21.10.2026, Abschnitt 7, Frage 4)

> Vermittlung gegen Erfolgsprovision an Anwälte verstößt gegen § 49b Abs. 3 BRAO; gegenüber Steuerberatern § 9 StBerG.
> Zulässig sind feste Listungsgebühren oder Plattformentgelte ohne Bezug zum Mandat. Nicht bauen, bevor das
> Vergütungsmodell steht (J-4).

Das Vergütungsmodell ist damit festgelegt: feste Listungsgebühr ohne Bezug zum Mandat. J-4 (ENTSCHEIDUNGEN.md) gilt
als geklärt, sobald Rechtsanwalt den Listungsvertrag und die Texte unten freigegeben hat. Anwälte werden vorerst nicht
gelistet (Berufsbezeichnung nur Steuerberater/in bzw. Steuerberatungsgesellschaft).

## 2. Was die App zeigt

- **„Für die Steuerberatung“** (Mein Betrieb › Paket für die Steuerberatung): Abschnitt „Steuerberatung finden“ unter
  dem Paket – nur, wenn mindestens eine gültige Kanzlei in der Liste steht. Je Kanzlei: Name, Berufsbezeichnung, Ort,
  Plakette „DATEV“, Leistungen, erster Festpreis mit „laut Kanzlei“.
- **Blatt der Kanzlei:** Kontakt (E-Mail, Telefon, Website – auswählbar zum Kopieren), Einzugsgebiet, zuständige
  Steuerberaterkammer, Leistungen, Festpreise „laut Kanzlei“, Schwerpunkte; Knöpfe „Paket an {Kanzlei} senden“ und
  „Kontakt aufnehmen“ (mailto/tel).
- **Pflicht-Details** (nur Kategorie „Steuern“): Zeile „Steuerberatung finden“, öffnet „Für die Steuerberatung“ mit dem
  Abschnitt oben.
- **Transparenz** (immer im Abschnitt und im Blatt): „Die Kanzleien beraten eigenverantwortlich unter eigenem Namen.
  {Marke} vermittelt nicht gegen Provision; Kanzleien zahlen eine feste Gebühr für die Listung.“ und „Deine Daten gehen
  nur an die Kanzlei, wenn du sie selbst sendest.“
- **Datenschutzhinweis** („Was du teilst“): „… auch an eine Kanzlei deiner Wahl. Die Kanzlei verarbeitet, was du ihr
  sendest, als eigener Verantwortlicher.“ – stimmt auch mit leerer Liste.

**Paket senden, technisch:** Ein Mail-Composer (`expo-mail-composer`) ist nicht eingebaut, und `mailto:` kann keine
Anhänge tragen. Deshalb erstellt „Paket an … senden“ dasselbe Paket wie „Paket teilen“ (Pro-Prüfung, Festschreiben der
Belege) und öffnet das Teilen-Menü; die Seite nennt die E-Mail-Adresse der Kanzlei („Mail“ wählen, Adresse eintragen),
im Blatt ist sie auswählbar. Ein Mail-Composer mit vorausgefülltem Empfänger wäre eine neue native Abhängigkeit
(neuer Build) – erst, wenn Kanzleien gelistet sind und Nutzer danach fragen.

## 3. Kanzlei aufnehmen

1. Listungsvertrag unterschrieben (Checkliste unten), Angaben der Kanzlei schriftlich (E-Mail genügt).
2. `apps/mobile/src/partner/kanzleien.ts` → Eintrag in `KANZLEIEN`:

   ```ts
   {
     id: "stb-muster-reutlingen",
     name: "Muster Steuerberatungsgesellschaft mbH",
     kurz: "Muster StB", // optional, höchstens 28 Zeichen – für den Knopf „Paket an … senden“
     berufsbezeichnung: "Steuerberatungsgesellschaft", // oder "Steuerberater" / "Steuerberaterin"
     ort: "Reutlingen",
     gebiet: "72", // PLZ-Bereich ("70–72") oder "bundesweit digital"
     email: "kontakt@muster-stb.de",
     telefon: "+49 7121 123456", // optional
     web: "https://muster-stb.de", // optional, nur https
     kammer: "Steuerberaterkammer Stuttgart",
     leistungen: ["Erstgespräch", "Buchhaltung übernehmen", "USt-Voranmeldung", "Jahresabschluss"],
     festpreise: ["Erstgespräch 30 Min. per Video: 90 € laut Kanzlei"], // optional, Wortlaut der Kanzlei
     datev: true,
     branchen: ["Handwerk"], // optional
     gueltigBis: "2027-10-31", // Ende der Listung (einschließlich)
   }
   ```

3. `kanzleiFehler()` prüft: Pflichtfelder, E-Mail, https-Website, Telefon, Steuerberaterkammer, PLZ-Bereich, Datum,
   **abgelaufene Listung** (nach `gueltigBis` verschwindet die Kanzlei von selbst) und Wörter wie „Provision“ oder
   „Vermittlungsgebühr“ in den Angaben. Ungültige Einträge zeigt die App nicht.
4. Test: Die Prüfung „die gebündelte Liste ist leer“ in `apps/mobile/test/partnerkanzleien.test.ts` auf „alle Einträge
   gültig“ umstellen (`expect(sichtbareKanzleien(heute, KANZLEIEN)).toHaveLength(KANZLEIEN.length)`), dann
   `pnpm --filter @amtlos/mobile test`, `pnpm typecheck`, Rundgang, Store-Check. Mit dem nächsten App-Update
   veröffentlichen (kein Laden aus dem Netz).
5. Verlängerung: neues `gueltigBis` mit dem nächsten Update; ohne Verlängerung verschwindet der Eintrag zum Datum.

## 4. Checkliste Listungsvertrag

- **Festgebühr:** Betrag und Zeitraum, fällig unabhängig von Anfragen und Mandaten; ausdrücklich keine Provision, kein
  Erfolgshonorar, keine Gebühr je Kontakt oder Mandat, keine Rückvergütung (§ 9 StBerG, § 49b Abs. 3 BRAO).
- **Laufzeit:** Beginn, Ende (= `gueltigBis`), Verlängerung, Kündigung; Entfernen bei Verstoß oder Verlust der
  Zulassung.
- **Pflicht zu aktuellen Angaben:** Kanzlei meldet Änderungen (Kontakt, Leistungen, Festpreise, Kammer, Zulassung)
  unverzüglich; Festpreise sind Angaben der Kanzlei und werden „laut Kanzlei“ gezeigt; Nachweis der Bestellung bzw.
  Anerkennung (Steuerberaterverzeichnis der Kammer) vor der Aufnahme.
- **Haftung/Abgrenzung:** Die Kanzlei berät eigenverantwortlich unter eigenem Namen; der Betreiber der App schuldet
  keine Beratung, keine Vermittlung eines Mandats und keine Anzahl an Anfragen; Freistellung bei falschen Angaben der
  Kanzlei; Berufshaftpflicht der Kanzlei.
- **Datenschutz:** Die Kanzlei ist für alles, was Nutzer ihr senden, **eigener Verantwortlicher** (Art. 4 Nr. 7 DSGVO);
  kein Auftragsverarbeitungsverhältnis, da die App keine Daten an die Kanzlei übermittelt. Der Betreiber erhält keine
  Nutzerdaten von der Kanzlei (keine Rückmeldung, wer Mandant wurde).
- **Werbung/Berufsrecht:** Kanzlei sichert zu, dass ihre Angaben dem Berufsrecht entsprechen (§ 57a StBerG,
  sachliche Information); keine Bewertungen oder „Empfehlungen“ der App.

## 5. Vor dem Livegang mit Rechtsanwalt prüfen  **[mit Anwalt klären]**

- Listungsvertrag (Muster nach Abschnitt 4).
- Wortlaut in der App: Transparenzsatz, „laut Kanzlei“, Abschnittstitel „Steuerberatung finden“, Hinweis
  „berät unter eigenem Namen und in eigener Verantwortung“, Datenschutzsatz „Kanzlei deiner Wahl … eigener
  Verantwortlicher“.
- Werbung und Berufsrecht der Kanzlei: Ist die Listung in der App mit § 57a StBerG und der BOStB vereinbar? Dürfen
  Festpreise genannt werden (StBVV, Vereinbarung nach § 4 StBVV)?
- Wettbewerbsrecht: Kennzeichnung der Listung als bezahlt (§ 5a Abs. 4 UWG) – reicht der Transparenzsatz?
- Abgrenzung zur Selbsthilfe der App (§ 6 Nr. 1 StBerG bzw. Smartlaw-Maßstab): bleibt die App ohne Vermittlung?
- Danach: J-4 in ENTSCHEIDUNGEN.md schließen, ersten Eintrag in `kanzleien.ts`, Test anpassen (Abschnitt 3).
