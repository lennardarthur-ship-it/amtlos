/**
 * Jahres-Szenario „Physiotherapie am Markt – Tom Reiter“ 2026 (Leipzig, freier Beruf, Heilbehandlungen steuerfrei nach
 * § 4 Nr. 14 UStG plus steuerpflichtige Umsätze, teilweiser Vorsteuerabzug, zwei Beschäftigte) – der App-Ablauf: Der
 * Stand entsteht mit denselben Funktionen wie in der App (anlegen → felderSetzen → ausgeben/festschreiben → stornieren,
 * bezahltSetzen, belegSetzen, E-Rechnung einlesen, umsaetzeFuer, euerUebernahme, steuerpaket, auswertung, mappenAuswahl).
 * Rohdaten und die unabhängig gerechneten Erwartungswerte stehen in jahr-szenario-praxis-daten.ts; hier wird nur
 * verglichen und jede Abweichung als Auffälligkeit gesammelt.
 *
 * Gebündelt und ausgeführt von werkzeuge/jahr-szenario-praxis.mjs (Chromium für die PDFs). Aufbau wie die Szenarien
 * Café, Salon und Freiberuflerin, deren Dateien unverändert bleiben.
 */
import {
  EUER_ZEILE_STEUERFREI,
  EUER_ZEILE_STEUERPFLICHTIG,
  KU_HINWEIS,
  RAENDER,
  VORLAGEN,
  belegAusERechnung,
  belegSummen,
  cent,
  dokumentHtml,
  eRechnungAus,
  eRechnungLesen,
  eintragAusVorschlag,
  fehlendeAngaben,
  kategorieFuer,
  neuerEintrag,
  pdfDateiname,
  personIn,
  summen,
  vorlageFuer,
  xrechnungUbl,
  type Beleg,
  type Daten,
  type Eintrag,
  type Feld,
  type Vorlage,
} from "@amtlos/fachlogik";
import { unzipSync } from "fflate";
import { LEERER_STAND, anlegen, ausgeben, belegSetzen, bezahltSetzen, felderSetzen, personSetzen, profilSetzen, steuerberatungSetzen, stornieren, type Stand, type Unterlage } from "../src/unterlagen/speicher";
import { euerUebernahme, steuerpaket, type PaketErgebnis, type Zeitraum } from "../src/unterlagen/steuerpaket";
import { gemischteUmsaetze, nurSteuerfreieUmsaetze, umsaetzeFuer, vorsteuerquoteAus } from "../src/unterlagen/ustAusRechnungen";
import { fussAngaben, fusszeileStempeln } from "../src/unterlagen/fusszeile";
import { mitSchriften } from "../src/unterlagen/schriften";
import { deckblattHtml, mappeDateiname, mappeZusammenfuegen, mappenAuswahl, seitenzahl, startSeiten } from "../src/unterlagen/kontrollmappe";
import { auswertung, type Profil } from "../src/pflichten/check";
import * as D from "./jahr-szenario-praxis-daten";
import { MARKE } from "@amtlos/marke";

export { RAENDER, fussAngaben, fusszeileStempeln, mitSchriften, unzipSync, D, deckblattHtml, mappeDateiname, mappeZusammenfuegen, seitenzahl, startSeiten };

