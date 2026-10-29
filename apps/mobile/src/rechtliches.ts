import { MARKE } from "@amtlos/marke";
import { ANDROID } from "./plattform";
/**
 * Anbieterangaben und Rechtstexte der App (E-132). Vom Gründer auszufüllen – Amtlos erfindet keine Firmendaten.
 * Leere Angaben zeigt die App als „folgt“, und `werkzeuge/store-check.mjs` meldet sie vor dem Einreichen.
 */
export const ANBIETER = {
  /**
   * Firma mit Rechtsform, z. B. „Muster GmbH“. Bis zur Eintragung ins Handelsregister mit „i. G.“ (Vor-UG, persönliche
   * Haftung nach § 11 Abs. 2 GmbHG – Nachkontrolle Rechtsanwalt, E-160). Nach der Eintragung „ i. G.“ entfernen und
   * `register` füllen; docs/nutzungsbedingungen-entwurf.md Ziff. 1.1 gleich mit anpassen (die Website prüft das).
   */
  name: "Lang Ventures UG (haftungsbeschränkt) i. G.",
  /** Rechtsform ausgeschrieben – Impressum bei juristischen Personen (Vorprüfung 21.10.2026) */
  rechtsform: "Unternehmergesellschaft (haftungsbeschränkt)",
  /** Straße, PLZ, Ort – ladungsfähige Anschrift (§ 5 DDG) */
  anschrift: "Gomaringer Str. 33, 72770 Reutlingen",
  /** vertretungsberechtigte Person(en) */
  vertretung: "Lennard Lang (Geschäftsführer)",
  /** aus packages/marke/marke.json */
  email: MARKE.email,
  telefon: "",
  /** z. B. „Amtsgericht München, HRB 123456“ */
  register: "",
  ustIdNr: "",
};

export const LINKS = {
  /** Website des Anbieters (aus packages/marke/marke.json) – auch für „Erstellt mit …“ und Weiterempfehlen */
  website: MARKE.website,
  /** Datenschutzerklärung im Netz (Pflichtangabe im App Store) */
  datenschutz: MARKE.datenschutz,
  /** Android-Abschnitt derselben Seite – Datenschutz-URL in der Play Console (E-201, Rechtsanwalt: direkt verlinken) */
  datenschutzAndroid: `${MARKE.datenschutz}#android`,
  /** Support-Seite oder E-Mail-Link (Pflichtangabe im App Store) */
  support: MARKE.hilfe,
  /**
   * Nutzungsbedingungen: Apples Standard-Lizenzvertrag, solange keine eigenen AGB gelten. Bleibt auf dem iPhone so, bis
   * die eigenen Bedingungen in Kraft sind (`NUTZUNGSBEDINGUNGEN.freigegeben`); die App verlinkt über `nutzungsLink()`.
   */
  nutzung: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
  /** Abo-Verwaltung im App Store (E-205: Eintrag „Abo verwalten“ unter „Mein Betrieb“) */
  aboVerwaltenIos: "https://apps.apple.com/account/subscriptions",
  /** Abo-Verwaltung bei Google Play für dieses Paket (E-205, Abo-Richtlinie von Google Play: einfacher Weg zur Kündigung) */
  aboVerwaltenAndroid: `https://play.google.com/store/account/subscriptions?package=${MARKE.technisch.bundleId}`,
  /** App-Store-Seite, sobald die App veröffentlicht ist (Weiterempfehlen) */
  appStore: "",
  /** Seite bei Google Play, sobald die Android-App veröffentlicht ist (Weiterempfehlen auf Android, E-190) */
  googlePlay: "",
};

/** Store-Seite der laufenden Plattform für „Weiterempfehlen“ – leer, solange nicht veröffentlicht. */
export const storeLink = (android: boolean = ANDROID) => (android ? LINKS.googlePlay : LINKS.appStore);

/**
 * E-240: Ziel von „bitte App aktualisieren“ – die Store-Seite der App. Google Play kennt die Seite schon über den
 * Paketnamen; im App Store braucht sie die App-ID (LINKS.appStore, store-check meldet sie). Leer → nur Text, kein Link.
 */
export const aktualisierenLink = (android: boolean = ANDROID) => (android ? LINKS.googlePlay || `https://play.google.com/store/apps/details?id=${MARKE.technisch.bundleId}` : LINKS.appStore);

