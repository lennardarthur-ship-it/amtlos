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
          gastronomie_lebensmittel: { de: "Gastronomie und Lebensmittel (Café, Restaurant, Imbiss, Bäckerei, Hotel)", en: "Food and hospitality (café, restaurant, snack bar, bakery, hotel)" },
          handwerk: { de: "Handwerk (z. B. Elektro, Sanitär, Tischlerei, Kfz)", en: "Skilled trades (e.g. electrical, plumbing, carpentry, car repair)" },
          beauty_kosmetik: { de: "Beauty und Kosmetik (Friseur, Kosmetik, Nägel)", en: "Beauty and cosmetics (hairdresser, beauty salon, nails)" },
          bau: { de: "Bau (Hoch- und Tiefbau, Ausbau)", en: "Construction (building, civil engineering, finishing)" },
          gebaeudereinigung: { de: "Gebäudereinigung (Unterhalts-, Glas-, Praxis- und Büroreinigung)", en: "Building cleaning (maintenance, window, practice and office cleaning)" },
          transport_logistik: { de: "Transport und Logistik (Spedition, Kurier, Taxi)", en: "Transport and logistics (haulage, courier, taxi)" },
          onlinehandel: { de: "Onlinehandel (eigener Shop, Marktplätze)", en: "Online retail (own shop, marketplaces)" },
          it_agentur_freelancer: { de: "IT, Agentur, Freelancer (Software, Design, Beratung)", en: "IT, agency, freelance (software, design, consulting)" },
          gesundheit_pflege: { de: "Gesundheit und Pflege (Praxis, Therapie, Pflegedienst)", en: "Health and care (practice, therapy, care service)" },
          immobilien_finanzen: { de: "Immobilien und Finanzen (Makler, Vermittlung, Verwaltung)", en: "Real estate and finance (brokerage, intermediation, management)" },
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
        feld: "erlaubnis.alkohol",
        art: "janein",
        frage: { de: "Schenkst du alkoholische Getränke aus?", en: "Do you serve alcoholic drinks?" },
        hilfe: {
          de: "Nach dem Gaststättengesetz des Bundes braucht nur der Ausschank von Alkohol eine Erlaubnis (§ 2 GastG); manche Länder verlangen nur eine Anzeige. Für einzelne Feste gibt es eine vorübergehende Gestattung (§ 12 GastG).",
          en: "Under the federal Restaurants Act only serving alcohol needs a permit (§ 2 GastG); some federal states only require a notification. For single events there is a temporary permit (§ 12 GastG).",
        },
      },
      {
        feld: "ifsg.selbst",
        art: "auswahl",
        frage: { de: "Arbeitest du selbst mit Lebensmitteln – zum Beispiel beim Kochen, Zubereiten oder Ausgeben?", en: "Do you work with food yourself – for example cooking, preparing or serving it?" },
        hilfe: {
          de: "Wer zum ersten Mal gewerbsmäßig mit Lebensmitteln nach § 42 IfSG arbeitet, braucht vorher eine Bescheinigung des Gesundheitsamts (früher „Gesundheitszeugnis“). Hast du schon eine aus einer früheren Tätigkeit, brauchst du keine neue.",
          en: "Anyone who works commercially with food under § 42 IfSG for the first time needs a certificate from the public health office beforehand. If you already have one from earlier work, you don't need a new one.",
        },
        optionen: {
          erstmals: { de: "Ja, zum ersten Mal", en: "Yes, for the first time" },
          bescheinigung: { de: "Ja, ich habe schon eine Bescheinigung des Gesundheitsamts", en: "Yes, I already have a certificate from the public health office" },
          keine: { de: "Nein", en: "No" },
        },
      },
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
        hilfe: {
          de: "Dann weist du auf Rechnungen keine Umsatzsteuer aus und kannst keine Vorsteuer abziehen. Möglich, wenn dein Umsatz im Vorjahr höchstens 25.000 € war und im laufenden Jahr 100.000 € nicht übersteigt; im Gründungsjahr zählen 25.000 €. Lohnt sich bei großen Anschaffungen oft nicht. Weißt du es noch nicht, überspring die Frage.",
          en: "Then your invoices show no VAT and you cannot deduct input VAT. Possible if your turnover last year was at most €25,000 and does not exceed €100,000 this year; in the founding year €25,000 counts. Often not worth it with large purchases. If you don't know yet, skip the question.",
        },
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
        feld: "ust.voranmeldung_rhythmus",
        art: "auswahl",
        frage: { de: "Wie oft gibst du die Umsatzsteuer-Voranmeldung ab?", en: "How often do you file the advance VAT return?" },
        hilfe: { de: "Das steht in deinen ELSTER-Bescheiden oder du fragst deine Steuerberatung. Wenn du es nicht weißt: „Weiß ich nicht“ – dann rechnet Amtlos mit der Steuer des Vorjahres.", en: "You find it in your ELSTER notices or can ask your tax adviser. If you don't know: “I don't know” – Amtlos then uses last year's tax." },
        optionen: {
          monatlich: { de: "Monatlich", en: "Monthly" },
          quartalsweise: { de: "Vierteljährlich", en: "Quarterly" },
          keine: { de: "Gar nicht – das Finanzamt hat mich befreit", en: "Not at all – the tax office exempted me" },
          unklar: { de: "Weiß ich nicht", en: "I don't know" },
        },
      },
      {
        feld: "ust.zahllast_vorjahr",
        art: "betrag",
        frage: { de: "Wie viel Umsatzsteuer hast du im letzten Jahr ans Finanzamt gezahlt?", en: "How much VAT did you pay to the tax office last year?" },
        hilfe: { de: "Die Zahllast ist die Summe deiner Voranmeldungen – das, was du ans Finanzamt gezahlt hast. Bei Gründung im letzten Jahr: 0.", en: "The total of your advance returns – what you paid to the tax office. If you started last year: 0." },
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
        feld: "steuern.buchfuehrung_mitteilung",
        art: "janein",
        frage: { de: "Hat dir das Finanzamt mitgeteilt, dass du Bücher führen musst?", en: "Has the tax office notified you that you must keep double-entry books?" },
        hilfe: { de: "Liegt dein Umsatz über 800.000 € oder dein Gewinn über 80.000 €, kann das Finanzamt dich schriftlich zur Buchführung auffordern (§ 141 AO). Ohne diese Mitteilung bleibt es bei der Einnahmen-Überschuss-Rechnung.", en: "If your turnover exceeds €800,000 or your profit €80,000, the tax office can require you in writing to keep books (§ 141 AO). Without this notice you stay with the cash-basis accounts (EÜR)." },
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
        frage: { de: "Wer sind deine Kundinnen und Kunden?", en: "Who are your customers?" },
        hilfe: { de: "Egal ob du Waren verkaufst oder Dienstleistungen erbringst.", en: "Whether you sell goods or provide services." },
        optionen: { b2b: { de: "Unternehmen", en: "Businesses" }, b2c: { de: "Privatpersonen", en: "Consumers" } },
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
        feld: "vertrieb.ausserhalb_geschaeftsraeume",
        art: "janein",
        frage: { de: "Schließt du Verträge mit Privatkunden bei ihnen zu Hause oder unterwegs ab?", en: "Do you make contracts with private customers at their home or on the go?" },
        hilfe: {
          de: "Zum Beispiel ein Auftrag, den du beim Kunden in der Wohnung unterschreiben lässt. Dann hat der Kunde ein Widerrufsrecht wie im Onlinehandel (§ 312b BGB).",
          en: "For example an order you have signed at the customer's home. The customer then has a right of withdrawal as in online retail (§ 312b BGB).",
        },
      },
      {
        feld: "gastro.to_go",
        art: "janein",
        frage: { de: "Verkaufst du Essen oder Getränke zum Mitnehmen in Einwegverpackungen?", en: "Do you sell food or drinks to take away in single-use packaging?" },
        hilfe: { de: "Zum Beispiel Kaffeebecher, Salatschalen oder Boxen aus Kunststoff.", en: "For example coffee cups, salad bowls or plastic boxes." },
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
        feld: "produkte.hersteller",
        art: "janein",
        frage: { de: "Stellst du eigene Produkte her, verkaufst du Produkte unter deinem eigenen Namen oder importierst du sie von außerhalb der EU?", en: "Do you make your own products, sell products under your own name or brand, or import them from outside the EU?" },
        hilfe: { de: "Wenn du nur fertige Markenware anderer Hersteller weiterverkaufst oder verwendest: Nein.", en: "If you only resell or use finished branded goods from other manufacturers: No." },
      },
      {
        feld: "produkte.erstinverkehrbringer",
        art: "janein",
        frage: { de: "Bringst du Elektrogeräte oder Batterien selbst erstmals in Deutschland in Verkehr – als Hersteller, unter deiner eigenen Marke oder als Importeur?", en: "Do you place electrical devices or batteries on the German market for the first time yourself – as manufacturer, under your own brand or as importer?" },
        hilfe: { de: "Kaufst du die Geräte bei einem Händler in Deutschland und verkaufst oder baust sie nur ein, ist das in der Regel nicht der Fall.", en: "If you buy the devices from a dealer in Germany and only resell or install them, this is usually not the case." },
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
        feld: "online.social_media",
        art: "janein",
        frage: { de: "Hast du ein geschäftliches Profil in sozialen Netzwerken (z. B. Instagram, Facebook, LinkedIn)?", en: "Do you have a business profile on social networks (e.g. Instagram, Facebook, LinkedIn)?" },
        hilfe: { de: "Auch dort brauchst du ein Impressum.", en: "You need a legal notice (Impressum) there too." },
      },
      {
        feld: "handel.hohe_bargeschaefte",
        art: "janein",
        frage: { de: "Nimmst du für Waren hohe Barzahlungen an (in Höhe der Schwelle des Geldwäschegesetzes)?", en: "Do you accept large cash payments for goods (at the threshold of the Anti-Money Laundering Act)?" },
        hilfe: { de: "Wenn du nur Dienstleistungen verkaufst oder keine großen Beträge bar annimmst: Nein.", en: "If you only sell services or don't accept large amounts in cash: No." },
      },
      {
        feld: "kasse.elektronisch",
        art: "janein",
        frage: { de: "Nutzt du eine elektronische Kasse?", en: "Do you use an electronic till?" },
        hilfe: {
          de: "Ein Kartenterminal allein ist keine Kasse, eine Kassen-App auf Handy oder Tablet schon. Ohne elektronische Kasse führst du eine offene Ladenkasse mit Kassenbericht. Weißt du es noch nicht, überspring die Frage.",
          en: "A card terminal alone is not a till, but a till app on a phone or tablet is. Without an electronic till you keep an open cash box with a daily cash report. If you don't know yet, skip the question.",
        },
      },
      {
        feld: "kasse.angeschafft_am",
        art: "datum",
        frage: { de: "Seit wann hast du die elektronische Kasse – oder wann schaffst du sie an?", en: "Since when have you had the electronic till – or when will you get it?" },
        hilfe: { de: "Ab diesem Tag hast du einen Monat Zeit, sie dem Finanzamt zu melden.", en: "From this day you have one month to report it to the tax office." },
      },
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
      { feld: "beschaeftigte.minijob", art: "zahl", frage: { de: "Wie viele deiner Beschäftigten arbeiten im Minijob?", en: "How many of your staff work in a mini-job?" }, hilfe: { de: "Von allen Menschen, die für dich arbeiten. Keine: 0.", en: "Out of everyone who works for you. None: 0." } },
      { feld: "beschaeftigte.azubi", art: "zahl", frage: { de: "Wie viele deiner Beschäftigten sind Auszubildende?", en: "How many of your staff are apprentices?" } },
      {
        feld: "beschaeftigte.jugendlich",
        art: "zahl",
        frage: { de: "Wie viele deiner Beschäftigten sind unter 18 Jahre alt?", en: "How many of your staff are under 18?" },
        hilfe: { de: "Auch Azubis und Aushilfen zählen. Keine: 0.", en: "Apprentices and temporary helpers count too. None: 0." },
      },
      {
        feld: "personal.sofortmeldebranchen",
        art: "mehrfach",
        frage: { de: "Gehört dein Betrieb zu einer dieser Branchen?", en: "Does your business belong to one of these sectors?" },
        hilfe: {
          de: "In diesen Branchen meldest du neue Beschäftigte sofort bei Arbeitsbeginn, zeichnest die Arbeitszeit auf und weist auf die Ausweispflicht hin. Seit 2026 gehören Friseur- und Kosmetikbetriebe dazu.",
          en: "In these sectors you report new staff immediately when they start, record working time and inform them about carrying ID. Since 2026 this includes hairdressers and beauty salons.",
        },
        // Branchen nach § 28a Abs. 4 SGB IV und § 2a SchwarzArbG nach dem SchwarzArbMoDiG (R11: neu Friseur, Kosmetik,
        // plattformbasierte Lieferdienste; Forstwirtschaft gestrichen; Fleischwirtschaft ohne Fleischerhandwerk)
        optionen: {
          bau: { de: "Baugewerbe", en: "Construction" },
          gastronomie: { de: "Gaststätten und Beherbergung (z. B. Restaurant, Café, Hotel)", en: "Restaurants and accommodation (e.g. restaurant, café, hotel)" },
          personenbefoerderung: { de: "Personenbeförderung", en: "Passenger transport" },
          spedition_logistik: { de: "Spedition, Transport und Logistik", en: "Haulage, transport and logistics" },
          schausteller: { de: "Schaustellergewerbe", en: "Fairground and showmen's trade" },
          gebaeudereinigung: { de: "Gebäudereinigung", en: "Building cleaning" },
          messebau: { de: "Auf- und Abbau von Messen und Ausstellungen", en: "Setting up and dismantling trade fairs and exhibitions" },
          fleischwirtschaft: { de: "Fleischwirtschaft (ohne Fleischerhandwerk)", en: "Meat industry (excluding butchers' trade)" },
          prostitution: { de: "Prostitutionsgewerbe", en: "Prostitution trade" },
          sicherheitsgewerbe: { de: "Wach- und Sicherheitsgewerbe", en: "Guarding and security services" },
          friseur: { de: "Friseurgewerbe", en: "Hairdressing" },
          kosmetik: { de: "Kosmetikgewerbe (z. B. Kosmetik-, Nagelstudio)", en: "Beauty trade (e.g. beauty or nail salon)" },
          lieferdienste: { de: "Plattformbasierte Lieferdienste", en: "Platform-based delivery services" },
          keine: { de: "Keine davon", en: "None of these" },
        },
      },
      {
        feld: "ifsg.beschaeftigte",
        art: "auswahl",
        frage: { de: "Arbeiten Beschäftigte bei dir mit Lebensmitteln?", en: "Do any of your staff work with food?" },
        hilfe: {
          de: "Gemeint ist Herstellen, Behandeln oder Ausgeben von Lebensmitteln nach § 42 IfSG, etwa in Küche, Theke oder Service. Reine Bürokräfte zählen nicht. Wer schon eine Bescheinigung des Gesundheitsamts hat, braucht keine neue – deine Belehrung als Arbeitgeber brauchen alle.",
          en: "This means producing, handling or serving food under § 42 IfSG, e.g. in the kitchen, at the counter or in service. Office staff don't count. Anyone who already has a certificate from the public health office doesn't need a new one – all of them need your briefing as employer.",
        },
        optionen: {
          erstmals: { de: "Ja, mindestens eine Person zum ersten Mal", en: "Yes, at least one person for the first time" },
          bescheinigung: { de: "Ja, alle haben schon eine Bescheinigung des Gesundheitsamts", en: "Yes, all already have a certificate from the public health office" },
          keine: { de: "Nein, niemand (z. B. nur Büro)", en: "No, nobody (e.g. office only)" },
        },
      },
      {
        feld: "personal.drittstaaten",
        art: "janein",
        frage: { de: "Beschäftigst du Menschen, die keine Staatsangehörigkeit eines EU-Staats, aus Island, Liechtenstein, Norwegen oder der Schweiz haben?", en: "Do you employ people who are not nationals of an EU country, Iceland, Liechtenstein, Norway or Switzerland?" },
        hilfe: { de: "Dann prüfst du vor Beginn, ob sie bei dir arbeiten dürfen, und bewahrst eine Kopie des Aufenthaltstitels auf.", en: "Then you check before they start whether they may work for you and keep a copy of the residence permit." },
      },
      {
        feld: "personal.lohnsteuer_anmeldezeitraum",
        art: "auswahl",
        frage: { de: "Wie oft meldest du die Lohnsteuer an?", en: "How often do you file the wage tax return?" },
        hilfe: {
          de: "Das folgt aus der Lohnsteuer des Vorjahres (§ 41a Abs. 2 EStG): über 5.000 € monatlich, über 1.080 € vierteljährlich, sonst jährlich. Im ersten Jahr zählt die aufs Jahr hochgerechnete Lohnsteuer des ersten Monats. Wenn du es nicht weißt, frag deine Steuerberatung.",
          en: "It follows from last year's wage tax (§ 41a(2) EStG): over €5,000 monthly, over €1,080 quarterly, otherwise yearly. In the first year the first month's wage tax projected to a full year counts. If you don't know, ask your tax adviser.",
        },
        optionen: {
          monatlich: { de: "Monatlich", en: "Monthly" },
          quartalsweise: { de: "Vierteljährlich", en: "Quarterly" },
          jaehrlich: { de: "Jährlich", en: "Yearly" },
          keine: { de: "Keine – nur Minijobs mit 2 % Pauschsteuer über die Minijob-Zentrale", en: "None – only mini-jobs with the 2 % flat-rate tax via the Minijob-Zentrale" },
        },
      },
      {
        feld: "personal.lohn_durch",
        art: "auswahl",
        frage: { de: "Wer macht die Löhne?", en: "Who does the payroll?" },
        hilfe: { de: "Also Lohnabrechnung und die Meldungen an Krankenkassen und Finanzamt.", en: "That is payroll and the reports to health insurers and the tax office." },
        optionen: {
          selbst: { de: "Ich selbst mit einem Lohnprogramm", en: "Myself with payroll software" },
          steuerberatung: { de: "Meine Steuerberatung", en: "My tax adviser" },
          lohnbuero: { de: "Ein Lohnbüro", en: "A payroll service" },
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