const t = (iso: string, h = 10) => new Date(`${iso}T${String(h).padStart(2, "0")}:00:00+01:00`);
const menge = (n: number) => String(n).replace(".", ",");
const euro = (c: number) => D.eur(c);
/** formatierte Euro-Angabe der App („1.234,56 €“) → Cent */
const ausEuro = (s: string) => cent(s.replace(/[€\s\u00a0]/g, "")) ?? 0;
const summe = (l: number[]) => l.reduce((a, b) => a + b, 0);
/** sichtbarer Text eines Dokuments: ohne <head>, ohne Tags, geschützte Leerzeichen als Leerzeichen */
const sichtbar = (h: string) => h.replace(/<head>[\s\S]*?<\/head>/, "").replace(/<footer class="fussleiste">[\s\S]*?<\/footer>/, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;|[\u00a0\u202f]/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

export interface Dok {
  nr: number;
  uid: string;
  vorlage: string;
  titel: string;
  datum: string;
  datei: string;
  ordner: "pdf" | "rechnungen";
  quer: boolean;
  worum: string;
  fehlt: string[];
}

export interface PflichtZeile { id: string; titel: string; vorlage: string | null; erzeugt: boolean; grund: string; termin: string | null; schwere: string }

export interface UstZeile { q: string; app: Record<string, string>; anzahl: number; offen: number; vorsteuerBelege: number; ohneVorsteuer: number; formular: [string, string][]; vstStandard: string }

export interface Bau {
  s: Stand;
  docs: Dok[];
  auffaellig: string[];
  infos: string[];
  belegDateien: { datei: string; html?: string; xml?: string }[];
  xmls: { datei: string; xml: string; nummer: string }[];
  ohneXml: { nummer: string; fehlt: string[] }[];
  vergleiche: { bereich: string; was: string; app: string; erwartet: string; ok: boolean }[];
  ust: UstZeile[];
  euer: { uebernahme: ReturnType<typeof euerUebernahme>; final: Daten; ergebnis: [string, string][] };
  uebersprungen: { id: string; titel: string; grund: string }[];
  pflichten: { gilt: PflichtZeile[]; gruendung: PflichtZeile[]; unbekannt: { id: string; titel: string; fragen: string[] }[]; varianten: { name: string; nurHier: string[]; fehltHier: string[] }[]; jahresende: PflichtZeile[] };
  profil: Profil;
  mappe: { eintraege: { id: string; titel: string; vorlage: string; datum: string; bereich: string }[]; unvollstaendig: number; fehlen: string[] };
}

/** Profil der Pflichten-Check-Antworten (wie in der App gegeben) */
export const PROFIL: Profil = {
  "taetigkeit.branchen": ["gesundheit_pflege"],
  rechtsform: "freiberuf",
  // seit r9 für alle Rechtsformen gefragt (AWV-Meldung, Investitionsprüfung)
  "gesellschafter.auslaendische_investoren": false,
  "taetigkeit.einordnung": "freiberuf",
  bundesland: "SN",
  "beschaeftigte.gesamt": 2,
  "beschaeftigte.minijob": 1,
  "beschaeftigte.azubi": 0,
  "beschaeftigte.jugendlich": 0,
  "kasse.elektronisch": false,
  "online.website": true,
  "ust.kleinunternehmer": false,
  steuerberater: true,
  gruendungsdatum: D.GRUENDUNG,
  erwerb: "haupt",
  // beschäftigt eine versicherungspflichtige Physiotherapeutin → keine RV-Pflicht als selbstständige „Pflegeperson“ (§ 2 Nr. 2 SGB VI)
  "rentenversicherung.pflichtgruppe": ["keine"],
  "erlaubnis.gewo_paragraphen": ["keine"],
  "handwerk.anlage": "keine",
  "betriebsstaetten.anzahl": 1,
  "umsatz.vorjahr": D.UMSATZ_VORJAHR,
  "umsatz.prognose_laufendes_jahr": D.UMSATZ_PROGNOSE,
  "gewinn.vorjahr": 98000,
  "gewinn.prognose_laufendes_jahr": 102000,
  "ust.zahllast_vorjahr": D.ZAHLLAST_VORJAHR,
  "ust.dauerfristverlaengerung": false,
  "vorauszahlung.est_kst": true,
  "vorauszahlung.gewst": false,
  "kunden.segmente": ["b2c", "b2b"],
  "kunden.regionen": ["inland"],
  "vertrieb.kanaele": ["keine_direktvertrieb"],
  "produkte.arten": ["dienstleistung", "physisch"],
  "handel.hohe_bargeschaefte": false,
  "personal.sofortmeldebranchen": ["keine"],
  "personal.lohnsteuer_anmeldezeitraum": "quartalsweise",
  "arbeitsschutz.elektrische_geraete": true,
  "arbeitsschutz.gefahrstoffe": true,
  "datenverarbeitung.arten": ["kundendaten", "beschaeftigtendaten", "gesundheitsdaten"],
  "datenschutz.dienstleister": true,
  "ki.nutzung": false,
  "ki.eigene_produkte": false,
  "nis2.betroffen": "nein",
};

export function standBauen(): Bau {
  const auffaellig: string[] = [];
  const infos: string[] = [];
  const vergleiche: Bau["vergleiche"] = [];
  const vergleich = (bereich: string, was: string, app: number, erwartet: number, toleranz = 0) => {
    const ok = Math.abs(app - erwartet) <= toleranz;
    vergleiche.push({ bereich, was, app: euro(app), erwartet: euro(erwartet), ok });
    if (!ok) auffaellig.push(`${bereich} – ${was}: App ${euro(app)} €, unabhängig gerechnet ${euro(erwartet)} € (Differenz ${euro(app - erwartet)} €).`);
    return ok;
  };
  const vergleichText = (bereich: string, was: string, app: string, erwartet: string) => {
    const ok = app === erwartet;
    vergleiche.push({ bereich, was, app, erwartet, ok });
    if (!ok) auffaellig.push(`${bereich} – ${was}: App „${app}“, erwartet „${erwartet}“.`);
    return ok;
  };

  // ---------------------------------------------------------------- Betrieb, Profil, Personen
  let s: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, ...D.BETRIEB }, proTest: true };
  s = profilSetzen(s, PROFIL);
  s = steuerberatungSetzen(s, { kontenrahmen: "SKR03", beraternummer: "52114", mandantennummer: "30871" });
  for (const [id, k] of Object.entries(D.KUNDEN)) s = personSetzen(s, "kunde", { id, name: k.name, anschrift: k.anschrift, ...("email" in k ? { email: k.email } : {}) } as never, t("2026-01-02"));
  for (const [id, m] of Object.entries(D.MITARBEITER)) s = personSetzen(s, "mitarbeiter", { id, ...m } as never, t("2026-01-02"));

  const docs: Dok[] = [];
  const uebersprungen: Bau["uebersprungen"] = [];
  let nr = 0;
  const v = (id: string) => vorlageFuer(id)!;
  const feld = (vid: string, fid: string) => v(vid).abschnitte.flatMap((a) => a.felder).find((f) => f.id === fid) as Extract<Feld, { art: "liste" }>;
  const eintraege = (vid: string, fid: string, l: Eintrag[], heute: string) => l.map((e) => ({ ...neuerEintrag(feld(vid, fid), s.betrieb, heute), ...e }));
  const vorschlag = (vid: string, fid: string, titel: string, heute: string, extra: Eintrag = {}) => {
    const f = feld(vid, fid);
    const vs = (f.vorschlaege ?? []).find((x) => x.titel.startsWith(titel)) ?? (f.vorschlaege ?? []).find((x) => x.titel.includes(titel));
    if (!vs) throw new Error(`Vorschlag „${titel}“ in ${vid}.${fid} nicht gefunden`);
    return { ...eintragAusVorschlag(f, vs, s.betrieb, heute), ...extra };
  };
  const unterlage = (id: string) => s.unterlagen.find((u) => u.id === id)!;

  function dok(o: { id: string; vorlage: string; datum: string; worum: string; daten: (heute: string) => Daten; danach?: (u: Unterlage) => void; ordner?: Dok["ordner"]; titel?: string }) {
    const [s1] = anlegen(s, o.vorlage, t(o.datum, 9), o.id);
    s = felderSetzen(s1, o.id, o.daten(o.datum), t(o.datum, 9));
    o.danach?.(unterlage(o.id));
    s = ausgeben(s, o.id, t(o.datum, 12));
    const u = unterlage(o.id);
    const vl = v(o.vorlage);
    const fehlt = fehlendeAngaben(vl, u.daten, s.betrieb);
    nr++;
    docs.push({ nr, uid: o.id, vorlage: o.vorlage, titel: o.titel ?? vl.titel, datum: o.datum, datei: `${String(nr).padStart(2, "0")}-${pdfDateiname(vl, u.daten, o.datum)}`, ordner: o.ordner ?? "pdf", quer: !!vl.querformat, worum: o.worum, fehlt });
    if (fehlt.length) infos.push(`${vl.titel} (${o.id}): App meldet „Fehlt noch“: ${fehlt.join("; ")}`);
    return u;
  }

  // ---------------------------------------------------------------- Ausgangsrechnungen
  const ereignisse: { nummer: string; los: () => void }[] = [];
  for (const r of D.RECHNUNGEN) {
    ereignisse.push({
      nummer: r.nummer,
      los: () => {
        const k = D.KUNDEN[r.kunde];
        const kunde = s.kunden.find((x) => x.id === r.kunde)!;
        const frei = r.pos.some((x) => x.satz === 0);
        const u = dok({
          id: r.id, vorlage: "rechnung", datum: r.datum, worum: r.worum, ordner: "rechnungen", titel: "Rechnung",
          daten: () => ({
            ...personIn(v("rechnung"), kunde),
            datum: r.datum,
            leistung_gleich: !r.leistung && !r.leistungText,
            leistung: r.leistungText ?? (r.leistung ? D.de(r.leistung) : ""),
            zahlungsziel: r.ziel,
            ...("anrede" in k ? { anrede: k.anrede } : {}),
            positionen: r.pos.map((x) => ({ bezeichnung: x.bez, menge: menge(x.menge), einheit: x.einheit, preis: euro(x.preis), satz: String(x.satz) })),
            // wie eine Inhaberin es tun würde: den Befreiungshinweis bei jeder Rechnung mit steuerfreien Positionen eintragen
            ...(frei ? { befreiung: D.BEFREIUNG } : {}),
            hinweis: r.hinweis,
          }),
          danach: (x) => {
            vergleichText(`Rechnung ${r.nummer}`, "Schalter „Kleinunternehmer“ aus dem Profil (nein)", x.daten.kleinunternehmer === true ? "ja" : "nein", "nein");
            const pr = v("rechnung").pruefen?.(x.daten, s.betrieb) ?? [];
            if (pr.length) infos.push(`Rechnung ${r.nummer}: Prüfhinweise der App: ${pr.join(" | ")}`);
          },
        });
        if (u.daten.nummer !== r.nummer) auffaellig.push(`Rechnungsnummer: erwartet ${r.nummer}, App vergab ${String(u.daten.nummer)}.`);
        if (!u.festgeschrieben) auffaellig.push(`Rechnung ${r.nummer} ist nach dem Teilen nicht festgeschrieben.`);
        if (r.bezahlt) s = bezahltSetzen(s, r.id, r.bezahlt, t(r.bezahlt, 15));
      },
    });
    if (r.storno) {
      const st = r.storno;
      ereignisse.push({
        nummer: st.nummer,
        los: () => {
          const [s1, neu] = stornieren(s, r.id, t(st.datum, 9), st.id);
          if (!neu) {
            auffaellig.push(`Storno von ${r.nummer} nicht möglich (stornieren lieferte null).`);
            return;
          }
          s = s1;
          if (neu.daten.nummer !== st.nummer) auffaellig.push(`Stornonummer: erwartet ${st.nummer}, App vergab ${String(neu.daten.nummer)}.`);
          s = felderSetzen(s, st.id, { hinweis: `Grund: ${st.grund}.` }, t(st.datum, 9));
          s = ausgeben(s, st.id, t(st.datum, 10));
          const u = unterlage(st.id);
          const vl = v("rechnung");
          nr++;
          docs.push({ nr, uid: st.id, vorlage: "rechnung", titel: "Stornorechnung", datum: st.datum, datei: `${String(nr).padStart(2, "0")}-${pdfDateiname(vl, u.daten, st.datum)}`, ordner: "rechnungen", quer: false, worum: `Stornorechnung zu ${r.nummer}: ${st.grund}.`, fehlt: fehlendeAngaben(vl, u.daten, s.betrieb) });
        },
      });
    }
  }
  for (const e of ereignisse.sort((a, b) => a.nummer.localeCompare(b.nummer))) e.los();

  // Summen je Rechnung, E-Rechnungen
  const xmls: Bau["xmls"] = [];
  const ohneXml: Bau["ohneXml"] = [];
  for (const x of D.vorgaenge()) {
    const u = s.unterlagen.find((y) => y.vorlage === "rechnung" && y.daten.nummer === x.nummer);
    if (!u) {
      auffaellig.push(`Rechnung ${x.nummer} fehlt im Stand.`);
      continue;
    }
    const { daten, fehlt } = eRechnungAus(u.daten, s.betrieb);
    const sm = summen(daten.positionen, daten.kleinunternehmer);
    const bereich = `Rechnung ${x.nummer}`;
    vergleich(bereich, "Netto", sm.netto_cent, x.s.netto);
    vergleich(bereich, "davon steuerfrei (0 %)", summe(sm.gruppen.filter((g) => g.satz === 0).map((g) => g.netto_cent)), x.s.frei);
    vergleich(bereich, "Umsatzsteuer 19 %", sm.ust_cent, x.s.ust);
    vergleich(bereich, "Rechnungsbetrag", sm.brutto_cent, x.s.brutto);
    vergleichText(bereich, "Steuerart der E-Rechnungs-Daten", daten.steuerart ?? "–", x.s.frei ? "befreit" : "standard");
    const erg = v("rechnung").ergebnis!(u.daten);
    vergleich(bereich, "Rechnungsbetrag laut Formular", ausEuro(erg.find((z) => z[0] === "Rechnungsbetrag")![1]), x.vz * x.s.brutto);
    if (fehlt.length) {
      ohneXml.push({ nummer: x.nummer, fehlt });
      continue;
    }
    const xml = xrechnungUbl(daten, KU_HINWEIS);
    xmls.push({ datei: `E-Rechnung-${daten.nummer.replace(/[^A-Za-z0-9-]+/g, "-")}.xml`, xml, nummer: x.nummer });
    const zahlbar = /<cbc:PayableAmount[^>]*>([-\d.]+)</.exec(xml)?.[1];
    vergleich(`E-Rechnung ${x.nummer}`, "PayableAmount (BT-115)", Math.round(Number(zahlbar) * 100), x.vz * x.s.brutto);
    const kategorien = [...new Set([...xml.matchAll(/<cac:(?:Classified)?TaxCategory>\s*<cbc:ID>([A-Z]+)<\/cbc:ID>\s*<cbc:Percent>([\d.]+)</g)].map((m) => `${m[1]} ${m[2]}`))].sort();
    const erwartet = [...(x.s.frei ? ["E 0"] : []), ...(x.s.pflichtig ? ["S 19"] : [])].sort();
    vergleichText(`E-Rechnung ${x.nummer}`, "Steuerkategorien (S 19 / E 0 – befreit)", kategorien.join(", "), erwartet.join(", "));
    if (x.s.frei) {
      const grund = /<cbc:TaxExemptionReason>([^<]*)</.exec(xml)?.[1] ?? "–";
      vergleichText(`E-Rechnung ${x.nummer}`, "Befreiungsgrund (BT-120) = Hinweis der Rechnung", grund, D.BEFREIUNG);
      vergleichText(`E-Rechnung ${x.nummer}`, "Befreiungsgrund-Code (BT-121) gesetzt", /<cbc:TaxExemptionReasonCode>/.test(xml) ? "ja" : "nein", "nein");
    }
  }
  const ohneErwartet = D.RECHNUNGEN.filter((r) => D.KUNDE_ART[r.kunde] === "privat").map((r) => r.nummer);
  infos.push(`Ohne XRechnung (App: Angaben fehlen): ${ohneXml.map((o) => `${o.nummer} (${o.fehlt.join(", ")})`).join("; ") || "keine"}. Erwartet: Privatpatientinnen und -patienten ohne E-Mail (${ohneErwartet.join(", ")}) – für sie ist keine E-Rechnung nötig.`);
  {
    const ohneNr = ohneXml.map((o) => o.nummer).sort().join(",");
    vergleichText("E-Rechnung", "Rechnungen ohne XRechnung = genau die an Privatpersonen", ohneNr, ohneErwartet.sort().join(","));
  }

  // ---------------------------------------------------------------- Belege (Vorsteuer nur bei rein steuerpflichtiger Verwendung)
  const belegDateien: Bau["belegDateien"] = [];
  for (const b of D.BELEGE) {
    const jetzt = t(b.datum, 18).toISOString();
    // E-165 (StB-Prüfung 5.2): gemischt genutzte Belege mit Vorsteuer-Teilabzug (vorläufige Quote 13 %, § 15 Abs. 4 UStG);
    // rein steuerfrei genutzte ohne Vorsteuer, rein steuerpflichtig genutzte voll
    const vst = b.zuordnung === "pflichtig" || b.zuordnung === "gemischt";
    const anteil = b.zuordnung === "gemischt" ? { vorsteuer_anteil: D.QUOTE_VORLAEUFIG } : {};
    if (b.datei === "xml") {
      const xml = xrechnungUbl(
        {
          nummer: b.nummer!, rechnungsdatum: b.datum, leistungsdatum: b.datum, faellig_am: "2026-02-19",
          steller: { name: b.lieferant, strasse: "Großenhainer Straße 99", plz: "01127", ort: "Dresden", land: "DE", email: "rechnung@medizintechnik-elbe.example", telefon: "0351 8402260", steuernummer: "203/118/40221", ust_idnr: "DE281904437", iban: D.LIEFERANT_IBAN, bic: "OSDDDE81XXX" },
          kunde: { name: D.BETRIEB.name, strasse: D.BETRIEB.strasse, plz: D.BETRIEB.plz, ort: D.BETRIEB.ort, land: "DE", email: D.BETRIEB.email, kaeufer_referenz: "Kd.-Nr. 40-1177", geschaeftskunde: true },
          positionen: D.ERECHNUNG_POS.map((x) => ({ bezeichnung: x.bez, menge: x.menge, einheit: "stueck", einheit_code: x.einheit === "Pauschale" ? "LS" : "C62", preis_cent: x.preis, ust_satz: x.satz })),
          kleinunternehmer: false,
          hinweis: "Zahlbar bis 19.02.2026 ohne Abzug. Einweisung erfolgt am Liefertag.",
        },
        KU_HINWEIS,
      );
      const gelesen = eRechnungLesen(xml);
      if (!gelesen) {
        auffaellig.push(`E-Rechnung ${b.nummer} ließ sich nicht lesen (eRechnungLesen → null).`);
        continue;
      }
      // wie die App (seiten/Belege.tsx): bei nur steuerfreien Umsätzen startet der Vorsteuer-Schalter „aus“, bei gemischten
      // Umsätzen anteilig mit der Vorsteuerquote aus „Mein Betrieb“ (StB-Prüfung 5.2, E-165)
      const roh = belegAusERechnung(gelesen, b.id, jetzt, { kleinunternehmer: false, nurSteuerfrei: nurSteuerfreieUmsaetze(s.unterlagen, s.betrieb), gemischt: gemischteUmsaetze(s.unterlagen, s.betrieb), vorsteuerquote: vorsteuerquoteAus(s.betrieb) });
      const vstText = (x: Beleg) => (!x.vorsteuer ? "aus" : x.vorsteuer_anteil ? `anteilig ${x.vorsteuer_anteil} %` : x.vorsteuer_betrag_cent ? `anteilig ${euro(x.vorsteuer_betrag_cent)} €` : "voll");
      infos.push(`E-Rechnung ${b.nummer} eingelesen: Lieferant „${roh.lieferant}“, Kategorie zunächst „${kategorieFuer(roh.kategorie).titel}“, Vorsteuer ${vstText(roh)} – für ein Gerät, das nur der steuerfreien Heilbehandlung dient, von Hand auf „Anschaffung über 800 €“ und Vorsteuer aus gestellt. Notiz: ${(roh.notiz ?? "").replace(/\n/g, " | ")}`);
      // Praxis mit steuerfreien UND steuerpflichtigen Umsätzen: nicht „voll“, sondern der vorläufige Anteil aus „Mein Betrieb“ zum Prüfen
      vergleichText("E-Rechnung einlesen", `${b.nummer}: Vorsteuer nach dem Einlesen (gemischte Umsätze, Vorsteuerquote ${D.BETRIEB.vorsteuerquote} % in „Mein Betrieb“ → anteilig vorbelegt, nicht voll; § 15 Abs. 4 UStG)`, vstText(roh), `anteilig ${D.QUOTE_VORLAEUFIG} %`);
      vergleichText("E-Rechnung einlesen", `${b.nummer}: Hinweis im Beleg, den Anteil zu prüfen`, /Vorsteuerquote aus „Mein Betrieb“/.test(roh.notiz ?? "") ? "ja" : "nein", "ja");
      s = belegSetzen(s, { ...roh, kategorie: b.kategorie, vorsteuer: vst, vorsteuer_anteil: null, ...anteil, bezahlt: b.bezahlt, datei: `${b.id}.xml` }, t(b.datum, 18));
      belegDateien.push({ datei: `${b.id}.xml`, xml });
    } else {
      const sm = D.belegSumme(b);
      const beleg: Beleg = {
        id: b.id, datum: b.datum, lieferant: b.lieferant, nummer: b.nummer, kategorie: b.kategorie,
        steuer: sm.jeSatz.map((x) => ({ satz: x.satz, brutto_cent: x.brutto })),
        vorsteuer: vst, ...anteil, zahlung: b.zahlung, bezahlt: b.bezahlt, notiz: b.notiz ?? null, datei: `${b.id}.pdf`, quelle: "foto", erstellt: jetzt, geaendert: jetzt,
        // R10: CloudOffice (Irland) als § 13b-Beleg – Kz 46/47 kommen aus dem Beleg; E-165: die anteilige Vorsteuer (Kz 67) auch
        ...(b.p13b ? { steuerschuld: "eu" as const } : {}),
      };
      s = belegSetzen(s, beleg, t(b.datum, 18));
      belegDateien.push({ datei: `${b.id}.pdf`, html: belegHtml(b) });
    }
    const app = belegSummen(s.belege.find((x) => x.id === b.id)!);
    const sm = D.belegSumme(b);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Brutto", app.brutto_cent, sm.brutto);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, `Vorsteuer in der App (${b.zuordnung}${b.zuordnung === "gemischt" && !b.p13b ? ` – ${D.QUOTE_VORLAEUFIG} %` : ""})`, app.vorsteuer_cent, D.vstAbziehbarBeleg(b));
  }
  /** derselbe Stand mit den Startwerten der App: neuer Beleg „Vorsteuer abziehbar“ voll (Belege.tsx), E-Rechnung mit USt ebenso */
  const sStandard: Stand = { ...s, belege: s.belege.map((b) => ({ ...b, vorsteuer: true, vorsteuer_anteil: null, vorsteuer_betrag_cent: null })) };

  // ---------------------------------------------------------------- Website und Datenschutz
  const B = D.BETRIEB;
  dok({ id: "impressum", vorlage: "impressum", datum: "2026-01-09", worum: "Impressum der Praxis-Website: Einzelunternehmen (freier Beruf), reglementierter Beruf „Physiotherapeut“ (MPhG), KEINE Kammer, Aufsichtsbehörde leer gelassen (Frage: Zulassung nach § 124 SGB V als „behördliche Zulassung“?), USt-IdNr. aus „Mein Betrieb“, keine Teilnahme an Verbraucherschlichtung.",
    daten: () => ({ rechtsform: "Einzelunternehmen", vertreten: "Tom Reiter, Physiotherapeut", reglementiert: true, kammer: "", berufsbezeichnung: "Physiotherapeut", verleihung: "Bundesrepublik Deutschland",
      regelungen: "Masseur- und Physiotherapeutengesetz (MPhG) und Ausbildungs- und Prüfungsverordnung für Physiotherapeuten (PhysThAPrV), abrufbar unter www.gesetze-im-internet.de", redaktion: `Tom Reiter, ${B.strasse}, ${B.plz} ${B.ort}`, vsbg: "nicht_bereit" }) });
  {
    const h = sichtbar(dokHtml(s, "impressum"));
    vergleichText("Impressum", "Berufsbezeichnung genannt", /Physiotherapeut/.test(h) ? "ja" : "nein", "ja");
    infos.push(`Impressum (reglementiert, ohne Kammer): ${/Kammer/.test(h) ? `Text erwähnt „Kammer“: „…${/.{0,60}Kammer.{0,60}/.exec(h)?.[0]}…“` : "keine Erwähnung einer Kammer"}; Aufsichtsbehörde ${/Aufsichtsbeh/.test(h) ? "erwähnt" : "nicht erwähnt"}.`);
  }

  dok({ id: "dse", vorlage: "datenschutzerklaerung_website", datum: "2026-01-09", worum: "Datenschutzerklärung der Praxis-Website: Hosting, Logfiles 7 Tage, Kontaktformular, ONLINE-TERMINBUCHUNG über TheraPlan (technisch notwendiges Cookie), Schriften lokal. Im Buchungsformular kann freiwillig angegeben werden, ob eine Verordnung vorliegt und welche Behandlung gewünscht ist (Gesundheitsdaten).",
    daten: () => ({ website: "https://www.physio-am-markt.example", module: ["hosting", "server_logfiles", "kontakt", "technisch_notwendige_cookies", "online_terminbuchung", "google_fonts_lokal"],
      hoster_name: "Saxonia Webhosting GmbH", hoster_anschrift: "Am Wallgraben 2, 04103 Leipzig", logfile_tage: "7", kontaktformular: true,
      cookie_zwecke: "Sitzung der Online-Terminbuchung (Auswahl von Behandlung, Therapeut und Termin)", cookie_dauer: "nach Ende der Sitzung",
      termin_anbieter: "TheraPlan Software GmbH", termin_anschrift: "Wiener Platz 3, 01069 Dresden",
      ergaenzung: "Im Buchungsformular können Sie freiwillig angeben, ob eine ärztliche Verordnung vorliegt und welche Behandlung Sie wünschen. Diese Angaben sind Gesundheitsdaten (Art. 9 DSGVO); wir verarbeiten sie nur zur Terminplanung und unterliegen der beruflichen Schweigepflicht (§ 203 StGB).", stand: "2026-01-09" }) });
  {
    const h = sichtbar(dokHtml(s, "dse"));
    vergleichText("Datenschutzerklärung", "Online-Terminbuchung mit Anbieter beschrieben", /TheraPlan/.test(h) ? "ja" : "nein", "ja");
    infos.push(`Datenschutzerklärung: Abschnitt Online-Terminbuchung nennt ${/Art\. 9|Gesundheitsdaten/.test(h.replace(/Im Buchungsformular[\s\S]*?\(§ 203 StGB\)\./, "")) ? "Gesundheitsdaten/Art. 9 auch außerhalb der eigenen Ergänzung" : "Gesundheitsdaten/Art. 9 NUR in der eigenen Ergänzung"}.`);
  }

  dok({ id: "avv-termin", vorlage: "avv", datum: "2021-06-20", worum: "AVV mit TheraPlan Software GmbH: Praxissoftware (Terminbuch, Patientenakte) und Online-Terminbuchung – Gesundheitsdaten.",
    daten: () => ({ rolle: "auftraggeber", partner: "TheraPlan Software GmbH", partner_anschrift: "Wiener Platz 3\n01069 Dresden", hauptvertrag: "Lizenz- und Servicevertrag „TheraPlan Praxis M“ vom 20.06.2021 (Kundennummer TP-04471)",
      gegenstand: "Bereitstellung der Praxissoftware als Cloud-Dienst (Terminbuch, Patientenstammdaten, Behandlungsdokumentation)\nBetrieb der Online-Terminbuchung auf der Praxis-Website\nVersand von Terminerinnerungen per E-Mail und SMS",
      zweck: "Terminplanung, Behandlungsdokumentation und Organisation der Physiotherapiepraxis Physiotherapie am Markt", dauer: "für die Laufzeit des Hauptvertrags",
      datenarten: "Name, Geburtsdatum, Kontaktdaten\nKrankenversicherung und Versichertennummer\nVerordnungsdaten (verordnende Ärztin/verordnender Arzt, Heilmittel, Diagnosegruppe, ICD-10-Code)\nBehandlungsdokumentation und Befunde (Gesundheitsdaten, Art. 9 DSGVO)\nTermine",
      betroffene: "Patientinnen und Patienten\nInteressenten (Online-Buchung)\nBeschäftigte der Praxis (Benutzerkonten)",
      unterauftrag: "Rechenzentrum: Elbe Datacenter GmbH, Dresden (Serverstandort Deutschland, ISO 27001)\nSMS-Versand: SMSlink GmbH, Bonn", tom: "siehe Anlage (TOM-Beschreibung des Auftragsverarbeiters, u. a. Verschlüsselung der Patientendaten)", ort_datum: "Leipzig" }) });

  dok({ id: "avv-az", vorlage: "avv", datum: "2021-06-25", worum: "AVV mit dem Abrechnungszentrum (Abrechnung mit den gesetzlichen Krankenkassen nach § 302 SGB V): Verordnungen, Versichertendaten, Diagnosen.",
    daten: () => ({ rolle: "auftraggeber", partner: D.AZ.name, partner_anschrift: D.AZ.anschrift, hauptvertrag: "Abrechnungsvertrag vom 25.06.2021 (IK der Praxis 46 14 11 873, Kundennummer AZM-77120)",
      gegenstand: "Prüfung, Erfassung und Abrechnung der Heilmittelverordnungen gegenüber den gesetzlichen Krankenkassen im Datenträgeraustausch nach § 302 SGB V\nWeiterleitung der Original-Verordnungen an die Kostenträger\nAuszahlung der Vergütung an die Praxis",
      zweck: "Abrechnung physiotherapeutischer Leistungen mit den gesetzlichen Krankenkassen", dauer: "für die Laufzeit des Abrechnungsvertrags",
      datenarten: "Name, Anschrift, Geburtsdatum der Versicherten\nKrankenkasse, Versichertennummer, Zuzahlungsstatus\nVerordnungsdaten (Arzt, Heilmittel, Diagnosegruppe, ICD-10-Code), Behandlungsdaten (Gesundheitsdaten, Art. 9 DSGVO)",
      betroffene: "Patientinnen und Patienten (gesetzlich Versicherte)", unterauftrag: "Druck- und Scandienstleister: Belegerfassung Sachsen GmbH, Chemnitz", tom: "siehe Anlage (TOM-Beschreibung des Abrechnungszentrums)", ort_datum: "Leipzig" }) });

  dok({ id: "dsinfo", vorlage: "datenschutzinformation", datum: "2026-01-09", worum: "Datenschutzinformation nach Art. 13 DSGVO für Patientinnen und Patienten (Aushang/Anmeldebogen): Behandlung und Dokumentation, Terminbuchung, Abrechnung über das Abrechnungszentrum, Schweigepflicht.",
    daten: () => ({ fuer_wen: "Patientinnen und Patienten", verarbeitungen: ["Kundenverwaltung / Kundenkartei", "Terminvereinbarung (telefonisch, vor Ort oder Online-Buchung)", "Rechnungsstellung und Buchhaltung", "Kontaktanfragen (Kontaktformular, E-Mail, Telefon)"],
      interessen: "Sicherer und störungsfreier Betrieb unserer IT\nDurchsetzung und Abwehr von Ansprüchen", bereitstellung: "vertrag",
      ergaenzung: "Für Ihre Behandlung verarbeiten wir Gesundheitsdaten (Verordnung, Befund, Behandlungsverlauf) auf Grundlage von Art. 9 Abs. 2 lit. h, Abs. 3 DSGVO i. V. m. § 22 Abs. 1 Nr. 1 lit. b BDSG. Wir dokumentieren die Behandlung (§ 630f BGB) und bewahren die Dokumentation zehn Jahre nach Abschluss der Behandlung auf. Bei gesetzlich Versicherten übermitteln wir die Abrechnungsdaten über unser Abrechnungszentrum an Ihre Krankenkasse (§ 302 SGB V). Alle Mitarbeitenden unterliegen der Schweigepflicht (§ 203 StGB).", stand: "2026-01-09" }) });
  {
    const h = sichtbar(dokHtml(s, "dsinfo"));
    infos.push(`Datenschutzinformation Patienten: Text der Kundenkartei spricht von ${/Einwilligung/.test(h) ? "„Einwilligung“ als Grundlage für Gesundheitsdaten (aus dem Vorschlag)" : "keiner Einwilligung"} und nennt ${/Kunden/.test(h) ? "„Kunden“" : "keine „Kunden“"}.`);
  }

  dok({ id: "vvt", vorlage: "datenschutz_dokumentation", datum: "2026-01-12", worum: "Verzeichnis der Verarbeitungstätigkeiten: Patientenverwaltung/Behandlungsdokumentation (Vorschlag „Kundenverwaltung“ umgeschrieben), Terminbuchung, Abrechnung GKV über Abrechnungszentrum (eigene Tätigkeit), Rechnungen, Lohn, Personal, Website, Kontakt, E-Mail, Lieferanten; 16 TOM; Dienstleister TheraPlan, Abrechnungszentrum, Hoster, Lohnbüro (AVV), CloudOffice (Drittland-Bezug), Steuerkanzlei.",
    daten: (h) => ({
      verantwortlich: "Tom Reiter",
      verarbeitungen: [
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kundenverwaltung", h, {
          bezeichnung: "Patientenverwaltung und Behandlungsdokumentation",
          zweck: "Durchführung der physiotherapeutischen Behandlung, Befund und Dokumentation (§ 630f BGB)",
          rechtsgrundlage: "Art. 6 Abs. 1 lit. b, c DSGVO; Art. 9 Abs. 2 lit. h, Abs. 3 DSGVO i. V. m. § 22 Abs. 1 Nr. 1 lit. b BDSG; § 630f BGB",
          betroffene: "Patientinnen und Patienten",
          datenarten: "Name, Anschrift, Geburtsdatum, Kontaktdaten, Krankenversicherung, Verordnungsdaten, Befunde, Behandlungsverlauf (Gesundheitsdaten)",
          empfaenger: "TheraPlan Software GmbH (Auftragsverarbeiter); verordnende Ärztinnen und Ärzte (Therapiebericht, mit Einwilligung bzw. auf Anforderung)",
          loeschfrist: "10 Jahre nach Abschluss der Behandlung (§ 630f Abs. 3 BGB)",
        }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Terminvereinbarung", h, { empfaenger: "TheraPlan Software GmbH (Auftragsverarbeiter, Online-Terminbuchung und Erinnerungen)" }),
        ...eintraege("datenschutz_dokumentation", "verarbeitungen", [{
          bezeichnung: "Abrechnung mit gesetzlichen Krankenkassen über das Abrechnungszentrum", zweck: "Abrechnung der Heilmittelverordnungen (§ 302 SGB V), Zuzahlungen",
          rechtsgrundlage: "Art. 6 Abs. 1 lit. c DSGVO, Art. 9 Abs. 2 lit. h DSGVO i. V. m. § 302 SGB V", betroffene: "gesetzlich versicherte Patientinnen und Patienten",
          datenarten: "Versichertendaten, Verordnungsdaten mit Diagnose (ICD-10), Behandlungsdaten, Zuzahlungen", empfaenger: `${D.AZ.name} (Auftragsverarbeiter); Krankenkassen`,
          drittland: "keine Übermittlung in Drittländer", loeschfrist: "Abrechnungsunterlagen 10 Jahre (§ 147 AO), Kopien der Verordnungen nach den Verträgen mit den Krankenkassen",
        }], h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Rechnungsstellung", h, { empfaenger: "Steuerkanzlei Sommer & Partner, Finanzamt Leipzig I; Privatpatienten-Rechnungen enthalten Verordnungsangaben" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lohn- und Gehalts", h, { empfaenger: "Lohnbüro (Auftragsverarbeiter), Krankenkassen, Minijob-Zentrale, Finanzamt, BGW" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Personalverwaltung", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Betrieb der Website", h, { empfaenger: "Saxonia Webhosting GmbH (Auftragsverarbeiter)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kontaktanfragen", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Geschäftliche E-Mail", h, { empfaenger: "CloudOffice Ireland Ltd. (Auftragsverarbeiter)", drittland: "Mutterkonzern in den USA (EU-U.S. Data Privacy Framework, Standardvertragsklauseln)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lieferanten", h),
      ],
      tom: [
        "Festplattenverschlüsselung auf allen Laptops", "Geräteverschlüsselung und Bildschirmsperre", "Website ausschließlich über HTTPS", "Transportverschlüsselung (TLS)", "Persönliche Benutzerkonten", "Starke, individuelle Passwörter", "Zwei-Faktor-Authentisierung",
        "Abgestuftes Berechtigungskonzept", "Automatische Bildschirmsperre", "Abschließbare Räume/Schränke", "Clean", "Verpflichtung aller Beschäftigten", "Akten- und Datenträgervernichtung", "Auftragsverarbeitungsverträge", "Regelmäßige Datensicherung", "Jährliche Überprüfung des Verzeichnisses",
      ].map((x) => vorschlag("datenschutz_dokumentation", "tom", x, h, { umgesetzt_am: "2021-07-01", verantwortlich: "Tom Reiter" })),
      dienstleister: eintraege("datenschutz_dokumentation", "dienstleister", [
        { name: "TheraPlan Software GmbH", leistung: "Praxissoftware und Online-Terminbuchung", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2021-06-20", drittland: "keine Übermittlung in Drittländer" },
        { name: D.AZ.name, leistung: "Abrechnung mit gesetzlichen Krankenkassen (§ 302 SGB V)", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2021-06-25", drittland: "keine Übermittlung in Drittländer" },
        { name: "Saxonia Webhosting GmbH", leistung: "Website-Hosting", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2021-06-10", drittland: "keine Übermittlung in Drittländer" },
        { name: "Lohnbüro Pleißenburg, Katrin Jahn", leistung: "Lohnabrechnung", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2023-02-15", drittland: "keine Übermittlung in Drittländer" },
        { name: "CloudOffice Ireland Ltd.", leistung: "E-Mail, Cloud-Telefonanlage, Office", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2024-01-08", drittland: "USA (EU-U.S. Data Privacy Framework, Standardvertragsklauseln)" },
        { name: "Steuerkanzlei Sommer & Partner", leistung: "Steuerberatung (eigenverantwortlich)", auftragsverarbeitung: false, drittland: "keine Übermittlung in Drittländer" },
      ], h),
    }) });
  {
    const h = sichtbar(dokHtml(s, "vvt"));
    vergleichText("VVT", "Patientenverwaltung mit Art. 9 Abs. 2 lit. h DSGVO", /Art\. 9 Abs\. 2 lit\. h/.test(h) ? "ja" : "nein", "ja");
  }

  dok({ id: "verfahren", vorlage: "verfahrensdokumentation", datum: "2026-01-12", worum: `Verfahrensdokumentation (GoBD): EÜR durch die Steuerkanzlei; ${MARKE.name} für Privat- und Firmenrechnungen und Belege, TheraPlan (Termine, Patientenakte), Abrechnungszentrum für Kassenpatienten, EC-Terminal für Zuzahlungen und Verkauf am Empfang.`,
    daten: () => ({ version: "1.2", verantwortlich: "Tom Reiter",
      organisation: "Einzelpraxis für Physiotherapie (freier Beruf), Inhaber Tom Reiter. Eine Physiotherapeutin in Teilzeit, eine Empfangskraft im Minijob. Heilbehandlungen steuerfrei nach § 4 Nr. 14 UStG, Wellness, Firmenkurse und Verkauf steuerpflichtig (Ist-Versteuerung, vierteljährliche Voranmeldung, Vorsteueraufteilung).",
      steuerberatung: "Jahresabschluss durch die Steuerberatung; laufende Buchführung im Betrieb",
      systeme: eintraege("verfahrensdokumentation", "systeme", [
        { name: `${MARKE.name} (App, iPad)`, zweck: "Rechnungsprogramm und Belegerfassung", version: "seit 01/2026" },
        { name: "TheraPlan Praxis M", zweck: "Praxissoftware (Termine, Patientenakte, Online-Buchung)", version: "seit 07/2021" },
        { name: "Abrechnungszentrum Mitteldeutschland – Kundenportal", zweck: "Abrechnung mit den gesetzlichen Krankenkassen, Auszahlungsavise", version: "seit 07/2021" },
        { name: "EC-Terminal (Zahlungsdienstleister)", zweck: "Kartenzahlungen am Empfang (Zuzahlungen, Verkauf)", version: "seit 07/2021" },
        { name: "Sparkasse Leipzig Online-Banking", zweck: "Online-Banking", version: "seit 06/2021" },
      ], "2026-01-12"),
      belegeingang: ["E-Mail mit PDF-Anhang", "E-Rechnung (XRechnung/ZUGFeRD) per E-Mail oder Portal", "Download aus Kunden-/Lieferantenportal", "Papier (Post/persönlich)", "Kontoauszug/Bank-Schnittstelle", "Eigenbeleg"],
      belegart: ["originär digital (Muster 4.3)", "originär Papier, Ablage in Papier (Muster 4.1)"],
      ablage: ["Buchhaltungssoftware mit Belegarchiv", "Upload an Steuerberater (z. B. Kanzlei-Portal)", "Papierordner (chronologisch/nach Belegart)"],
      erfassung: `Belege werden wöchentlich in ${MARKE.name} erfasst und vierteljährlich als Paket an die Steuerkanzlei übermittelt.\nKassenumsätze: Auszahlungsavise des Abrechnungszentrums (monatlich) und Tagesabschlüsse des EC-Terminals werden monatlich abgelegt und vierteljährlich in die Voranmeldung übernommen.\nPrivat- und Firmenrechnungen werden fortlaufend nummeriert in ${MARKE.name} erstellt und beim Teilen festgeschrieben; Korrekturen nur per Stornorechnung.`,
      scannen: false, sicherung_intervall: "täglich", sicherung_ort: ["Cloud-Backup", "durch Softwareanbieter/Rechenzentrum"], e_rechnung: true,
      zugriff: "Zugriff auf Buchhaltung und Belege nur für den Inhaber und die Steuerberatung; Patientenakte getrennt in TheraPlan mit eigenen Benutzerkonten",
      kontrollen: "Monatlicher Abgleich der Auszahlungsavise mit dem Kontoauszug\nMonatlicher Abgleich von Kontoauszügen und Buchungen\nVor der Zahlung: Eingangsrechnungen sachlich und rechnerisch prüfen",
      aenderungen: eintraege("verfahrensdokumentation", "aenderungen", [{ datum: "2026-01-12", aenderung: `Privat- und Firmenrechnungen sowie Belegerfassung von TheraPlan bzw. Tabellenkalkulation auf ${MARKE.name} umgestellt.` }], "2026-01-12") }) });

  dok({ id: "aufbewahrung", vorlage: "aufbewahrung", datum: "2026-01-12", worum: "Aufbewahrungsplan mit den Startzeilen der App und zwei ergänzten Zeilen (Patientendokumentation 10 Jahre nach § 630f BGB, Lohnkonten).",
    daten: (h) => {
      const start = (leereDatenVon("aufbewahrung", h).eintraege as Eintrag[]).map((e) => ({ ...e, letzte: "2026", ort: `${MARKE.name} (verschlüsselt), Cloud-Backup; Papier im Büroschrank` }));
      return { eintraege: [...start, ...eintraege("aufbewahrung", "eintraege", [
        { art: "Patientendokumentation (Befund, Behandlungsverlauf, Verordnungskopien)", jahre: "10", letzte: "2026", ort: "TheraPlan (Cloud) und Patientenakten im verschlossenen Schrank" },
        { art: "Lohnkonten (§ 41 Abs. 1 EStG)", jahre: "6", letzte: "2026", ort: "Lohnbüro und Personalordner" },
      ], h)] };
    } });

  // ---------------------------------------------------------------- Personal
  const m = (id: keyof typeof D.MITARBEITER) => s.mitarbeiter.find((x) => x.id === id)!;
  const PAUSEN = "nach § 4 ArbZG: mindestens 30 Minuten bei mehr als sechs Stunden, 45 Minuten bei mehr als neun Stunden";
  const RUHE = "nach § 5 ArbZG: mindestens elf Stunden ununterbrochen nach Ende der täglichen Arbeitszeit";
  const nachweis = (id: keyof typeof D.MITARBEITER, datum: string, extra: Daten) => ({ ...personIn(v("nachweis_arbeitsbedingungen"), m(id)), arbeitsort: "betrieb", probezeit: "6", faelligkeit: "am letzten Bankarbeitstag des laufenden Monats", auszahlung: "Überweisung auf das von der beschäftigten Person benannte Konto",
    pausen: PAUSEN, ruhezeit: RUHE, kuendigung_art: "gesetz", kollektiv: "keine", ausgestellt_am: datum, befristet: false, ...extra });
  dok({ id: "nachweis1", vorlage: "nachweis_arbeitsbedingungen", datum: "2023-02-20", worum: "Nachweis der Arbeitsbedingungen Physiotherapeutin Anna Seidel (Teilzeit 25 Std./4 Tage, 2.450 € brutto, Fortbildungszuschuss).",
    daten: (h) => nachweis("m1", h, { beginn: "2023-03-01", taetigkeit: "Physiotherapeutin", entgelt_art: "monat", entgelt_betrag: "2.450,00", zuschlaege: "Zuschuss zu Pflichtfortbildungen (Fortbildungspunkte für die Kassenzulassung) bis 500 € je Jahr; Hausbesuche mit Dienstwagen der Praxis bzw. Kilometerpauschale.", wochenstunden: "25", tage_pro_woche: "4", verteilung: "Montag bis Donnerstag nach Dienstplan", ueberstunden: "nein", urlaub: "22",
      fortbildung: "Pflichtfortbildungen nach den Verträgen mit den Krankenkassen werden als Arbeitszeit gewährt und bis 500 € je Jahr bezuschusst." }) });
  dok({ id: "nachweis2", vorlage: "nachweis_arbeitsbedingungen", datum: "2025-08-25", worum: "Nachweis der Arbeitsbedingungen Empfangskraft Mareike Franke (Minijob, 14,50 €/Std., rund 40 Std./Monat = 580 € ≤ Minijob-Grenze 603 €).",
    daten: (h) => nachweis("m2", h, { beginn: "2025-09-01", taetigkeit: "Empfang, Terminorganisation, Kassieren der Zuzahlungen", entgelt_art: "stunde", entgelt_betrag: "14,50", zuschlaege: "Keine weiteren Bestandteile. Geringfügige Beschäftigung (§ 8 Abs. 1 Nr. 1 SGB IV); Befreiung von der Rentenversicherungspflicht beantragt.", wochenstunden: "9,25", tage_pro_woche: "3", verteilung: "Montag, Mittwoch und Freitag nachmittags nach Dienstplan", ueberstunden: "nein", urlaub: "12",
      fortbildung: "Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht." }) });

  dok({ id: "fragebogen1", vorlage: "sv_meldedaten", datum: "2023-02-20", worum: "Personalfragebogen Physiotherapeutin (Personengruppe 101, unbefristet Teilzeit, Abitur, Berufsfachschule Physiotherapie).",
    daten: () => ({ ...personIn(v("sv_meldedaten"), m("m1")), art: "teilzeit", personengruppe: "101", vertragsform: "2", stunden: "25", entgelt: "2.450,00", taetigkeit: "Physiotherapeutin", schulabschluss: "4", ausbildung: "2", weitere: false }) });
  dok({ id: "fragebogen2", vorlage: "sv_meldedaten", datum: "2025-08-25", worum: "Personalfragebogen Minijob (Personengruppe 109, geringfügig entlohnt, RV-Befreiung beantragt).",
    daten: () => ({ ...personIn(v("sv_meldedaten"), m("m2")), art: "minijob", personengruppe: "109", vertragsform: "2", stunden: "9", entgelt: "580,00", taetigkeit: "Empfangskraft (Minijob)", schulabschluss: "4", ausbildung: "1", weitere: false }) });

  const lohnZeilen = (l: D.LohnMonat[], h: string) =>
    eintraege("lohnkonto", "monate", l.map((x) => ({ monat: x.monat, zahltag: x.zahltag, brutto: euro(x.brutto), lohnsteuer: euro(x.lohnsteuer), soli: "0,00", kirchensteuer: "", sv_an: euro(x.sv_an), sv_ag: euro(x.sv_ag), auszahlung: euro(x.brutto - x.lohnsteuer - x.sv_an) })), h);
  dok({ id: "lohnkonto1", vorlage: "lohnkonto", datum: "2026-12-31", worum: "Lohnkonto 2026 Physiotherapeutin: 12 × 2.450 €, Steuerklasse I, LSt laut Lohnbüro (Annahme 207,50 €), SV AN 21,75 %, AG 21,15 %.",
    daten: (h) => ({ ...personIn(v("lohnkonto"), m("m1")), jahr: "2026", kinder: "0", religion: "keine Kirchensteuerpflicht", monate: lohnZeilen(D.LOHN.m1, h) }) });
  dok({ id: "lohnkonto2", vorlage: "lohnkonto", datum: "2026-12-31", worum: "Lohnkonto 2026 Minijob: 12 × 580 €, Pauschsteuer 2 % trägt der Arbeitgeber (§ 40a Abs. 2 EStG), KV 13 % + RV 15 % pauschal (AG), AN RV-befreit.",
    daten: (h) => ({ ...personIn(v("lohnkonto"), m("m2")), jahr: "2026", steuerklasse: "", kinder: "–", religion: "pauschal versteuert (2 %, § 40a Abs. 2 EStG) – keine individuellen Lohnsteuerabzugsmerkmale", monate: lohnZeilen(D.LOHN.m2, h) }) });

  const azn: Eintrag[] = ["2026-05-04", "2026-05-06", "2026-05-08", "2026-05-11", "2026-05-13", "2026-05-18", "2026-05-20", "2026-05-22", "2026-05-27", "2026-05-29"].map((datum) => ({ datum, beginn: "14:00", ende: "18:00", pause: "0", bemerkung: "" }));
  dok({ id: "azn", vorlage: "arbeitszeitnachweis", datum: "2026-06-01", worum: "Arbeitszeitnachweis Mai 2026 Minijob (§ 17 MiLoG): 10 Tage à 4 Std. = 40 Std. × 14,50 € = 580 € (Mindestlohn 2026: 13,90 €).",
    daten: (h) => ({ name: m("m2").name, monat: "Mai 2026", leerzeilen: false, tage: eintraege("arbeitszeitnachweis", "tage", azn, h) }) });

  // ---------------------------------------------------------------- Arbeitsschutz und Hygiene
  const KOSMETIK = ["Stolpern, Ausrutschen und Stürzen durch nasse", "Hautbelastung durch Feuchtarbeit", "Infektionsgefahr (z. B. Hepatitis", "Sensibilisierung durch Konservierungs", "Stromschlag und Brandgefahr", "Quetsch- und Scherstellen", "Belastung des Muskel-Skelett", "Zeit- und Leistungsdruck", "Brand durch elektrische Defekte"];
  const MASS = { verantwortlich: "Tom Reiter", umsetzen_bis: "2026-03-31", umgesetzt_am: "2026-03-15" };
  dok({ id: "gb-behandlung", vorlage: "gefaehrdungsbeurteilung", datum: "2026-02-03", worum: "Gefährdungsbeurteilung Behandlungsräume: 9 Kosmetik-Vorschläge der App (passendste Gruppe, eine für Physiotherapie gibt es nicht) plus eigene Zeilen Patiententransfer, Medizinprodukte (Reizstrom/Ultraschall), Wärmeanwendungen, Hausbesuche, Infektionen ohne Blutkontakt.",
    daten: (h) => ({ arbeitsbereich: "Behandlungsräume und Trainingsraum", taetigkeiten: "Krankengymnastik, Manuelle Therapie, Lymphdrainage, Massage, gerätegestützte KG; Elektro- und Ultraschalltherapie; Fango- und Heißluftanwendungen; Hausbesuche; Reinigung und Desinfektion von Liegen und Geräten", beschaeftigte: "2", beurteilt_von: "Tom Reiter", mitwirkung: "Beschäftigte des Bereichs\nFachkraft für Arbeitssicherheit (BGW-Unternehmermodell)\nBetriebsärztin / Betriebsarzt", datum: "2026-02-03",
      gefaehrdungen: [
        ...KOSMETIK.map((x) => vorschlag("gefaehrdungsbeurteilung", "gefaehrdungen", x, h, MASS)),
        ...eintraege("gefaehrdungsbeurteilung", "gefaehrdungen", [
          { beschreibung: "Heben, Halten und Umlagern von Patientinnen und Patienten (Transfer von Rollstuhl auf Liege, Mobilisation), Arbeiten in Rumpfbeuge an der Liege.", massnahme: "Elektrisch höhenverstellbare Liegen auf Arbeitshöhe einstellen; Transfer zu zweit oder mit Rutschbrett; rückengerechte Arbeitsweise in der Unterweisung üben.", schwere: "mittel", wahrscheinlichkeit: "moeglich", faktor: "einwirkungen", ...MASS },
          { beschreibung: "Aktive Medizinprodukte (Reizstrom-/Ultraschall-Kombigerät, Heißluftstrahler): Fehlbedienung, Verbrennung, Stromunfall bei Patientinnen, Patienten und Beschäftigten.", massnahme: "Anwendung nur nach Einweisung (§ 10 MPBetreibV) und Eintrag ins Medizinproduktebuch; sicherheitstechnische Kontrolle nach Herstellervorgabe (§ 11 MPBetreibV); Bestandsverzeichnis führen.", schwere: "mittel", wahrscheinlichkeit: "moeglich", faktor: "arbeitsmittel", ...MASS },
          { beschreibung: "Verbrennungen beim Erwärmen und Auflegen von Fango (Paraffinwärmeschrank, bis ca. 70 °C).", massnahme: "Temperatur vor dem Auflegen prüfen; Schutzhandschuhe beim Entnehmen; Wärmeschrank nur durch eingewiesene Personen.", schwere: "leicht", wahrscheinlichkeit: "moeglich", faktor: "einwirkungen", ...MASS },
          { beschreibung: "Hausbesuche: Wegeunfälle, Alleinarbeit, beengte und ungeeignete Behandlungsplätze in Wohnungen, Haustiere.", massnahme: "Hausbesuchsplan mit Erreichbarkeit per Mobiltelefon; mobile Liege nur zu zweit tragen bzw. Trolley; Hausbesuch abbrechen, wenn Arbeitsplatz unsicher.", schwere: "leicht", wahrscheinlichkeit: "moeglich", faktor: "ablaeufe_arbeitszeit", ...MASS },
          { beschreibung: "Infektionsgefährdung durch engen Körperkontakt (Tröpfchen, Schmierinfektion, Hautpilz), auch ohne Blutkontakt (Biostoffverordnung, TRBA 250 – prüfen).", massnahme: "Händehygiene nach Hygieneplan; Liegenauflage je Patient wechseln; Angebotsvorsorge und Impfangebot über den Betriebsarzt.", schwere: "mittel", wahrscheinlichkeit: "moeglich", faktor: "einwirkungen", ...MASS },
        ], h),
      ],
      mutterschutz_ergebnis: "umgestaltung", mutterschutz_details: "Kein Heben und Umlagern von Patientinnen und Patienten über 5 kg regelmäßig bzw. 10 kg gelegentlich (§ 11 Abs. 5 MuSchG); keine Behandlung von Patientinnen und Patienten mit bekannter Infektion; Hausbesuche nur nach Einzelfallprüfung; Sitzgelegenheit und zusätzliche Pausen.",
      wirksamkeit: "wirksam", wirksamkeit_am: "2026-09-08", bemerkung: "Begehung mit der Fachkraft für Arbeitssicherheit am 08.09.2026.", fortschreibung: "bei Änderungen von Tätigkeiten, Arbeitsmitteln oder Arbeitsstoffen, nach Unfällen sowie jährlich" }) });

  const BUERO = ["Einseitige Körperhaltung bei Bildschirmarbeit", "Visuelle Belastung bei Bildschirmarbeit", "Psychische Belastungen durch Arbeitsinhalt", "Brandentstehung und unzureichende", "Unzureichende Erste Hilfe"];
  dok({ id: "gb-empfang", vorlage: "gefaehrdungsbeurteilung", datum: "2026-02-03", worum: "Gefährdungsbeurteilung Empfang: 5 Vorschläge „Büro / Laden“ (Bildschirm, psychische Belastung, Brand, Erste Hilfe) plus Umgang mit Bargeld/aufgebrachten Patienten.",
    daten: (h) => ({ arbeitsbereich: "Empfang und Wartebereich", taetigkeiten: "Terminvergabe am Telefon und vor Ort, Kassieren der Zuzahlungen (EC-Terminal und bar), Verkauf von Therabändern und Tapes, Bildschirmarbeit in der Praxissoftware", beschaeftigte: "1", beurteilt_von: "Tom Reiter", mitwirkung: "Beschäftigte des Bereichs", datum: "2026-02-03",
      gefaehrdungen: [
        ...BUERO.map((x) => vorschlag("gefaehrdungsbeurteilung", "gefaehrdungen", x, h, MASS)),
        ...eintraege("gefaehrdungsbeurteilung", "gefaehrdungen", [{ beschreibung: "Aufgebrachte oder aggressive Patientinnen und Patienten am Empfang (Wartezeiten, Zuzahlungen), Bargeld in der Kassenlade.", massnahme: "Bargeld gering halten, Abschöpfung täglich; deeskalierende Gesprächsführung in der Unterweisung; Therapeut im Haus während der Empfangszeiten.", schwere: "leicht", wahrscheinlichkeit: "moeglich", faktor: "psychisch", ...MASS }], h),
      ],
      mutterschutz_ergebnis: "keine_massnahmen", wirksamkeit: "wirksam", wirksamkeit_am: "2026-09-08", fortschreibung: "jährlich und bei Änderungen" }) });

  const ALLE = [{ name: m("m1").name }, { name: m("m2").name }];
  dok({ id: "unterweisung", vorlage: "unterweisung", datum: "2026-02-10", worum: "Jährliche Unterweisung Arbeitsschutz (60 Min.) für beide Beschäftigten: Gefährdungen, Erste Hilfe, Brandschutz, Elektrogeräte, Gefahrstoffe (Desinfektion), Hautschutz, Heben und Tragen, Infektionsschutz, Liegen, Bildschirm, psychische Belastung.",
    daten: (h) => ({ thema: "Jährliche Unterweisung Arbeitsschutz", anlass: "wiederholung", dauer: "60 Minuten", durchgefuehrt_von: "Tom Reiter",
      themen: ["gefaehrdungen_am_eigenen_arbeitsplatz_un", "erste_hilfe_ersthelfer_standort_verbandk", "brandschutz_verhalten_im_brandfall_umgan", "stolper_rutsch_und_sturzgefahren_ordnung", "elektrische_geraete_sichtpruefung_vor_be", "gefahrstoffe_inhalt_der_betriebsanweisun", "hautschutz_hautschutzplan_richtige_schut", "heben_und_tragen_hilfsmittel_rueckengere", "psychische_belastungen_verhalten_bei_kon", "infektionsschutz_und_hygiene_stich_und_s", "bedienung_hoehenverstellbarer_behandlung", "bildschirmarbeit_einstellung_von_tisch_s"],
      inhalt: "Ersthelfer: Tom Reiter und Anna Seidel (Kurs 10/2025). Verbandkasten am Empfang, Feuerlöscher im Flur. Hygieneplan der Praxis (Händedesinfektion, Liegenauflagen) und Betriebsanweisung BA-01 Flächendesinfektion besprochen. Medizinprodukte nur nach Einweisung (Medizinproduktebuch).", teilnehmer: eintraege("unterweisung", "teilnehmer", ALLE, h) }) });

  const STOFFE: Eintrag[] = [
    { bezeichnung: "Flächendesinfektion alkoholfrei (Konzentrat, quartäre Ammoniumverbindungen)", hersteller: "Hygienehandel Mitte GmbH", gefahren: "Gefahr; H302, H314, H410 – ätzend", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Behandlungsräume, Trainingsraum", verwendung: "Wischdesinfektion von Liegen, Geräten und Flächen", sdb: "liegt_vor", sdb_stand: "2025-11-04" },
    { bezeichnung: "Händedesinfektion auf Alkoholbasis", hersteller: "Hygienehandel Mitte GmbH", gefahren: "Gefahr; H225, H319 – flüssig und Dampf leicht entzündbar", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "alle Räume (Spender)", verwendung: "hygienische Händedesinfektion", sdb: "liegt_vor", sdb_stand: "2025-11-04" },
    { bezeichnung: "Kontaktgel für Ultraschalltherapie", hersteller: "Medizintechnik Elbe GmbH", gefahren: "keine Kennzeichnung (Medizinprodukt) – kein Gefahrstoff, zur Übersicht aufgeführt", menge: "unter 1 kg bzw. l", arbeitsbereich: "Behandlungsraum 2", verwendung: "Ankopplung Ultraschallkopf", sdb: "fehlt" },
  ];
  dok({ id: "gefahrstoffe", vorlage: "gefahrstoffverzeichnis", datum: "2026-02-02", worum: "Gefahrstoffverzeichnis: Flächen- und Händedesinfektion; Kontaktgel zur Übersicht (kein Gefahrstoff, Sicherheitsdatenblatt fehlt).",
    daten: (h) => ({ stand: "2026-02-02", verantwortlich: "Tom Reiter", stoffe: eintraege("gefahrstoffverzeichnis", "stoffe", STOFFE, h) }) });
  dok({ id: "ba1", vorlage: "betriebsanweisung", datum: "2026-02-02", worum: "Betriebsanweisung BA-01 Flächendesinfektion (Konzentrat, ätzend, H302/H314/H410).",
    daten: () => ({ stoff: "Flächendesinfektion alkoholfrei, Konzentrat (quartäre Ammoniumverbindungen)", arbeitsbereich: "Behandlungsräume, Trainingsraum – Anmischen im Abstellraum", nummer: "BA-01",
      gefahren: "Verursacht schwere Verätzungen der Haut und schwere Augenschäden (H314).\nGesundheitsschädlich bei Verschlucken (H302).\nSehr giftig für Wasserorganismen mit langfristiger Wirkung (H410).",
      schutz: "Konzentrat nur mit Dosierhilfe nach Herstellerangabe verdünnen (0,5 %).\nBeim Anmischen Schutzbrille und Nitrilhandschuhe tragen.\nGebrauchslösung im beschrifteten Gefäß, täglich frisch ansetzen.\nNicht mit anderen Reinigern mischen.\nNicht sprühen, sondern wischen.",
      gefahrfall: "Verschüttetes Konzentrat mit Bindemittel aufnehmen, Raum lüften.\nVerunreinigte Kleidung sofort ausziehen.",
      erste_hilfe: "Nach Augenkontakt: sofort 15 Minuten mit Wasser spülen, Augenarzt.\nNach Hautkontakt: mit viel Wasser spülen.\nNach Verschlucken: Mund ausspülen, viel Wasser trinken, kein Erbrechen herbeiführen, Arzt rufen.",
      entsorgung: "Restmengen nicht in den Ausguss; Gebinde restentleert in den Gelben Sack, Konzentratreste über den Lieferanten zurückgeben.", notruf: "Notruf 112 – Ersthelfer Tom Reiter und Anna Seidel, Giftinformationszentrum Erfurt 0361 730730", erstellt_von: "Tom Reiter", datum: "2026-02-02" }) });

  const geraete: Eintrag[] = [
    ["PC Empfang mit Monitor", "Bürorechner", "INV-01", "Empfang", "bestanden", ""], ["Drucker/Scanner", "Multifunktionsgerät", "INV-02", "Empfang", "bestanden", ""], ["EC-Terminal (Netzteil)", "Zahlungsterminal", "INV-03", "Empfang", "bestanden", ""],
    ["Laptop Therapie (Netzteil)", "14 Zoll", "INV-04", "Behandlungsraum 1", "bestanden", ""], ["Fango-Wärmeschrank", "Paraffinwärmeschrank 60 l", "INV-05", "Abstellraum", "bestanden", ""], ["Heißluftstrahler", "Infrarot 150 W", "INV-06", "Behandlungsraum 2", "maengel", "Gitter lose – repariert und nachgeprüft"],
    ["Wasserkocher", "1,7 l", "INV-07", "Teeküche", "bestanden", ""], ["Kaffeemaschine", "Filter", "INV-08", "Teeküche", "bestanden", ""], ["Mehrfachsteckdose", "6-fach mit Schalter", "INV-09", "Empfang", "bestanden", ""],
    ["Verlängerungskabel 10 m", "H07RN-F 3G1,5", "INV-10", "Hausbesuchstasche", "bestanden", ""], ["Massagegerät (Handgerät)", "Percussion", "INV-11", "Behandlungsraum 1", "bestanden", ""], ["Router", "Glasfaser", "INV-12", "Technikraum", "bestanden", ""],
  ].map(([bezeichnung, typ, inventar, standort, ergebnis, maengel]) => ({ bezeichnung: bezeichnung!, typ: typ!, inventar: inventar!, standort: standort!, ergebnis: ergebnis!, maengel: maengel!, naechste: "2027-09-18" }));
  dok({ id: "elektro", vorlage: "pruefprotokoll_elektro", datum: "2026-09-18", worum: "DGUV-V3-Prüfung durch Elektro Lindenau GmbH (passt zu Beleg b32): 12 Geräte, Heißluftstrahler mit Mangel. Das Reizstrom-/Ultraschallgerät ist ein Medizinprodukt – dessen STK (Beleg b31) hat in der App keine Vorlage.",
    daten: (h) => ({ pruefer: "Elektro Lindenau GmbH, Elektrofachkraft Sven Lindenau", datum: "2026-09-18", messgeraet: "Gossen Metrawatt Secutest", pruefart: "Wiederholungsprüfung", umfang: ["Sichtprüfung", "Messung des Schutzleiterwiderstands", "Messung des Isolationswiderstands", "Funktionsprüfung"], norm: "DIN EN 50678 (VDE 0701) / DIN EN 50699 (VDE 0702)", einsatz: "bueros_oder_unter_aehnlichen_bedingungen", leerzeilen: false, geraete: eintraege("pruefprotokoll_elektro", "geraete", geraete, h) }) });

  const HYG = ["Händewaschen", "Hygienische Händedesinfektion", "Einmalhandschuhe", "Arbeitsplatz / Arbeits- und Ablageflächen", "Behandlungsliege", "Waschbecken", "Fußboden", "Wäsche:", "Reinigungsutensilien", "Abfall allgemein", "Hygieneplan pflegen"];
  dok({ id: "hygiene", vorlage: "hygieneplan", datum: "2026-02-03", worum: "Hygieneplan Physiotherapiepraxis: 11 der 18 Beauty-Vorschläge (eine Gruppe für Heilberufe gibt es nicht) plus eigene Zeilen Trainingsgeräte/Matten, Ultraschallkopf/Elektroden, Fango, Hausbesuchstasche.",
    daten: (h) => ({ bereich: "Physiotherapiepraxis",
      eintraege: [
        ...HYG.map((x) => vorschlag("hygieneplan", "eintraege", x, h)),
        ...eintraege("hygieneplan", "eintraege", [
          { was: "Trainingsgeräte, Matten, Therapiekreisel, Bälle", wann: "nach jeder Benutzung mit Hautkontakt; täglich", womit: "Flächendesinfektion (VAH-gelistet), Einmaltuch", wie: "Wischdesinfektion, Einwirkzeit beachten", wer: "Therapeut/in" },
          { was: "Ultraschallkopf, Elektroden, Kabel", wann: "nach jeder Patientin/jedem Patienten", womit: "Desinfektionstücher nach Herstellerangabe", wie: "Gel entfernen, abwischen; Schwammelektroden je Patient", wer: "Therapeut/in" },
          { was: "Fangopackungen / Paraffin", wann: "nach Herstellerangabe", womit: "Wärmeschrank (Sterilisationsprogramm)", wie: "Paraffin regelmäßig erhitzen, verunreinigte Masse verwerfen", wer: "Tom Reiter" },
          { was: "Hausbesuchstasche und mobile Liege", wann: "nach jedem Hausbesuch", womit: "Flächendesinfektion, Einmalauflagen", wie: "Liege und Material wischdesinfizieren; Händedesinfektion vor und nach dem Besuch", wer: "Therapeut/in" },
        ], h),
      ], erstellt_von: "Tom Reiter", datum: "2026-02-03" }) });
  {
    const h = sichtbar(dokHtml(s, "hygiene"));
    const kunde = (h.match(/Kund(?:e|in|en|innen)\b/g) ?? []).length;
    infos.push(`Hygieneplan (Beauty-Vorschläge für eine Physiotherapiepraxis): ${kunde}× „Kunde/Kundin/Kunden“ im Text, ${/Salon|Friseur|Kosmetik|Nagel/i.test(h) ? "Begriffe aus Salon/Kosmetik vorhanden" : "keine Salon-/Kosmetikbegriffe"}; Rechtsgrundlage auf dem Aushang: ${/Hygieneverordnung/.test(h) ? "„Hygieneverordnung des Landes“" : "–"}.`);
  }

  // ---------------------------------------------------------------- Umsatzsteuer-Voranmeldungen Q1–Q4 (Ist): Übernahme + Kassenumsätze, Zuzahlungen, Empfang, Vorsteueranteil, § 13b von Hand
  const erwartet = D.ustQuartale();
  const VA_ERSTELLT: Record<string, string> = { "2026-Q1": "2026-04-08", "2026-Q2": "2026-07-08", "2026-Q3": "2026-10-08", "2026-Q4": "2027-01-08" };
  const ust: UstZeile[] = [];
  for (const eq of erwartet) {
    const id = `ust-${eq.q}`;
    let zeile: Omit<UstZeile, "formular"> | null = null;
    dok({ id, vorlage: "ust_voranmeldung", datum: VA_ERSTELLT[eq.q]!, worum: `USt-Voranmeldung ${eq.q} (Ist): „Aus Rechnungen übernehmen“ (umsaetzeFuer, ${eq.rechnungen} Rechnungen mit Zahlungseingang), dann von Hand: 19 % +${euro(eq.empfang.netto)} € Empfang, ohne USt +${euro(eq.gkv)} € Kassen (Abrechnungszentrum) +${euro(eq.zuzahlungen)} € Zuzahlungen. Vorsteuer kommt jetzt vollständig aus den Belegen (E-165: voll bzw. anteilig 13 % je Beleg${eq.st13b ? `, § 13b Kz 46/47 ${euro(eq.bmg13b)} € / ${euro(eq.st13b)} € und Kz 67 anteilig ${euro(eq.vst13b)} €` : ""}).`,
      daten: () => ({ versteuerung: "ist" }),
      danach: () => {
        const erg = umsaetzeFuer(s.unterlagen, eq.q, s.betrieb, "ist", s.belege, false)!;
        const std = umsaetzeFuer(sStandard.unterlagen, eq.q, sStandard.betrieb, "ist", sStandard.belege, false)!;
        zeile = { q: eq.q, app: erg.werte, anzahl: erg.anzahl, offen: erg.offen, vorsteuerBelege: erg.vorsteuerBelege, ohneVorsteuer: erg.ohneVorsteuer, vstStandard: std.werte.vorsteuer ?? "–" };
        vergleich(`USt-Übernahme ${eq.q}`, "Umsätze 19 % aus Rechnungen (nach Zahlungseingang)", ausEuro(erg.werte.umsatz_19 ?? "0"), eq.app.umsatz_19);
        vergleich(`USt-Übernahme ${eq.q}`, "Umsätze 7 %", ausEuro(erg.werte.umsatz_7 ?? "0"), 0);
        vergleich(`USt-Übernahme ${eq.q}`, "Umsätze ohne USt aus Rechnungen (steuerfreie Heilbehandlung)", ausEuro(erg.werte.umsatz_48 ?? "0"), eq.app.umsatz_frei);
        vergleich(`USt-Übernahme ${eq.q}`, `Vorsteuer aus Belegen (pflichtig voll, gemischt ${D.QUOTE_VORLAEUFIG} % je Beleg – E-165)`, ausEuro(erg.werte.vorsteuer ?? "0"), eq.app.vorsteuer);
        vergleich(`USt-Übernahme ${eq.q}`, "Vorsteuer aus § 13b (Kz 67, anteilig)", ausEuro(erg.werte.vorsteuer_13b ?? "0"), eq.app.vorsteuer13b);
        vergleich(`USt-Übernahme ${eq.q}`, "Vorsteuer mit den Startwerten der App (alle Belege „an“)", ausEuro(std.werte.vorsteuer ?? "0"), eq.vstStandard);
        const plus = (k: string, c: number) => euro(ausEuro(erg.werte[k] ?? "0") + c);
        s = felderSetzen(s, id, {
          ...erg.werte,
          umsatz_19: plus("umsatz_19", eq.empfang.netto),
          // seit r9 eigenes Feld Kz 48 (steuerfreie Umsätze ohne Vorsteuerabzug)
          umsatz_48: plus("umsatz_48", eq.gkv + eq.zuzahlungen),
          // E-165: Vorsteuer (Kz 66) und Vorsteuer aus § 13b (Kz 67) unverändert aus der Übernahme – kein Nachtrag von Hand
          notiz: [
            `Umsätze ohne USt sind steuerfreie Heilbehandlungen nach § 4 Nr. 14 UStG → Kz 48 (steuerfreie Umsätze ohne Vorsteuerabzug), nicht Kz 41/43. Darin: Rechnungen ${euro(eq.reFrei)} €, Abrechnungszentrum ${euro(eq.gkv)} €, Zuzahlungen ${euro(eq.zuzahlungen)} €.`,
            `19 %: Rechnungen ${euro(eq.rePflichtig)} € + Empfang (EC-Terminal) ${euro(eq.empfang.netto)} €.`,
            `Vorsteuer: voll abziehbar ${euro(eq.vstVoll)} €; gemischt genutzte Belege mit Teilabzug ${D.QUOTE_VORLAEUFIG} % je Beleg ${euro(eq.vstAnteil)} € (von ${euro(eq.gemischtGesamt)} €, vorläufiger Umsatzschlüssel, § 15 Abs. 4 UStG)${eq.st13b ? `; Vorsteuer aus § 13b ${euro(eq.vst13b)} € (Kz 67)` : ""}.`,
            ...(eq.st13b ? [`§ 13b UStG (CloudOffice Ireland Ltd.): Bemessungsgrundlage ${euro(eq.bmg13b)} € (Kz 46), Steuer ${euro(eq.st13b)} € (Kz 47), Vorsteuer daraus anteilig ${euro(eq.vst13b)} € (Kz 67) – alles aus dem Beleg übernommen.`] : []),
          ].join("\n"),
        }, t(VA_ERSTELLT[eq.q]!, 10));
      } });
    const formular = v("ust_voranmeldung").ergebnis!(unterlage(id).daten);
    if (zeile) ust.push({ ...(zeile as Omit<UstZeile, "formular">), formular });
    const z = formular.find((x) => /Zahllast|Erstattung/.test(x[0]))!;
    // R10: „Umsatzsteuer“ im Formular enthält die § 13b-Steuer (Kz 47)
    vergleich(`USt-Voranmeldung ${eq.q} (fertig)`, "Umsatzsteuer 19 % + § 13b Kz 47 (Formular)", ausEuro(formular.find((x) => x[0] === "Umsatzsteuer")![1]), eq.ust19 + eq.st13b);
    vergleich(`USt-Voranmeldung ${eq.q} (fertig)`, "Vorsteuer (Formular)", ausEuro(formular.find((x) => x[0] === "Vorsteuer")![1]), eq.vorsteuer);
    vergleich(`USt-Voranmeldung ${eq.q} (fertig)`, "Zahllast inkl. § 13b-Steuer", ausEuro(z[1]) * (z[0] === "Erstattung" ? -1 : 1), eq.zahllast);
    vergleich(`USt-Voranmeldung ${eq.q} (fertig)`, "Kz 48 (steuerfreie Umsätze ohne Vorsteuerabzug)", ausEuro(unterlage(id).daten.umsatz_48 as string), eq.kz48);
  }
  {
    // ohne die eigene Notiz (dort stehen Kz 48 und § 13b von Hand)
    const h = sichtbar(dokHtml(s, "ust-2026-Q1")).replace(/Notiz[\s\S]*$/, "");
    vergleichText("USt-Voranmeldung (Formular)", "Kennzahl 48 (steuerfreie Umsätze ohne Vorsteuerabzug) genannt", /\b48\b/.test(h) ? "ja" : "nein", "ja");
    vergleichText("USt-Voranmeldung (Formular)", "Felder für § 13b (Kz 46/47) vorhanden", /\b46\b|\b47\b|13b/.test(h) ? "ja" : "nein", "ja");
  }

  // ---------------------------------------------------------------- EÜR 2026: Übernahme + Kassenumsätze, Zuzahlungen, Empfang, USt-Zahlungen, AfA
  const eu = D.euerUnabhaengig();
  const qs = D.ustQuartale();
  let uebernahme!: ReturnType<typeof euerUebernahme>;
  dok({ id: "euer", vorlage: "euer", datum: "2027-02-22", worum: "EÜR 2026: „Aus Rechnungen und Belegen übernehmen“, danach von Hand ergänzt: Kassenumsätze über das Abrechnungszentrum (brutto vor Gebühr), Zuzahlungen, Verkauf am Empfang (netto + USt), an das Finanzamt gezahlte Umsatzsteuer (Q4/2025, Q1–Q3/2026), AfA Kombigerät (brutto, 5 Jahre, 11/12).",
    daten: () => ({}),
    danach: () => {
      uebernahme = euerUebernahme(s, "2026");
      s = felderSetzen(s, "euer", { jahr: "2026", einnahmen: uebernahme.einnahmen, ausgaben: uebernahme.ausgaben }, t("2027-02-22", 9));
      const zahl = (l: Record<string, string>[], k: string) => l.filter((x) => x.kategorie === k).reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0);
      vergleich("EÜR-Übernahme", "Umsatzsteuerpflichtige Einnahmen aus Rechnungen (netto)", zahl(uebernahme.einnahmen, EUER_ZEILE_STEUERPFLICHTIG), eu.rePflichtig);
      vergleich("EÜR-Übernahme", "Steuerfreie Einnahmen aus Rechnungen (Heilbehandlung)", zahl(uebernahme.einnahmen, EUER_ZEILE_STEUERFREI), eu.reFrei);
      vergleich("EÜR-Übernahme", "Vereinnahmte Umsatzsteuer aus Rechnungen", zahl(uebernahme.einnahmen, "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben"), eu.reUst);
      vergleich("EÜR-Übernahme", "Gezahlte Vorsteuer (abziehbarer Teil: pflichtig voll, gemischt 13 % – E-165)", zahl(uebernahme.ausgaben, "Gezahlte Vorsteuerbeträge"), eu.vstAbziehbarBezahlt);
      vergleich("EÜR-Übernahme", "Betriebsausgaben aus Belegen gesamt (inkl. Vorsteuerzeile, ohne Anlage)", uebernahme.ausgaben.reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0), eu.ausgabenBelege);
      for (const [kat, w] of Object.entries(eu.nachKategorie)) {
        const titel = kategorieFuer(kat).titel;
        const zeile = uebernahme.ausgaben.find((x) => (x.text ?? "").startsWith(titel));
        vergleich("EÜR-Übernahme", `Kategorie ${titel} (brutto abzüglich abziehbarer Vorsteuer – nicht abziehbare Vorsteuer ist Ausgabe)`, zeile ? ausEuro(zeile.betrag ?? "0") : 0, w.appSicht);
      }
      vergleichText("EÜR-Übernahme", "Anlagen (Kombigerät) gemeldet", String(uebernahme.anlagen), "1");
      vergleichText("EÜR-Übernahme", "unbezahlte Rechnungen des Jahres", String(uebernahme.unbezahlt), "2");
      vergleichText("EÜR-Übernahme", "Steuerfreie Zeile heißt „… (z. B. innergemeinschaftliche Lieferung)“ – für Heilbehandlungen unpassend", ((t) => (/innergemeinschaftlich/.test(t) ? t : "ohne igL-Beispiel"))(uebernahme.einnahmen.find((x) => x.kategorie === EUER_ZEILE_STEUERFREI)?.text ?? "–"), "ohne igL-Beispiel");
      const d = unterlage("euer").daten;
      const anlage = D.BELEGE.find((b) => b.id === D.AFA.beleg)!;
      const ein = [
        ...(d.einnahmen as Eintrag[]),
        { datum: "", text: `Kassenpatienten: Auszahlungen des Abrechnungszentrums 2026 (brutto vor Gebühr, 12 Auszahlungen)`, kategorie: EUER_ZEILE_STEUERFREI, betrag: euro(eu.gkv) },
        { datum: "", text: "Gesetzliche Zuzahlungen der Patientinnen und Patienten (EC-Terminal/bar)", kategorie: EUER_ZEILE_STEUERFREI, betrag: euro(eu.zuzahlungen) },
        { datum: "", text: "Verkauf und Wellness am Empfang ohne Rechnung (netto)", kategorie: EUER_ZEILE_STEUERPFLICHTIG, betrag: euro(eu.empfangNetto) },
        { datum: "", text: "Umsatzsteuer auf Verkauf und Wellness am Empfang", kategorie: "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben", betrag: euro(eu.empfangUst) },
      ];
      const aus = [
        ...(d.ausgaben as Eintrag[]),
        { datum: D.VA_Q4_2025.zahltag, text: "USt-Vorauszahlung Q4/2025", kategorie: "An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer", betrag: euro(D.VA_Q4_2025.betrag) },
        ...qs.filter((q) => D.VA_ZAHLTAG[q.q]!.startsWith("2026-")).map((q) => ({ datum: D.VA_ZAHLTAG[q.q]!, text: `USt-Vorauszahlung ${q.q} (inkl. § 13b)`, kategorie: "An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer", betrag: euro(q.zahllast) })),
      ];
      s = felderSetzen(s, "euer", { einnahmen: ein, ausgaben: aus, afa: [{ text: `Kombigerät Elektro-/Ultraschalltherapie (${euro(D.belegSumme(anlage).brutto)} € brutto – keine Vorsteuer, § 9b EStG; 02/2026, 5 Jahre, 11/12)`, betrag: euro(eu.afa) }] }, t("2027-02-22", 10));
    } });
  const euerErgebnis = v("euer").ergebnis!(unterlage("euer").daten);
  {
    const g = euerErgebnis.find((z) => z[0] === "Gewinn" || z[0] === "Verlust")!;
    vergleich("EÜR 2026 (fertig)", "Summe Betriebseinnahmen", ausEuro(euerErgebnis[0]![1]), eu.einnahmen);
    vergleich("EÜR 2026 (fertig)", "Summe Betriebsausgaben (ohne AfA)", ausEuro(euerErgebnis[1]![1]), eu.ausgaben);
    vergleich("EÜR 2026 (fertig)", "AfA", ausEuro(euerErgebnis[2]![1]), eu.afa);
    vergleich("EÜR 2026 (fertig)", "Gewinn", ausEuro(g[1]) * (g[0] === "Verlust" ? -1 : 1), eu.ergebnis);
  }

  // ---------------------------------------------------------------- Steuererklärung (Zusammenstellung)
  const gewinn = euerErgebnis.find((z) => z[0] === "Gewinn" || z[0] === "Verlust")!;
  const uj = D.ustJahr();
  const jq = D.jahresQuote();
  dok({ id: "steuer", vorlage: "steuererklaerung", datum: "2027-03-15", worum: "Zusammenstellung für ESt (Anlage S, freier Beruf) und USt 2026: Gewinn aus der EÜR, Umsätze (vereinnahmt, gesamt), USt und Vorsteuer mit endgültigem Aufteilungsschlüssel, ESt-Vorauszahlungen 4 × 3.200 €, USt-Vorauszahlungen Q1–Q4.",
    daten: (h) => ({ jahr: "2026", arten: ["est", "ust"], gewinn: `${gewinn[0] === "Verlust" ? "-" : ""}${gewinn[1].replace(/[€\s\u00a0]/g, "")}`, umsatz: euro(jq.gesamt), ust_jahr: euro(uj.ust + uj.st13b), vorsteuer_jahr: euro(uj.vorsteuer),
      vorauszahlungen: eintraege("steuererklaerung", "vorauszahlungen", [
        ...[1, 2, 3, 4].map((q) => ({ art: `Einkommensteuer Q${q}`, betrag: euro(D.EST_VORAUSZAHLUNG) })),
        ...qs.map((q) => ({ art: `Umsatzsteuer ${q.q}`, betrag: euro(q.zahllast) })),
      ], h),
      weiteres: eintraege("steuererklaerung", "weiteres", [{ was: "Krankenversicherung (privat) und Pflegeversicherung", betrag: "6.480,00", beleg: true }, { was: "Basisrente (Rürup), Beiträge 2026", betrag: "6.000,00", beleg: true }], h),
      notiz: `Umsätze 2026 (vereinnahmt, netto): steuerpflichtig ${euro(jq.pflichtig)} €, steuerfrei nach § 4 Nr. 14 UStG ${euro(jq.frei)} € → Umsatzschlüssel ${jq.exakt.toFixed(2).replace(".", ",")} % (gerundet ${jq.quote} %, vorläufig ${D.QUOTE_VORLAEUFIG} %). USt 19 % ${euro(uj.ust)} € + § 13b ${euro(uj.st13b)} €; Vorsteuer ${euro(uj.vorsteuer)} €. Jahreszahllast ${euro(uj.jahr)} €, Vorauszahlungen ${euro(uj.vorauszahlungen)} € → Abschlusszahlung ${euro(uj.abschluss)} €. Freier Beruf: keine Gewerbesteuer. Kleinunternehmergrenze: steuerpflichtiger Umsatz 2026 über 25.000 €? ${jq.pflichtig > 2500000 ? "ja" : "nein"} (steuerfreie Heilbehandlungen zählen nicht).` }) });
  vergleich("Steuererklärung", "Gewinn = EÜR (unabhängig)", ausEuro(gewinn[1]) * (gewinn[0] === "Verlust" ? -1 : 1), eu.ergebnis);
  {
    const erg = v("steuererklaerung").ergebnis?.(unterlage("steuer").daten) ?? [];
    infos.push(`Unterlagen zur Steuererklärung (Formular-Ergebnis): ${erg.map(([a, b]) => `${a} ${b}`).join(", ") || "–"}.`);
  }

  // ---------------------------------------------------------------- übersprungene Vorlagen
  const grund: Record<string, string> = {
    bilanz_guv: "Freier Beruf: keine Buchführungspflicht nach §§ 140, 141 AO – EÜR.",
    kassenbuch: "Keine Bargeldkasse mit Kassenbuch: Zuzahlungen und Verkauf überwiegend per EC-Terminal, Barbeträge werden mit Quittung aus der Praxissoftware einzeln erfasst (Einzelaufzeichnung – fachlich prüfen).",
    kassenmeldung: "Kein elektronisches Aufzeichnungssystem mit TSE (Annahme: Praxissoftware ohne Kassenfunktion – prüfen).",
    datenpanne: "Keine Datenpanne im Jahr 2026.",
    ki_kompetenz: "Keine KI-Werkzeuge im Einsatz (Profil ki.nutzung = nein).",
    handelsregister: "Freier Beruf – kein Handelsgewerbe.", transparenzregister: "Natürliche Person – keine Mitteilung.",
    gewerbeanmeldung: "Physiotherapie ist ein freier Beruf (§ 18 Abs. 1 Nr. 1 EStG, „ähnlicher Beruf“) – keine Gewerbeanmeldung; Verkauf von Therabändern in geringem Umfang (Abfärbung prüfen, § 15 Abs. 3 Nr. 1 EStG).",
    ifsg_belehrung: "Keine Lebensmittel.", allergene: "Keine Lebensmittel.", haccp: "Keine Lebensmittel.", hygieneschulung: "Keine Lebensmittel.",
    hautschutzplan: "Im Szenario nicht erstellt (Musterzeilen für Praxen gibt es seit E-167); Feuchtarbeit in der Physiotherapie (Händedesinfektion statt Waschen) im Hygieneplan und in der Unterweisung berücksichtigt.",
    // StB-Prüfung (5.2, C-9): nur Kunden im Inland
    oss_meldung: "Nur Patienten und Kunden im Inland – kein OSS-Verfahren.", zm_meldung: "Keine Lieferungen oder Leistungen an Unternehmen im EU-Ausland.",
  };
  for (const [id, g] of Object.entries(grund)) uebersprungen.push({ id, titel: v(id).titel, grund: g });
  // E-167 (Sifa-Durchsicht): neue Vorlagen Betriebsanweisung Maschinen und Biostoffe, Expositionsverzeichnis
  uebersprungen.push(
    { id: "betriebsanweisung_maschine", titel: v("betriebsanweisung_maschine").titel, grund: "Therapiegeräte werden nach der Gebrauchsanweisung (Medizinprodukte) benutzt; keine Maschine mit eigener Betriebsanweisung." },
    { id: "betriebsanweisung_biostoffe", titel: v("betriebsanweisung_biostoffe").titel, grund: "Physiotherapie ohne invasive Tätigkeiten – keine nennenswerte Exposition gegenüber Biostoffen angenommen; Hygiene über den Hygieneplan (Einstufung fachlich prüfen)." },
    { id: "expositionsverzeichnis", titel: v("expositionsverzeichnis").titel, grund: "Keine Tätigkeiten mit Gefahrstoffen der Kategorie 1A/1B." },
  );
  const genutzt = new Set(docs.map((d) => d.vorlage));
  for (const vl of VORLAGEN) if (!genutzt.has(vl.id) && !uebersprungen.some((u) => u.id === vl.id)) auffaellig.push(`Vorlage ${vl.id} weder erzeugt noch als übersprungen begründet.`);

  // ---------------------------------------------------------------- Kontrollmappe (Auswahl wie in der App)
  const ma = mappenAuswahl(s);
  const mappeErwartet = ["gb-behandlung", "gb-empfang", "unterweisung", "gefahrstoffe", "ba1", "elektro", "hygiene", "vvt", "avv-termin", "avv-az", "dsinfo", "azn", "nachweis1", "nachweis2"];
  const drin = new Set(ma.eintraege.map((e) => e.id));
  const fehlen = mappeErwartet.filter((id) => !drin.has(id));
  vergleichText("Kontrollmappe", "erwartete Nachweise in der Auswahl", fehlen.length ? `fehlen: ${fehlen.join(", ")}` : "alle", "alle");
  vergleichText("Kontrollmappe", "keine Rechnungen, Steuer-, Lohn-, Website-Unterlagen", ma.eintraege.filter((e) => ["rechnung", "euer", "ust_voranmeldung", "steuererklaerung", "lohnkonto", "sv_meldedaten", "impressum", "datenschutzerklaerung_website"].includes(e.vorlage)).map((e) => e.id).join(", ") || "keine", "keine");

  // ---------------------------------------------------------------- Pflichten-Check der App für die Praxis
  const zeile = (p: ReturnType<typeof auswertung>["gilt"][number]): PflichtZeile => ({ id: p.id, titel: p.titel, vorlage: p.vorlage, erzeugt: !!p.vorlage && genutzt.has(p.vorlage), grund: p.grund, termin: p.naechsterTermin, schwere: p.schwere });
  const vorher = s.unterlagen.filter((u) => (u.ausgegeben ?? "") < "2026-01-16");
  const a = auswertung(PROFIL, "2026-01-15", vorher);
  const ende = auswertung(PROFIL, "2026-12-31", s.unterlagen);
  const ids = (x: ReturnType<typeof auswertung>) => new Set([...x.gilt, ...x.gruendung].map((p) => p.id));
  const basis = ids(a);
  const varianten: Bau["pflichten"]["varianten"] = [];
  const variante = (name: string, aenderung: Profil) => {
    const w = ids(auswertung({ ...PROFIL, ...aenderung }, "2026-01-15", vorher));
    varianten.push({ name, nurHier: [...w].filter((x) => !basis.has(x)).sort(), fehltHier: [...basis].filter((x) => !w.has(x)).sort() });
  };
  variante("Rechtsform „Einzelunternehmen“ statt „Freiberuflich (ohne Gewerbe)“", { rechtsform: "einzelunternehmen" });
  variante("Einordnung „Gewerbe“ statt „Freier Beruf“", { "taetigkeit.einordnung": "gewerbe" });
  variante("Kleinunternehmerregelung „ja“ (Umsatz Vorjahr 193.000 € inkl. steuerfreier Heilbehandlungen)", { "ust.kleinunternehmer": true });
  variante("RV-Pflichtgruppe „Pflege“ statt „keine“", { "rentenversicherung.pflichtgruppe": ["pflege"] });
  variante("Ohne Gesundheitsdaten", { "datenverarbeitung.arten": ["kundendaten", "beschaeftigtendaten"] });
  variante("Zusätzlich Branche „Beauty und Kosmetik“", { "taetigkeit.branchen": ["gesundheit_pflege", "beauty_kosmetik"] });
  variante("Elektronische Kasse „ja“", { "kasse.elektronisch": true });
  const pflichten: Bau["pflichten"] = {
    gilt: a.gilt.map(zeile), gruendung: a.gruendung.map(zeile), unbekannt: a.unbekannt.map((p) => ({ id: p.id, titel: p.titel, fragen: p.offeneFragen })), varianten,
    jahresende: ende.gilt.filter((p) => !a.gilt.some((x) => x.id === p.id)).map(zeile),
  };
  // Plausibilität für eine Physiotherapiepraxis (freier Beruf, Heilmittelerbringer, 2 Beschäftigte, keine elektronische Kasse)
  const unplausibel: [RegExp, string][] = [
    [/gewst|gewerbesteuer/, "Gewerbesteuer – freier Beruf"],
    [/gewerbeanzeige|ihk|handwerk/, "Gewerbe/IHK/Handwerk – freier Beruf"],
    [/kasse/, "Kasse – keine elektronische Kasse"],
    [/buchfuehrungspflicht|e_bilanz/, "Buchführungspflicht – freier Beruf"],
    [/kleinunternehmer/, "Kleinunternehmer – Regelbesteuerung"],
    [/sofortmeldung/, "Sofortmeldung – keine Sofortmeldebranche"],
    [/jugendarbeitsschutz/, "keine Jugendlichen"],
    [/zusammenfassende|^steuern\.zm/, "Zusammenfassende Meldung – nur Inlandskunden"],
    [/ki\./, "KI – keine KI-Nutzung"],
    [/hinweisgeber|entgelttransparenz|dsb$/, "Schwellenwerte (Beschäftigtenzahl) nicht erreicht"],
  ];
  for (const p of [...a.gilt, ...a.gruendung]) {
    const hit = unplausibel.find(([re]) => re.test(p.id));
    if (hit) auffaellig.push(`Pflichten-Check: „${p.titel}“ (${p.id}) gilt laut App – fraglich für dieses Profil (${hit[1]}). Grund laut App: ${p.grund || "–"}`);
  }
  const erwartetP: [RegExp, string][] = [
    [/gesundheit_erlaubnisse/, "Berufserlaubnis"], [/datenschutz\.vvt/, "VVT"], [/datenschutz\.dsfa/, "DSFA prüfen (Gesundheitsdaten)"], [/datenschutz\.avv/, "AVV"], [/datenschutz\.tom/, "TOM"], [/datenschutz\.informationspflichten/, "Informationspflichten"],
    [/online\.impressum/, "Impressum"], [/online\.datenschutzerklaerung/, "Datenschutzerklärung"], [/ust_voranmeldung/, "USt-Voranmeldung"], [/ust_jahreserklaerung/, "USt-Jahreserklärung"], [/steuern\.euer/, "EÜR"], [/est_erklaerung/, "ESt-Erklärung"],
    [/arbeitsschutz\.gefaehrdungsbeurteilung/, "Gefährdungsbeurteilung"], [/unterweisung/, "Unterweisung"], [/arbeitsschutz\.gefahrstoffe/, "Gefahrstoffe"], [/dguv_v3/, "DGUV V3"], [/personal\.minijob_grenze/, "Minijob-Grenze"], [/arbeitszeit_milog/, "Arbeitszeit MiLoG"],
    [/mutterschutz_gefaehrdungsbeurteilung/, "Mutterschutz in der GB"], [/e_rechnung_empfang/, "E-Rechnung empfangen"], [/gruendung\.berufsgenossenschaft/, "Berufsgenossenschaft"],
  ];
  for (const [re, was] of erwartetP) if (![...basis].some((x) => re.test(x))) auffaellig.push(`Pflichten-Check: erwartete Pflicht „${was}“ fehlt für dieses Profil.`);

  return { s, docs, auffaellig, infos, belegDateien, xmls, ohneXml, vergleiche, ust, euer: { uebernahme, final: unterlage("euer").daten, ergebnis: euerErgebnis }, uebersprungen, pflichten, profil: PROFIL,
    mappe: { eintraege: ma.eintraege.map((e) => ({ id: e.id, titel: e.titel, vorlage: e.vorlage, datum: e.datum, bereich: e.bereich })), unvollstaendig: ma.unvollstaendig, fehlen } };
}

function leereDatenVon(vid: string, heute: string): Daten {
  const [s1] = anlegen({ ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, ...D.BETRIEB } }, vid, t(heute), "tmp");
  return s1.unterlagen[0]!.daten;
}

/** HTML eines Dokuments genau wie die App (dokumentHtml mit „Mein Betrieb“) */
export function dokHtml(s: Stand, uid: string): string {
  const u = s.unterlagen.find((x) => x.id === uid)!;
  return dokumentHtml(vorlageFuer(u.vorlage) as Vorlage, u.daten, s.betrieb);
}

/** Steuerberater-Paket für einen Zeitraum – mit den Belegdateien */
export function paket(s: Stand, zr: Zeitraum, dateien: Record<string, Uint8Array>): PaketErgebnis {
  return steuerpaket(s, zr, s.steuerberatung, dateien, "2027-02-22T10:00:00");
}

// ---------------------------------------------------------------- Belegdateien (so, wie die Lieferanten sie ausstellen würden)

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function belegHtml(b: D.BelegRoh): string {
  const sm = D.belegSumme(b);
  const [str, ort] = b.anschrift.split("\n");
  const bon = b.art === "brutto" && !b.lieferant.startsWith("Eigenbeleg") && b.kategorie !== "miete" && b.kategorie !== "versicherungen";
  const eigen = b.lieferant.startsWith("Eigenbeleg");
  const kopf = `<div class="lief"><strong>${esc(b.lieferant)}</strong><br>${esc(str ?? "")}<br>${esc(ort ?? "")}</div>`;
  const zeilen = b.pos.map((x) => `<tr><td>${esc(x.text)}${x.menge ? `<br><small>${esc(x.menge)}</small>` : ""}</td><td class="r">${b.p13b ? "–" : `${x.satz} %`}</td><td class="r">${D.eur(x.betrag)} €</td></tr>`).join("");
  const steuer = b.p13b
    ? `<tr><td colspan="3">VAT 0 % – Reverse Charge: Steuerschuldnerschaft des Leistungsempfängers. Customer VAT ID: ${esc(D.BETRIEB.ust_idnr)}</td></tr>`
    : sm.jeSatz.map((x) => `<tr><td>${x.satz ? `${b.art === "brutto" ? "enth. " : ""}USt ${x.satz} %` : "ohne USt"}</td><td class="r">netto ${D.eur(x.netto)} €</td><td class="r">${x.satz ? `${D.eur(x.ust)} €` : "–"}</td></tr>`).join("");
  const css = `body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#222;margin:0}.blatt{${bon ? "width:80mm;margin:10mm auto;border:1px dashed #999;padding:6mm" : "margin:18mm 20mm"}}table{width:100%;border-collapse:collapse;margin-top:6mm}td,th{padding:3px 4px;border-bottom:1px solid #ddd;vertical-align:top}th{text-align:left;border-bottom:2px solid #444}.r{text-align:right;white-space:nowrap}.lief{font-size:${bon ? "10pt" : "11pt"}}h1{font-size:${bon ? "13pt" : "18pt"};margin:6mm 0 2mm}.an{margin-top:10mm}.summe td{font-weight:bold;border-top:2px solid #444}small{color:#666}`;
  const titel = eigen ? "Eigenbeleg" : b.p13b ? "Invoice / Rechnung" : bon ? "Kassenbon" : b.kategorie === "miete" ? "Dauerrechnung (Mietvertrag)" : b.kategorie === "versicherungen" ? "Beitragsrechnung" : "Rechnung";
  const an = bon || eigen ? "" : `<div class="an">${esc(D.BETRIEB.name)}<br>${esc(D.BETRIEB.strasse)}<br>${D.BETRIEB.plz} ${D.BETRIEB.ort}</div>`;
  const fuss = eigen
    ? "Eigenbeleg nach dem Lohnjournal des Lohnbüros, erstellt von Tom Reiter."
    : `${b.zahlung === "bar" ? "Bar bezahlt." : bon ? "Mit Karte bezahlt." : "Zahlbar per Überweisung bzw. SEPA-Lastschrift."}${!bon ? (b.p13b ? " Supplier VAT ID: IE3412987TH." : ` Steuernummer des Lieferanten: 2${b.id.slice(1)}/1${b.id.slice(1)}/40${b.id.slice(1)}1.`) : ""}`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="blatt">${kopf}${an}
<h1>${titel}${b.nummer ? ` ${esc(b.nummer.replace(/^Bon /, ""))}` : ""}</h1><div>Datum: ${D.de(b.datum)}${!bon ? ` · Leistung: ${D.de(b.datum)} bzw. laut Positionen` : ""}</div>
<table><tr><th>${bon ? "Artikel" : "Position"}</th><th class="r">USt</th><th class="r">${b.art === "brutto" ? "Brutto" : "Netto"}</th></tr>${zeilen}</table>
<table>${steuer}<tr class="summe"><td>${eigen ? "Summe" : bon ? "SUMME" : "Rechnungsbetrag"}</td><td></td><td class="r">${D.eur(sm.brutto)} €</td></tr></table>
<p><small>${fuss}</small></p></div></body></html>`;
}