/** „Abo verwalten“ der laufenden Plattform (E-205): Abo-Seite des App Store bzw. von Google Play für dieses Paket. */
export const aboVerwaltenLink = (android: boolean = ANDROID) => (android ? LINKS.aboVerwaltenAndroid : LINKS.aboVerwaltenIos);

/**
 * Zuständige Datenschutz-Aufsichtsbehörde des Anbieters (Art. 13 Abs. 2 lit. d, Art. 77 DSGVO): richtet sich nach dem
 * Sitz in ANBIETER.anschrift (Reutlingen, Baden-Württemberg). Name und Anschrift laut Adressliste der BfDI (abgerufen
 * 21.10.2026). Zieht der Sitz um, hier anpassen – `test/phase-recht-vorpruefung.test.ts` prüft den Ort.
 */
export const AUFSICHTSBEHOERDE = {
  name: "Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg",
  anschrift: "Lautenschlagerstraße 20, 70173 Stuttgart",
  /** Bundesland des Sitzes, aus dem die Zuständigkeit folgt */
  land: "Baden-Württemberg",
};

/** Fundstelle der Standardvertragsklauseln (Vorprüfung 21.10.2026, Abschnitt 8) – Text im Amtsblatt und im DPA von RevenueCat. */
export const SCC_FUNDSTELLE = "Standardvertragsklauseln der EU-Kommission (Durchführungsbeschluss (EU) 2021/914, Modul 2), Art. 46 Abs. 2 lit. c DSGVO";
/** Auftragsverarbeitungsvertrag von RevenueCat (Data Processing Addendum, Fassung August 2026) */
export const REVENUECAT_DPA = "https://www.revenuecat.com/dpa";
const RECHTE_BESCHWERDE = `Zuständige Aufsichtsbehörde für uns: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.anschrift}. Du kannst dich auch an die Aufsichtsbehörde an deinem Wohnort oder Arbeitsplatz wenden.`;
const DRITTLAND_REVENUECAT = `Übermittlung in die USA auf Grundlage der ${SCC_FUNDSTELLE}, die RevenueCat in seinem Auftragsverarbeitungsvertrag vereinbart (${REVENUECAT_DPA}); der Text der Klauseln steht im Amtsblatt der EU (ABl. L 199 vom 7.6.2021, S. 31) und in diesem Vertrag.`;

/**
 * Datenschutzhinweis der App. Beschreibt, was die App technisch tut (Stand des Codes), gegliedert nach Art. 13 DSGVO
 * (R10): Zwecke, Rechtsgrundlagen, Empfänger, Drittland, Speicherdauer, Bereitstellung, automatisierte Entscheidungen,
 * Rechte. Verantwortlicher und Kontakt kommen aus ANBIETER (App: „Datenschutz“, Website: datenschutz.html). Platzhalter
 * in eckigen Klammern trägt der Gründer vor der Veröffentlichung ein – die App erfindet keine Angaben, der Store-Check
 * meldet sie. Fachlich zu prüfen (T-77): bis zur Freigabe `freigegeben: false`.
 */
