/**
 * Pflichten-Check (E-126): wenige Fragen zum Betrieb, dann rechnet die Regel-Engine auf dem Gerät aus, welche Pflichten
 * aus dem Katalog gelten – derselbe Katalog und dieselbe Engine wie auf dem Server (E-119). Nichts wird erfunden:
 * Titel, Texte, Termine und Einstufungen kommen aus dem Katalog (fachlich noch ungeprüft, das sagt die App).
 * Reine Funktionen, ohne Gerät testbar.
 */
import { VORLAGEN, fehlendeAngaben, vorlageFuer, type Betrieb } from "@amtlos/fachlogik";
// Monatsende-Regel der Fristen: 31.01. + 1 Monat = 28./29.02., 29.02. + 12 Monate = 28.02.
import { StandardKalender, plusMonate } from "@amtlos/fristen";
import { SCHRITTE, type Frage } from "@amtlos/i18n";
import { QUELLFAKTEN, auswerten, entscheidendeSaetze, zuErfragendeFakten, type Ereignis, type Katalog, type Knoten, type Pflicht } from "@amtlos/rules-engine";
import roh from "./katalog.json";
import { istGeprueft, offeneRegelwerte, pruefVermerk, type PruefungRoh, type RegelwertRoh } from "./pruefer";

export const KATALOG = roh as unknown as Katalog;
/** E-211: Regelwerte mit Prüfstand – nicht bestätigte stehen im Vermerk der Pflichten, die auf sie verweisen */
export const REGELWERTE = KATALOG.regelwerte as unknown as readonly RegelwertRoh[];

/** Regelwert aus dem Katalog (z. B. Aufbewahrungsfristen) – keine Zahl in der App ist erfunden. */
export function regelwert(id: string): number | null {
  const r = (KATALOG as unknown as { regelwerte?: { id: string; wert: unknown }[] }).regelwerte?.find((x) => x.id === id);
  return typeof r?.wert === "number" ? r.wert : null;
}

/** Profil wie im Server (Schlüssel ohne „profil.“): Auswahl → Text, Mehrfach → Liste, Ja/Nein → boolean, Zahl → number, Datum → ISO. */
export type Profil = Record<string, string | number | boolean | string[] | null>;

/**
 * Die Fragen des Checks, in dieser Reihenfolge: der Schnellstart (E-111) plus Kasse und Website. Branche zuerst – die
 * kennt jede und jeder; die Gesellschafts-Frage nur bei UG und GmbH (wie im Fragebogen). R10: dazu die Fragen, die je
 * Branche entscheiden (Minijob, unter 18, Sofortmeldebranche, Geräte, Gefahrstoffe, Bauleistungen, Lohnbüro) – nur, wenn
 * sie passen (siehe `FRAGE_PASST`).
 */
export const CHECK_FELDER = [
  "taetigkeit.branchen",
  "rechtsform",
  "gesellschaft.handelsregister",
  // R12 (UX #20): das Startdatum steuert Gründungsschritte und „Was hast du schon?“ – direkt nach der Rechtsform
  "gruendungsdatum",
  // Steuerberater 22.10.2026: bei eingetragenen Gesellschaften der Beginn der Tätigkeit (Frist des Fragebogens, § 138 Abs. 4 AO)
  "taetigkeit_beginn",
  "taetigkeit.einordnung",
  "bundesland",
  // R12 (Rechtsprüfung Befund 7, Bäckerei #4, Kfz #9): Betriebsstätten für Rundfunkbeitrag, Gewerbeabfall, Registrierung
  "betriebsstaetten.anzahl",
  "beschaeftigte.gesamt",
  "beschaeftigte.minijob",
  "beschaeftigte.jugendlich",
  // R12 (Kfz #9, Bäckerei #16): Azubis direkt nach „unter 18“
  "beschaeftigte.azubi",
  // R12 (Coach #1): Rentenversicherungspflicht selbstständiger Lehrender – laufende Beitragspflicht, im Kern-Check
  "rentenversicherung.pflichtgruppe",
  "personal.sofortmeldebranchen",
  // R11 (Rechtsprüfung Befund 7, Nutzertests Gründerin und Gebäudereinigung): Lebensmittel, Drittstaaten
  "ifsg.beschaeftigte",
  "personal.drittstaaten",
  "personal.lohn_durch",
  "arbeitsschutz.elektrische_geraete",
  "arbeitsschutz.gefahrstoffe",
  // R12 (Bäckerei #2): Nachtarbeit; (Kurier #2–4, Kfz #1): Fahrzeuge und Umwelt
  "arbeitszeit.nachtarbeit",
  "fahrzeuge.anzahl",
  "fahrzeuge.gesamtmasse",
  "fahrzeuge.ausland",
  // Prüfvermerk Rechtsanwalt 22.10.2026 (H.5): Werkverkehr erlaubnisfrei, Personenbeförderung mit Genehmigung
  "fahrzeuge.befoerderung",
  "umwelt.taetigkeiten",
  "bauleistungen.fuer_unternehmen",
  // R12 (Kurier #5, Zoll #13): Subunternehmer
  "nachunternehmer",
  // R11 (Kosmetik #23, Rechtsprüfung Befund 10): Handwerksrolle bzw. Verzeichnis, Verträge beim Kunden zu Hause
  "handwerk.anlage",
  "vertrieb.ausserhalb_geschaeftsraeume",
  // R12 (Rechtsprüfung Befund 2): Aufträge per Telefon, E-Mail oder Messenger (Fernabsatz)
  "vertrieb.fernabsatz",
  // R11 (Nutzertest Gründerin #2): bei Gastronomie die Fragen, ohne die man nicht starten darf
  "ifsg.selbst",
  "erlaubnis.gewo_paragraphen",
  "erlaubnis.gaststaette",
  "erlaubnis.alkohol",
  // R12 (Rechtsprüfung Befunde 3, 4): Jugendschutz, Musik für Kundschaft
  "verkauf.alkohol_tabak",
  "gastro.to_go",
  // Prüfbericht Lebensmittelhygiene 22.10.2026 (Frage 14): abgepackte Ware im Regal; Wassertank im Foodtruck oder Stand
  "gastro.vorverpackt",
  // Rückmeldung Lebensmittel Lebensmittelfachbeauftragter 22.10.2026: Acrylamid nur, wer selbst backt oder frittiert
  "gastro.backen_frittieren",
  "gastro.wassertank",
  "gastro.wassertank_ab",
  "oeffentliche_wiedergabe",
  // R12 (Coach #5, Kurier #8): Gesundheitsdaten der Teilnehmenden, Ortung der Fahrer
  "datenverarbeitung.arten",
  "alg1_bezug",
  // R12 (Kurier #14, Coach #14): erst Bargeld, dann Kasse – „keine Kasse, nur Rechnungen“
  "kasse.bargeld",
  "kasse.elektronisch",
  "kasse.angeschafft_am",
  "online.website",
  "online.social_media",
  "ust.kleinunternehmer",
  // R12 (UX #3): Rhythmus der Voranmeldung, sobald die Kleinunternehmerregelung verneint ist – sonst bleibt „Dein Jahr“ leer
  "ust.voranmeldung_rhythmus",
  "steuerberater",
] as const;

const FRAGE = new Map<string, { frage: Frage; nurWenn?: { feld: string; in: string[] } }>();
for (const s of SCHRITTE) for (const f of s.fragen) FRAGE.set(f.feld, { frage: f, nurWenn: s.nurWenn });

// R10: Fragen, die nur zu bestimmten Betrieben passen – im Check und bei „Kurz klären“
const branchen = (p: Profil) => (Array.isArray(p["taetigkeit.branchen"]) ? (p["taetigkeit.branchen"] as string[]) : []);
const inBranche = (p: Profil, ...b: string[]) => branchen(p).some((x) => b.includes(x));
const mitTeam = (p: Profil) => typeof p["beschaeftigte.gesamt"] === "number" && (p["beschaeftigte.gesamt"] as number) >= 1;
const ohneTeam = (p: Profil) => p["beschaeftigte.gesamt"] === 0;
const freiberuflich = (p: Profil) => p.rechtsform === "freiberuf" || p["taetigkeit.einordnung"] === "freiberuf";
/** Einzelpersonen ohne Gesellschaft (Investoren-Frage nur für Gesellschaften, Nutzertest R10) */
export const EINZELPERSON = ["einzelunternehmen", "freiberuf", "ek"];
const PERSONAL_FRAGEN = ["beschaeftigte.minijob", "beschaeftigte.azubi", "beschaeftigte.jugendlich", "beschaeftigte.schwanger", "personal.sofortmeldebranchen", "personal.lohnsteuer_anmeldezeitraum", "personal.lohn_durch", "arbeitsschutz.elektrische_geraete", "arbeitsschutz.gefahrstoffe", "ifsg.beschaeftigte", "personal.drittstaaten"];
/** R11 (Nutzertest Gründerin #9, E-076): Fragen zum Vorjahr – vor dem Start bzw. im Gründungsjahr gibt es kein Vorjahr */
const VORJAHR_FRAGEN = ["umsatz.vorjahr", "gewinn.vorjahr", "ust.zahllast_vorjahr", "ust.dauerfristverlaengerung", "vorauszahlung.est_kst", "vorauszahlung.gewst"];
/** R11 (Nutzertest Tischlerei #21): UG, GmbH und GmbH & Co. KG sind kraft Rechtsform gewerblich (§ 2 Abs. 2 GewStG) */
const KRAFT_RECHTSFORM_GEWERBE = ["ug", "gmbh", "gmbh_co_kg"];
/** Jahr des Starts liegt im laufenden Jahr oder später (Europe/Berlin) – dann gibt es kein Vorjahr des Betriebs. */
const ohneVorjahr = (p: Profil, heute = heuteBerlin()) => typeof p.gruendungsdatum === "string" && ISO.test(p.gruendungsdatum) && p.gruendungsdatum.slice(0, 4) >= heute.slice(0, 4);
/** R12: Betrieb läuft seit mehr als sechs Monaten (wie `bestehend` in der Auswertung) */
const laengerAlsBestand = (p: Profil, heute = heuteBerlin()) => typeof p.gruendungsdatum === "string" && ISO.test(p.gruendungsdatum) && p.gruendungsdatum <= plusMonate(heute, -BESTAND_AB_MONATEN);
const zahl = (p: Profil, feld: string) => (typeof p[feld] === "number" ? (p[feld] as number) : null);
const liste = (p: Profil, feld: string) => (Array.isArray(p[feld]) ? (p[feld] as string[]) : null);
/** R12 (Coach #1): Einzelperson ohne versicherungspflichtige Beschäftigte – keine Beschäftigten oder nur Minijobs */
const ohneVersicherungspflichtigeBeschaeftigte = (p: Profil) => ohneTeam(p) || (zahl(p, "beschaeftigte.gesamt") !== null && zahl(p, "beschaeftigte.minijob") === zahl(p, "beschaeftigte.gesamt"));
/** R12 (Kurier #2): Fahrzeuge zwischen 2,5 und 3,5 t – nur dann entscheidet die Frage nach Auslandsfahrten */
const MITTELSCHWER = ["2_5_bis_2_8t", "2_8_bis_3_5t"];

