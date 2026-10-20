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
const drittland = (v) => (/USA/.test(liste(v.empfaenger)) ? "möglich: USA (Plattformbetreiber); Grundlage der Übermittlung: siehe Datenschutzhinweise des Anbieters" : "keine Übermittlung in Drittländer");
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
/** Alle Belege einer „;“-getrennten Quellenangabe, ohne Doppelte. */
const alleBelege = (q) => [...new Set(String(q).split(";").map((x) => beleg({ quelle: x.trim() })).filter(Boolean))].join("; ");
const haccp = lb.haccp.kontrollpunkte.map((k) => ({ titel: k.punkt, werte: { punkt: k.punkt, grenzwert: `${k.grenzwert}${k.einheit && !String(k.grenzwert).includes(k.einheit) && k.einheit !== "%" ? ` ${k.einheit}` : ""}`, haeufigkeit: k.haeufigkeit ?? "", korrektur: k.korrektur ?? "" }, quelle: alleBelege(k.quelle) }));
const allergeneUmfang = lb.allergene.liste.map((a) => ({ bezeichnung: a.bezeichnung, umfasst: a.umfasst }));
const loseWare = { formen: lb.allergene.lose_ware.schriftlich_formen, anforderung: lb.allergene.lose_ware.schriftlich_anforderung, rechtsgrundlage: lb.allergene.lose_ware.rechtsgrundlage };
const ifsg = { inhalte: lb.ifsg.inhalte.punkte.map((p) => p.replace(/\s*–\s*siehe \w+\)/, ")")), personen: lb.ifsg.taetigkeitsverbote.personen.map((p) => p.text), lebensmittel: lb.ifsg.taetigkeitsverbote.lebensmittel_abs2, symptome: lb.ifsg.taetigkeitsverbote.symptome_merkblatt ?? [] };
const BR = { friseur: "Friseur", kosmetik: "Kosmetik", nagelstudio: "Nagelstudio", fusspflege: "Fußpflege" };
const hygiene = lb.hygieneplan.zeilen.map((z) => ({ gruppe: (z.branchen ?? []).length >= 3 ? "Alle Beauty-Betriebe" : (z.branchen ?? []).map((b) => BR[b] ?? b).join(", "), titel: z.was, werte: { was: z.was, wann: z.wann, womit: z.womit, wie: z.wie, wer: z.wer }, quelle: beleg({ quelle: String(z.quelle).split(";")[0] }) }));

const daten0 = ohneNull({
  GEFAEHRDUNGEN: gefaehrdungen, MUTTERSCHUTZ: mutterschutz, UNTERWEISUNGSTHEMEN: unterweisungsthemen, BA_GLIEDERUNG: baGliederung, BA_BAUSTEINE: baBausteine,
  HAUTSCHUTZ_FRISEUR: hautFriseur, ELEKTRO_FRISTEN: elektroFristen, GEFAHRSTOFF_ANGABEN: gefahrstoffAngaben,
  VVT: vvt, TOM: tom, DSE: dse, AUFSICHT: aufsicht, AVV_KLAUSELN: avvKlauseln, PANNEN_ARTEN: pannenArten, PANNEN_SOFORT: sofort,
  KU_HINWEIS_NEU: ku, RECHNUNGS_HINWEISE: rechnungsHinweise, EINHEITEN: einheiten, EUER_AUSGABEN: euerAusgaben, EUER_EINNAHMEN: euerEinnahmen, GOBD: gobd,
  KASSEN_ARTEN: kassenArten, TSE_ARTEN: tseArten, NACHWG: nachwg, MINDESTLOHN: mindestlohn, MINIJOB: minijob, SV: sv, INTERESSE: interesse, RECHTSFORMEN: rechtsformen, AUFBEWAHRUNG: aufbewahrung,
  HACCP: haccp, ALLERGENE_UMFANG: allergeneUmfang, LOSE_WARE: loseWare, IFSG: ifsg, HYGIENE: hygiene,
});

// ---------------------------------------------------------------- Nachträgliche Korrekturen der Druckfassung
/**
 * Korrekturen aus den Vorlagen-Durchsichten (E-146 und dritte Durchsicht): Die Recherche in docs/recherche bleibt
 * unverändert; hier wird nur die Fassung angepasst, die in Vorlagen und PDFs steht. Quellennamen, Formularhinweise und
 * ältere Werte gehören ins Feld „quelle“, nicht in den Drucktext. Hinweise für Betriebe sind als neutrale Aussage
 * formuliert, ohne den Inhalt zu ändern. Jede Korrektur muss greifen, sonst bricht das Skript ab (veraltete Korrektur).
 * Wo zwei Behörden verschiedene Grenzwerte nennen, bleiben beide stehen (Fachprüfung PRUEFLISTE T-62).
 */
