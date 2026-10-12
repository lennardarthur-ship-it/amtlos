#!/usr/bin/env node
/**
 * Bausteine aus der Recherche (E-123): liest docs/recherche/2026-10-12/*.json (Ergebnisse mit Quellen) und schreibt
 * src/dokumente/bausteine.ts – typisierte Auswahllisten und Vorschläge für die Vorlagen. Jeder Baustein trägt einen
 * Kurzbeleg („quelle“); „unsicher“ markiert, was nicht wörtlich an der Primärquelle geprüft wurde (PRUEFLISTE T-62).
 * Inhalte werden nicht umformuliert, nur zugeordnet.
 *
 *   node packages/fachlogik/werkzeuge/bausteine-erzeugen.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.resolve(hier, "../../..");
const R = (n) => JSON.parse(fs.readFileSync(path.join(wurzel, "docs/recherche/2026-10-12", `${n}.json`), "utf8"));
const as = R("arbeitsschutz");
const ds = R("datenschutz");
const st = R("steuern_personal");
const lb = R("lebensmittel_beauty");

/** Kurzbeleg aus Fundstelle, Paragraph oder Adresse der Quelle. */
function beleg(x) {
  if (!x) return undefined;
  if (x.fundstelle) return x.fundstelle;
  if (x.paragraph) return x.paragraph;
  const q = Array.isArray(x.quelle) ? x.quelle[0] : x.quelle;
  if (!q) return undefined;
  const regeln = [
    [/bgw-online/, "BGW"], [/trgs530/, "TRGS 530"], [/trgs401/, "TRGS 401"], [/trgs555/, "TRGS 555"], [/dguv\/3/, "DGUV Vorschrift 3"],
    [/bgn-branchenwissen/, "BGN"], [/vbg\.de/, "DGUV Vorschrift 1"], [/bghw/, "BGHW"], [/bgbau|bg-bau/, "BG BAU"], [/bgetem/, "BG ETEM"], [/dguv\.de/, "DGUV"],
    [/lda\.bayern/, "BayLDA"], [/datenschutzkonferenz/, "DSK"], [/edpb/, "EDSA"], [/eur-lex.*32016R0679/, "DSGVO"], [/eur-lex/, "EU-Recht"],
    [/mainz\.de/, "Lebensmittelüberwachung Mainz"], [/laves/, "LAVES Niedersachsen"], [/bfr\.bund/, "BfR"], [/gesunde\.sachsen/, "Rahmenhygieneplan"],
    [/lfst\.bayern/, "LfSt Bayern"], [/finanzamt\.nrw/, "Finanzverwaltung NRW"], [/elster/, "ELSTER"], [/bundesfinanzministerium/, "BMF"],
    [/minijob-zentrale/, "Minijob-Zentrale"], [/deutsche-rentenversicherung/, "DRV"], [/aok\.de/, "AOK"], [/zoll\.de/, "Zoll"], [/bmas/, "BMAS"],
  ];
  for (const [re, name] of regeln) if (re.test(q)) return name;
  const m = /gesetze-im-internet\.de\/([a-z_0-9]+)\/__(\w+)\.html/.exec(q);
  const GESETZ = { arbschg: "ArbSchG", ao: "AO", hgb: "HGB", gwg: "GwG", ifsg: "IfSG", ustg: "UStG", muschg: "MuSchG", gefstoffv: "GefStoffV", estg: "EStG", bgb: "BGB", ddg: "DDG", nachwg: "NachwG", milog: "MiLoG", lmhv: "LMHV" };
  if (m) { const g = m[1].replace(/_\d+$/, ""); return `§ ${m[2]} ${GESETZ[g] ?? g.toUpperCase()}`; }
  if (!/^https?:/.test(q)) return q.split(/ – | \(|;/)[0].slice(0, 70);
  return new URL(q).hostname.replace(/^www\./, "");
}
const unsicher = (x) => Boolean(x && (x.unsicher || x.verifiziert === false));
const slug = (s) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
const ohneNull = (o) => JSON.parse(JSON.stringify(o, (_, v) => (v === undefined || v === false ? undefined : v)));

// ---------------------------------------------------------------- Arbeitsschutz
const BRANCHE = { friseur: "Friseur", kosmetik: "Kosmetik", gastro_cafe: "Gastronomie / Café", handwerk_allgemein: "Handwerk", buero_laden: "Büro / Laden" };
const gefaehrdungen = Object.entries(as.gefaehrdungen).flatMap(([b, l]) =>
  l.map((g) => ({ gruppe: BRANCHE[b] ?? b, titel: g.gefaehrdung, werte: { faktor: g.faktor, beschreibung: g.gefaehrdung, massnahme: g.massnahmen.map((m) => m.text).join("\n") }, quelle: beleg(g) })),
);
const MUSCH_TEXT = {
  keine_massnahmen: "Für schwangere oder stillende Frauen werden voraussichtlich keine Schutzmaßnahmen erforderlich sein.",
  umgestaltung: "Für schwangere oder stillende Frauen wird voraussichtlich eine Umgestaltung der Arbeitsbedingungen nach § 13 Abs. 1 Nr. 1 MuSchG erforderlich sein.",
  fortfuehrung_nicht_moeglich: "Eine Fortführung der Tätigkeit einer schwangeren oder stillenden Frau an diesem Arbeitsplatz wird voraussichtlich nicht möglich sein.",
};
const mutterschutz = as.mutterschutz_ergebnisse.ergebnisse.map((e) => ({ wert: e.id, text: MUSCH_TEXT[e.id] ?? e.text, quelle: e.paragraph }));
const unterweisungsthemen = as.unterweisung.themen.map((t) => ({ wert: slug(t.thema), text: t.thema, quelle: beleg(t), branchen: t.branchen }));
const baGliederung = as.betriebsanweisung.gliederung.map((g) => ({ nr: g.nr, abschnitt: g.abschnitt, inhalt: g.inhalt }));
const baBausteine = {};
for (const b of as.betriebsanweisung.bausteine) (baBausteine[b.abschnitt] ??= []).push({ wert: slug(b.text), text: b.text, quelle: beleg(b) });
const hautFriseur = as.hautschutz.friseur_zeilen.map((z) => ({ gruppe: "Friseur", titel: z.taetigkeit, werte: { anlass: z.taetigkeit, schutz: z.vor_taetigkeit_hautschutz ?? "", handschuhe: z.handschuhe ?? "", reinigung: z.nach_taetigkeit_reinigung ?? "", pflege: z.vor_pausen_arbeitsschluss_pflege ?? "" }, quelle: "TRGS 530 / BGW" }));
const elektroFristen = as.pruefung_elektro.fristen.map((f) => ({ wert: slug(f.geltungsbereich), text: `${f.geltungsbereich}: Richtwert ${f.richtwert}${f.maximalwert ? `, höchstens ${f.maximalwert} bei Fehlerquote unter 2 %` : ""}`, quelle: f.fundstelle, unsicher: unsicher(f) }));
const gefahrstoffAngaben = as.gefahrstoffverzeichnis_pflichtangaben.angaben.map((a) => a.text);

// ---------------------------------------------------------------- Datenschutz
const liste = (x) => (Array.isArray(x) ? x.join(", ") : (x ?? ""));
/**
 * Korrekturen nach der unabhängigen Prüfung (E-123): § 26 BDSG trägt nach EuGH C-34/21 nicht mehr sicher – Hinweis
 * entfernt (Art. 6 Abs. 1 lit. b/c steht bereits da); Drittland aus dem Empfängertext übernommen.
 */
const ohne26 = (t) => t.replace(/[;,]\s*(ergänzend )?Art\. 88 DSGVO i\. V\. m\. § 26( Abs\. 1)? BDSG/g, "");
const drittland = (v) => (/USA/.test(liste(v.empfaenger)) ? "möglich: USA (Plattformbetreiber); Grundlage laut Datenschutzhinweisen des Anbieters" : "keine Übermittlung in Drittländer");
const vvt = ds.vvt_verarbeitungen.map((v) => ({ titel: v.bezeichnung, werte: { bezeichnung: v.bezeichnung, zweck: v.zweck, rechtsgrundlage: ohne26(v.rechtsgrundlage), betroffene: liste(v.betroffene), datenarten: liste(v.datenarten), empfaenger: liste(v.empfaenger), loeschfrist: v.loeschfrist, drittland: drittland(v) }, quelle: beleg({ quelle: v.quelle }) }));
const SCHUTZ = { pseudonymisierung_verschluesselung: "Verschlüsselung", vertraulichkeit: "Vertraulichkeit", integritaet: "Integrität", verfuegbarkeit_belastbarkeit: "Verfügbarkeit", wiederherstellung: "Wiederherstellung", ueberpruefung: "Überprüfung" };
const tom = Object.entries(SCHUTZ).flatMap(([k, g]) => (ds.tom[k] ?? []).map((m) => ({ gruppe: g, titel: m.massnahme, werte: { schutzziel: k, massnahme: m.massnahme }, quelle: beleg({ quelle: m.quelle }) })));
const dse = Object.fromEntries(Object.entries(ds.dse_bausteine).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [k, { titel: v.titel, text: v.text, quelle: beleg({ quelle: v.quelle }), unsicher: unsicher(v) }]));
const aufsicht = ds.aufsichtsbehoerden.liste.map((a) => ({ land: a.land, name: a.name, ort: a.ort, url: a.url }));
const avvKlauseln = ds.avv.klauseln.map((k) => ({ lit: k.lit, text: k.klausel }));
const pannenArten = ds.datenpanne.arten.map((a) => ({ wert: slug(a.art), text: a.art, quelle: a.quelle }));
const sofort = ds.datenpanne.sofortmassnahmen.map((a) => ({ wert: slug(a.massnahme), text: a.massnahme, quelle: a.quelle, unsicher: unsicher(a) }));

