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
/**
 * Vorprüfung 21.10.2026 (Art. 13 Abs. 1 lit. f DSGVO): die Garantie selbst nennen, nicht auf die Hinweise des Anbieters
 * verweisen – für Meta (Facebook, Instagram) der Angemessenheitsbeschluss zum EU-U.S. Data Privacy Framework.
 */
const drittland = (v) => (/USA/.test(liste(v.empfaenger)) ? "möglich: USA (Plattformbetreiber, z. B. Meta Platforms, Inc.); Grundlage der Übermittlung: Angemessenheitsbeschluss der EU-Kommission zum EU-U.S. Data Privacy Framework (Art. 45 DSGVO, Durchführungsbeschluss (EU) 2023/1795) für danach zertifizierte Anbieter" : "keine Übermittlung in Drittländer");
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
  // Vorprüfung 21.10.2026: ein konkreter Wert statt „siehe Datenschutzerklärung“ (Papierdokumente an Kunden); die Frist hängt
  // vom Hoster ab – im Verzeichnis anpassbar, in der Datenschutzinformation ein eigenes Feld (wie in der Website-Erklärung)
  ["VVT", "Betrieb der Website (Hosting, Server-Logfiles)", "werte.loeschfrist", "Server-Logfiles mit IP-Adressen werden nach 14 Tagen gelöscht."],
  ["VVT", "Betrieb der Website (Hosting, Server-Logfiles)", "werte.empfaenger", "Hosting-Dienstleister (Auftragsverarbeiter)"],
  ["VVT", "Betrieb der Website (Hosting, Server-Logfiles)", "quelle", "BayLDA-Muster"],
  // Vorprüfung 21.10.2026 (T-106 Nr. 10): „bis zu drei Jahre“ wie in der Website-Datenschutzerklärung
  ["VVT", "E-Mail-Newsletter / E-Mail-Werbung", "werte.loeschfrist", "Die Adresse wird nach Abmeldung oder Widerspruch unverzüglich aus dem Verteiler gelöscht; der Nachweis der Einwilligung wird zur Rechtsverteidigung bis zu drei Jahre aufbewahrt (Verjährung § 195 BGB, § 31 OWiG)."],
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
  // Vorprüfung 21.10.2026 (T-106 Nr. 9): YouTube und Google Fonts mit derselben Garantie für die USA wie Google Maps;
  // Google Fonts mit § 25 TDDDG (Zugriff auf das Endgerät) wie die übrigen Einwilligungsbausteine
  ["DSE", "auch mit Übermittlung in die USA. Rechtsgrundlage ist Ihre Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit widerrufen können. Weitere", "auch mit Übermittlung in die USA. Rechtsgrundlage ist Ihre Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit widerrufen können. Für Übermittlungen in die USA stützt sich Google auf den Angemessenheitsbeschluss zum EU-US Data Privacy Framework, Durchführungsbeschluss (EU) 2023/1795. Weitere"],
  ["DSE", "wobei insbesondere Ihre IP-Adresse übermittelt wird. Dies erfolgt nur, wenn Sie zuvor eingewilligt haben (Art. 6 Abs. 1 lit. a DSGVO); die Einwilligung können Sie jederzeit widerrufen.", "wobei insbesondere Ihre IP-Adresse übermittelt wird, auch an Server in den USA. Dies erfolgt nur, wenn Sie zuvor eingewilligt haben (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO); die Einwilligung können Sie jederzeit widerrufen. Für Übermittlungen in die USA stützt sich Google auf den Angemessenheitsbeschluss zum EU-US Data Privacy Framework, Durchführungsbeschluss (EU) 2023/1795."],
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
  // Durchsicht Sifa 23.10.2026 (Hygieneplan Beauty, Hinweise aus Sicht des Arbeitsschutzes): nach einem Arbeitsunfall der
  // Durchgangsarzt, nicht der Hausarzt; HIV-Postexpositionsprophylaxe möglichst innerhalb von 2 Stunden
  ["HYGIENE", "unverzüglich Hausarzt bzw. Durchgangsarzt (ggf. Postexpositionsprophylaxe)", "sofort Durchgangsarzt (HIV-Postexpositionsprophylaxe möglichst innerhalb von 2 Stunden)"],
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
/**
 * R11 (Nutzertest Kosmetik #20, Rechtsprüfung #11): eigene Zwecke und Löschregel für die Kundenkartei mit
 * Gesundheitsangaben (Einwilligung freiwillig und widerrufbar), Krankheitszeiten als Gesundheitsdaten. Fachlich zu prüfen
 * (PRUEFLISTE T-62); nach dem Abtrennen gesetzt, weil es den Vorschlag vorher nicht gibt.
 */
const NACH_TEILEN = [
  ["VVT", "Kundenkartei mit Gesundheitsangaben (z. B. Allergien, Unverträglichkeiten)", "werte.zweck", "Sichere Behandlung: Berücksichtigung von Allergien, Unverträglichkeiten und Gegenanzeigen (Kontraindikationen)"],
  ["VVT", "Kundenkartei mit Gesundheitsangaben (z. B. Allergien, Unverträglichkeiten)", "werte.rechtsgrundlage", "Gesundheitsangaben: ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO – freiwillig und jederzeit widerrufbar (Art. 7 Abs. 3 DSGVO); die Einwilligung wird nachgewiesen (Art. 7 Abs. 1 DSGVO). Übrige Kundendaten: Art. 6 Abs. 1 lit. b DSGVO."],
  ["VVT", "Kundenkartei mit Gesundheitsangaben (z. B. Allergien, Unverträglichkeiten)", "werte.empfaenger", "IT-/Software-Dienstleister (Auftragsverarbeiter)"],
  ["VVT", "Kundenkartei mit Gesundheitsangaben (z. B. Allergien, Unverträglichkeiten)", "werte.loeschfrist", "Gesundheitsangaben werden gelöscht, sobald die Einwilligung widerrufen wird oder sie für die Behandlung nicht mehr benötigt werden (Art. 17 Abs. 1 lit. a, b DSGVO)."],
  ["VVT", "Kundenkartei mit Gesundheitsangaben (z. B. Allergien, Unverträglichkeiten)", "quelle", (t) => `${t}; Art. 7, Art. 9 Abs. 2 lit. a DSGVO`],
  ["VVT", "Personalverwaltung (Personalakte, Arbeitszeit)", "werte.rechtsgrundlage", (t) => `${t.replace(/\.$/, "")}; Krankheitszeiten (Arbeitsunfähigkeit) als Gesundheitsdaten zusätzlich Art. 9 Abs. 2 lit. b DSGVO`],
];
for (const [liste, schluessel, pfad, neu] of NACH_TEILEN) {
  const eintrag = daten[liste].find((x) => x.titel === schluessel);
  if (!eintrag) throw new Error(`Korrektur nach dem Teilen: ${liste} „${schluessel}“ nicht gefunden`);
  const teile = pfad.split(".");
  const ziel = teile.slice(0, -1).reduce((o, k) => o[k], eintrag);
  const feld = teile.at(-1);
  const alt = ziel[feld];
  ziel[feld] = typeof neu === "function" ? neu(alt) : neu;
  if (ziel[feld] === alt) throw new Error(`Korrektur nach dem Teilen greift nicht mehr: ${liste} „${schluessel}“ ${pfad}`);
}
for (const [liste, alt, neu] of ERSETZE) {
  const vorher = JSON.stringify(daten[liste]);
  if (!vorher.includes(alt)) throw new Error(`Ersetzung greift nicht mehr: ${liste} „${alt}“`);
  daten[liste] = JSON.parse(vorher.split(alt).join(neu));
}
/**
 * Rechtsanwalt, Fachfragen Runde 3 (24.10.2026, docs/pruefberichte/2026-10-24-runde3-fachfragen-recht.xlsx, Nr. 1 und 4),
 * Hygieneplan Beauty, Zeile „Umgang mit Blut – Stich-/Schnittverletzung“ – beide Sätze im Wortlaut des Prüfers:
 *   - HIV-PEP mit der Obergrenze, die die S2k-Leitlinie AWMF 055-004 nach Stich- oder Schnittverletzungen nennt (wie B-276);
 *   - keine routinemäßige Abfrage des Infektionsstatus: nur die freiwillige Auskunft der Kundin oder des Kunden
 *     (Art. 9 Abs. 2 lit. a DSGVO), nur an den Durchgangsarzt, nicht ins Verbandbuch.
 */
