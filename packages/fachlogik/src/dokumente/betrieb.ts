/**
 * Betrieb und Register (E-121): Gewerbeanmeldung, Handelsregister, Transparenzregister – als ausgefüllte Datenblätter.
 * Angemeldet wird beim Gewerbeamt, über den Notar bzw. im Transparenzregister; die App übermittelt nichts.
 * Gliederungen fachlich zu prüfen (T-60).
 */
import { abschnitt, absatz, angaben, anschrift, cent, datumDe, dokument, euro, liste, tabelle, text, unterschriften, zelle } from "./html.js";
import type { Vorlage } from "./typen.js";

const PERSON = [
  { id: "name", art: "text" as const, label: "Vor- und Nachname", pflicht: true },
  { id: "geburtsdatum", art: "datum" as const, label: "Geburtsdatum", pflicht: true },
  { id: "wohnort", art: "text" as const, label: "Wohnort", pflicht: true },
];

export const gewerbeanmeldung: Vorlage = {
  id: "gewerbeanmeldung",
  titel: "Gewerbeanmeldung (Datenblatt)",
  beschreibung: "Alle Angaben für die Gewerbeanmeldung an einem Ort – zum Übertragen in das Online-Formular deiner Stadt oder zum Mitnehmen aufs Amt.",
  bereich: "betrieb",
  pflichten: ["gruendung.gewerbeanzeige"],
  abschnitte: [
    {
      titel: "Angaben zur Person",
      hilfe: "Angemeldet wird beim Gewerbeamt deiner Stadt oder Gemeinde, oft auch online.",
      felder: [
        { id: "name", art: "text", label: "Vor- und Nachname", vorbelegung: "verantwortlich", pflicht: true },
        { id: "geburtsname", art: "text", label: "Geburtsname", hilfe: "falls abweichend" },
        { id: "geburtsdatum", art: "datum", label: "Geburtsdatum", pflicht: true },
        { id: "geburtsort", art: "text", label: "Geburtsort", pflicht: true },
        { id: "staatsangehoerigkeit", art: "text", label: "Staatsangehörigkeit", pflicht: true },
        { id: "wohnanschrift", art: "mehrzeilig", label: "Wohnanschrift", pflicht: true },
      ],
    },
    {
      titel: "Angaben zum Betrieb",
      hilfe: "Name, Anschrift und Kontakt übernimmt Amtlos aus „Mein Betrieb“.",
      felder: [
        { id: "rechtsform", art: "text", label: "Rechtsform", hilfe: "z. B. Einzelunternehmen", pflicht: true },
        { id: "taetigkeit", art: "mehrzeilig", label: "Angemeldete Tätigkeit", hilfe: "so genau wie möglich, z. B. „Friseurhandwerk und Verkauf von Haarpflegeprodukten“", pflicht: true },
        { id: "beginn", art: "datum", label: "Beginn der Tätigkeit", pflicht: true },
        { id: "erwerb", art: "wahl", label: "Haupt- oder Nebenerwerb", optionen: [{ wert: "haupt", text: "Haupterwerb" }, { wert: "neben", text: "Nebenerwerb" }], vorbelegung: "haupt" },
        { id: "beschaeftigte", art: "text", label: "Zahl der Beschäftigten", hilfe: "z. B. 1 Vollzeit, 2 Teilzeit – oder keine" },
        { id: "erlaubnis", art: "text", label: "Erlaubnis oder Handwerkskarte", hilfe: "nur falls nötig: welche, von wem, vom" },
      ],
    },
  ],
  html(d, b) {
    return dokument({
      titel: "Gewerbeanmeldung – Datenblatt",
      betrieb: b,
      inhalt:
        abschnitt(
          "Angaben zur Person",
          angaben([
            ["Name", text(d, "name")],
            ["Geburtsname", text(d, "geburtsname") || null],
            ["Geburtsdatum", datumDe(text(d, "geburtsdatum"))],
            ["Geburtsort", text(d, "geburtsort")],
            ["Staatsangehörigkeit", text(d, "staatsangehoerigkeit")],
            ["Wohnanschrift", text(d, "wohnanschrift")],
          ]),
        ) +
        abschnitt(
          "Angaben zum Betrieb",
          angaben([
            ["Name des Betriebs", b.name],
            ["Rechtsform", text(d, "rechtsform")],
            ["Betriebsstätte", anschrift(b)],
            ["Telefon / E-Mail", [b.telefon, b.email].filter((x) => x.trim()).join(" · ")],
            ["Angemeldete Tätigkeit", text(d, "taetigkeit")],
            ["Beginn", datumDe(text(d, "beginn"))],
            ["Haupt- oder Nebenerwerb", text(d, "erwerb") === "neben" ? "Nebenerwerb" : "Haupterwerb"],
            ["Beschäftigte", text(d, "beschaeftigte") || null],
            ["Erlaubnis / Handwerkskarte", text(d, "erlaubnis") || null],
          ]),
        ) +
        `<p style="margin-top:6mm;font-size:8.5pt;color:#4a5868">Angemeldet am: ________________ · Gewerbeamt: ______________________</p>`,
    });
  },
};