// ---------------------------------------------------------------- Steuern und Personal
const ku = st.rechnung.pflichthinweise.kleinunternehmer_19_ustg.wortlaut_optionen.find((o) => o.empfohlen)?.text;
const ph = st.rechnung.pflichthinweise;
const rechnungsHinweise = [
  { wert: "reverse_charge", text: ph.steuerschuldnerschaft_leistungsempfaenger_14a_abs5.wortlaut, quelle: "§ 14a Abs. 5 UStG", unsicher: unsicher(ph.steuerschuldnerschaft_leistungsempfaenger_14a_abs5) },
  ...(ph.innergemeinschaftliche_lieferung_14a_abs3.wortlaut_ueblich ? [{ wert: "igl", text: ph.innergemeinschaftliche_lieferung_14a_abs3.wortlaut_ueblich, quelle: "§ 14a Abs. 3 UStG", unsicher: unsicher(ph.innergemeinschaftliche_lieferung_14a_abs3) }] : []),
  ...(ph.steuerfreie_leistungen.wortlaut_vorlage ? [{ wert: "steuerfrei", text: ph.steuerfreie_leistungen.wortlaut_vorlage, quelle: "§ 14 Abs. 4 Nr. 8 UStG", unsicher: true }] : []),
  { wert: "gutschrift", text: ph.gutschrift.wortlaut, quelle: "§ 14 Abs. 4 Nr. 10 UStG", unsicher: unsicher(ph.gutschrift) },
];
const einheiten = st.rechnung.mengeneinheiten.liste.map((e) => e.bezeichnung);
const euerAusgaben = [...new Set(st.euer.betriebsausgaben.filter((x) => !/Abschnitt/.test(x.bezeichnung)).map((x) => x.bezeichnung.replace(/ \(Absetzung für Abnutzung\)/, "")))];
const euerEinnahmen = st.euer.betriebseinnahmen.map((x) => x.bezeichnung);
const g = st.gobd.auswahloptionen;
const gobd = { belegeingang: g.belegeingang, belegart: g.belegart_nach_muster, ablage: g.ablage, papier: g.papiervernichtung_nach_scan, sicherungIntervall: g.datensicherung_intervall, sicherungOrt: g.datensicherung_ort, eRechnung: g.e_rechnung_hinweis.text };
const kassenArten = st.kassen.arten_elektronischer_aufzeichnungssysteme.liste;
const tseArten = st.kassen.arten_elektronischer_aufzeichnungssysteme.art_tse_optionen_unsicher ?? [];
const nw = st.nachweisgesetz;
const nachwg = { angaben: nw.angaben.map((a) => ({ nr: a.nr, text: a.text })), einleitung: nw.satz1_einleitung, kuendigungGrund: nw.kuendigungsfristen_622_bgb.grundkuendigungsfrist, klagefrist: nw.klagefrist_4_kschg.text, urlaub: nw.mindesturlaub_3_burlg.text };
const mindestlohn = st.mindestlohn_minijob.mindestlohn.map((m) => ({ ab: m.ab, cent: Math.round(m.betrag_brutto_je_stunde * 100) }));
const minijob = st.mindestlohn_minijob.minijob_verdienstgrenze.map((m) => ({ ab: m.ab, cent: m.betrag_monatlich * 100 }));
const pgs = st.sv_meldung.personengruppenschluessel.gaengig.map((p) => ({ wert: p.schluessel, text: `${p.schluessel} – ${p.bezeichnung}` }));
const tk = st.sv_meldung.taetigkeitsschluessel.aufbau;
const werteZu = (stelle) => Object.entries(tk.find((a) => a.stellen === stelle)?.werte ?? {}).map(([wert, text]) => ({ wert, text }));
const sv = { personengruppen: pgs, schulabschluss: werteZu("6"), ausbildung: werteZu("7"), vertragsform: werteZu("9") };
const interesse = st.transparenzregister.art_und_umfang_19_abs3_gwg.optionen;
const rechtsformen = st.rechtsformen.app_empfehlung_auswahl;
// Lohnabrechnungen haben Belegfunktion (8 Jahre) – aus der 6-Jahres-Zeile entfernt (Prüfbericht U9)
const aufbewahrung = st.aufbewahrung.fristen.map((f) => ({ jahre: String(f.jahre), art: f.unterlagen.replace(/, Lohnberechnungsunterlagen/, "") }));

