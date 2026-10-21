# RDG-Formulierungen – Änderungen Phase 1 (Stand 21.10.2026)

Maßstab: § 2 Abs. 1 RDG (Rechtsdienstleistung = Tätigkeit in konkreten fremden Angelegenheiten, die eine rechtliche Prüfung des Einzelfalls erfordert); BGH, Urt. v. 9.9.2021 – I ZR 113/20 („Smartlaw“): standardisierte Abbildung allgemeiner Fallgestaltungen ist keine Rechtsdienstleistung. Ziel: allgemeine Information („nach deinen Angaben“, „typische Pflichten“, „Vorlage“), keine Zusagen, kein Urteil im Einzelfall. Titel der Pflichten selbst (z. B. „Arbeitszeit aufzeichnen“) und Inhalte der Pflichten unverändert.

Geprüft: `apps/mobile/src/texte.ts`, Bildschirme Check/Pflichten/Heute, `apps/mobile/store/de.json`, `apps/website/seite.html`. Keine Treffer für „rechtssicher“, „garantiert“, „abmahnsicher“, „100 %“, „prüft deinen Fall“ (auch nicht in `packages/fachlogik`, `packages/i18n`) – ein Test sichert das ab (`apps/mobile/test/phase1-hinweise.test.ts`).

## Geänderte Texte (alt → neu)

### App (`apps/mobile/src/texte.ts`)

| Schlüssel | Wo | Alt | Neu |
|---|---|---|---|
| `check_hinweis` | Einleitung Pflichten-Check | Wichtig: Die Pflichten und Vorlagen in Betriebsklar sind noch nicht von Fachleuten geprüft. Sie ersetzen keine Rechts- oder Steuerberatung. Prüfe Ergebnisse, bevor du dich darauf verlässt. | Wichtig: Betriebsklar zeigt allgemeine Informationen zu typischen Pflichten und Vorlagen – keine Rechts- oder Steuerberatung. Pflichten und Vorlagen sind noch nicht von Fachleuten geprüft. Prüfe Ergebnisse, bevor du dich darauf verlässt. |
| `start_punkte[0].text` | Pflichten-Tab vor dem Check („So hilft dir Betriebsklar“) | Ein Check mit ein paar Fragen zeigt, was für deinen Betrieb gilt – mit Terminen und Erinnerungen. | Ein Check mit ein paar Fragen zeigt, welche Pflichten nach deinen Angaben in Frage kommen – mit Terminen und Erinnerungen. |
| `pflichten_tab_unter` | (Untertitel Pflichten) | Was gilt, was jetzt dran ist. | Was in Frage kommt, was jetzt dran ist. |
| `r10_ergebnis_bald` | Titel Pflichten-Tab | Für deinen Betrieb: 1 Termin in den nächsten 2 Wochen (… / keine Termine … / nichts Dringendes) | Nach deinen Angaben: 1 Termin in den nächsten 2 Wochen (… / keine Termine … / nichts Dringendes) |
| `ergebnis_bald` | (ältere Fassung desselben Titels) | Für deinen Betrieb: 1 Sache in den nächsten 2 Wochen | Nach deinen Angaben: 1 Sache in den nächsten 2 Wochen |
| `warum` | Pflicht-Detail, Zeilenüberschrift | Warum für dich | Warum sie in Frage kommt |
| `alle_pflichten` | „Heute“, Link zum Pflichten-Tab | Alle Pflichten | Zur Liste |
| `alle_nach_bereich` | Pflichten-Tab, Überschrift | Alle Pflichten nach Bereich | Pflichten nach Bereich |
| `r11_schon_text` | „Was hast du schon?“ nach dem Check | Dein Betrieb läuft schon – vieles davon ist sicher erledigt. Hake ab, was du schon hast. Danach siehst du, was wirklich noch offen ist. | Dein Betrieb läuft schon – vieles davon hast du vermutlich erledigt. Hake ab, was du schon hast. Danach siehst du, was nach deinen Angaben noch offen ist. |
| `r11_kontrollbereit` | „Heute“, Kachel Kontrollmappe | Kontrollbereit: 2 von 4 Nachweisen | Für Kontrollen: 2 von 4 Nachweisen da |
| `pflichten_quelle` (ersetzt) | Check-Ergebnis, Pflichten-Tab, Pflicht-Detail | Aus dem Betriebsklar-Katalog, fachlich noch nicht geprüft. | `hinweis_pflichten` + Rechtsstand (s. u.) |

### Neue Hinweise (App)

| Schlüssel | Wo | Text |
|---|---|---|
| `hinweis_pflichten` | Check-Ergebnis, Pflichten-Tab (Ende der Liste; vor dem Check unter „So hilft dir Betriebsklar“), jede Pflicht | Allgemeine Informationen zu typischen Pflichten für Betriebe wie deinen – keine Rechts- oder Steuerberatung. Aus dem Betriebsklar-Katalog, fachlich noch nicht geprüft. ⏎ Rechtsstand: Oktober 2026 |
| `hinweis_vorlage` | jeder Schritt im Ausfüll-Ablauf, Abschluss/Teilen, „Wozu brauche ich das?“ – alle Vorlagen außer Rechnung/Storno | Vorlage, keine Rechts- oder Steuerberatung. Prüfe die Angaben für deinen Betrieb – im Zweifel mit Anwalt oder Steuerberatung. ⏎ Rechtsstand: Oktober 2026 |
| `hinweis_recht` | „Mein Betrieb“ → „Über Betriebsklar“ (Rechtliches) | Betriebsklar gibt allgemeine Informationen und Vorlagen – keine Rechts- oder Steuerberatung. ⏎ Rechtsstand: Oktober 2026 |