const RECHTSFORMEN = [
  { wert: "GmbH", text: "GmbH" },
  { wert: "UG (haftungsbeschränkt)", text: "UG (haftungsbeschränkt)" },
  { wert: "e. K.", text: "e. K." },
  { wert: "OHG", text: "OHG" },
  { wert: "KG", text: "KG" },
];

export const handelsregister: Vorlage = {
  id: "handelsregister",
  titel: "Handelsregister (Vorbereitung)",
  beschreibung: "Die Angaben für die Anmeldung zum Handelsregister – Firma, Sitz, Gegenstand, Kapital, Gesellschafter, Geschäftsführung – zum Termin beim Notar.",
  bereich: "betrieb",
  pflichten: ["gesellschaft.handelsregister_anmeldung"],
  namensFeld: "firma",
  abschnitte: [
    {
      hilfe: "Die Anmeldung zum Handelsregister macht der Notar. Mit diesem Blatt hast du alle Angaben beisammen.",
      felder: [
        { id: "firma", art: "text", label: "Firma (Name im Register)", pflicht: true },
        { id: "rechtsform", art: "wahl", label: "Rechtsform", optionen: RECHTSFORMEN },
        { id: "sitz", art: "text", label: "Sitz (Ort)", pflicht: true },
        { id: "anschrift", art: "mehrzeilig", label: "Inländische Geschäftsanschrift", pflicht: true },
        { id: "gegenstand", art: "mehrzeilig", label: "Gegenstand des Unternehmens", pflicht: true },
        { id: "kapital", art: "betrag", label: "Stamm- bzw. Grundkapital (€)", hilfe: "nur bei Kapitalgesellschaften" },
      ],
    },
    { titel: "Gesellschafter", felder: [{ id: "gesellschafter", art: "liste", label: "Gesellschafter", eintrag: "Gesellschafter/in", titelFeld: "name", felder: [...PERSON, { id: "anteil", art: "text", label: "Anteil", hilfe: "z. B. 12.500 € bzw. 50 %" }] }] },
    { titel: "Geschäftsführung bzw. Inhaber/in", felder: [{ id: "fuehrung", art: "liste", label: "Geschäftsführung", eintrag: "Person", titelFeld: "name", pflicht: true, felder: PERSON }, { id: "vertretung", art: "mehrzeilig", label: "Vertretungsregelung", hilfe: "z. B. vertritt allein; bei mehreren: gemeinsam oder einzeln" }] },
  ],
  html(d, b) {
    const ges = liste(d, "gesellschafter").filter((x) => text(x, "name"));
    const gf = liste(d, "fuehrung").filter((x) => text(x, "name"));
    const person = (l: typeof ges, extra = false) => tabelle(["Name", "Geburtsdatum", "Wohnort", ...(extra ? ["Anteil"] : [])], l.map((x) => [zelle(text(x, "name")), datumDe(text(x, "geburtsdatum")), zelle(text(x, "wohnort")), ...(extra ? [zelle(text(x, "anteil"))] : [])]), { breiten: extra ? ["32%", "18%", "28%", "22%"] : ["40%", "20%", "40%"] });
    return dokument({
      titel: "Anmeldung zum Handelsregister – Vorbereitung",
      betrieb: b,
      unter: text(d, "firma") || undefined,
      inhalt:
        angaben([
          ["Firma", text(d, "firma")],
          ["Rechtsform", text(d, "rechtsform")],
          ["Sitz", text(d, "sitz")],
          ["Geschäftsanschrift", text(d, "anschrift")],
          ["Gegenstand", text(d, "gegenstand")],
          ["Kapital", text(d, "kapital") ? euro(cent(text(d, "kapital")) ?? 0) : null],
        ]) +
        (ges.length ? abschnitt("Gesellschafter", person(ges, true)) : "") +
        abschnitt("Geschäftsführung bzw. Inhaber/in", gf.length ? person(gf) : absatz("")) +
        (text(d, "vertretung") ? abschnitt("Vertretungsregelung", absatz(text(d, "vertretung"))) : ""),
    });
  },
};

