# 13 · B2B: Partner-Lizenzen, „Empfohlen von …“ und die Fachbibliothek

Stand: 2026-10-21 (Phase 2.3, E-156). Was im Code vorbereitet ist und was du als Gründer klären musst.
Markierungen: **[unsicher]** = nicht abschließend geprüft, **[mit Anwalt/Steuerberater klären]** = vor dem ersten
Vertrag mit einem Partner rechtlich bzw. steuerlich prüfen lassen.

Drei Produkte:

1. **Partner-Lizenzen** – eine Kammer, ein Verband oder eine Steuerkanzlei gibt ihren Mitgliedern Betriebsklar Pro. Technisch
   ausschließlich über **Apples Abo-Angebotscodes** (Offer Codes).
2. **„Empfohlen von …“** – der Name (und ggf. das Logo) des Partners in der App. Reine Anzeige.
3. **Fachbibliothek** – die Pakete `@amtlos/fristen`, `@amtlos/rules-engine`, `@amtlos/fachlogik` als Bibliothek für
   Software-Partner (z. B. Kanzlei-Software, Branchenportale).

---

## 1. Warum Angebotscodes und keine eigenen Lizenzschlüssel

App Review Guidelines ([developer.apple.com/app-store/review/guidelines](https://developer.apple.com/app-store/review/guidelines/)):

- **3.1.1:** „If you want to unlock features or functionality within your app … you must use in-app purchase. Apps may
  not use their own mechanisms to unlock content or functionality, such as license keys, … QR codes …“
- **3.1.3(c) Enterprise Services:** gilt nur für Apps, die „only … directly by you to organizations or groups for their
  employees or students“ verkauft werden; „Consumer, single user, or family sales must use in-app purchase.“

Betriebsklar verkauft an einzelne Betriebe (Selbständige, kleine Firmen) – also Einzelkunden, nicht Mitarbeitende einer
Organisation. Eine Kammer, die Codes an ihre Mitglieder verteilt, ist kein Arbeitgeber dieser Mitglieder. Deshalb:

- **Kein eigener Freischaltweg** in der iOS-App: keine Lizenzschlüssel, keine Partner-Codes, die Pro freischalten,
  keine QR-Codes, kein Freischalten über unseren Server.
- Pro gilt in der App **nur**, wenn RevenueCat die Berechtigung `pro` meldet (Kauf, Wiederherstellen, eingelöster
  Angebotscode, Konto verbinden) – oder im Testmodus (Entwicklung/TestFlight, nie im Store-Build).
- `node apps/mobile/werkzeuge/store-check.mjs` prüft das bei jedem Lauf („Kein eigener Freischaltweg“): Pro nur aus
  `pro/kauf.ts`, keine Lizenzschlüssel im Code, das Partner-Modul berührt den Pro-Status nie.

**[unsicher]** Ob Apple das Bewerben eines Partners in der App („Empfohlen von …“) als unzulässigen Hinweis auf einen
anderen Bezugsweg wertet, ist nicht geprüft. Der Text verweist ausdrücklich nur auf „Code einlösen“ (Apples Blatt) –
kein Link zu einem Kauf außerhalb des App Stores. Im Zweifel in den Prüfhinweisen für Apple erwähnen.

## 2. Wie eine Partner-Lizenz funktioniert

### 2.1 In App Store Connect anlegen

Quelle: [Set up subscription offer codes](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-subscription-offer-codes),
[Implementing offer codes in your app](https://developer.apple.com/documentation/storekit/implementing-offer-codes-in-your-app).

1. App Store Connect → App → Abonnements → Abo-Gruppe → Abo (z. B. Pro jährlich) → **Angebotscodes** → neues Angebot.
   Rollen: Account Holder, Admin, App Manager oder Marketing.
2. **Referenzname** je Partner und Kampagne wählen, z. B. `HWK-Musterstadt-2027-Q1` – er erscheint später in Belegen
   und in RevenueCat (Auswertung je Partner).
3. **Berechtigte Kunden** (beliebig kombinierbar): *neue* Abonnenten (nie in der Gruppe abonniert), *bestehende*
   (laufendes Abo, auch Billing Retry/Grace Period mit aktiver Verlängerung), *abgelaufene* (Verlängerung aus, Zeitraum
   vorbei). Für Partner meist: neu + abgelaufen. Jeder Kunde kann **einen Code je Angebot** einlösen.
4. **Angebot:** kostenlos, „Pay as you go“ oder „Pay up front“, mit Dauer. Ohne automatische Verlängerung nur
   „kostenlos“ – dann läuft das Abo nach der Gratiszeit aus statt zum Normalpreis weiterzulaufen (für Partner
   freundlicher, aber weniger Umsatz danach). **[unsicher]** Welche Dauern Apple für kostenlose Angebotscodes genau
   zulässt (z. B. 12 Monate), vor dem ersten Angebot in App Store Connect nachsehen.
5. **Länder:** Deutschland (und ggf. AT/CH) auswählen.
6. **Codes erzeugen:**
   - **Einmal-Codes:** Stapel von 500 bis 25.000 Codes, laufen **spätestens nach 6 Monaten** ab; einlösbar über
     Einlöse-Link, im App Store („Geschenkkarte oder Code einlösen“) und in der App. Voraussetzung: App ist
     „Bereit zum Verkauf“; neue Codes brauchen bis zu einer Stunde.
   - **Eigene Codes** wie `KAMMER2027` (bis 64 Zeichen, ohne Sonderzeichen): ein Code für viele Mitglieder, optional
     mit Höchstzahl an Einlösungen (bis 25.000 je Stapel) und Ablaufdatum (höchstens 6 Monate). Einlösbar über
     Einlöse-Link und in der App.
   - Grenzen: **1 Million Einlösungen je App und Quartal** (über alle Abos), **bis zu 10 aktive Angebote je Abo**. Ein
     Angebot lässt sich nach dem Anlegen nicht mehr ändern – bei Änderungen ein neues anlegen.
   - Für länger laufende Partnerschaften: alle 6 Monate einen neuen Stapel bzw. denselben eigenen Code mit späterem
     Ablaufdatum neu anlegen (Apple löst immer aus dem frühesten nicht abgelaufenen Stapel ein).

### 2.2 An den Partner geben

- Einmal-Codes als CSV aus App Store Connect herunterladen und dem Partner sicher übermitteln (verschlüsselt, nicht
  per offener Mail). Der Partner verteilt sie an seine Mitglieder (Mitgliederbereich, Rundschreiben).
- Eigene Codes (z. B. `KAMMER2027`) eignen sich für Rundschreiben und Magazine; Missbrauch über die Höchstzahl an
  Einlösungen begrenzen.
- Dazu den Partner-Code für „Empfohlen von …“ und den Deep Link `amtlos://partner/<code>` mitgeben (Abschnitt 3).

### 2.3 Einlösen durch das Mitglied

- In der App: **Mein Betrieb → „Code einlösen“** oder im Bezahlschirm („Code einlösen“ bzw. mit Partner „Dein Zugang
  über {Partner}: Code einlösen“). Die App zeigt Apples Einlöseblatt (StoreKit über RevenueCat
  `presentCodeRedemptionSheet`, iOS 14+); Apple prüft den Code, die App fragt danach die Berechtigung bei RevenueCat
  neu ab. Später eingelöste Codes kommen über die Kundendaten-Beobachtung (`addCustomerInfoUpdateListener`) und beim
  Wechsel in den Vordergrund an.
- Außerhalb der App: über den Einlöse-Link oder im App Store. Hat das Mitglied Betriebsklar noch nicht, bietet der App Store
  den Download an; beim ersten Start ist Pro schon da.
- Im Web, in Expo Go und im Testmodus zeigt „Code einlösen“ nur einen Hinweis (Code im App Store einlösen).

### 2.4 Abrechnung mit dem Partner

Apple stellt den Code kostenlos aus; Betriebsklar erhält für eingelöste Gratiscodes **keine** Zahlung über Apple. Die
Vergütung durch den Partner (z. B. Pauschale je Codestapel oder je Einlösung) ist ein **eigener Vertrag zwischen dir und
dem Partner außerhalb des App Stores**.

**[mit Anwalt/Steuerberater klären]**

- **Darf man Apples Angebotscodes an Dritte geben, die sie ihren Mitgliedern weitergeben – und darf der Partner dafür
  zahlen?** Apple beschreibt nur, dass du Codes „an deine Kunden verteilst“. Ob ein **Weiterverkauf** der Codes (Partner
  zahlt dir Geld für Codes, die Zugang zu einem In-App-Abo geben) mit dem Apple Developer Program License Agreement
  (u. a. Regeln zu In-App-Kauf und Promo-/Angebotscodes) vereinbar ist, ist **nicht geprüft**. Vorsichtige Gestaltung:
  der Partner zahlt für eine **Kooperation/Marketingleistung** (Nennung, Mitgliedervorteil), die Codes sind eine
  kostenlose Zugabe ohne Einzelpreis; Codes nie an Endkunden verkaufen lassen.
- Umsatzsteuer der Partnerzahlung (Leistungsort, Steuersatz, Rechnungsstellung), Behandlung der „Gratis-Abos“.
- Vertrag mit dem Partner: Laufzeit, Anzahl Codes, Logo-Nutzungsrecht (Marke des Partners in der App), Haftung,
  Datenschutz (es werden keine Mitgliederdaten ausgetauscht – so festhalten), Kündigung, was nach Ablauf der
  Gratiszeit passiert (Verlängerung zum Normalpreis nur, wenn das Angebot mit Verlängerung angelegt wurde).
- Ob eine Kammer (Körperschaft des öffentlichen Rechts) Betriebsklar überhaupt empfehlen/bezuschussen darf (Neutralität,
  Vergaberecht) – Sache des Partners, aber früh fragen.

### 2.5 Auswertung

RevenueCat zeigt eingelöste Angebotscodes (Referenzname) in den Transaktionen. **[unsicher]** Ob sich je Partner
automatisch auswerten lässt, wie viele Gratis-Abos danach in ein bezahltes Abo übergehen, im RevenueCat-Dashboard
prüfen (Filter nach Angebot). Die App selbst sendet nichts über Partner (Abschnitt 3.3).

## 3. „Empfohlen von …“ (Partner-Branding)

### 3.1 Was die App zeigt

- **Heute:** kleine Zeile oben auf dem Blatt „Empfohlen von {Partner}“ (mit Logo, wenn vorhanden).
- **Bezahlschirm:** „Empfohlen von {Partner}“ und der Knopf „Dein Zugang über {Partner}: Code einlösen“.
- **Mein Betrieb → Über Betriebsklar → Partner-Code:** Code eingeben (Groß-/Kleinschreibung und Leerzeichen am Rand egal),
  Partner ansehen (Hinweis, Link), **Partner entfernen**, Code einlösen.
- **Deep Link** `amtlos://partner/<code>`: Das Schema `amtlos` ist bereits registriert (Anmeldung); die App setzt einen
  bekannten Partner und meldet es. Kein neuer nativer Eintrag nötig. Unbekannte Codes: Hinweis, nichts wird gesetzt.

### 3.2 Partner hinzufügen

Die Partnerliste ist **im App-Code gebündelt** (`apps/mobile/src/partner/partner.ts` → `PARTNER`) und **absichtlich
leer**. Ein Partner kommt mit einer Vereinbarung und einem App-Update dazu – kein Laden aus dem Netz:

```ts
export const PARTNER: Record<string, Partner> = {
  "hwk-musterstadt": {
    name: "Handwerkskammer Musterstadt",
    kurz: "HWK Musterstadt",                       // für enge Stellen
    logo: require("../../assets/partner/hwk-musterstadt.png"), // oder "data:image/png;base64,…"
    link: "https://www.hwk-musterstadt.de/amtlos", // nur https
    hinweis: "Für Mitglieder: 12 Monate Pro über deinen Kammer-Code.",
  },
};
```

Die ID (= Partner-Code) ist klein geschrieben, 2–40 Zeichen aus `a–z`, `0–9`, `-`. Der Partner-Code ist **nicht** der
Apple-Angebotscode – er schaltet nie etwas frei. Endet eine Partnerschaft, Eintrag entfernen: gespeicherte IDs zeigen
dann einfach nichts mehr an.

### 3.3 Datenschutz

Die Partner-ID liegt im verschlüsselten Stand auf dem Gerät und in der verschlüsselten Datensicherung. Sie wird **nicht
synchronisiert** (`syncInhalt` lässt sie weg) und an niemanden gesendet – auch nicht an den Partner oder RevenueCat.
Deshalb ist am Datenschutzhinweis nichts zu ändern. **Wenn** später eine Auswertung je Partner über unseren Server oder
RevenueCat-Attribute dazukommen soll, Datenschutzhinweis und Privacy Manifest vorher anpassen.

Technik: Stand-Version 5 (Migration 4 → 5 setzt `partnerId` auf „nicht gesetzt“), Tests in
`apps/mobile/test/phase2-b2b.test.ts`.

## 4. Fachbibliothek

### 4.1 Was die Pakete enthalten

| Paket | Inhalt | Abhängigkeiten |
| --- | --- | --- |
| `@amtlos/fristen` | Datums- und Fristenrechnung, Feiertage je Bundesland, Bankarbeitstage, Perioden und Fälligkeiten, Verschiebung auf Werktage | keine |
| `@amtlos/rules-engine` | Auswertung eines Pflichten-Katalogs: dreiwertige Logik, Regelwerte zum Stichtag, Termine, Erklärungen, Rechtsänderungs-Radar | `@amtlos/fristen` |
| `@amtlos/fachlogik` | Rechnungssummen, XRechnung schreiben/lesen, GiroCode, Belege, Kasse, EÜR-Zuordnung, Vorlagen als HTML | `@amtlos/fristen`, `qrcode-generator` (MIT) |

Die Fristenlogik ist ein eigenes Paket (`packages/fristen`), nicht in der App. Alle drei sind frei von App-Code
(keine Importe aus `apps/*`, kein React/Expo/React Native, keine Node-APIs), ESM, mit Typen, `sideEffects: false`,
Lizenz `UNLICENSED`, je mit README und lauffähigem Beispiel (`beispiel/beispiel.mjs`).

**Nicht enthalten:** der **Pflichten-Katalog** (`catalog/`, Inhalte, Rechtsgrundlagen, Quellen). Ohne Katalog rechnet
die Rules-Engine nur mit eigenen Regeln des Kunden. Den Katalog als Datenprodukt mitzulizenzieren ist eine eigene
Entscheidung – **[mit Anwalt klären]**: Haftung für Inhalte, RDG (Weitergabe rechtlicher Einschätzungen an Dritte),
Aktualisierungspflichten.

### 4.2 Wie ein Kunde die Pakete nutzt

```sh
pnpm add ./amtlos-fristen-0.1.0.tgz ./amtlos-rules-engine-0.1.0.tgz ./amtlos-fachlogik-0.1.0.tgz
```

```js
import { StandardKalender } from "@amtlos/fristen";
import { auswerten } from "@amtlos/rules-engine";
import { summen } from "@amtlos/fachlogik";
```

Beispiele und Schnittstellen: `packages/*/README.md`.

### 4.3 Liefern und prüfen

- Tarballs bauen: im Paketordner `pnpm pack` (prepack leert `dist/` und baut neu; `workspace:*` wird durch die
  Versionsnummer ersetzt). Die Pakete bleiben `"private": true`, damit nichts versehentlich in die öffentliche
  npm-Registry gelangt; für eine private Registry dort `private` entfernen und `publishConfig` setzen.
- **Prüfung ohne CI:** `node werkzeuge/bibliothek-pruefen.mjs` – prüft Grenzen und Metadaten, führt die Tests je Paket
  aus, packt alle drei in einen Temp-Ordner, installiert sie **offline aus den Tarballs** in ein leeres Projekt, führt
  jedes Beispiel aus und übersetzt einen TypeScript-Verbraucher (strict, NodeNext). `--ohne-tests` überspringt die
  Tests, `--behalten` lässt den Temp-Ordner stehen.
- Versionen: vor jeder Lieferung `version` in allen drei `package.json` gemeinsam erhöhen (SemVer); die Pakete
  verweisen aufeinander mit genau dieser Version.

### 4.4 Offen für den Gründer

- **Lizenzvertrag** für die Bibliothek (Nutzungsumfang, Weitergabe, Quellcode – die Tarballs enthalten `src/` für
  funktionierende Source-Maps; wer das nicht will, `src` aus `files` nehmen und Source-Maps abschalten),
  Gewährleistung und Haftung für Rechenfehler – **[mit Anwalt klären]**.
- Preis- und Lieferform (Tarball per Vertrag, private Registry, Quellcode-Hinterlegung).
- Lizenzangabe: bewusst `UNLICENSED` (keine Lizenz erfunden). Nach Vertragsmuster ggf. `SEE LICENSE IN LICENSE.md`.