/** Passt eine Frage überhaupt (immer, auch bei „Kurz klären“)? Bei 0 Beschäftigten keine Fragen zum Personal. */
function passtImmer(feld: string, p: Profil): boolean {
  if (PERSONAL_FRAGEN.includes(feld) && ohneTeam(p)) return false;
  // R12 (Coach #1): Gründungszuschuss gibt es nur vor dem Start – bei Bestandsbetrieben keine Frage nach Arbeitslosengeld
  if (feld === "alg1_bezug" && laengerAlsBestand(p)) return false;
  // R12: Rentenversicherungspflicht selbstständiger Personen – nicht für Kapitalgesellschaften
  if (feld === "rentenversicherung.pflichtgruppe" && typeof p.rechtsform === "string" && KRAFT_RECHTSFORM_GEWERBE.includes(p.rechtsform)) return false;
  // R12 (Kurier #2): ohne Firmenfahrzeuge keine Fragen zu Gewicht und Ausland; Ausland nur bei 2,5 bis 3,5 t
  if ((feld === "fahrzeuge.gesamtmasse" || feld === "fahrzeuge.ausland") && zahl(p, "fahrzeuge.anzahl") === 0) return false;
  if (feld === "fahrzeuge.ausland" && liste(p, "fahrzeuge.gesamtmasse") && !liste(p, "fahrzeuge.gesamtmasse")!.some((x) => MITTELSCHWER.includes(x))) return false;
  if (feld === "fahrzeuge.befoerderung" && zahl(p, "fahrzeuge.anzahl") === 0) return false;
  // Prüfvermerk Rechtsanwalt 22.10.2026: Produktliste nach § 1 Abs. 2 BFSG nur bei Elektrogeräten, erstes Inverkehrbringen nur bei verpackter Ware
  if (feld === "produkte.bfsg_produkte" && liste(p, "produkte.arten") && !liste(p, "produkte.arten")!.includes("elektrogeraete")) return false;
  if (feld === "produkte.verpackung_ab" && liste(p, "produkte.arten") && !liste(p, "produkte.arten")!.includes("verpackung")) return false;
  // R12 (Kurier #14): wer kein Bargeld annimmt, braucht keine Kasse
  if (feld === "kasse.elektronisch" && p["kasse.bargeld"] === false) return false;
  // R12 (UX #3): wer die Kleinunternehmerregelung nutzt, gibt keine Voranmeldung ab
  if (feld === "ust.voranmeldung_rhythmus" && p["ust.kleinunternehmer"] === true) return false;
  if (VORJAHR_FRAGEN.includes(feld) && ohneVorjahr(p)) return false;
  // R11 (Nutzertest Kosmetik #1): wer die Kleinunternehmerregelung nutzt, gibt keine Voranmeldung ab – keine Frage nach der Zahllast
  if ((feld === "ust.zahllast_vorjahr" || feld === "ust.dauerfristverlaengerung") && p["ust.kleinunternehmer"] === true) return false;
  // Steuerberater 22.10.2026: Kleinunternehmer geben keine Zusammenfassende Meldung ab (§ 18a Abs. 4 UStG)
  if (feld === "ust.zm_meldezeitraum" && p["ust.kleinunternehmer"] === true) return false;
  if (feld === "taetigkeit.einordnung" && typeof p.rechtsform === "string" && KRAFT_RECHTSFORM_GEWERBE.includes(p.rechtsform)) return false;
  // R11: Lebensmittel-Fragen nach § 42 IfSG nur in der Gastronomie und Lebensmittelbranche
  if ((feld === "ifsg.beschaeftigte" || feld === "ifsg.selbst" || feld === "gastro.to_go" || feld === "gastro.backen_frittieren" || feld === "gastro.wassertank") && !inBranche(p, "gastronomie_lebensmittel")) return false;
  // Rückmeldung Lebensmittelfachbeauftragter 22.10.2026: selbst abgepackte Lebensmittel auch im Onlinehandel mit Lebensmitteln
  if (feld === "gastro.vorverpackt" && !inBranche(p, "gastronomie_lebensmittel") && !(inBranche(p, "onlinehandel") && (liste(p, "produkte.arten")?.includes("lebensmittel") ?? true))) return false;
  // Inbetriebnahme des Wassertanks nur, wenn es einen gibt (wie die Anschaffung der Kasse)
  if (feld === "gastro.wassertank_ab" && p["gastro.wassertank"] !== true) return false;
  // Prüfvermerk Rechtsanwalt 22.10.2026: Beginn der NIS2-Betroffenheit nur, wenn das Unternehmen darunter fällt
  if (feld === "nis2.betroffen_seit" && p["nis2.betroffen"] !== "ja") return false;
  // Alkoholausschank nur bei Gaststätte bzw. Getränkeausschank; Anschaffung der Kasse nur mit elektronischer Kasse
  if (feld === "erlaubnis.alkohol" && p["erlaubnis.gaststaette"] !== true) return false;
  if (feld === "kasse.angeschafft_am" && p["kasse.elektronisch"] !== true) return false;
  // „Freiberuflich (ohne Gewerbe)“ beantwortet die Frage nach Gewerbe oder freiem Beruf schon (Nutzertest Lea)
  if (feld === "taetigkeit.einordnung" && p.rechtsform === "freiberuf") return false;
  if (feld === "gesellschafter.auslaendische_investoren" && typeof p.rechtsform === "string" && EINZELPERSON.includes(p.rechtsform)) return false;
  return true;
}

/**
 * Zusätzliche Bedingungen im Kern-Check: die branchentypischen Fragen nur, wo sie entscheiden (Nutzertests R10: Beauty
 * Gefahrstoffe und Geräte, Handwerk Bauleistungen, Geräte und unter 18, Gastronomie Minijob direkt nach der Zahl der
 * Beschäftigten); die Kassenfrage nicht für Freiberufler ohne Laden-Branche; Social Media nur ohne eigene Website.
 */
const FRAGE_PASST: Record<string, (p: Profil) => boolean> = {
  "beschaeftigte.minijob": mitTeam,
  "beschaeftigte.jugendlich": (p) => mitTeam(p) && inBranche(p, "handwerk", "bau", "beauty_kosmetik", "gastronomie_lebensmittel"),
  "beschaeftigte.azubi": (p) => mitTeam(p) && inBranche(p, "handwerk", "bau", "beauty_kosmetik", "gastronomie_lebensmittel", "gesundheit_pflege"),
  // R12 (Coach #1): Einzelpersonen ohne versicherungspflichtige Beschäftigte (§ 2 S. 1 Nr. 1, 2, 9 SGB VI)
  "rentenversicherung.pflichtgruppe": (p) => typeof p.rechtsform === "string" && EINZELPERSON.includes(p.rechtsform) && ohneVersicherungspflichtigeBeschaeftigte(p),
  "arbeitszeit.nachtarbeit": (p) => mitTeam(p) && inBranche(p, "gastronomie_lebensmittel", "transport_logistik", "gesundheit_pflege", "gebaeudereinigung"),
  "fahrzeuge.anzahl": (p) => inBranche(p, "transport_logistik", "handwerk", "bau", "gebaeudereinigung"),
  "fahrzeuge.gesamtmasse": (p) => inBranche(p, "transport_logistik") && (zahl(p, "fahrzeuge.anzahl") ?? 0) >= 1,
  "fahrzeuge.befoerderung": (p) => inBranche(p, "transport_logistik") && (zahl(p, "fahrzeuge.anzahl") ?? 0) >= 1,
  "fahrzeuge.ausland": (p) => inBranche(p, "transport_logistik") && (zahl(p, "fahrzeuge.anzahl") ?? 0) >= 1 && Boolean(liste(p, "fahrzeuge.gesamtmasse")?.some((x) => MITTELSCHWER.includes(x))),
  "umwelt.taetigkeiten": (p) => inBranche(p, "handwerk"),
  "nachunternehmer": (p) => inBranche(p, "bau", "gebaeudereinigung", "transport_logistik"),
  "vertrieb.fernabsatz": (p) => inBranche(p, "handwerk", "bau", "beauty_kosmetik", "gebaeudereinigung", "unterricht_sport_coaching"),
  // Gaststätte mit Alkohol löst den Jugendschutz schon aus; gefragt wird bei Läden, Kiosken und Lebensmittelbetrieben ohne Ausschank
  "verkauf.alkohol_tabak": (p) => inBranche(p, "onlinehandel", "sonstige") || (inBranche(p, "gastronomie_lebensmittel") && p["erlaubnis.gaststaette"] === false),
  "oeffentliche_wiedergabe": (p) => inBranche(p, "gastronomie_lebensmittel", "beauty_kosmetik", "unterricht_sport_coaching", "gesundheit_pflege"),
  "datenverarbeitung.arten": (p) => inBranche(p, "unterricht_sport_coaching", "transport_logistik"),
  "ust.voranmeldung_rhythmus": (p) => p["ust.kleinunternehmer"] === false,
  // R11 (Nutzertest Gebäudereinigung #3): ab einer beschäftigten Person für alle – außer Beauty und Gebäudereinigung, die die Branche schon auslöst
  "personal.sofortmeldebranchen": (p) => mitTeam(p) && !inBranche(p, "beauty_kosmetik", "gebaeudereinigung"),
  "ifsg.beschaeftigte": (p) => mitTeam(p) && inBranche(p, "gastronomie_lebensmittel"),
  "personal.drittstaaten": (p) => mitTeam(p) && inBranche(p, "gebaeudereinigung", "bau", "gastronomie_lebensmittel", "transport_logistik"),
  "handwerk.anlage": (p) => inBranche(p, "handwerk", "bau", "beauty_kosmetik"),
  "vertrieb.ausserhalb_geschaeftsraeume": (p) => inBranche(p, "handwerk", "bau", "beauty_kosmetik"),
  "ifsg.selbst": (p) => inBranche(p, "gastronomie_lebensmittel"),
  // R12 (UX #9): nur, wo eine Vorschrift der Gewerbeordnung typisch ist – mit den passenden Optionen (`GEWO_OPTIONEN`)
  "erlaubnis.gewo_paragraphen": (p) => inBranche(p, "gastronomie_lebensmittel", "immobilien_finanzen", "gesundheit_pflege", "sonstige"),
  "erlaubnis.gaststaette": (p) => inBranche(p, "gastronomie_lebensmittel"),
  "erlaubnis.alkohol": (p) => inBranche(p, "gastronomie_lebensmittel"),
  "gastro.to_go": (p) => inBranche(p, "gastronomie_lebensmittel"),
  "gastro.vorverpackt": (p) => inBranche(p, "gastronomie_lebensmittel") || (inBranche(p, "onlinehandel") && Boolean(liste(p, "produkte.arten")?.includes("lebensmittel"))),
  "gastro.backen_frittieren": (p) => inBranche(p, "gastronomie_lebensmittel"),
  // Wassertank nur beim mobilen Verkauf – Reisegewerbe oder Marktstand (wie der Auslöser von branche.gastro_trinkwasser_mobil)
  "gastro.wassertank": (p) => inBranche(p, "gastronomie_lebensmittel") && (Boolean(liste(p, "erlaubnis.gewo_paragraphen")?.includes("55")) || Boolean(liste(p, "vertrieb.kanaele")?.includes("marktstand"))),
  "gastro.wassertank_ab": (p) => p["gastro.wassertank"] === true,
  "alg1_bezug": (p) => inBranche(p, "gastronomie_lebensmittel") && (typeof p.gruendungsdatum !== "string" || ohneVorjahr(p)),
  "personal.lohn_durch": mitTeam,
  "arbeitsschutz.elektrische_geraete": (p) => mitTeam(p) && inBranche(p, "handwerk", "bau", "beauty_kosmetik"),
  // R12 (Bäckerei #6): auch Lebensmittelbetriebe – Mehlstaub in der Backstube, Reinigungsmittel in der Küche
  "arbeitsschutz.gefahrstoffe": (p) => mitTeam(p) && inBranche(p, "beauty_kosmetik", "handwerk", "bau", "gastronomie_lebensmittel"),
  "bauleistungen.fuer_unternehmen": (p) => inBranche(p, "handwerk", "bau"),
  "kasse.angeschafft_am": (p) => p["kasse.elektronisch"] === true,
  "kasse.bargeld": (p) => !freiberuflich(p) || inBranche(p, "gastronomie_lebensmittel", "beauty_kosmetik", "handwerk", "gesundheit_pflege", "unterricht_sport_coaching"),
  "kasse.elektronisch": (p) => (!freiberuflich(p) || inBranche(p, "gastronomie_lebensmittel", "beauty_kosmetik", "handwerk", "gesundheit_pflege", "unterricht_sport_coaching")) && p["kasse.bargeld"] === true,
  "online.social_media": (p) => p["online.website"] === false,
};