// Freigegeben von Rechtsanwalt 23.10.2026 für den Build ohne Sync (beim Gründer, Prüfsumme
// 892aa8818e0e der Fassung aus docs/pruefmappe-anwalt). Bei Textänderung erneut vorlegen; der Sync-Zusatz ist nicht freigegeben.
export const DATENSCHUTZ = {
  freigegeben: true,
  abschnitte: [
    { titel: "Kurz gesagt", text: `${MARKE.name} speichert deine Angaben nur auf deinem iPhone – verschlüsselt, ohne Konto und ohne Server von ${MARKE.name}. Wir sehen deine Unterlagen, Kunden und Mitarbeiter nicht. ${MARKE.name} macht keine eigenen Analysen und zeigt keine Werbung; nur für ${MARKE.proName} wertet unser Dienstleister RevenueCat die Käufe für die Abo-Verwaltung aus.` },
    { titel: "Was auf dem iPhone liegt", text: `Betrieb, Unterlagen, Rechnungen, Belege mit Fotos und Dateien, Mitarbeiter- und Kundendaten sowie deine Antworten im Pflichten-Check. Die Daten sind mit AES-256 verschlüsselt; der Schlüssel liegt im Schlüsselbund dieses iPhones. Diese Daten verarbeitest du selbst – ${MARKE.name} erhält sie nicht. Wenn du die App löschst, sind die Daten weg – außer in einer Sicherung, die du selbst erstellt hast.` },
    { titel: "Sicherungen", text: `Eine Sicherung ist eine Datei, die ${MARKE.name} mit deinem Passwort verschlüsselt. Du entscheidest, wo du sie ablegst (z. B. Dateien, iCloud Drive). Die automatische iCloud-Sicherung legt dieselbe verschlüsselte Datei in deinem iCloud Drive ab. Für iCloud ist Apple eigener Verantwortlicher; es gelten die Datenschutzbestimmungen von Apple.` },
    // Push über einen Server (APNs, Expo Push) gibt es nicht (T-41). Kommt er dazu: eigenen Abschnitt ergänzen
    // (Geräte-Token, Empfänger Apple, Rechtsgrundlage, Speicherdauer) und das Privacy Manifest anpassen.
    { titel: "Erinnerungen", text: `Erinnerungen an Fristen plant das iPhone selbst als lokale Mitteilungen. Dafür wird nichts an ${MARKE.name} gesendet; Push-Mitteilungen über einen Server nutzt die App nicht.` },
    { titel: MARKE.proName, text: `Käufe laufen über deinen Apple-Account; für App Store und Bezahlung ist Apple eigener Verantwortlicher. Damit die App weiß, ob Pro aktiv ist, verarbeitet RevenueCat, Inc. (USA) als unser Auftragsverarbeiter eine zufällige App-Kennung und deine Kaufbelege von Apple – keine Unterlagen, keine Namen. RevenueCat wertet die Käufe für die Abo-Verwaltung aus (z. B. Verlängerung, Kündigung, Probezeitraum); eigene Analysen macht ${MARKE.name} damit nicht.` },
    { titel: "Rechtsgrundlagen", text: `Abo-Status prüfen und das Abo verwalten: Art. 6 Abs. 1 lit. b DSGVO (Vertrag über ${MARKE.proName}). Speichern und Lesen auf deinem iPhone, soweit für die App nötig (Schlüsselbund, Einstellungen): § 25 Abs. 2 Nr. 2 TDDDG. Sicherung in iCloud Drive nur, wenn du sie einschaltest.` },
    // Data Privacy Framework (Art. 45 DSGVO) nur nennen, wenn RevenueCat auf der DPF-Liste steht – am 21.10.2026 nicht
    // belegbar (DPA und Datenschutzerklärung von RevenueCat nennen es nicht); bis dahin nur die Standardvertragsklauseln.
    { titel: "Empfänger und Drittland", text: `RevenueCat, Inc., USA (Auftragsverarbeiter nach Art. 28 DSGVO, nur Kennung und Kaufbelege). ${DRITTLAND_REVENUECAT} Apple ist für App Store, Käufe und iCloud eigener Verantwortlicher. Sonst erhält niemand Daten aus der App – außer dem, was du selbst teilst.` },
    // Eine feste Frist nach Abo-Ende ist noch nicht entschieden (Produktentscheidung, Löschung über die RevenueCat-API) –
    // bis dahin nur, was stimmt; keine erfundene Zahl.
    { titel: "Speicherdauer", text: "Auf dem iPhone: bis du die Daten in der App löschst oder die App entfernst. Bei RevenueCat: solange dein Abo besteht. Spätestens vier Monate nach Ende deines Abos lassen wir die Daten zu deiner App-Kennung bei RevenueCat löschen – früher, wenn du die Löschung verlangst. Die Zeit danach brauchen wir für Erstattungen und Rückbuchungen über Apple. Endet unser Vertrag, löscht RevenueCat die Daten oder gibt sie auf unsere Anforderung zurück; Sicherungskopien nach den Sicherungs- und Archivierungsroutinen von RevenueCat." },
    { titel: "Musst du Daten angeben?", text: `Nein. Die App funktioniert ohne Angaben an ${MARKE.name}. Nur für ${MARKE.proName} ist die Prüfung des Kaufs über RevenueCat nötig – ohne sie lässt sich Pro nicht nutzen.` },
    { titel: "Keine automatisierte Entscheidung", text: "Es gibt keine automatisierte Entscheidung und kein Profiling im Sinne von Art. 22 DSGVO. Der Pflichten-Check rechnet auf deinem iPhone und zeigt, welche Pflichten nach deinen Angaben in Frage kommen – er entscheidet nichts über dich." },
    // „Kanzlei deiner Wahl“ stimmt auch ohne gelistete Partnerkanzlei (docs/15): Daten gehen nur über das eigene Teilen
    { titel: "Was du teilst", text: "PDFs, E-Rechnungen, Pakete für die Steuerberatung und Sicherungen verlassen das iPhone nur, wenn du sie selbst teilst – an wen, entscheidest du im Teilen-Menü, auch an eine Kanzlei deiner Wahl. Die Kanzlei verarbeitet, was du ihr sendest, als eigener Verantwortlicher." },
    { titel: "Deine Rechte", text: `Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 15 ff., 77 DSGVO). Da ${MARKE.name} deine Unterlagen nicht speichert, löschst du sie selbst unter „Mein Betrieb“. Für alles andere: Kontakt beim Verantwortlichen oben. ${RECHTE_BESCHWERDE}` },
  ],
};