Unverändert bewusst: `ergebnis_titel` („Für deinen Betrieb kommen 3 Pflichten in Frage“ – schon konditional), `ueber` („Die Vorlagen ersetzen keine Rechts- oder Steuerberatung …“), Pflicht-Titel im Imperativ.

### App-Store-Texte (`apps/mobile/store/de.json`)

| Feld | Alt | Neu |
|---|---|---|
| `beschreibung`, Pflichten-Check | • Jede Pflicht mit Begründung, Rechtsgrundlage und offizieller Quelle | • Jede Pflicht mit dem Hinweis, warum sie nach deinen Angaben in Frage kommt, mit Rechtsgrundlage und offizieller Quelle |
| `beschreibung`, WICHTIG | Pflichten-Katalog und Vorlagen sind noch nicht von Fachleuten geprüft. Betriebsklar ersetzt keine Rechts- oder Steuerberatung. Prüfe Ergebnisse und Unterlagen, bevor du dich darauf verlässt. | Betriebsklar gibt allgemeine Informationen und Vorlagen und ersetzt keine Rechts- oder Steuerberatung. Pflichten-Katalog und Vorlagen sind noch nicht von Fachleuten geprüft. Prüfe Ergebnisse und Unterlagen, bevor du dich darauf verlässt. |
| `bilder[5].titel` (Screenshot Kontrollmappe) | Bereit für die Kontrolle | Nachweise für die Kontrolle |

### Website (`apps/website/seite.html`)

| Stelle | Alt | Neu |
|---|---|---|
| Einstieg, Aufzählung | Pflichten-Check mit Begründung, Rechtsgrundlage und Terminen | Pflichten-Check: typische Pflichten nach deinen Angaben, mit Rechtsgrundlage, Quelle und Terminen |
| Kurz-Check, Kopfzeile | Stand Katalog 2026 | Rechtsstand: Oktober 2026 (beim Bauen aus dem Katalog) |
| Kurz-Check, Ergebnis (Starttext) | Pflichten kommen für dich in Frage. | Pflichten kommen nach deinen Angaben in Frage. |
| Kurz-Check, Hinweis am Ergebnis | Entwurf: Die Pflichten sind noch nicht von Fachleuten geprüft. Für deinen Einzelfall bleibt die Steuerberatung zuständig. | **Keine Rechts- oder Steuerberatung:** Der Kurz-Check zeigt typische Pflichten für Betriebe wie deinen. Entwurf, noch nicht von Fachleuten geprüft – für deinen Einzelfall helfen Anwalt oder Steuerberatung. |
| Häufige Fragen | Ersetzt Betriebsklar meine Steuerberatung? – Nein. Betriebsklar zeigt, welche Pflichten nach deinen Angaben in Frage kommen, und bereitet Unterlagen vor. Für Beratung im Einzelfall bleibt deine Steuerberaterin oder dein Steuerberater zuständig. Pflichten-Katalog und Vorlagen sind noch nicht von Fachleuten geprüft. | Ersetzt Betriebsklar Rechts- oder Steuerberatung? – Nein. Betriebsklar gibt allgemeine Informationen dazu, welche Pflichten nach deinen Angaben in Frage kommen, und Vorlagen für deine Unterlagen. Für Beratung im Einzelfall bleiben Anwalt, Steuerberaterin oder Steuerberater zuständig. Pflichten-Katalog und Vorlagen sind noch nicht von Fachleuten geprüft. (erscheint auch auf hilfe.html) |
| Fußzeile (alle Seiten, neu) | – | Allgemeine Informationen und Vorlagen – keine Rechts- oder Steuerberatung. Rechtsstand: Oktober 2026. |

## Nicht in die PDFs

Kein Hinweis von Betriebsklar in den erzeugten Unterlagen (Hygieneplan, Arbeitszeitnachweis, Rechnung usw.): Sie sind Dokumente des Betriebs, die Kontrolleuren und Kunden vorgelegt werden. Der Hinweis steht nur in der App (Ablauf, Abschluss) und auf der Website. Einen Fußvermerk „Erstellt mit Betriebsklar“ gibt es in den PDFs derzeit nicht; es wurde keiner hinzugefügt.

## Fragen an die Anwältin / den Anwalt

1. Reicht „nach deinen Angaben … in Frage“ beim Check-Ergebnis, oder soll die Hauptzahl („3 Dinge sind jetzt dran“) ebenfalls konditional formuliert werden?
2. Sollen Rechnungen (reiner Geschäftsvorgang) ebenfalls den Vorlagen-Hinweis tragen?
3. Ist „Rechtsstand: Monat Jahr“ (jüngstes Abrufdatum der Quellen bzw. Feld des Katalog-Builds) ausreichend, oder braucht es ein tagesgenaues Datum?