/**
 * R12 (UX #9): Optionen der Frage „Fällt deine Tätigkeit unter eine dieser Vorschriften?“ je Branche – ein Café sieht nicht
 * „§ 31 Bewachung auf Seeschiffen“. Ohne passende Branche alle Optionen; schon gewählte Optionen bleiben immer sichtbar.
 */
const GEWO_OPTIONEN: Record<string, string[]> = {
  // Spielgeräte in Gaststätten, Reisegewerbe (Foodtruck, Marktstand)
  gastronomie_lebensmittel: ["33c", "33d", "55"],
  immobilien_finanzen: ["34", "34b", "34c", "34d", "34e", "34f", "34h", "34i"],
  gesundheit_pflege: ["30"],
  // Schlüsseldienst und Einbau von Sicherungseinrichtungen (§ 38), Reisegewerbe
  handwerk: ["38", "55"],
  beauty_kosmetik: ["55"],
};
function frageFuerProfil(f: Frage, p: Profil): Frage {
  if (f.feld !== "erlaubnis.gewo_paragraphen" || !f.optionen) return f;
  const b = branchen(p);
  if (!b.length || b.some((x) => !GEWO_OPTIONEN[x])) return f;
  const erlaubt = new Set([...b.flatMap((x) => GEWO_OPTIONEN[x]!), "keine", ...(liste(p, f.feld) ?? [])]);
  return { ...f, optionen: Object.fromEntries(Object.entries(f.optionen).filter(([k]) => erlaubt.has(k))) };
}

/** Antworten, die aus einer anderen folgen (R10): „Freiberuflich (ohne Gewerbe)“ ⇒ freier Beruf, solange nichts anderes gewählt ist. */
export function folgeAntworten(feld: string, wert: Profil[string], profil: Profil): Profil {
  if (feld === "rechtsform" && wert === "freiberuf" && !beantwortet(profil, "taetigkeit.einordnung")) return { "taetigkeit.einordnung": "freiberuf" };
  // R11 (Nutzertest Tischlerei #21): UG/GmbH sind kraft Rechtsform gewerblich – keine Frage „Gewerbe oder freier Beruf?“
  if (feld === "rechtsform" && typeof wert === "string" && KRAFT_RECHTSFORM_GEWERBE.includes(wert) && !beantwortet(profil, "taetigkeit.einordnung")) return { "taetigkeit.einordnung": "gewerbe" };
  return {};
}
/** Reihenfolge im Fragenkatalog – vom Alltäglichen zum Speziellen; entscheidet bei gleicher Wirkung */
const RANG = new Map([...FRAGE.keys()].map((k, i) => [k, i]));

export const frageZu = (feld: string): Frage | undefined => FRAGE.get(feld)?.frage;

/**
 * Fragen, die für dieses Profil gestellt werden (Bedingungen wie „nur bei UG/GmbH“ beachtet). Die Kern-Bedingungen
 * (`FRAGE_PASST`) gelten für alle Felder außer `frei` – ohne Angabe nur für den Kern-Check selbst, nicht für Nachfragen.
 */
export function checkFragen(profil: Profil, felder: readonly string[] = CHECK_FELDER, frei: readonly string[] = felder === CHECK_FELDER ? [] : felder): Frage[] {
  return felder
    .map((f) => FRAGE.get(f))
    .filter((x): x is { frage: Frage; nurWenn?: { feld: string; in: string[] } } => Boolean(x))
    .filter((x) => !x.nurWenn || x.nurWenn.in.includes(String(profil[x.nurWenn.feld])))
    .filter((x) => passtImmer(x.frage.feld, profil) && (frei.includes(x.frage.feld) || (FRAGE_PASST[x.frage.feld]?.(profil) ?? true)))
    .map((x) => frageFuerProfil(x.frage, profil));
}

/** R12 (UX #17): Zahl der Kern-Fragen für dieses Profil – Höchstwert des Fortschrittsbalkens statt `CHECK_FELDER.length`. */
export const checkFragenAnzahl = (profil: Profil) => checkFragen(profil).length;

/** Kern-Fragen, die noch offen sind (für „Check fortsetzen“ nach einem Abbruch, Nutzertest Lea). */
export const offeneKernFragen = (profil: Profil) => checkFragen(profil).filter((f) => !beantwortet(profil, f.feld)).map((f) => f.feld);

export const beantwortet = (profil: Profil, feld: string) => profil[feld] !== undefined && profil[feld] !== null && !(Array.isArray(profil[feld]) && (profil[feld] as string[]).length === 0);

export interface PflichtInfo {
  id: string;
  titel: string;
  kurz: string;
  erklaerung: string;
  kategorie: string;
  /** angezeigte Einstufung der Folgen (Katalog `sanktion.schwere`) */
  schwere: "niedrig" | "mittel" | "hoch";
  /**
   * Katalog `dringend_ohne_termin`: auch ohne Termin „Jetzt dran“, unabhängig von der angezeigten Schwere (z. B. HACCP,
   * deren Folgen noch nicht fachlich erfasst sind und deshalb nicht „hoch“ heißen dürfen)
   */
  dringendOhneTermin?: boolean;
  stelle: string;
  /** E-156: Folgen bei Versäumnis laut Katalog (Bußgeld …) – null, wenn sie noch nicht fachlich erfasst sind */
  sanktion?: string | null;
  rechtsgrundlage: string[];
  quellen: { titel: string; url: string }[];
  /** Grund laut Katalog, z. B. „Du beschäftigst mindestens eine Person.“ */
  grund: string;
  /** Vorlage in der App, die diese Pflicht belegt (die erste; sie zählt für „erledigt durch Unterlage“) */
  vorlage: string | null;
  /** alle Vorlagen zu dieser Pflicht, z. B. Gefahrstoffverzeichnis und Betriebsanweisung */
  vorlagen: string[];
  /** nächster Termin aus dem Katalog (wiederkehrende Pflichten) */
  naechsterTermin: string | null;
  /**
   * E-200: die Meldung muss zu Beginn (0 Uhr) des Tags nach dem Termin vorliegen (Beitragsnachweis, Tabellen der
   * Einzugsstellen) – der Termin ist der letzte Tag zum Übermitteln („spätestens am … übermitteln“).
   */
  uebermittelnVortag?: boolean;
  /** alle Termine ab heute in den nächsten zwölf Monaten (ISO, aufsteigend) – für den Jahresblick */
  termine: string[];
  /**
   * E-192: Termine einer wiederkehrenden Pflicht (Katalog `frist.typ: wiederkehrend`) in den letzten 13 Monaten vor dem
   * Stichtag (ISO, aufsteigend) – daraus bestimmt `terminStand`, ob ein Termin überfällig ist. E-207: ebenso die
   * vergangenen Termine einmaliger Fristen (`absolut`, `relativ`). Sonst leer.
   */
  vergangeneTermine?: string[];
  /**
   * E-207: einmalige Frist ohne Bezug auf ein Ereignis (Katalog `frist.typ: absolut` oder `relativ` mit `bezug.fakt`, z. B.
   * Fragebogen zur steuerlichen Erfassung) – ein vergangener, nicht abgehakter Termin bleibt überfällig, auch wenn er vor
   * dem Check lag: Es gibt keinen nächsten Termin, der ihn ablöst.
   */
  einmaligFest?: boolean;
  /**
   * E-192: überfällige, nicht abgehakte Termine (ISO, aufsteigend), gesetzt von `terminStand` – der älteste ist dann
   * `naechsterTermin`, bis er abgehakt ist. Ohne `terminStand` bzw. ohne Überfälliges nicht gesetzt.
   */
  ueberfaellig?: string[];
  /** E-192: Profilangaben, auf denen das Ergebnis beruht (ohne „profil.“) – ab ihrer letzten Änderung zählen Termine als versäumt */
  ausloeserFelder?: string[];
  /** Fragen, die für eine unklare Pflicht noch fehlen (Profilfelder) */
  offeneFragen: string[];
  /** wiederkehrend (z. B. jährlich): „erledigt“ gilt nur bis zum nächsten Termin */
  wiederkehrend: boolean;
  /** E-171: fachlich geprüft in der aktuellen Version */
  geprueft: boolean;
  /** E-171: Vermerk für die Details („Inhalt fachlich geprüft, Stand …“), null wenn ungeprüft */
  pruefVermerk: string | null;
  /** R10: Pflicht, Hinweis oder freiwillige Option (Katalog `einordnung`) – im Ergebnis getrennt gezählt */
  einordnung: "pflicht" | "hinweis" | "option";
  /** R10: wann die Pflicht als erledigt gilt (Katalog `erledigung`) */
  erledigung: Erledigungsart;
  /** R10: Lohn-Meldung, die laut Antwort ein Lohnbüro bzw. die Steuerberatung übernimmt */
  lohnbuero: boolean;
  /**
   * R10: Pflicht je Person (Unterweisung vor Arbeitsbeginn): Namen der neu eingestellten Mitarbeiter („Beschäftigt seit“
   * in den letzten sechs Monaten oder demnächst) – erledigt erst, wenn alle in einer geteilten Unterweisung stehen.
   */
  personen: string[];
  /** R11 (Nutzertest Gründerin #7, E-087): Pflichten, die vorher erledigt sein müssen (Katalog `voraussetzungen`, z. B. ELSTER-Konto vor dem Fragebogen) */
  voraussetzungen?: string[];
  /** R11: Teil der Gründungsschritte (Katalog `phase: gruendung`) – für die Reihenfolge „Vor dem Start“ */
  gruendungsschritt?: boolean;
  /**
   * R12 (Zoll #1, #6): Beschäftigte, für die der Nachweis je Person vorliegen muss (§ 17 MiLoG: alle bzw. die Minijobber;
   * Ausweis-Hinweis: alle) – aus „Mitarbeiter“. `null`: die App kennt die Personen nicht (dann zählt `anzahlPersonen`).
   */
  beschaeftigte?: { name: string; beginn: string | null; neu: boolean }[] | null;
  /** R12 (Zoll #1): so viele Personen brauchen laut Check eine Aufzeichnung, wenn die App sie nicht namentlich kennt */
  anzahlPersonen?: number;
  /** R12 (Kfz #13): Tag, ab dem die Pflicht gilt, wenn er in der Zukunft liegt (z. B. E-Rechnung ab 2028) – sonst null */
  giltAb?: string | null;
}