/**
 * Zusatz für Builds mit Synchronisation (E-134, `EXPO_PUBLIC_API_URL` gesetzt). Ersetzt „Kurz gesagt“ und kommt nach
 * „Sicherungen“. Fachlich zu prüfen (T-80): Hoster des Servers, Identity-Provider, Auftragsverarbeitung, Aufbewahrung der
 * Server-Backups. Vorprüfung 21.10.2026 (Frage 9): Metadaten und Konto-Daten sind für uns personenbezogen (EuGH
 * C-413/23 P) – vor dem Sync-Build einen AVV mit dem Betrieb anbieten (docs/12 §2).
 */
export const DATENSCHUTZ_SYNC = {
  kurz: { titel: "Kurz gesagt", text: `${MARKE.name} speichert deine Angaben verschlüsselt auf deinem iPhone. Nutzt du die Synchronisation, liegen sie zusätzlich auf einem Server von ${MARKE.name} – Ende-zu-Ende-verschlüsselt, sodass wir deine Unterlagen, Kunden und Mitarbeiter nicht lesen können. ${MARKE.name} macht keine eigenen Analysen; nur für ${MARKE.proName} wertet RevenueCat die Käufe für die Abo-Verwaltung aus.` },
  teilen: { titel: "Was du teilst", text: `PDFs, E-Rechnungen, Pakete für die Steuerberatung und Sicherungen verlassen das iPhone nur, wenn du sie selbst teilst – an wen, entscheidest du im Teilen-Menü, auch an eine Kanzlei deiner Wahl. Die Kanzlei verarbeitet, was du ihr sendest, als eigener Verantwortlicher. Mit der Synchronisation gehen deine Daten zusätzlich Ende-zu-Ende-verschlüsselt an den Server von ${MARKE.name}.` },
  rechte: { titel: "Deine Rechte", text: `Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 15 ff., 77 DSGVO). Deine Daten auf dem Gerät löschst du unter „Mein Betrieb“; die Daten auf dem Server löschst du mit „Synchronisation beenden“ oder „Konto löschen“. ${RECHTE_BESCHWERDE}` },
  empfaenger: { titel: "Empfänger und Drittland", text: `RevenueCat, Inc., USA (Auftragsverarbeiter nach Art. 28 DSGVO, nur Kennung, Konto-Kennung und Kaufbelege). ${DRITTLAND_REVENUECAT} Für die Synchronisation: Hoster des Servers und Anmeldedienst [vor Veröffentlichung eintragen]. Apple ist für App Store, Käufe und iCloud eigener Verantwortlicher.` },
  abschnitt: { titel: "Konto und Synchronisation", text: `Nur wenn du dich anmeldest: Für dein Konto verarbeiten wir deine E-Mail-Adresse, deinen Namen beim Anmeldedienst und eine Konto-Kennung (Art. 6 Abs. 1 lit. b DSGVO). Was synchronisiert wird (Betrieb, Unterlagen, Belege mit Fotos, Personen), verschlüsselt die App vor dem Senden mit einem Schlüssel, den nur dein Sync-Passwort öffnet; der Server speichert nur diesen verschlüsselten Inhalt, Dateinamen, Größe und Zeitpunkte. „Synchronisation beenden“ löscht alles auf dem Server, „Konto löschen“ zusätzlich dein Konto; aus den Sicherungskopien des Servers verschwinden gelöschte Daten nach [vor Veröffentlichung eintragen]. Mit ${MARKE.proName} ordnet RevenueCat deinen Kauf der Konto-Kennung zu.` },
};