const SETZE = [
  // HACCP – Einheit an jedem Wert, Quellenangaben aus dem Drucktext ins Feld „quelle“
  ["HACCP", "Kühlung Hackfleisch", "werte.grenzwert", "vorverpackt (SB) bzw. nicht am Ort der Abgabe hergestellt: max. +2 °C; am Ort der Abgabe hergestellt / lose: max. +7 °C (abweichende Behördenangabe: +7 bzw. +4 °C je nach Abgabezeitpunkt)"],
  ["HACCP", "Kühlung Hackfleisch", "quelle", "Lebensmittelüberwachung Mainz; LAVES Niedersachsen (lose: +7 bzw. +4 °C je nach Abgabezeitpunkt)"],
  ["HACCP", "Kühlung Fleischzubereitungen", "werte.grenzwert", "SB-verpackt max. +4 °C; lose oder selbst verpackt (Einzelhandel) max. +7 °C"],
  ["HACCP", "Kühlung Geflügelfleisch (auch Federwild, Kleinwild/Hasen)", "werte.grenzwert", "max. +4 °C (abweichende Behördenangabe: −2 bis max. +4 °C)"],
  ["HACCP", "Kühlung Geflügelfleisch (auch Federwild, Kleinwild/Hasen)", "quelle", "Lebensmittelüberwachung Mainz (max. +4 °C); LAVES Niedersachsen (−2 bis max. +4 °C)"],
  ["HACCP", "Kühlung Fisch frisch, gekochte Krebs- und Weichtiere", "werte.grenzwert", "max. +2 °C bzw. in schmelzendem Eis (annähernd Schmelzeistemperatur)"],
  ["HACCP", "Kühlung Milcherzeugnisse, Käse (außer Hartkäse), Butter, Frischkäse", "werte.grenzwert", "max. +10 °C (sofern Hersteller nichts anderes angibt)"],
  ["HACCP", "Kühlung Eiprodukte / roheihaltige Lebensmittel", "werte.grenzwert", "Eiprodukte max. +4 °C; roheihaltige Lebensmittel: max. +7 °C bzw. max. +4 °C (Behördenangaben unterschiedlich)"],
  ["HACCP", "Kühlung Eiprodukte / roheihaltige Lebensmittel", "quelle", "Lebensmittelüberwachung Mainz (roheihaltig +7 °C); LAVES Niedersachsen (roheihaltig +4 °C)"],
  ["HACCP", "Tiefkühlung (Tiefkühltruhe/-raum, tiefgefrorene Lebensmittel)", "werte.grenzwert", "−18 °C oder kälter; kurzfristig bis −15 °C zulässig"],
  ["HACCP", "Speiseeis", "werte.grenzwert", "Lagerung als Tiefkühlware −18 °C; Speiseeis zum Ausportionieren / Eistresen zur Ausgabe max. −10 °C"],
  ["HACCP", "Heißhalten / Ausgabetemperatur warmer Speisen", "werte.grenzwert", "mindestens +60 °C an allen Stellen bzw. im Kern; teils werden mind. +65 °C für max. 3 Stunden angegeben"],
  ["HACCP", "Heißhalten / Ausgabetemperatur warmer Speisen", "werte.haeufigkeit", "stichprobenartig bei Ausgabe"],
  ["HACCP", "Heißhalten / Ausgabetemperatur warmer Speisen", "quelle", "+60 °C: BfR 2020, LAVES Niedersachsen, Lebensmittelüberwachung Mainz; +65 °C (älterer Wert): BfR 2008, BgVV, DIN-Normen, LAVES-Merkblatt B. cereus"],
  ["HACCP", "Ausgabetemperatur Kaltspeisen und Salate", "werte.korrektur", "Bei Unterbrechung der Kühlkette von mehr als 30 Minuten Lebensmittel entsorgen; dokumentieren."],
  ["HACCP", "Abkühlen heißer Speisen", "werte.grenzwert", "Bereich von +65 °C auf +10 °C innerhalb von 3 Stunden durchschreiten"],
  ["HACCP", "Abkühlen heißer Speisen", "werte.haeufigkeit", "bei jedem Abkühlvorgang"],
  ["HACCP", "Abkühlen heißer Speisen", "quelle", "oberallgaeu.org (BgVV-Temperaturempfehlungen)"],
  ["HACCP", "Wareneingangskontrolle", "werte.grenzwert", "Temperatur bei Anlieferung (Messung): Tiefkühlware −18 °C (kurzfristig −15 °C); Fleisch/Fleischerzeugnisse +4 °C; Fisch +2 °C; Hackfleisch +2 °C; Geflügel/Wild +4 °C. Sichtkontrolle: keine Verunreinigungen, einwandfreie Verpackung, einwandfreier Geruch, gültiges MHD, Beschaffenheit des Lieferfahrzeugs, Kennzeichnung"],
  ["HACCP", "Wareneingangskontrolle", "quelle", "Lebensmittelüberwachung Mainz (Formular Wareneingangskontrolle, Merkblatt)"],
  ["HACCP", "Frittierfett – polare Anteile", "werte.grenzwert", "24 % polare Anteile (Grenze der Genusstauglichkeit): Fett wechseln; Frittiertemperatur mind. +160 °C, max. +175 °C"],
  ["HACCP", "Frittierfett – polare Anteile", "werte.haeufigkeit", "nach Durchsatz; Wechselzeitpunkt über Eigenkontrollen ermitteln; Temperaturkontrollen und Fettwechsel dokumentieren"],
  ["HACCP", "Frittierfett – polare Anteile", "quelle", "zvl.jena.de; 24 % polare Anteile: DGF-Empfehlung"],
  ["HACCP", "Reinigung und Desinfektion (Reinigungsplan Küche)", "werte.grenzwert", "Reinigungsplan vorhanden und ausgehängt; Intervalle eingehalten (Sichtkontrolle)"],
  ["HACCP", "Schädlingsmonitoring", "werte.grenzwert", "kein Befall (Sichtkontrolle)"],
  ["HACCP", "Schädlingsmonitoring", "werte.haeufigkeit", (t) => t.replace("vorbeugende optische Kontrollen", "vorbeugende Sichtkontrollen")],
  // Verzeichnis der Verarbeitungstätigkeiten – Quellenvermerke ins Feld „quelle“, Anweisungen als Aussage
  ["VVT", "Kundenverwaltung / Kundenkartei", "werte.loeschfrist", (t) => t.replace("Kundenstammdaten löschen, sobald kein Zweck und keine Aufbewahrungspflicht mehr besteht (z. B. Kunde erteilt über mehrere Jahre keine Aufträge mehr).", "Kundenstammdaten werden gelöscht, sobald sie für den Zweck nicht mehr erforderlich sind und keine Aufbewahrungspflicht mehr besteht (z. B. wenn über mehrere Jahre keine Aufträge mehr erteilt werden).")],
  // der Baustein gilt für alle Branchen (Datenschutzinformation, Verzeichnis): Beispiel ohne Friseur-Bezug
  ["VVT", "Kundenverwaltung / Kundenkartei", "werte.rechtsgrundlage", (t) => t.replace("(z. B. Allergien/Unverträglichkeiten in der Friseur-Kundenkartei)", "(z. B. Allergien/Unverträglichkeiten)")],
  ["VVT", "Personalverwaltung (Personalakte, Arbeitszeit)", "werte.loeschfrist", "Personalakte in der Regel 3 Jahre nach dem Ausscheiden (Orientierung an der regelmäßigen Verjährung, § 195 BGB); steuer- und sozialversicherungsrelevante Unterlagen nach den gesetzlichen Fristen."],
  ["VVT", "Personalverwaltung (Personalakte, Arbeitszeit)", "quelle", "BayLDA-Muster"],
  ["VVT", "Bewerbungsverfahren", "werte.loeschfrist", "Unterlagen abgelehnter Bewerberinnen und Bewerber werden 6 Monate nach Abschluss des Bewerbungsverfahrens gelöscht. Grund: Ansprüche nach § 15 Abs. 4 AGG können binnen 2 Monaten ab Zugang der Ablehnung geltend gemacht werden; die Klagefrist beträgt 3 Monate nach schriftlicher Geltendmachung (§ 61b Abs. 1 ArbGG)."],
  ["VVT", "Bewerbungsverfahren", "quelle", "BayLDA-Muster; § 15 AGG; § 61b ArbGG"],
  // keine feste Zahl: die Frist steht in der Datenschutzerklärung (Feld „Server-Logfiles werden gelöscht nach“) und hängt vom Hoster ab
  ["VVT", "Betrieb der Website (Hosting, Server-Logfiles)", "werte.loeschfrist", "IP-Adressen in den Logfiles werden nach der Frist des Hosting-Anbieters gelöscht, die in der Datenschutzerklärung genannt ist (z. B. 7, 14 oder 30 Tage)."],
  ["VVT", "Betrieb der Website (Hosting, Server-Logfiles)", "werte.empfaenger", "Hosting-Dienstleister (Auftragsverarbeiter)"],
  ["VVT", "Betrieb der Website (Hosting, Server-Logfiles)", "quelle", "BayLDA-Muster"],
  ["VVT", "E-Mail-Newsletter / E-Mail-Werbung", "werte.loeschfrist", "Die Adresse wird nach Abmeldung oder Widerspruch unverzüglich aus dem Verteiler gelöscht; der Nachweis der Einwilligung wird zur Rechtsverteidigung aufbewahrt (Richtwert: 3 Jahre; Verjährung § 31 OWiG, § 195 BGB)."],
  ["VVT", "E-Mail-Newsletter / E-Mail-Werbung", "quelle", "DSK (Orientierungshilfe Werbung)"],
  ["VVT", "Videoüberwachung (z. B. Verkaufsraum, Eingang, Lager)", "werte.loeschfrist", "Aufnahmen werden in der Regel nach 72 Stunden gelöscht; länger nur zur Sicherung eines konkreten Vorfalls."],
  ["VVT", "Videoüberwachung (z. B. Verkaufsraum, Eingang, Lager)", "quelle", "DSK (Orientierungshilfe Videoüberwachung)"],
  // Datenschutzinformation für Betroffene (r9): ganze Sätze, Recherche-Reste (Stichtag, Aktenzeichen) ins Feld „quelle“
  ["VVT", "Terminvereinbarung (telefonisch, vor Ort oder Online-Buchung)", "werte.loeschfrist", "Die Daten werden gelöscht, sobald der Zweck entfallen ist (nach dem Termin), soweit sie nicht in die Kundenkartei oder eine Rechnung übernommen werden; eine besondere gesetzliche Frist gibt es nicht (Art. 5 Abs. 1 lit. e, Art. 17 Abs. 1 lit. a DSGVO)."],
  ["VVT", "Rechnungsstellung und Buchhaltung", "werte.loeschfrist", (t) => t.replace(" (seit 01.01.2025)", "")],
  ["VVT", "Kontaktanfragen (Kontaktformular, E-Mail, Telefon)", "werte.loeschfrist", (t) => t.replace(/^Nach abschließender Bearbeitung, sofern/, "Die Daten werden nach abschließender Bearbeitung gelöscht, sofern")],
  ["VVT", "Geschäftliche E-Mail-Kommunikation", "werte.loeschfrist", (t) => t.replace("Übrige E-Mails nach Zweckerfüllung.", "Übrige E-Mails werden gelöscht, sobald sie nicht mehr benötigt werden.")],
  ["VVT", "Lieferanten- und Dienstleisterverwaltung", "werte.loeschfrist", (t) => t.replace("Kontaktdaten nach Ende der Geschäftsbeziehung.", "Kontaktdaten werden nach Ende der Geschäftsbeziehung gelöscht.")],
  ["VVT", "Unternehmensauftritt in sozialen Netzwerken (z. B. Facebook-/Instagram-Seite)", "werte.rechtsgrundlage", (t) => t.replace(" (EuGH C-210/16)", "")],
  ["VVT", "Unternehmensauftritt in sozialen Netzwerken (z. B. Facebook-/Instagram-Seite)", "quelle", (t) => `${t}; EuGH C-210/16`],
  // Hautschutzplan Friseur – Handschuhangaben nach BGW 2026 (E-146)
  ["HAUTSCHUTZ_FRISEUR", "Shampoonieren, Kopfmassage mit Haarbehandlungsmitteln, Pflegemittel auftragen/auswaschen", "werte.handschuhe", "Einmalhandschuhe aus Nitril oder Vinyl mit langen Stulpen über das Handgelenk (alternativ Waschhandschuhe)"],
  ["HAUTSCHUTZ_FRISEUR", "Färben, Dauerwelle, Blondierung: Mischen, Auftragen, Überprüfen, Probewickeln, Fixieren", "werte.handschuhe", "Friseur-Einmalhandschuhe nach DIN EN ISO 374-6 (Friseur-Symbol), keine gepuderten Latexhandschuhe"],
  ["HAUTSCHUTZ_FRISEUR", "Reinigung und Desinfektion von Arbeitsgeräten und Räumen", "werte.handschuhe", "Haushaltshandschuhe bzw. chemikalienbeständige Schutzhandschuhe nach DIN EN ISO 374, ggf. mit längerem Schaft"],
];
/** Textersetzungen in allen Texten einer Liste (E-146). */
const ERSETZE = [
  ["GEFAEHRDUNGEN", "Handschutz- und Händehygieneplan", "Hautschutz- und Händehygieneplan"],
  ["ALLERGENE_UMFANG", "vorhandenes SO2,", "vorhandenes SO₂,"],
  ["HYGIENE", "\"nach jedem Kunden\"", "\"nach jeder Kundin / jedem Kunden\""],
  // Lektorat r9: Hinweise an den Betrieb und Recherche-Reste aus Texten für Dritte, einheitliche Begriffe
  ["VVT", "\"Kunden, Interessenten\"", "\"Kundinnen und Kunden, Interessenten\""],
  ["VVT", "\"Website-Besucher\"", "\"Besucherinnen und Besucher der Website\""],
  ["DSE", " Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, einer auf Art. 6 Abs. 1 lit. e oder f DSGVO gestützten Verarbeitung zu widersprechen (Art. 21 DSGVO).", " Außerdem können Sie der Verarbeitung widersprechen (Art. 21 DSGVO, siehe „Widerspruchsrecht“)."],
  ["DSE", "werden durch den von Ihrem Browser übermittelten Datenaustausch automatisch folgende Daten in Server-Logfiles gespeichert:", "übermittelt Ihr Browser technisch bedingt Daten an unseren Server. Dabei werden automatisch folgende Daten in Server-Logfiles gespeichert:"],
  ["DSE", "damit die Website bzw. von Ihnen ausdrücklich gewünschte Funktionen (z. B. {Speicherung Ihrer Cookie-Auswahl, Warenkorb, Login}) funktionieren", "damit die Website und von Ihnen ausdrücklich gewünschte Funktionen (z. B. {Speicherung Ihrer Cookie-Auswahl, Warenkorb, Login}) bereitstehen"],
  ["DSE", "wenn Sie dem zuvor zugestimmt haben", "wenn Sie zuvor eingewilligt haben"],
  ["DSE", "wenn Sie dem zustimmen bzw. das Video aktiv starten", "wenn Sie eingewilligt haben bzw. das Video aktiv starten"],
  ["DSE", "zum EU-US Data Privacy Framework (Durchführungsbeschluss (EU) 2023/1795).", "zum EU-US Data Privacy Framework, Durchführungsbeschluss (EU) 2023/1795."],
  ["DSE", "einen Auftragsverarbeitungsvertrag geschlossen haben", "einen Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO geschlossen haben"],
  ["DSE", "auf Grundlage eines Vertrags nach Art. 28 DSGVO", "auf Grundlage eines Vertrags zur Auftragsverarbeitung nach Art. 28 DSGVO"],
  ["HYGIENE", " (Rahmenhygieneplan: > 1 Minute)", ", mindestens 1 Minute"],
  ["HYGIENE", "stich-, bruch- und durchstichfester", "stich- und bruchfester"],
  ["HYGIENE", "Belehrung der Mitarbeitenden schriftlich dokumentieren", "Unterweisung der Beschäftigten schriftlich dokumentieren"],
  ["HYGIENE", "bei mindestens 60 °C waschen (bewährt: 60 °C plus Maschinentrocknung); Umhänge nur mit Papierhalskrause; bei Blut-/Sekretverschmutzung bei 60 °C waschen oder entsorgen", "bei mindestens 60 °C waschen, danach möglichst im Trockner trocknen; Umhänge nur mit Papierhalskrause verwenden; mit Blut oder Sekret verschmutzte Wäsche bei mindestens 60 °C waschen oder entsorgen"],
  ["HYGIENE", "Mehrweginstrumente zerlegt vollständig einlegen (Einwirkzeit ab letztem eingelegten Teil), abspülen, reinigen, trocknen, trocken und geschützt lagern", "Mehrweginstrumente zerlegt und vollständig in die Lösung einlegen (Einwirkzeit ab dem zuletzt eingelegten Teil), abspülen, reinigen, trocknen und geschützt lagern"],
  ["HYGIENE", "Wunde desinfizieren, Pflaster; bei größeren Wunden Arzt;", "Wunde desinfizieren und mit Pflaster versorgen; größere Wunden ärztlich versorgen lassen;"],
  ["HYGIENE", "für jeden Kunden neue Handschuhe", "für jede Kundin und jeden Kunden neue Handschuhe"],
  ["HYGIENE", "Hautdesinfektion beim Kunden", "Hautdesinfektion bei Kundin/Kunde"],
  ["HYGIENE", "bei Kunden mit Hautinfektion", "bei Kundin/Kunde mit Hautinfektion"],
  ["HYGIENE", "Verletzung des Kunden", "Verletzung von Kundin/Kunde"],
  ["HYGIENE", "Infektionsstatus des Kunden erfragen", "Infektionsstatus von Kundin/Kunde erfragen"],
  ["HYGIENE", "nach Behandlung bei Bedarf und am Arbeitstagsende", "nach der Behandlung bei Bedarf und bei Arbeitsende"],
  ["HYGIENE", "\"Arbeitsbeginn, nach Pausen/Essen, nach Toilettenbesuch", "\"vor Arbeitsbeginn, nach Pausen und dem Essen, nach dem Toilettenbesuch"],
  ["HYGIENE", "nicht zurückstecken", "Schutzkappe nicht wieder aufsetzen"],
  ["HAUTSCHUTZ_FRISEUR", "; gut abtrocknen; eincremen", "; gut abtrocknen"],
  ["HAUTSCHUTZ_FRISEUR", "Hände mit Hautpflegepräparat eincremen", "Nach dem Waschen, vor Pausen und nach Arbeitsende Hände mit Hautpflegepräparat eincremen"],
  ["HAUTSCHUTZ_FRISEUR", "\"Einmalhandschuhe, langstulpig\"", "\"Einmalhandschuhe mit langen Stulpen\""],
  ["BA_BAUSTEINE", "Entsorgung mit der örtlichen Gewerbeabfallberatung klären.", "Abfälle nur über die im Betrieb festgelegten Entsorgungswege entsorgen."],
  ["GEFAEHRDUNGEN", "Unterweisung dokumentieren (z. B. BGW-Dokumentationshilfe „Nachweis über Schulung/Unterweisung/Einweisung“).", "Unterweisung dokumentieren (z. B. mit dem Unterweisungsnachweis)."],
  ["GEFAEHRDUNGEN", "farb- und duftstofffreie Waschmittel", "farb- und duftstofffreie Hautreinigungsmittel"],
  ["GEFAEHRDUNGEN", "EU-kosmetikkonforme Produkte", "der EU-Kosmetikverordnung entsprechende Produkte"],
  ["GEFAEHRDUNGEN", "Ab oberem Auslösewert", "Ab dem oberen Auslösewert"],
  ["GEFAEHRDUNGEN", "ab unterem Auslösewert", "ab dem unteren Auslösewert"],
  ["GEFAEHRDUNGEN", "mit 6 LE)", "mit 6 Löschmitteleinheiten)"],
  ["ELEKTRO_FRISTEN", "DA zu § 5", "Durchführungsanweisung zu § 5"],
  ["TOM", "Programme aktivieren\"", "Programme aktiviert\""],
  ["TOM", "bzw. außer Haus aufbewahren", "bzw. außer Haus aufbewahrt"],
  ["TOM", "\"Wiederherstellung aus der Datensicherung regelmäßig testen\"", "\"Regelmäßiger Test der Wiederherstellung aus der Datensicherung\""],
  ["TOM", "für Sicherheitsvorfälle bereithalten", "für Sicherheitsvorfälle liegen bereit"],
  ["TOM", "\"Dokumentierte Zugangsdaten für Notfälle sicher hinterlegen", "\"Zugangsdaten für Notfälle sicher hinterlegt"],
  ["TOM", "Beschäftigter sofort sperren", "Beschäftigter werden sofort gesperrt"],
  ["TOM", "nicht mehr unterstützte Systeme ersetzen", "nicht mehr unterstützte Systeme werden ersetzt"],
  ["TOM", "vertrauliche Unterlagen nur verschlüsselt versenden", "vertrauliche Unterlagen werden nur verschlüsselt versendet"],
  ["TOM", "Clean-Desk: keine", "Aufgeräumter Arbeitsplatz (Clean Desk): keine"],
  ["SV", "(325 Euro)", "(325 €)"],
  ["PANNEN_SOFORT", "nötig), bei Ransomware", "nötig); bei Ransomware"],
];
/**
 * Neufassungen von Auswahltexten, die gespeichert werden (Lektorat r9): Die Vorlagen speichern weiter den früheren
 * Text als Wert (FRUEHERE_TEXTE: neu → früher), damit bestehende Auswahlen gültig bleiben; gedruckt wird die Neufassung.
 */
