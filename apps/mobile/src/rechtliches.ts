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
 * Datenschutzhinweis der App. Beschreibt, was die App technisch tut (Stand des Codes). Fachlich zu prüfen (T-77):
 * bis zur Freigabe `freigegeben: false` – der Store-Check meldet das.
 */
export const DATENSCHUTZ = {
  freigegeben: false,
  abschnitte: [
    { titel: "Kurz gesagt", text: "Amtlos speichert deine Angaben nur auf deinem iPhone – verschlüsselt, ohne Konto und ohne Server von Amtlos. Wir sehen deine Unterlagen, Kunden und Mitarbeiter nicht." },
    { titel: "Was auf dem iPhone liegt", text: "Betrieb, Unterlagen, Rechnungen, Belege mit Fotos und Dateien, Mitarbeiter- und Kundendaten sowie deine Antworten im Pflichten-Check. Die Daten sind mit AES-256 verschlüsselt; der Schlüssel liegt im Schlüsselbund dieses iPhones. Wenn du die App löschst, sind die Daten weg – außer in einer Sicherung, die du selbst erstellt hast." },
    { titel: "Sicherungen", text: "Eine Sicherung ist eine Datei, die Amtlos mit deinem Passwort verschlüsselt. Du entscheidest, wo du sie ablegst (z. B. Dateien, iCloud Drive). Die automatische iCloud-Sicherung legt dieselbe verschlüsselte Datei in deinem iCloud Drive ab; Apple ist dafür dein Anbieter." },
    { titel: "Erinnerungen", text: "Erinnerungen an Fristen plant das iPhone selbst als lokale Mitteilungen. Dafür wird nichts an Amtlos gesendet." },
    { titel: "Amtlos Pro", text: "Käufe laufen über deinen Apple-Account. Damit die App weiß, ob Pro aktiv ist, verarbeitet unser Dienstleister RevenueCat eine zufällige Kennung und deine Kaufbelege von Apple – keine Unterlagen, keine Namen." },
    { titel: "Was du teilst", text: "PDFs, E-Rechnungen und Sicherungen verlassen das iPhone nur, wenn du sie selbst teilst – an wen, entscheidest du im Teilen-Menü." },
    { titel: "Deine Rechte", text: "Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Beschwerde bei einer Aufsichtsbehörde (Art. 15 ff. DSGVO). Da Amtlos deine Unterlagen nicht speichert, löschst du sie selbst unter „Mein Betrieb“." },
  ],
};

/**
 * Zusatz für Builds mit Synchronisation (E-134, `EXPO_PUBLIC_API_URL` gesetzt). Ersetzt „Kurz gesagt“ und kommt nach
 * „Sicherungen“. Fachlich zu prüfen (T-80): Hoster des Servers, Identity-Provider, Auftragsverarbeitung.
 */
export const DATENSCHUTZ_SYNC = {
  kurz: { titel: "Kurz gesagt", text: "Amtlos speichert deine Angaben verschlüsselt auf deinem iPhone. Nutzt du die Synchronisation, liegen sie zusätzlich auf einem Server von Amtlos – Ende-zu-Ende-verschlüsselt, sodass wir deine Unterlagen, Kunden und Mitarbeiter nicht lesen können." },
  teilen: { titel: "Was du teilst", text: "PDFs, E-Rechnungen und Sicherungen verlassen das iPhone nur, wenn du sie selbst teilst – an wen, entscheidest du im Teilen-Menü. Mit der Synchronisation gehen deine Daten zusätzlich Ende-zu-Ende-verschlüsselt an den Server von Amtlos." },
  rechte: { titel: "Deine Rechte", text: "Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Beschwerde bei einer Aufsichtsbehörde (Art. 15 ff. DSGVO). Deine Daten auf dem Gerät löschst du unter „Mein Betrieb“; die Daten auf dem Server löschst du mit „Synchronisation beenden“ oder „Konto löschen“." },
  abschnitt: { titel: "Konto und Synchronisation", text: "Nur wenn du dich anmeldest: Für dein Konto verarbeiten wir deine E-Mail-Adresse, deinen Namen beim Anmeldedienst und eine Konto-Kennung. Was synchronisiert wird (Betrieb, Unterlagen, Belege mit Fotos, Personen), verschlüsselt die App vor dem Senden mit einem Schlüssel, den nur dein Sync-Passwort öffnet; der Server speichert nur diesen verschlüsselten Inhalt, Dateinamen, Größe und Zeitpunkte. „Synchronisation beenden“ löscht alles auf dem Server, „Konto löschen“ zusätzlich dein Konto. Mit Amtlos Pro ordnet RevenueCat deinen Kauf der Konto-Kennung zu." },
};

/** Abschnitte des Datenschutzhinweises – mit Synchronisation ergänzt. */
export function datenschutzAbschnitte(sync: boolean) {
  if (!sync) return DATENSCHUTZ.abschnitte;
  const ersatz: Record<string, { titel: string; text: string }> = { "Kurz gesagt": DATENSCHUTZ_SYNC.kurz, "Was du teilst": DATENSCHUTZ_SYNC.teilen, "Deine Rechte": DATENSCHUTZ_SYNC.rechte };
  const l = DATENSCHUTZ.abschnitte.map((a) => ersatz[a.titel] ?? a);
  const i = l.findIndex((a) => a.titel === "Sicherungen");
  l.splice(i + 1, 0, DATENSCHUTZ_SYNC.abschnitt);
  return l;
}

export const anbieterVollstaendig = () => Boolean(ANBIETER.name && ANBIETER.anschrift && ANBIETER.email && ANBIETER.vertretung);
