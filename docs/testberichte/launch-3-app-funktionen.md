# Testbericht Launch-Fokus 3 · Alle Funktionen der Web-App in der iPhone-App

Stand: 2026-10-12 · Auftrag: „alle Features der Web-App auf die iPhone-App übertragen“ (E-120)

## Ergebnis in einem Satz

Die App kann jetzt alles, was die Web-App im Kernumfang kann – Gründungsassistent mit Fragebogen, Rechnungen, Belege, Umsatzsteuer-Voranmeldung, Kassen, Personal mit Checklisten, Arbeitszeiten, Unterweisungen, Behördenbriefe, Kalender, Änderungen melden, Team, Hilfe und Einstellungen – und das alles auch in der Demo ohne Server. **590+ automatisierte Tests, Datenbanktests und der Rundgang durch alle Bereiche (hell und dunkel) sind grün.**

## Was in der App neu ist

| Tab / Bereich | Funktionen |
|---|---|
| Heute | dazu: Gründungsfortschritt, Fristen aus Behördenbriefen, Sammelbestätigung „vor dem Start erledigt“; aktualisiert sich nach Änderungen in anderen Tabs |
| Pflichten | Kalender (12 Monate), Listen „Angabe fehlt“, „erledigt“, „gilt nicht für dich“; auf der Karte: fehlende Angabe direkt beantworten (nur die eine Frage), Notiz beim Erledigen, Nachweise, Begründung bei „gilt nicht“ |
| Finanzen | Beleg fotografieren (danach gleich Betrag und USt erfassen), Umsatz und Kleinunternehmergrenze, Rechnungen (Entwurf, Positionen, Stellen mit Nummer, Storno; fehlende Pflichtangaben werden benannt), Belege, USt-Voranmeldung (Monat/Quartal), Kassen, Rechnungsangaben und Kunden |
| Personal | Stempeln, Team, „Jemand Neues fängt an“ mit Checkliste, Austritt, Arbeitszeiten (Monat, Nachtrag), Unterweisungen (anlegen, mit Namen bestätigen, abschließen erledigt die Pflichten), „Wenn dein Team wächst“ |
| Mehr | Gründungsassistent mit Fragebogen zur steuerlichen Erfassung, Behördenbriefe (fotografieren, einordnen, Frist), Kalender, Änderung melden (mit Zurücknehmen), Team und Einladungen, Hilfe mit Anleitungen und Fachbegriffen, Einstellungen (Angaben je Schritt, Erinnerungen, Datenexport, Unternehmen löschen) |

Nicht in der App: Dateien herunterladen (Rechnungs-PDF, XRechnung, CSV-Exporte) – die App verweist auf den Computer; Bezahlen (T-49).

## Technik

- **Gemeinsame Fachlogik:** neues Paket `@amtlos/fachlogik` (Gründung, Fragebogen, Rechnungssummen, E-Rechnungs-Vollständigkeit, USt-Zeitraum/Umsätze); `sollInstanzen`, `anzeigeStatus` und `heuteUebersicht` liegen in `@amtlos/rules-engine`. Server, API und App rechnen damit gleich.
- **Navigation** ohne zusätzliche Pakete (kein `npm install` nötig für das Testpaket).
- **Demo-Server** in Modulen; Stand im Gerät, übersteht Neustarts.

## Tests

| Prüfung | Ergebnis |
|---|---|
| Regel-Engine | 398 |
| Server / API / Worker (mit Datenbank) | 54 / 72 / 3 |
| Übersetzungen | 52 |
| Fristen / Fachlogik | 21 / 2 |
| Web / Studio | 13 / 5 |
| App (neu: Rechnung stellen inkl. fehlender Angaben und Storno, USt-Voranmeldung, Einstellung mit Profil-Anzahlen und Checkliste, Zeiten, Unterweisung mit Namensprüfung, Brieffrist im Kalender, Gründung/Fragebogen, Ereignis zurücknehmen; Engine-Parität für 33 Fixtures) | 53 |
| Rundgang durch alle Bereiche (Web-Export, iPhone-Format, hell und dunkel) | ohne Befunde |
| Testpaket: frische Installation, iOS-Bündel, Entwicklungsserver | grün |

## Beim Prüfen gefunden und behoben

1. „Heute“ zeigte nach Änderungen in anderen Tabs den alten Stand – jetzt laden geöffnete Seiten nach jeder Änderung still neu (Formulare werden dabei nicht überschrieben).
2. Beim Stellen einer Rechnung stand die Meldung „was fehlt“ außer Sicht oben – jetzt direkt über dem Knopf, mit Weg zu den Angaben.
3. „Angabe ergänzen“ öffnete den ganzen Fragen-Schritt (bis zu sechs Fragen) – jetzt nur die Frage, die die Pflicht klärt.
4. Ersatz-Icons außerhalb von iOS wurden von Screenreadern mitgelesen – jetzt verborgen.
5. Der Text „Rechnungen: schreiben, versenden, als bezahlt markieren“ versprach Funktionen, die es nicht gibt (auch im Web) – korrigiert.

## Fachliche Befunde (in die Prüfliste)

- **T-50:** Pflichten zur Einstellung erscheinen erst am ersten Arbeitstag. Bei einer angekündigten Einstellung fehlt die Checkliste vorher – die Sofortmeldung muss aber spätestens bei Arbeitsbeginn raus.
- **T-51:** Monatliche SV-Pflichten erscheinen ab Gründung, auch für Monate vor dem ersten Arbeitstag.

Beides betrifft Server und App gleich (Katalog/Regeln), nicht die Oberfläche.

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Auf echtem iPhone gesehen | bisher nur Web-Export und Bündel | du testest im Testpaket; Rückmeldungen per Screenshot |
| Dateien in der App | PDF/CSV-Download braucht Dateisystem- und Teilen-Funktionen (neue Pakete) | mit dem nächsten Development Build |
| Mehr Funktionen = mehr Komplexität | die Rückmeldung „zu kompliziert“ gilt weiter | nach dem Test gemeinsam entscheiden, was in den Vordergrund gehört (z. B. „Amtlos erledigt es für dich“) |
