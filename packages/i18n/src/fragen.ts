/**
 * Onboarding (Spezifikation 3.1): eine Frage-Gruppe je Schritt. Schlüssel = Profilfeld ohne "profil."
 * (E-061). Typ und erlaubte Werte müssen zu packages/rules-schema/fakten.json passen (Test in index.test.ts).
 */
export type Sprache = "de" | "en";
type T = { de: string; en: string };

export interface Frage {
  feld: string;
  art: "auswahl" | "mehrfach" | "janein" | "zahl" | "betrag" | "datum" | "text";
  /** Teil des Schnellstarts (E-111): die wenigen Fragen, die für die ersten Pflichten reichen. Alles andere wird später nachgefragt. */
  schnell?: true;
  frage: T;
  hilfe?: T;
  optionen?: Record<string, T>;
  muster?: string;
}

export interface Schritt {
  id: string;
  titel: T;
  fragen: Frage[];
  /** Schritt nur zeigen, wenn das Profilfeld einen dieser Werte hat (z. B. nur für UG/GmbH). */
  nurWenn?: { feld: string; in: string[] };
}

/** Ist der Schritt für dieses Profil relevant? Ohne Bedingung immer. */
export function schrittSichtbar(s: Schritt, profil: Record<string, unknown>): boolean {
  return !s.nurWenn || s.nurWenn.in.includes(String(profil[s.nurWenn.feld]));
}

/** Die für dieses Profil relevanten Schritte in Reihenfolge. */
export function sichtbareSchritte(profil: Record<string, unknown>): Schritt[] {
  return SCHRITTE.filter((s) => schrittSichtbar(s, profil));
}

export type Phase = "schnell" | "nachfragen" | "alle";
const unbeantwortet = (profil: Record<string, unknown>, f: Frage) => profil[f.feld] === undefined || profil[f.feld] === null;

/** Fragen eines Schritts je Phase: Schnellstart = nur Kernfragen, Nachfragen = nur Unbeantwortetes, alle = alles. */
export function fragenJePhase(s: Schritt, phase: Phase, profil: Record<string, unknown>): Frage[] {
  if (phase === "schnell") return s.fragen.filter((f) => f.schnell);
  if (phase === "nachfragen") return s.fragen.filter((f) => !f.schnell && unbeantwortet(profil, f));
  return s.fragen;
}

/** Schritte, die in dieser Phase mindestens eine Frage haben. */
export function schritteJePhase(phase: Phase, profil: Record<string, unknown>): Schritt[] {
  return sichtbareSchritte(profil).filter((s) => fragenJePhase(s, phase, profil).length > 0);
}

/** Wie viele Fragen sind noch offen (für den Hinweis auf „Heute“)? */
export function offeneFragen(profil: Record<string, unknown>): number {
  return sichtbareSchritte(profil).reduce((n, s) => n + s.fragen.filter((f) => !f.schnell && unbeantwortet(profil, f)).length, 0);
}