const PEP_RA = "sofort Durchgangsarzt bzw. Betriebsarzt aufsuchen – eine HIV-Postexpositionsprophylaxe sollte möglichst innerhalb von 2 Stunden beginnen, nach einer Stich- oder Schnittverletzung spätestens bis 24 Stunden; auch später noch ärztlich abklären lassen.";
const AUSKUNFT_RA = "Kundin/Kunde fragen, ob sie freiwillig Auskunft über bekannte Infektionen (Hepatitis B/C, HIV) geben möchten – die Antwort ist freiwillig; nur an den Durchgangsarzt weitergeben, nicht im Verbandbuch notieren.";
const RA_RUNDE3 = [
  ["HYGIENE", "Umgang mit Blut – Stich-/Schnittverletzung der beschäftigten Person", "werte.wie", (t) =>
    t.replace("abdecken; Infektionsstatus von Kundin/Kunde erfragen (Hepatitis, HIV); sofort Durchgangsarzt (HIV-Postexpositionsprophylaxe möglichst innerhalb von 2 Stunden); Unfall im Verbandbuch dokumentieren",
      `abdecken und ${PEP_RA} ${AUSKUNFT_RA} Unfall im Verbandbuch dokumentieren.`)],
  ["HYGIENE", "Umgang mit Blut – Stich-/Schnittverletzung der beschäftigten Person", "quelle", (t) => `${t}; S2k-Leitlinie AWMF 055-004; Art. 9 Abs. 2 lit. a DSGVO`],
];
for (const [liste, schluessel, pfad, neu] of RA_RUNDE3) {
  const eintrag = daten[liste].find((x) => x.titel === schluessel);
  if (!eintrag) throw new Error(`Korrektur Rechtsanwalt Runde 3: ${liste} „${schluessel}“ nicht gefunden`);
  const teile = pfad.split(".");
  const ziel = teile.slice(0, -1).reduce((o, k) => o[k], eintrag);
  const feld = teile.at(-1);
  const alt = ziel[feld];
  ziel[feld] = neu(alt);
  if (ziel[feld] === alt) throw new Error(`Korrektur Rechtsanwalt Runde 3 greift nicht mehr: ${liste} „${schluessel}“ ${pfad}`);
}
/**
 * E-167: fachliche Durchsicht durch eine Fachkraft für Arbeitssicherheit (Ergebnis vom 22.10.2026,
 * docs/pruefberichte/2026-10-22-arbeitsschutz-pruefergebnis.xlsx, Blatt „A Bausteine“). Je Eintrag die Nummer der
 * Prüfmappe (B-…), damit jede Änderung zuzuordnen ist; die Zuordnung Nummer → Baustein steht in
 * src/dokumente/sifa.ts. „ändern“: Wortlaut der Spalte „Korrektur“ (nur an den Stil der Bausteine angepasst) und Fundstelle;
 * „ändern (Quelle)“: nur Fundstelle; „frei“: Fundstelle aus der Durchsicht ergänzt, Vermerke „Nutzertest“ und „fachlich zu
 * prüfen“ entfallen bei Prüfstand „bestätigt“/„plausibel“; „offen“ behält „fachlich zu prüfen“ (Grund in sifa.ts).
 * Pfade: Feld im Eintrag (z. B. „werte.massnahme“); `null` entfernt das Feld. Jede Änderung muss greifen.
 */
