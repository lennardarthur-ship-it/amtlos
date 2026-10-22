/**
 * Jahres-Szenario „Mira Lindqvist – Grafikdesign“ 2026 (Kleinunternehmerin, freier Beruf, keine Beschäftigten) – der
 * App-Ablauf: Der Stand entsteht mit denselben Funktionen wie in der App (anlegen → felderSetzen → ausgeben/festschreiben
 * → stornieren, bezahltSetzen, belegSetzen, E-Rechnung einlesen, umsaetzeFuer, euerUebernahme, steuerpaket, auswertung).
 * Rohdaten und die unabhängig gerechneten Erwartungswerte stehen in jahr-szenario-freiberuf-daten.ts; hier wird nur
 * verglichen und jede Abweichung als Auffälligkeit gesammelt.
 *
 * Gebündelt und ausgeführt von werkzeuge/jahr-szenario-freiberuf.mjs (Chromium für die PDFs). Aufbau wie das
 * Café-Szenario (jahr-szenario.ts), dessen Dateien unverändert bleiben.
 */
import {
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
import { euerUebernahme, steuerpaket, type PaketErgebnis } from "../src/unterlagen/steuerpaket";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { fussAngaben, fusszeileStempeln } from "../src/unterlagen/fusszeile";
import { mitSchriften } from "../src/unterlagen/schriften";
import { auswertung, type Profil } from "../src/pflichten/check";
import * as D from "./jahr-szenario-freiberuf-daten";
import { MARKE } from "@amtlos/marke";

export { RAENDER, KU_HINWEIS, fussAngaben, fusszeileStempeln, mitSchriften, unzipSync, D };

const t = (iso: string, h = 10) => new Date(`${iso}T${String(h).padStart(2, "0")}:00:00+01:00`);
const menge = (n: number) => String(n).replace(".", ",");
const euro = (c: number) => D.eur(c);
/** formatierte Euro-Angabe der App („1.234,56 €“) → Cent */
const ausEuro = (s: string) => cent(s.replace(/[€\s\u00a0]/g, "")) ?? 0;
const summe = (l: number[]) => l.reduce((a, b) => a + b, 0);

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

export interface Bau {
  s: Stand;
  docs: Dok[];
  auffaellig: string[];
  infos: string[];
  belegDateien: { datei: string; html?: string; xml?: string }[];
  xmls: { datei: string; xml: string; nummer: string }[];
  ohneXml: { nummer: string; fehlt: string[] }[];
  vergleiche: { bereich: string; was: string; app: string; erwartet: string; ok: boolean }[];
  ust: { q: string; werte: Record<string, string>; anzahl: number; vorsteuerStandard: string }[];
  euer: { uebernahme: ReturnType<typeof euerUebernahme>; standard: ReturnType<typeof euerUebernahme>; final: Daten; ergebnis: [string, string][] };
  uebersprungen: { id: string; titel: string; grund: string }[];
  pflichten: { gilt: PflichtZeile[]; gruendung: PflichtZeile[]; unbekannt: { id: string; titel: string; fragen: string[] }[]; varianten: { name: string; nurHier: string[]; fehltHier: string[] }[]; jahresende: PflichtZeile[] };
  profil: Profil;
}

/** Profil der Pflichten-Check-Antworten (wie in der App gegeben) */
export const PROFIL: Profil = {
  "taetigkeit.branchen": ["it_agentur_freelancer"],
  rechtsform: "einzelunternehmen",
  // seit r9 für alle Rechtsformen gefragt (AWV-Meldung, Investitionsprüfung)
  "gesellschafter.auslaendische_investoren": false,
  "taetigkeit.einordnung": "freiberuf",
  bundesland: "BW",
  "beschaeftigte.gesamt": 0,
  "kasse.elektronisch": false,
  "online.website": true,
  "ust.kleinunternehmer": true,
  steuerberater: true,
  gruendungsdatum: D.GRUENDUNG,
  erwerb: "haupt",
  "rentenversicherung.pflichtgruppe": ["keine"],
  "erlaubnis.gewo_paragraphen": ["keine"],
  "handwerk.anlage": "keine",
  "betriebsstaetten.anzahl": 1,
  "umsatz.vorjahr": D.UMSATZ_VORJAHR,
  "umsatz.prognose_laufendes_jahr": D.UMSATZ_PROGNOSE,
  "gewinn.vorjahr": 9800,
  "gewinn.prognose_laufendes_jahr": 11000,
  "ust.zahllast_vorjahr": 0,
  "ust.dauerfristverlaengerung": false,
  "vorauszahlung.est_kst": true,
  "vorauszahlung.gewst": false,
  "kunden.segmente": ["b2b", "b2c"],
  "kunden.regionen": ["inland", "eu", "drittland"],
  "vertrieb.kanaele": ["keine_direktvertrieb"],
  "produkte.arten": ["dienstleistung", "digital"],
  "handel.hohe_bargeschaefte": false,
  "beschaeftigte.minijob": 0,
  "beschaeftigte.azubi": 0,
  "beschaeftigte.jugendlich": 0,
  "arbeitsschutz.elektrische_geraete": true,
  "arbeitsschutz.gefahrstoffe": false,
  "datenverarbeitung.arten": ["kundendaten", "newsletter"],
  "datenschutz.dienstleister": true,
  "ki.nutzung": true,
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
  s = steuerberatungSetzen(s, { kontenrahmen: "SKR03", beraternummer: "41077", mandantennummer: "20318" });
  for (const [id, k] of Object.entries(D.KUNDEN)) s = personSetzen(s, "kunde", { id, ...k } as never, t("2026-01-02"));

  const docs: Dok[] = [];
  const uebersprungen: Bau["uebersprungen"] = [];
  let nr = 0;
  const v = (id: string) => vorlageFuer(id)!;
  const feld = (vid: string, fid: string) => v(vid).abschnitte.flatMap((a) => a.felder).find((f) => f.id === fid) as Extract<Feld, { art: "liste" }>;
  const eintraege = (vid: string, fid: string, l: Eintrag[], heute: string) => l.map((e) => ({ ...neuerEintrag(feld(vid, fid), s.betrieb, heute), ...e }));
  const vorschlag = (vid: string, fid: string, titel: string, heute: string, extra: Eintrag = {}) => {
    const f = feld(vid, fid);
    const vs = (f.vorschlaege ?? []).find((x) => x.titel.startsWith(titel));
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

  // ---------------------------------------------------------------- Ausgangsrechnungen (Kleinunternehmer-Schalter kommt aus dem Profil)
  const ereignisse: { nummer: string; los: () => void }[] = [];
  for (const r of D.RECHNUNGEN) {
    ereignisse.push({
      nummer: r.nummer,
      los: () => {
        const kunde = s.kunden.find((k) => k.id === r.kunde)!;
        const u = dok({
          id: r.id, vorlage: "rechnung", datum: r.datum, worum: r.worum, ordner: "rechnungen", titel: r.gutschrift ? "Gutschrift" : "Rechnung",
          // wie in der App: Steuersatz der Positionen bleibt auf der Vorbelegung (19 %) stehen – der Schalter „Kleinunternehmer“ ist an
          daten: () => ({
            ...personIn(v("rechnung"), kunde),
            datum: r.datum,
            leistung_gleich: !r.leistung && !r.leistungText,
            leistung: r.leistungText ?? (r.leistung ? D.de(r.leistung) : ""),
            zahlungsziel: r.ziel,
            positionen: r.pos.map((p) => ({ bezeichnung: p.bez, menge: menge(p.menge), einheit: p.einheit, preis: euro(p.preis), satz: "19" })),
            // R10: beim EU-Unternehmen (NL) folgt die Nutzerin dem Hinweis der App und wählt die Steuerschuldnerschaft des Empfängers
            hinweise: r.gutschrift ? ["gutschrift"] : D.KUNDE_ORT[r.kunde] === "eu_b2b" ? ["reverse_charge"] : [],
            // Gutschrift: der Fotograf ist selbst Kleinunternehmer (seine Steuernummer kommt aus dem Kunden)
            // R11: Telefon des Leistenden – Pflicht für die E-Rechnung der Gutschrift (Verkäufer, BR-DE-6)
            ...(r.gutschrift ? { leistender_steuer: "ku", kunde_telefon: "0761 4829377" } : {}),
            hinweis: r.hinweis,
          }),
          danach: (x) => {
            vergleichText(`Rechnung ${r.nummer}`, "Schalter „Kleinunternehmer“ aus dem Profil vorbelegt", x.daten.kleinunternehmer === true ? "ja" : "nein", "ja");
            const p = [...(v("rechnung").pruefen?.(x.daten, s.betrieb) ?? []), ...(v("rechnung").hinweise?.(x.daten, s.betrieb, { kleinunternehmer: true }) ?? [])];
            if (p.length) infos.push(`Rechnung ${r.nummer}: Prüfhinweise der App: ${p.join(" | ")}`);
            else if (D.KUNDE_ORT[r.kunde] !== "inland") infos.push(`Rechnung ${r.nummer} (${D.KUNDE_ORT[r.kunde] === "eu_b2b" ? "EU-Unternehmen" : "Drittland"}): die App gibt keinen Prüfhinweis.`);
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
          vergleichText(`Stornorechnung ${st.nummer}`, "Kleinunternehmer-Schalter aus der ursprünglichen Rechnung übernommen", neu.daten.kleinunternehmer === true ? "ja" : "nein", "ja");
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
    vergleich("Rechnung " + x.nummer, "Netto", sm.netto_cent, x.s.netto);
    vergleich("Rechnung " + x.nummer, "Umsatzsteuer (Kleinunternehmerin: 0)", sm.ust_cent, 0);
    vergleich("Rechnung " + x.nummer, "Rechnungsbetrag = Netto", sm.brutto_cent, x.s.brutto);
    const erg = v("rechnung").ergebnis!(u.daten);
    vergleichText("Rechnung " + x.nummer, "Formular-Ergebnis ohne Zeile „Umsatzsteuer“", erg.some((z) => /Umsatzsteuer/.test(z[0])) ? "mit USt-Zeile" : "ohne", "ohne");
    vergleich("Rechnung " + x.nummer, `${x.art === "gutschrift" ? "Gutschriftsbetrag" : "Rechnungsbetrag"} laut Formular`, ausEuro(erg.find((z) => z[0] === "Rechnungsbetrag")![1]), x.vz * x.s.brutto);
    if (fehlt.length) {
      ohneXml.push({ nummer: x.nummer, fehlt });
      continue;
    }
    const xml = xrechnungUbl(daten, KU_HINWEIS);
    xmls.push({ datei: `E-Rechnung-${daten.nummer.replace(/[^A-Za-z0-9-]+/g, "-")}.xml`, xml, nummer: x.nummer });
    const zahlbar = /<cbc:PayableAmount[^>]*>([-\d.]+)</.exec(xml)?.[1];
    vergleich("E-Rechnung " + x.nummer, "PayableAmount (BT-115)", Math.round(Number(zahlbar) * 100), x.vz * x.s.brutto);
    const kategorien = [...xml.matchAll(/<cac:(?:Classified)?TaxCategory>\s*<cbc:ID>([A-Z]+)<\/cbc:ID>\s*<cbc:Percent>([\d.]+)</g)].map((m) => `${m[1]} ${m[2]}`);
    vergleichText("E-Rechnung " + x.nummer, "Steuerkategorien (nur E 0 – befreit/Kleinunternehmer)", [...new Set(kategorien)].join(", "), "E 0");
    vergleich("E-Rechnung " + x.nummer, "TaxAmount (BT-110) = 0", Math.round(Number(/<cac:TaxTotal>\s*<cbc:TaxAmount[^>]*>([-\d.]+)</.exec(xml)?.[1] ?? "NaN") * 100), 0);
    // R10: an das EU-Unternehmen (Steuerschuldnerschaft gewählt) steht dieser Hinweis statt des § 19-Hinweises
    if (D.KUNDE_ORT[x.kunde] === "eu_b2b") vergleichText("E-Rechnung " + x.nummer, "EU-Unternehmen: Hinweis „Steuerschuldnerschaft des Leistungsempfängers“ statt § 19", xml.includes("Steuerschuldnerschaft des Leistungsempfängers") && !xml.includes(KU_HINWEIS) ? "ja" : "nein", "ja");
    else if (!xml.includes(KU_HINWEIS)) auffaellig.push(`E-Rechnung ${x.nummer}: Kleinunternehmer-Hinweis fehlt im XML.`);
    if (x.art === "gutschrift") {
      const typ = /<cbc:InvoiceTypeCode>(\d+)</.exec(xml)?.[1];
      const verkaeufer = /<cac:AccountingSupplierParty>[\s\S]*?<cbc:RegistrationName>([^<]*)</.exec(xml)?.[1];
      vergleichText("E-Rechnung " + x.nummer + " (Gutschrift)", "Rechnungsart (BT-3): 389 = Gutschrift (self-billed invoice)", typ ?? "–", "389");
      vergleichText("E-Rechnung " + x.nummer + " (Gutschrift)", "Verkäufer (BG-4) = der leistende Fotograf", verkaeufer ?? "–", D.KUNDEN.kf.name);
    }
    if (D.KUNDE_ORT[x.kunde] === "eu_b2b") infos.push(`E-Rechnung ${x.nummer} (Niederlande, B2B): Steuerkategorie ${[...new Set(kategorien)].join(", ")} mit Befreiungsgrund „${KU_HINWEIS}“ – der Umsatz ist in Deutschland nicht steuerbar (Ort der Leistung NL), der Empfänger schuldet die Steuer dort; Kategorie AE/O wäre zu prüfen.`);
  }
  const ohneErwartet = D.RECHNUNGEN.filter((r) => !("email" in D.KUNDEN[r.kunde]) || r.leistungText).map((r) => r.nummer);
  infos.push(`Ohne XRechnung (App: Angaben fehlen): ${ohneXml.map((o) => `${o.nummer} (${o.fehlt.join(", ")})`).join("; ") || "keine"}. Erwartet: Privatkunden ohne E-Mail und die Rechnung mit Leistungszeitraum als Text (${ohneErwartet.join(", ")}).`);
  const zeitraum = ohneXml.find((o) => o.nummer === "2026-003");
  if (zeitraum) auffaellig.push(`E-Rechnung 2026-003 (Verlag, B2B): keine XRechnung, weil der Leistungszeitraum „02.03.2026 – 27.03.2026“ nicht als Datum erkannt wird (${zeitraum.fehlt.join(", ")}). XRechnung kennt den Leistungszeitraum (BG-14, BT-73/74); das Feld der Vorlage sagt selbst „Datum oder Zeitraum der Leistung“.`);

  // ---------------------------------------------------------------- Belege (Kleinunternehmerin: ohne Vorsteuerabzug)
  const belegDateien: Bau["belegDateien"] = [];
  for (const b of D.BELEGE) {
    const jetzt = t(b.datum, 18).toISOString();
    if (b.datei === "xml") {
      const xml = xrechnungUbl(
        {
          nummer: b.nummer!, rechnungsdatum: b.datum, leistungsdatum: "2026-10-12", faellig_am: "2026-10-28",
          steller: { name: b.lieferant, strasse: "Bahnhofstraße 21", plz: "79346", ort: "Endingen am Kaiserstuhl", land: "DE", email: "rechnung@druckerei-kaiserstuhl.example", telefon: "07642 92810", steuernummer: "06058/41207", ust_idnr: "DE298114756", iban: "DE10680501010012345678", bic: "FRSPDE66XXX" },
          kunde: { name: D.BETRIEB.name, strasse: D.BETRIEB.strasse, plz: D.BETRIEB.plz, ort: D.BETRIEB.ort, land: "DE", email: D.BETRIEB.email, kaeufer_referenz: "Kd.-Nr. 30417", geschaeftskunde: true },
          positionen: D.ERECHNUNG_POS.map((p) => ({ bezeichnung: p.bez, menge: p.menge, einheit: "stueck", einheit_code: "C62", preis_cent: p.preis, ust_satz: p.satz })),
          kleinunternehmer: false,
          hinweis: "Zahlbar bis 28.10.2026 ohne Abzug.",
        },
        KU_HINWEIS,
      );
      const gelesen = eRechnungLesen(xml);
      if (!gelesen) {
        auffaellig.push(`E-Rechnung ${b.nummer} ließ sich nicht lesen (eRechnungLesen → null).`);
        continue;
      }
      const roh = belegAusERechnung(gelesen, b.id, jetzt, { kleinunternehmer: true }); // wie die App: Kleinunternehmer ohne Vorsteuer
      vergleichText("E-Rechnung einlesen", `${b.nummer}: Vorsteuer-Schalter nach dem Einlesen (Kleinunternehmerin darf keine Vorsteuer abziehen)`, roh.vorsteuer ? "an" : "aus", "aus");
      infos.push(`E-Rechnung ${b.nummer} eingelesen: Lieferant „${roh.lieferant}“, Kategorie zunächst „${kategorieFuer(roh.kategorie).titel}“, Vorsteuer ${roh.vorsteuer ? "AN" : "aus"} (von Hand auf „Werbung“ und Vorsteuer aus gestellt). Notiz: ${(roh.notiz ?? "").replace(/\n/g, " | ")}`);
      s = belegSetzen(s, { ...roh, kategorie: b.kategorie, vorsteuer: false, bezahlt: b.bezahlt, datei: `${b.id}.xml` }, t(b.datum, 18));
      belegDateien.push({ datei: `${b.id}.xml`, xml });
    } else {
      const sm = D.belegSumme(b);
      const beleg: Beleg = {
        id: b.id, datum: b.datum, lieferant: b.lieferant, nummer: b.nummer, kategorie: b.kategorie,
        steuer: sm.jeSatz.map((x) => ({ satz: x.satz, brutto_cent: x.brutto })),
        vorsteuer: false, zahlung: b.zahlung, bezahlt: b.bezahlt, notiz: b.notiz ?? null, datei: `${b.id}.pdf`, quelle: "foto", erstellt: jetzt, geaendert: jetzt,
        // R10: Adobe (Irland) als § 13b-Beleg – auch die Kleinunternehmerin schuldet die Steuer (Kz 46/47, ohne Kz 67)
        ...(b.p13b ? { steuerschuld: "eu" as const } : {}),
      };
      s = belegSetzen(s, beleg, t(b.datum, 18));
      belegDateien.push({ datei: `${b.id}.pdf`, html: belegHtml(b) });
    }
    const app = belegSummen(s.belege.find((x) => x.id === b.id)!);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Brutto", app.brutto_cent, D.belegSumme(b).brutto);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Vorsteuer (Kleinunternehmerin: 0)", app.vorsteuer_cent, 0);
  }
  /** derselbe Stand, wie ihn die Standardwerte der App ergäben: neuer Beleg „Vorsteuer abziehbar“ an (Belege.tsx), E-Rechnung ebenso */
  const sStandard: Stand = { ...s, belege: s.belege.map((b) => ({ ...b, vorsteuer: true })) };

  // ---------------------------------------------------------------- Unterlagen zum Betrieb (Vorlagen)
  const B = D.BETRIEB;
  dok({ id: "gewerbe", vorlage: "gewerbeanmeldung", datum: "2023-03-20", worum: "Gewerbeanmeldung zur Gründung 01.04.2023 – nur erzeugt, um die Vorlage zu prüfen: Grafikdesign wird meist als freier Beruf (§ 18 EStG) eingeordnet, dann ist keine Gewerbeanmeldung nötig (siehe Pflichten-Check).",
    daten: () => ({ name: D.INHABERIN.name, geburtsname: D.INHABERIN.geburtsname, geburtsdatum: D.INHABERIN.geburtsdatum, geburtsort: D.INHABERIN.geburtsort, staatsangehoerigkeit: D.INHABERIN.staatsangehoerigkeit, wohnanschrift: D.INHABERIN.wohnanschrift, rechtsform: "Einzelunternehmen",
      taetigkeit: "Grafikdesign: Gestaltung von Logos, Drucksachen, Verpackungen und Websites; Illustration; Satz und Layout", beginn: D.GRUENDUNG, erwerb: "haupt", beschaeftigte: "0", erlaubnis: "keine" }) });

  dok({ id: "impressum", vorlage: "impressum", datum: "2026-01-09", worum: "Impressum der Portfolio-Website: Einzelunternehmerin, USt-IdNr. aus „Mein Betrieb“, keine Wirtschafts-ID, verantwortlich für Inhalte, keine Teilnahme an Verbraucherschlichtung.",
    daten: () => ({ rechtsform: "Einzelunternehmen", vertreten: "Mira Lindqvist", redaktion: `Mira Lindqvist, ${B.strasse}, ${B.plz} ${B.ort}`, vsbg: "nicht_bereit" }) });
  {
    // Verhalten ohne USt-IdNr. (viele Kleinunternehmer haben keine): gleiches Impressum mit leerer USt-IdNr. in „Mein Betrieb“
    // nur der sichtbare Teil: ohne <head> (Meta-Angaben für die Fußzeile) und ohne die Fußleiste, die nur Briefe zeigen (html.ts: .fussleiste display:none)
    const sichtbar = (h: string) => h.replace(/<head>[\s\S]*?<\/head>/, "").replace(/<meta[^>]*>/g, "").replace(/<footer class="fussleiste">[\s\S]*?<\/footer>/, "");
    const ohne = sichtbar(dokumentHtml(v("impressum"), unterlage("impressum").daten, { ...s.betrieb, ust_idnr: "" }));
    const mit = sichtbar(dokumentHtml(v("impressum"), unterlage("impressum").daten, s.betrieb));
    const zeigt = (h: string) => (/Umsatzsteuer-Identifikationsnummer|USt-IdNr/.test(h) ? "USt-IdNr. genannt" : "keine USt-IdNr. genannt") + (/Steuernummer|06469\/27531/.test(h) ? ", Steuernummer genannt" : "") + (/Kleinunternehmer|§ 19/.test(h) ? ", Kleinunternehmer-Hinweis" : "");
    infos.push(`Impressum mit USt-IdNr. in „Mein Betrieb“: ${zeigt(mit)}; ohne USt-IdNr.: ${zeigt(ohne)}`);
    if (/06469\/27531/.test(ohne)) auffaellig.push("Impressum ohne USt-IdNr. druckt die Steuernummer – die gehört nicht ins Impressum (Missbrauchsgefahr).");
  }

  dok({ id: "dse", vorlage: "datenschutzerklaerung_website", datum: "2026-01-09", worum: "Datenschutzerklärung der Portfolio-Website: Hosting bei Schwarzwaldhost, Server-Logfiles 7 Tage, Kontaktformular, Newsletter (Double-Opt-in, Briefkasten Mailservice), Schriften lokal eingebunden, Link zu Instagram und Behance, keine Cookies.",
    daten: () => ({ website: "https://www.mira-lindqvist.example", module: ["hosting", "server_logfiles", "kontakt", "newsletter", "google_fonts_lokal", "social_media_links", "widerruf_einwilligung"], hoster_name: "Schwarzwaldhost GmbH", hoster_anschrift: "Lörracher Straße 16, 79115 Freiburg im Breisgau", logfile_tage: "7", kontaktformular: true,
      newsletter_themen: "Neue Arbeiten aus dem Portfolio, freie Termine und Workshops (etwa viermal im Jahr)", newsletter_dienst: "Briefkasten Mailservice GmbH, Große Elbstraße 145, 22767 Hamburg", netzwerke: "Instagram und Behance", stand: "2026-01-09" }) });
  {
    const h = dokHtml(s, "dse");
    vergleichText("Datenschutzerklärung", "Newsletter: Double-Opt-in beschrieben", /Double-Opt-in|Double Opt-in|Bestätigungs/i.test(h) ? "ja" : "nein", "ja");
    vergleichText("Datenschutzerklärung", "Kontaktformular erwähnt", /Kontaktformular/.test(h) ? "ja" : "nein", "ja");
    vergleichText("Datenschutzerklärung", "Schriften lokal: keine Verbindung zu Google", /lokal/i.test(h) ? "ja" : "nein", "ja");
  }

  dok({ id: "avv", vorlage: "avv", datum: "2023-04-03", worum: "Auftragsverarbeitungsvertrag mit dem Webhoster Schwarzwaldhost GmbH (Hosting, Kontaktformular-Mails, Postfächer).",
    daten: () => ({ rolle: "auftraggeber", partner: "Schwarzwaldhost GmbH", partner_anschrift: "Lörracher Straße 16\n79115 Freiburg im Breisgau", hauptvertrag: "Webhosting-Vertrag „Kreativ M“ vom 03.04.2023 (Kundennummer SH-11873)",
      gegenstand: "Hosting der Website\nBereitstellung von E-Mail-Postfächern und Weiterleitung der Kontaktformular-Nachrichten", zweck: "Bereitstellung der Portfolio-Website www.mira-lindqvist.example und der geschäftlichen E-Mail-Kommunikation", dauer: "für die Laufzeit des Hauptvertrags",
      datenarten: "Name\nKontaktdaten (Telefon, E-Mail)\nInhalte von E-Mails und Kontaktanfragen\nIP-Adressen und Server-Logfiles", betroffene: "Kundinnen und Kunden\nInteressenten\nBesucherinnen und Besucher der Website",
      unterauftrag: "Rechenzentrum: Rheintal Datacenter GmbH, Karlsruhe (Serverstandort Deutschland)", tom: "siehe Anlage (TOM-Beschreibung des Auftragsverarbeiters)", ort_datum: "Freiburg im Breisgau" }) });

  dok({ id: "dsinfo", vorlage: "datenschutzinformation", datum: "2026-01-09", worum: "Datenschutzinformation nach Art. 13 DSGVO für Kundinnen und Kunden (Aufträge, Rechnungen, Kontaktanfragen, Newsletter).",
    daten: () => ({ fuer_wen: "Kundinnen und Kunden", verarbeitungen: ["Kundenverwaltung / Kundenkartei", "Rechnungsstellung und Buchhaltung", "Kontaktanfragen (Kontaktformular, E-Mail, Telefon)", "Geschäftliche E-Mail-Kommunikation", "E-Mail-Newsletter / E-Mail-Werbung"], interessen: "Sicherer und störungsfreier Betrieb unserer IT\nDurchsetzung und Abwehr von Ansprüchen\nInformation unserer Bestandskundschaft über eigene Angebote", bereitstellung: "vertrag", stand: "2026-01-09" }) });

  dok({ id: "vvt", vorlage: "datenschutz_dokumentation", datum: "2026-01-12", worum: "Verzeichnis der Verarbeitungstätigkeiten: 7 Tätigkeiten aus den Vorschlägen (Kunden, Rechnungen, Website, Kontakt, E-Mail, Newsletter, Lieferanten) und 12 TOM; Dienstleister Schwarzwaldhost und Briefkasten Mailservice (je mit AVV), Adobe (Cloud, Drittland-Bezug), Steuerbüro (eigenverantwortlich).",
    daten: (h) => ({
      verantwortlich: "Mira Lindqvist",
      verarbeitungen: [
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kundenverwaltung", h, { bezeichnung: "Kundenverwaltung (Auftraggeberinnen und Auftraggeber)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Rechnungsstellung", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Betrieb der Website", h, { empfaenger: "Schwarzwaldhost GmbH (Auftragsverarbeiter)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kontaktanfragen", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Geschäftliche E-Mail", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "E-Mail-Newsletter", h, { empfaenger: "Briefkasten Mailservice GmbH (Auftragsverarbeiter)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lieferanten", h),
      ],
      tom: [
        "Festplattenverschlüsselung auf allen Laptops", "Geräteverschlüsselung und Bildschirmsperre", "Website ausschließlich über HTTPS", "WLAN mit aktueller Verschlüsselung", "Starke, individuelle Passwörter", "Zwei-Faktor-Authentisierung",
        "Automatische Bildschirmsperre", "Auftragsverarbeitungsverträge", "Automatische Sicherheitsupdates", "Regelmäßige Datensicherung", "Mindestens eine Sicherungskopie", "Jährliche Überprüfung des Verzeichnisses",
      ].map((x) => vorschlag("datenschutz_dokumentation", "tom", x, h, { umgesetzt_am: "2023-04-01", verantwortlich: "Mira Lindqvist" })),
      dienstleister: eintraege("datenschutz_dokumentation", "dienstleister", [
        { name: "Schwarzwaldhost GmbH", leistung: "Website-Hosting", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2023-04-03", drittland: "keine Übermittlung in Drittländer" },
        { name: "Briefkasten Mailservice GmbH", leistung: "Newsletter-Versand", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2025-03-01", drittland: "keine Übermittlung in Drittländer" },
        { name: "Adobe Systems Software Ireland Ltd.", leistung: "Cloud-Speicher (Creative Cloud)", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2024-01-08", drittland: "USA (EU-U.S. Data Privacy Framework, Standardvertragsklauseln)" },
        { name: "Steuerbüro Kaltenbach", leistung: "Steuerberatung (eigenverantwortlich, keine Auftragsverarbeitung)", auftragsverarbeitung: false, drittland: "keine Übermittlung in Drittländer" },
      ], h),
    }) });

  dok({ id: "verfahren", vorlage: "verfahrensdokumentation", datum: "2026-01-12", worum: `Verfahrensdokumentation (GoBD) für eine Einzelperson ohne Kasse: ${MARKE.name} für Rechnungen/Belege, Online-Banking, Upload an das Steuerbüro einmal im Jahr; Belege überwiegend digital, wenige Kassenbons fotografiert.`,
    daten: () => ({ version: "1.0", verantwortlich: "Mira Lindqvist",
      organisation: "Grafikdesign als freier Beruf, Einzelunternehmerin ohne Beschäftigte, Büro in der eigenen Wohnung. Kleinunternehmerin nach § 19 UStG; Gewinnermittlung durch Einnahmen-Überschuss-Rechnung.",
      steuerberatung: "Jahresabschluss durch die Steuerberatung; laufende Buchführung im Betrieb",
      systeme: eintraege("verfahrensdokumentation", "systeme", [
        { name: `${MARKE.name} (App, iPhone)`, zweck: "Rechnungsprogramm", version: "seit 01/2026" },
        { name: "Sparkasse Freiburg Online-Banking", zweck: "Online-Banking", version: "seit 04/2023" },
        { name: "Steuerbüro Kaltenbach – Upload-Portal", zweck: "Upload-Portal der Steuerberatung", version: "seit 03/2024" },
      ], "2026-01-12"),
      belegeingang: ["E-Mail mit PDF-Anhang", "Download aus Kunden-/Lieferantenportal", "E-Rechnung (XRechnung/ZUGFeRD) per E-Mail oder Portal", "Papier (Post/persönlich)", "Eigenbeleg"],
      belegart: ["originär digital (Muster 4.3)", "originär Papier, Ablage in Papier (Muster 4.1)"],
      ablage: ["Buchhaltungssoftware mit Belegarchiv", "Upload an Steuerberater (z. B. Kanzlei-Portal)", "Papierordner (chronologisch/nach Belegart)"],
      erfassung: `Belege werden monatlich in ${MARKE.name} erfasst (Datei bzw. Foto) und einmal im Jahr als Paket an das Steuerbüro übermittelt.\nAusgangsrechnungen werden fortlaufend nummeriert in ${MARKE.name} erstellt und beim Teilen festgeschrieben; Korrekturen nur per Stornorechnung.`,
      scannen: false, sicherung_intervall: "wöchentlich", sicherung_ort: ["Cloud-Backup", "externer Datenträger (Festplatte/NAS) außerhalb der Betriebsräume"], e_rechnung: true,
      zugriff: "Zugriff auf Buchhaltung und Belege nur für Inhaber/in und Steuerberatung",
      kontrollen: "Monatlicher Abgleich von Kontoauszügen und Buchungen\nVor der Zahlung: Eingangsrechnungen sachlich und rechnerisch prüfen",
      aenderungen: eintraege("verfahrensdokumentation", "aenderungen", [{ datum: "2026-01-12", aenderung: `Umstellung der Rechnungsstellung und Belegerfassung von Tabellenkalkulation auf ${MARKE.name}.` }], "2026-01-12") }) });

  dok({ id: "aufbewahrung", vorlage: "aufbewahrung", datum: "2026-01-12", worum: "Aufbewahrungsplan mit den Startzeilen der App (Fristbeginn 2026, Ablageort).",
    daten: (h) => ({ eintraege: (leereDatenVon("aufbewahrung", h).eintraege as Eintrag[]).map((e) => ({ ...e, letzte: "2026", ort: `${MARKE.name} (verschlüsselt), Cloud-Backup; Papier im Büroschrank` })) }) });
  {
    const zeilen = (unterlage("aufbewahrung").daten.eintraege as Eintrag[]).map((e) => String(e.art));
    const fremd = zeilen.filter((z) => /Lohn|Kasse|Personal|Beschäftigt|Arbeitszeit/i.test(z));
    if (fremd.length) infos.push(`Aufbewahrungsplan: Startzeilen, die für eine Freiberuflerin ohne Beschäftigte und Kasse nicht passen: ${fremd.join("; ")}.`);
  }

  // ---------------------------------------------------------------- Umsatzsteuer: Was liefert „Aus Rechnungen übernehmen“ für eine Kleinunternehmerin?
  const ust: Bau["ust"] = [];
  const versteuerung = (s.betrieb.versteuerung === "soll" ? "soll" : "ist") as "soll" | "ist";
  for (const q of D.umsatzQuartale()) {
    const erg = umsaetzeFuer(s.unterlagen, q.q, s.betrieb, versteuerung, s.belege);
    const std = umsaetzeFuer(sStandard.unterlagen, q.q, sStandard.betrieb, versteuerung, sStandard.belege);
    if (!erg) continue;
    ust.push({ q: q.q, werte: erg.werte, anzahl: erg.anzahl, vorsteuerStandard: std?.werte.vorsteuer ?? "–" });
    vergleich(`USt-Übernahme ${q.q}`, "Umsätze zu 19 % (Kleinunternehmerin: 0)", ausEuro(erg.werte.umsatz_19 ?? "0"), 0);
    vergleich(`USt-Übernahme ${q.q}`, "Umsätze zu 7 % (Kleinunternehmerin: 0)", ausEuro(erg.werte.umsatz_7 ?? "0"), 0);
    vergleich(`USt-Übernahme ${q.q}`, "Vorsteuer (Belege ohne Vorsteuerabzug)", ausEuro(erg.werte.vorsteuer ?? "0"), 0);
  }
  // die einzige Voranmeldung, die die Kleinunternehmerin abgeben muss: Q1 wegen § 13b (Adobe)
  const q1 = D.umsatzQuartale()[0]!;
  dok({ id: "ust-q1", vorlage: "ust_voranmeldung", datum: "2026-04-08", worum: `USt-Voranmeldung Q1 2026 – nötig wegen § 13b (Adobe, Bemessungsgrundlage ${euro(q1.p13b)} €, Steuer ${euro(q1.steuer13b)} €). Erzeugt mit „Aus Rechnungen übernehmen“, um zu zeigen, was die App für eine Kleinunternehmerin einträgt; die § 13b-Steuer hat kein Feld und steht nur in der Notiz.`,
    daten: () => ({}),
    danach: () => {
      const erg = umsaetzeFuer(s.unterlagen, q1.q, s.betrieb, versteuerung, s.belege)!;
      s = felderSetzen(s, "ust-q1", { ...erg.werte, notiz: `Kleinunternehmerin (§ 19 UStG). Anzumelden ist nur die Steuer nach § 13b UStG für das Software-Abo von Adobe (Irland): Bemessungsgrundlage ${euro(q1.p13b)} € (Kz 46), Steuer ${euro(q1.steuer13b)} € (Kz 47). Die App hat dafür kein Feld.` }, t("2026-04-08", 9));
    } });
  {
    const erg = v("ust_voranmeldung").ergebnis!(unterlage("ust-q1").daten);
    infos.push(`USt-Voranmeldung Q1 (Formular-Ergebnis der App): ${erg.map(([a, b]) => `${a} ${b}`).join(", ")} – erwartet wäre eine Zahllast von ${euro(q1.steuer13b)} € (§ 13b).`);
    const z = erg.find((x) => /Zahllast|Erstattung/.test(x[0]));
    if (z) vergleich("USt-Voranmeldung Q1 (fertig)", "Zahllast (nur § 13b-Steuer aus dem Adobe-Abo)", ausEuro(z[1]) * (z[0] === "Erstattung" ? -1 : 1), q1.steuer13b);
  }

  // ---------------------------------------------------------------- EÜR 2026 (Übernahme; AfA und § 13b-Zahlung von Hand, wie die App es verlangt)
  const eu = D.euerUnabhaengig();
  let uebernahme!: ReturnType<typeof euerUebernahme>;
  const standard = euerUebernahme(sStandard, "2026");
  dok({ id: "euer", vorlage: "euer", datum: "2027-02-20", worum: "EÜR 2026: „Aus Rechnungen und Belegen übernehmen“ (euerUebernahme), danach von Hand ergänzt, wie es der Hinweis der App verlangt: AfA Laptop (brutto, 3 Jahre, 11/12) und die an das Finanzamt gezahlte § 13b-Steuer (10.04.2026).",
    daten: () => ({}),
    danach: () => {
      uebernahme = euerUebernahme(s, "2026");
      s = felderSetzen(s, "euer", { jahr: "2026", einnahmen: uebernahme.einnahmen, ausgaben: uebernahme.ausgaben }, t("2027-02-20", 9));
      const zahl = (l: Record<string, string>[], k: string) => l.filter((x) => x.kategorie === k).reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0);
      // R11: die Kleinunternehmer-Zeile enthält den Gesamtbetrag; die nicht steuerbaren Umsätze (NL, CH) nur als „davon“ (im Text, keine eigene Zeile – sonst doppelt)
      vergleich("EÜR-Übernahme", "Einnahmen in Zeile „Umsatzsteuerlicher Kleinunternehmer“ (Gesamtbetrag ohne Gutschrift)", zahl(uebernahme.einnahmen, "Umsatzsteuerlicher Kleinunternehmer"), eu.einnahmen);
      const davon = /davon nicht steuerbar[^:]*: ([\d.]+,\d{2}) €/.exec(uebernahme.einnahmen.find((x) => x.kategorie === "Umsatzsteuerlicher Kleinunternehmer")?.text ?? "")?.[1];
      vergleich("EÜR-Übernahme", "davon nicht steuerbare Umsätze (NL, CH) im Text der Kleinunternehmer-Zeile", davon ? ausEuro(davon) : 0, eu.einnahmenAusland);
      vergleich("EÜR-Übernahme", "keine eigene Zeile für die nicht steuerbaren Umsätze (keine Doppelzählung)", zahl(uebernahme.einnahmen, "Nicht steuerbare Umsätze sowie Umsätze nach § 19 Absatz 3 Satz 1 Nummer 1 und 2 UStG"), 0);
      vergleich("EÜR-Übernahme", "keine Zeile „Vereinnahmte Umsatzsteuer“", zahl(uebernahme.einnahmen, "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben"), 0);
      vergleich("EÜR-Übernahme", "keine Zeile „Gezahlte Vorsteuerbeträge“", zahl(uebernahme.ausgaben, "Gezahlte Vorsteuerbeträge"), 0);
      vergleich("EÜR-Übernahme", "Betriebsausgaben aus Belegen (brutto, ohne Anlage)", uebernahme.ausgaben.filter((x) => !(x.text ?? "").startsWith("Gutschriften an Leistende")).reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0), eu.ausgabenBelege);
      for (const [kat, w] of Object.entries(eu.nachKategorie)) {
        const titel = kategorieFuer(kat).titel;
        const zeile = uebernahme.ausgaben.find((x) => (x.text ?? "").startsWith(titel));
        vergleich("EÜR-Übernahme", `Kategorie ${titel}`, zeile ? ausEuro(zeile.betrag ?? "0") : 0, w.betrag);
      }
      vergleich("EÜR-Übernahme", "Gutschrift an den Fotografen (2026-011) als Ausgabe (Fremdleistung)", zahl(uebernahme.ausgaben, "Bezogene Leistungen"), eu.fremd);
      vergleichText("EÜR-Übernahme", "Anlagen (Laptop) gemeldet", String(uebernahme.anlagen), "1");
      vergleichText("EÜR-Übernahme", "unbezahlte Rechnungen des Jahres", String(uebernahme.unbezahlt), "1");
      vergleichText("EÜR-Übernahme", "Hinweis: AfA selbst ergänzen", /AfA/.test(uebernahme.hinweis) ? "ja" : "nein", "ja");
      const ho = uebernahme.ausgaben.find((x) => (x.text ?? "").startsWith(kategorieFuer("homeoffice").titel));
      vergleichText("EÜR-Übernahme", "Homeoffice-Tagespauschale (Eigenbeleg b20) in der Zeile der Tagespauschale/des Arbeitszimmers", ho?.kategorie ?? "–", "Aufwendungen für ein häusliches Arbeitszimmer");
      // Standardwerte (Vorsteuer an): was eine Kleinunternehmerin bekäme, die den Schalter nicht ausschaltet
      const vstStd = zahl(standard.ausgaben, "Gezahlte Vorsteuerbeträge");
      if (vstStd) auffaellig.push(`EÜR-Übernahme mit den Standardwerten der App (Beleg „Vorsteuer abziehbar“ an): Zeile „Gezahlte Vorsteuerbeträge“ ${euro(vstStd)} € und die Kategorien netto – für eine Kleinunternehmerin falsch dargestellt (Summe gleich, aber Anlage EÜR Zeile „Vorsteuer“ dürfte leer sein; in der USt-Übernahme stünde Vorsteuer, die sie nicht abziehen darf).`);
      // von Hand ergänzen
      const d = unterlage("euer").daten;
      const anlage = D.BELEGE.find((b) => b.id === D.AFA.beleg)!;
      const aus = [...(d.ausgaben as Eintrag[]), { datum: D.UST_13B.zahltag, text: "Umsatzsteuer nach § 13b UStG (Adobe, Voranmeldung Q1/2026)", kategorie: "An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer", betrag: euro(eu.ust13b) }];
      s = felderSetzen(s, "euer", { ausgaben: aus, afa: [{ text: `Notebook 14 Zoll (${euro(D.belegSumme(anlage).brutto)} € brutto = Anschaffungskosten der Kleinunternehmerin, 02/2026, 3 Jahre, 11/12)`, betrag: euro(eu.afa) }] }, t("2027-02-20", 10));
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
  const ku = D.kuUmsatz();
  dok({ id: "steuer", vorlage: "steuererklaerung", datum: "2027-03-01", worum: "Zusammenstellung für die Einkommensteuer 2026 (Anlage S, freiberuflich): Gewinn aus der EÜR der App, Umsatz (vereinnahmt), ESt-Vorauszahlungen 4 × 350 €, Krankenversicherung und Basisrente.",
    daten: (h) => ({ jahr: "2026", arten: ["est"], gewinn: `${gewinn[0] === "Verlust" ? "-" : ""}${gewinn[1].replace(/[€\s\u00a0]/g, "")}`, umsatz: euro(ku.inland + ku.ausland),
      vorauszahlungen: eintraege("steuererklaerung", "vorauszahlungen", [1, 2, 3, 4].map((q) => ({ art: `Einkommensteuer Q${q}`, betrag: "350,00" })), h),
      weiteres: eintraege("steuererklaerung", "weiteres", [{ was: "Kranken- und Pflegeversicherung (freiwillig gesetzlich)", betrag: "3.120,00", beleg: true }, { was: "Basisrente (Rürup), Beiträge 2026", betrag: "1.200,00", beleg: true }], h),
      notiz: `Kleinunternehmerin (§ 19 UStG): keine Umsatzsteuer-Jahreserklärung; § 13b-Steuer (Adobe, ${euro(eu.ust13b)} €) mit der Voranmeldung Q1 angemeldet. Freier Beruf: keine Gewerbesteuer. Kleinunternehmergrenze: Gesamtumsatz 2026 (Inland, vereinnahmt) ${euro(ku.inland)} € – unter 25.000 €, also auch 2027 Kleinunternehmerin.` }) });
  vergleich("Steuererklärung", "Gewinn = EÜR (unabhängig)", ausEuro(gewinn[1]) * (gewinn[0] === "Verlust" ? -1 : 1), eu.ergebnis);

  // ---------------------------------------------------------------- übersprungene Vorlagen
  const keinPersonal = "Keine Beschäftigten.";
  const grund: Record<string, string> = {
    bilanz_guv: "Freiberuflerin: keine Buchführungspflicht (§ 140/141 AO gelten nicht für freie Berufe) – EÜR.",
    kassenbuch: "Keine Bargeldkasse; die wenigen Barbelege sind privat bezahlt (Einlage).",
    kassenmeldung: "Keine elektronische Kasse.",
    datenpanne: "Keine Datenpanne im Jahr 2026.",
    arbeitszeitnachweis: keinPersonal, nachweis_arbeitsbedingungen: keinPersonal, sv_meldedaten: keinPersonal, lohnkonto: keinPersonal,
    ki_kompetenz: "Art. 4 KI-VO betrifft Personal und Personen, die im Auftrag KI-Systeme bedienen – ohne Beschäftigte hier nicht erzeugt (Pflichten-Check prüfen).",
    gefaehrdungsbeurteilung: keinPersonal, unterweisung: keinPersonal, gefahrstoffverzeichnis: "Keine Gefahrstoffe, keine Beschäftigten.", betriebsanweisung: "Keine Gefahrstoffe, keine Beschäftigten.", pruefprotokoll_elektro: "DGUV V3 gilt für Unternehmer mit Beschäftigten (Unfallversicherung); ohne Beschäftigte nicht erzeugt.",
    handelsregister: "Freier Beruf, kein Handelsgewerbe – kein Eintrag.", transparenzregister: "Natürliche Person – keine Mitteilung.",
    ifsg_belehrung: "Keine Lebensmittel.", allergene: "Keine Lebensmittel.", haccp: "Keine Lebensmittel.", hautschutzplan: "Keine Beauty-Tätigkeit.", hygieneplan: "Keine Beauty-Tätigkeit.",
    // StB-Prüfung (5.2, C-9): Kleinunternehmerin – keine OSS-Erklärung und keine Zusammenfassende Meldung (§ 18a Abs. 4 UStG)
    oss_meldung: "Kleinunternehmerin – kein OSS-Verfahren.", zm_meldung: "Kleinunternehmerin – keine Zusammenfassende Meldung (§ 18a Abs. 4 UStG).",
  };
  for (const [id, g] of Object.entries(grund)) uebersprungen.push({ id, titel: v(id).titel, grund: g });
  // E-167 (Sifa-Durchsicht): neue Vorlagen Betriebsanweisung Maschinen und Biostoffe, Expositionsverzeichnis
  uebersprungen.push(
    { id: "betriebsanweisung_maschine", titel: v("betriebsanweisung_maschine").titel, grund: "Keine Beschäftigten, keine Maschinen." },
    { id: "betriebsanweisung_biostoffe", titel: v("betriebsanweisung_biostoffe").titel, grund: "Keine Beschäftigten, keine Biostoffe." },
    { id: "expositionsverzeichnis", titel: v("expositionsverzeichnis").titel, grund: "Keine Beschäftigten, keine Gefahrstoffe." },
  );
  const genutzt = new Set(docs.map((d) => d.vorlage));
  for (const vl of VORLAGEN) if (!genutzt.has(vl.id) && !uebersprungen.some((u) => u.id === vl.id)) auffaellig.push(`Vorlage ${vl.id} weder erzeugt noch als übersprungen begründet.`);

  // ---------------------------------------------------------------- Pflichten-Check der App für die Freiberuflerin
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
  variante("Rechtsform „Freiberuflich (ohne Gewerbe)“ statt „Einzelunternehmen“", { rechtsform: "freiberuf" });
  variante("Einordnung „Gewerbe“ statt „Freier Beruf“", { "taetigkeit.einordnung": "gewerbe" });
  variante("Einordnung „Weiß ich nicht“", { "taetigkeit.einordnung": "unklar" });
  variante("Ohne Kleinunternehmerregelung (Regelbesteuerung)", { "ust.kleinunternehmer": false });
  variante("Ohne Kunden in der EU und im Drittland", { "kunden.regionen": ["inland"] });
  const pflichten: Bau["pflichten"] = {
    gilt: a.gilt.map(zeile), gruendung: a.gruendung.map(zeile), unbekannt: a.unbekannt.map((p) => ({ id: p.id, titel: p.titel, fragen: p.offeneFragen })), varianten,
    jahresende: ende.gilt.filter((p) => !a.gilt.some((x) => x.id === p.id)).map(zeile),
  };
  // Plausibilität für eine Kleinunternehmerin ohne Beschäftigte, freier Beruf
  const unplausibel: [RegExp, string][] = [
    [/^personal\.|^arbeitsschutz\./, "betrifft Arbeitgeber – keine Beschäftigten"],
    [/gewst|gewerbesteuer/, "Gewerbesteuer – freier Beruf"],
    [/gewerbeanzeige|ihk|handwerk/, "Gewerbe/IHK/Handwerk – freier Beruf"],
    [/ust_voranmeldung|ust_sondervorauszahlung|ust_jahreserklaerung|zusammenfassende|^steuern\.zm/, "Umsatzsteuer-Meldung – Kleinunternehmerin (außer § 13b)"],
    [/e_rechnung_versand/, "E-Rechnungs-Versandpflicht – Kleinunternehmer sind ausgenommen (§ 34a UStDV)"],
    [/kasse/, "Kasse – keine elektronische Kasse"],
    [/buchfuehrungspflicht|e_bilanz/, "Buchführungspflicht – freier Beruf"],
  ];
  for (const p of [...a.gilt, ...a.gruendung]) {
    const hit = unplausibel.find(([re]) => re.test(p.id));
    if (hit) auffaellig.push(`Pflichten-Check: „${p.titel}“ (${p.id}) gilt laut App – fraglich für dieses Profil (${hit[1]}). Grund laut App: ${p.grund || "–"}`);
  }
  const erwartet: [RegExp, string][] = [[/kleinunternehmer/, "Kleinunternehmergrenzen im Blick behalten"], [/impressum/, "Impressum"], [/datenschutzerklaerung/, "Datenschutzerklärung"], [/euer/, "EÜR"], [/est_erklaerung/, "Einkommensteuererklärung"], [/datenschutz\.avv/, "AVV mit Dienstleistern"]];
  for (const [re, was] of erwartet) if (![...basis].some((x) => re.test(x))) auffaellig.push(`Pflichten-Check: erwartete Pflicht „${was}“ fehlt für dieses Profil.`);

  return { s, docs, auffaellig, infos, belegDateien, xmls, ohneXml, vergleiche, ust, euer: { uebernahme, standard, final: unterlage("euer").daten, ergebnis: euerErgebnis }, uebersprungen, pflichten, profil: PROFIL };
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

/** Steuerberater-Paket für das Jahr – mit den Belegdateien */
export function paket(s: Stand, dateien: Record<string, Uint8Array>): PaketErgebnis {
  return steuerpaket(s, { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, s.steuerberatung, dateien, "2027-02-20T10:00:00");
}

/** Summe von Cent-Beträgen (für das Skript) */
export const centSumme = summe;

// ---------------------------------------------------------------- Belegdateien (so, wie die Lieferanten sie ausstellen würden)

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function belegHtml(b: D.BelegRoh): string {
  const sm = D.belegSumme(b);
  const [str, ort] = b.anschrift.split("\n");
  const bon = b.art === "brutto";
  const eigen = b.lieferant.startsWith("Eigenbeleg");
  const kopf = `<div class="lief"><strong>${esc(b.lieferant)}</strong><br>${esc(str ?? "")}<br>${esc(ort ?? "")}</div>`;
  const zeilen = b.pos.map((p) => `<tr><td>${esc(p.text)}${p.menge ? `<br><small>${esc(p.menge)}</small>` : ""}</td><td class="r">${b.p13b ? "–" : `${p.satz} %`}</td><td class="r">${D.eur(p.betrag)} €</td></tr>`).join("");
  const steuer = b.p13b
    ? `<tr><td colspan="3">VAT 0 % – Reverse Charge: Steuerschuldnerschaft des Leistungsempfängers. Customer VAT ID: ${esc(D.BETRIEB.ust_idnr)}</td></tr>`
    : sm.jeSatz.map((x) => `<tr><td>${x.satz ? `${bon ? "enth. " : ""}USt ${x.satz} %` : "ohne USt"}</td><td class="r">netto ${D.eur(x.netto)} €</td><td class="r">${x.satz ? `${D.eur(x.ust)} €` : "–"}</td></tr>`).join("");
  const css = `body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#222;margin:0}.blatt{${bon && !eigen ? "width:80mm;margin:10mm auto;border:1px dashed #999;padding:6mm" : "margin:18mm 20mm"}}table{width:100%;border-collapse:collapse;margin-top:6mm}td,th{padding:3px 4px;border-bottom:1px solid #ddd;vertical-align:top}th{text-align:left;border-bottom:2px solid #444}.r{text-align:right;white-space:nowrap}.lief{font-size:${bon ? "10pt" : "11pt"}}h1{font-size:${bon && !eigen ? "13pt" : "18pt"};margin:6mm 0 2mm}.an{margin-top:10mm}.summe td{font-weight:bold;border-top:2px solid #444}small{color:#666}`;
  const titel = eigen ? "Eigenbeleg" : b.p13b ? "Invoice / Rechnung" : bon ? "Kassenbon" : "Rechnung";
  const an = bon || eigen ? "" : `<div class="an">Mira Lindqvist – Grafikdesign<br>${esc(D.BETRIEB.strasse)}<br>${D.BETRIEB.plz} ${D.BETRIEB.ort}</div>`;
  const fuss = eigen
    ? "Eigenbeleg, erstellt und unterschrieben von Mira Lindqvist. Nachweis: Kalender mit den Arbeitstagen im Homeoffice."
    : `${b.zahlung === "privat" ? "Bar bezahlt (privat)." : bon ? "Mit Karte bezahlt." : "Zahlbar per Überweisung bzw. SEPA-Lastschrift."}${!bon ? (b.p13b ? " Supplier VAT ID: IE6364992H." : ` Steuernummer des Lieferanten: 06/1${b.id.slice(1)}/40${b.id.slice(1)}1.`) : ""}`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="blatt">${kopf}${an}
<h1>${titel}${b.nummer ? ` ${esc(b.nummer.replace(/^Bon /, ""))}` : ""}</h1><div>Datum: ${D.de(b.datum)}${!bon ? ` · Leistung: ${D.de(b.datum)} bzw. laut Positionen` : ""}</div>
<table><tr><th>${bon && !eigen ? "Artikel" : "Position"}</th><th class="r">USt</th><th class="r">${bon ? "Brutto" : "Netto"}</th></tr>${zeilen}</table>
<table>${steuer}<tr class="summe"><td>${eigen ? "Summe" : bon ? "SUMME" : "Rechnungsbetrag"}</td><td></td><td class="r">${D.eur(sm.brutto)} €</td></tr></table>
<p><small>${fuss}</small></p></div></body></html>`;
}