/**
 * Datenschutzhinweis der Android-App (E-190): gleicher Aufbau wie der von Rechtsanwalt freigegebene iPhone-Text (oben,
 * unverändert), nur dort geändert, wo die Android-App technisch etwas anderes tut – Google Play statt App Store (Kauf über
 * das Google-Konto, Kaufbelege von Google Play bei RevenueCat), automatische Sicherung in einen selbst gewählten Ordner
 * (Speicherzugriffs-Framework von Android) statt iCloud, Android-Schlüsselspeicher statt Schlüsselbund, keine
 * Gerätesicherung durch Android (`allowBackup: false`); Gegenüberstellung in docs/datenschutz-android-entwurf.md.
 */
// Freigegeben von Rechtsanwalt 26.10.2026 für den Build ohne Sync (E-201; Mail beim Gründer) – für die Fassung, die dem
// freigegebenen iPhone-Text (892aa8818e0e) mit genau den im Entwurf aufgeführten Android-Änderungen entspricht, mit seiner
// Formulierung zum Sicherungsordner (Abschnitte „Sicherungen“ sowie „Empfänger und Drittland“, wörtlich übernommen).
// Prüfsumme dieser Fassung: SHA-256 über „## Titel\n\nText\n“ aller Abschnitte, 12 Zeichen = DATENSCHUTZ_ANDROID_PRUEFSUMME
// (test/e201-rueckmeldungen.test.ts rechnet nach). Bei Textänderung erneut vorlegen; der Sync-Zusatz ist nicht freigegeben.
// E-202: zweite Bestätigung des Rechtsanwalts vom 26.10.2026 für genau diese Prüfsumme (Mail beim Gründer) – unter der
// Voraussetzung, dass der Release-Build keine Verbindung zu Google-Diensten aufbaut (Firebase aus expo-notifications;
// sonst Bibliothek entfernen oder Hinweis erweitern). Startblocker in werkzeuge/store-check.mjs (Google Play), PRUEFLISTE
// T-226. Die In-App-Bewertung muss der Hinweis nicht nennen.
export const DATENSCHUTZ_ANDROID_ZWEITE_BESTAETIGUNG = { datum: "2026-10-26", rolle: "recht", pruefsumme: "c6b45a804f10", voraussetzung: "Release-Build ohne Verbindung zu Google-Diensten (Firebase)", aufbewahrung: "beim Gründer" } as const;
export const DATENSCHUTZ_ANDROID_PRUEFSUMME = "c6b45a804f10";
export const DATENSCHUTZ_ANDROID = {
  freigegeben: true,
  abschnitte: [
    { titel: "Kurz gesagt", text: `${MARKE.name} speichert deine Angaben nur auf deinem Smartphone – verschlüsselt, ohne Konto und ohne Server von ${MARKE.name}. Wir sehen deine Unterlagen, Kunden und Mitarbeiter nicht. ${MARKE.name} macht keine eigenen Analysen und zeigt keine Werbung; nur für ${MARKE.proName} wertet unser Dienstleister RevenueCat die Käufe für die Abo-Verwaltung aus.` },
    { titel: "Was auf dem Smartphone liegt", text: `Betrieb, Unterlagen, Rechnungen, Belege mit Fotos und Dateien, Mitarbeiter- und Kundendaten sowie deine Antworten im Pflichten-Check. Die Daten sind mit AES-256 verschlüsselt; der Schlüssel liegt im Android-Schlüsselspeicher dieses Smartphones. Die Gerätesicherung von Android nimmt diese Daten nicht mit. Diese Daten verarbeitest du selbst – ${MARKE.name} erhält sie nicht. Wenn du die App löschst, sind die Daten weg – außer in einer Sicherung, die du selbst erstellt hast.` },
    { titel: "Sicherungen", text: `Eine Sicherung ist eine Datei, die ${MARKE.name} mit deinem Passwort verschlüsselt. Du entscheidest, wo du sie ablegst. Die automatische Sicherung legt dieselbe verschlüsselte Datei in einem Ordner ab, den du einmal über die Ordnerauswahl von Android wählst (z. B. auf dem Smartphone, in Google Drive oder Nextcloud); ${MARKE.name} erhält dabei nur Zugriff auf diesen Ordner. Liegt der Ordner bei einem Cloud-Anbieter, gelten für die Speicherung die Vereinbarungen zwischen dir und diesem Anbieter; die Datei ist mit deinem Passwort verschlüsselt, und wir haben keinen Zugriff darauf.` },
    { titel: "Erinnerungen", text: `Erinnerungen an Fristen plant das Smartphone selbst als lokale Benachrichtigungen. Dafür wird nichts an ${MARKE.name} gesendet; Push-Mitteilungen über einen Server nutzt die App nicht.` },
    { titel: MARKE.proName, text: `Käufe laufen über dein Google-Konto bei Google Play; für Google Play und die Bezahlung ist Google eigener Verantwortlicher. Damit die App weiß, ob Pro aktiv ist, verarbeitet RevenueCat, Inc. (USA) als unser Auftragsverarbeiter eine zufällige App-Kennung und deine Kaufbelege von Google Play – keine Unterlagen, keine Namen. RevenueCat wertet die Käufe für die Abo-Verwaltung aus (z. B. Verlängerung, Kündigung, Probezeitraum); eigene Analysen macht ${MARKE.name} damit nicht.` },
    { titel: "Rechtsgrundlagen", text: `Abo-Status prüfen und das Abo verwalten: Art. 6 Abs. 1 lit. b DSGVO (Vertrag über ${MARKE.proName}). Speichern und Lesen auf deinem Smartphone, soweit für die App nötig (Schlüsselspeicher, Einstellungen): § 25 Abs. 2 Nr. 2 TDDDG. Automatische Sicherung in einen Ordner nur, wenn du sie einschaltest.` },
    { titel: "Empfänger und Drittland", text: `RevenueCat, Inc., USA (Auftragsverarbeiter nach Art. 28 DSGVO, nur Kennung und Kaufbelege). ${DRITTLAND_REVENUECAT} Google ist für Google Play und Käufe eigener Verantwortlicher. Wo du deine Sicherung ablegst, entscheidest du; wir übermitteln sie nicht. Sonst erhält niemand Daten aus der App – außer dem, was du selbst teilst.` },
    { titel: "Speicherdauer", text: "Auf dem Smartphone: bis du die Daten in der App löschst oder die App entfernst. Bei RevenueCat: solange dein Abo besteht. Spätestens vier Monate nach Ende deines Abos lassen wir die Daten zu deiner App-Kennung bei RevenueCat löschen – früher, wenn du die Löschung verlangst. Die Zeit danach brauchen wir für Erstattungen und Rückbuchungen über Google Play. Endet unser Vertrag, löscht RevenueCat die Daten oder gibt sie auf unsere Anforderung zurück; Sicherungskopien nach den Sicherungs- und Archivierungsroutinen von RevenueCat." },
    { titel: "Musst du Daten angeben?", text: `Nein. Die App funktioniert ohne Angaben an ${MARKE.name}. Nur für ${MARKE.proName} ist die Prüfung des Kaufs über RevenueCat nötig – ohne sie lässt sich Pro nicht nutzen.` },
    { titel: "Keine automatisierte Entscheidung", text: "Es gibt keine automatisierte Entscheidung und kein Profiling im Sinne von Art. 22 DSGVO. Der Pflichten-Check rechnet auf deinem Smartphone und zeigt, welche Pflichten nach deinen Angaben in Frage kommen – er entscheidet nichts über dich." },
    { titel: "Was du teilst", text: "PDFs, E-Rechnungen, Pakete für die Steuerberatung und Sicherungen verlassen das Smartphone nur, wenn du sie selbst teilst – an wen, entscheidest du im Teilen-Menü, auch an eine Kanzlei deiner Wahl. Die Kanzlei verarbeitet, was du ihr sendest, als eigener Verantwortlicher." },
    { titel: "Deine Rechte", text: `Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 15 ff., 77 DSGVO). Da ${MARKE.name} deine Unterlagen nicht speichert, löschst du sie selbst unter „Mein Betrieb“. Für alles andere: Kontakt beim Verantwortlichen oben. ${RECHTE_BESCHWERDE}` },
  ],
};

