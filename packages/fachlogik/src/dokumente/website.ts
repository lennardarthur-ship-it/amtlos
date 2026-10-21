/**
 * Website und Verträge (E-121, E-123): Datenschutzerklärung für die Website aus Bausteinen, Impressum nach § 5 DDG,
 * Vertrag zur Auftragsverarbeitung mit den Pflichtinhalten nach Art. 28 Abs. 3 DSGVO. Texte aus bausteine.ts.
 */
import { AVV_KLAUSELN, DSE } from "./bausteine.js";
import { formGleich, formImNamen, istKapitalgesellschaft, mitVertretung, rechtsformAus } from "./betrieb.js";
import { aufsichtFuer } from "./datenschutz.js";
import { LINIE, abschnitt, abschnitte, angaben, ankreuzen, anschrift, anschriftMehrzeilig, auswahl, datumDe, dokument, esc, ja, liste, parteien, tabelle, text, unterschriften, zelle, zeilen } from "./html.js";
import { optionen } from "./konstanten.js";
import type { Betrieb, Daten, EinfachesFeld, Vorlage } from "./typen.js";
import { MARKE } from "@amtlos/marke";

/** Markierung für eine fehlende Angabe; im Dokument eine Linie, im Text „[bitte ergänzen]“. */
const FEHLT = "\uE000";

/** Platzhalter der Bausteine füllen. Unbekannte oder leere Angaben werden als fehlend markiert. */
export function bausteinText(t: string, d: Daten, b: Betrieb): string {
  const a = aufsichtFuer(b);
  const werte: Record<string, string> = {
    firmenname: b.name, strasse_hausnr: b.strasse, plz: b.plz, ort: b.ort, email: b.email, telefon: b.telefon,
    hoster_name: text(d, "hoster_name"), hoster_anschrift: text(d, "hoster_anschrift"), logfile_tage: text(d, "logfile_tage"),
    cookie_zwecke: text(d, "cookie_zwecke"), cookie_dauer: text(d, "cookie_dauer"), link_cookie_einstellungen: text(d, "link_einstellungen"), link_einstellungen: text(d, "link_einstellungen") || "die oben genannten Kontaktwege",
    themen: text(d, "newsletter_themen"), versanddienstleister: text(d, "newsletter_dienst"), netzwerke: text(d, "netzwerke"),
    anbieter_name: text(d, "termin_anbieter"), anbieter_anschrift: text(d, "termin_anschrift"),
    video_anbieter: text(d, "video_anbieter"), video_anschrift: text(d, "video_anschrift"), zahlung_anbieter: text(d, "zahlung_anbieter"), zahlung_anschrift: text(d, "zahlung_anschrift"),
    aufsichtsbehoerde_name: a?.name ?? "", aufsichtsbehoerde_ort: a?.ort ?? "", aufsichtsbehoerde_url: a?.url ?? "",
  };
  return t
    .replace(/\{optional: ([^{}]*)\{dsb_kontakt\}([^{}]*)\}/g, (_, v, n) => (text(d, "dsb") ? `${v}${text(d, "dsb")}${n}` : ""))
    .replace(/\{nach Ende der Sitzung \/ nach \{dauer\}\}/g, "{cookie_dauer}")
    .replace(/\{Speicherung Ihrer Cookie-Auswahl, Warenkorb, Login\}/g, "{cookie_zwecke}")
    // „nach 1 Tag“, sonst „nach 14 Tagen“
    .replace(/\{30\} Tagen/g, () => (text(d, "logfile_tage").trim() === "1" ? "1 Tag" : "{logfile_tage} Tagen"))
    .replace(/\{30\}/g, "{logfile_tage}")
    .replace(/ \{und Ihren Namen\}/g, "")
    .replace(/\{([a-z_]+)\}/g, (_, k: string) => (werte[k]?.trim() ? werte[k]!.trim() : FEHLT))
    .replace(/\s+\./g, ".")
    .replace(/ {2,}/g, " ")
    .trim();
}
// Zeilenumbrüche bleiben erhalten (z. B. in „Weitere Verarbeitungen“), wie im Impressum
const alsHtml = (t: string) => `<p>${esc(t).replace(/\n/g, "<br>").replace(/\uE000/g, LINIE)}</p>`;
const alsKlartext = (t: string) => t.replace(/\uE000/g, "[bitte ergänzen]");

/**
 * R12 (Coach #10): Bausteine für Online-Kurse per Videokonferenz und für Zahlungsdienstleister – mit Anbieter,
 * Drittland und Garantie (Art. 13 Abs. 1 lit. f, Art. 44 ff. DSGVO). Nicht aus der Recherche, sondern von Hand –
 * fachlich zu prüfen. `{drittland}` füllt `drittlandSatz`.
 */
const DSE_R12: Record<string, { titel: string; text: string; quelle?: string }> = {
  videokonferenz: {
    titel: "Online-Kurse und Beratungen per Videokonferenz",
    text: "Für Online-Kurse und Beratungen nutzen wir den Dienst {video_anbieter}, {video_anschrift}. Dabei werden Ihr Name bzw. Anzeigename, Ihre E-Mail-Adresse, Bild- und Tondaten, Chat-Nachrichten sowie technische Daten (z. B. IP-Adresse, Gerät, Zeitpunkt der Teilnahme) verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Durchführung des gebuchten Kurses bzw. der Beratung). Der Anbieter verarbeitet die Daten in unserem Auftrag auf Grundlage eines Vertrags zur Auftragsverarbeitung nach Art. 28 DSGVO. {drittland} Wir zeichnen nichts auf, ohne Sie vorher zu fragen. Kamera und Mikrofon können Sie jederzeit selbst ausschalten.",
    quelle: "Art. 6, 13, 28, 44 ff. DSGVO – fachlich zu prüfen",
  },
  zahlungsdienstleister: {
    titel: "Zahlungsdienstleister",
    text: "Bezahlen Sie online, geben wir die für die Zahlung nötigen Daten (z. B. Name, Betrag, Rechnungsnummer und gegebenenfalls Ihre E-Mail-Adresse) an den Zahlungsdienstleister {zahlung_anbieter}, {zahlung_anschrift}, weiter. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Abwicklung der Zahlung); soweit der Zahlungsdienstleister gesetzliche Pflichten erfüllt (z. B. zur Verhinderung von Geldwäsche), Art. 6 Abs. 1 lit. c DSGVO. Der Zahlungsdienstleister verarbeitet die Daten in eigener Verantwortung; es gelten zusätzlich seine Datenschutzhinweise. {drittland}",
    quelle: "Art. 6, 13, 44 ff. DSGVO – fachlich zu prüfen",
  },
};
const DSE_ALLE: Record<string, { titel: string; text: string; quelle?: string }> = { ...DSE, ...DSE_R12 };
/**
 * Ort der Verarbeitung und Garantie für ein Drittland (Art. 45, 46 DSGVO) – Vorprüfung 21.10.2026: eine Auswahl, die
 * zum Satz in der Erklärung wird (nur EU/EWR, USA mit Data Privacy Framework, Standardvertragsklauseln). „angemessenheit“
 * gab es bis dahin für alle Angemessenheitsbeschlüsse; gespeicherte Erklärungen drucken ihn weiter.
 */
const DRITTLAND_WAHL = [
  { wert: "nur_eu", text: "nur in der EU bzw. im EWR" },
  { wert: "dpf", text: "auch in den USA – Anbieter nach dem EU-U.S. Data Privacy Framework zertifiziert" },
  { wert: "scc", text: "auch in einem Drittland – EU-Standardvertragsklauseln" },
];
const DPF = "den Angemessenheitsbeschluss der EU-Kommission zum EU-U.S. Data Privacy Framework (Art. 45 DSGVO, Durchführungsbeschluss (EU) 2023/1795); der Anbieter ist danach zertifiziert";
const SCC = "die EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO, Durchführungsbeschluss (EU) 2021/914)";
/** Satz zur Drittlandübermittlung eines Bausteins aus der Auswahl (und dem Land bei Standardvertragsklauseln). */
function drittlandSatz(d: Daten, praefix: "video" | "zahlung"): string {
  const land = text(d, `${praefix}_drittland`).trim();
  const g = text(d, `${praefix}_garantie`);
  if (g === "dpf") return `Dabei können Daten auch in den USA verarbeitet werden. Die Übermittlung stützt sich auf ${DPF}.`;
  if (g === "scc") return `Dabei können Daten auch in ${land || FEHLT} verarbeitet werden. Die Übermittlung stützt sich auf ${SCC}.`;
  if (g === "angemessenheit") return `Dabei können Daten auch in ${land || FEHLT} verarbeitet werden. Die Übermittlung stützt sich auf einen Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO${/USA|Vereinigte Staaten/i.test(land) ? "; für die USA das EU-U.S. Data Privacy Framework, Durchführungsbeschluss (EU) 2023/1795, wenn der Anbieter zertifiziert ist" : ""}).`;
  if (g === "nur_eu" || !land) return "Eine Übermittlung in Länder außerhalb der EU bzw. des EWR findet nicht statt.";
  return `Dabei können Daten auch in ${land} verarbeitet werden. Die Übermittlung stützt sich auf ${FEHLT}.`;
}
/** R12 (Coach #17): § 257 HGB (Handelsbriefe) gilt nur für Kaufleute – sonst nur § 147 AO. */
export const istKaufmann = (b: Betrieb) => Boolean((b.registernummer ?? "").trim()) || /e\.?\s?K|OHG|\bKG\b|GmbH|\bUG\b|\bAG\b|haftungsbeschr/i.test(`${b.rechtsform ?? ""} ${b.name}`);

