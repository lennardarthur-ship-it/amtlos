/**
 * Anbieterangaben und Rechtstexte der App (E-132). Vom Gründer auszufüllen – Amtlos erfindet keine Firmendaten.
 * Leere Angaben zeigt die App als „folgt“, und `werkzeuge/store-check.mjs` meldet sie vor dem Einreichen.
 */
export const ANBIETER = {
  /** Firma mit Rechtsform, z. B. „Amtlos GmbH“ */
  name: "",
  /** Straße, PLZ, Ort – ladungsfähige Anschrift (§ 5 DDG) */
  anschrift: "",
  /** vertretungsberechtigte Person(en) */
  vertretung: "",
  email: "",
  telefon: "",
  /** z. B. „Amtsgericht München, HRB 123456“ */
  register: "",
  ustIdNr: "",
};

export const LINKS = {
  /** Website des Anbieters, z. B. „https://amtlos.de“ – auch für „Erstellt mit Amtlos“ und Weiterempfehlen */
  website: "",
  /** Datenschutzerklärung im Netz (Pflichtangabe im App Store) */
  datenschutz: "",
  /** Support-Seite oder E-Mail-Link (Pflichtangabe im App Store) */
  support: "",
  /** Nutzungsbedingungen: Apples Standard-Lizenzvertrag, solange keine eigenen AGB gelten */
  nutzung: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
  /** App-Store-Seite, sobald die App veröffentlicht ist (Weiterempfehlen) */
  appStore: "",
};

/**
 * Datenschutzhinweis der App. Beschreibt, was die App technisch tut (Stand des Codes), gegliedert nach Art. 13 DSGVO
 * (R10): Zwecke, Rechtsgrundlagen, Empfänger, Drittland, Speicherdauer, Bereitstellung, automatisierte Entscheidungen,
 * Rechte. Verantwortlicher und Kontakt kommen aus ANBIETER (App: „Datenschutz“, Website: datenschutz.html). Platzhalter
 * in eckigen Klammern trägt der Gründer vor der Veröffentlichung ein – die App erfindet keine Angaben, der Store-Check
 * meldet sie. Fachlich zu prüfen (T-77): bis zur Freigabe `freigegeben: false`.
 */
export const DATENSCHUTZ = {
  freigegeben: false,
  abschnitte: [
    { titel: "Kurz gesagt", text: "Amtlos speichert deine Angaben nur auf deinem iPhone – verschlüsselt, ohne Konto und ohne Server von Amtlos. Wir sehen deine Unterlagen, Kunden und Mitarbeiter nicht. Amtlos macht keine eigenen Analysen und zeigt keine Werbung; nur für Amtlos Pro wertet unser Dienstleister RevenueCat die Käufe für die Abo-Verwaltung aus." },
    { titel: "Was auf dem iPhone liegt", text: "Betrieb, Unterlagen, Rechnungen, Belege mit Fotos und Dateien, Mitarbeiter- und Kundendaten sowie deine Antworten im Pflichten-Check. Die Daten sind mit AES-256 verschlüsselt; der Schlüssel liegt im Schlüsselbund dieses iPhones. Diese Daten verarbeitest du selbst – Amtlos erhält sie nicht. Wenn du die App löschst, sind die Daten weg – außer in einer Sicherung, die du selbst erstellt hast." },
    { titel: "Sicherungen", text: "Eine Sicherung ist eine Datei, die Amtlos mit deinem Passwort verschlüsselt. Du entscheidest, wo du sie ablegst (z. B. Dateien, iCloud Drive). Die automatische iCloud-Sicherung legt dieselbe verschlüsselte Datei in deinem iCloud Drive ab. Für iCloud ist Apple eigener Verantwortlicher; es gelten die Datenschutzbestimmungen von Apple." },
    { titel: "Erinnerungen", text: "Erinnerungen an Fristen plant das iPhone selbst als lokale Mitteilungen. Dafür wird nichts an Amtlos gesendet." },
    { titel: "Amtlos Pro", text: "Käufe laufen über deinen Apple-Account; für App Store und Bezahlung ist Apple eigener Verantwortlicher. Damit die App weiß, ob Pro aktiv ist, verarbeitet RevenueCat, Inc. (USA) als unser Auftragsverarbeiter eine zufällige App-Kennung und deine Kaufbelege von Apple – keine Unterlagen, keine Namen. RevenueCat wertet die Käufe für die Abo-Verwaltung aus (z. B. Verlängerung, Kündigung, Probezeitraum); eigene Analysen macht Amtlos damit nicht." },
    { titel: "Rechtsgrundlagen", text: "Abo-Status prüfen und das Abo verwalten: Art. 6 Abs. 1 lit. b DSGVO (Vertrag über Amtlos Pro). Speichern und Lesen auf deinem iPhone, soweit für die App nötig (Schlüsselbund, Einstellungen): § 25 Abs. 2 Nr. 2 TDDDG. Sicherung in iCloud Drive nur, wenn du sie einschaltest." },
    { titel: "Empfänger und Drittland", text: "RevenueCat, Inc., USA (Auftragsverarbeiter nach Art. 28 DSGVO, nur Kennung und Kaufbelege). Übermittlung in die USA auf Grundlage der Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO), die RevenueCat in seinem Auftragsverarbeitungsvertrag vereinbart. Apple ist für App Store, Käufe und iCloud eigener Verantwortlicher. Sonst erhält niemand Daten aus der App – außer dem, was du selbst teilst." },
    { titel: "Speicherdauer", text: "Auf dem iPhone: bis du die Daten in der App löschst oder die App entfernst. Bei RevenueCat: für die Dauer unseres Vertrags mit RevenueCat; danach löscht RevenueCat die Daten oder gibt sie zurück, Sicherungskopien nach den Löschroutinen von RevenueCat." },
    { titel: "Musst du Daten angeben?", text: "Nein. Die App funktioniert ohne Angaben an Amtlos. Nur für Amtlos Pro ist die Prüfung des Kaufs über RevenueCat nötig – ohne sie lässt sich Pro nicht nutzen." },
    { titel: "Keine automatisierte Entscheidung", text: "Es gibt keine automatisierte Entscheidung und kein Profiling im Sinne von Art. 22 DSGVO. Der Pflichten-Check rechnet auf deinem iPhone und zeigt, welche Pflichten nach deinen Angaben in Frage kommen – er entscheidet nichts über dich." },
    { titel: "Was du teilst", text: "PDFs, E-Rechnungen und Sicherungen verlassen das iPhone nur, wenn du sie selbst teilst – an wen, entscheidest du im Teilen-Menü." },
    { titel: "Deine Rechte", text: "Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 15 ff., 77 DSGVO). Da Amtlos deine Unterlagen nicht speichert, löschst du sie selbst unter „Mein Betrieb“. Für alles andere: Kontakt beim Verantwortlichen oben." },
  ],
};