/** Sync-Zusatz in der Android-Fassung (nicht freigegeben, wie auf dem iPhone): nur die Gerätewörter und Google statt Apple. */
const androidWorte = (a: { titel: string; text: string }) => ({ titel: a.titel, text: a.text.replace(/iPhone/g, "Smartphone").replace("Apple ist für App Store, Käufe und iCloud eigener Verantwortlicher.", "Google ist für Google Play und Käufe eigener Verantwortlicher.") });

/** Gilt der Datenschutzhinweis der laufenden App als freigegeben? (Android: Entwurf bis zur Freigabe, E-190) */
export const datenschutzFreigegeben = (android: boolean = ANDROID) => (android ? DATENSCHUTZ_ANDROID.freigegeben : DATENSCHUTZ.freigegeben);

/** Abschnitte des Datenschutzhinweises – mit Synchronisation ergänzt; auf Android die Android-Fassung (E-190). */
export function datenschutzAbschnitte(sync: boolean, android: boolean = ANDROID) {
  const basis = android ? DATENSCHUTZ_ANDROID.abschnitte : DATENSCHUTZ.abschnitte;
  if (!sync) return basis;
  const z = android ? { kurz: androidWorte(DATENSCHUTZ_SYNC.kurz), teilen: androidWorte(DATENSCHUTZ_SYNC.teilen), rechte: DATENSCHUTZ_SYNC.rechte, empfaenger: androidWorte(DATENSCHUTZ_SYNC.empfaenger) } : DATENSCHUTZ_SYNC;
  const ersatz: Record<string, { titel: string; text: string }> = { "Kurz gesagt": z.kurz, "Was du teilst": z.teilen, "Deine Rechte": z.rechte, "Empfänger und Drittland": z.empfaenger };
  const l = basis.map((a) => ersatz[a.titel] ?? a);
  const i = l.findIndex((a) => a.titel === "Sicherungen");
  l.splice(i + 1, 0, DATENSCHUTZ_SYNC.abschnitt);
  return l;
}