const NEUFASSEN = [
  ["GOBD", "originär Papier, Ablage in Papier (Muster 4.1)", "Papierbeleg, wird in Papier abgelegt"],
  ["GOBD", "originär Papier, wird gescannt (ersetzendes Scannen, Muster 4.2)", "Papierbeleg, wird gescannt (ersetzendes Scannen)"],
  ["GOBD", "originär digital (Muster 4.3)", "elektronischer Beleg (originär digital)"],
  ["GOBD", "durch Softwareanbieter/Rechenzentrum", "beim Softwareanbieter bzw. im Rechenzentrum"],
  ["GOBD", "durch Steuerberater", "bei der Steuerberatung"],
  ["GOBD", "Upload an Steuerberater (z. B. Kanzlei-Portal)", "Upload an die Steuerberatung (z. B. Kanzlei-Portal)"],
  ["IFSG", "betroffene Lebensmittel nach § 42 Abs. 2 und Tätigkeit in Küchen von Gaststätten und Gemeinschaftsverpflegung", "Betroffene Lebensmittel nach § 42 Abs. 2 und Tätigkeit in Küchen von Gaststätten und Gemeinschaftsverpflegung"],
  ["IFSG", "bei Krankheitszeichen ärztlichen Rat einholen und mitteilen, dass man mit Lebensmitteln arbeitet (Merkblatt Gesundheitsamt)", "Bei Krankheitszeichen ärztlichen Rat einholen und mitteilen, dass man mit Lebensmitteln arbeitet"],
  ["KASSEN_ARTEN", "Computergestützte Kassensysteme / PC-Kassensysteme", "Computergestütztes Kassensystem (PC-Kasse)"],
  ["KASSEN_ARTEN", "Tablet-/App-Kassensysteme", "Tablet-/App-Kassensystem"],
  ["KASSEN_ARTEN", "Elektronische Registrierkassen", "Elektronische Registrierkasse"],
];
const daten = daten0;
for (const [liste, schluessel, pfad, neu] of SETZE) {
  const eintrag = daten[liste].find((x) => x.titel === schluessel || x.bezeichnung === schluessel);
  if (!eintrag) throw new Error(`Korrektur: ${liste} „${schluessel}“ nicht gefunden`);
  const teile = pfad.split(".");
  const ziel = teile.slice(0, -1).reduce((o, k) => o[k], eintrag);
  const feld = teile.at(-1);
  const alt = ziel[feld];
  ziel[feld] = typeof neu === "function" ? neu(alt) : neu;
  if (ziel[feld] === alt) throw new Error(`Korrektur greift nicht mehr: ${liste} „${schluessel}“ ${pfad}`);
}
/**
 * Vorschläge für bestimmte Branchen abtrennen (Szenario Elektro, r9): Der allgemeine Vorschlag bleibt unter seinem Titel
 * (gespeicherte Auswahlen bleiben gültig), ohne den branchenbezogenen Teil; dieser steht wörtlich unverändert in einem
 * eigenen Vorschlag mit dem neuen Titel direkt dahinter. [Liste, Titel, neuer Titel, { Feld: Text im allgemeinen Vorschlag }]
 */