/** R10: Pflichten, die je neu eingestellter Person zu erfüllen sind (Nutzertest Jonas: ein Nachweis für den Azubi erledigte sie für alle). */
const JE_PERSON = new Set(["arbeitsschutz.erstunterweisung"]);
/** R12 (Zoll #1): Arbeitszeit nach § 17 MiLoG – erledigt erst, wenn für jede betroffene Person eine aktuelle Aufzeichnung da ist. */
export const ZEIT_JE_PERSON = "personal.arbeitszeit_milog";
/** R12 (Zoll #6): Ausweis-Hinweis – je Person, bei neu Eingestellten vor bzw. spätestens am ersten Arbeitstag. */
export const AUSWEIS_JE_PERSON = "personal.ausweis_hinweis";
/** R12 (Bäckerei #11): Vorlagen, die eine Pflicht zusätzlich belegen (die Folgebelehrung füllt man mit derselben Vorlage aus). */
const ZUSATZ_VORLAGEN: Record<string, string[]> = { "branche.gastro_ifsg_folgebelehrung": ["ifsg_belehrung"] };
/** R12 (Kfz #13): Pflichten mit festem Datum, ab dem sie gelten (nicht „bis wann“) – vorher nicht als „schon erledigt“ abzuhaken. */
const GILT_AB_TERMIN = new Set(["steuern.e_rechnung_versand_2027", "steuern.e_rechnung_versand_2028"]);
/** R12 (Coach #3): offene Klärungen, die auch bei Bestandsbetrieben „jetzt dran“ sind statt „aus der Gründung“. */
const OFFEN_TROTZ_BESTAND = new Set(["gruendung.taetigkeit_einordnen"]);
/** Branchen nach § 2a SchwarzArbG, die die App ohne Rückfrage kennt (wie im Katalog) */
const BRANCHE_2A = ["beauty_kosmetik", "gebaeudereinigung"];

/** R10: Erledigung laut Katalog – einmalig (Standard), laufend je Zeitraum bzw. bis zum nächsten Termin, oder nur mit Bestätigung. */
export interface Erledigungsart {
  art: "einmalig" | "laufend" | "bestaetigen";
  zeitraum?: "monat" | "jahr";
  naechsterTerminAus?: string;
  /** Beschriftung des Knopfs bei „bestaetigen“, z. B. „In ELSTER gemeldet“ */
  bestaetigung?: string;
}

export interface Auswertung {
  gilt: PflichtInfo[];
  /** Gründungsschritte eines Betriebs, der seit mehr als sechs Monaten läuft – vermutlich längst erledigt */
  gruendung: PflichtInfo[];
  unbekannt: PflichtInfo[];
  /**
   * R10: Einstellungs-Pflichten (Sofortmeldung, SV-Anmeldung, Unterweisung vor Beginn …) eines bestehenden Betriebs ohne
   * Neueinstellung in den letzten sechs Monaten – „bei Neueinstellung“ statt „jetzt dran“ (Nutzertests Sabine, Jonas).
   */
  beiEinstellung: PflichtInfo[];
  /**
   * Pflichten, die erst in den nächsten zwölf Monaten in Kraft treten (gueltig_ab nach dem Stichtag) und für dieses
   * Profil dann gelten – ausgewertet zum Tag des Inkrafttretens; `naechsterTermin` ist dieser Tag (für den Jahresblick).
   */
  kommend: PflichtInfo[];
}

/**
 * R10: Lohn-Meldungen und -Termine, die ein Lohnbüro bzw. die Steuerberatung übernimmt, wenn sie die Löhne macht
 * (Frage „Wer macht die Löhne?“, Nutzertest Sabine) – sie stehen dann nicht bei „Jetzt dran“.
 */
export const LOHN_PFLICHTEN = new Set(["personal.beitragsnachweis", "personal.lohnnachweis_bg", "personal.lohnsteuer_anmeldung", "personal.sv_jahresmeldung", "personal.sv_anmeldung", "personal.sofortmeldung", "personal.sv_abmeldung", "personal.lohnabrechnung", "personal.umlagen_eau"]);

/** Grund für Pflichten, deren Auslöser im Katalog „immer“ ist */
const IMMER = "Gilt für jedes Unternehmen, unabhängig von deinen Angaben.";

/** Ab wann ein Betrieb als „bestehend“ gilt: Gründungsschritte stehen dann nicht mehr bei den offenen Pflichten. */
export const BESTAND_AB_MONATEN = 6;

const text = (t: unknown) => (t && typeof t === "object" && typeof (t as { de?: unknown }).de === "string" ? (t as { de: string }).de : "");
/** Vorlagen je Pflicht in der Reihenfolge von VORLAGEN – die erste ist die Hauptvorlage */
const VORLAGEN_JE_PFLICHT = new Map<string, string[]>();
for (const v of VORLAGEN) for (const p of v.pflichten) VORLAGEN_JE_PFLICHT.set(p, [...(VORLAGEN_JE_PFLICHT.get(p) ?? []), v.id]);
for (const [p, ids] of Object.entries(ZUSATZ_VORLAGEN)) VORLAGEN_JE_PFLICHT.set(p, [...new Set([...(VORLAGEN_JE_PFLICHT.get(p) ?? []), ...ids])]);
const SCHWERE = { hoch: 0, mittel: 1, niedrig: 2 } as const;
/** Dringlichkeit ohne Termin – Schwere „hoch“ oder Katalog `dringend_ohne_termin` (entkoppelt von der angezeigten Schwere) */
export const dringendOhneTermin = (p: Pick<PflichtInfo, "schwere" | "dringendOhneTermin">) => p.schwere === "hoch" || Boolean(p.dringendOhneTermin);
/** Rang für die Reihenfolge: dringende Pflichten wie Schwere „hoch“ */
const rang = (p: PflichtInfo) => (dringendOhneTermin(p) ? SCHWERE.hoch : SCHWERE[p.schwere]);