/** Platzhalter im Datenschutzhinweis, die vor der Veröffentlichung eingetragen werden müssen (Store-Check). */
export const PLATZHALTER_RECHT = "[vor Veröffentlichung eintragen]";

/**
 * Eigene Nutzungsbedingungen (docs/nutzungsbedingungen-entwurf.md): seit E-205 die gemeinsame Fassung für iPhone und
 * Android, vom Rechtsanwalt am 26.10.2026 inhaltlich freigegeben (`NUTZUNGSBEDINGUNGEN_BESTAETIGUNG`), aber **nicht in
 * Kraft** – in Kraft erst nach der Eintragung der UG (Registerangaben und USt-IdNr. in Ziffer 1.1 und `ANBIETER`, ohne
 * „i. G.“, Datum der Veröffentlichung in „Fassung vom …“ und in `fassung`), dann `freigegeben: true`.
 *
 * Solange `freigegeben` false ist: Die iPhone-App verlinkt Apples Standard-EULA (`LINKS.nutzung`), die Android-App diese
 * Fassung als Entwurf (Apples EULA gilt bei Google Play nicht); die Website zeigt nutzungsbedingungen.html als „Entwurf –
 * noch nicht in Kraft“, und die Zustimmung beim ersten Start (§ 305 Abs. 2 BGB, `zustimmungNoetig`) ist aus.
 * Mit `freigegeben: true` fragt die App jeden Nutzer einmal und bei jeder neuen `fassung` erneut. `fassung` muss zum
 * Datum „Fassung vom …“ im Dokument passen (Website-Build und Test); bis zur Veröffentlichung steht dort der Platzhalter
 * des Rechtsanwalts „[Datum der Veröffentlichung]“ und `fassung` ist leer.
 */