const TEILEN = [
  ["VVT", "Kundenverwaltung / Kundenkartei", "Kundenkartei mit Gesundheitsangaben (z. B. Allergien, Unverträglichkeiten)", {
    rechtsgrundlage: (t) => t.replace(/ Bei Gesundheitsangaben \(z\. B\. Allergien\/Unverträglichkeiten\) ausdrückliche Einwilligung nach Art\. 9 Abs\. 2 lit\. a DSGVO\./, ""),
    datenarten: (t) => t.replace(/, ggf\. Gesundheitsdaten \(nur mit ausdrücklicher Einwilligung\)/, ""),
  }],
];
for (const [liste, titel, neuerTitel, allgemein] of TEILEN) {
  const i = daten[liste].findIndex((x) => x.titel === titel);
  if (i < 0) throw new Error(`Teilen: ${liste} „${titel}“ nicht gefunden`);
  const kopie = JSON.parse(JSON.stringify(daten[liste][i]));
  kopie.titel = neuerTitel;
  kopie.werte.bezeichnung = neuerTitel;
  for (const [feld, f] of Object.entries(allgemein)) {
    const alt = daten[liste][i].werte[feld];
    daten[liste][i].werte[feld] = f(alt);
    if (daten[liste][i].werte[feld] === alt) throw new Error(`Teilen greift nicht mehr: ${liste} „${titel}“ ${feld}`);
  }
  daten[liste].splice(i + 1, 0, kopie);
}
for (const [liste, alt, neu] of ERSETZE) {
  const vorher = JSON.stringify(daten[liste]);
  if (!vorher.includes(alt)) throw new Error(`Ersetzung greift nicht mehr: ${liste} „${alt}“`);
  daten[liste] = JSON.parse(vorher.split(alt).join(neu));
}
const fruehereTexte = {};
for (const [liste, alt, neu] of NEUFASSEN) {
  const vorher = JSON.stringify(daten[liste]);
  const suche = JSON.stringify(alt);
  if (vorher.split(suche).length !== 2) throw new Error(`Neufassung greift nicht genau einmal: ${liste} „${alt}“`);
  daten[liste] = JSON.parse(vorher.replace(suche, () => JSON.stringify(neu)));
  fruehereTexte[neu] = alt;
}
daten.FRUEHERE_TEXTE = fruehereTexte;