export const transparenzregister: Vorlage = {
  id: "transparenzregister",
  titel: "Transparenzregister: wirtschaftlich Berechtigte",
  beschreibung: "Wer hinter der Gesellschaft steht – Name, Geburtsdatum, Wohnort, Staatsangehörigkeit, Art und Umfang des Interesses. Für die Meldung und deine Unterlagen.",
  bereich: "betrieb",
  pflichten: ["gesellschaft.transparenzregister"],
  abschnitte: [
    {
      hilfe: "Gemeldet wird online beim Transparenzregister. Dieses Blatt hält fest, was du gemeldet hast.",
      felder: [
        { id: "rechtsform", art: "text", label: "Rechtsform", hilfe: "z. B. GmbH" },
        { id: "register", art: "text", label: "Registergericht und Nummer" },
        { id: "stand", art: "datum", label: "Stand", vorbelegung: "heute" },
      ],
    },
    {
      titel: "Wirtschaftlich Berechtigte",
      felder: [
        {
          id: "berechtigte",
          art: "liste",
          label: "Wirtschaftlich Berechtigte",
          eintrag: "Person",
          titelFeld: "name",
          pflicht: true,
          felder: [...PERSON, { id: "staatsangehoerigkeit", art: "text", label: "Staatsangehörigkeit", pflicht: true }, { id: "interesse", art: "text", label: "Art und Umfang des wirtschaftlichen Interesses", hilfe: "z. B. 60 % der Anteile und Stimmrechte", pflicht: true }],
        },
      ],
    },
    { felder: [{ id: "gemeldet", art: "datum", label: "Gemeldet am" }] },
  ],
  html(d, b) {
    const l = liste(d, "berechtigte").filter((x) => text(x, "name"));
    return dokument({
      titel: "Wirtschaftlich Berechtigte",
      betrieb: b,
      unter: "Angaben zum Transparenzregister",
      meta: `Stand: ${datumDe(text(d, "stand")) || "–"}`,
      inhalt:
        angaben([["Gesellschaft", b.name], ["Rechtsform", text(d, "rechtsform")], ["Register", text(d, "register") || null], ["Gemeldet am", datumDe(text(d, "gemeldet")) || "noch nicht gemeldet"]]) +
        abschnitt("Wirtschaftlich Berechtigte", l.length ? tabelle(["Name", "Geburtsdatum", "Wohnort", "Staatsangeh.", "Interesse"], l.map((x) => [zelle(text(x, "name")), datumDe(text(x, "geburtsdatum")), zelle(text(x, "wohnort")), zelle(text(x, "staatsangehoerigkeit")), zelle(text(x, "interesse"))]), { breiten: ["24%", "14%", "20%", "14%", "28%"] }) : absatz("")) +
        unterschriften(["Ort, Datum", "Unterschrift Geschäftsführung"]),
    });
  },
};