/** Bausteine der Datenschutzerklärung in fester Reihenfolge; „immer“ steht in jeder Erklärung. */
const DSE_REIHE: { id: string; immer?: boolean }[] = [
  { id: "verantwortlicher", immer: true },
  { id: "hosting" },
  { id: "server_logfiles" },
  { id: "kontakt" },
  { id: "cookies_einwilligung" },
  { id: "technisch_notwendige_cookies" },
  { id: "online_terminbuchung" },
  { id: "videokonferenz" },
  { id: "zahlungsdienstleister" },
  { id: "newsletter" },
  { id: "google_maps" },
  { id: "youtube" },
  { id: "google_fonts_lokal" },
  { id: "google_fonts_extern" },
  { id: "social_media_links" },
  { id: "betroffenenrechte", immer: true },
  { id: "widerruf_einwilligung" },
  { id: "widerspruchsrecht", immer: true },
  { id: "beschwerderecht", immer: true },
];
/** Bausteine, die auf einer Einwilligung beruhen – zu ihnen gehört der Hinweis auf den Widerruf (Art. 7 Abs. 3 DSGVO). */
const MIT_EINWILLIGUNG = ["cookies_einwilligung", "newsletter", "google_maps", "youtube", "google_fonts_extern"];
const DSE_WAHL = DSE_REIHE.filter((x) => !x.immer && DSE_ALLE[x.id]).map((x) => ({ wert: x.id, text: DSE_ALLE[x.id]!.titel, quelle: DSE_ALLE[x.id]!.quelle }));

/** Rat an den Betreiber im Baustein „Google Fonts (extern)“ – gehört nicht in die veröffentlichte Erklärung (steht als Hilfe am Feld). */
const FONTS_EMPFEHLUNG = /\s*Empfehlung: Schriftarten lokal einbinden, dann entfällt die Übermittlung\./;

/**
 * Baustein „Kontakt“ ohne Kontaktformular (Schalter aus): nur E-Mail und Telefon. Ältere Erklärungen ohne den Schalter
 * behalten den Text mit Formular.
 */
function ohneKontaktformular(t: { titel: string; text: string }): { titel: string; text: string } {
  return { titel: t.titel.replace(/, Telefon oder Kontaktformular$/, " oder Telefon"), text: t.text.replace(/per E-Mail, telefonisch oder über das Kontaktformular/, "per E-Mail oder telefonisch") };
}

/** Terminbuchung über eine Plattform mit eigenem Kundenkonto (R11): statt des Satzes zur Auftragsverarbeitung */
const TERMIN_AV = "Der Anbieter verarbeitet die Daten in unserem Auftrag auf Grundlage eines Vertrags zur Auftragsverarbeitung nach Art. 28 DSGVO.";
const TERMIN_PLATTFORM = "Legen Sie bei dem Anbieter ein eigenes Kundenkonto an, verarbeitet er Ihre Daten auch in eigener Verantwortung; Einzelheiten finden Sie in den Datenschutzhinweisen des Anbieters.";

function dseTeile(d: Daten, b: Betrieb): { titel: string; text: string }[] {
  const an = new Set(auswahl(d, "module"));
  // beide Schriftarten-Bausteine widersprechen sich: extern eingebunden geht vor (die Prüfung weist darauf hin)
  if (an.has("google_fonts_extern")) an.delete("google_fonts_lokal");
  const teile = DSE_REIHE.filter((x) => (x.immer || an.has(x.id)) && DSE_ALLE[x.id]).map((x) => {
    const roh = DSE_ALLE[x.id]!.text.replace(FONTS_EMPFEHLUNG, "").replace("{drittland}", () => (x.id === "videokonferenz" ? drittlandSatz(d, "video") : x.id === "zahlungsdienstleister" ? drittlandSatz(d, "zahlung") : ""));
    // R12 (Coach #17): ohne Kaufmannseigenschaft keine Handelsbriefe nach § 257 HGB
    const t = { titel: DSE_ALLE[x.id]!.titel, text: bausteinText(istKaufmann(b) ? roh : roh.replace(/\(z\. B\. für Geschäftsbriefe, § 257 HGB, § 147 AO\)/, "(z. B. nach § 147 AO)"), d, b) };
    if (x.id === "online_terminbuchung" && text(d, "termin_art") === "plattform") return { ...t, text: t.text.replace(TERMIN_AV, TERMIN_PLATTFORM) };
    return x.id === "kontakt" && d.kontaktformular === false ? ohneKontaktformular(t) : t;
  });
  const rechte = teile.findIndex((t) => t.titel === DSE.betroffenenrechte?.titel);
  const vorRechten = [
    ...(text(d, "ergaenzung") ? [{ titel: "Weitere Verarbeitungen", text: text(d, "ergaenzung") }] : []),
    // Art. 13 Abs. 2 lit. e DSGVO: bei Bestellungen und Aufträgen sind die Angaben für den Vertragsschluss erforderlich
    { titel: "Pflicht zur Bereitstellung", text: "Soweit Sie uns personenbezogene Daten für einen Vertrag bereitstellen (z. B. bei einer Bestellung, Buchung oder einem Auftrag: Name, Anschrift, Kontaktdaten), sind diese für den Abschluss und die Erfüllung des Vertrags erforderlich; ohne sie können wir den Vertrag nicht schließen oder erfüllen. Im Übrigen sind Sie weder gesetzlich noch vertraglich verpflichtet, uns personenbezogene Daten bereitzustellen. Ohne die technisch erforderlichen Daten kann die Website jedoch nicht angezeigt werden; ohne Angaben in einer Anfrage können wir diese nicht bearbeiten." },
    { titel: "Automatisierte Entscheidungen", text: "Eine automatisierte Entscheidungsfindung einschließlich Profiling findet nicht statt." },
  ];
  teile.splice(rechte < 0 ? teile.length : rechte, 0, ...vorRechten);
  return teile;
}

export const DSE_OHNE_HOSTING = "Hosting nicht gewählt: Jede Website liegt bei einem Hosting-Anbieter – Baustein „Hosting“ wählen (außer du betreibst den Server selbst)";