const zeile = (alt, neu) => (t) => t.replace(alt, neu);
const dazu = (neu) => (t) => `${t}\n${neu}`;
const SIFA = [
  // ---- Gefährdungsbeurteilung, Bausteine aus der Recherche
  ["B-002", "GEFAEHRDUNGEN", "Ausrutschen, Stolpern und Stürzen durch glatte Böden, Schmierfilme, Unebenheiten oder verrutschende Fußmatten.", { quelle: "BGW-Branchenhilfe Friseur" }],
  ["B-003", "GEFAEHRDUNGEN", "Versperrte Verkehrs- und Fluchtwege, zu enge Bewegungsflächen, herumstehende bewegliche Geräte.", { quelle: "ASR A1.8; ASR A2.3; BGW" }],
  ["B-004", "GEFAEHRDUNGEN", "Unzureichende Frischluftzufuhr, dadurch Belastung durch Dämpfe und Aerosole von Friseurchemikalien.", { quelle: "TRGS 530 Nr. 5.2 Abs. 1" }],
  // „ändern (Quelle)“ mit Satz zur Vorsorge – der Satz steht auch im Blatt „A Kennzahlen“ (Feuchtarbeit > 2 / ≥ 4 Std.)
  ["B-005", "GEFAEHRDUNGEN", "Feuchtarbeit (Haare waschen, Arbeiten an feuchtem Haar, häufiges Händewaschen) als Hauptrisikofaktor für Handekzeme.", { quelle: "TRGS 530 Nr. 5.3 Abs. 2; ArbMedVV Anhang Teil 1 Abs. 1 Nr. 2a, Abs. 2 Nr. 2e", "werte.massnahme": dazu("Feuchtarbeit von mehr als 2 Stunden je Tag: Angebotsvorsorge; ab 4 Stunden je Tag: Pflichtvorsorge (ArbMedVV).") }],
  ["B-006", "GEFAEHRDUNGEN", "Hautkontakt mit Friseurchemikalien (Färbe-, Blondier-, Dauerwellmittel) kann zu Allergien und Hautreizungen führen.", { quelle: "TRGS 530 Nr. 5.2 Abs. 2, 5.4; DIN EN ISO 374-6:2025-11" }],
  ["B-007", "GEFAEHRDUNGEN", "Einatmen von Stäuben (Blondiermittel), Dämpfen (Dauerwelle) und Sprühnebel (Haarspray) reizt die Atemwege.", { quelle: "TRGS 530 Nr. 5.2, 5.3 Abs. 3" }],
  ["B-008", "GEFAEHRDUNGEN", "Hautschäden durch Reinigungs- und Desinfektionsmittel.", { quelle: "BGW; TRGS 525; TRGS 401" }],
  ["B-009", "GEFAEHRDUNGEN", "Brand- und Explosionsgefahr durch alkoholische Desinfektionsmittel, Spraydosen und entzündbare Flüssigkeiten.", { quelle: "ASR A2.2 Tab. 3, Nr. 5.4; BGW", "werte.unterpunkt": "brand", "werte.massnahme": zeile("(bis 50 m² Grundfläche Schaumlöscher A/B mit 6 Löschmitteleinheiten)", "(bis 50 m² Grundfläche 6 Löschmitteleinheiten, z. B. Schaumlöscher für die Brandklassen A und B)") }],
  ["B-010", "GEFAEHRDUNGEN", "Absturz von Leitern oder Tritten, umkippende Regale, herabfallende Kartons.", { quelle: "DGUV Information 208-016; § 14 BetrSichV; BGW" }],
  ["B-011", "GEFAEHRDUNGEN", "Elektrische Gefährdung durch nicht geprüfte oder beschädigte Elektrogeräte und Anlagen.", { quelle: "DGUV Vorschrift 3; § 14 BetrSichV; BGW" }],
  ["B-013", "GEFAEHRDUNGEN", "Stress und Hektik in Stoßzeiten, zu lange Arbeitszeiten, fehlende oder zu kurze Pausen und Ruhezeiten.", { quelle: "ArbZG; BGW" }],
  ["B-014", "GEFAEHRDUNGEN", "Zeitdruck, Konflikte im Team, unzufriedene Kundschaft sowie Aggressionen und Übergriffe.", { quelle: "BGW; DGUV Regel 112-139", "werte.massnahme": zeile("Arbeitspläne so gestalten, dass niemand allein arbeitet.", "Alleinarbeit möglichst vermeiden, sonst Notruf und Erreichbarkeit regeln.") }],
  ["B-015", "GEFAEHRDUNGEN", "Fehlende Kenntnisse über Gefahrstoffe, Hautschutz und Hygieneregeln.", { quelle: "§ 12 ArbSchG; § 14 GefStoffV; BGW" }],
  ["B-016", "GEFAEHRDUNGEN", "Verzögerte Hilfe bei Unfällen und Notfällen.", { quelle: "ASR A4.3 Tab. 1; DIN 13157; BGW", "werte.unterpunkt": "notfall" }],
  ["B-017", "GEFAEHRDUNGEN", "Stolpern, Ausrutschen und Stürzen durch nasse Böden, Schmierfilme, Stufen oder Kabel.", { quelle: "BGW 04-05-080, Stand 03/2023, S. 27–28; ASR A1.5" }],
  ["B-018", "GEFAEHRDUNGEN", "Unzureichende Beleuchtung bei Präzisionsarbeiten sowie an Eingang und Treppen.", { quelle: "BGW 04-05-080 (750 Lux: Empfehlung der BGW); ASR A3.4 Anhang 3", "werte.massnahme": zeile("Arbeitsplätze für Kosmetik- und Sticharbeiten mit mindestens 750 Lux beleuchten (ASR A3.4 beachten).", "Arbeitsplätze für Präzisionsarbeiten (Maniküre, Pediküre, Permanent-Make-up) mit mindestens 750 Lux beleuchten – Empfehlung der BGW; ASR A3.4 Anhang 3 nennt für Kosmetik keinen eigenen Wert (Haarpflege: 500 Lux).") }],
  ["B-019", "GEFAEHRDUNGEN", "Hautbelastung durch Feuchtarbeit, häufiges Händewaschen, langes Handschuhtragen sowie Desinfektions- und Reinigungsmittel.", { quelle: "BGW 04-05-080, S. 21–22; TRGS 401" }],
  ["B-022", "GEFAEHRDUNGEN", "Infektionsgefahr (z. B. Hepatitis, HIV) durch Blutkontakt sowie Stich- und Schnittverletzungen.", { quelle: "§ 11 BioStoffV; TRBA 250 (sinngemäß); BGW", "werte.massnahme": (t) => zeile("Hygieneplan aufstellen;", "Hygieneplan nach der Hygieneverordnung des Landes aufstellen;")(t) + "\nNach einer Stich- oder Schnittverletzung sofort Durchgangsarzt bzw. Betriebsarzt aufsuchen; eine HIV-Postexpositionsprophylaxe (PEP) sollte möglichst innerhalb von 2 Stunden beginnen." }],
  ["B-024", "GEFAEHRDUNGEN", "Augenschäden durch optische Strahlung bei Laser- und IPL-Anwendungen.", { quelle: "OStrV; TROS Laserstrahlung; NiSV", "werte.massnahme": dazu("Bei Lasern der Klassen 3R, 3B und 4 einen Laserschutzbeauftragten bestellen (§ 5 Abs. 2 OStrV); Fachkunde nach NiSV.") }],
  ["B-025", "GEFAEHRDUNGEN", "Stromschlag und Brandgefahr durch beschädigte Geräte, Leitungen oder Lampen, besonders bei Feuchtigkeit.", { quelle: "DGUV Vorschrift 3, Durchführungsanweisung zu § 5, Tabelle 1B; BGW 04-05-080, S. 25–26" }],
  ["B-029", "GEFAEHRDUNGEN", "Brand durch elektrische Defekte, überhitzte Geräte und entzündbare Desinfektions- und Reinigungsmittel.", { quelle: "ASR A2.2; BGW 04-05-080, S. 19–20", "werte.unterpunkt": "brand" }],
  // Blatt „A Kennzahlen“: R 12 für gewerbliche Küche und Spülraum
  ["B-030", "GEFAEHRDUNGEN", "Ausrutschen und Stürzen auf nassen oder fettigen Böden.", { quelle: "DGUV Regel 110-003, Abschn. 3.3.2, 3.5, 3.7; ASR A1.5 Anhang 2; BGN ASI 4.40", "werte.massnahme": dazu("Bodenbelag in der gewerblichen Küche und im Spülraum mindestens Bewertungsgruppe R 12.") }],
  // offen: 14-Tage-Wert nicht belegt – Alternative aus der Spalte „Korrektur“
  ["B-031", "GEFAEHRDUNGEN", "Hohe Temperatur und Feuchte sowie Schadstoffe in der Atemluft durch unzureichende Küchenlüftung; Brandlast im Abluftsystem.", { quelle: "DGUV Regel 110-003; VDI 2052 – fachlich zu prüfen", "werte.massnahme": zeile("Abscheider je nach Verschmutzung, spätestens alle 14 Tage reinigen.", "Aerosolabscheider nach Herstellerangabe und Verschmutzung reinigen; Abluftleitungen regelmäßig reinigen lassen (VDI 2052).") }],
  ["B-032", "GEFAEHRDUNGEN", "Eingeschlossenwerden und Kälteeinwirkung in Kühl- und Tiefkühlräumen.", { quelle: "DGUV Regel 110-003, Abschn. 3.1 – fachlich zu prüfen", "werte.massnahme": dazu("Begehbare Tiefkühlräume mit einer Notrufeinrichtung ausstatten.") }],
  ["B-037", "GEFAEHRDUNGEN", "Hautbelastung durch Wasser und Reinigungsmittel (Feuchtarbeit), insbesondere in der Spülküche.", { quelle: "DGUV Regel 110-003; TRGS 401; ArbMedVV Anhang Teil 1", "werte.massnahme": dazu("Feuchtarbeit von mehr als 2 Stunden je Tag: Angebotsvorsorge; ab 4 Stunden je Tag: Pflichtvorsorge (ArbMedVV).") }],
  ["B-038", "GEFAEHRDUNGEN", "Verätzungen und Reizungen durch Reinigungsmittel sowie Dämpfe und Aerosole beim Reinigen.", { quelle: "DGUV Regel 110-003, Abschn. 3.7; § 7 GefStoffV" }],
  ["B-039", "GEFAEHRDUNGEN", "Lärm in der Spülküche durch Geschirr und Geschirrwagen.", { quelle: "§§ 7, 8 LärmVibrationsArbSchV; ArbMedVV Anhang Teil 3", "werte.massnahme": dazu("Ab 85 dB(A) muss Gehörschutz getragen werden; Lärmbereich kennzeichnen.") }],
  ["B-040", "GEFAEHRDUNGEN", "Muskel-Skelett-Belastung durch Heben und Tragen schwerer Gebinde und Kochgeschirre.", { quelle: "DGUV Regel 110-003, Abschn. 3.1, 3.3.2, 3.4; LasthandhabV" }],
  ["B-041", "GEFAEHRDUNGEN", "Umkippen oder Herabfallen von Lagergut.", { quelle: "DGUV Regel 110-003, Abschn. 3.1; DIN EN 15635" }],
  ["B-043", "GEFAEHRDUNGEN", "Unerkannte Mängel und Verschleiß an Geräten und Schutzeinrichtungen.", { quelle: "DGUV Regel 110-003, Abschn. 3.8; §§ 3 Abs. 6, 14 BetrSichV" }],
  ["B-044", "GEFAEHRDUNGEN", "Absturz von Anlege- oder Stehleitern durch Standunsicherheit, Abrutschen oder schadhafte Leitern.", { quelle: "DGUV Information 208-016; §§ 3 Abs. 6, 14 BetrSichV", "werte.massnahme": (t) => t.replace("(Anlegewinkel 65–75° bei Sprossen)", "(Anlegewinkel 65–75° bei Sprossen, 60–70° bei Stufen)").replace("Leitern jährlich prüfen und im Prüfbuch dokumentieren;", "Leitern regelmäßig durch eine befähigte Person prüfen lassen, Frist nach der Gefährdungsbeurteilung (in der Regel jährlich), und im Prüfbuch dokumentieren;") }],
  ["B-045", "GEFAEHRDUNGEN", "Absturz an Kanten, Öffnungen und Treppenläufen.", { quelle: "ASR A2.1 Nr. 4.1; BG BAU Baustein B 100" }],
  ["B-046", "GEFAEHRDUNGEN", "Gehörschäden durch Lärm von Maschinen und Werkzeugen.", { quelle: "§§ 6–8 LärmVibrationsArbSchV; ArbMedVV Anhang Teil 3; DGUV-Handlungshilfe „Lärm in der Bauwirtschaft“" }],
  ["B-047", "GEFAEHRDUNGEN", "Einatmen von mineralischem, quarzhaltigem Staub beim Schneiden, Schleifen und Bohren.", { quelle: "TRGS 559; BG BAU Baustein C 317", "werte.massnahme": dazu("Atemschutz nur als letzte Stufe, wenn diese Maßnahmen nicht ausreichen.") }],
  ["B-048", "GEFAEHRDUNGEN", "Gesundheitsschäden durch Gefahrstoffe (z. B. Lösemittel, Säuren, Laugen).", { quelle: "§§ 6, 7, 14 GefStoffV; BG ETEM" }],
  ["B-049", "GEFAEHRDUNGEN", "Hautgefährdung durch Baustoffe, Reinigungsmittel und Feuchtigkeit.", { quelle: "TRGS 401; BG BAU", "werte.massnahme": zeile("Ersatzstoffe bzw. Verfahren mit weniger Hautkontakt prüfen.", "Ersatzstoffe bzw. Verfahren mit weniger Hautkontakt prüfen (z. B. chromatarmer Zement).") }],
  ["B-050", "GEFAEHRDUNGEN", "UV-Strahlung bei Arbeiten im Freien.", { quelle: "BG BAU; ArbMedVV Anhang Teil 3 Abs. 2; AMR 13.3", "werte.massnahme": dazu("Angebotsvorsorge bei Tätigkeiten im Freien mit intensiver UV-Belastung von regelmäßig 1 Stunde oder mehr je Tag (ArbMedVV Anhang Teil 3).") }],
  ["B-051", "GEFAEHRDUNGEN", "Stromschlag durch beschädigte Leitungen und elektrische Betriebsmittel.", { quelle: "DGUV Information 203-006; DGUV Vorschrift 3, Durchführungsanweisung zu § 5, Tabelle 1A; BG BAU Bausteine B 171, B 172, A 002" }],
  ["B-052", "GEFAEHRDUNGEN", "Unfälle mit Kraftfahrzeugen durch technische Mängel oder ungesicherte Ladung.", { quelle: "§ 57 DGUV Vorschrift 70", "werte.massnahme": zeile("Regelmäßige Prüfung durch Fachbetrieb;", "Fahrzeuge mindestens jährlich durch eine sachkundige Person prüfen lassen (§ 57 DGUV Vorschrift 70);") }],
  ["B-053", "GEFAEHRDUNGEN", "Schwere körperliche Belastung durch Heben, Tragen, Zwangshaltungen und Knien.", { quelle: "LasthandhabV; BG BAU Baustein D 506" }],
  ["B-054", "GEFAEHRDUNGEN", "Brand- und Explosionsgefahr durch Druckgasflaschen (z. B. Flüssiggas).", { quelle: "TRGS 510; DGUV Regel 110-010; BG BAU Bausteine A 063, A 064, A 065", "werte.unterpunkt": "brand" }], // Durchsicht Sifa 23.10.2026: DGUV Regel 110-010 statt DGUV Vorschrift 79
  ["B-055", "GEFAEHRDUNGEN", "Fehlende oder defekte persönliche Schutzausrüstung bzw. fehlende Kenntnis über deren Benutzung.", { quelle: "PSA-BV; BG ETEM" }],
  ["B-056", "GEFAEHRDUNGEN", "Arbeitsbedingte psychische Belastungen (z. B. Über-/Unterforderung, Stress, soziale Konflikte).", { quelle: "§ 5 Abs. 3 Nr. 6 ArbSchG; GDA; BG ETEM" }],
  ["B-057", "GEFAEHRDUNGEN", "Stolpern, Ausrutschen und Stürzen auf Böden und Verkehrswegen.", { quelle: "ASR A1.5; BGHW" }],
  ["B-058", "GEFAEHRDUNGEN", "Ungünstiges Raumklima (Kälte, Zugluft, Hitze).", { quelle: "ASR A3.5 Nr. 4.2 Tab. 1, Nr. 4.4", "werte.massnahme": zeile("Büro: Mindesttemperatur 20 °C; bei mehr als 26 °C Getränke und Trinkpausen anbieten.", "Bei leichter, sitzender Tätigkeit mindestens 20 °C; ab 26 °C sollen, ab 30 °C müssen Maßnahmen nach ASR A3.5 ergriffen werden (z. B. Getränke, Lockerung der Kleiderordnung); über 35 °C ist der Raum ohne solche Maßnahmen nicht als Arbeitsraum geeignet.") }],
  ["B-059", "GEFAEHRDUNGEN", "Unzureichende oder blendende Beleuchtung.", { quelle: "ASR A3.4 Anhang 3 Nr. 4.2, 24.1, 24.2; BGHW" }],
  ["B-060", "GEFAEHRDUNGEN", "Einseitige Körperhaltung bei Bildschirmarbeit.", { quelle: "ASR A6 Nr. 6.3.10; DGUV Information 215-410", "werte.massnahme": zeile("Höhenverstellbarer Schreibtisch (mind. 80 × 160 cm) mit ausreichender Beinfreiheit und ergonomischer Stuhl.", "Arbeitsfläche mindestens 160 × 80 cm (bei einem Bildschirm und wenig Papier 120 × 80 cm) mit ausreichender Beinfreiheit, ergonomischer Stuhl; höhenverstellbarer Tisch empfohlen.") }],
  ["B-061", "GEFAEHRDUNGEN", "Visuelle Belastung bei Bildschirmarbeit.", { quelle: "ASR A6; ArbMedVV Anhang Teil 4 Abs. 2 Nr. 1; BG ETEM" }],
  ["B-062", "GEFAEHRDUNGEN", "Absturz von Leitern und Tritten.", { quelle: "DGUV Information 208-016; BGHW" }],
  ["B-064", "GEFAEHRDUNGEN", "Elektrische Gefährdung durch beschädigte Geräte und Leitungen.", { quelle: "DGUV Vorschrift 3; BGHW" }],
  ["B-065", "GEFAEHRDUNGEN", "Umstürzende Regale und herabfallendes Lagergut.", { quelle: "DIN EN 15635; § 14 BetrSichV; BGHW", "werte.massnahme": zeile("Regale regelmäßig prüfen, Mängel sofort melden.", "Regale regelmäßig sichtprüfen und mindestens jährlich durch eine befähigte Person inspizieren lassen (DIN EN 15635); Mängel sofort melden.") }],
  ["B-066", "GEFAEHRDUNGEN", "Belastung durch Heben, Tragen, Ziehen und Schieben von Waren.", { quelle: "LasthandhabV; BGHW" }],
  ["B-069", "GEFAEHRDUNGEN", "Psychische Belastungen durch Arbeitsinhalt, Arbeitsorganisation oder soziale Beziehungen.", { quelle: "GDA-Leitlinie; BGHW" }],
  ["B-070", "GEFAEHRDUNGEN", "Brandentstehung und unzureichende Möglichkeiten zur Brandbekämpfung und Flucht.", { quelle: "ASR A2.2; BGHW A 131 (Stand 06/2022); § 22 Abs. 2 DGUV Vorschrift 1", "werte.unterpunkt": "brand" }],
  // passt für alle Branchen (Spalte „Begründung“): ohne Gruppe
  ["B-071", "GEFAEHRDUNGEN", "Unzureichende Erste Hilfe bei Unfällen.", { quelle: "§§ 24 Abs. 6, 26 Abs. 1, 3 DGUV Vorschrift 1", gruppe: null, "werte.unterpunkt": "notfall", "werte.massnahme": zeile("darüber in Verwaltungs- und Handelsbetrieben 5 %), alle zwei Jahre fortbilden.", "darüber in Verwaltungs- und Handelsbetrieben 5 %, in sonstigen Betrieben 10 %), in der Regel alle zwei Jahre fortbilden.") }],
  // ---- Unterweisungsthemen
  ["B-118", "UNTERWEISUNGSTHEMEN", "Gefährdungen am eigenen Arbeitsplatz und festgelegte Schutzmaßnahmen (Ergebnis der Gefährdungsbeurteilung)", { quelle: "§ 12 Abs. 1 ArbSchG; § 4 Abs. 1 DGUV Vorschrift 1" }],
  ["B-119", "UNTERWEISUNGSTHEMEN", "Erste Hilfe: Ersthelfer, Standort Verbandkasten, Notrufnummer, Dokumentation im Verbandbuch", { quelle: "§§ 24, 26 DGUV Vorschrift 1; ASR A4.3; BGHW A 131" }],
  ["B-120", "UNTERWEISUNGSTHEMEN", "Brandschutz: Verhalten im Brandfall, Umgang mit Feuerlöschern, Flucht- und Rettungswege", { quelle: "§ 22 Abs. 2 DGUV Vorschrift 1; ASR A2.2 Nr. 7" }],
  ["B-121", "UNTERWEISUNGSTHEMEN", "Stolper-, Rutsch- und Sturzgefahren; Ordnung und Sauberkeit auf Verkehrswegen", { quelle: "ASR A1.5; BGHW" }],
  ["B-122", "UNTERWEISUNGSTHEMEN", "Sichere Benutzung von Leitern und Tritten", { quelle: "DGUV Information 208-016" }],
  ["B-123", "UNTERWEISUNGSTHEMEN", "Elektrische Geräte: Sichtprüfung vor Benutzung, Mängel melden, defekte Geräte nicht benutzen", { quelle: "§ 4 Abs. 5 BetrSichV; DGUV Vorschrift 3" }],
  ["B-124", "UNTERWEISUNGSTHEMEN", "Gefahrstoffe: Inhalt der Betriebsanweisungen, Gefahren, Schutzmaßnahmen, Zugang zu Sicherheitsdatenblättern", { quelle: "§ 14 Abs. 2 GefStoffV", text: "Gefahrstoffe: Inhalt der Betriebsanweisungen, Gefahren, Schutzmaßnahmen, Zugang zu Sicherheitsdatenblättern – Unterweisung mündlich anhand der Betriebsanweisung, mit Unterschrift der Unterwiesenen (§ 14 Abs. 2 GefStoffV)" }],
  ["B-126", "UNTERWEISUNGSTHEMEN", "Persönliche Schutzausrüstung: Auswahl, Benutzung, Pflege", { quelle: "§ 3 PSA-BV; DGUV Regel 112-989" }],
  // „BG BAU“ passt nicht für Gastronomie und Büro: neutral gefasst
  ["B-127", "UNTERWEISUNGSTHEMEN", "Heben und Tragen: Hilfsmittel, rückengerechte Technik", { quelle: "LasthandhabV; Leitmerkmalmethode (BAuA)" }],
  ["B-128", "UNTERWEISUNGSTHEMEN", "Psychische Belastungen: Verhalten bei Konflikten, Aggression und Übergriffen, Unterstützungsangebote", { quelle: "§ 5 Abs. 3 Nr. 6 ArbSchG; BGW" }],
  ["B-130", "UNTERWEISUNGSTHEMEN", "Feuchtarbeit und Hautschutz im Salon (Hautschutz- und Händehygieneplan)", { quelle: "TRGS 401; TRGS 530; BGW" }],
  ["B-131", "UNTERWEISUNGSTHEMEN", "Infektionsschutz und Hygiene: Stich- und Schnittverletzungen, Umgang mit Blut, Instrumentenaufbereitung", { quelle: "BioStoffV; BGW" }],
  ["B-133", "UNTERWEISUNGSTHEMEN", "Fritteusen: Verbrühungsrisiko und Fettbrand, Löschen mit Brandklasse-F-Löscher", { quelle: "BGN ASI 2.15" }],
  ["B-134", "UNTERWEISUNGSTHEMEN", "Lärm: Gehörschutz ab 80/85 dB(A)", { quelle: "§ 8 LärmVibrationsArbSchV", text: "Lärm: Gehörschutz bereitstellen ab 80 dB(A), tragen ab 85 dB(A)" }],
  ["B-135", "UNTERWEISUNGSTHEMEN", "Staubarmes Arbeiten (Absaugung, Nassbearbeitung, Reinigung mit Industriesauger)", { quelle: "TRGS 559; TRGS 553; BG BAU" }],
  ["B-137", "UNTERWEISUNGSTHEMEN", "Bildschirmarbeit: Einstellung von Tisch, Stuhl und Bildschirm", { quelle: "ASR A6" }],
  // ---- Betriebsanweisung (TRGS 555 Nr. 3.1 Abs. 9: konkret mit „müssen / dürfen nicht“)
  ["B-157", "BA_BAUSTEINE", "Schutzhandschuhe bei den gekennzeichneten Tätigkeiten tragen.", { quelle: "TRGS 530 Nr. 5.4; TRGS 555 Nr. 3.1 Abs. 9", text: "Beim Mischen, Auftragen und Auswaschen Schutzhandschuhe (Typ und Material laut Hautschutzplan) tragen." }],
  ["B-159", "BA_BAUSTEINE", "Beschädigte Handschuhe sofort austauschen.", { quelle: "TRGS 401; BGW" }],
  ["B-160", "BA_BAUSTEINE", "Chemikalienschutzhandschuhe regelmäßig, spätestens arbeitstäglich wechseln; maximale Tragedauer beachten.", { quelle: "TRGS 401; TRGS 530 Nr. 5.4 Abs. 3", text: "Einmalhandschuhe nach jedem Gebrauch entsorgen; wiederverwendbare Chemikalienschutzhandschuhe nach Herstellerangabe (Tragedauer, Permeationszeit) wechseln." }],
  ["B-161", "BA_BAUSTEINE", "Bei ätzenden Stoffen Schutzbrille tragen.", { quelle: "TRGS 555; BGW 04-05-080, S. 21–22" }],
  ["B-163", "BA_BAUSTEINE", "Desinfektion im Wischverfahren durchführen; nicht sprühen oder vernebeln.", { quelle: "TRGS 525; BGW" }],
  ["B-164", "BA_BAUSTEINE", "Für ausreichende Lüftung sorgen; Sprühnebel, Stäube und Dämpfe nicht einatmen.", { quelle: "TRGS 530 Nr. 5.2; TRGS 555 Nr. 3.1 Abs. 9", text: "Lüftung (Fenster bzw. Abluft) während der Anwendung eingeschaltet lassen; Sprühnebel, Stäube und Dämpfe nicht einatmen." }],
  ["B-165", "BA_BAUSTEINE", "Am Arbeitsplatz nicht essen, trinken oder rauchen.", { quelle: "TRGS 500; TRGS 530" }],
  ["B-166", "BA_BAUSTEINE", "Gefahrstoffe möglichst in Originalbehältern aufbewahren; abgefüllte Stoffe korrekt beschriften; niemals in Lebensmittel- oder Getränkebehälter abfüllen.", { quelle: "§ 8 GefStoffV; TRGS 510" }],
  ["B-167", "BA_BAUSTEINE", "Gefahrstoffe getrennt von Lebensmitteln und nicht über Augenhöhe lagern.", { quelle: "TRGS 510" }],
  ["B-168", "BA_BAUSTEINE", "Am Arbeitsplatz höchstens den Tagesbedarf an entzündbaren Flüssigkeiten bereithalten.", { quelle: "TRGS 510" }],
  ["B-174", "BA_BAUSTEINE", "Nach Augenkontakt: mit viel Wasser spülen und ärztlichen Rat einholen.", { quelle: "TRGS 555 Nr. 3.2.7; Sicherheitsdatenblatt Abschnitt 4", text: "Nach Augenkontakt: Augen sofort bei geöffnetem Lidspalt mindestens 10 Minuten mit Wasser spülen (Augenspülflasche), dann Augenarzt." }],
  ["B-175", "BA_BAUSTEINE", "Nach Hautkontakt: mit viel Wasser spülen; bei Beschwerden ärztlichen Rat einholen.", { quelle: "TRGS 555 Nr. 3.2.7" }],
  ["B-176", "BA_BAUSTEINE", "Nach Einatmen: bei Beschwerden ärztlichen Rat einholen.", { quelle: "TRGS 555 Nr. 3.2.7", text: "Nach Einatmen: an die frische Luft; bei Beschwerden ärztlichen Rat einholen." }],
  ["B-177", "BA_BAUSTEINE", "Nach Verschlucken: ärztlichen Rat einholen.", { quelle: "TRGS 555 Nr. 3.2.7", text: "Nach Verschlucken: Mund ausspülen, kein Erbrechen herbeiführen, sofort ärztlichen Rat einholen bzw. Giftnotruf anrufen." }],
  ["B-178", "BA_BAUSTEINE", "Zum Arzt Gebrauchsanweisung oder Packung bzw. Behältnis des Produkts mitnehmen.", { quelle: "TRGS 555" }],
  ["B-179", "BA_BAUSTEINE", "Abfälle nur über die im Betrieb festgelegten Entsorgungswege entsorgen.", { quelle: "TRGS 555 Nr. 3.2.8" }],
  ["B-181", "BA_BAUSTEINE", "Nicht mehr benötigte Produkte fachgerecht entsorgen.", { quelle: "TRGS 555 Nr. 3.2.8" }],
  // ---- Hautschutzplan Friseur
  ["B-192", "HAUTSCHUTZ_FRISEUR", "Shampoonieren, Kopfmassage mit Haarbehandlungsmitteln, Pflegemittel auftragen/auswaschen", { quelle: "TRGS 401; TRGS 530", "werte.schutz": "Hände mit Hautschutzpräparat eincremen – unter Handschuhen nur ein laut Hersteller handschuhverträgliches Präparat, sonst Hautschutz in Phasen ohne Handschuhe" }],
  ["B-193", "HAUTSCHUTZ_FRISEUR", "Färben, Dauerwelle, Blondierung: Mischen, Auftragen, Überprüfen, Probewickeln, Fixieren", { quelle: "TRGS 530 Nr. 5.4; DIN EN ISO 374-6:2025-11" }],
  ["B-194", "HAUTSCHUTZ_FRISEUR", "Färben, Dauerwelle, Blondierung: Aufemulgieren, Auswaschen", { quelle: "TRGS 530; BGW" }],
  ["B-195", "HAUTSCHUTZ_FRISEUR", "Styling, Kopfmassage ohne Haarbehandlungsmittel", { quelle: "TRGS 530; BGW" }],
  ["B-196", "HAUTSCHUTZ_FRISEUR", "Reinigung und Desinfektion von Arbeitsgeräten und Räumen", { quelle: "TRGS 401; TRGS 530; BGW" }],
  ["B-197", "HAUTSCHUTZ_FRISEUR", "Lange Handschuhtragezeiten (alle Tätigkeiten)", { quelle: "TRGS 401; TRGS 530; BGW" }],
  // ---- Prüffristen DGUV V3: Blatt „A Kennzahlen“ – RCD-Prüftaste bestätigt, „unsicher“ entfällt
  ["Kennzahlen", "ELEKTRO_FRISTEN", "Fehlerstrom-, Differenzstrom- und Fehlerspannungs-Schutzschalter: Betätigen der Prüfeinrichtung durch den Benutzer: Richtwert stationäre Anlagen: 6 Monate; nichtstationäre Anlagen: arbeitstäglich", { unsicher: null, quelle: "DGUV Vorschrift 3, Durchführungsanweisung zu § 5, Tabelle 1A (Herstellerangaben können abweichen)" }],
];
for (const [nr, liste, schluessel, aenderungen] of SIFA) {
  const treffer = daten[liste === "BA_BAUSTEINE" ? "BA_BAUSTEINE" : liste];
  const kandidaten = liste === "BA_BAUSTEINE" ? Object.values(treffer).flat() : treffer;
  const gefunden = kandidaten.filter((x) => x.titel === schluessel || x.text === schluessel);
  if (gefunden.length !== 1) throw new Error(`Sifa ${nr}: ${liste} „${schluessel}“ ${gefunden.length}-mal gefunden`);
  const eintrag = gefunden[0];
  for (const [pfad, neu] of Object.entries(aenderungen)) {
    const teile = pfad.split(".");
    const ziel = teile.slice(0, -1).reduce((o, k) => o[k], eintrag);
    const feld = teile.at(-1);
    const alt = ziel[feld];
    if (neu === null) delete ziel[feld];
    else ziel[feld] = typeof neu === "function" ? neu(alt) : neu;
    if (ziel[feld] === alt) throw new Error(`Sifa ${nr} greift nicht: ${liste} „${schluessel}“ ${pfad}`);
  }
}
/**
 * Prüfbericht Lebensmittelhygiene (Lebensmittelfachbeauftragter, 22.10.2026, docs/pruefberichte/2026-10-22-lebensmittelhygiene.txt):
 * Tabelle „Grenzwerte je Kontrollpunkt“ und Änderungsliste – je Kontrollpunkt ein Wert, Quellen aus der Tabelle. Je
 * Eintrag die Nummer der Prüfmappe (L-…). Pfade wie bei SIFA; jede Änderung muss greifen. Nicht genannte Kontrollpunkte
 * (✔ ohne Änderung) bleiben unverändert.
 */
