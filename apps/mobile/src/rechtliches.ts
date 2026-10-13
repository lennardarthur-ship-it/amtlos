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
    { titel: "Was auf dem iPhone liegt", text: "Betrieb, Unterlagen, Rechnungen, Mitarbeiter- und Kundendaten sowie deine Antworten im Pflichten-Check. Die Daten sind mit AES-256 verschlüsselt; der Schlüssel liegt im Schlüsselbund dieses iPhones. Wenn du die App löschst, sind die Daten weg – außer in einer Sicherung, die du selbst erstellt hast." },
    { titel: "Sicherungen", text: "Eine Sicherung ist eine Datei, die Amtlos mit deinem Passwort verschlüsselt. Du entscheidest, wo du sie ablegst (z. B. Dateien, iCloud Drive). Die automatische iCloud-Sicherung legt dieselbe verschlüsselte Datei in deinem iCloud Drive ab; Apple ist dafür dein Anbieter." },
    { titel: "Erinnerungen", text: "Erinnerungen an Fristen plant das iPhone selbst als lokale Mitteilungen. Dafür wird nichts an Amtlos gesendet." },
    { titel: "Amtlos Pro", text: "Käufe laufen über deinen Apple-Account. Damit die App weiß, ob Pro aktiv ist, verarbeitet unser Dienstleister RevenueCat eine zufällige Kennung und deine Kaufbelege von Apple – keine Unterlagen, keine Namen." },
    { titel: "Was du teilst", text: "PDFs, E-Rechnungen und Sicherungen verlassen das iPhone nur, wenn du sie selbst teilst – an wen, entscheidest du im Teilen-Menü." },
    { titel: "Deine Rechte", text: "Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Beschwerde bei einer Aufsichtsbehörde (Art. 15 ff. DSGVO). Da Amtlos deine Unterlagen nicht speichert, löschst du sie selbst unter „Mein Betrieb“." },
  ],
};

export const anbieterVollstaendig = () => Boolean(ANBIETER.name && ANBIETER.anschrift && ANBIETER.email && ANBIETER.vertretung);
