/**
 * Website und Verträge (E-121, E-123): Datenschutzerklärung für die Website aus Bausteinen, Impressum nach § 5 DDG,
 * Vertrag zur Auftragsverarbeitung mit den Pflichtinhalten nach Art. 28 Abs. 3 DSGVO. Texte aus bausteine.ts.
 */
import { AVV_KLAUSELN, DSE } from "./bausteine.js";
import { aufsichtFuer } from "./datenschutz.js";
import { LINIE, abschnitt, abschnitte, angaben, anschrift, auswahl, datumDe, dokument, esc, ja, parteien, text, unterschriften, zeilen } from "./html.js";
import { optionen } from "./konstanten.js";
import type { Betrieb, Daten, Vorlage } from "./typen.js";

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
    aufsichtsbehoerde_name: a?.name ?? "", aufsichtsbehoerde_ort: a?.ort ?? "", aufsichtsbehoerde_url: a?.url ?? "",
  };
  return t
    .replace(/\{optional: ([^{}]*)\{dsb_kontakt\}([^{}]*)\}/g, (_, v, n) => (text(d, "dsb") ? `${v}${text(d, "dsb")}${n}` : ""))
    .replace(/\{nach Ende der Sitzung \/ nach \{dauer\}\}/g, "{cookie_dauer}")
    .replace(/\{Speicherung Ihrer Cookie-Auswahl, Warenkorb, Login\}/g, "{cookie_zwecke}")
    .replace(/\{30\}/g, "{logfile_tage}")
    .replace(/ \{und Ihren Namen\}/g, "")
    .replace(/\{([a-z_]+)\}/g, (_, k: string) => (werte[k]?.trim() ? werte[k]!.trim() : FEHLT))
    .replace(/\s+\./g, ".")
    .replace(/ {2,}/g, " ")
    .trim();
}
const alsHtml = (t: string) => `<p>${esc(t).replace(/\uE000/g, LINIE)}</p>`;
const alsKlartext = (t: string) => t.replace(/\uE000/g, "[bitte ergänzen]");