export const datenschutzerklaerungWebsite: Vorlage = {
  id: "datenschutzerklaerung_website",
  gestalt: "handbuch",
  titel: "Datenschutzerklärung für die Website",
  beschreibung: "Datenschutzerklärung aus Bausteinen: ankreuzen, was deine Website nutzt (Hosting, Kontakt, Cookies, Terminbuchung, Karten …) – als PDF und als Text zum Einfügen.",
  bereich: "datenschutz",
  pflichten: ["online.datenschutzerklaerung"],
  grundlage: "Art. 13 DSGVO; § 25 TDDDG",
  ausBetrieb: { website: "website" },
  abschnitte: [
    { titel: "Deine Website",
      hilfe: `Verantwortliche Stelle, Kontakt und Aufsichtsbehörde übernimmt ${MARKE.name} aus „Mein Betrieb“.`,
      felder: [
        { id: "website", art: "text", label: "Adresse der Website", hilfe: "z. B. www.salon-sonne.de – ohne Angabe die Website aus „Mein Betrieb“" },
        { id: "module", art: "bausteine", label: "Was nutzt deine Website?", hilfe: "Schriftarten: entweder lokal oder extern – am besten lokal einbinden, dann entfällt die Übermittlung an Google. Extern eingebundene Google Fonts ohne Einwilligung hat das LG München I als Verstoß gewertet (Urteil vom 20.01.2022, 3 O 17493/20).", optionen: DSE_WAHL, vorbelegung: ["hosting", "server_logfiles", "kontakt", "widerruf_einwilligung"], pflicht: true },
      ],
    },
    {
      titel: "Angaben für die Bausteine",
      felder: [
        { id: "hoster_name", art: "text", label: "Hosting-Anbieter", wenn: { feld: "module", ist: "hosting" }, hilfe: "steht im Vertrag mit deinem Website-Anbieter" },
        { id: "hoster_anschrift", art: "text", label: "Anschrift des Hosting-Anbieters", wenn: { feld: "module", ist: "hosting" } },
        { id: "kontaktformular", art: "schalter", label: "Die Website hat ein Kontaktformular", hilfe: "sonst nennt der Abschnitt „Kontakt“ nur E-Mail und Telefon", wenn: { feld: "module", ist: "kontakt" } },
        { id: "logfile_tage", art: "zahl", label: "Server-Logfiles werden gelöscht nach (Tagen)", hilfe: "laut Hosting-Anbieter, z. B. 7, 14 oder 30", wenn: { feld: "module", ist: "server_logfiles" } },
        { id: "link_einstellungen", art: "text", label: "Wo Besucher Cookie-Einstellungen ändern können", vorschlaege: ["den Link „Cookie-Einstellungen“ am Ende jeder Seite"], wenn: { feld: "module", ist: "cookies_einwilligung" } },
        { id: "cookie_zwecke", art: "text", label: "Wofür technisch notwendige Cookies genutzt werden", vorschlaege: ["Speicherung Ihrer Cookie-Auswahl", "Speicherung Ihrer Cookie-Auswahl und des Warenkorbs"], wenn: { feld: "module", ist: "technisch_notwendige_cookies" } },
        { id: "cookie_dauer", art: "text", label: "Wann diese Cookies gelöscht werden", vorschlaege: ["nach Ende der Sitzung", "nach 12 Monaten"], wenn: { feld: "module", ist: "technisch_notwendige_cookies" } },
        { id: "termin_anbieter", art: "text", label: "Anbieter der Online-Terminbuchung", wenn: { feld: "module", ist: "online_terminbuchung" } },
        { id: "termin_anschrift", art: "text", label: "Anschrift des Terminbuchungs-Anbieters", wenn: { feld: "module", ist: "online_terminbuchung" } },
        // R11 (Kosmetik #24): Marktplatz-Plattformen mit eigenem Kundenkonto sind oft selbst verantwortlich
        { id: "termin_art", art: "wahl", label: "Art der Terminbuchung", optionen: [{ wert: "tool", text: "Reines Buchungstool (Auftragsverarbeiter)" }, { wert: "plattform", text: "Plattform mit eigenem Kundenkonto (eigene Verantwortung der Plattform)" }], vorbelegung: "tool", wenn: { feld: "module", ist: "online_terminbuchung" }, hilfe: "Ob die Plattform selbst verantwortlich ist, steht in ihren Bedingungen bzw. im Vertrag – bitte prüfen." },
        { id: "newsletter_themen", art: "text", label: "Inhalt des Newsletters", vorschlaege: ["Angebote und Neuigkeiten aus unserem Betrieb"], wenn: { feld: "module", ist: "newsletter" } },
        { id: "newsletter_dienst", art: "text", label: "Versanddienstleister des Newsletters", wenn: { feld: "module", ist: "newsletter" } },
        { id: "video_anbieter", art: "text", label: "Anbieter der Videokonferenz", hilfe: "z. B. Zoom Communications, Microsoft (Teams), Jitsi", wenn: { feld: "module", ist: "videokonferenz" } },
        { id: "video_anschrift", art: "text", label: "Anschrift des Videokonferenz-Anbieters", wenn: { feld: "module", ist: "videokonferenz" } },
        { id: "video_garantie", art: "wahl", label: "Wo verarbeitet der Anbieter die Daten?", optionen: DRITTLAND_WAHL, vorbelegung: "nur_eu", hilfe: "Steht in den Datenschutzhinweisen bzw. im Vertrag zur Auftragsverarbeitung des Anbieters. Ob ein US-Anbieter zertifiziert ist: dataprivacyframework.gov.", wenn: { feld: "module", ist: "videokonferenz" } },
        { id: "video_drittland", art: "text", label: "Drittland", hilfe: "z. B. USA oder Kanada", wenn: { feld: "video_garantie", ist: ["nur_eu", "dpf"], nicht: true } },
        { id: "zahlung_anbieter", art: "text", label: "Zahlungsdienstleister", hilfe: "z. B. PayPal (Europe) S.à r.l. et Cie, S.C.A., Stripe Payments Europe Ltd.", wenn: { feld: "module", ist: "zahlungsdienstleister" } },
        { id: "zahlung_anschrift", art: "text", label: "Anschrift des Zahlungsdienstleisters", wenn: { feld: "module", ist: "zahlungsdienstleister" } },
        { id: "zahlung_garantie", art: "wahl", label: "Wo verarbeitet der Zahlungsdienstleister die Daten?", optionen: DRITTLAND_WAHL, vorbelegung: "nur_eu", hilfe: "Steht in den Datenschutzhinweisen des Anbieters. Ob ein US-Anbieter zertifiziert ist: dataprivacyframework.gov.", wenn: { feld: "module", ist: "zahlungsdienstleister" } },
        { id: "zahlung_drittland", art: "text", label: "Drittland", hilfe: "z. B. USA", wenn: { feld: "zahlung_garantie", ist: ["nur_eu", "dpf"], nicht: true } },
        { id: "netzwerke", art: "text", label: "Verlinkte Netzwerke", vorschlaege: ["Instagram", "Facebook", "Instagram und Facebook", "LinkedIn"], wenn: { feld: "module", ist: "social_media_links" } },
        { id: "dsb", selten: true, art: "text", label: "Datenschutzbeauftragte/r (falls benannt)" },
        { id: "ergaenzung", selten: true, art: "mehrzeilig", label: "Weitere Verarbeitungen", hilfe: "nur falls deine Website noch etwas anderes nutzt" },
        { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" },
      ],
    },
  ],
  pruefen: (d, b) => [
    ...(b.bundesland ? [] : ["Bundesland (Mein Betrieb) – für die zuständige Aufsichtsbehörde"]),
    ...(b.email.trim() ? [] : ["E-Mail (Mein Betrieb)"]),
    ...(auswahl(d, "module").includes("google_fonts_lokal") && auswahl(d, "module").includes("google_fonts_extern") ? ["Schriftarten: entweder lokal oder extern wählen"] : []),
    // nur ein Hinweis – der Baustein wird nicht von selbst ergänzt
    ...(auswahl(d, "module").some((m) => MIT_EINWILLIGUNG.includes(m)) && !auswahl(d, "module").includes("widerruf_einwilligung") ? ["Einwilligungen gewählt – Hinweis auf den Widerruf fehlt"] : []),
    // R12 (Coach #16): jede Website liegt bei einem Hosting-Anbieter – ohne den Baustein fehlt meist ein Empfänger
    ...(auswahl(d, "module").length && !auswahl(d, "module").includes("hosting") ? [DSE_OHNE_HOSTING] : []),
  ],
  alsText: (d, b) => ["Datenschutzerklärung", ...dseTeile(d, b).map((t) => `${t.titel}\n${alsKlartext(t.text)}`), text(d, "stand") ? `Stand: ${datumDe(text(d, "stand"))}` : ""].filter(Boolean).join("\n\n"),
  html(d, b) {
    const website = text(d, "website") || (b.website ?? "").trim();
    return dokument({
      titel: "Datenschutzerklärung",
      betrieb: b,
      // die Website steht als Unterzeile, nicht noch einmal in der Kennungsleiste
      unter: website || undefined,
      meta: `Stand: ${datumDe(text(d, "stand"))}`,
      inhalt: abschnitte(dseTeile(d, b).map((t) => ({ titel: t.titel, inhalt: alsHtml(t.text) }))),
    });
  },
};

// ---------------------------------------------------------------- Impressum (§ 5 DDG)

const RECHTSFORMEN_IMP = ["Einzelunternehmen", "e. K.", "GbR", "OHG", "KG", "UG (haftungsbeschränkt)", "GmbH"];
const VSBG: Record<string, string> = {
  nicht_bereit: "Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
  bereit: "Wir sind bereit, an Streitbeilegungsverfahren vor der folgenden Verbraucherschlichtungsstelle teilzunehmen:",
  keine_angabe: "",
};

/** R12: Antwort im Pflichten-Check → Rechtsform im Impressum */
const RECHTSFORM_AUS_CHECK: Record<string, string> = { einzelunternehmen: "Einzelunternehmen", freiberuf: "Einzelunternehmen", ek: "e. K.", gbr: "GbR", ug: "UG (haftungsbeschränkt)", gmbh: "GmbH" };

/** Rechtsform: gewählt, sonst aus „Mein Betrieb“, sonst Einzelunternehmen. */
// Vorprüfung 21.10.2026: ohne Angabe die Rechtsform aus dem Namen („Salon Sonne GmbH“) – sonst stand bei einer GmbH „Inhaber/in“
const rechtsformImp = (d: Daten, b: Betrieb) => rechtsformAus(text(d, "rechtsform") || b.rechtsform || formImNamen(b.name) || "", RECHTSFORMEN_IMP) || "Einzelunternehmen";
/** Juristische Personen (§ 5 Abs. 1 Nr. 1 DDG): Rechtsform und Vertretungsberechtigte; Personengesellschaften ebenso vertreten. */
const IMP_VERTRETUNG: Record<string, string> = { "Einzelunternehmen": "Inhaber/in", "e. K.": "Inhaber/in", GbR: "Vertretungsberechtigte Gesellschafter/innen", OHG: "Vertretungsberechtigte Gesellschafter/innen", KG: "Vertretungsberechtigte Gesellschafter/innen", "UG (haftungsbeschränkt)": "Vertretungsberechtigte Geschäftsführung", GmbH: "Vertretungsberechtigte Geschäftsführung" };

function impressumTeile(d: Daten, b: Betrieb): { titel: string; text: string }[] {
  const rf = rechtsformImp(d, b);
  // Stammkapital als eigener Teil nach dem Registereintrag (nicht unter „Vertreten durch“)
  const kapital = text(d, "kapital") && /GmbH|UG/.test(rf) ? { titel: "Stammkapital", text: `${text(d, "kapital")}${text(d, "ausstehend") ? `\nAusstehende Einlagen: ${text(d, "ausstehend")}` : ""}` } : null;
  const t: { titel: string; text: string }[] = [
    { titel: "Angaben gemäß § 5 DDG", text: [b.name.trim() + (!b.name.includes(rf) && rf !== "Einzelunternehmen" ? ` ${rf}` : ""), b.strasse, [b.plz, b.ort].filter(Boolean).join(" "), ...(rf !== "Einzelunternehmen" ? [`Rechtsform: ${rf}`] : [])].filter((x) => x.trim()).join("\n") || FEHLT },
    { titel: IMP_VERTRETUNG[rf] ?? (istKapitalgesellschaft(rf) ? "Vertretungsberechtigte Geschäftsführung" : "Vertreten durch"), text: text(d, "vertreten") || (b.vertretung ?? "").trim() || b.verantwortlich.trim() || FEHLT },
    { titel: "Kontakt", text: [b.telefon ? `Telefon: ${b.telefon}` : "", `E-Mail: ${b.email.trim() || FEHLT}`].filter(Boolean).join("\n") },
  ];
  const gericht = text(d, "register_gericht") || (b.registergericht ?? "").trim();
  const nummer = text(d, "register_nr") || (b.registernummer ?? "").trim();
  if (gericht || nummer) t.push({ titel: "Registereintrag", text: `Registergericht: ${gericht || FEHLT}\nRegisternummer: ${nummer || FEHLT}` });
  if (kapital) t.push(kapital);
  const ids = [b.ust_idnr.trim() ? `Umsatzsteuer-Identifikationsnummer nach § 27a UStG: ${b.ust_idnr.trim()}` : "", text(d, "wirtschafts_id") ? `Wirtschafts-Identifikationsnummer nach § 139c AO: ${text(d, "wirtschafts_id")}` : ""].filter(Boolean);
  if (ids.length) t.push({ titel: b.ust_idnr.trim() && text(d, "wirtschafts_id") ? "Umsatzsteuer-ID und Wirtschafts-ID" : b.ust_idnr.trim() ? "Umsatzsteuer-ID" : "Wirtschafts-ID", text: ids.join("\n") });
  // nur bei einer Tätigkeit, die eine behördliche Zulassung braucht (§ 5 Abs. 1 Nr. 3 DDG): das Feld hängt am Schalter
  // „zulassung“; ältere Impressen ohne den Schalter fragt die Prüfung nach (pruefen)
  if (text(d, "aufsicht")) t.push({ titel: "Zuständige Aufsichtsbehörde", text: text(d, "aufsicht") });
  if (ja(d, "reglementiert")) t.push({ titel: "Berufsrechtliche Angaben", text: [
    // Kammer nur, wenn der Betrieb einer angehört (§ 5 Abs. 1 Nr. 5 Buchst. a DDG) – viele reglementierte Berufe haben keine
    ...(text(d, "kammer") ? [`Kammer: ${text(d, "kammer")}`] : []), `Gesetzliche Berufsbezeichnung: ${text(d, "berufsbezeichnung") || FEHLT}, verliehen in ${text(d, "verleihung") || "Deutschland"}`, `Berufsrechtliche Regelungen: ${text(d, "regelungen") || FEHLT}`].join("\n") });
  if (text(d, "redaktion")) t.push({ titel: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV", text: text(d, "redaktion") });
  const v = text(d, "vsbg");
  if (v && VSBG[v]) t.push({ titel: "Verbraucherstreitbeilegung", text: v === "bereit" ? `${VSBG.bereit}\n${text(d, "schlichtungsstelle") || FEHLT}` : VSBG[v]! });
  return t;
}

export const impressum: Vorlage = {
  id: "impressum",
  gestalt: "handbuch",
  titel: "Impressum",
  beschreibung: "Die Anbieterangaben nach § 5 DDG für deine Website – Rechtsform wählen, Register und Kammer nur wenn nötig. Als Text zum Einfügen.",
  bereich: "betrieb",
  pflichten: ["online.impressum"],
  grundlage: "§ 5 DDG",
  // § 36 VSBG nur, wenn das Impressum eine Angabe zur Streitbeilegung enthält (R10, T-90)
  grundlageFuer: (d) => (text(d, "vsbg") && text(d, "vsbg") !== "keine_angabe" ? "§ 5 DDG; § 36 VSBG" : "§ 5 DDG"),
  ausBetrieb: { rechtsform: "rechtsform", vertreten: "vertretung", register_gericht: "registergericht", register_nr: "registernummer" },
  // R12 (Coach #15): Rechtsform aus dem Pflichten-Check, wenn „Mein Betrieb“ keine nennt
  // und Inhaber/in bzw. Geschäftsführung aus „Mein Betrieb“, damit das Feld nicht leer aussieht
  profilStart(profil, b) {
    const rf = RECHTSFORM_AUS_CHECK[String(profil.rechtsform ?? "")];
    const wer = (b?.vertretung ?? "").trim() || (b?.verantwortlich ?? "").trim();
    const start: Daten = { ...(rf ? { rechtsform: rf } : {}), ...(wer ? { vertreten: wer } : {}) };
    return start;
  },
  abschnitte: [
    { titel: "Angaben zum Unternehmen",
      hilfe: `Name, Anschrift, Telefon, E-Mail und USt-IdNr. übernimmt ${MARKE.name} aus „Mein Betrieb“. Die Steuernummer gehört nicht ins Impressum.`,
      felder: [
        { id: "rechtsform", art: "wahl", label: "Rechtsform", optionen: RECHTSFORMEN_IMP.map((r) => ({ wert: r, text: r })), hilfe: "ohne Auswahl die Rechtsform aus „Mein Betrieb“, sonst Einzelunternehmen" },
        // R12 (Coach #15): aus „Mein Betrieb“ vorbelegt (Inhaber/in bzw. Geschäftsführung)
        { id: "vertreten", art: "text", label: "Inhaber/in bzw. vertretungsberechtigte Person", hilfe: "aus „Mein Betrieb“ übernommen; bei mehreren alle nennen" },
        { id: "kapital", selten: true, art: "text", label: "Stammkapital", hilfe: "Freiwillig, nur bei GmbH/UG. Nennst du es, gehören die ausstehenden Einlagen dazu (§ 5 Abs. 1 Nr. 1 DDG) – sonst leer lassen." },
        { id: "ausstehend", art: "text", label: "Ausstehende Einlagen", hilfe: "Gibst du das Kapital an, gehören die ausstehenden Einlagen dazu – bei voller Einzahlung „keine“", wenn: { feld: "kapital" }, vorschlaege: ["keine"] },
        { id: "register_gericht", art: "text", label: "Registergericht", hilfe: "nur bei Eintragung, z. B. Amtsgericht München" },
        { id: "register_nr", art: "text", label: "Registernummer", hilfe: "z. B. HRB 123456" },
        { id: "wirtschafts_id", selten: true, art: "text", label: "Wirtschafts-Identifikationsnummer", hilfe: "nur falls vorhanden" },
      ],
    },
    {
      titel: "Nur falls zutreffend",
      felder: [
        // Vorprüfung 21.10.2026: Aufsichtsbehörde nur bei zulassungspflichtiger Tätigkeit (§ 5 Abs. 1 Nr. 3 DDG)
        { id: "zulassung", art: "schalter", label: "Tätigkeit braucht eine behördliche Zulassung", hilfe: "z. B. Gaststättenerlaubnis, Bewachungs- oder Maklererlaubnis – dann gehört die zuständige Aufsichtsbehörde ins Impressum (§ 5 Abs. 1 Nr. 3 DDG). Eine Gewerbeanmeldung allein ist keine Zulassung." },
        { id: "aufsicht", art: "text", label: "Zuständige Aufsichtsbehörde", hilfe: "Behörde, die die Zulassung erteilt hat bzw. überwacht – Name und Anschrift", wenn: { feld: "zulassung" }, pflicht: true },
        { id: "reglementiert", art: "schalter", label: "Reglementierter Beruf", hilfe: "z. B. zulassungspflichtiges Handwerk mit Meisterpflicht" },
        { id: "kammer", art: "text", label: "Kammer", hilfe: "nur, wenn du einer Kammer angehörst – sonst leer lassen", wenn: { feld: "reglementiert" }, vorschlaege: ["Handwerkskammer"] },
        { id: "berufsbezeichnung", art: "text", label: "Gesetzliche Berufsbezeichnung", wenn: { feld: "reglementiert" }, vorschlaege: ["Friseurmeister/in", "Elektrotechnikermeister/in"] },
        { id: "verleihung", art: "text", label: "Staat der Verleihung", wenn: { feld: "reglementiert" }, vorschlaege: ["Deutschland"] },
        { id: "regelungen", art: "text", label: "Berufsrechtliche Regelungen und wo sie zu finden sind", wenn: { feld: "reglementiert" }, vorschlaege: ["Handwerksordnung (HwO), abrufbar unter www.gesetze-im-internet.de"] },
        // nur auf ausdrückliche Wahl (R10): § 18 Abs. 2 MStV gilt nur für journalistisch-redaktionelle Angebote
        { id: "redaktionell", selten: true, art: "schalter", label: "Journalistisch-redaktionelle Inhalte (z. B. Blog mit Berichten)", hilfe: "Dann nennt das Impressum eine verantwortliche Person nach § 18 Abs. 2 MStV – für eine normale Firmenwebsite nicht nötig" },
        { id: "redaktion", art: "text", label: "Verantwortlich für redaktionelle Inhalte (Name, Anschrift)", wenn: { feld: "redaktionell" }, pflicht: true },
        { id: "vsbg", art: "wahl", label: "Verbraucherstreitbeilegung (§ 36 VSBG)", hilfe: "Pflicht ab mehr als 10 Beschäftigten oder wenn du teilnimmst", optionen: [{ wert: "keine_angabe", text: "keine Angabe" }, { wert: "nicht_bereit", text: "nicht bereit" }, { wert: "bereit", text: "bereit" }], vorbelegung: "keine_angabe" },
        { id: "schlichtungsstelle", art: "mehrzeilig", label: "Verbraucherschlichtungsstelle (Name, Anschrift, Website)", wenn: { feld: "vsbg", ist: "bereit" } },
      ],
    },
  ],
  pruefen(d, b) {
    const f: string[] = [];
    if (!b.name.trim() || !anschrift(b)) f.push("Name und Anschrift (Mein Betrieb)");
    if (!text(d, "vertreten") && !(b.vertretung ?? "").trim() && !b.verantwortlich.trim()) f.push("Inhaber/in bzw. vertretungsberechtigte Person");
    if (!b.email.trim()) f.push("E-Mail (Mein Betrieb)");
    if (!b.telefon.trim()) f.push("Telefon (Mein Betrieb) – neben der E-Mail ist ein zweiter direkter Kontaktweg nötig");
    // Kapital nur mit ausstehenden Einlagen (§ 35a Abs. 1 S. 2 GmbHG analog) – sonst lieber weglassen (R10)
    if (text(d, "kapital") && /GmbH|UG/.test(rechtsformImp(d, b)) && !text(d, "ausstehend")) f.push("Ausstehende Einlagen (bei voller Einzahlung „keine“) – oder das Stammkapital weglassen");
    // Hinweis: Name mit Rechtsform-Zusatz, der nicht zur gewählten Rechtsform passt („Salon Sonne GmbH“ als Einzelunternehmen)
    const imNamen = formImNamen(b.name);
    const rf = rechtsformImp(d, b);
    // Aufsichtsbehörde aus der Zeit vor dem Schalter „behördliche Zulassung“: nachfragen, statt sie still zu drucken
    if (text(d, "aufsicht") && d.zulassung === undefined) f.push("Aufsichtsbehörde eingetragen: Braucht deine Tätigkeit eine behördliche Zulassung? Dann den Schalter einschalten, sonst gehört die Behörde nicht ins Impressum.");
    if (imNamen && !formGleich(imNamen, rf)) f.push(`Der Name des Betriebs enthält die Rechtsform „${imNamen}“, gewählt ist „${rf}“ – bitte prüfen.`);
    return f;
  },
  alsText: (d, b) => ["Impressum", ...impressumTeile(d, b).map((t) => `${t.titel}\n${alsKlartext(t.text)}`)].join("\n\n"),
  html(d, b) {
    return dokument({
      titel: "Impressum",
      betrieb: b,
      // ohne Inhaltsübersicht: das Impressum ist kurz, die Übersicht schöbe nur Zeilen auf eine zweite Seite
      inhalt: impressumTeile(d, b)
        .map((t) => abschnitt(t.titel, `<p>${esc(t.text).replace(/\n/g, "<br>").replace(/\uE000/g, LINIE)}</p>`))
        .join(""),
    });
  },
};

// ---------------------------------------------------------------- Auftragsverarbeitung (Art. 28 DSGVO)

const ROLLE = { auftraggeber: "Wir beauftragen einen Dienstleister", dienstleister: "Wir verarbeiten Daten für einen Kunden" };
const DAUER = ["für die Laufzeit des Hauptvertrags", "unbefristet; kündbar mit dem Hauptvertrag"];
/**
 * Vorprüfung 21.10.2026 (AVV): Mindestinhalt nach Art. 28 Abs. 3 DSGVO war erfüllt, aber Anlagen nur als Freitext. Neu:
 * Unterauftragsverarbeiter als Tabelle mit Genehmigungsart, TOM nach Kategorien (Art. 32 Abs. 1 lit. a–d), Ort der
 * Verarbeitung mit Transfermechanismus, Weisungsberechtigte, Meldefrist mit Inhalt nach Art. 33 Abs. 3, Kontrollrechte,
 * Laufzeit, Haftung – oder die Standardvertragsklauseln der Kommission nach Art. 28 Abs. 7 DSGVO. Fachlich zu prüfen.
 */
const AVV_MUSTER: Record<string, string> = { eigen: "Dieser Vertrag (Muster)", scc: "EU-Standardvertragsklauseln nach Art. 28 Abs. 7 DSGVO" };
export const AVV_SCC_FUNDSTELLE = "Durchführungsbeschluss (EU) 2021/915 der Kommission vom 4. Juni 2021 (ABl. L 199 vom 7.6.2021, S. 18)";
const GENEHMIGUNG: Record<string, string> = { gesondert: "gesonderte Genehmigung je Unterauftragsverarbeiter", allgemein: "allgemeine Genehmigung mit Einspruchsfrist" };
const AVV_ORT: Record<string, string> = { eu: "nur in der EU bzw. im EWR", drittland: "auch in einem Drittland" };
const AVV_TRANSFER: Record<string, string> = {
  angemessenheit: "Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO; für die USA das EU-U.S. Data Privacy Framework, Durchführungsbeschluss (EU) 2023/1795, bei zertifizierten Empfängern)",
  scc2: "EU-Standardvertragsklauseln, Modul 2 – Auftragnehmer selbst im Drittland (Art. 46 Abs. 2 lit. c DSGVO, Durchführungsbeschluss (EU) 2021/914)",
  scc3: "EU-Standardvertragsklauseln, Modul 3 – Unterauftragsverarbeiter im Drittland (Art. 46 Abs. 2 lit. c DSGVO, Durchführungsbeschluss (EU) 2021/914)",
};
const MELDEFRIST: Record<string, string> = { "24": "innerhalb von 24 Stunden", "48": "innerhalb von 48 Stunden", unverzueglich: "unverzüglich" };
const KONTROLLKOSTEN: Record<string, string> = { eigene: "Jede Partei trägt ihre eigenen Kosten der Kontrolle.", auftraggeber: "Der Auftraggeber erstattet dem Auftragnehmer den nachgewiesenen angemessenen Aufwand einer Vor-Ort-Kontrolle." };
/** TOM nach den üblichen Kontrollkategorien, zugeordnet zu Art. 32 Abs. 1 lit. a–d DSGVO. */
const AVV_TOM: { id: string; label: string; rand: string; vorschlaege: string[] }[] = [
  { id: "tom_zutritt", label: "Zutrittskontrolle (Räume)", rand: "Art. 32 Abs. 1 lit. b", vorschlaege: ["Büroräume abgeschlossen; Schlüssel nur an berechtigte Personen, Ausgabe dokumentiert", "Server im Rechenzentrum mit Zutrittskontrolle"] },
  { id: "tom_zugang", label: "Zugangskontrolle (Systeme)", rand: "Art. 32 Abs. 1 lit. b", vorschlaege: ["Persönliche Benutzerkonten mit sicheren Passwörtern und Zwei-Faktor-Anmeldung", "Bildschirmsperre nach kurzer Inaktivität"] },
  { id: "tom_zugriff", label: "Zugriffskontrolle (Berechtigungen)", rand: "Art. 32 Abs. 1 lit. b", vorschlaege: ["Zugriff nur auf die Daten, die für die Aufgabe nötig sind; Berechtigungen werden regelmäßig geprüft"] },
  { id: "tom_trennung", label: "Trennungskontrolle", rand: "Art. 32 Abs. 1 lit. b", vorschlaege: ["Daten des Auftraggebers getrennt von Daten anderer Kunden (eigener Mandant bzw. Ordner)"] },
  { id: "tom_weitergabe", label: "Weitergabekontrolle (Übertragung, Verschlüsselung)", rand: "Art. 32 Abs. 1 lit. a, b", vorschlaege: ["Übertragung nur verschlüsselt (TLS); Datenträger und Geräte verschlüsselt"] },
  { id: "tom_verfuegbarkeit", label: "Verfügbarkeit und Belastbarkeit", rand: "Art. 32 Abs. 1 lit. b", vorschlaege: ["Tägliche Datensicherung an einem getrennten Ort; Virenschutz und aktuelle Updates"] },
  { id: "tom_wiederherstellung", label: "Wiederherstellung nach einem Zwischenfall", rand: "Art. 32 Abs. 1 lit. c", vorschlaege: ["Wiederherstellung aus der Datensicherung wird regelmäßig getestet"] },
  { id: "tom_ueberpruefung", label: "Regelmäßige Überprüfung der Wirksamkeit", rand: "Art. 32 Abs. 1 lit. d", vorschlaege: ["Die Maßnahmen werden mindestens jährlich und bei Änderungen überprüft"] },
];

export const auftragsverarbeitung: Vorlage = {
  id: "avv",
  gestalt: "vertrag",
  titel: "Vertrag zur Auftragsverarbeitung (AVV)",
  beschreibung: "Vertrag mit einem kleinen Dienstleister, der für dich Daten verarbeitet – mit allen Pflichtklauseln nach Art. 28 Abs. 3 DSGVO, Unterauftragsverarbeitern und Maßnahmen nach Art. 32 DSGVO.",
  bereich: "datenschutz",
  pflichten: ["datenschutz.avv"],
  grundlage: "Art. 28 Abs. 3 DSGVO",
  grundlageFuer: (d) => (text(d, "muster") === "scc" ? "Art. 28 Abs. 3, 7 DSGVO" : "Art. 28 Abs. 3 DSGVO"),
  namensFeld: "partner",
  abschnitte: [
    { titel: "Vertragspartner",
      hilfe: "Große Dienstleister (Hosting, Kassensysteme, Buchungsplattformen) stellen meist einen eigenen Vertrag – dann den unterschreiben und ablegen. Diese Vorlage ist für kleine Dienstleister ohne eigenes Muster, z. B. IT-Betreuung oder Lohnbüro. Steuerberatung braucht in der Regel keinen solchen Vertrag.",
      felder: [
        { id: "rolle", art: "wahl", label: "Wer ist wer", optionen: optionen(ROLLE), vorbelegung: "auftraggeber" },
        { id: "partner", art: "text", label: "Vertragspartner", pflicht: true },
        { id: "partner_anschrift", art: "mehrzeilig", label: "Anschrift des Vertragspartners", pflicht: true },
        { id: "hauptvertrag", art: "text", label: "Zugrunde liegender Vertrag", hilfe: "z. B. Vertrag über Online-Terminbuchung vom …", pflicht: true },
        { id: "muster", art: "wahl", label: "Vertragstext", optionen: optionen(AVV_MUSTER), vorbelegung: "eigen", hilfe: "Die EU-Standardvertragsklauseln (Durchführungsbeschluss (EU) 2021/915) sind ein amtliches Muster – mit ihnen entfällt die Diskussion über den Wortlaut. Das PDF füllt dann ihre Anhänge aus; den Klauseltext von EUR-Lex beilegen." },
        { id: "weisung_ag", art: "text", label: "Weisungsberechtigt beim Auftraggeber", hilfe: "Name und Kontakt – wer dem Dienstleister Weisungen erteilen darf" },
        { id: "weisung_an", art: "text", label: "Weisungsempfänger beim Auftragnehmer", hilfe: "Name und Kontakt der Ansprechperson beim Dienstleister" },
      ],
    },
    {
      titel: "Gegenstand der Verarbeitung (Art. 28 Abs. 3 Satz 1 DSGVO)",
      felder: [
        { id: "gegenstand", art: "mehrzeilig", label: "Gegenstand und Art der Verarbeitung", pflicht: true, vorschlaege: ["Bereitstellung und Betrieb eines Online-Terminbuchungssystems", "Hosting der Website", "Bereitstellung eines Kassensystems mit Cloud-Speicherung", "Durchführung der Lohnabrechnung", "Wartung und Betreuung der IT"] },
        { id: "zweck", art: "mehrzeilig", label: "Zweck der Verarbeitung", pflicht: true },
        { id: "dauer", art: "text", label: "Dauer", pflicht: true, vorschlaege: DAUER, hilfe: "Der Vertrag endet mit dem Hauptvertrag; die Pflichten gelten fort, bis alle Daten gelöscht oder zurückgegeben sind – das steht im PDF." },
        { id: "datenarten", art: "mehrzeilig", label: "Art der personenbezogenen Daten", pflicht: true, vorschlaege: ["Name", "Kontaktdaten (Telefon, E-Mail)", "Termine und gebuchte Leistungen", "Zahlungsdaten", "Beschäftigtendaten (Lohn, Steuer, Sozialversicherung)"] },
        { id: "betroffene", art: "mehrzeilig", label: "Kategorien betroffener Personen", pflicht: true, vorschlaege: ["Kundinnen und Kunden", "Interessenten", "Beschäftigte"] },
      ],
    },
    {
      titel: "Ort der Verarbeitung",
      felder: [
        { id: "ort", art: "wahl", label: "Verarbeitung", optionen: optionen(AVV_ORT), vorbelegung: "eu" },
        { id: "drittland_land", art: "text", label: "Drittland", wenn: { feld: "ort", ist: "drittland" }, pflicht: true, hilfe: "z. B. USA" },
        { id: "drittland_garantie", art: "wahl", label: "Grundlage der Übermittlung", optionen: optionen(AVV_TRANSFER), wenn: { feld: "ort", ist: "drittland" }, pflicht: true, hilfe: "Modul 3 der Standardvertragsklauseln, wenn ein Unterauftragsverarbeiter des Dienstleisters im Drittland sitzt; Modul 2, wenn der Dienstleister selbst dort sitzt." },
      ],
    },
    {
      titel: "Unterauftragsverarbeiter",
      hilfe: "Wen der Dienstleister seinerseits einsetzt (z. B. Rechenzentrum, E-Mail-Dienst). Keine: Liste leer lassen.",
      felder: [
        {
          id: "unterauftragnehmer",
          art: "liste",
          label: "Genehmigte Unterauftragsverarbeiter",
          eintrag: "Unterauftragsverarbeiter",
          titelFeld: "name",
          leerStarten: true,
          felder: [
            { id: "name", art: "text", label: "Name", pflicht: true },
            { id: "anschrift", art: "text", label: "Anschrift", pflicht: true },
            { id: "leistung", art: "text", label: "Leistung", pflicht: true, vorschlaege: ["Hosting / Rechenzentrum", "E-Mail-Dienst", "Fernwartung", "Datensicherung"] },
            { id: "ort", art: "text", label: "Ort der Verarbeitung", vorschlaege: ["Deutschland", "EU", "USA"] },
          ],
        },
        { id: "genehmigung", art: "wahl", label: "Neue Unterauftragsverarbeiter", optionen: optionen(GENEHMIGUNG), vorbelegung: "gesondert", hilfe: "Gesondert: jeder neue braucht deine vorherige Zustimmung. Allgemein: der Dienstleister kündigt neue vorher an, du kannst innerhalb der Frist widersprechen (Art. 28 Abs. 2 DSGVO)." },
        { id: "einspruch_tage", art: "zahl", label: "Einspruchsfrist (Tage)", vorbelegung: "14", wenn: { feld: "genehmigung", ist: "allgemein" }, pflicht: true },
        // bis zur Vorprüfung ein Freitextfeld – bleibt für gespeicherte Verträge
        { id: "unterauftrag", selten: true, art: "mehrzeilig", label: "Weitere Angaben zu Unterauftragsverarbeitern" },
      ],
    },
    {
      titel: "Technische und organisatorische Maßnahmen (Art. 32 DSGVO)",
      hilfe: "Was der Dienstleister zum Schutz der Daten tut – je Kategorie. Hat er eine eigene Beschreibung, genügt hier ein Verweis auf die Anlage.",
      felder: [
        ...AVV_TOM.map((t): EinfachesFeld => ({ id: t.id, art: "mehrzeilig", label: t.label, vorschlaege: t.vorschlaege })),
        // bis zur Vorprüfung ein Feld für alle Maßnahmen – bleibt für gespeicherte Verträge und den Verweis auf eine Anlage
        { id: "tom", selten: true, art: "mehrzeilig", label: "Weitere Maßnahmen bzw. Verweis auf eine Anlage", vorschlaege: ["Die technischen und organisatorischen Maßnahmen des Auftragnehmers sind ergänzend in der Anlage beschrieben."] },
      ],
    },
    {
      titel: "Meldung, Kontrolle und Unterschrift",
      felder: [
        { id: "meldefrist", art: "wahl", label: "Meldung von Datenschutzverletzungen an dich", optionen: optionen(MELDEFRIST), vorbelegung: "24", hilfe: "Du selbst musst binnen 72 Stunden an die Aufsichtsbehörde melden (Art. 33 Abs. 1 DSGVO) – eine feste Frist für den Dienstleister lässt dir dafür Zeit." },
        { id: "kontrolle_tage", art: "zahl", label: "Ankündigung einer Vor-Ort-Kontrolle (Tage vorher)", vorbelegung: "14" },
        { id: "kontrolle_kosten", art: "wahl", label: "Kosten einer Kontrolle", optionen: optionen(KONTROLLKOSTEN), vorbelegung: "eigene" },
        { id: "zertifikate", art: "schalter", label: "Nachweis auch durch Zertifikate oder Prüfberichte", vorbelegung: true, hilfe: "z. B. ISO 27001 oder ein aktueller Prüfbericht – statt einer Kontrolle vor Ort" },
        { id: "ort_datum", art: "text", label: "Ort", hilfe: "für die Unterschrift" },
      ],
    },
  ],
  pruefen(d) {
    const f: string[] = [];
    // TOM: mindestens eine Kategorie oder der Verweis auf die Anlage (Art. 28 Abs. 3 lit. c DSGVO)
    if (!AVV_TOM.some((t) => text(d, t.id)) && !text(d, "tom")) f.push("Technische und organisatorische Maßnahmen (mindestens eine Kategorie oder Verweis auf eine Anlage)");
    return f;
  },
  html(d, b) {
    const ag = text(d, "rolle") !== "dienstleister";
    const scc = text(d, "muster") === "scc";
    // der Betrieb als Partei: bei einer Kapitalgesellschaft mit Geschäftsführung in „Mein Betrieb“ „vertreten durch …“
    const vertreten = mitVertretung(b) !== b.name.trim() ? `vertreten durch ${(b.vertretung ?? "").trim()}` : undefined;
    // Hauptvertrag in Anführungszeichen; Anführungszeichen in der Eingabe werden zu halben („Vertrag ‚Salon M‘ vom …“)
    const hauptvertrag = text(d, "hauptvertrag").replace(/[„"“]([^„"“”]*)[“"”]/g, "‚$1‘");
    // Unterschrift mit dem Namen der Partei, z. B. „Auftraggeber (Salon Sonne GmbH)“
    const mitName = (rolle: string, name: string) => (name.trim() ? `${rolle} (${name.trim()})` : rolle);
    // mehrzeilige Angaben in einer Zeile: Satzzeichen am Zeilenende entfallen („Name., Kontaktdaten“)
    const reihe = (k: string) => text(d, k).split("\n").map((z) => z.trim().replace(/[.;,]+$/, "")).filter(Boolean).join(", ");
    // Blatt zum Ausfüllen von Hand: noch kein Vertragspartner und kein Gegenstand
    const leer = !text(d, "partner") && !text(d, "gegenstand");
    const unter = liste(d, "unterauftragnehmer").filter((x) => text(x, "name"));
    const allgemein = text(d, "genehmigung") === "allgemein";
    const tage = text(d, "einspruch_tage") || "14";
    const ankuendigung = text(d, "kontrolle_tage") || "14";
    const frist = MELDEFRIST[text(d, "meldefrist")] ?? MELDEFRIST["24"]!;
    const gegenstand = angaben([
      // leer: Gegenstand und Zweck mit zwei Linien zum Ausfüllen von Hand (Daten und Personen stehen in einer Zeile)
      ["Gegenstand und Art", text(d, "gegenstand"), 2],
      ["Zweck", text(d, "zweck"), 2],
      ["Dauer", text(d, "dauer")],
      ["Art der personenbezogenen Daten", reihe("datenarten")],
      ["Kategorien betroffener Personen", reihe("betroffene")],
    ]);
    const unterTabelle =
      unter.length || leer
        ? tabelle(["Name", "Anschrift", "Leistung", "Ort der Verarbeitung"], unter.map((x) => [`<strong>${zelle(text(x, "name"))}</strong>`, zelle(text(x, "anschrift")), zelle(text(x, "leistung")), zelle(text(x, "ort"))]), { breiten: ["24%", "32%", "26%", "18%"], ...(unter.length ? {} : { mindestens: 3, hoch: true }) })
        : `<p>${text(d, "unterauftrag") && !/^keine\.?$/i.test(text(d, "unterauftrag")) ? "" : "Der Auftragnehmer setzt derzeit keine Unterauftragsverarbeiter ein."}</p>`;
    const unterWeitere = text(d, "unterauftrag") && !/^keine\.?$/i.test(text(d, "unterauftrag")) ? zeilen(text(d, "unterauftrag")) : "";
    // leeres Blatt: Genehmigungsart und Ort zum Ankreuzen statt der Startauswahl
    const genehmigungSatz = leer
      ? ankreuzen(["Neue Unterauftragsverarbeiter setzt der Auftragnehmer nur nach vorheriger gesonderter schriftlicher Genehmigung des Auftraggebers ein.", `Allgemeine Genehmigung: Der Auftragnehmer informiert mindestens ${tage} Tage vorher; der Auftraggeber kann innerhalb dieser Frist Einspruch erheben.`])
      : `<p>${
          allgemein
            ? `Der Auftraggeber erteilt eine allgemeine schriftliche Genehmigung zum Einsatz weiterer Unterauftragsverarbeiter (Art. 28 Abs. 2 DSGVO). Der Auftragnehmer informiert den Auftraggeber mindestens ${esc(tage)} Tage vor dem Einsatz oder Austausch eines Unterauftragsverarbeiters in Textform; der Auftraggeber kann innerhalb dieser Frist aus wichtigem datenschutzrechtlichem Grund Einspruch erheben. Bis dahin unterbleibt der Einsatz.`
            : "Die oben genannten Unterauftragsverarbeiter gelten als genehmigt. Weitere setzt der Auftragnehmer nur nach vorheriger gesonderter schriftlicher Genehmigung des Auftraggebers ein (Art. 28 Abs. 2 DSGVO)."
        } Der Auftragnehmer erlegt ihnen vertraglich dieselben Datenschutzpflichten auf (Art. 28 Abs. 4 DSGVO).</p>`;
    // TOM je Kategorie mit Bezug zu Art. 32 Abs. 1 lit. a–d; ohne Angabe eine Linie (auch im ausgefüllten Vertrag sichtbar)
    const tomTabelle = angaben(AVV_TOM.map((t) => [`${t.label} (${t.rand.replace("Art. 32 Abs. 1 ", "")})`, reihe(t.id) ? text(d, t.id) : text(d, "tom") && !leer ? null : "", leer ? 2 : 1]));
    const tomWeitere = text(d, "tom") ? zeilen(text(d, "tom")) + (/Anlage/i.test(text(d, "tom")) ? "<p>Anlage: Technische und organisatorische Maßnahmen des Auftragnehmers</p>" : "") : "";
    const ortSatz =
      text(d, "ort") === "drittland"
        ? `<p>Die Verarbeitung findet auch in folgendem Drittland statt: ${text(d, "drittland_land") ? esc(text(d, "drittland_land")) : LINIE}. Grundlage der Übermittlung: ${AVV_TRANSFER[text(d, "drittland_garantie")] ? esc(AVV_TRANSFER[text(d, "drittland_garantie")]!) : LINIE}.</p>`
        : leer
          ? ankreuzen(["Die Verarbeitung findet ausschließlich in der EU bzw. im EWR statt.", "Die Verarbeitung findet auch in einem Drittland statt: ____ – Grundlage: ____"])
          : "<p>Die Verarbeitung findet ausschließlich in der Europäischen Union bzw. im Europäischen Wirtschaftsraum statt. Eine Verlagerung in ein Drittland ist nur mit vorheriger Zustimmung des Auftraggebers und unter den Voraussetzungen der Art. 44 ff. DSGVO zulässig.</p>";
    const weisung = angaben([
      ["Weisungsberechtigt beim Auftraggeber", text(d, "weisung_ag")],
      ["Weisungsempfänger beim Auftragnehmer", text(d, "weisung_an")],
    ]);
    const parteienHtml = parteien(
      { rolle: "Verantwortlicher, Auftraggeber", name: ag ? b.name : text(d, "partner"), anschrift: ag ? anschriftMehrzeilig(b) : text(d, "partner_anschrift"), zusatz: ag ? vertreten : undefined },
      { rolle: "Auftragsverarbeiter, Auftragnehmer", name: ag ? text(d, "partner") : b.name, anschrift: ag ? text(d, "partner_anschrift") : anschriftMehrzeilig(b), zusatz: ag ? undefined : vertreten },
    );
    const unterschrift = unterschriften([mitName("Auftraggeber", ag ? mitVertretung(b) : text(d, "partner")), mitName("Auftragnehmer", ag ? text(d, "partner") : mitVertretung(b))], { ortDatum: true, orte: text(d, "rolle") === "dienstleister" ? ["", text(d, "ort_datum")] : [text(d, "ort_datum"), ""] });
    const hauptSatz = `<p>Dieser Vertrag ergänzt den Vertrag ${hauptvertrag ? `„${esc(hauptvertrag)}“` : LINIE} (Hauptvertrag) und regelt die Verarbeitung personenbezogener Daten im Auftrag nach Art. 28 DSGVO.</p>`;
    // Art. 28 Abs. 7 DSGVO: die Standardvertragsklauseln der Kommission – das PDF füllt deren Anhänge I–IV aus
    if (scc)
      return dokument({
        titel: "Vertrag zur Auftragsverarbeitung",
        betrieb: b,
        unter: "nach den Standardvertragsklauseln gemäß Art. 28 Abs. 7 DSGVO",
        meta: `Auftraggeber: ${ag ? b.name : text(d, "partner")}\nAuftragnehmer: ${ag ? text(d, "partner") : b.name}`,
        inhalt:
          parteienHtml +
          hauptSatz +
          abschnitt("Vereinbarung der Standardvertragsklauseln", `<p>Die Parteien vereinbaren für die Verarbeitung im Auftrag die Standardvertragsklauseln der Europäischen Kommission zwischen Verantwortlichen und Auftragsverarbeitern nach Art. 28 Abs. 7 DSGVO (${esc(AVV_SCC_FUNDSTELLE)}) in ihrem unveränderten Wortlaut; er liegt diesem Vertrag bei (EUR-Lex, CELEX 32021D0915). Die folgenden Angaben bilden die Anhänge der Klauseln.</p><p>Klausel 7.7 (Einsatz von Unterauftragsverarbeitern): ${allgemein ? `Option 2 – allgemeine schriftliche Genehmigung; der Auftragsverarbeiter unterrichtet den Verantwortlichen mindestens ${esc(tage)} Tage im Voraus.` : "Option 1 – vorherige gesonderte Genehmigung."}</p>`) +
          abschnitt("Anhang I – Liste der Parteien", weisung) +
          abschnitt("Anhang II – Beschreibung der Verarbeitung", gegenstand + ortSatz) +
          abschnitt("Anhang III – Technische und organisatorische Maßnahmen", tomTabelle + tomWeitere) +
          abschnitt("Anhang IV – Liste der Unterauftragsverarbeiter", unterTabelle + unterWeitere) +
          unterschrift,
      });
    const teile: [string, string][] = [
      ["Gegenstand, Dauer, Art und Zweck der Verarbeitung", gegenstand],
      ["Pflichten des Auftragnehmers (Art. 28 Abs. 3 Satz 2 lit. a–h DSGVO)", ""],
      ["Weisungen", weisung + "<p>Weisungen erteilt der Auftraggeber in Textform. Änderungen der Personen teilen sich die Parteien unverzüglich mit.</p>"],
      ["Ort der Verarbeitung", ortSatz],
      ["Unterauftragsverarbeiter", unterTabelle + unterWeitere + genehmigungSatz],
      // verweisen die TOM auf eine Anlage, wird sie am Ende dieses Paragraphen genannt (nicht allein über den Unterschriften)
      ["Technische und organisatorische Maßnahmen", tomTabelle + tomWeitere],
      [
        "Meldung von Datenschutzverletzungen",
        `<p>Der Auftragnehmer meldet dem Auftraggeber eine Verletzung des Schutzes personenbezogener Daten ${esc(frist === "unverzüglich" ? "unverzüglich" : `unverzüglich, spätestens ${frist}`)} nach Bekanntwerden. Die Meldung enthält, soweit bekannt, die Angaben nach Art. 33 Abs. 3 DSGVO: Art der Verletzung mit Kategorien und ungefährer Zahl der betroffenen Personen und Datensätze, Name und Kontaktdaten einer Ansprechperson, wahrscheinliche Folgen sowie ergriffene oder vorgeschlagene Maßnahmen. Was noch nicht bekannt ist, reicht er unverzüglich nach (Art. 33 Abs. 4 DSGVO).</p>`,
      ],
      [
        "Kontrollrechte",
        `<p>Der Auftraggeber kann die Einhaltung dieses Vertrags überprüfen, auch durch eine Kontrolle vor Ort zu den üblichen Geschäftszeiten; sie wird mindestens ${esc(ankuendigung)} Tage vorher angekündigt, außer bei einem konkreten Verdacht auf einen Verstoß.${d.zertifikate !== false ? " Der Auftragnehmer kann die Einhaltung auch durch aktuelle Zertifikate oder Prüfberichte unabhängiger Stellen (z. B. nach ISO 27001) nachweisen; eine Kontrolle vor Ort bleibt möglich, wenn diese Nachweise nicht genügen." : ""} ${esc(KONTROLLKOSTEN[text(d, "kontrolle_kosten")] ?? KONTROLLKOSTEN.eigene!)}</p>`,
      ],
      ["Rechte und Pflichten des Auftraggebers", "<p>Der Auftraggeber ist für die Rechtmäßigkeit der Verarbeitung verantwortlich und erteilt Weisungen in dokumentierter Form. Er ist berechtigt, die Einhaltung dieses Vertrags zu überprüfen.</p>"],
      ["Laufzeit und Beendigung", "<p>Dieser Vertrag gilt für die Dauer des Hauptvertrags und endet mit ihm, ohne dass es einer gesonderten Kündigung bedarf. Die Pflichten des Auftragnehmers aus diesem Vertrag gelten fort, bis alle personenbezogenen Daten des Auftraggebers gelöscht oder zurückgegeben sind.</p>"],
      ["Haftung", "<p>Für Schäden aus einer Verarbeitung, die gegen die DSGVO verstößt, haften die Parteien nach Art. 82 DSGVO. Haftungsbeschränkungen richten sich nach dem Hauptvertrag, soweit sie gesetzlich zulässig sind.</p>"],
    ];
    const tomNr = teile.findIndex(([t]) => t === "Technische und organisatorische Maßnahmen") + 1;
    teile[1]![1] = AVV_KLAUSELN.map((k) => `<p><strong>(${esc(k.lit)})</strong> ${esc(k.text.replace(/in Anlage \{nr\} beschrieben/, `in § ${tomNr} („Technische und organisatorische Maßnahmen“) dieses Vertrags beschrieben`))}</p>`).join("");
    return dokument({
      titel: "Vertrag zur Auftragsverarbeitung",
      betrieb: b,
      unter: "gemäß Art. 28 Abs. 3 DSGVO",
      meta: `Auftraggeber: ${ag ? b.name : text(d, "partner")}\nAuftragnehmer: ${ag ? text(d, "partner") : b.name}`,
      inhalt:
        parteienHtml +
        // ohne Angabe: Linie zum Eintragen des Hauptvertrags statt den Satz wegzulassen
        hauptSatz +
        teile.map(([t, inhalt]) => abschnitt(t, inhalt)).join("") +
        // der Ort gilt für die eigene Unterschrift (Betrieb = Auftraggeber bzw. Dienstleister je nach „Wer ist wer“)
        unterschrift,
    });
  },
};