// ---------------------------------------------------------------- Lebensmittel und Beauty
const haccp = lb.haccp.kontrollpunkte.map((k) => ({ titel: k.punkt, werte: { punkt: k.punkt, grenzwert: `${k.grenzwert}${k.einheit && !String(k.grenzwert).includes(k.einheit) && k.einheit !== "%" ? ` ${k.einheit}` : ""}`, haeufigkeit: k.haeufigkeit ?? "", korrektur: k.korrektur ?? "" }, quelle: beleg({ quelle: String(k.quelle).split(";")[0] }) }));
const allergeneUmfang = lb.allergene.liste.map((a) => ({ bezeichnung: a.bezeichnung, umfasst: a.umfasst }));
const loseWare = { formen: lb.allergene.lose_ware.schriftlich_formen, anforderung: lb.allergene.lose_ware.schriftlich_anforderung, rechtsgrundlage: lb.allergene.lose_ware.rechtsgrundlage };
const ifsg = { inhalte: lb.ifsg.inhalte.punkte.map((p) => p.replace(/\s*–\s*siehe \w+\)/, ")")), personen: lb.ifsg.taetigkeitsverbote.personen.map((p) => p.text), lebensmittel: lb.ifsg.taetigkeitsverbote.lebensmittel_abs2, symptome: lb.ifsg.taetigkeitsverbote.symptome_merkblatt ?? [] };
const BR = { friseur: "Friseur", kosmetik: "Kosmetik", nagelstudio: "Nagelstudio", fusspflege: "Fußpflege" };
const hygiene = lb.hygieneplan.zeilen.map((z) => ({ gruppe: (z.branchen ?? []).length >= 3 ? "Alle Beauty-Betriebe" : (z.branchen ?? []).map((b) => BR[b] ?? b).join(", "), titel: z.was, werte: { was: z.was, wann: z.wann, womit: z.womit, wie: z.wie, wer: z.wer }, quelle: beleg({ quelle: String(z.quelle).split(";")[0] }) }));

