# ELSTER-Übermittlung mit ERiC – Konzept (Stand 13.10.2026)

**Status:** Konzept, nichts gebaut. Es setzt eine Entscheidung zu K1 voraus (Server, Konto, Bezahlung) und hebt E-121 („alles nur auf dem Gerät“) für diesen Teil auf. J-1 (StBerG) ist offen.
**Anlass:** Review L. Reiche vom 13.10.2026, Punkt 3: „Amtlos“ wird nicht eingelöst, weil die App nichts an ELSTER schickt.

Die Fakten unten stammen aus einer Recherche vom 13.10.2026. Wo etwas nur über Sekundärquellen belegt ist, steht das dabei. Jede Annahme ist in PRUEFLISTE T-71 aufgeführt.

## 1. Was ERiC ist und wer es nutzen darf

- ERiC (ELSTER Rich Client) ist die C-Bibliothek der Steuerverwaltung. Sie prüft, verschlüsselt und überträgt Steuerdaten. Hersteller von Steuer-, Finanz- und Lohnsoftware können sie **kostenlos** nutzen ([elster.de, Entwickler](https://www.elster.de/eportal/infoseite/entwickler)).
- **Zugang:**
  1. Registrierung als Hersteller im ELSTER-Entwicklerbereich. Das Bayerische Landesamt für Steuern prüft die Absicht und schaltet frei.
  2. Danach eine **Hersteller-ID** beantragen.
- **Lizenz** (laut einer Herstellerkopie der Bedingungen; der Volltext liegt im Download-Paket):
  - einfaches Nutzungsrecht, eigene Produkte dürfen vertrieben werden;
  - keine Unterlizenzen;
  - der Name des Herstellers darf nicht „ELSTER“ enthalten;
  - das Landesamt gibt eine Mindestversion vor und kann die Hersteller-ID sperren.
  - Zur Übermittlung im Auftrag Dritter sagt die gesichtete Fassung nichts. **Muss gegen den Originaltext geprüft werden.**
- **Plattformen** laut Entwicklerhandbuch (Drittkopie, Version 43.3):
  - Windows, Linux x86-64 und Power, macOS (Universal), AIX.
  - **Nicht iOS oder Android.** Linux auf ARM64 ist im Handbuch nicht genannt.
  - Folge: **ERiC läuft nie in der App, nur auf einem Server (Linux x86-64) oder einem Desktop.**
- **Release-Zyklus:**
  - Hauptversion jedes Jahr im November, dazu Zwischenstände (z. B. 23.02.2026).
  - Die Mindestversion steigt regelmäßig. Ohne ständige Pflege bricht die Übermittlung ab.
- **Tests:** Testmerker für die Testumgebung (laut ELSTER-Forum, nicht amtlich) und Test-Zertifikate.

## 2. Zwei Wege der Übermittlung

| | A: Server mit Zertifikat des Nutzers | B: Datenübermittlung im Auftrag (§ 87d AO) |
|---|---|---|
| Wer signiert | der Nutzer mit seinem ELSTER-Zertifikat (.pfx und PIN) | Amtlos mit eigenem Zertifikat |
| Was Amtlos tut | Zertifikat und PIN gelangen kurz auf den Server, ERiC signiert und sendet, danach wird alles gelöscht | Amtlos identifiziert den Auftraggeber, lässt ihn die Daten freigeben, übermittelt und bewahrt die Daten 5 Jahre auf (§ 87d AO) |
| Risiko | Hersteller sehen den Upload von Zertifikat und PIN kritisch (nur Forumsmeinungen, keine amtliche Auskunft); höchste Sicherheitsanforderungen | Pflichten nach § 87d AO; Abgrenzung zur Hilfeleistung in Steuersachen (StBerG) |
| Recht | J-1 offen | J-1 offen, zusätzlich § 87d AO |

**Empfehlung für den Start:** Weg A mit kurzlebiger Verarbeitung im Arbeitsspeicher, aber erst nach dem Kurzgutachten zu J-1. Weg B ist für ein Massenprodukt sauberer, braucht aber Identifizierung, Freigabe-Protokoll und Aufbewahrung.

## 3. Architektur (Weg A)

```
iPhone (Amtlos)                      Amtlos-Server (EU, Linux x86-64)            ELSTER
───────────────                      ─────────────────────────────────           ──────
Voranmeldung aus Rechnungen ──TLS──▶ /elster/ustva (Konto, Bezahlung K1)
  Kennzahlen 81, 86, 66, 83 …          ├─ Plausibilität (Fachlogik, gleiche Regeln)
  Zertifikat (.pfx) + PIN  ──TLS──▶    ├─ ERiC-Worker (Prozess je Auftrag, kein Swap,
                                       │    Zertifikat nur im RAM)  ────────────▶  Annahme
                                       ├─ Protokoll / Transferticket ◀──────────── Quittung
PDF-Protokoll, Transferticket ◀───────┘   danach: Zertifikat, PIN und Daten löschen
```

- **ERiC-Worker:**
  - eigener Dienst (vorhanden: `apps/worker`), ERiC über Node-FFI oder einen kleinen C-Wrapper angebunden;
  - ein Container je Version, Update im November eingeplant.
- **XML:** UStVA-Datensatz nach Jahresschema; Kennzahlen 2026 laut BMF-Vordruck: 81, 86, 41, 43, 66, 83 und neu 500 (Zeile 55). In der App heute nur 19 %, 7 % und „steuerfrei/0 %“.
- **Sicherheit:** kein Logging von Nutzdaten, Zertifikat nie auf Platte, Pen-Test vor Livegang, Betrieb in der EU.
- **App:** neuer Abschluss-Schritt „An ELSTER senden“ mit Vorschau der Kennzahlen, Zertifikat aus der Dateien-App, PIN-Eingabe, danach Transferticket und Protokoll als PDF bei der Unterlage. Ohne Konto bleibt das bisherige PDF zum Übertragen.

## 4. Aufwand (grob, ein Entwickler)

| Schritt | Dauer |
|---|---|
| Hersteller-Registrierung, Hersteller-ID, Testzugang | 2–6 Wochen Wartezeit (Behörde), parallel |
| Kurzgutachten J-1 und § 87d AO (Kanzlei) | 2–4 Wochen, Kosten nach Angebot |
| ERiC-Worker mit UStVA im Testmodus | 2–3 Wochen |
| Konto, Bezahlung, Server-Betrieb (K1) | 3–4 Wochen |
| App-Schritt „An ELSTER senden“, Protokoll | 1–2 Wochen |
| Sicherheitsprüfung, Livegang | 2 Wochen |

Ohne Wartezeiten sind das **8–11 Wochen** bis zur ersten echten Voranmeldung. Danach folgen Lohnsteuer-Anmeldung und Jahreserklärungen, jeweils mit eigenem Schema.

## 5. Bis dahin (ohne Server)

Die App liefert die Voranmeldung als PDF mit den richtigen Beträgen: nach Leistungsdatum bzw. Zahlungseingang (E-129). Die Kennzahlen-Zuordnung (Kz 81/86/…) kommt mit dem ERiC-Schritt, weil das Formular dafür geprüft werden muss (T-71).

## 6. Entscheidungen für den Gründer

1. K1: Server und Konto ja oder nein. Ohne Server gibt es keine ELSTER-Übermittlung.
2. Weg A oder B (nach dem Gutachten).
3. Hersteller-Registrierung jetzt beantragen? Kostet nichts und verkürzt die Wartezeit später.