const LAVES = "LAVES Niedersachsen, Merkblatt Lagertemperaturen 08/2022 (DIN 10508:2019)";
const LM_HYG = [
  ["L-057", "Kühllagerung allgemein – Temperaturkontrolle Kühleinrichtungen", { "werte.grenzwert": "Kühlschrank höchstens +7 °C", quelle: `BgVV 1999; ${LAVES}; Lebensmittelüberwachung Mainz` }],
  ["L-060", "Kühlung Hackfleisch", { "werte.grenzwert": "zugekauft bzw. vorverpackt: max. +2 °C", quelle: "Tier-LMHV Anlage 5 Kap. II Nr. 3.3.1; LAVES Niedersachsen; Lebensmittelüberwachung Mainz" }],
  ["L-062", "Kühlung Geflügelfleisch (auch Federwild, Kleinwild/Hasen)", { "werte.grenzwert": "max. +4 °C", quelle: "VO (EG) Nr. 853/2004 Anhang III Abschn. II Kap. V Nr. 3; LAVES Niedersachsen; Lebensmittelüberwachung Mainz" }],
  ["L-067", "Kühlung Eiprodukte / roheihaltige Lebensmittel", { "werte.grenzwert": "max. +4 °C; roheihaltige Speisen innerhalb von 24 Stunden verbrauchen", quelle: `${LAVES}; Verbrauch binnen 24 Stunden: BgVV 1999` }],
  ["L-069", "Tiefkühlung (Tiefkühltruhe/-raum, tiefgefrorene Lebensmittel)", { "werte.grenzwert": "−18 °C oder kälter; kurzfristiger Anstieg um höchstens 3 K beim Transport oder Abtauen", quelle: "VO (EG) Nr. 37/2005; TLMV; LAVES Niedersachsen; Lebensmittelüberwachung Mainz" }],
  ["L-071", "Heißhalten / Ausgabetemperatur warmer Speisen", {
    "werte.grenzwert": "mindestens +60 °C an allen Stellen, höchstens 3 Stunden",
    "werte.haeufigkeit": "bei Beginn der Ausgabe und danach alle 2 Stunden",
    "werte.korrektur": "Zu kalte warme Speisen auf mindestens +72 °C Kerntemperatur nacherhitzen, nur einmal; sonst verwerfen; dokumentieren.",
    quelle: "BfR-Stellungnahme 037/2020; BfR, Presseinformation 13/2024; LAVES Niedersachsen 08/2022; DIN 10508:2019 (+65 °C als Praxiszuschlag, Kreis Paderborn 2026)",
  }],
  ["L-072", "Ausgabetemperatur Kaltspeisen und Salate", { "werte.korrektur": "Kaltspeisen höchstens 2 Stunden ungekühlt ausgeben, danach entsorgen; Produkttemperatur bei der Kontrolle über +7 °C: entsorgen; dokumentieren.", quelle: "Lebensmittelüberwachung Mainz; BgVV 1999 Abschnitt 4; DEHOGA-Leitlinie" }],
  ["L-073", "Abkühlen heißer Speisen", { quelle: "BgVV, Temperaturanforderungen und -empfehlungen für Lebensmittel (1999), Abschnitt 4" }],
  ["L-074", "Wareneingangskontrolle", {
    "werte.grenzwert": "Temperatur bei Anlieferung (Messung): Tiefkühlware −18 °C oder kälter (kurzfristiger Anstieg um höchstens 3 K); Fleisch/Fleischerzeugnisse +7 °C; Geflügel +4 °C; Hackfleisch +2 °C; Fleischzubereitungen +4 °C; Fisch +2 °C; Konsummilch +8 °C; Milcherzeugnisse +10 °C. Sichtkontrolle: keine Verunreinigungen, einwandfreie Verpackung, einwandfreier Geruch, gültiges MHD, Beschaffenheit des Lieferfahrzeugs, Kennzeichnung",
    quelle: "Werte wie die Kontrollpunkte der Kühlung (VO (EG) Nr. 853/2004; Tier-LMHV Anlage 5; BgVV 1999; LAVES Niedersachsen); Lebensmittelüberwachung Mainz (Formular Wareneingangskontrolle, Merkblatt)",
  }],
  ["L-075", "Frittierfett – polare Anteile", { "werte.grenzwert": "Eingriffswert 20 % polare Anteile: Fett wechseln (Grenze der Genusstauglichkeit 24 %); Frittiertemperatur mind. +160 °C, max. +175 °C", quelle: "DGF-Empfehlung; ALS (24 % polare Anteile); BGN-Leitlinie ortsveränderliche Betriebsstätten 2018; zvl.jena.de" }],
  ["L-077", "Schädlingsmonitoring", { "werte.haeufigkeit": "regelmäßige vorbeugende Sichtkontrollen, mindestens einmal im Monat, dokumentiert" }],
];
for (const [nr, schluessel, aenderungen] of LM_HYG) {
  const gefunden = daten.HACCP.filter((x) => x.titel === schluessel);
  if (gefunden.length !== 1) throw new Error(`Lebensmittel ${nr}: HACCP „${schluessel}“ ${gefunden.length}-mal gefunden`);
  for (const [pfad, neu] of Object.entries(aenderungen)) {
    const teile = pfad.split(".");
    const ziel = teile.slice(0, -1).reduce((o, k) => o[k], gefunden[0]);
    const feld = teile.at(-1);
    const alt = ziel[feld];
    ziel[feld] = neu;
    if (ziel[feld] === alt) throw new Error(`Lebensmittel ${nr} greift nicht: HACCP „${schluessel}“ ${pfad}`);
  }
}
/**
 * Nachkontrolle Lebensmittelfachbeauftragter (23.10.2026, Hinweis 1): Fundstellen getrennt – zugekauft (+2 °C) Tier-LMHV Anlage 5 Kap. II
 * Nr. 3.3.1, eigene Herstellung (+7 °C) Nr. 3.1.3 (Prüfmappe v3: L-061, L-062).
 */