const typen = {
  GEFAEHRDUNGEN: "Vorschlag[]", MUTTERSCHUTZ: "Option[]", UNTERWEISUNGSTHEMEN: "(Option & { branchen: string[] })[]", BA_GLIEDERUNG: "{ nr: string; abschnitt: string; inhalt: string }[]", BA_BAUSTEINE: "Record<string, Option[]>",
  HAUTSCHUTZ_FRISEUR: "Vorschlag[]", ELEKTRO_FRISTEN: "(Option & { unsicher?: boolean })[]", GEFAHRSTOFF_ANGABEN: "string[]",
  VVT: "Vorschlag[]", TOM: "Vorschlag[]", DSE: "Record<string, { titel: string; text: string; quelle?: string; unsicher?: boolean }>", AUFSICHT: "{ land: string; name: string; ort: string; url: string }[]", AVV_KLAUSELN: "{ lit: string; text: string }[]", PANNEN_ARTEN: "Option[]", PANNEN_SOFORT: "(Option & { unsicher?: boolean })[]",
  KU_HINWEIS_NEU: "string", RECHNUNGS_HINWEISE: "(Option & { unsicher?: boolean })[]", EINHEITEN: "string[]", EUER_AUSGABEN: "string[]", EUER_EINNAHMEN: "string[]", GOBD: "{ belegeingang: string[]; belegart: string[]; ablage: string[]; papier: string[]; sicherungIntervall: string[]; sicherungOrt: string[]; eRechnung: string }",
  KASSEN_ARTEN: "string[]", TSE_ARTEN: "string[]", NACHWG: "{ angaben: { nr: number; text: string }[]; einleitung: string; kuendigungGrund: string; klagefrist: string; urlaub: string }", MINDESTLOHN: "{ ab: string; cent: number }[]", MINIJOB: "{ ab: string; cent: number }[]",
  SV: "{ personengruppen: Option[]; schulabschluss: Option[]; ausbildung: Option[]; vertragsform: Option[] }", INTERESSE: "Option[]", RECHTSFORMEN: "string[]", AUFBEWAHRUNG: "{ jahre: string; art: string }[]",
  HACCP: "Vorschlag[]", ALLERGENE_UMFANG: "{ bezeichnung: string; umfasst: string }[]", LOSE_WARE: "{ formen: string[]; anforderung: string; rechtsgrundlage: string }", IFSG: "{ inhalte: string[]; personen: string[]; lebensmittel: string[]; symptome: string[] }", HYGIENE: "Vorschlag[]",
  FRUEHERE_TEXTE: "Record<string, string>",
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