const daten = ohneNull({
  GEFAEHRDUNGEN: gefaehrdungen, MUTTERSCHUTZ: mutterschutz, UNTERWEISUNGSTHEMEN: unterweisungsthemen, BA_GLIEDERUNG: baGliederung, BA_BAUSTEINE: baBausteine,
  HAUTSCHUTZ_FRISEUR: hautFriseur, ELEKTRO_FRISTEN: elektroFristen, GEFAHRSTOFF_ANGABEN: gefahrstoffAngaben,
  VVT: vvt, TOM: tom, DSE: dse, AUFSICHT: aufsicht, AVV_KLAUSELN: avvKlauseln, PANNEN_ARTEN: pannenArten, PANNEN_SOFORT: sofort,
  KU_HINWEIS_NEU: ku, RECHNUNGS_HINWEISE: rechnungsHinweise, EINHEITEN: einheiten, EUER_AUSGABEN: euerAusgaben, EUER_EINNAHMEN: euerEinnahmen, GOBD: gobd,
  KASSEN_ARTEN: kassenArten, TSE_ARTEN: tseArten, NACHWG: nachwg, MINDESTLOHN: mindestlohn, MINIJOB: minijob, SV: sv, INTERESSE: interesse, RECHTSFORMEN: rechtsformen, AUFBEWAHRUNG: aufbewahrung,
  HACCP: haccp, ALLERGENE_UMFANG: allergeneUmfang, LOSE_WARE: loseWare, IFSG: ifsg, HYGIENE: hygiene,
});
const typen = {
  GEFAEHRDUNGEN: "Vorschlag[]", MUTTERSCHUTZ: "Option[]", UNTERWEISUNGSTHEMEN: "(Option & { branchen: string[] })[]", BA_GLIEDERUNG: "{ nr: string; abschnitt: string; inhalt: string }[]", BA_BAUSTEINE: "Record<string, Option[]>",
  HAUTSCHUTZ_FRISEUR: "Vorschlag[]", ELEKTRO_FRISTEN: "(Option & { unsicher?: boolean })[]", GEFAHRSTOFF_ANGABEN: "string[]",
  VVT: "Vorschlag[]", TOM: "Vorschlag[]", DSE: "Record<string, { titel: string; text: string; quelle?: string; unsicher?: boolean }>", AUFSICHT: "{ land: string; name: string; ort: string; url: string }[]", AVV_KLAUSELN: "{ lit: string; text: string }[]", PANNEN_ARTEN: "Option[]", PANNEN_SOFORT: "(Option & { unsicher?: boolean })[]",
  KU_HINWEIS_NEU: "string", RECHNUNGS_HINWEISE: "(Option & { unsicher?: boolean })[]", EINHEITEN: "string[]", EUER_AUSGABEN: "string[]", EUER_EINNAHMEN: "string[]", GOBD: "{ belegeingang: string[]; belegart: string[]; ablage: string[]; papier: string[]; sicherungIntervall: string[]; sicherungOrt: string[]; eRechnung: string }",
  KASSEN_ARTEN: "string[]", TSE_ARTEN: "string[]", NACHWG: "{ angaben: { nr: number; text: string }[]; einleitung: string; kuendigungGrund: string; klagefrist: string; urlaub: string }", MINDESTLOHN: "{ ab: string; cent: number }[]", MINIJOB: "{ ab: string; cent: number }[]",
  SV: "{ personengruppen: Option[]; schulabschluss: Option[]; ausbildung: Option[]; vertragsform: Option[] }", INTERESSE: "Option[]", RECHTSFORMEN: "string[]", AUFBEWAHRUNG: "{ jahre: string; art: string }[]",
  HACCP: "Vorschlag[]", ALLERGENE_UMFANG: "{ bezeichnung: string; umfasst: string }[]", LOSE_WARE: "{ formen: string[]; anforderung: string; rechtsgrundlage: string }", IFSG: "{ inhalte: string[]; personen: string[]; lebensmittel: string[]; symptome: string[] }", HYGIENE: "Vorschlag[]",
};
const kopf = `/**
 * Bausteine aus der Recherche vom 12.10.2026 (docs/recherche/2026-10-12) – ERZEUGT von werkzeuge/bausteine-erzeugen.mjs,
 * nicht von Hand ändern. Jeder Baustein trägt einen Kurzbeleg; „unsicher“ = nicht wörtlich an der Primärquelle geprüft.
 * Fachliche Abnahme: PRUEFLISTE T-62.
 */
import type { Option, Vorschlag } from "./typen.js";
`;
const rumpf = Object.entries(daten).map(([k, v]) => `export const ${k}: ${typen[k]} = ${JSON.stringify(v, null, 1)};`).join("\n\n");
fs.writeFileSync(path.join(hier, "../src/dokumente/bausteine.ts"), `${kopf}\n${rumpf}\n`);
console.log(`✓ bausteine.ts: ${gefaehrdungen.length} Gefährdungen, ${vvt.length} Verarbeitungen, ${tom.length} TOM, ${Object.keys(dse).length} DSE-Bausteine, ${haccp.length} HACCP-Punkte, ${hygiene.length} Hygiene-Zeilen`);