/**
 * Zusatz für Builds mit Synchronisation (E-134, `EXPO_PUBLIC_API_URL` gesetzt). Ersetzt „Kurz gesagt“ und kommt nach
 * „Sicherungen“. Fachlich zu prüfen (T-80): Hoster des Servers, Identity-Provider, Auftragsverarbeitung.
 */
export const DATENSCHUTZ_SYNC = {
  kurz: { titel: "Kurz gesagt", text: "Amtlos speichert deine Angaben verschlüsselt auf deinem iPhone. Nutzt du die Synchronisation, liegen sie zusätzlich auf einem Server von Amtlos – Ende-zu-Ende-verschlüsselt, sodass wir deine Unterlagen, Kunden und Mitarbeiter nicht lesen können. Amtlos macht keine eigenen Analysen; nur für Amtlos Pro wertet RevenueCat die Käufe für die Abo-Verwaltung aus." },
  teilen: { titel: "Was du teilst", text: "PDFs, E-Rechnungen und Sicherungen verlassen das iPhone nur, wenn du sie selbst teilst – an wen, entscheidest du im Teilen-Menü. Mit der Synchronisation gehen deine Daten zusätzlich Ende-zu-Ende-verschlüsselt an den Server von Amtlos." },
  rechte: { titel: "Deine Rechte", text: "Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 15 ff., 77 DSGVO). Deine Daten auf dem Gerät löschst du unter „Mein Betrieb“; die Daten auf dem Server löschst du mit „Synchronisation beenden“ oder „Konto löschen“." },
  empfaenger: { titel: "Empfänger und Drittland", text: "RevenueCat, Inc., USA (Auftragsverarbeiter nach Art. 28 DSGVO, nur Kennung, Konto-Kennung und Kaufbelege). Übermittlung in die USA auf Grundlage der Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO), die RevenueCat in seinem Auftragsverarbeitungsvertrag vereinbart. Für die Synchronisation: Hoster des Servers und Anmeldedienst [vor Veröffentlichung eintragen]. Apple ist für App Store, Käufe und iCloud eigener Verantwortlicher." },
  abschnitt: { titel: "Konto und Synchronisation", text: "Nur wenn du dich anmeldest: Für dein Konto verarbeiten wir deine E-Mail-Adresse, deinen Namen beim Anmeldedienst und eine Konto-Kennung (Art. 6 Abs. 1 lit. b DSGVO). Was synchronisiert wird (Betrieb, Unterlagen, Belege mit Fotos, Personen), verschlüsselt die App vor dem Senden mit einem Schlüssel, den nur dein Sync-Passwort öffnet; der Server speichert nur diesen verschlüsselten Inhalt, Dateinamen, Größe und Zeitpunkte. „Synchronisation beenden“ löscht alles auf dem Server, „Konto löschen“ zusätzlich dein Konto. Mit Amtlos Pro ordnet RevenueCat deinen Kauf der Konto-Kennung zu." },
};

/** Abschnitte des Datenschutzhinweises – mit Synchronisation ergänzt. */
export function datenschutzAbschnitte(sync: boolean) {
  if (!sync) return DATENSCHUTZ.abschnitte;
  const ersatz: Record<string, { titel: string; text: string }> = { "Kurz gesagt": DATENSCHUTZ_SYNC.kurz, "Was du teilst": DATENSCHUTZ_SYNC.teilen, "Deine Rechte": DATENSCHUTZ_SYNC.rechte, "Empfänger und Drittland": DATENSCHUTZ_SYNC.empfaenger };
  const l = DATENSCHUTZ.abschnitte.map((a) => ersatz[a.titel] ?? a);
  const i = l.findIndex((a) => a.titel === "Sicherungen");
  l.splice(i + 1, 0, DATENSCHUTZ_SYNC.abschnitt);
  return l;
}

/** Platzhalter im Datenschutzhinweis, die vor der Veröffentlichung eingetragen werden müssen (Store-Check). */
export const PLATZHALTER_RECHT = "[vor Veröffentlichung eintragen]";

export const anbieterVollstaendig = () => Boolean(ANBIETER.name && ANBIETER.anschrift && ANBIETER.email && ANBIETER.vertretung);

/**
 * Wohin „Hilfe & Kontakt“ führt: die Support-Seite, sonst die E-Mail-Adresse des Anbieters (sobald eingetragen) –
 * nie eine erfundene Adresse. Ohne beides entfällt die Zeile; der Store-Check meldet die fehlende Support-URL.
 */
export function hilfeZiel(support: string, email: string): string {
  if (support) return support;
  return email ? `mailto:${email}` : "";
}