/** Bausteine der Datenschutzerklärung in fester Reihenfolge; „immer“ steht in jeder Erklärung. */
const DSE_REIHE: { id: string; immer?: boolean }[] = [
  { id: "verantwortlicher", immer: true },
  { id: "hosting" },
  { id: "server_logfiles" },
  { id: "kontakt" },
  { id: "cookies_einwilligung" },
  { id: "technisch_notwendige_cookies" },
  { id: "online_terminbuchung" },
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
const DSE_WAHL = DSE_REIHE.filter((x) => !x.immer && DSE[x.id]).map((x) => ({ wert: x.id, text: DSE[x.id]!.titel, quelle: DSE[x.id]!.quelle }));

function dseTeile(d: Daten, b: Betrieb): { titel: string; text: string }[] {
  const an = new Set(auswahl(d, "module"));
  const teile = DSE_REIHE.filter((x) => (x.immer || an.has(x.id)) && DSE[x.id]).map((x) => ({ titel: DSE[x.id]!.titel, text: bausteinText(DSE[x.id]!.text, d, b) }));
  const rechte = teile.findIndex((t) => t.titel === DSE.betroffenenrechte?.titel);
  const vorRechten = [
    ...(text(d, "ergaenzung") ? [{ titel: "Weitere Verarbeitungen", text: text(d, "ergaenzung") }] : []),
    { titel: "Pflicht zur Bereitstellung", text: "Sie sind weder gesetzlich noch vertraglich verpflichtet, uns personenbezogene Daten bereitzustellen. Ohne die technisch erforderlichen Daten kann die Website jedoch nicht angezeigt werden; ohne Angaben in einer Anfrage können wir diese nicht bearbeiten." },
    { titel: "Automatisierte Entscheidungen", text: "Eine automatisierte Entscheidungsfindung einschließlich Profiling findet nicht statt." },
  ];
  teile.splice(rechte < 0 ? teile.length : rechte, 0, ...vorRechten);
  return teile;
}

export const datenschutzerklaerungWebsite: Vorlage = {
  id: "datenschutzerklaerung_website",
  gestalt: "handbuch",
  titel: "Datenschutzerklärung für die Website",
  beschreibung: "Datenschutzerklärung aus Bausteinen: ankreuzen, was deine Website nutzt (Hosting, Kontakt, Cookies, Terminbuchung, Karten …) – als PDF und als Text zum Einfügen.",
  bereich: "datenschutz",
  pflichten: ["online.datenschutzerklaerung"],
  grundlage: "Art. 13 DSGVO; § 25 TDDDG",
  abschnitte: [
    { titel: "Deine Website",
      hilfe: "Verantwortliche Stelle, Kontakt und Aufsichtsbehörde übernimmt Amtlos aus „Mein Betrieb“.",
      felder: [
        { id: "website", art: "text", label: "Adresse der Website", hilfe: "z. B. www.salon-sonne.de" },
        { id: "module", art: "bausteine", label: "Was nutzt deine Website?", optionen: DSE_WAHL, vorbelegung: ["hosting", "server_logfiles", "kontakt", "widerruf_einwilligung"], pflicht: true },
      ],
    },
    {
      titel: "Angaben für die Bausteine",
      felder: [
        { id: "hoster_name", art: "text", label: "Hosting-Anbieter", wenn: { feld: "module", ist: "hosting" }, hilfe: "steht im Vertrag mit deinem Website-Anbieter" },
        { id: "hoster_anschrift", art: "text", label: "Anschrift des Hosting-Anbieters", wenn: { feld: "module", ist: "hosting" } },
        { id: "logfile_tage", art: "text", label: "Server-Logfiles werden gelöscht nach (Tagen)", hilfe: "laut Hosting-Anbieter", vorschlaege: ["7", "14", "30"], wenn: { feld: "module", ist: "server_logfiles" } },
        { id: "link_einstellungen", art: "text", label: "Wo Besucher Cookie-Einstellungen ändern können", vorschlaege: ["den Link „Cookie-Einstellungen“ am Ende jeder Seite"], wenn: { feld: "module", ist: "cookies_einwilligung" } },
        { id: "cookie_zwecke", art: "text", label: "Wofür technisch notwendige Cookies genutzt werden", vorschlaege: ["Speicherung Ihrer Cookie-Auswahl", "Speicherung Ihrer Cookie-Auswahl und des Warenkorbs"], wenn: { feld: "module", ist: "technisch_notwendige_cookies" } },
        { id: "cookie_dauer", art: "text", label: "Wann diese Cookies gelöscht werden", vorschlaege: ["nach Ende der Sitzung", "nach 12 Monaten"], wenn: { feld: "module", ist: "technisch_notwendige_cookies" } },
        { id: "termin_anbieter", art: "text", label: "Anbieter der Online-Terminbuchung", wenn: { feld: "module", ist: "online_terminbuchung" } },
        { id: "termin_anschrift", art: "text", label: "Anschrift des Terminbuchungs-Anbieters", wenn: { feld: "module", ist: "online_terminbuchung" } },
        { id: "newsletter_themen", art: "text", label: "Inhalt des Newsletters", vorschlaege: ["Angebote und Neuigkeiten aus unserem Betrieb"], wenn: { feld: "module", ist: "newsletter" } },
        { id: "newsletter_dienst", art: "text", label: "Versanddienstleister des Newsletters", wenn: { feld: "module", ist: "newsletter" } },
        { id: "netzwerke", art: "text", label: "Verlinkte Netzwerke", vorschlaege: ["Instagram", "Facebook", "Instagram und Facebook", "LinkedIn"], wenn: { feld: "module", ist: "social_media_links" } },
        { id: "dsb", selten: true, art: "text", label: "Datenschutzbeauftragte/r (falls benannt)" },
        { id: "ergaenzung", selten: true, art: "mehrzeilig", label: "Weitere Verarbeitungen", hilfe: "nur falls deine Website noch etwas anderes nutzt" },
        { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" },
      ],
    },
  ],
  pruefen: (_d, b) => [...(b.bundesland ? [] : ["Bundesland (Mein Betrieb) – für die zuständige Aufsichtsbehörde"]), ...(b.email.trim() ? [] : ["E-Mail (Mein Betrieb)"])],
  alsText: (d, b) => ["Datenschutzerklärung", ...dseTeile(d, b).map((t) => `${t.titel}\n${alsKlartext(t.text)}`), text(d, "stand") ? `Stand: ${datumDe(text(d, "stand"))}` : ""].filter(Boolean).join("\n\n"),
  html(d, b) {
    return dokument({
      titel: "Datenschutzerklärung",
      betrieb: b,
      unter: text(d, "website") || undefined,
      meta: `Website: ${text(d, "website")}\nStand: ${datumDe(text(d, "stand"))}`,
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

function impressumTeile(d: Daten, b: Betrieb): { titel: string; text: string }[] {
  const kapital = text(d, "kapital") && /GmbH|UG/.test(text(d, "rechtsform")) ? `\nStammkapital: ${text(d, "kapital")}${text(d, "ausstehend") ? `\nAusstehende Einlagen: ${text(d, "ausstehend")}` : ""}` : "";
  const t: { titel: string; text: string }[] = [
    { titel: "Angaben gemäß § 5 DDG", text: [b.name.trim() + (text(d, "rechtsform") && !b.name.includes(text(d, "rechtsform")) && text(d, "rechtsform") !== "Einzelunternehmen" ? ` ${text(d, "rechtsform")}` : ""), b.strasse, [b.plz, b.ort].filter(Boolean).join(" ")].filter((x) => x.trim()).join("\n") || FEHLT },
    { titel: text(d, "rechtsform") === "Einzelunternehmen" ? "Inhaber/in" : "Vertreten durch", text: (text(d, "vertreten") || b.verantwortlich || FEHLT) + kapital },
    { titel: "Kontakt", text: [b.telefon ? `Telefon: ${b.telefon}` : "", `E-Mail: ${b.email.trim() || FEHLT}`].filter(Boolean).join("\n") },
  ];
  if (text(d, "register_gericht") || text(d, "register_nr")) t.push({ titel: "Registereintrag", text: `Registergericht: ${text(d, "register_gericht") || FEHLT}\nRegisternummer: ${text(d, "register_nr") || FEHLT}` });
  const ids = [b.ust_idnr.trim() ? `Umsatzsteuer-Identifikationsnummer nach § 27a UStG: ${b.ust_idnr.trim()}` : "", text(d, "wirtschafts_id") ? `Wirtschafts-Identifikationsnummer nach § 139c AO: ${text(d, "wirtschafts_id")}` : ""].filter(Boolean);
  if (ids.length) t.push({ titel: "Umsatzsteuer-ID", text: ids.join("\n") });
  if (text(d, "aufsicht")) t.push({ titel: "Zuständige Aufsichtsbehörde", text: text(d, "aufsicht") });
  if (ja(d, "reglementiert")) t.push({ titel: "Berufsrechtliche Angaben", text: [`Kammer: ${text(d, "kammer") || FEHLT}`, `Gesetzliche Berufsbezeichnung: ${text(d, "berufsbezeichnung") || FEHLT}, verliehen in ${text(d, "verleihung") || "Deutschland"}`, `Berufsrechtliche Regelungen: ${text(d, "regelungen") || FEHLT}`].join("\n") });
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
  grundlage: "§ 5 DDG; § 36 VSBG",
  abschnitte: [
    { titel: "Angaben zum Unternehmen",
      hilfe: "Name, Anschrift, Telefon, E-Mail und USt-IdNr. übernimmt Amtlos aus „Mein Betrieb“. Die Steuernummer gehört nicht ins Impressum.",
      felder: [
        { id: "rechtsform", art: "wahl", label: "Rechtsform", optionen: RECHTSFORMEN_IMP.map((r) => ({ wert: r, text: r })), vorbelegung: "Einzelunternehmen" },
        { id: "vertreten", art: "text", label: "Inhaber/in bzw. vertretungsberechtigte Person", vorbelegung: "verantwortlich", pflicht: true },
        { id: "kapital", selten: true, art: "text", label: "Stammkapital", hilfe: "nur bei GmbH/UG und nur, wenn du es angeben möchtest" },
        { id: "ausstehend", selten: true, art: "text", label: "Ausstehende Einlagen", hilfe: "Pflicht, wenn Kapital angegeben und nicht voll eingezahlt", wenn: { feld: "kapital" } },
        { id: "register_gericht", art: "text", label: "Registergericht", hilfe: "nur bei Eintragung, z. B. Amtsgericht München" },
        { id: "register_nr", art: "text", label: "Registernummer", hilfe: "z. B. HRB 123456" },
        { id: "wirtschafts_id", selten: true, art: "text", label: "Wirtschafts-Identifikationsnummer", hilfe: "nur falls vorhanden" },
      ],
    },
    {
      titel: "Nur falls zutreffend",
      felder: [
        { id: "aufsicht", selten: true, art: "text", label: "Zuständige Aufsichtsbehörde", hilfe: "wenn deine Tätigkeit eine behördliche Zulassung braucht" },
        { id: "reglementiert", art: "schalter", label: "Reglementierter Beruf", hilfe: "z. B. zulassungspflichtiges Handwerk mit Meisterpflicht" },
        { id: "kammer", art: "text", label: "Kammer", wenn: { feld: "reglementiert" }, vorschlaege: ["Handwerkskammer"] },
        { id: "berufsbezeichnung", art: "text", label: "Gesetzliche Berufsbezeichnung", wenn: { feld: "reglementiert" }, vorschlaege: ["Friseurmeister/in", "Elektrotechnikermeister/in"] },
        { id: "verleihung", art: "text", label: "Staat der Verleihung", wenn: { feld: "reglementiert" }, vorschlaege: ["Deutschland"] },
        { id: "regelungen", art: "text", label: "Berufsrechtliche Regelungen und wo sie zu finden sind", wenn: { feld: "reglementiert" }, vorschlaege: ["Handwerksordnung (HwO), abrufbar unter www.gesetze-im-internet.de"] },
        { id: "redaktion", selten: true, art: "text", label: "Verantwortlich für redaktionelle Inhalte (Name, Anschrift)", hilfe: "nur bei journalistisch-redaktionellen Inhalten, z. B. Blog" },
        { id: "vsbg", art: "wahl", label: "Verbraucherstreitbeilegung (§ 36 VSBG)", hilfe: "Pflicht ab mehr als 10 Beschäftigten oder wenn du teilnimmst", optionen: [{ wert: "keine_angabe", text: "keine Angabe" }, { wert: "nicht_bereit", text: "nicht bereit" }, { wert: "bereit", text: "bereit" }], vorbelegung: "keine_angabe" },
        { id: "schlichtungsstelle", art: "mehrzeilig", label: "Verbraucherschlichtungsstelle (Name, Anschrift, Website)", wenn: { feld: "vsbg", ist: "bereit" } },
      ],
    },
  ],
  pruefen(_d, b) {
    const f: string[] = [];
    if (!b.name.trim() || !anschrift(b)) f.push("Name und Anschrift (Mein Betrieb)");
    if (!b.email.trim()) f.push("E-Mail (Mein Betrieb)");
    if (!b.telefon.trim()) f.push("Telefon (Mein Betrieb) – neben der E-Mail ist ein zweiter direkter Kontaktweg nötig");
    return f;
  },
  alsText: (d, b) => ["Impressum", ...impressumTeile(d, b).map((t) => `${t.titel}\n${alsKlartext(t.text)}`)].join("\n\n"),
  html(d, b) {
    return dokument({
      titel: "Impressum",
      betrieb: b,
      inhalt: abschnitte(impressumTeile(d, b).map((t) => ({ titel: t.titel, inhalt: `<p>${esc(t.text).replace(/\n/g, "<br>").replace(/\uE000/g, LINIE)}</p>` }))),
    });
  },
};

// ---------------------------------------------------------------- Auftragsverarbeitung (Art. 28 DSGVO)

const ROLLE = { auftraggeber: "Wir beauftragen einen Dienstleister", dienstleister: "Wir verarbeiten Daten für einen Kunden" };
const DAUER = ["für die Laufzeit des Hauptvertrags", "unbefristet; kündbar mit dem Hauptvertrag"];

export const auftragsverarbeitung: Vorlage = {
  id: "avv",
  gestalt: "vertrag",
  titel: "Vertrag zur Auftragsverarbeitung (AVV)",
  beschreibung: "Vertrag mit einem Dienstleister, der für dich Daten verarbeitet – mit allen Pflichtklauseln nach Art. 28 Abs. 3 DSGVO.",
  bereich: "datenschutz",
  pflichten: ["datenschutz.avv"],
  grundlage: "Art. 28 Abs. 3 DSGVO",
  namensFeld: "partner",
  abschnitte: [
    { titel: "Vertragspartner",
      hilfe: "Viele Anbieter stellen einen eigenen Vertrag bereit – dann den unterschreiben und ablegen. Als Muster eignen sich auch die EU-Standardvertragsklauseln (Durchführungsbeschluss (EU) 2021/915).",
      felder: [
        { id: "rolle", art: "wahl", label: "Wer ist wer", optionen: optionen(ROLLE), vorbelegung: "auftraggeber" },
        { id: "partner", art: "text", label: "Vertragspartner", pflicht: true },
        { id: "partner_anschrift", art: "mehrzeilig", label: "Anschrift des Vertragspartners", pflicht: true },
        { id: "hauptvertrag", art: "text", label: "Zugrunde liegender Vertrag", hilfe: "z. B. Vertrag über Online-Terminbuchung vom …", pflicht: true },
      ],
    },
    {
      titel: "Gegenstand der Verarbeitung (Art. 28 Abs. 3 Satz 1 DSGVO)",
      felder: [
        { id: "gegenstand", art: "mehrzeilig", label: "Gegenstand und Art der Verarbeitung", pflicht: true, vorschlaege: ["Bereitstellung und Betrieb eines Online-Terminbuchungssystems", "Hosting der Website", "Bereitstellung eines Kassensystems mit Cloud-Speicherung", "Durchführung der Lohnabrechnung", "Wartung und Betreuung der IT"] },
        { id: "zweck", art: "mehrzeilig", label: "Zweck der Verarbeitung", pflicht: true },
        { id: "dauer", art: "text", label: "Dauer", pflicht: true, vorschlaege: DAUER },
        { id: "datenarten", art: "mehrzeilig", label: "Art der personenbezogenen Daten", pflicht: true, vorschlaege: ["Name", "Kontaktdaten (Telefon, E-Mail)", "Termine und gebuchte Leistungen", "Zahlungsdaten", "Beschäftigtendaten (Lohn, Steuer, Sozialversicherung)"] },
        { id: "betroffene", art: "mehrzeilig", label: "Kategorien betroffener Personen", pflicht: true, vorschlaege: ["Kundinnen und Kunden", "Interessenten", "Beschäftigte"] },
        { id: "unterauftrag", art: "mehrzeilig", label: "Genehmigte Unterauftragsverarbeiter", hilfe: "Name, Anschrift, Leistung – oder „keine“", pflicht: true, vorschlaege: ["keine"] },
        { id: "tom", art: "mehrzeilig", label: "Technische und organisatorische Maßnahmen des Auftragsverarbeiters", pflicht: true, vorschlaege: ["siehe Anlage (TOM-Beschreibung des Auftragsverarbeiters)"] },
        { id: "ort_datum", art: "text", label: "Ort", hilfe: "für die Unterschrift" },
      ],
    },
  ],
  html(d, b) {
    const ag = text(d, "rolle") !== "dienstleister";
    return dokument({
      titel: "Vertrag zur Auftragsverarbeitung",
      betrieb: b,
      unter: "gemäß Art. 28 Abs. 3 DSGVO",
      meta: `Auftraggeber: ${ag ? b.name : text(d, "partner")}\nAuftragnehmer: ${ag ? text(d, "partner") : b.name}`,
      inhalt:
        parteien(
          { rolle: "Verantwortlicher, Auftraggeber", name: ag ? b.name : text(d, "partner"), anschrift: ag ? anschrift(b) : text(d, "partner_anschrift") },
          { rolle: "Auftragsverarbeiter, Auftragnehmer", name: ag ? text(d, "partner") : b.name, anschrift: ag ? text(d, "partner_anschrift") : anschrift(b) },
        ) +
        (text(d, "hauptvertrag") ? `<p>Dieser Vertrag ergänzt den Vertrag „${esc(text(d, "hauptvertrag"))}“ (Hauptvertrag) und regelt die Verarbeitung personenbezogener Daten im Auftrag nach Art. 28 DSGVO.</p>` : "") +
        abschnitt(
          "Gegenstand, Dauer, Art und Zweck der Verarbeitung",
          angaben([
            ["Gegenstand und Art", text(d, "gegenstand")],
            ["Zweck", text(d, "zweck")],
            ["Dauer", text(d, "dauer")],
            ["Art der personenbezogenen Daten", text(d, "datenarten").split("\n").filter(Boolean).join(", ")],
            ["Kategorien betroffener Personen", text(d, "betroffene").split("\n").filter(Boolean).join(", ")],
          ]),
        ) +
        abschnitt("Pflichten des Auftragnehmers (Art. 28 Abs. 3 Satz 2 lit. a–h DSGVO)", AVV_KLAUSELN.map((k) => `<p><strong>(${esc(k.lit)})</strong> ${esc(k.text.replace(/in Anlage \{nr\} beschrieben/, "im Abschnitt „Technische und organisatorische Maßnahmen“ dieses Vertrags beschrieben"))}</p>`).join("")) +
        abschnitt("Unterauftragsverarbeiter", zeilen(text(d, "unterauftrag"))) +
        abschnitt("Technische und organisatorische Maßnahmen", zeilen(text(d, "tom"))) +
        abschnitt("Rechte und Pflichten des Auftraggebers", "<p>Der Auftraggeber ist für die Rechtmäßigkeit der Verarbeitung verantwortlich und erteilt Weisungen in dokumentierter Form. Er ist berechtigt, die Einhaltung dieses Vertrags zu überprüfen.</p>") +
        unterschriften(["Auftraggeber", "Auftragnehmer"], { ortDatum: true }),
    });
  },
};
