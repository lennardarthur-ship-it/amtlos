/**
 * Onboarding (Spezifikation 3.1): eine Frage-Gruppe je Schritt. Schlüssel = Profilfeld ohne "profil."
 * (E-061). Typ und erlaubte Werte müssen zu packages/rules-schema/fakten.json passen (Test in index.test.ts).
 */
export type Sprache = "de" | "en";
type T = { de: string; en: string };

export interface Frage {
  feld: string;
  art: "auswahl" | "mehrfach" | "janein" | "zahl" | "betrag" | "datum" | "text";
  frage: T;
  hilfe?: T;
  optionen?: Record<string, T>;
  muster?: string;
}

export interface Schritt {
  id: string;
  titel: T;
  fragen: Frage[];
}

export const SCHRITTE: Schritt[] = [
  {
    id: "rechtsform",
    titel: { de: "Rechtsform", en: "Legal form" },
    fragen: [
      {
        feld: "rechtsform",
        art: "auswahl",
        frage: { de: "Welche Rechtsform hat dein Unternehmen?", en: "What legal form does your business have?" },
        hilfe: { de: "Die Rechtsform steht in deiner Gewerbeanmeldung oder im Handelsregister.", en: "You find it in your trade registration or the commercial register." },
        optionen: {
          einzelunternehmen: { de: "Einzelunternehmen", en: "Sole proprietorship" },
          freiberuf: { de: "Freiberuflich (ohne Gewerbe)", en: "Freelance profession (no trade)" },
          gbr: { de: "GbR", en: "Civil-law partnership (GbR)" },
          ek: { de: "Eingetragene Kauffrau / eingetragener Kaufmann (e. K.)", en: "Registered merchant (e. K.)" },
          ug: { de: "UG (haftungsbeschränkt)", en: "UG (limited liability)" },
          gmbh: { de: "GmbH", en: "GmbH" },
          gmbh_co_kg: { de: "GmbH & Co. KG", en: "GmbH & Co. KG" },
          partg: { de: "Partnerschaftsgesellschaft", en: "Partnership company (PartG)" },
          partg_mbb: { de: "PartG mbB", en: "PartG mbB" },
          sonstige: { de: "Andere", en: "Other" },
        },
      },
    ],
  },
  {
    id: "taetigkeit",
    titel: { de: "Tätigkeit", en: "Activity" },
    fragen: [
      {
        feld: "taetigkeit.einordnung",
        art: "auswahl",
        frage: { de: "Ist deine Tätigkeit ein Gewerbe oder ein freier Beruf?", en: "Is your activity a trade or a liberal profession?" },
        hilfe: {
          de: "Freie Berufe sind zum Beispiel Ärztinnen, Architekten, Journalistinnen, Übersetzer. Wenn du unsicher bist, wähle „Weiß ich nicht“.",
          en: "Liberal professions include doctors, architects, journalists, translators. If unsure, choose “I don't know”.",
        },
        optionen: {
          gewerbe: { de: "Gewerbe", en: "Trade" },
          freiberuf: { de: "Freier Beruf", en: "Liberal profession" },
          land_forstwirtschaft: { de: "Land- oder Forstwirtschaft", en: "Agriculture or forestry" },
          unklar: { de: "Weiß ich nicht", en: "I don't know" },
        },
      },
      {
        feld: "erwerb",
        art: "auswahl",
        frage: { de: "Ist das dein Hauptberuf oder ein Nebenerwerb?", en: "Is this your main occupation or a side business?" },
        optionen: { haupt: { de: "Hauptberuf", en: "Main occupation" }, neben: { de: "Nebenerwerb", en: "Side business" } },
      },
    ],
  },
  {
    id: "start",
    titel: { de: "Start", en: "Start" },
    fragen: [
      {
        feld: "gruendungsdatum",
        art: "datum",
        frage: { de: "Wann hast du angefangen oder wann willst du anfangen?", en: "When did you start or when do you plan to start?" },
      },
    ],
  },
  {
    id: "ort",
    titel: { de: "Ort", en: "Location" },
    fragen: [
      {
        feld: "gemeinde_ags",
        art: "text",
        muster: "^\\d{8}$",
        frage: { de: "Wie lautet der Gemeindeschlüssel deines Firmensitzes?", en: "What is the municipality key of your registered office?" },
        hilfe: {
          de: "Achtstellige Nummer, zum Beispiel 11000000 für Berlin. Eine Suche nach Ortsnamen folgt.",
          en: "Eight digits, for example 11000000 for Berlin. A search by place name is coming.",
        },
      },
    ],
  },
  {
    id: "umsatzsteuer",
    titel: { de: "Umsatzsteuer", en: "VAT" },
    fragen: [
      {
        feld: "ust.kleinunternehmer",
        art: "janein",
        frage: { de: "Nutzt du die Kleinunternehmerregelung?", en: "Do you use the small business scheme (Kleinunternehmerregelung)?" },
        hilfe: { de: "Dann weist du auf Rechnungen keine Umsatzsteuer aus.", en: "Then your invoices show no VAT." },
      },
      { feld: "umsatz.vorjahr", art: "betrag", frage: { de: "Wie hoch war dein Umsatz im letzten Jahr (in Euro)?", en: "What was your turnover last year (in euros)?" } },
      { feld: "umsatz.prognose_laufendes_jahr", art: "betrag", frage: { de: "Welchen Umsatz erwartest du dieses Jahr?", en: "What turnover do you expect this year?" } },
      {
        feld: "ust.zahllast_vorjahr",
        art: "betrag",
        frage: { de: "Wie viel Umsatzsteuer hast du im letzten Jahr ans Finanzamt gezahlt?", en: "How much VAT did you pay to the tax office last year?" },
        hilfe: { de: "Das ist die Summe deiner Voranmeldungen. Bei Gründung im letzten Jahr: 0.", en: "The total of your advance returns. If you started last year: 0." },
      },
      {
        feld: "ust.dauerfristverlaengerung",
        art: "janein",
        frage: { de: "Hast du eine Dauerfristverlängerung?", en: "Do you have a permanent filing extension (Dauerfristverlängerung)?" },
        hilfe: { de: "Damit gibst du die Voranmeldung einen Monat später ab.", en: "It lets you file advance returns one month later." },
      },
      { feld: "steuerberater", art: "janein", frage: { de: "Macht eine Steuerberaterin oder ein Steuerberater deine Erklärungen?", en: "Does a tax adviser prepare your returns?" } },
    ],
  },
  {
    id: "kunden",
    titel: { de: "Kunden und Verkauf", en: "Customers and sales" },
    fragen: [
      {
        feld: "kunden.segmente",
        art: "mehrfach",
        frage: { de: "An wen verkaufst du?", en: "Who do you sell to?" },
        optionen: { b2b: { de: "An Unternehmen", en: "Businesses" }, b2c: { de: "An Privatpersonen", en: "Consumers" } },
      },
      {
        feld: "kunden.regionen",
        art: "mehrfach",
        frage: { de: "Wo sitzen deine Kunden?", en: "Where are your customers?" },
        optionen: { inland: { de: "Deutschland", en: "Germany" }, eu: { de: "Andere EU-Länder", en: "Other EU countries" }, drittland: { de: "Außerhalb der EU", en: "Outside the EU" } },
      },
      {
        feld: "vertrieb.kanaele",
        art: "mehrfach",
        frage: { de: "Wie verkaufst du?", en: "How do you sell?" },
        optionen: {
          ladengeschaeft: { de: "Im Laden", en: "In a shop" },
          onlineshop: { de: "Eigener Onlineshop", en: "Own online shop" },
          marktplatz: { de: "Über Marktplätze", en: "Through marketplaces" },
          abo: { de: "Im Abo", en: "Subscriptions" },
          app: { de: "Über eine App", en: "Through an app" },
          vor_ort_beim_kunden: { de: "Beim Kunden vor Ort", en: "At the customer's site" },
          keine_direktvertrieb: { de: "Nichts davon", en: "None of these" },
        },
      },
      {
        feld: "produkte.arten",
        art: "mehrfach",
        frage: { de: "Was verkaufst du?", en: "What do you sell?" },
        optionen: {
          dienstleistung: { de: "Dienstleistungen", en: "Services" },
          physisch: { de: "Waren", en: "Physical goods" },
          verpackung: { de: "Waren mit Verpackung, die du verschickst", en: "Goods shipped in packaging" },
          elektrogeraete: { de: "Elektrogeräte", en: "Electrical devices" },
          batterien: { de: "Batterien", en: "Batteries" },
          lebensmittel: { de: "Lebensmittel", en: "Food" },
          kosmetik: { de: "Kosmetik", en: "Cosmetics" },
          digital: { de: "Digitale Produkte", en: "Digital products" },
        },
      },
      { feld: "kasse.elektronisch", art: "janein", frage: { de: "Nutzt du eine elektronische Kasse?", en: "Do you use an electronic till?" } },
    ],
  },
  {
    id: "beschaeftigte",
    titel: { de: "Beschäftigte", en: "Staff" },
    fragen: [
      {
        feld: "beschaeftigte.gesamt",
        art: "zahl",
        frage: { de: "Wie viele Menschen arbeiten für dich, dich selbst nicht mitgezählt?", en: "How many people work for you, not counting yourself?" },
        hilfe: { de: "Alle zählen: Vollzeit, Teilzeit, Minijob, Azubis.", en: "Count everyone: full-time, part-time, mini-jobs, apprentices." },
      },
      { feld: "beschaeftigte.minijob", art: "zahl", frage: { de: "Davon im Minijob?", en: "Of these, on a mini-job?" } },
      { feld: "beschaeftigte.azubi", art: "zahl", frage: { de: "Davon Auszubildende?", en: "Of these, apprentices?" } },
      { feld: "beschaeftigte.jugendlich", art: "zahl", frage: { de: "Davon unter 18 Jahren?", en: "Of these, under 18?" } },
    ],
  },
  {
    id: "daten",
    titel: { de: "Daten und KI", en: "Data and AI" },
    fragen: [
      {
        feld: "datenverarbeitung.arten",
        art: "mehrfach",
        frage: { de: "Welche Daten über Menschen verarbeitest du?", en: "What data about people do you process?" },
        optionen: {
          kundendaten: { de: "Kundendaten", en: "Customer data" },
          beschaeftigtendaten: { de: "Daten von Beschäftigten", en: "Staff data" },
          gesundheitsdaten: { de: "Gesundheitsdaten", en: "Health data" },
          videoueberwachung: { de: "Videoüberwachung", en: "Video surveillance" },
          newsletter: { de: "Newsletter", en: "Newsletter" },
          tracking: { de: "Tracking auf der Website", en: "Website tracking" },
          keine: { de: "Keine", en: "None" },
        },
      },
      { feld: "ki.nutzung", art: "janein", frage: { de: "Nutzt du KI-Werkzeuge im Unternehmen?", en: "Do you use AI tools in your business?" } },
    ],
  },
];

/** Zu welchem Schritt gehört ein Fakt? Für den Knopf „Angabe ergänzen“ bei fehlenden Angaben. */
export function schrittFuerFakt(fakt: string): string | undefined {
  const feld = fakt.startsWith("profil.") ? fakt.slice("profil.".length) : fakt;
  return SCHRITTE.find((s) => s.fragen.some((f) => f.feld === feld))?.id;
}

export function frageFuerFakt(fakt: string): Frage | undefined {
  const feld = fakt.startsWith("profil.") ? fakt.slice("profil.".length) : fakt;
  for (const s of SCHRITTE) for (const f of s.fragen) if (f.feld === feld) return f;
  return undefined;
}