export const NUTZUNGSBEDINGUNGEN = {
  freigegeben: false,
  /** Datum der Fassung (ISO) – eine neue Fassung fragt erneut nach der Zustimmung; leer bis zur Veröffentlichung (E-205) */
  // Rechtsanwalt 26.10.2026: gemeinsame Fassung mit neuem Fassungsdatum (ersetzt die iPhone-Fassung vom 23.10.2026); das
  // Datum setzt erst die Inkraftsetzung nach der Eintragung der UG (PRUEFLISTE T-235).
  fassung: "",
  /** Adresse auf der Website (apps/website/bauen.mjs schreibt nutzungsbedingungen.html) – eine Seite für beide Apps */
  url: `${MARKE.website}/nutzungsbedingungen.html`,
};
export type NutzungsbedingungenStand = { freigegeben: boolean; fassung: string; url: string };

/**
 * Inhaltliche Freigabe der gemeinsamen Fassung durch den Rechtsanwalt (E-205; Mail beim Gründer). Umfang: der Klauseltext
 * in docs/nutzungsbedingungen-entwurf.md; Prüfsumme = SHA-256 über die Absätze ohne Arbeitsnotizen, ohne Ziffer 1.1 und
 * ohne die Zeile „Fassung vom …“ (verbunden mit Leerzeile, mit Zeilenende), 12 Zeichen – test/e205-nutzungsbedingungen.test.ts
 * rechnet nach. Die Inkraftsetzung (Ziffer 1.1, Fassungsdatum) ändert die Prüfsumme nicht; jede andere Änderung schon.
 */
export const NUTZUNGSBEDINGUNGEN_PRUEFSUMME = "3b1c5a0ba3f9";
export const NUTZUNGSBEDINGUNGEN_BESTAETIGUNG = { art: "mail", datum: "2026-10-26", rolle: "recht", pruefsumme: NUTZUNGSBEDINGUNGEN_PRUEFSUMME, umfang: "gemeinsame Fassung für iPhone und Android; in Kraft erst nach Eintragung der UG", aufbewahrung: "beim Gründer" } as const;

/**
 * Link „Nutzungsbedingungen“ in der App: in Kraft die eigenen auf beiden Plattformen. Bis dahin auf dem iPhone Apples
 * Standard-EULA; auf Android (E-205) die gemeinsame Fassung als Entwurf – Apples EULA gilt dort nicht, und Google Play
 * hat keine Standard-EULA (vorher, E-190: kein Link).
 */
export const nutzungsLink = (nb: NutzungsbedingungenStand = NUTZUNGSBEDINGUNGEN, android: boolean = ANDROID) => (nb.freigegeben || android ? nb.url : LINKS.nutzung);

/** Gespeicherte Zustimmung zu den Nutzungsbedingungen (im Stand, nur auf dem Gerät und in der Sicherung). */
export interface Zustimmung {
  /** zugestimmte Fassung (NUTZUNGSBEDINGUNGEN.fassung) */
  fassung: string;
  /** Zeitpunkt der Zustimmung (ISO) */
  zeitpunkt: string;
}

/**
 * Muss die App nach der Zustimmung fragen? Nur, wenn die eigenen Bedingungen freigegeben sind und noch keine Zustimmung
 * zu genau dieser Fassung gespeichert ist. Bei `freigegeben: false` nie – der Start bleibt, wie er ist.
 */
export function zustimmungNoetig(z: Zustimmung | undefined, nb: NutzungsbedingungenStand = NUTZUNGSBEDINGUNGEN): boolean {
  return nb.freigegeben && z?.fassung !== nb.fassung;
}

/** Zustimmung aus einem gespeicherten Stand lesen – Unlesbares ergibt „keine Zustimmung“ (dann wird erneut gefragt). */
export function zustimmungAus(roh: unknown): Zustimmung | undefined {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return undefined;
  const r = roh as Record<string, unknown>;
  if (typeof r.fassung !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.fassung)) return undefined;
  if (typeof r.zeitpunkt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(r.zeitpunkt)) return undefined;
  return { fassung: r.fassung, zeitpunkt: r.zeitpunkt };
}

export const anbieterVollstaendig = () => Boolean(ANBIETER.name && ANBIETER.anschrift && ANBIETER.email && ANBIETER.vertretung);

/**
 * Wohin „Hilfe & Kontakt“ führt: die Support-Seite, sonst die E-Mail-Adresse des Anbieters (sobald eingetragen) –
 * nie eine erfundene Adresse. Ohne beides entfällt die Zeile; der Store-Check meldet die fehlende Support-URL.
 */
export function hilfeZiel(support: string, email: string): string {
  if (support) return support;
  return email ? `mailto:${email}` : "";
}