/** L-060: ein Wert je Zeile – der Wert für selbst hergestelltes Hackfleisch als eigene Zeile direkt dahinter. */
{
  const i = daten.HACCP.findIndex((x) => x.titel === "Kühlung Hackfleisch");
  const titel = "Kühlung Hackfleisch – nur bei eigener Herstellung";
  daten.HACCP.splice(i + 1, 0, { titel, werte: { ...daten.HACCP[i].werte, punkt: titel, grenzwert: "selbst hergestellt, lose abgegeben: max. +7 °C Umgebung; Abgabe am Tag der Herstellung" }, quelle: "Tier-LMHV Anlage 5 Kap. II Nr. 3.1.3; LAVES Niedersachsen" });
}
/**
 * E-167, B-036 (Prüfstand „bestätigt“): Fettbrand nach Fettmenge getrennt (BGN ASI 2.15 Nr. 4) – bis 50 l, 50 bis 100 l,
 * über 100 l. Der bisherige Vorschlag vermischte die Stufen („geübte Person“ gilt erst ab 50 l). Drei Vorschläge statt
 * einem; gespeicherte Gefährdungsbeurteilungen behalten ihren übernommenen Text.
 */
{
  const i = daten.GEFAEHRDUNGEN.findIndex((x) => x.titel === "Fettbrand und Fettexplosion an Fritteusen durch Überhitzung oder Wassereintrag.");
  if (i < 0) throw new Error("Sifa B-036: Fettbrand nicht gefunden");
  const alt = daten.GEFAEHRDUNGEN[i];
  const grund = "Abstand bzw. Abtrennung zu wasserführenden Geräten; keine Wasserzapfstelle in der Nähe.\nFritteusen nie unbeaufsichtigt betreiben; Fett rechtzeitig wechseln.";
  const loescher = "Fettbrandlöscher der Brandklasse F bereitstellen; Löschvermögen mindestens Fettmenge plus 25 % Reserve (z. B. 20 l Fett → 25 F).";
  const stufe = (menge, massnahmen) => {
    const titel = `Fettbrand und Fettexplosion an Fritteusen durch Überhitzung oder Wassereintrag (${menge}).`;
    return { ...alt, titel, werte: { ...alt.werte, beschreibung: titel, unterpunkt: "brand", schwere: "schwer", massnahme: `${grund}\n${massnahmen}` }, quelle: "BGN ASI 2.15 Nr. 4; DGUV Regel 110-003, Abschn. 3.3.1" };
  };
  daten.GEFAEHRDUNGEN.splice(i, 1,
    stufe("Fettmenge bis 50 l", loescher),
    stufe("Fettmenge 50 bis 100 l", `${loescher}\nZusätzlich eine benannte, im Löschen geübte Person und ständige Beobachtung der Fritteuse – oder eine ortsfeste Löscheinrichtung.`),
    stufe("Fettmenge über 100 l", "Ortsfeste Löscheinrichtung (Fettbrand-Löschanlage) vorsehen."),
  );
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
 * Fachliche Durchsicht Arbeitsschutz vom 22.10.2026 eingearbeitet (E-167, Zuordnung in sifa.ts); Abnahme: PRUEFLISTE T-62.
 * Grenzwerte der Kontrollpunkte nach dem Prüfbericht Lebensmittelhygiene vom 22.10.2026 (LM_HYG im Skript).
 */
import type { Option, Vorschlag } from "./typen.js";
`;
const rumpf = Object.entries(daten).map(([k, v]) => `export const ${k}: ${typen[k]} = ${JSON.stringify(v, null, 1)};`).join("\n\n");
fs.writeFileSync(path.join(hier, "../src/dokumente/bausteine.ts"), `${kopf}\n${rumpf}\n`);
console.log(`✓ bausteine.ts: ${daten.GEFAEHRDUNGEN.length} Gefährdungen (${SIFA.length} Korrekturen der Sifa-Durchsicht), ${vvt.length} Verarbeitungen, ${tom.length} TOM, ${Object.keys(dse).length} DSE-Bausteine, ${daten.HACCP.length} HACCP-Punkte, ${hygiene.length} Hygiene-Zeilen`);