/** Unterlage, soweit sie für abgeleitete Ereignisse zählt (Teil von `Unterlage` aus unterlagen/speicher.ts). */
export interface UnterlageFuerEreignis {
  vorlage: string;
  daten: Record<string, unknown>;
  ausgegeben?: string;
  storniertDurch?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ereignisse für die Engine, wie sie der Server aus seinen Datensätzen hat (packages/server `ladeEreignisse`) – die App
 * kennt keine Ereignis-Tabelle, also leitet sie dieselben Ereignistypen (packages/rules-schema/ereignisse.json) aus dem
 * ab, was auf dem Gerät steht. Keine neuen Auslöser, nur die Gegenstücke zu dem, was der Server meldet:
 * - Beschäftigte im Profil (`beschaeftigte.gesamt` ≥ 1) ⇒ „erste_einstellung“ und „einstellung“ sind eingetreten (Server:
 *   beim Anlegen einer beschäftigten Person, personal.controller). Den Tag kennt die App nicht: Gründungsdatum, sonst
 *   der Stichtag. Liegt die Gründung in der Zukunft, ist die Einstellung geplant (wie im Katalog „op: geplant“).
 * - ausgegebene, nicht stornierte Unterweisung mit Datum ⇒ „unterweisung_durchgefuehrt“ an diesem Tag (Server: beim
 *   Abschließen einer Unterweisung) – daraus die Wiederholung nach einem Jahr.
 */
export function ereignisseAusStand(profil: Profil, stichtag: string, unterlagen: readonly UnterlageFuerEreignis[] = [], mitarbeiter: readonly MitarbeiterFuerCheck[] = []): Ereignis[] {
  const ereignisse: Ereignis[] = [];
  const anzahl = profil["beschaeftigte.gesamt"];
  if (typeof anzahl === "number" && anzahl >= 1) {
    const g = profil.gruendungsdatum;
    const datum = typeof g === "string" && ISO.test(g) ? g : stichtag;
    ereignisse.push({ typ: "erste_einstellung", datum }, { typ: "einstellung", datum });
    // R10: „Beschäftigt seit“ der gespeicherten Mitarbeiter – je Person eine Einstellung (wie beim Server je Beschäftigtem)
    for (const tag of new Set(mitarbeiter.map((m) => m.beginn).filter((d): d is string => typeof d === "string" && ISO.test(d) && d !== datum))) ereignisse.push({ typ: "einstellung", datum: tag });
  }
  // R11 (Nutzertest Gründerin #10): Anschaffung der elektronischen Kasse aus dem Profil – die Meldefrist läuft erst ab dann
  const kasse = profil["kasse.angeschafft_am"];
  if (profil["kasse.elektronisch"] === true && typeof kasse === "string" && ISO.test(kasse)) ereignisse.push({ typ: "kasse_angeschafft", datum: kasse });
  for (const u of unterlagen) {
    if (!u.ausgegeben || u.storniertDurch) continue;
    const d = u.daten.datum;
    if (typeof d !== "string" || !ISO.test(d)) continue;
    if (u.vorlage === "unterweisung") ereignisse.push({ typ: "unterweisung_durchgefuehrt", datum: d });
    // R10: Belehrung nach § 43 Abs. 4 IfSG ⇒ Folgebelehrung zwei Jahre später
    if (u.vorlage === "ifsg_belehrung") ereignisse.push({ typ: "ifsg_belehrung_durchgefuehrt", datum: d });
  }
  return ereignisse.sort((a, b) => a.datum.localeCompare(b.datum) || a.typ.localeCompare(b.typ));
}

/** Gespeicherte Mitarbeiterin bzw. gespeicherter Mitarbeiter, soweit der Check sie braucht (Teil von `Person`). */
export interface MitarbeiterFuerCheck {
  name?: string | null;
  geburtsdatum?: string | null;
  beginn?: string | null;
  /** R11: Freitext aus dem Personalfragebogen, z. B. „deutsch“, „polnisch“, „syrisch“ */
  staatsangehoerigkeit?: string | null;
  /** R12: Art der Beschäftigung (vollzeit, teilzeit, minijob …) und „Beschäftigt bis“ */
  art?: string | null;
  ende?: string | null;
}

/** R11 (Nutzertest Gebäudereinigung #5): Staatsangehörigkeiten aus EU, EWR und Schweiz – ohne Aufenthaltstitel arbeitsberechtigt. */
const EU_EWR_CH = /^(deutsch|deutschland|belgisch|bulgarisch|dänisch|daenisch|estnisch|finnisch|französisch|franzoesisch|griechisch|irisch|italienisch|kroatisch|lettisch|litauisch|luxemburgisch|maltesisch|niederländisch|niederlaendisch|österreichisch|oesterreichisch|polnisch|portugiesisch|rumänisch|rumaenisch|schwedisch|slowakisch|slowenisch|spanisch|tschechisch|ungarisch|zyprisch|isländisch|islaendisch|liechtensteinisch|norwegisch|schweizerisch|schweizer|eu|ewr)$/i;
/** Staatsangehörigkeit eindeutig außerhalb von EU, EWR und Schweiz? Mehrere Angaben (z. B. „deutsch, türkisch“): eine aus der EU genügt. */
export function drittstaat(text: string | null | undefined): boolean {
  const teile = (text ?? "").split(/[,/;]|\bund\b/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  return teile.length > 0 && !teile.some((t) => EU_EWR_CH.test(t));
}

/** Alter in vollen Jahren am Stichtag (ISO-Daten). */
const alter = (geburt: string, tag: string) => Number(tag.slice(0, 4)) - Number(geburt.slice(0, 4)) - (tag.slice(5) < geburt.slice(5) ? 1 : 0);

/**
 * R10: Angaben, die die App aus „Mitarbeiter“ kennt, gehen in die Auswertung ein (Nutzertest Sabine: Lena, 17, stand
 * mit Geburtsdatum in der Liste, Jugendarbeitsschutz blieb „hängt ab“). Unter 18 am Stichtag: mindestens so viele
 * Jugendliche wie im Profil angegeben.
 */
export function profilMitStand(profil: Profil, stichtag: string, mitarbeiter: readonly MitarbeiterFuerCheck[] = []): Profil {
  profil = abgeleiteteAntworten(profil);
  // R11: gespeicherte Mitarbeiter aus Drittstaaten ⇒ „Beschäftigst du Menschen aus Drittstaaten?“ ist mit Ja beantwortet
  if (profil["personal.drittstaaten"] !== true && mitarbeiter.some((m) => drittstaat(m.staatsangehoerigkeit))) profil = { ...profil, "personal.drittstaaten": true };
  const jung = mitarbeiter.filter((m) => typeof m.geburtsdatum === "string" && ISO.test(m.geburtsdatum) && alter(m.geburtsdatum, stichtag) < 18 && alter(m.geburtsdatum, stichtag) >= 0).length;
  if (!jung) return profil;
  const angegeben = typeof profil["beschaeftigte.jugendlich"] === "number" ? (profil["beschaeftigte.jugendlich"] as number) : 0;
  return { ...profil, "beschaeftigte.jugendlich": Math.max(angegeben, jung) };
}

/** R12 (Coach #20): bei 0 Beschäftigten sind alle Zählungen 0 – sonst blieben Jugendarbeitsschutz, Minijob-Grenze usw. „hängt ab“. */
const PERSONAL_NULL: Record<string, string | number | boolean> = {
  "beschaeftigte.minijob": 0,
  "beschaeftigte.azubi": 0,
  "beschaeftigte.jugendlich": 0,
  "beschaeftigte.schwanger": 0,
  "beschaeftigte.schwerbehindert": 0,
  "beschaeftigte.werkstudent": 0,
  "beschaeftigte.vollzeit": 0,
  "beschaeftigte.teilzeit": 0,
  "personal.drittstaaten": false,
  "arbeitszeit.nachtarbeit": false,
  "ifsg.beschaeftigte": "keine",
};
/** R12 (Kurier #19): NIS2 erfasst kleine Unternehmen (unter 50 Beschäftigte, bis 10 Mio. € Umsatz) in der Regel nicht – außer IT-Dienste wie DNS oder Vertrauensdienste. */
const NIS2_UMSATZ_GRENZE = 10_000_000;

/**
 * R12: Antworten, die aus anderen folgen – nur für die Auswertung, nicht gespeichert (die Frage selbst bleibt änderbar):
 * 0 Beschäftigte ⇒ alle Zählungen 0 (Coach #20); Einzelperson ⇒ keine Investoren aus dem Ausland (die Frage wird ihr nicht
 * gestellt); kein Bargeld ⇒ keine elektronische Kasse (Kurier #14); kleines Unternehmen ⇒ nicht von NIS2 erfasst (Kurier #19).
 */
export function abgeleiteteAntworten(profil: Profil): Profil {
  const p: Profil = { ...profil };
  const setze = (feld: string, wert: string | number | boolean) => {
    if (!beantwortet(p, feld)) p[feld] = wert;
  };
  if (ohneTeam(p)) for (const [feld, wert] of Object.entries(PERSONAL_NULL)) setze(feld, wert);
  if (typeof p.rechtsform === "string" && EINZELPERSON.includes(p.rechtsform)) setze("gesellschafter.auslaendische_investoren", false);
  if (p["kasse.bargeld"] === false) setze("kasse.elektronisch", false);
  const team = zahl(p, "beschaeftigte.gesamt");
  const umsatz = zahl(p, "umsatz.vorjahr") ?? zahl(p, "umsatz.prognose_laufendes_jahr");
  const klein = team !== null && team < 50 && ((umsatz !== null && umsatz <= NIS2_UMSATZ_GRENZE) || p["ust.kleinunternehmer"] === true);
  if (klein && !inBranche(p, "it_agentur_freelancer")) setze("nis2.betroffen", "nein");
  return p;
}

/** R11 (Nutzertest Tischlerei #2): „Warum für dich“ einer unklaren Pflicht als Bedingung („Gilt, wenn …“). */
function bedingung(saetze: string[]): string {
  if (!saetze.length) return "";
  return `Gilt, wenn das zutrifft: ${saetze.map((x) => `„${x.replace(/\.$/, "")}“`).join(", ")}.`;
}

/**
 * R11 (Nutzertest Gründerin #7): Gründungsschritte in zeitlicher Reihenfolge und nach Voraussetzungen – die Voraussetzung
 * (z. B. ELSTER-Konto, ohne eigenen Termin) steht vor dem, was auf sie wartet (Fragebogen). Die übrigen Pflichten bleiben
 * an ihrem Platz; nur die Plätze der Gründungsschritte werden neu belegt.
 */
export function gruendungZuerstGeordnet(l: PflichtInfo[]): PflichtInfo[] {
  const schritte = l.filter((p) => p.gruendungsschritt);
  if (schritte.length < 2) return l;
  const nachId = new Map(schritte.map((p) => [p.id, p]));
  // wirksamer Termin: der eigene oder der früheste Termin eines Schritts, der auf diesen wartet
  const wirksam = new Map<string, string>();
  const termin = (p: PflichtInfo, besucht = new Set<string>()): string => {
    if (wirksam.has(p.id)) return wirksam.get(p.id)!;
    if (besucht.has(p.id)) return p.naechsterTermin ?? "9999";
    besucht.add(p.id);
    let t = p.naechsterTermin ?? "9999";
    for (const q of schritte) if (q.voraussetzungen?.includes(p.id)) t = [t, termin(q, besucht)].sort()[0]!;
    wirksam.set(p.id, t);
    return t;
  };
  const tiefe = (p: PflichtInfo, n = 0): number => (n > 10 ? n : Math.max(0, ...(p.voraussetzungen ?? []).map((v) => (nachId.has(v) ? tiefe(nachId.get(v)!, n + 1) + 1 : 0))));
  const geordnet = [...schritte].sort((a, b) => termin(a).localeCompare(termin(b)) || tiefe(a) - tiefe(b) || rang(a) - rang(b) || a.titel.localeCompare(b.titel, "de"));
  let i = 0;
  return l.map((p) => (p.gruendungsschritt ? geordnet[i++]! : p));
}

/** R11 (Nutzertest Gründerin #7, E-087): Voraussetzungen, die in dieser Auswertung gelten und noch nicht erledigt sind. */
export function offeneVoraussetzungen(p: PflichtInfo, a: Auswertung, e: Erledigt): PflichtInfo[] {
  const alle = [...a.gilt, ...a.gruendung, ...a.beiEinstellung];
  return (p.voraussetzungen ?? []).map((id) => alle.find((x) => x.id === id)).filter((x): x is PflichtInfo => Boolean(x) && !istErledigt(x!, e));
}

/** E-192: so weit zurück rechnet die Auswertung Termine wiederkehrender Pflichten (für überfällige Termine). */
export const RUECKBLICK_MONATE = 13;

/** E-192: Profilangaben (ohne „profil.“), die im Begründungsbaum vorkommen – abgeleitete Fakten über ihre Quellen. */
function profilFelder(k: Knoten, aus = new Set<string>()): string[] {
  if (k.art === "vergleich") {
    for (const q of QUELLFAKTEN[k.feld] ?? [k.feld]) if (q.startsWith("profil.")) aus.add(q.slice("profil.".length));
  } else if (k.art === "all" || k.art === "any" || k.art === "not") for (const x of k.kinder) profilFelder(x, aus);
  return [...aus].sort();
}

/**
 * Katalog für dieses Profil auswerten. Pflichten im Rechtsänderungs-Radar (Entwurf, geplant) zählen nicht mit.
 * Ereignisse leitet `ereignisseAusStand` aus Profil und Unterlagen ab (z. B. Beschäftigte ⇒ Einstellung).
 * `finanzen`: Fakten aus Rechnungen, Kasse und Zahlungseingängen auf dem Gerät mit vollem Pfad (`finanzen.*`, z. B. der
 * vereinnahmte Umsatz für die Kleinunternehmer-Wächter aus unterlagen/kuUmsatz.ts `umsatzFakten`).
 */
export function auswertung(antworten: Profil, stichtag: string, unterlagen: readonly UnterlageFuerEreignis[] = [], mitarbeiter: readonly MitarbeiterFuerCheck[] = [], finanzen: Readonly<Record<string, number>> = {}): Auswertung {
  const profil = profilMitStand(antworten, stichtag, mitarbeiter);
  const fakten: Record<string, unknown> = { ...Object.fromEntries(Object.entries(profil).filter(([, w]) => w !== null && w !== undefined).map(([k, w]) => [`profil.${k}`, w])), ...Object.fromEntries(Object.entries(finanzen).filter(([k, w]) => k.startsWith("finanzen.") && Number.isFinite(w))) };
  const ereignisse = ereignisseAusStand(profil, stichtag, unterlagen, mitarbeiter);
  const lohnExtern = profil["personal.lohn_durch"] === "steuerberatung" || profil["personal.lohn_durch"] === "lohnbuero";
  const seit = plusMonate(stichtag, -BESTAND_AB_MONATEN);
  const neuePersonen = mitarbeiter.filter((m) => typeof m.beginn === "string" && ISO.test(m.beginn) && m.beginn > seit && typeof m.name === "string" && m.name.trim()).map((m) => m.name!.trim());
  // R12 (Zoll #1, #6): wer gerade beschäftigt ist (begonnen, nicht seit mehr als sieben Tagen ausgeschieden), mit Namen
  const aktuell = mitarbeiter.filter((m) => typeof m.name === "string" && m.name.trim() && !(typeof m.beginn === "string" && ISO.test(m.beginn) && m.beginn > plusMonate(stichtag, 1)) && !(typeof m.ende === "string" && ISO.test(m.ende) && m.ende < plusTage(stichtag, -7)));
  const person = (m: MitarbeiterFuerCheck) => ({ name: m.name!.trim(), beginn: typeof m.beginn === "string" && ISO.test(m.beginn) ? m.beginn : null, neu: typeof m.beginn === "string" && ISO.test(m.beginn) && m.beginn > seit });
  const alle2a = (liste(profil, "personal.sofortmeldebranchen") ?? []).some((x) => x !== "keine") || inBranche(profil, ...BRANCHE_2A);
  const mitArt = aktuell.some((m) => typeof m.art === "string" && m.art);
  // § 17 MiLoG: in den Branchen nach § 2a SchwarzArbG alle, sonst die Minijobber (Art aus „Mitarbeiter“; ohne Angabe nach Zahl)
  const zeitPersonen = alle2a ? aktuell.map(person) : mitArt ? aktuell.filter((m) => m.art === "minijob").map(person) : null;
  const zeitAnzahl = alle2a ? (zahl(profil, "beschaeftigte.gesamt") ?? 0) : (zahl(profil, "beschaeftigte.minijob") ?? 0);
  // E-192: auch die Termine der letzten 13 Monate – ein versäumter Termin bleibt sichtbar, bis er abgehakt ist (`terminStand`)
  const ergebnisse = auswerten({ katalog: KATALOG, fakten, ereignisse, stichtag, kalender: new StandardKalender(), fenster: { von: plusMonate(stichtag, -RUECKBLICK_MONATE), bis: plusMonate(stichtag, 12) } });
  const nachId = new Map(KATALOG.pflichten.map((p) => [p.id, p]));
  const info = (e: (typeof ergebnisse)[number]): PflichtInfo => {
    const p = nachId.get(e.pflicht_id) as Pflicht & { stelle?: unknown; quellen?: { titel: string; url?: string }[]; pruefung?: PruefungRoh };
    const termine = e.termine.map((t) => t.faellig_am).filter((d) => d >= stichtag).sort();
    const termin = termine[0] ?? null;
    // E-207: auch einmalige Fristen (absolut, relativ) – ein versäumter Termin verschwindet nicht (`terminStand`)
    const vergangen = p.frist.typ === "wiederkehrend" || p.frist.typ === "absolut" || p.frist.typ === "relativ" ? [...new Set(e.termine.map((t) => t.faellig_am).filter((d) => d < stichtag))].sort() : [];
    const einmaligFest = p.wiederholung?.art !== "periodisch" && (p.frist.typ === "absolut" || (p.frist.typ === "relativ" && "fakt" in p.frist.bezug));
    return {
      id: p.id,
      titel: text(p.titel),
      kurz: text(p.kurz),
      erklaerung: text(p.erklaerung),
      kategorie: p.kategorie,
      schwere: p.sanktion?.schwere ?? "mittel",
      ...(p.dringend_ohne_termin ? { dringendOhneTermin: true } : {}),
      // E-156: Folgen bei Versäumnis (Pro-Detail) – nur, wenn sie fachlich erfasst sind
      sanktion: p.sanktion?.text && !/noch nicht fachlich erfasst/.test(text(p.sanktion.text)) ? text(p.sanktion.text) : null,
      stelle: text(p.stelle),
      rechtsgrundlage: p.rechtsgrundlage ?? [],
      quellen: (p.quellen ?? []).filter((q): q is { titel: string; url: string } => Boolean(q.url)),
      // die Sätze, die das Ergebnis tragen – auch bei zusammengesetzten Auslösern („weil du … und …“)
      // R11 (Nutzertest Tischlerei #2): bei unklaren Pflichten als Bedingung, nicht als Tatsache
      grund: e.ergebnis === "unbekannt" ? bedingung(entscheidendeSaetze(e.begruendung)) : entscheidendeSaetze(e.begruendung).join(" ") || ("immer" in (p.ausloeser as object) ? IMMER : ""),
      vorlage: VORLAGEN_JE_PFLICHT.get(p.id)?.[0] ?? null,
      ...(p.id === ZEIT_JE_PERSON ? { beschaeftigte: zeitPersonen && zeitPersonen.length ? zeitPersonen : null, anzahlPersonen: zeitAnzahl } : {}),
      ...(p.id === AUSWEIS_JE_PERSON ? { beschaeftigte: aktuell.length ? aktuell.map(person) : null } : {}),
      giltAb: p.gueltig_ab && p.gueltig_ab > stichtag ? p.gueltig_ab : GILT_AB_TERMIN.has(p.id) && p.frist.typ === "absolut" && p.frist.datum > stichtag ? p.frist.datum : null,
      vorlagen: VORLAGEN_JE_PFLICHT.get(p.id) ?? [],
      naechsterTermin: termin,
      ...(e.termine.some((t) => "eingang_am" in t && t.eingang_am) ? { uebermittelnVortag: true } : {}),
      termine,
      vergangeneTermine: vergangen,
      ...(einmaligFest ? { einmaligFest: true } : {}),
      ausloeserFelder: profilFelder(e.begruendung),
      offeneFragen: zuErfragendeFakten(e.fehlende_fakten)
        .filter((f) => f.startsWith("profil."))
        .map((f) => f.slice("profil.".length))
        .filter((f) => FRAGE.has(f)),
      geprueft: istGeprueft(p.version, p.pruefung),
      // E-211: mit den Regelwerten (Schwellen, Beträge) der Pflicht, die noch nicht fachlich bestätigt sind
      pruefVermerk: pruefVermerk(p.version, p.pruefung, undefined, offeneRegelwerte(p, REGELWERTE, stichtag)),
      // je Ereignis mit kommendem Termin (z. B. Unterweisung ein Jahr nach der letzten): „erledigt“ gilt nur für diesen
      // Termin – sonst hakte die Unterweisung, aus der der Termin entsteht, ihre eigene Wiederholung schon ab
      // R10: mehrere vergangene Einstellungen machen eine Pflicht je Einstellung nicht „wiederkehrend“ – nur kommende Termine zählen
      wiederkehrend: p.wiederholung?.art === "periodisch" || p.frist.typ === "wiederkehrend" || termine.length > 1 || Boolean(termin && p.frist.typ === "relativ" && "ereignis" in p.frist.bezug && p.frist.je_ereignis),
      einordnung: p.einordnung ?? "pflicht",
      erledigung: { art: p.erledigung?.art ?? "einmalig", ...(p.erledigung?.zeitraum ? { zeitraum: p.erledigung.zeitraum } : {}), ...(p.erledigung?.naechster_termin_aus ? { naechsterTerminAus: p.erledigung.naechster_termin_aus } : {}), ...(p.erledigung?.bestaetigung ? { bestaetigung: text(p.erledigung.bestaetigung) } : {}) },
      lohnbuero: lohnExtern && LOHN_PFLICHTEN.has(p.id),
      personen: JE_PERSON.has(p.id) ? neuePersonen : [],
      voraussetzungen: (p as Pflicht & { voraussetzungen?: string[] }).voraussetzungen ?? [],
      gruendungsschritt: p.phase === "gruendung",
    };
  };
  const sortiert = (l: PflichtInfo[]) => gruendungZuerstGeordnet(l.sort((a, b) => rang(a) - rang(b) || (a.naechsterTermin ?? "9999").localeCompare(b.naechsterTermin ?? "9999") || a.titel.localeCompare(b.titel, "de")));
  const aktiv = ergebnisse.filter((e) => !e.radar);
  const beginn = typeof profil.gruendungsdatum === "string" ? profil.gruendungsdatum : null;
  const bestehend = Boolean(beginn && beginn <= plusMonate(stichtag, -BESTAND_AB_MONATEN));
  // R12 (Coach #3): eine offene Klärung (Gewerbe oder freier Beruf? – „weiß ich nicht“) bleibt „jetzt dran“
  const ausGruendung = (e: (typeof ergebnisse)[number]) => bestehend && nachId.get(e.pflicht_id)?.phase === "gruendung" && !OFFEN_TROTZ_BESTAND.has(e.pflicht_id);
  // R12 (Coach #1): unklare Gründungsschritte verschwinden bei Bestandsbetrieben nicht – sie stehen unter „Hängt ab“, wenn eine
  // Frage sie klären kann (z. B. Gewerbeanzeige bei „weiß ich nicht“); was keine passende Frage mehr hat (Gründungszuschuss), entfällt
  const fragbar = (e: (typeof ergebnisse)[number]) => zuErfragendeFakten(e.fehlende_fakten).some((f) => f.startsWith("profil.") && FRAGE.has(f.slice(7)) && passtImmer(f.slice(7), profil));
  // R10: Einstellungs-Pflichten (je Einstellung) ohne Einstellung in den letzten sechs Monaten oder demnächst: „bei Neueinstellung“
  const grenze = plusMonate(stichtag, -BESTAND_AB_MONATEN);
  const neueEinstellung = ereignisse.some((x) => x.typ === "einstellung" && x.datum > grenze);
  const beiEinstellung = (e: (typeof ergebnisse)[number]) => {
    const f = nachId.get(e.pflicht_id)?.frist;
    return !neueEinstellung && Boolean(f && f.typ === "relativ" && "ereignis" in f.bezug && f.bezug.ereignis === "einstellung" && f.je_ereignis);
  };
  const gilt = aktiv.filter((e) => e.ergebnis === "gilt");
  // erst später in Kraft (Engine wertet sie zum Stichtag nicht aus): je Tag des Inkrafttretens einmal auswerten
  const bis = plusMonate(stichtag, 12);
  const ab = [...new Set(KATALOG.pflichten.map((p) => p.gueltig_ab).filter((d): d is string => typeof d === "string" && d > stichtag && d <= bis))].sort();
  const kommend: PflichtInfo[] = [];
  for (const tag of ab) {
    const spaeter = auswerten({ katalog: { ...KATALOG, pflichten: KATALOG.pflichten.filter((p) => p.gueltig_ab === tag) }, fakten, ereignisse, stichtag: tag, kalender: new StandardKalender(), fenster: { von: tag, bis: plusMonate(tag, 12) } });
    for (const e of spaeter.filter((x) => !x.radar && x.ergebnis === "gilt")) kommend.push({ ...info(e), naechsterTermin: tag, termine: [tag], vergangeneTermine: [] });
  }
  return {
    gilt: sortiert(gilt.filter((e) => !ausGruendung(e) && !beiEinstellung(e)).map(info)),
    gruendung: sortiert(gilt.filter(ausGruendung).map(info)),
    unbekannt: sortiert(aktiv.filter((e) => e.ergebnis === "unbekannt" && (!ausGruendung(e) || fragbar(e))).map(info)),
    beiEinstellung: sortiert(gilt.filter((e) => !ausGruendung(e) && beiEinstellung(e)).map(info)),
    kommend,
  };
}

/**
 * Zusatzfragen für ein genaueres Ergebnis: die Profilfelder, die die meisten unklaren Pflichten klären – höchstens `n`.
 */
export function zusatzFragen(profil: Profil, stichtag: string, n = 8, unterlagen: readonly UnterlageFuerEreignis[] = [], mitarbeiter: readonly MitarbeiterFuerCheck[] = []): string[] {
  return offeneFragenNachWirkung(auswertung(profil, stichtag, unterlagen, mitarbeiter), profil).slice(0, n).map((o) => o.feld);
}

/** Offene Fragen, nach der Zahl unklarer Pflichten, die sie klären (E-129) – die wirksamste zuerst. */
export function offeneFragenNachWirkung(a: Auswertung, profil: Profil): { feld: string; anzahl: number }[] {
  const zaehler = new Map<string, number>();
  // nur Fragen, die für diesen Betrieb überhaupt gestellt werden (z. B. Investoren nur bei UG/GmbH)
  const passt = (f: string) => {
    const b = FRAGE.get(f)?.nurWenn;
    return (!b || b.in.includes(String(profil[b.feld]))) && passtImmer(f, profil);
  };
  // R10: auch geltende Pflichten ohne Termin, deren Rhythmus noch offen ist (z. B. Umsatzsteuer-Voranmeldung)
  const offenerRhythmus = a.gilt.filter((p) => !p.termine.length && p.offeneFragen.length && KATALOG.pflichten.find((k) => k.id === p.id)?.frist.typ === "wiederkehrend");
  for (const p of a.unbekannt) for (const f of p.offeneFragen) if (!beantwortet(profil, f) && passt(f)) zaehler.set(f, (zaehler.get(f) ?? 0) + 1);
  // beim offenen Rhythmus direkt nach dem Rhythmus fragen statt nach der Steuer des Vorjahres (Nutzertest Mehmet: „weiß ich nicht“)
  for (const p of offenerRhythmus)
    for (const f0 of p.offeneFragen) {
      const f = f0 === "ust.zahllast_vorjahr" && !beantwortet(profil, "ust.voranmeldung_rhythmus") ? "ust.voranmeldung_rhythmus" : f0;
      if (!beantwortet(profil, f) && passt(f)) zaehler.set(f, (zaehler.get(f) ?? 0) + 1);
    }
  return [...zaehler.entries()].sort((x, y) => y[1] - x[1] || (RANG.get(x[0]) ?? 999) - (RANG.get(y[0]) ?? 999) || x[0].localeCompare(y[0])).map(([feld, anzahl]) => ({ feld, anzahl }));
}

export interface Erledigt {
  erledigt: Record<string, string>;
  unterlagen: { vorlage: string; daten: Record<string, unknown>; ausgegeben?: string; storniertDurch?: string }[];
  betrieb: Betrieb;
  /** Stichtag für laufende Pflichten (R10); ohne Angabe heute (Europe/Berlin) */
  heute?: string;
  /** E-192: Zeitpunkte der Antworten (`Stand.zeiten`, „profil:<feld>“) – ab wann die App eine Pflicht begleitet */
  zeiten?: Record<string, string>;
}

const TAG = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
export const heuteBerlin = () => TAG.format(new Date());
/** Derselbe Kalendermonat bzw. dasselbe Kalenderjahr (ISO-Daten oder -Zeitpunkte) */
const gleicherZeitraum = (a: string, b: string, z: "monat" | "jahr") => a.slice(0, z === "monat" ? 7 : 4) === b.slice(0, z === "monat" ? 7 : 4);

/**
 * R10: Bis wann eine geteilte Unterlage eine laufende Pflicht mit `naechsterTerminAus` erledigt: frühestes Datum im
 * Feld (z. B. „Nächste Prüfung“ je Gerät); ohne Datum Unterlagendatum + Richtwert der gewählten Option („Richtwert 6
 * Monate“, z. B. Einsatzbedingungen im Prüfprotokoll). null: kein Termin ableitbar.
 */
export function gueltigBis(u: Erledigt["unterlagen"][number], pfad: string): string | null {
  const [liste, feld] = pfad.includes(".") ? (pfad.split(".") as [string, string]) : [null, pfad];
  const werte = liste ? (Array.isArray(u.daten[liste]) ? (u.daten[liste] as Record<string, unknown>[]).map((e) => e?.[feld]) : []) : [u.daten[feld]];
  const daten = werte.filter((d): d is string => typeof d === "string" && ISO.test(d)).sort();
  if (daten.length) return daten[0]!;
  const v = vorlageFuer(u.vorlage);
  const basis = typeof u.daten.datum === "string" && ISO.test(u.daten.datum) ? u.daten.datum : u.ausgegeben?.slice(0, 10);
  if (!v || !basis) return null;
  for (const a of v.abschnitte)
    for (const f of a.felder as { id: string; art: string; optionen?: { wert: string; text: string }[] }[]) {
      if (f.art !== "wahl" || !f.optionen) continue;
      const text = f.optionen.find((o) => o.wert === u.daten[f.id])?.text ?? "";
      const m = /Richtwert[^0-9]{0,30}(\d+)\s*(Monat|Monate|Jahr|Jahre)\b/.exec(text);
      if (m) return plusMonate(basis, Number(m[1]) * (m[2]!.startsWith("Jahr") ? 12 : 1));
    }
  return null;
}

/** Haken einer Pflicht: Datum und – bei wiederkehrenden Pflichten – der Termin, für den er gilt. */
export function haken(wert: string | undefined): { datum: string; termin: string | null } | null {
  if (!wert) return null;
  const [datum, termin] = wert.split("|");
  return { datum: datum!, termin: termin || null };
}

/** Kalendertag (Europe/Berlin) eines ISO-Zeitpunkts bzw. ISO-Datums */
const tagVon = (iso: string) => (ISO.test(iso) ? iso : TAG.format(new Date(iso)));

/**
 * E-192: Ab welchem Tag die App eine Pflicht begleitet – erste Antwort im Check, bei später geänderten Angaben, auf denen
 * die Pflicht beruht (z. B. „Beschäftigte“), der Tag der letzten Änderung. Termine davor gelten nicht als versäumt (sie
 * lagen vor der App bzw. bevor die Pflicht galt). null: ohne Zeitpunkte (ältere Daten, Tests) – dann zählt nur ein Haken.
 */
export function begleitetSeit(p: Pick<PflichtInfo, "ausloeserFelder">, zeiten: Readonly<Record<string, string>> | undefined): string | null {
  if (!zeiten) return null;
  const antworten = Object.entries(zeiten).filter(([k, v]) => k.startsWith("profil:") && typeof v === "string" && v).map(([k, v]) => [k.slice("profil:".length), tagVon(v)] as const);
  if (!antworten.length) return null;
  let seit = antworten.map(([, t]) => t).sort()[0]!;
  const felder = new Set(p.ausloeserFelder ?? []);
  for (const [k, t] of antworten) if (felder.has(k) && t > seit) seit = t;
  return seit;
}

/**
 * E-192: Überfällige Termine einer wiederkehrenden Pflicht. Ein Haken bei einer wiederkehrenden Pflicht gilt für einen
 * Termin X und alle davor (abhaken lässt sich immer nur der älteste offene). Überfällig sind die vergangenen Termine
 * nach X – ohne Haken die ab `begleitetSeit`. Laufende Pflichten je Zeitraum (HACCP, Arbeitszeit) bleiben außen vor.
 * E-207: Einmalige Fristen je Ereignis (z. B. je Einstellung) zählen genauso; eine einmalige Frist ohne Ereignis
 * (`einmaligFest`, z. B. Fragebogen zur steuerlichen Erfassung) ist ohne Haken überfällig, sobald ihr Termin vorbei ist –
 * unabhängig davon, seit wann die App sie begleitet.
 */
export function ueberfaelligeTermine(p: PflichtInfo, e: Pick<Erledigt, "erledigt" | "zeiten">, heute: string): string[] {
  const vergangen = (p.vergangeneTermine ?? []).filter((t) => t < heute);
  if (!vergangen.length || (p.erledigung?.zeitraum && p.erledigung.art !== "einmalig")) return [];
  if (p.einmaligFest && !p.termine.length) return e.erledigt[p.id] ? [] : vergangen;
  const h = haken(e.erledigt[p.id]);
  const bis = h ? (h.termin ?? h.datum.slice(0, 10)) : null;
  const seit = begleitetSeit(p, e.zeiten);
  if (!bis && !seit) return [];
  return vergangen.filter((t) => (!bis || t > bis) && (!seit || t >= seit));
}

/**
 * E-192: Auswertung mit dem Stand der Haken – ein versäumter Termin verschwindet nicht. Der älteste überfällige, nicht
 * abgehakte Termin wird `naechsterTermin` (oben in „Jetzt dran“ und auf „Heute“, „Seit N Tagen überfällig“), bis er
 * abgehakt ist; dann folgt der nächste. Gehört direkt hinter `auswertung` (billig, nur die Haken).
 */
export function terminStand(a: Auswertung, e: Pick<Erledigt, "erledigt" | "zeiten">, heute: string): Auswertung {
  const mit = (p: PflichtInfo): PflichtInfo => {
    const offen = ueberfaelligeTermine(p, e, heute);
    return offen.length ? { ...p, naechsterTermin: offen[0]!, ueberfaellig: offen } : p;
  };
  // E-207: einmalige Termine nur, wo die Pflicht gilt – Gründungsschritte eines Bestandsbetriebs („Aus der Gründung“),
  // unklare Einträge und „bei Neueinstellung“ werden durch einen alten Termin nicht „überfällig“
  const nurWiederkehrend = (p: PflichtInfo): PflichtInfo => (p.einmaligFest || !p.wiederkehrend ? p : mit(p));
  return { gilt: a.gilt.map(mit), gruendung: a.gruendung.map(nurWiederkehrend), unbekannt: a.unbekannt.map(nurWiederkehrend), beiEinstellung: a.beiEinstellung.map(nurWiederkehrend), kommend: a.kommend };
}

/**
 * E-192: Haken einer wiederkehrenden Pflicht entfernen. Der Haken stand für den Termin X und alle davor; ohne ihn gilt
 * der Termin davor als letzter erledigter (er war es, sonst hätte X nicht abgehakt werden können) – so kehren ältere,
 * längst erledigte Termine nicht als „überfällig“ zurück. null: Haken ganz entfernen.
 */
export function hakenOhne(p: PflichtInfo, wert: string | undefined): { datum: string; termin: string } | null {
  const h = haken(wert);
  if (!h?.termin || !p.wiederkehrend) return null;
  const davor = [...(p.vergangeneTermine ?? []), ...p.termine].filter((t) => t < h.termin!).sort().pop();
  return davor ? { datum: h.datum, termin: davor } : null;
}

/**
 * Erledigt (E-127): abgehakt – bei wiederkehrenden Pflichten nur für den nächsten Termin – oder, bei einmaligen bzw.
 * dauerhaften Pflichten, durch eine vollständige Unterlage, die tatsächlich als PDF geteilt oder gedruckt wurde.
 * R10 (Katalog `erledigung`): laufende Pflichten (HACCP, Arbeitszeit, Prüfung elektrischer Geräte) erledigen Haken und
 * Unterlage nur für ihren Zeitraum bzw. bis zum nächsten Termin aus der Unterlage; bei „bestaetigen“ (Kassenmeldung,
 * Sofortmeldung …) erledigt eine Unterlage nichts – nur die ausdrückliche Bestätigung (der Haken).
 */
export function istErledigt(p: PflichtInfo, e: Erledigt): boolean {
  const heute = e.heute ?? heuteBerlin();
  const erl = p.erledigung ?? { art: "einmalig" };
  const h = haken(e.erledigt[p.id]);
  if (h) {
    if (erl.zeitraum && erl.art !== "einmalig") return gleicherZeitraum(h.datum, heute, erl.zeitraum);
    return !p.wiederkehrend || !p.naechsterTermin || h.termin === p.naechsterTermin;
  }
  return Boolean(erledigtDurch(p, e));
}

/** Die Unterlage, die die Pflicht erledigt (geteilt, vollständig, im Zeitraum bzw. vor dem nächsten Termin) – sonst null. */
export function erledigtDurch(p: PflichtInfo, e: Erledigt): Erledigt["unterlagen"][number] | null {
  const heute = e.heute ?? heuteBerlin();
  const erl = p.erledigung ?? { art: "einmalig" };
  // R12 (Zoll #1, #6): Nachweise je Person – Arbeitszeit nach § 17 MiLoG und Ausweis-Hinweis
  if (p.id === ZEIT_JE_PERSON) return aufzeichnungsStand(p, e).erledigtDurch;
  if (p.id === AUSWEIS_JE_PERSON && p.beschaeftigte?.length) return ausweisStand(p, e).erledigtDurch;
  if (!p.vorlage || p.wiederkehrend || erl.art === "bestaetigen") return null;
  const v = vorlageFuer(p.vorlage);
  if (!v) return null;
  const fertige = e.unterlagen.filter((u) => u.vorlage === p.vorlage && u.ausgegeben && !u.storniertDurch && fehlendeAngaben(v, u.daten as never, e.betrieb).length === 0);
  // je Person: erst erledigt, wenn jede neu eingestellte Person in einer geteilten Unterlage steht (Teilnehmende)
  if (p.personen?.length) {
    const namen = new Set(fertige.flatMap((u) => (Array.isArray(u.daten.teilnehmer) ? (u.daten.teilnehmer as { name?: unknown }[]) : []).map((x) => (typeof x?.name === "string" ? x.name.trim().toLowerCase() : ""))));
    if (!p.personen.every((n) => namen.has(n.toLowerCase()))) return null;
  }
  const passend = fertige
    .filter((u) => {
      if (erl.art !== "laufend") return true;
      if (erl.naechsterTerminAus) {
        const bis = gueltigBis(u, erl.naechsterTerminAus);
        return Boolean(bis && bis > heute);
      }
      return erl.zeitraum ? gleicherZeitraum(u.ausgegeben!, heute, erl.zeitraum) : false;
    })
    .sort((x, y) => y.ausgegeben!.localeCompare(x.ausgegeben!));
  return passend[0] ?? null;
}

const namensSchluessel = (x: unknown) => (typeof x === "string" ? x.trim().toLowerCase() : "");
type UnterlageE = Erledigt["unterlagen"][number];

/**
 * R12 (Zoll #1, Kurier #1): Stand der Arbeitszeitaufzeichnung nach § 17 MiLoG je Person. Eine Person ist abgedeckt, wenn
 * ein Arbeitszeitnachweis (nicht storniert) für sie einen erfassten Tag – Beginn und Ende oder eine Bemerkung wie Urlaub –
 * aus den letzten sieben Tagen oder aus dem laufenden Monat enthält (§ 17 Abs. 1 MiLoG: bis zum siebten Tag nach der Arbeit).
 * `fehlend`: Personen ohne aktuelle Aufzeichnung mit dem Tag, seit dem sie fehlt (null: noch nie aufgezeichnet). Kennt die
 * App die Personen nicht, zählt sie nur, ob so viele verschiedene Namen abgedeckt sind, wie der Check angibt.
 */
export function aufzeichnungsStand(p: PflichtInfo, e: Erledigt): { fehlend: { name: string; seit: string | null }[]; abgedeckt: number; erforderlich: number; erledigtDurch: UnterlageE | null } {
  const heute = e.heute ?? heuteBerlin();
  const grenze = plusTage(heute, -7);
  const nachweise = e.unterlagen.filter((u) => u.vorlage === "arbeitszeitnachweis" && !u.storniertDurch);
  const letzter = new Map<string, { tag: string; u: UnterlageE }>();
  const imMonat = new Set<string>();
  for (const u of nachweise) {
    const wer = namensSchluessel(u.daten.name);
    if (!wer) continue;
    const tage = (Array.isArray(u.daten.tage) ? (u.daten.tage as Record<string, unknown>[]) : [])
      .filter((t) => t && typeof t.datum === "string" && ISO.test(t.datum) && t.datum <= heute && ((typeof t.beginn === "string" && t.beginn && typeof t.ende === "string" && t.ende) || (typeof t.bemerkung === "string" && t.bemerkung.trim())))
      .map((t) => t.datum as string)
      .sort();
    const tag = tage[tage.length - 1];
    if (!tag) continue;
    if (tage.some((t) => gleicherZeitraum(t, heute, "monat"))) imMonat.add(wer);
    if (!letzter.has(wer) || letzter.get(wer)!.tag < tag) letzter.set(wer, { tag, u });
  }
  const aktuell = (wer: string) => imMonat.has(wer) || (letzter.get(wer)?.tag ?? "") >= grenze;
  if (p.beschaeftigte?.length) {
    const fehlend = p.beschaeftigte.filter((b) => !aktuell(b.name.toLowerCase())).map((b) => ({ name: b.name, seit: letzter.has(b.name.toLowerCase()) ? plusTage(letzter.get(b.name.toLowerCase())!.tag, 1) : null }));
    const belege = p.beschaeftigte.map((b) => letzter.get(b.name.toLowerCase())?.u).filter((u): u is UnterlageE => Boolean(u));
    return { fehlend, abgedeckt: p.beschaeftigte.length - fehlend.length, erforderlich: p.beschaeftigte.length, erledigtDurch: fehlend.length ? null : (belege[0] ?? null) };
  }
  const erforderlich = Math.max(1, p.anzahlPersonen ?? 1);
  const abgedeckt = [...letzter.keys()].filter(aktuell).length;
  const beleg = [...letzter.values()].filter((x) => aktuell(namensSchluessel(x.u.daten.name))).map((x) => x.u)[0] ?? null;
  return { fehlend: [], abgedeckt, erforderlich, erledigtDurch: abgedeckt >= erforderlich ? beleg : null };
}

/**
 * R12 (Zoll #6): Ausweis-Hinweis je beschäftigter Person – vollständig, geteilt, nicht storniert. Bei neu eingestellten Personen
 * (Beschäftigt seit in den letzten sechs Monaten oder demnächst) muss er spätestens am ersten Arbeitstag ausgehändigt sein.
 */
export function ausweisStand(p: PflichtInfo, e: Erledigt): { fehlend: { name: string; grund: "fehlt" | "nach_beginn" }[]; erledigtDurch: UnterlageE | null } {
  const v = vorlageFuer("ausweis_hinweis");
  const fertige = e.unterlagen.filter((u) => u.vorlage === "ausweis_hinweis" && u.ausgegeben && !u.storniertDurch && (!v || fehlendeAngaben(v, u.daten as never, e.betrieb).length === 0));
  const fehlend: { name: string; grund: "fehlt" | "nach_beginn" }[] = [];
  let beleg: UnterlageE | null = null;
  for (const b of p.beschaeftigte ?? []) {
    const eigene = fertige.filter((u) => namensSchluessel(u.daten.name) === b.name.toLowerCase());
    if (!eigene.length) {
      fehlend.push({ name: b.name, grund: "fehlt" });
      continue;
    }
    const rechtzeitig = !b.neu || !b.beginn ? eigene : eigene.filter((u) => typeof u.daten.datum === "string" && u.daten.datum <= b.beginn!);
    if (!rechtzeitig.length) fehlend.push({ name: b.name, grund: "nach_beginn" });
    else beleg ??= rechtzeitig[0]!;
  }
  return { fehlend, erledigtDurch: fehlend.length ? null : beleg };
}

/** R12 (Kfz #13): gilt erst in der Zukunft (z. B. E-Rechnungen versenden ab 2028) – nicht bei „Was hast du schon?“ abhaken. */
export const inZukunft = (p: Pick<PflichtInfo, "giltAb">, heute: string = heuteBerlin()) => Boolean(p.giltAb && p.giltAb > heute);

/**
 * Fortschritt über die geltenden Pflichten (ohne Gründungsschritte eines bestehenden Betriebs). R10: nur echte Pflichten –
 * Hinweise und Optionen zählen nicht mit (Rechtsprüfung: getrennt zählen).
 */
export function fortschritt(a: Auswertung, e: Erledigt) {
  const l = a.gilt.filter((p) => p.einordnung === "pflicht");
  const gesamt = l.length;
  const fertig = l.filter((p) => istErledigt(p, e)).length;
  return { gesamt, fertig, prozent: gesamt ? Math.round((fertig / gesamt) * 100) : 0 };
}

/** R10: Pflichten, Hinweise und Optionen getrennt gezählt („N Pflichten, M Hinweise“). */
export function zaehlung(l: readonly PflichtInfo[]) {
  return { pflichten: l.filter((p) => p.einordnung === "pflicht").length, hinweise: l.filter((p) => p.einordnung === "hinweis").length, optionen: l.filter((p) => p.einordnung === "option").length };
}

/** Bereiche für die Gliederung des Ergebnisses. */
export const KATEGORIE_TITEL: Record<string, string> = {
  gruendung: "Gründung",
  gesellschaft: "Gesellschaft",
  steuern: "Steuern",
  personal: "Personal",
  arbeitsschutz: "Arbeitsschutz",
  datenschutz: "Datenschutz",
  it_sicherheit: "IT-Sicherheit",
  ki: "Künstliche Intelligenz",
  online: "Website und Online-Handel",
  produkte: "Produkte",
  branche: "Deine Branche",
  // R12 (Nutzertest Kfz #1)
  umwelt: "Umwelt und Abfall",
};

/** Branche aus dem Profil → Gruppe in den Vorschlägen (z. B. Gefährdungen „Friseur“). */
export const VORSCHLAG_GRUPPE: Record<string, string[]> = {
  gastronomie_lebensmittel: ["Gastronomie / Café"],
  beauty_kosmetik: ["Friseur", "Kosmetik", "Alle Beauty-Betriebe"],
  handwerk: ["Handwerk"],
  bau: ["Handwerk"],
  onlinehandel: ["Büro / Laden"],
  it_agentur_freelancer: ["Büro / Laden"],
  immobilien_finanzen: ["Büro / Laden"],
  unterricht_sport_coaching: ["Büro / Laden"],
};

const plusTage = (iso: string, n: number) => {
  const [j, m, t] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(j, m - 1, t + n)).toISOString().slice(0, 10);
};

/**
 * Was jetzt dran ist (E-128, Review K7): offene Pflichten mit Termin in den nächsten 14 Tagen (auch überfällige)
 * und die wichtigsten offenen ohne Termin; „In den nächsten Wochen“ mit Termin in 15 bis 45 Tagen (bewusst nicht
 * „Diesen Monat“ – das Fenster reicht über das Monatsende hinaus); der Rest „Im Blick“.
 */
export function dringlichkeit(a: Auswertung, e: Erledigt, heute: string) {
  const ee = { ...e, heute: e.heute ?? heute };
  // R10: was das Lohnbüro bzw. die Steuerberatung erledigt, steht nicht bei „Jetzt dran“ (bleibt „Im Blick“)
  const offen = a.gilt.filter((p) => !istErledigt(p, ee));
  // R11 (Nutzertest Gebäudereinigung #7): die Sofortmeldung bleibt „jetzt dran“, auch wenn das Lohnbüro meldet – es braucht die Daten vor Arbeitsbeginn
  const selbst = offen.filter((p) => !p.lohnbuero || p.id === "personal.sofortmeldung");
  const bald = plusTage(heute, 14);
  const spaeter = plusTage(heute, 45);
  const mitTermin = selbst.filter((p) => p.naechsterTermin).sort((x, y) => x.naechsterTermin!.localeCompare(y.naechsterTermin!));
  const terminBald = mitTermin.filter((p) => p.naechsterTermin! <= bald);
  // Hinweise und Optionen ohne Termin sind nie „dringend“ (außer offenen Klärungen, R12)
  // R12 (Coach #3): die offene Einordnung (Gewerbe oder freier Beruf?) ist ein Hinweis, aber „jetzt dran“
  const wichtigOhne = selbst.filter((p) => !p.naechsterTermin && dringendOhneTermin(p) && (p.einordnung === "pflicht" || OFFEN_TROTZ_BESTAND.has(p.id)));
  const jetzt = [...terminBald, ...wichtigOhne];
  const naechsteWochen = mitTermin.filter((p) => p.naechsterTermin! > bald && p.naechsterTermin! <= spaeter);
  const imBlick = offen.filter((p) => !jetzt.includes(p) && !naechsteWochen.includes(p));
  // „N Termine in den nächsten 2 Wochen“ zählt nur Termine, nicht die wichtigen Aufgaben ohne Termin (Nutzertests Lea, Sabine)
  return { jetzt, naechsteWochen, imBlick, termine: terminBald.length, ohneTermin: wichtigOhne.length };
}

/** Höchstens einmal im Jahr fällig (ein Termin oder keiner in den nächsten zwölf Monaten) – für „viele davon nur einmal im Jahr“. */
export const selten = (gilt: readonly PflichtInfo[]) => gilt.filter((p) => p.termine.length <= 1).length * 2 > gilt.length;

/** Ab so vielen offenen Gründungsschritten lohnt die Karte „Schon erledigt?“. */
export const SCHON_ERLEDIGT_AB = 3;

/**
 * Karte „Schon erledigt?“ für junge Betriebe: Angefangen vor weniger als sechs Monaten (nicht in der Zukunft), dann
 * stehen die Gründungsschritte noch bei den offenen Pflichten – oft sind sie längst erledigt. Liefert die offenen
 * Gründungsschritte (Phase „gruendung“ im Katalog), sobald es mindestens `ab` sind; sonst nichts.
 */
export function gruendungsSchritte(a: Auswertung, profil: Profil, e: Erledigt, stichtag: string, ab = SCHON_ERLEDIGT_AB): PflichtInfo[] {
  const beginn = typeof profil.gruendungsdatum === "string" && ISO.test(profil.gruendungsdatum) ? profil.gruendungsdatum : null;
  if (!beginn || beginn > stichtag || beginn <= plusMonate(stichtag, -BESTAND_AB_MONATEN)) return [];
  const phase = new Map(KATALOG.pflichten.map((p) => [p.id, p.phase]));
  const l = a.gilt.filter((p) => phase.get(p.id) === "gruendung" && !istErledigt(p, { ...e, heute: e.heute ?? stichtag }));
  return l.length >= ab ? l : [];
}
