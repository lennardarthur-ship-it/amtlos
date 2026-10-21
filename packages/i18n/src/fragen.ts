import { MARKE } from "@amtlos/marke";
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
    // R12 (Rechtsprüfung Befund 1): auch GmbH & Co. KG und Partnerschaftsgesellschaften werden eingetragen
    nurWenn: { feld: "rechtsform", in: ["ug", "gmbh", "gmbh_co_kg", "partg", "partg_mbb"] },
    fragen: [
      {
        feld: "gesellschaft.handelsregister",
        schnell: true,
        art: "auswahl",
        frage: { de: "Ist deine Gesellschaft schon im Register eingetragen?", en: "Is your company already entered in the register?" },
        hilfe: { de: "Gemeint ist das Handelsregister, bei der Partnerschaftsgesellschaft das Partnerschaftsregister. Danach richtet sich, welche Gründungsschritte noch anstehen.", en: "This means the commercial register, for a partnership company the partnership register. This decides which founding steps are still ahead." },
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
          de: "Freie Berufe sind zum Beispiel Ärztinnen, Architekten, Journalistinnen, Übersetzer und unterrichtende oder erzieherische Tätigkeiten (§ 18 Abs. 1 Nr. 1 EStG), etwa Kurse und Unterricht. Wenn du unsicher bist, wähle „Weiß ich nicht“.",
          en: "Liberal professions include doctors, architects, journalists, translators and teaching or educational activities (§ 18(1) no. 1 EStG), such as courses and lessons. If unsure, choose “I don't know”.",
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
          transport_logistik: { de: "Transport und Logistik (Spedition, Kurier- und Paketdienst, Taxi)", en: "Transport and logistics (haulage, courier and parcel service, taxi)" },
          onlinehandel: { de: "Onlinehandel (eigener Shop, Marktplätze)", en: "Online retail (own shop, marketplaces)" },
          it_agentur_freelancer: { de: "IT, Agentur, Freelancer (Software, Design, Beratung)", en: "IT, agency, freelance (software, design, consulting)" },
          gesundheit_pflege: { de: "Gesundheit und Pflege (Praxis, Therapie, Pflegedienst)", en: "Health and care (practice, therapy, care service)" },
          immobilien_finanzen: { de: "Immobilien und Finanzen (Makler, Vermittlung, Verwaltung)", en: "Real estate and finance (brokerage, intermediation, management)" },
          // R12 (Nutzertest Coach #5)
          unterricht_sport_coaching: { de: "Unterricht, Kurse, Sport und Coaching (z. B. Yoga, Fitness, Nachhilfe)", en: "Teaching, courses, sport and coaching (e.g. yoga, fitness, tutoring)" },
          sonstige: { de: "Andere", en: "Other" },
        },
      },
      {
        feld: "rentenversicherung.pflichtgruppe",
        art: "mehrfach",
        frage: { de: "Trifft eines davon auf dich zu?", en: "Does any of these apply to you?" },
        hilfe: {
          de: "Bestimmte Selbstständige sind in der gesetzlichen Rentenversicherung pflichtversichert (§ 2 SGB VI) – Lehrende, Pflegepersonen und Selbstständige mit einem Auftraggeber nur, wenn sie regelmäßig keine versicherungspflichtigen Beschäftigten haben. Yoga-, Fitness- und Personal Trainer gelten in der Regel als Lehrende.",
          en: "Certain self-employed people are compulsorily insured in the statutory pension scheme (§ 2 SGB VI) – teachers, carers and people with one client only if they regularly have no employees subject to insurance. Yoga, fitness and personal trainers usually count as teachers.",
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
        frage: { de: "Fällt deine Tätigkeit unter eine dieser Vorschriften?", en: "Is your business covered by one of these rules?" },
        hilfe: { de: "Für diese Tätigkeiten verlangt die Gewerbeordnung eine Erlaubnis, eine Karte oder eine besondere Prüfung. Wenn du unsicher bist, lass alles leer und frag bei deinem Gewerbeamt nach.", en: "For these activities the Trade Regulation Act requires a permit, a card or a special check. If unsure, leave this empty and ask your trade office." },
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
          // R12 (Rechtsprüfung Befund 6): überwachungsbedürftige Gewerbe
          "38": { de: "§ 38 Gebrauchtwarenhandel, Schlüsseldienst, Detektei, Partner- oder Unterkunftsvermittlung", en: "§ 38 Second-hand trade, locksmith, detective agency, partner or accommodation brokerage" },
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
        frage: { de: "Arbeitest du selbst mit Lebensmitteln?", en: "Do you work with food yourself?" },
        hilfe: {
          de: "Zum Beispiel beim Kochen, Zubereiten oder Ausgeben. Wer zum ersten Mal gewerbsmäßig mit Lebensmitteln nach § 42 IfSG arbeitet, braucht vorher eine Bescheinigung des Gesundheitsamts (früher „Gesundheitszeugnis“). Hast du schon eine aus einer früheren Tätigkeit, brauchst du keine neue.",
          en: "For example cooking, preparing or serving it. Anyone who works commercially with food under § 42 IfSG for the first time needs a certificate from the public health office beforehand. If you already have one from earlier work, you don't need a new one.",
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
        frage: { de: "Wie viele Betriebsstätten hast du (Laden, Büro, Werkstatt, Praxis)?", en: "How many business premises do you have (shop, office, workshop, practice)?" },
        hilfe: {
          de: "Zähle jeden Ort außerhalb deiner Wohnung, an dem du arbeitest, auch Filialen. Ein Arbeitszimmer in deiner eigenen Wohnung zählt nicht – dafür ist kein eigener Rundfunkbeitrag fällig. Wenn du nur zu Hause, unterwegs oder bei Kunden arbeitest: 0.",
          en: "Count every place outside your home where you work, including branches. A study in your own home does not count – no separate broadcasting fee is due for it. If you only work at home, on the road or at clients: 0.",
        },
      },
    ],
  },
  {
    // R12 (Nutzertests Kurier, Kfz-Werkstatt): Firmenfahrzeuge und umweltrelevante Tätigkeiten
    id: "fahrzeuge",
    titel: { de: "Fahrzeuge und Umwelt", en: "Vehicles and environment" },
    fragen: [
      {
        feld: "fahrzeuge.anzahl",
        art: "zahl",
        frage: { de: "Wie viele Firmenfahrzeuge nutzt dein Betrieb?", en: "How many company vehicles does your business use?" },
        hilfe: { de: "Zugelassene Kraftfahrzeuge, die du beruflich nutzt – Pkw, Transporter, Lkw. Lastenräder zählen nicht. Keine: 0.", en: "Registered motor vehicles you use for work – cars, vans, trucks. Cargo bikes don't count. None: 0." },
      },
      {
        feld: "fahrzeuge.gesamtmasse",
        art: "mehrfach",
        frage: { de: "Welche zulässige Gesamtmasse haben die Fahrzeuge?", en: "What is the permissible total mass of the vehicles?" },
        hilfe: { de: "Steht im Fahrzeugschein (Feld F.2), bei Anhängern zusammen mit dem Anhänger. Davon hängen Fahrtenschreiber, Lenkzeiten und Erlaubnis ab.", en: "Shown in the registration certificate (field F.2), with a trailer including the trailer. Tachograph, driving times and licence depend on it." },
        optionen: {
          bis_2_5t: { de: "Bis 2,5 t (z. B. Pkw, kleiner Transporter)", en: "Up to 2.5 t (e.g. car, small van)" },
          "2_5_bis_2_8t": { de: "Über 2,5 bis 2,8 t", en: "Over 2.5 up to 2.8 t" },
          "2_8_bis_3_5t": { de: "Über 2,8 bis 3,5 t (z. B. Sprinter)", en: "Over 2.8 up to 3.5 t (e.g. large van)" },
          ueber_3_5t: { de: "Über 3,5 t (Lkw)", en: "Over 3.5 t (truck)" },
        },
      },
      {
        feld: "fahrzeuge.ausland",
        art: "janein",
        frage: { de: "Fahrt ihr mit Waren auch ins Ausland?", en: "Do you also carry goods abroad?" },
        hilfe: { de: "Grenzüberschreitende Fahrten oder Fahrten innerhalb eines anderen EU-Staats. Dafür gelten ab 2,5 t eigene Regeln.", en: "Cross-border trips or trips within another EU country. Separate rules apply from 2.5 t." },
      },
      {
        feld: "umwelt.taetigkeiten",
        art: "mehrfach",
        frage: { de: "Was davon trifft auf deinen Betrieb zu?", en: "Which of these apply to your business?" },
        hilfe: { de: "Für diese Tätigkeiten gelten Regeln zu Abfall, Rücknahme und Umweltschutz.", en: "Rules on waste, take-back and environmental protection apply to these activities." },
        optionen: {
          gefaehrliche_abfaelle: { de: "Es fallen gefährliche Abfälle an (z. B. Altöl, Ölfilter, Bremsflüssigkeit, ölige Lappen, Lösemittel)", en: "Hazardous waste arises (e.g. waste oil, oil filters, brake fluid, oily rags, solvents)" },
          oelverkauf: { de: "Ich verkaufe Motor- oder Getriebeöl an Endverbraucher", en: "I sell engine or gear oil to end users" },
          starterbatterien: { de: "Ich verkaufe Fahrzeugbatterien (Starterbatterien)", en: "I sell vehicle batteries (starter batteries)" },
          klimaservice: { de: "Klimaanlagen-Service an Fahrzeugen", en: "Air-conditioning service on vehicles" },
          abscheider: { de: "Wir haben einen Öl- oder Leichtflüssigkeitsabscheider (z. B. Waschplatz)", en: "We have an oil or light-liquid separator (e.g. washing bay)" },
          keine: { de: "Nichts davon", en: "None of these" },
        },
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
        hilfe: { de: `Das legt das Finanzamt fest; es steht in deinen ELSTER-Bescheiden, oder du fragst deine Steuerberatung. Wenn du es nicht weißt: „Weiß ich nicht“ – dann rechnet ${MARKE.name} mit der Steuer des Vorjahres, ohne diese Angabe vorläufig vierteljährlich.`, en: `The tax office decides; you find it in your ELSTER notices or can ask your tax adviser. If you don't know: “I don't know” – ${MARKE.name} then uses last year's tax, without it provisionally quarterly.` },
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
        feld: "vertrieb.fernabsatz",
        art: "janein",
        frage: { de: "Nimmst du Aufträge von Privatkunden per Telefon, E-Mail oder Messenger an?", en: "Do you accept orders from private customers by phone, email or messenger?" },
        hilfe: {
          de: "Gemeint sind Aufträge, ohne dass ihr euch vorher persönlich trefft – etwa ein Angebot per E-Mail, das der Kunde per WhatsApp bestätigt. Das ist in der Regel ein Fernabsatzvertrag mit Widerrufsrecht (§ 312c BGB).",
          en: "This means orders without meeting in person beforehand – e.g. a quote by email that the customer confirms via WhatsApp. This is usually a distance contract with a right of withdrawal (§ 312c BGB).",
        },
      },
      {
        feld: "verkauf.alkohol_tabak",
        art: "mehrfach",
        frage: { de: "Verkaufst oder schenkst du Alkohol oder Tabak aus?", en: "Do you sell or serve alcohol or tobacco?" },
        hilfe: { de: "Auch E-Zigaretten und Shishas zählen als Tabak. Dann gilt der Jugendschutz.", en: "E-cigarettes and shishas count as tobacco too. Youth protection rules then apply." },
        optionen: {
          alkohol: { de: "Alkohol (Bier, Wein, Spirituosen)", en: "Alcohol (beer, wine, spirits)" },
          tabak: { de: "Tabakwaren, E-Zigaretten oder Shishas", en: "Tobacco, e-cigarettes or shishas" },
          keine: { de: "Nichts davon", en: "None of these" },
        },
      },
      {
        feld: "oeffentliche_wiedergabe",
        art: "janein",
        frage: { de: "Läuft bei dir Musik, Radio oder Fernsehen für Kundschaft oder Gäste?", en: "Do you play music, radio or TV for customers or guests?" },
        hilfe: { de: "Auch Musik in Kursen oder im Wartebereich zählt. Das ist eine öffentliche Wiedergabe – dafür brauchst du eine Lizenz, etwa von der GEMA.", en: "Music in classes or in the waiting area counts too. This is a public performance – you need a licence for it, for example from GEMA." },
      },
      {
        feld: "nachunternehmer",
        art: "janein",
        frage: { de: "Beauftragst du Subunternehmer?", en: "Do you hire subcontractors?" },
        hilfe: { de: "Andere Firmen oder Solo-Selbstständige, die Aufträge ausführen, die du übernommen hast – zum Beispiel Fahrer, Reinigungs- oder Baufirmen.", en: "Other companies or solo self-employed people who carry out orders you took on – for example drivers, cleaning or construction firms." },
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
        frage: { de: "Bist du selbst Hersteller deiner Produkte?", en: "Are you the manufacturer of your products?" },
        hilfe: { de: "Ja, wenn du eigene Produkte herstellst, unter deinem eigenen Namen verkaufst oder von außerhalb der EU importierst. Wenn du nur fertige Markenware anderer Hersteller weiterverkaufst oder verwendest: Nein.", en: "Yes if you make your own products, sell them under your own name or brand, or import them from outside the EU. If you only resell or use finished branded goods from other manufacturers: No." },
      },
      {
        feld: "produkte.erstinverkehrbringer",
        art: "janein",
        frage: { de: "Bringst du Elektrogeräte oder Batterien erstmals in Deutschland in Verkehr?", en: "Do you place electrical devices or batteries on the German market for the first time?" },
        hilfe: { de: "Also als Hersteller, unter deiner eigenen Marke oder als Importeur. Kaufst du die Geräte bei einem Händler in Deutschland und verkaufst oder baust sie nur ein, ist das in der Regel nicht der Fall.", en: "That is as manufacturer, under your own brand or as importer. If you buy the devices from a dealer in Germany and only resell or install them, this is usually not the case." },
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
        frage: { de: "Hast du ein Geschäftsprofil in sozialen Netzwerken?", en: "Do you have a business profile on social networks?" },
        hilfe: { de: "Zum Beispiel bei Instagram, Facebook oder LinkedIn. Auch dort brauchst du ein Impressum.", en: "For example on Instagram, Facebook or LinkedIn. You need a legal notice (Impressum) there too." },
      },
      {
        feld: "handel.hohe_bargeschaefte",
        art: "janein",
        frage: { de: "Nimmst du für Waren hohe Barzahlungen an (in Höhe der Schwelle des Geldwäschegesetzes)?", en: "Do you accept large cash payments for goods (at the threshold of the Anti-Money Laundering Act)?" },
        hilfe: { de: "Wenn du nur Dienstleistungen verkaufst oder keine großen Beträge bar annimmst: Nein.", en: "If you only sell services or don't accept large amounts in cash: No." },
      },
      {
        // R12 (Nutzertests Kurier #14, Coach #14): ohne Bargeld keine Kasse – „Keine Kasse, nur Rechnungen“
        feld: "kasse.bargeld",
        art: "janein",
        frage: { de: "Nimmst du Bargeld an?", en: "Do you accept cash?" },
        hilfe: { de: "Wenn du nur Rechnungen schreibst und per Überweisung oder Karte bezahlt wirst: Nein – dann brauchst du keine Kasse.", en: "If you only issue invoices and are paid by transfer or card: No – then you don't need a till." },
      },
      {
        feld: "kasse.elektronisch",
        art: "janein",
        frage: { de: "Nutzt du für das Bargeld eine elektronische Kasse?", en: "Do you use an electronic till for cash?" },
        hilfe: {
          de: "Ein Kartenterminal allein ist keine Kasse, eine Kassen-App auf Handy oder Tablet schon. Nimmst du Bargeld ohne elektronische Kasse an, führst du eine offene Ladenkasse mit Kassenbericht. Weißt du es noch nicht, überspring die Frage.",
          en: "A card terminal alone is not a till, but a till app on a phone or tablet is. If you take cash without an electronic till, you keep an open cash box with a daily cash report. If you don't know yet, skip the question.",
        },
      },
      {
        feld: "kasse.angeschafft_am",
        art: "datum",
        frage: { de: "Seit wann hast du eine elektronische Kasse – oder wann schaffst du sie an?", en: "Since when have you had an electronic till – or when will you get it?" },
        // R12 (Nutzertest Bäckerei #12): mehrere Kassen – jede wird gemeldet
        hilfe: {
          de: "Ab diesem Tag hast du einen Monat Zeit, sie dem Finanzamt zu melden. Hast du mehrere Kassen, gib die erste an – jede weitere meldest du ebenso innerhalb eines Monats nach der Anschaffung, je Betriebsstätte.",
          en: "From this day you have one month to report it to the tax office. If you have several tills, enter the first – you report each further till within one month of purchase as well, per business premises.",
        },
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
          spedition_logistik: { de: "Spedition, Transport und Logistik (auch Kurier-, Express- und Paketdienste)", en: "Haulage, transport and logistics (including courier, express and parcel services)" },
          schausteller: { de: "Schaustellergewerbe", en: "Fairground and showmen's trade" },
          gebaeudereinigung: { de: "Gebäudereinigung", en: "Building cleaning" },
          messebau: { de: "Auf- und Abbau von Messen und Ausstellungen", en: "Setting up and dismantling trade fairs and exhibitions" },
          fleischwirtschaft: { de: "Fleischwirtschaft (ohne Fleischerhandwerk)", en: "Meat industry (excluding butchers' trade)" },
          prostitution: { de: "Prostitutionsgewerbe", en: "Prostitution trade" },
          sicherheitsgewerbe: { de: "Wach- und Sicherheitsgewerbe", en: "Guarding and security services" },
          friseur: { de: "Friseurgewerbe", en: "Hairdressing" },
          kosmetik: { de: "Kosmetikgewerbe (z. B. Kosmetik-, Nagelstudio)", en: "Beauty trade (e.g. beauty or nail salon)" },
          lieferdienste: { de: "Plattformbasierte Lieferdienste (Bestellungen kommen über eine App oder Online-Plattform, z. B. Essenslieferung)", en: "Platform-based delivery services (orders come via an app or online platform, e.g. food delivery)" },
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
        frage: { de: "Beschäftigst du Menschen von außerhalb der EU?", en: "Do you employ people from outside the EU?" },
        hilfe: {
          de: "Gemeint sind Menschen ohne Staatsangehörigkeit eines EU-Staats, Islands, Liechtensteins, Norwegens oder der Schweiz. Dann prüfst du vor Beginn, ob sie bei dir arbeiten dürfen, und bewahrst eine Kopie des Aufenthaltstitels auf.",
          en: "This means people who are not nationals of an EU country, Iceland, Liechtenstein, Norway or Switzerland. Then you check before they start whether they may work for you and keep a copy of the residence permit.",
        },
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
      {
        feld: "arbeitsschutz.gefahrstoffe",
        art: "janein",
        frage: { de: "Arbeitet ihr mit Gefahrstoffen?", en: "Do you work with hazardous substances?" },
        // R12 (Nutzertest Bäckerei #6): Mehl hat kein Warnzeichen – Mehlstaub ist trotzdem ein Gefahrstoff
        hilfe: {
          de: "Zum Beispiel Reinigungs-, Lösungs- oder Färbemittel mit Warnzeichen – aber auch Mehlstaub in der Backstube, Holzstaub, Schweißrauch, Abgase oder Bremsenreiniger in der Werkstatt.",
          en: "For example cleaning agents, solvents or dyes with warning symbols – but also flour dust in the bakery, wood dust, welding fumes, exhaust fumes or brake cleaner in the workshop.",
        },
      },
      {
        feld: "arbeitszeit.nachtarbeit",
        art: "janein",
        frage: { de: "Arbeitet bei dir jemand regelmäßig nachts?", en: "Does anyone work for you regularly at night?" },
        hilfe: {
          de: "Gemeint ist Arbeit von mehr als zwei Stunden zwischen 23 und 6 Uhr – in Bäckereien und Konditoreien zwischen 22 und 5 Uhr (§ 2 Abs. 3, 4 ArbZG).",
          en: "This means more than two hours of work between 11 pm and 6 am – in bakeries and confectioneries between 10 pm and 5 am (§ 2(3), (4) ArbZG).",
        },
      },
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
          ortung: { de: "Ortung von Fahrzeugen oder Beschäftigten (GPS, Telematik)", en: "Tracking of vehicles or staff (GPS, telematics)" },
          keine: { de: "Keine", en: "None" },
        },
      },
      // Vorprüfung 21.10.2026 (F.61): Datenschutzbeauftragter unabhängig von der Zahl (Art. 37 Abs. 1 Buchst. b, c DSGVO, § 38 Abs. 1 Satz 2 BDSG)
      {
        feld: "datenschutz.dsb_gruende",
        art: "mehrfach",
        frage: { de: "Trifft einer dieser Fälle auf deine Datenverarbeitung zu?", en: "Does any of these apply to your data processing?" },
        optionen: {
          kerntaetigkeit_ueberwachung: {
            de: "Kern deines Geschäfts ist, Menschen umfangreich und regelmäßig zu beobachten (z. B. Ortung, Tracking oder Videoüberwachung als Dienstleistung)",
            en: "The core of your business is extensive, regular monitoring of people (e.g. location tracking, web tracking or video surveillance as a service)",
          },
          kerntaetigkeit_besondere_daten: {
            de: "Kern deines Geschäfts ist, in großem Umfang Gesundheitsdaten oder andere besondere Daten zu verarbeiten",
            en: "The core of your business is processing health data or other special categories of data on a large scale",
          },
          dsfa_pflichtig: { de: "Für eine Verarbeitung ist eine Datenschutz-Folgenabschätzung nötig", en: "A data protection impact assessment is required for a processing operation" },
          uebermittlung_marktforschung: {
            de: "Du verarbeitest Daten geschäftsmäßig, um sie weiterzugeben, oder für Markt- und Meinungsforschung",
            en: "You process data commercially in order to pass it on, or for market or opinion research",
          },
          keine: { de: "Nichts davon", en: "None of these" },
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