export const SCHRITTE: Schritt[] = [
  {
    id: "rechtsform",
    titel: { de: "Rechtsform", en: "Legal form" },
    fragen: [
      {
        feld: "rechtsform",
        schnell: true,
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
    id: "gesellschaft",
    titel: { de: "Gesellschaft", en: "Company" },
    nurWenn: { feld: "rechtsform", in: ["ug", "gmbh"] },
    fragen: [
      {
        feld: "gesellschaft.handelsregister",
        schnell: true,
        art: "auswahl",
        frage: { de: "Ist deine Gesellschaft schon im Handelsregister eingetragen?", en: "Is your company already entered in the commercial register?" },
        hilfe: { de: "Danach richtet sich, welche Gründungsschritte noch anstehen.", en: "This decides which founding steps are still ahead." },
        optionen: {
          nicht_beantragt: { de: "Noch nicht beantragt", en: "Not applied for yet" },
          beantragt: { de: "Beantragt, noch nicht eingetragen", en: "Applied for, not yet entered" },
          eingetragen: { de: "Eingetragen", en: "Entered" },
        },
      },
      {
        feld: "gesellschaft.geschaeftsjahr",
        art: "auswahl",
        frage: { de: "Ist euer Geschäftsjahr das Kalenderjahr?", en: "Is your financial year the calendar year?" },
        hilfe: { de: "Das steht im Gesellschaftsvertrag. Meist ist es das Kalenderjahr.", en: "It is set in the articles of association. Usually it is the calendar year." },
        optionen: {
          kalenderjahr: { de: "Ja, Kalenderjahr", en: "Yes, calendar year" },
          abweichend: { de: "Nein, abweichend", en: "No, it differs" },
        },
      },
      { feld: "gesellschafter.anzahl", art: "zahl", frage: { de: "Wie viele Gesellschafter gibt es?", en: "How many shareholders are there?" } },
    ],
  },
  {
    id: "taetigkeit",
    titel: { de: "Tätigkeit", en: "Activity" },
    fragen: [
      {
        feld: "taetigkeit.einordnung",
        schnell: true,
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
      {
        feld: "taetigkeit.branchen",
        schnell: true,
        art: "mehrfach",
        frage: { de: "In welcher Branche bist du tätig?", en: "Which industry are you in?" },
        optionen: {
          gastronomie_lebensmittel: { de: "Gastronomie und Lebensmittel", en: "Food and hospitality" },
          handwerk: { de: "Handwerk", en: "Skilled trades" },
          beauty_kosmetik: { de: "Beauty und Kosmetik", en: "Beauty and cosmetics" },
          bau: { de: "Bau", en: "Construction" },
          transport_logistik: { de: "Transport und Logistik", en: "Transport and logistics" },
          onlinehandel: { de: "Onlinehandel", en: "Online retail" },
          it_agentur_freelancer: { de: "IT, Agentur, Freelancer", en: "IT, agency, freelance" },
          gesundheit_pflege: { de: "Gesundheit und Pflege", en: "Health and care" },
          immobilien_finanzen: { de: "Immobilien und Finanzen", en: "Real estate and finance" },
          sonstige: { de: "Andere", en: "Other" },
        },
      },
      {
        feld: "rentenversicherung.pflichtgruppe",
        art: "mehrfach",
        frage: { de: "Trifft eines davon auf dich zu?", en: "Does any of these apply to you?" },
        hilfe: {
          de: "Bestimmte Selbstständige sind rentenversicherungspflichtig. Das betrifft zum Beispiel diese Gruppen.",
          en: "Certain self-employed people must pay into the statutory pension scheme, for example these groups.",
        },
        optionen: {
          lehrende: { de: "Ich unterrichte (z. B. Lehrerin, Trainer, Coach)", en: "I teach (e.g. teacher, trainer, coach)" },
          pflege: { de: "Ich arbeite in der Pflege", en: "I work in care" },
          handwerk_rolle: { de: "Ich bin mit meinem Handwerk in der Handwerksrolle eingetragen", en: "I am registered in the crafts register" },
          ein_auftraggeber: { de: "Ich arbeite überwiegend für nur einen Auftraggeber", en: "I work mainly for a single client" },
          sonstige: { de: "Eine andere Gruppe mit Rentenversicherungspflicht", en: "Another group with mandatory pension insurance" },
          keine: { de: "Nichts davon", en: "None of these" },
        },
      },
    ],
  },
  {
    id: "erlaubnis",
    titel: { de: "Erlaubnisse", en: "Permits" },
    fragen: [
      {
        feld: "erlaubnis.gewo_paragraphen",
        art: "mehrfach",
        frage: { de: "Brauchst du für deine Tätigkeit eine dieser Erlaubnisse nach der Gewerbeordnung?", en: "Does your business need one of these permits under the Trade Regulation Act?" },
        hilfe: { de: "Wenn du unsicher bist, lass alles leer und frag bei deinem Gewerbeamt nach.", en: "If unsure, leave this empty and ask your trade office." },
        optionen: {
          "30": { de: "§ 30 Privatkrankenanstalten", en: "§ 30 Private clinics" },
          "31": { de: "§ 31 Bewachung auf Seeschiffen", en: "§ 31 Security on ships" },
          "33a": { de: "§ 33a Schaustellungen von Personen", en: "§ 33a Live shows" },
          "33c": { de: "§ 33c Spielgeräte mit Gewinnmöglichkeit", en: "§ 33c Gaming machines" },
          "33d": { de: "§ 33d Andere Spiele mit Gewinnmöglichkeit", en: "§ 33d Other games of chance" },
          "33i": { de: "§ 33i Spielhallen", en: "§ 33i Gaming arcades" },
          "34": { de: "§ 34 Pfandleihe", en: "§ 34 Pawnbroking" },
          "34a": { de: "§ 34a Bewachung", en: "§ 34a Security services" },
          "34b": { de: "§ 34b Versteigerung", en: "§ 34b Auctioneering" },
          "34c": { de: "§ 34c Makler, Bauträger, Wohnimmobilienverwalter", en: "§ 34c Brokers, developers, property managers" },
          "34d": { de: "§ 34d Versicherungsvermittlung", en: "§ 34d Insurance mediation" },
          "34e": { de: "§ 34e Versicherungsberatung", en: "§ 34e Insurance advice" },
          "34f": { de: "§ 34f Finanzanlagenvermittlung", en: "§ 34f Financial investment mediation" },
          "34h": { de: "§ 34h Honorar-Finanzanlagenberatung", en: "§ 34h Fee-based investment advice" },
          "34i": { de: "§ 34i Immobiliardarlehensvermittlung", en: "§ 34i Mortgage credit mediation" },
          "55": { de: "§ 55 Reisegewerbe (Reisegewerbekarte)", en: "§ 55 Itinerant trade" },
          keine: { de: "Keine davon", en: "None of these" },
        },
      },
      { feld: "erlaubnis.gaststaette", art: "janein", frage: { de: "Betreibst du eine Gaststätte oder schenkst Getränke aus?", en: "Do you run a restaurant or serve drinks?" } },
      {
        feld: "handwerk.anlage",
        art: "auswahl",
        frage: { de: "Ist deine Tätigkeit ein Handwerk?", en: "Is your business a skilled trade?" },
        hilfe: { de: "Die Anlagen der Handwerksordnung listen die Handwerke auf. Die Handwerkskammer hilft bei der Einordnung.", en: "The annexes of the Crafts Code list the trades. The chamber of crafts can help." },
        optionen: {
          a: { de: "Ja, zulassungspflichtig (Anlage A)", en: "Yes, licence required (Annex A)" },
          b1: { de: "Ja, zulassungsfrei (Anlage B1)", en: "Yes, no licence required (Annex B1)" },
          b2: { de: "Ja, handwerksähnlich (Anlage B2)", en: "Yes, craft-like trade (Annex B2)" },
          keine: { de: "Nein", en: "No" },
        },
      },
    ],
  },
  {
    id: "start",
    titel: { de: "Start", en: "Start" },
    fragen: [
      {
        feld: "gruendungsdatum",
        schnell: true,
        art: "datum",
        frage: { de: "Wann hast du angefangen oder wann willst du anfangen?", en: "When did you start or when do you plan to start?" },
      },
      {
        feld: "bundesland",
        schnell: true,
        art: "auswahl",
        frage: { de: "In welchem Bundesland sitzt dein Unternehmen?", en: "In which federal state is your business based?" },
        hilfe: { de: "Danach richten sich Feiertage und Zuständigkeiten. Den genauen Ort kannst du später ergänzen.", en: "Public holidays and responsible authorities depend on it. You can add the exact place later." },
        optionen: {
          BW: { de: "Baden-Württemberg", en: "Baden-Württemberg" }, BY: { de: "Bayern", en: "Bavaria" }, BE: { de: "Berlin", en: "Berlin" }, BB: { de: "Brandenburg", en: "Brandenburg" },
          HB: { de: "Bremen", en: "Bremen" }, HH: { de: "Hamburg", en: "Hamburg" }, HE: { de: "Hessen", en: "Hesse" }, MV: { de: "Mecklenburg-Vorpommern", en: "Mecklenburg-Western Pomerania" },
          NI: { de: "Niedersachsen", en: "Lower Saxony" }, NW: { de: "Nordrhein-Westfalen", en: "North Rhine-Westphalia" }, RP: { de: "Rheinland-Pfalz", en: "Rhineland-Palatinate" }, SL: { de: "Saarland", en: "Saarland" },
          SN: { de: "Sachsen", en: "Saxony" }, ST: { de: "Sachsen-Anhalt", en: "Saxony-Anhalt" }, SH: { de: "Schleswig-Holstein", en: "Schleswig-Holstein" }, TH: { de: "Thüringen", en: "Thuringia" },
        },
      },
      { feld: "alg1_bezug", art: "janein", frage: { de: "Bekommst du gerade Arbeitslosengeld I?", en: "Are you currently receiving unemployment benefit I?" } },
      // für jede Rechtsform (nicht nur UG/GmbH): sonst blieben AWV-Meldung und Investitionsprüfung bei Einzelunternehmen offen
      {
        feld: "gesellschafter.auslaendische_investoren",
        art: "janein",
        frage: { de: "Sind Investoren aus dem Ausland an deinem Unternehmen beteiligt oder geplant?", en: "Are investors from abroad involved in your business or planned?" },
        hilfe: { de: "Zum Beispiel Gesellschafter, stille Beteiligte oder Geldgeber mit Sitz im Ausland. Wenn nicht: Nein.", en: "For example shareholders, silent partners or backers based abroad. If not: No." },
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
          de: "Achtstellige Nummer, zum Beispiel 11000000 für Berlin – steht im Gewerbeschein oder in der Gemeindeliste des Statistischen Bundesamts. Nur für örtliche Feiertage nötig; das Bundesland reicht sonst.",
          en: "Eight digits, for example 11000000 for Berlin – found on the trade licence or in the Federal Statistical Office's municipality list. Only needed for local holidays; the federal state is enough otherwise.",
        },
      },
      {
        feld: "betriebsstaetten.anzahl",
        art: "zahl",
        frage: { de: "An wie vielen Orten arbeitest du (Büro, Laden, Werkstatt)?", en: "At how many locations do you work (office, shop, workshop)?" },
        hilfe: { de: "Zähle jede Betriebsstätte. Wenn du nur unterwegs oder bei Kunden arbeitest: 0.", en: "Count every business premises. If you only work on the road or at clients: 0." },
      },
    ],
  },
  {
    id: "umsatzsteuer",
    titel: { de: "Steuern", en: "Taxes" },
    fragen: [
      {
        feld: "ust.kleinunternehmer",
        schnell: true,
        art: "janein",
        frage: { de: "Nutzt du die Kleinunternehmerregelung?", en: "Do you use the small business scheme (Kleinunternehmerregelung)?" },
        hilfe: { de: "Dann weist du auf Rechnungen keine Umsatzsteuer aus.", en: "Then your invoices show no VAT." },
      },
      { feld: "umsatz.vorjahr", art: "betrag", frage: { de: "Wie hoch war dein Umsatz im letzten Jahr (in Euro)?", en: "What was your turnover last year (in euros)?" } },
      { feld: "umsatz.prognose_laufendes_jahr", art: "betrag", frage: { de: "Welchen Umsatz erwartest du dieses Jahr?", en: "What turnover do you expect this year?" } },
      {
        feld: "gewinn.prognose_laufendes_jahr",
        art: "betrag",
        frage: { de: "Welchen Gewinn erwartest du dieses Jahr?", en: "What profit do you expect this year?" },
        muster: "-?[0-9.,]*",
        hilfe: { de: "Eine Schätzung reicht, bei Verlust mit Minus. Das Finanzamt fragt danach im Fragebogen zur steuerlichen Erfassung.", en: "An estimate is enough; use a minus for a loss. The tax office asks for it in the tax registration questionnaire." },
      },
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
      {
        feld: "gewinn.vorjahr",
        art: "betrag",
        muster: "-?[0-9.,]*",
        frage: { de: "Wie hoch war dein Gewinn im letzten Jahr (in Euro)?", en: "What was your profit last year (in euros)?" },
        hilfe: { de: "Bei Verlust mit Minus, zum Beispiel -5.000.", en: "For a loss use a minus, e.g. -5000." },
      },
      {
        feld: "vorauszahlung.est_kst",
        art: "janein",
        frage: { de: "Hat das Finanzamt Vorauszahlungen zur Einkommen- oder Körperschaftsteuer festgesetzt?", en: "Has the tax office set advance payments for income or corporation tax?" },
        hilfe: { de: "Das steht in einem Vorauszahlungsbescheid oder im letzten Steuerbescheid.", en: "This is stated in an advance payment notice or your last tax assessment." },
      },
      { feld: "vorauszahlung.gewst", art: "janein", frage: { de: "Hat die Gemeinde Gewerbesteuer-Vorauszahlungen festgesetzt?", en: "Has the municipality set trade tax advance payments?" } },
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
          marktplatz: { de: "Über Online-Marktplätze (z. B. Amazon, Etsy, eBay)", en: "Through online marketplaces (e.g. Amazon, Etsy, eBay)" },
          marktstand: { de: "Am Marktstand (Wochen-, Weihnachts- oder Kunsthandwerkermarkt)", en: "At a market stall (weekly, Christmas or craft market)" },
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
      {
        feld: "bauleistungen.fuer_unternehmen",
        art: "janein",
        frage: { de: "Erbringst du Bauleistungen für andere Unternehmen?", en: "Do you provide construction work for other businesses?" },
        hilfe: {
          de: "Bauleistungen sind alle Leistungen, die der Herstellung, Instandsetzung, Instandhaltung, Änderung oder Beseitigung von Bauwerken dienen (§ 48 Abs. 1 EStG) – auch Elektro-, Sanitär- oder Malerarbeiten, zum Beispiel als Subunternehmer.",
          en: "Construction work means any work serving the construction, repair, maintenance, alteration or demolition of buildings (§ 48(1) EStG) – including electrical, plumbing or painting work, e.g. as a subcontractor.",
        },
      },
      { feld: "online.website", art: "janein", frage: { de: "Hast du eine eigene Website?", en: "Do you have your own website?" } },
      {
        feld: "handel.hohe_bargeschaefte",
        art: "janein",
        frage: { de: "Nimmst du für Waren hohe Barzahlungen an (in Höhe der Schwelle des Geldwäschegesetzes)?", en: "Do you accept large cash payments for goods (at the threshold of the Anti-Money Laundering Act)?" },
        hilfe: { de: "Wenn du nur Dienstleistungen verkaufst oder keine großen Beträge bar annimmst: Nein.", en: "If you only sell services or don't accept large amounts in cash: No." },
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
        schnell: true,
        art: "zahl",
        frage: { de: "Wie viele Menschen arbeiten für dich, dich selbst nicht mitgezählt?", en: "How many people work for you, not counting yourself?" },
        hilfe: { de: "Alle zählen: Vollzeit, Teilzeit, Minijob, Azubis.", en: "Count everyone: full-time, part-time, mini-jobs, apprentices." },
      },
      { feld: "beschaeftigte.minijob", art: "zahl", frage: { de: "Wie viele davon arbeiten im Minijob?", en: "How many of them work in a mini-job?" }, hilfe: { de: "Von allen Menschen, die für dich arbeiten.", en: "Out of everyone who works for you." } },
      { feld: "beschaeftigte.azubi", art: "zahl", frage: { de: "Davon Auszubildende?", en: "Of these, apprentices?" } },
      { feld: "beschaeftigte.jugendlich", art: "zahl", frage: { de: "Davon unter 18 Jahren?", en: "Of these, under 18?" } },
      {
        feld: "personal.sofortmeldebranchen",
        art: "mehrfach",
        frage: { de: "Gehört dein Betrieb zu einer dieser Branchen?", en: "Does your business belong to one of these sectors?" },
        hilfe: { de: "In diesen Branchen musst du neue Beschäftigte sofort bei Arbeitsbeginn melden.", en: "In these sectors new staff must be reported immediately when they start." },
        optionen: {
          bau: { de: "Bau", en: "Construction" },
          gastronomie: { de: "Gastronomie", en: "Hospitality" },
          personenbefoerderung: { de: "Personenbeförderung", en: "Passenger transport" },
          gebaeudereinigung: { de: "Gebäudereinigung", en: "Building cleaning" },
          messebau: { de: "Messebau", en: "Trade fair construction" },
          fleischwirtschaft: { de: "Fleischwirtschaft", en: "Meat industry" },
          sicherheitsgewerbe: { de: "Sicherheitsgewerbe", en: "Security services" },
          keine: { de: "Keine davon", en: "None of these" },
        },
      },
      {
        feld: "personal.lohnsteuer_anmeldezeitraum",
        art: "auswahl",
        frage: { de: "Wie oft meldest du die Lohnsteuer an?", en: "How often do you file the wage tax return?" },
        hilfe: { de: "Das legt das Finanzamt fest. Wenn du es nicht weißt, frag deine Steuerberatung oder wähle „Weiß ich nicht“.", en: "The tax office decides this. If you don't know, ask your tax adviser or choose “I don't know”." },
        optionen: {
          monatlich: { de: "Monatlich", en: "Monthly" },
          quartalsweise: { de: "Vierteljährlich", en: "Quarterly" },
          jaehrlich: { de: "Jährlich", en: "Yearly" },
          keine: { de: "Keine – nur Minijobs mit 2 % Pauschsteuer über die Minijob-Zentrale", en: "None – only mini-jobs with the 2 % flat-rate tax via the Minijob-Zentrale" },
        },
      },
      { feld: "arbeitsschutz.elektrische_geraete", art: "janein", frage: { de: "Nutzt ihr im Betrieb elektrische Geräte (z. B. Computer, Maschinen, Küchengeräte)?", en: "Do you use electrical equipment at work (e.g. computers, machines, kitchen appliances)?" } },
      { feld: "arbeitsschutz.gefahrstoffe", art: "janein", frage: { de: "Arbeitet ihr mit Gefahrstoffen (z. B. Reinigungs-, Lösungs- oder Färbemittel mit Warnzeichen)?", en: "Do you work with hazardous substances (e.g. cleaning agents, solvents or dyes with warning symbols)?" } },
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
      {
        feld: "datenschutz.dienstleister",
        art: "janein",
        frage: { de: "Verarbeiten Dienstleister für dich Daten über Menschen (z. B. Cloud, Lohnbüro, Newsletter-Tool)?", en: "Do service providers process personal data for you (e.g. cloud, payroll office, newsletter tool)?" },
      },
      { feld: "ki.nutzung", art: "janein", frage: { de: "Nutzt du KI-Werkzeuge im Unternehmen?", en: "Do you use AI tools in your business?" } },
      {
        feld: "ki.eigene_produkte",
        art: "janein",
        frage: { de: "Bietest du eigene KI-Produkte oder -Funktionen an (z. B. einen Chatbot auf deiner Website)?", en: "Do you offer your own AI products or features (e.g. a chatbot on your website)?" },
      },
      {
        feld: "nis2.betroffen",
        art: "auswahl",
        frage: { de: "Fällt dein Unternehmen unter die NIS2-Regeln zur Cybersicherheit?", en: "Is your business covered by the NIS2 cybersecurity rules?" },
        hilfe: { de: "Das hängt von Branche und Größe ab. Das BSI bietet dafür eine Betroffenheitsprüfung an.", en: "This depends on sector and size. The BSI (German Federal Office for Information Security) offers a check." },
        optionen: { ja: { de: "Ja", en: "Yes" }, nein: { de: "Nein", en: "No" }, unklar: { de: "Weiß ich nicht", en: "I don't know" } },
      },
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
