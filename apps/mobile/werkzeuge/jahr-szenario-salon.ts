/**
 * Jahres-Szenario „Salon Sonne GmbH“ 2026 – der App-Ablauf: Der Stand entsteht mit denselben Funktionen wie in der App
 * (anlegen → felderSetzen → ausgeben/festschreiben → stornieren, bezahltSetzen, belegSetzen, E-Rechnung einlesen,
 * umsaetzeFuer mit Ist-Versteuerung, euerUebernahme, steuerpaket, Pflichten-Check). Rohdaten und die unabhängig
 * gerechneten Erwartungswerte stehen in jahr-szenario-salon-daten.ts; hier wird verglichen und jede Abweichung als
 * Auffälligkeit gesammelt.
 *
 * Gebündelt und ausgeführt von werkzeuge/jahr-szenario-salon.mjs (Chromium für die PDFs).
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
import { auswertung, type PflichtInfo } from "../src/pflichten/check";
import * as D from "./jahr-szenario-salon-daten";
import { MARKE } from "@amtlos/marke";

export { RAENDER, fussAngaben, fusszeileStempeln, mitSchriften, unzipSync, D };

const t = (iso: string, h = 10) => new Date(`${iso}T${String(h).padStart(2, "0")}:00:00+01:00`);
const menge = (n: number) => String(n).replace(".", ",");
const euro = (c: number) => D.eur(c);
/** formatierte Euro-Angabe der App („1.234,56 €“) → Cent */
const ausEuro = (s: string) => cent(s.replace(/[€\s\u00a0]/g, "")) ?? 0;

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

interface PflichtZeile { id: string; titel: string; vorlage: string | null; erzeugt: boolean; termin: string | null; termine: number; grund: string }

export interface Bau {
  s: Stand;
  docs: Dok[];
  auffaellig: string[];
  infos: string[];
  belegDateien: { datei: string; html?: string; xml?: string }[];
  xmls: { datei: string; xml: string; nummer: string }[];
  ohneXml: { nummer: string; fehlt: string[] }[];
  vergleiche: { bereich: string; was: string; app: string; erwartet: string; ok: boolean }[];
  ust: { m: string; app: Record<string, string>; appAnzahl: number; offen: number; final: Record<string, string>; versteuerung: string }[];
  euer: ReturnType<typeof euerUebernahme>;
  uebersprungen: { id: string; titel: string; grund: string }[];
  pflichten: { stichtag: string; gilt: PflichtZeile[]; gruendung: PflichtZeile[]; unbekannt: { titel: string; fragen: string[] }[] };
}

export function standBauen(): Bau {
  const auffaellig: string[] = [];
  const infos: string[] = [];
  const vergleiche: Bau["vergleiche"] = [];
  const vergleich = (bereich: string, was: string, app: number, erwartet: number) => {
    const ok = app === erwartet;
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

  // ---------------------------------------------------------------- Betrieb, Pflichten-Check, Personen
  let s: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, ...D.BETRIEB }, proTest: true };
  s = profilSetzen(s, {
    "taetigkeit.branchen": ["beauty_kosmetik", "handwerk"],
    rechtsform: "gmbh",
    "gesellschaft.handelsregister": "eingetragen",
    "gesellschaft.geschaeftsjahr": "kalenderjahr",
    "gesellschafter.anzahl": 2,
    "gesellschafter.auslaendische_investoren": false,
    "taetigkeit.einordnung": "gewerbe",
    erwerb: "haupt",
    "handwerk.anlage": "a",
    "erlaubnis.gewo_paragraphen": ["keine"],
    "erlaubnis.gaststaette": false,
    "rentenversicherung.pflichtgruppe": ["keine"],
    bundesland: "HH",
    gemeinde_ags: "02000000",
    "betriebsstaetten.anzahl": 1,
    gruendungsdatum: D.GRUENDUNG.beginn,
    "beschaeftigte.gesamt": 4,
    "beschaeftigte.minijob": 0,
    "beschaeftigte.azubi": 1,
    "beschaeftigte.jugendlich": 1,
    // R11: Friseurgewerbe gehört seit 1.1.2026 zu § 28a Abs. 4 SGB IV und § 2a SchwarzArbG (SchwarzArbMoDiG)
    "personal.sofortmeldebranchen": ["friseur"],
    "personal.lohnsteuer_anmeldezeitraum": "monatlich",
    "kasse.elektronisch": true,
    "online.website": true,
    "ust.kleinunternehmer": false,
    steuerberater: true,
    "umsatz.vorjahr": 196000,
    "umsatz.prognose_laufendes_jahr": 300000,
    "gewinn.vorjahr": -6900,
    "gewinn.prognose_laufendes_jahr": 15000,
    "ust.zahllast_vorjahr": 31500,
    "ust.dauerfristverlaengerung": false,
    "vorauszahlung.est_kst": true,
    "vorauszahlung.gewst": true,
    "kunden.segmente": ["b2c", "b2b"],
    "kunden.regionen": ["inland"],
    "vertrieb.kanaele": ["ladengeschaeft", "vor_ort_beim_kunden"],
    "produkte.arten": ["dienstleistung", "kosmetik"],
    "handel.hohe_bargeschaefte": false,
    "arbeitsschutz.elektrische_geraete": true,
    "arbeitsschutz.gefahrstoffe": true,
    "datenverarbeitung.arten": ["kundendaten", "beschaeftigtendaten", "gesundheitsdaten"],
    "datenschutz.dienstleister": true,
    "ki.nutzung": true,
    "ki.eigene_produkte": false,
    "nis2.betroffen": "nein",
  });
  s = steuerberatungSetzen(s, { kontenrahmen: "SKR03", beraternummer: "31877", mandantennummer: "20514" });
  for (const [id, k] of Object.entries(D.KUNDEN)) s = personSetzen(s, "kunde", { id, ...k } as never, t("2026-01-02"));
  for (const [id, m] of Object.entries(D.MITARBEITER)) s = personSetzen(s, "mitarbeiter", { id, ...m } as never, t("2026-01-02"));

  const docs: Dok[] = [];
  const uebersprungen: Bau["uebersprungen"] = [];
  let nr = 0;
  const v = (id: string) => vorlageFuer(id)!;
  const feld = (vid: string, fid: string) => v(vid).abschnitte.flatMap((a) => a.felder).find((f) => f.id === fid) as Extract<Feld, { art: "liste" }>;
  const eintraege = (vid: string, fid: string, l: Eintrag[], heute: string) => l.map((e) => ({ ...neuerEintrag(feld(vid, fid), s.betrieb, heute), ...e }));
  /** Vorschlag der Vorlage übernehmen (wie „Vorschlag antippen“), gesucht über den Titelanfang */
  const vorschlag = (vid: string, fid: string, titel: string, heute: string, extra: Eintrag = {}) => {
    const f = feld(vid, fid);
    const vs = (f.vorschlaege ?? []).find((x) => x.titel.startsWith(titel));
    if (!vs) throw new Error(`Vorschlag „${titel}“ in ${vid}.${fid} nicht gefunden`);
    return { ...eintragAusVorschlag(f, vs, s.betrieb, heute), ...extra };
  };
  /** alle Vorschläge einer Gruppe (z. B. „Friseur“) */
  const vorschlaegeGruppe = (vid: string, fid: string, gruppe: string, heute: string, extra: Eintrag = {}) =>
    (feld(vid, fid).vorschlaege ?? []).filter((x) => x.gruppe === gruppe).map((vs) => ({ ...eintragAusVorschlag(feld(vid, fid), vs, s.betrieb, heute), ...extra }));
  const unterlage = (id: string) => s.unterlagen.find((u) => u.id === id)!;

  function dok(o: { id: string; vorlage: string; datum: string; worum: string; daten: (heute: string) => Daten; danach?: (u: Unterlage) => void; ordner?: Dok["ordner"] }) {
    const [s1] = anlegen(s, o.vorlage, t(o.datum, 9), o.id);
    s = felderSetzen(s1, o.id, o.daten(o.datum), t(o.datum, 9));
    o.danach?.(unterlage(o.id));
    s = ausgeben(s, o.id, t(o.datum, 12));
    const u = unterlage(o.id);
    const vl = v(o.vorlage);
    const fehlt = fehlendeAngaben(vl, u.daten, s.betrieb);
    nr++;
    docs.push({ nr, uid: o.id, vorlage: o.vorlage, titel: vl.titel, datum: o.datum, datei: `${String(nr).padStart(2, "0")}-${pdfDateiname(vl, u.daten, o.datum)}`, ordner: o.ordner ?? "pdf", quer: !!vl.querformat, worum: o.worum, fehlt });
    if (fehlt.length) infos.push(`${vl.titel} (${o.id}): App meldet „Fehlt noch“: ${fehlt.join("; ")}`);
    return u;
  }

  // ---------------------------------------------------------------- Ausgangsrechnungen (inkl. Storno, Zahlungseingänge)
  const ereignisse: { nummer: string; los: () => void }[] = [];
  for (const r of D.RECHNUNGEN) {
    ereignisse.push({
      nummer: r.nummer,
      los: () => {
        const kunde = s.kunden.find((k) => k.id === r.kunde)!;
        const u = dok({
          id: r.id, vorlage: "rechnung", datum: r.datum, worum: r.worum, ordner: "rechnungen",
          daten: () => ({
            ...personIn(v("rechnung"), kunde),
            // Preise im Szenario netto (seit R12 ist „brutto“ bei Café, Friseur und reinen Privatkunden vorbelegt)
            preise_brutto: false,
            ...(r.kundeAbweichend ? { kunde_name: r.kundeAbweichend.name, kunde_anschrift: r.kundeAbweichend.anschrift } : {}),
            datum: r.datum,
            leistung_gleich: !r.leistung,
            leistung: r.leistung ? D.de(r.leistung) : "",
            zahlungsziel: r.ziel,
            positionen: r.pos.map((x) => ({ bezeichnung: x.bez, menge: menge(x.menge), einheit: x.einheit, preis: euro(x.preis), satz: String(x.satz) })),
            hinweise: [],
            hinweis: r.hinweis,
          }),
        });
        if (u.daten.nummer !== r.nummer) auffaellig.push(`Rechnungsnummer: erwartet ${r.nummer}, App vergab ${String(u.daten.nummer)}.`);
        if (!u.festgeschrieben) auffaellig.push(`Rechnung ${r.nummer} ist nach dem Teilen nicht festgeschrieben.`);
        // Zahlungseingang vermerken (bei 2026-017 erst im Januar 2027)
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
          // Ist: die Stornorechnung zählt erst mit der vermerkten Erstattung
          if (st.erstattet) s = bezahltSetzen(s, st.id, st.erstattet, t(st.erstattet, 15));
          const u = unterlage(st.id);
          const vl = v("rechnung");
          nr++;
          docs.push({ nr, uid: st.id, vorlage: "rechnung", titel: "Stornorechnung", datum: st.datum, datei: `${String(nr).padStart(2, "0")}-${pdfDateiname(vl, u.daten, st.datum)}`, ordner: "rechnungen", quer: false, worum: `Stornorechnung zu ${r.nummer}: ${st.grund}.${st.erstattet ? ` Erstattung vermerkt am ${D.de(st.erstattet)}.` : " Keine Erstattung (Original nie bezahlt)."}`, fehlt: fehlendeAngaben(vl, u.daten, s.betrieb) });
        },
      });
    }
  }
  for (const e of ereignisse.sort((a, b) => a.nummer.localeCompare(b.nummer))) e.los();

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
    vergleich("Rechnung " + x.nummer, "Umsatzsteuer", sm.ust_cent, x.s.ust);
    vergleich("Rechnung " + x.nummer, "Rechnungsbetrag", sm.brutto_cent, x.s.brutto);
    const erg = v("rechnung").ergebnis!(u.daten);
    vergleich("Rechnung " + x.nummer, "Rechnungsbetrag laut Formular", ausEuro(erg.find((z) => z[0] === "Rechnungsbetrag")![1]), x.vz * x.s.brutto);
    vergleichText("Rechnung " + x.nummer, "Zahlungseingang/Erstattung vermerkt", u.bezahlt ?? "–", x.bezahlt ?? "–");
    if (fehlt.length) {
      ohneXml.push({ nummer: x.nummer, fehlt });
      continue;
    }
    const xml = xrechnungUbl(daten, KU_HINWEIS);
    xmls.push({ datei: `E-Rechnung-${daten.nummer.replace(/[^A-Za-z0-9-]+/g, "-")}.xml`, xml, nummer: x.nummer });
    const zahlbar = /<cbc:PayableAmount[^>]*>([-\d.]+)</.exec(xml)?.[1];
    vergleich("E-Rechnung " + x.nummer, "PayableAmount (BT-115)", Math.round(Number(zahlbar) * 100), x.vz * x.s.brutto);
    // GmbH: Verkäufer mit Registerangaben (BT-30 rechtliche Registrierungskennung) – nur Hinweis, keine Pflicht in der XRechnung
    if (x.nummer === "2026-001") infos.push(`E-Rechnung 2026-001: Registereintrag (BT-30 „CompanyID“ in PartyLegalEntity) ${/PartyLegalEntity>[\s\S]*?CompanyID/.test(xml) ? "vorhanden" : "nicht enthalten"}; Rechtsform/Geschäftsführung (BT-33) ${/CompanyLegalForm/.test(xml) ? "vorhanden" : "nicht enthalten"}.`);
  }
  const privat = D.RECHNUNGEN.filter((r) => !("email" in D.KUNDEN[r.kunde])).map((r) => r.nummer);
  infos.push(`Ohne XRechnung (App: Angaben fehlen): ${ohneXml.map((o) => `${o.nummer} (${o.fehlt.join(", ")})`).join("; ") || "keine"}. Erwartet: nur Privatkunden ohne E-Mail (${privat.join(", ")}).`);

  // ---------------------------------------------------------------- Belege
  const belegDateien: Bau["belegDateien"] = [];
  for (const b of D.BELEGE) {
    const jetzt = t(b.datum, 18).toISOString();
    if (b.datei === "xml") {
      // die E-Rechnung schreibt der Lieferant – mit xrechnungUbl erzeugt wie im Café-Szenario, als käme sie von ihm
      const H = D.HAIRTEC;
      const xml = xrechnungUbl(
        {
          nummer: b.nummer!, rechnungsdatum: b.datum, leistungsdatum: "2026-09-07", faellig_am: "2026-09-22",
          steller: { name: H.lieferant, strasse: H.strasse, plz: H.plz, ort: H.ort, land: "DE", email: H.email, telefon: H.telefon, steuernummer: H.steuernummer, ust_idnr: H.ust_idnr, iban: H.iban, bic: H.bic },
          kunde: { name: D.BETRIEB.name, strasse: D.BETRIEB.strasse, plz: D.BETRIEB.plz, ort: D.BETRIEB.ort, land: "DE", email: D.BETRIEB.email, kaeufer_referenz: "Kd.-Nr. 60117", geschaeftskunde: true },
          positionen: D.ERECHNUNG_POS.map((x) => ({ bezeichnung: x.bez, menge: x.menge, einheit: "stueck", einheit_code: x.bez === "Versandkosten" ? "LS" : "H87", preis_cent: x.preis, ust_satz: x.satz })),
          kleinunternehmer: false,
          hinweis: "Zahlbar bis 22.09.2026 ohne Abzug.",
        },
        KU_HINWEIS,
      );
      const gelesen = eRechnungLesen(xml);
      if (!gelesen) {
        auffaellig.push(`E-Rechnung ${b.nummer} ließ sich nicht lesen (eRechnungLesen → null).`);
        continue;
      }
      const roh = belegAusERechnung(gelesen, b.id, jetzt);
      if (roh.notiz && /weicht|prüfen/.test(roh.notiz)) auffaellig.push(`E-Rechnung ${b.nummer} eingelesen mit Hinweis: ${roh.notiz.replace(/\n/g, " | ")}`);
      infos.push(`E-Rechnung ${b.nummer} eingelesen: Lieferant „${roh.lieferant}“, Datum ${roh.datum}, Kategorie zunächst „${kategorieFuer(roh.kategorie).titel}“ (von Hand auf „Waren und Material“ gestellt), Notiz: ${(roh.notiz ?? "").replace(/\n/g, " | ")}`);
      vergleichText("E-Rechnung einlesen", `${b.nummer}: Belegdatum`, roh.datum, b.datum);
      s = belegSetzen(s, { ...roh, kategorie: b.kategorie, bezahlt: b.bezahlt, datei: `${b.id}.xml` }, t(b.datum, 18));
      belegDateien.push({ datei: `${b.id}.xml`, xml });
    } else {
      const sm = D.belegSumme(b);
      const beleg: Beleg = {
        id: b.id, datum: b.datum, lieferant: b.lieferant, nummer: b.nummer, kategorie: b.kategorie,
        steuer: sm.jeSatz.map((x) => ({ satz: x.satz, brutto_cent: x.brutto })),
        vorsteuer: b.vorsteuer, zahlung: b.zahlung, bezahlt: b.bezahlt, notiz: b.notiz ?? null, datei: `${b.id}.pdf`, quelle: "foto", erstellt: jetzt, geaendert: jetzt,
      };
      s = belegSetzen(s, beleg, t(b.datum, 18));
      belegDateien.push({ datei: `${b.id}.pdf`, html: belegHtml(b) });
    }
    const app = belegSummen(s.belege.find((x) => x.id === b.id)!);
    const erw = D.belegSumme(b);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Brutto", app.brutto_cent, erw.brutto);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Vorsteuer (App rechnet aus Brutto, Beleg weist aus)", app.vorsteuer_cent, erw.vorsteuer);
  }

  // ---------------------------------------------------------------- Gründung und Register (Stand bei Gründung 2025)
  const B = D.BETRIEB;
  const A = D.GESELLSCHAFTER[0]!;
  const C = D.GESELLSCHAFTER[1]!;
  const GEGENSTAND = "Betrieb eines Friseursalons (Friseurhandwerk), Haar- und Make-up-Styling für Veranstaltungen und Produktionen, kosmetische Behandlungen und Kosmetik-Workshops sowie der Verkauf von Haarpflege- und Kosmetikprodukten.";

  dok({ id: "hr", vorlage: "handelsregister", datum: D.GRUENDUNG.vertrag, worum: "Anmeldung zum Handelsregister, wie sie zur Gründung vorbereitet wurde (notarieller Gesellschaftsvertrag 10.03.2025): GmbH, Stammkapital 25.000 €, zwei Gesellschafter je 12.500 €, zwei einzelvertretungsberechtigte Geschäftsführer.",
    daten: (h) => ({ firma: B.name, rechtsform: "GmbH", sitz: "Hamburg", anschrift: `${B.strasse}\n${B.plz} ${B.ort}`, gegenstand: GEGENSTAND, kapital: euro(D.STAMMKAPITAL),
      gesellschafter: eintraege("handelsregister", "gesellschafter", [A, C].map((g) => ({ name: g.name, geburtsdatum: g.geburtsdatum, wohnort: g.wohnort, anteil: g.anteil })), h),
      fuehrung: eintraege("handelsregister", "fuehrung", [A, C].map((g) => ({ name: g.name, geburtsdatum: g.geburtsdatum, wohnort: g.wohnort })), h),
      vertretung: "Ist nur ein Geschäftsführer bestellt, vertritt er die Gesellschaft allein; sind mehrere bestellt, wird die Gesellschaft durch zwei Geschäftsführer gemeinsam oder durch einen Geschäftsführer mit einem Prokuristen vertreten.\nKonkret: Alex Sonnberg und Chris Sonnberg sind jeweils einzelvertretungsberechtigt und von den Beschränkungen des § 181 BGB befreit." }) });

  dok({ id: "tr", vorlage: "transparenzregister", datum: "2025-04-02", worum: "Mitteilung an das Transparenzregister nach Eintragung (HRB 178432 am 27.03.2025): zwei wirtschaftlich Berechtigte mit je 50 % der Kapitalanteile und Stimmrechte.",
    daten: (h) => ({ rechtsform: "Gesellschaft mit beschränkter Haftung (GmbH)", register: `${B.registergericht}, ${B.registernummer}`, stand: "2025-04-02", gemeldet: "2025-04-02",
      berechtigte: eintraege("transparenzregister", "berechtigte", [A, C].map((g) => ({ name: g.name, geburtsdatum: g.geburtsdatum, wohnort: g.wohnort, staatsangehoerigkeit: g.staatsangehoerigkeit, interesse_art: "beteiligung", interesse: "50 % der Kapitalanteile und 50 % der Stimmrechte" })), h) }) });

  dok({ id: "gewerbe", vorlage: "gewerbeanmeldung", datum: "2025-03-28", worum: "Gewerbeanmeldung der GmbH zum Geschäftsbeginn 01.04.2025 (eingetragen HRB 178432); Angaben zur Person: Geschäftsführer Alex Sonnberg (die Vorlage hat nur eine Person); Handwerksrolle mit Betriebsleiterin Chris Sonnberg.",
    daten: () => ({ name: A.name, geburtsname: A.geburtsname, geburtsdatum: A.geburtsdatum, geburtsort: A.geburtsort, staatsangehoerigkeit: A.staatsangehoerigkeit, wohnanschrift: A.wohnanschrift,
      taetigkeit: "Friseurhandwerk (zulassungspflichtiges Handwerk, Anlage A Nr. 38 HwO) einschließlich Haar- und Make-up-Styling für Veranstaltungen und Produktionen; Kosmetik-Workshops; Einzelhandel mit Haarpflege- und Kosmetikprodukten",
      beginn: D.GRUENDUNG.beginn, erwerb: "haupt", beschaeftigte: "2 (Vollzeit)", erlaubnis: "Eintragung in die Handwerksrolle der Handwerkskammer Hamburg (Betriebsleiterin Chris Sonnberg, Friseurmeisterin) – Eintragung im Handelsregister: Amtsgericht Hamburg, HRB 178432" }) });

  dok({ id: "kasse", vorlage: "kassenmeldung", datum: "2025-06-20", worum: "Kassenmeldung (§ 146a Abs. 4 AO) für das bei Eröffnung angeschaffte Kassensystem mit USB-TSE.",
    daten: (h) => ({ stand: "2025-06-20", kassen: eintraege("kassenmeldung", "kassen", [{ art: "PC-Kassensysteme", hersteller: "SalonKasse Systems GmbH", modell: "SalonKasse Pro (Touch-Terminal T15)", seriennummer: "SKP-T15-250318-0044", software: "SalonKasse Pro 4.2", anschaffung: "2025-03-25", tse_art: "USB-TSE", tse_seriennummer: "4be2f06a9c11d37e85a0b6c4f2d9e1a37c5b80d6e2f41a9c3b7d5e0f8a2c4b61", tse_zertifikat: "BSI-K-TR-0456-2023" }], h) }) });

  // ---------------------------------------------------------------- Website und Datenschutz
  dok({ id: "impressum", vorlage: "impressum", datum: "2026-01-12", worum: "Impressum der Website: GmbH, beide Geschäftsführer, Stammkapital, Registergericht und HRB, USt-IdNr. (aus „Mein Betrieb“), Handwerkskammer, reglementierter Beruf Friseurmeisterin, keine Teilnahme an Verbraucherschlichtung.",
    daten: () => ({ rechtsform: "GmbH", vertreten: "die Geschäftsführer Alex Sonnberg und Chris Sonnberg", kapital: "25.000 €", register_gericht: B.registergericht, register_nr: B.registernummer,
      aufsicht: "Handwerkskammer Hamburg, Holstenwall 12, 20355 Hamburg (Eintragung in die Handwerksrolle)", reglementiert: true, kammer: "Handwerkskammer Hamburg, Holstenwall 12, 20355 Hamburg", berufsbezeichnung: "Friseurmeisterin (Betriebsleiterin Chris Sonnberg)", verleihung: "Deutschland", regelungen: "Handwerksordnung (HwO), abrufbar unter www.gesetze-im-internet.de",
      redaktion: `Alex Sonnberg, ${B.strasse}, ${B.plz} ${B.ort}`, vsbg: "nicht_bereit" }) });

  dok({ id: "dse", vorlage: "datenschutzerklaerung_website", datum: "2026-01-12", worum: "Datenschutzerklärung der Website: Hosting Webhaus Hamburg, Logfiles 7 Tage, Kontakt, ONLINE-TERMINBUCHUNG über TerminFix GmbH (Sitzungs-Cookie), Schriften lokal, Link zu Instagram.",
    daten: () => ({ website: "https://www.salon-sonne.example", module: ["hosting", "server_logfiles", "kontakt", "technisch_notwendige_cookies", "online_terminbuchung", "google_fonts_lokal", "social_media_links"],
      hoster_name: "Webhaus Hamburg GmbH", hoster_anschrift: "Schanzenstraße 75, 20357 Hamburg", logfile_tage: "7", cookie_zwecke: "Sitzung der Online-Terminbuchung (Auswahl von Leistung, Stylistin und Termin)", cookie_dauer: "nach Ende der Sitzung",
      termin_anbieter: "TerminFix GmbH", termin_anschrift: "Torstraße 140, 10119 Berlin", netzwerke: "Instagram", stand: "2026-01-12" }) });

  dok({ id: "avv", vorlage: "avv", datum: "2025-03-20", worum: "Auftragsverarbeitungsvertrag mit dem Anbieter der Online-Terminbuchung TerminFix GmbH (Terminkalender, SMS-Erinnerungen).",
    daten: () => ({ rolle: "auftraggeber", partner: "TerminFix GmbH", partner_anschrift: "Torstraße 140\n10119 Berlin", hauptvertrag: "Nutzungsvertrag „Salon M“ vom 20.03.2025 (Kundennummer TF-118204)",
      gegenstand: "Bereitstellung und Betrieb eines Online-Terminbuchungssystems\nVersand von Terminerinnerungen per SMS und E-Mail", zweck: "Online-Buchung, Verwaltung und Erinnerung von Salonterminen über www.salon-sonne.example und die Buchungsseite des Anbieters", dauer: "für die Laufzeit des Hauptvertrags",
      datenarten: "Name\nKontaktdaten (Telefon, E-Mail)\nTermine und gebuchte Leistungen\nNotizen zur Buchung (z. B. gewünschte Stylistin)", betroffene: "Kundinnen und Kunden\nInteressenten",
      unterauftrag: "Rechenzentrum: RZ Nord GmbH, Nürnberg (Serverstandort Deutschland)\nSMS-Versand: SMSlink GmbH, Bonn", tom: "siehe Anlage (TOM-Beschreibung des Auftragsverarbeiters)", ort_datum: "Hamburg" }) });

  dok({ id: "dsinfo", vorlage: "datenschutzinformation", datum: "2026-01-12", worum: "Datenschutzinformation nach Art. 13 DSGVO für Kundinnen und Kunden (Kundenkartei mit Farbrezepturen und Unverträglichkeiten, Terminbuchung, Rechnungen, Kasse, Instagram).",
    daten: () => ({ fuer_wen: "Kundinnen und Kunden", verarbeitungen: ["Kundenverwaltung / Kundenkartei", "Terminvereinbarung (telefonisch, vor Ort oder Online-Buchung)", "Rechnungsstellung und Buchhaltung", "Kontaktanfragen (Kontaktformular, E-Mail, Telefon)", "Kassensystem und Zahlungsabwicklung (inkl. EC-/Kartenzahlung)", "Unternehmensauftritt in sozialen Netzwerken (z. B. Facebook-/Instagram-Seite)"],
      interessen: "Sicherer und störungsfreier Betrieb unserer IT\nDurchsetzung und Abwehr von Ansprüchen", bereitstellung: "vertrag",
      ergaenzung: "Angaben zu Unverträglichkeiten und Allergien (z. B. gegen Färbemittel) speichern wir in der Kundenkartei nur mit Ihrer ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO), damit wir Sie sicher behandeln können. Die Einwilligung können Sie jederzeit widerrufen.", stand: "2026-01-12" }) });

  dok({ id: "vvt", vorlage: "datenschutz_dokumentation", datum: "2026-01-14", worum: "Verzeichnis der Verarbeitungstätigkeiten: 11 Tätigkeiten aus den Vorschlägen (u. a. Kundenkartei mit Gesundheitsdaten, Online-Terminbuchung, Instagram mit gemeinsamer Verantwortung), 16 TOM; Dienstleister Webhaus, TerminFix, SalonKasse, Lohnbüro (AVV), Steuerkanzlei (eigenverantwortlich).",
    daten: (h) => ({
      verantwortlich: "Salon Sonne GmbH, vertreten durch die Geschäftsführer Alex Sonnberg und Chris Sonnberg",
      verarbeitungen: [
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kundenverwaltung", h, { datenarten: "Name, Kontaktdaten, Geburtstag (freiwillig), Farbrezepturen und Behandlungshistorie, Unverträglichkeiten/Allergien (Gesundheitsdaten nach Art. 9 DSGVO, nur mit Einwilligung)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Terminvereinbarung", h, { empfaenger: "TerminFix GmbH (Auftragsverarbeiter, Online-Terminbuchung und SMS-Erinnerung)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Rechnungsstellung", h, { empfaenger: "Steuerkanzlei Behrens & Ohlsen PartG mbB, Finanzamt Hamburg-Nord" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lohn- und Gehalts", h, { empfaenger: "Lohnbüro Elbe (Auftragsverarbeiter), Krankenkassen, Finanzamt, Berufsgenossenschaft BGW, Handwerkskammer (Ausbildung)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Personalverwaltung", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Betrieb der Website", h, { empfaenger: "Webhaus Hamburg GmbH (Auftragsverarbeiter)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kontaktanfragen", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Geschäftliche E-Mail", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lieferanten", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kassensystem", h, { empfaenger: "SalonKasse Systems GmbH (Auftragsverarbeiter, Fernwartung), Zahlungsdienstleister für Kartenzahlung, Steuerkanzlei, Finanzamt (Kassen-Nachschau)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Unternehmensauftritt", h, { gemeinsam: "Meta Platforms Ireland Ltd. (Instagram-Seite, gemeinsame Verantwortung für Seiten-Statistiken nach Art. 26 DSGVO)" }),
      ],
      tom: [
        "Geräteverschlüsselung und Bildschirmsperre", "Website ausschließlich über HTTPS", "WLAN mit aktueller Verschlüsselung", "Persönliche Benutzerkonten", "Starke, individuelle Passwörter", "Zwei-Faktor-Authentisierung",
        "Aufgeräumter Arbeitsplatz (Clean Desk)", "Abschließbare Räume/Schränke", "Verpflichtung aller Beschäftigten", "Auftragsverarbeitungsverträge", "Automatische Sicherheitsupdates", "Protokollierung von Änderungen in Kassen",
        "Regelmäßige Datensicherung", "Sorgfältige Auswahl von Hosting", "Jährliche Überprüfung des Verzeichnisses", "Regelmäßige Sensibilisierung",
      ].map((x) => vorschlag("datenschutz_dokumentation", "tom", x, h, { umgesetzt_am: "2025-04-01", verantwortlich: "Alex Sonnberg" })),
      dienstleister: eintraege("datenschutz_dokumentation", "dienstleister", [
        { name: "Webhaus Hamburg GmbH", leistung: "Website-Hosting", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2025-03-15", drittland: "keine Übermittlung in Drittländer" },
        { name: "TerminFix GmbH", leistung: "Online-Terminbuchung", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2025-03-20", drittland: "keine Übermittlung in Drittländer" },
        { name: "SalonKasse Systems GmbH", leistung: "Kassensystem (Fernwartung)", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2025-03-25", drittland: "keine Übermittlung in Drittländer" },
        { name: "Lohnbüro Elbe, Svenja Albers", leistung: "Lohnabrechnung (Lohnbüro)", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2025-03-28", drittland: "keine Übermittlung in Drittländer" },
        { name: "Steuerkanzlei Behrens & Ohlsen PartG mbB", leistung: "Steuerberatung und Jahresabschluss (eigenverantwortlich)", auftragsverarbeitung: false, drittland: "keine Übermittlung in Drittländer" },
      ], h),
    }) });

  dok({ id: "verfahren", vorlage: "verfahrensdokumentation", datum: "2026-01-15", worum: `Verfahrensdokumentation (GoBD) der GmbH: doppelte Buchführung und Jahresabschluss durch die Steuerkanzlei; ${MARKE.name} für Rechnungen/Belege, SalonKasse Pro mit TSE, TerminFix, Online-Banking, DATEV Unternehmen online.`,
    daten: () => ({ version: "1.1", verantwortlich: "Alex Sonnberg (Geschäftsführer)",
      organisation: "Salon Sonne GmbH, Friseursalon mit 6 Bedienplätzen und Styling-Service für Veranstaltungen. Geschäftsführer Alex Sonnberg (kaufmännisch: Buchhaltung, Einkauf) und Chris Sonnberg (Friseurmeisterin, Betriebsleitung). Zwei Friseurinnen in Vollzeit, eine in Teilzeit, ein Auszubildender. Öffnungszeiten Di–Sa 9–19 Uhr.",
      steuerberatung: "Buchführung und Jahresabschluss durch die Steuerberatung",
      systeme: eintraege("verfahrensdokumentation", "systeme", [
        { name: `${MARKE.name} (App, iPhone)`, zweck: "Rechnungsprogramm und Belegerfassung", version: "seit 01/2026" },
        { name: "SalonKasse Pro mit USB-TSE", zweck: "Kassensystem", version: "4.2, seit 04/2025" },
        { name: "TerminFix „Salon M“", zweck: "Online-Terminbuchung", version: "seit 03/2025" },
        { name: "Haspa Online-Banking", zweck: "Online-Banking", version: "seit 03/2025" },
        { name: "DATEV Unternehmen online (Steuerkanzlei)", zweck: "Belegaustausch und Finanzbuchhaltung der Steuerberatung", version: "seit 04/2025" },
      ], "2026-01-15"),
      belegeingang: ["Papier (Post/persönlich)", "E-Mail mit PDF-Anhang", "E-Rechnung (XRechnung/ZUGFeRD) per E-Mail oder Portal", "Kassensystem/Kassenbericht", "Kontoauszug/Bank-Schnittstelle", "Eigenbeleg"],
      belegart: ["originär Papier, Ablage in Papier (Muster 4.1)", "originär digital (Muster 4.3)"],
      ablage: ["Papierordner (chronologisch/nach Belegart)", "Upload an Steuerberater (z. B. Kanzlei-Portal)"],
      erfassung: `Belege werden wöchentlich in ${MARKE.name} erfasst (Foto bzw. Datei) und monatlich als Paket an die Steuerkanzlei übermittelt (monatliche Umsatzsteuer-Voranmeldung, Ist-Versteuerung).\nZahlungseingänge zu Ausgangsrechnungen werden täglich anhand des Kontoauszugs in ${MARKE.name} vermerkt.\nAusgangsrechnungen werden fortlaufend nummeriert in ${MARKE.name} erstellt und beim Teilen festgeschrieben; Korrekturen nur per Stornorechnung.`,
      scannen: false, sicherung_intervall: "täglich", sicherung_ort: ["Cloud-Backup", "durch Softwareanbieter/Rechenzentrum", "durch Steuerberater"], e_rechnung: true,
      zugriff: "Zugriff auf Buchhaltung und Belege nur für die Geschäftsführung und die Steuerberatung\nKasse: eigene Bedienerkennung je Person",
      kontrollen: "Tägliches Zählen der Kasse und Abgleich mit dem Kassenbericht\nMonatlicher Abgleich von Kontoauszügen und Buchungen\nVier-Augen-Prinzip bei Zahlungen über einem festgelegten Betrag",
      aenderungen: eintraege("verfahrensdokumentation", "aenderungen", [{ datum: "2026-01-15", aenderung: `Umstellung der Rechnungsstellung und Belegerfassung auf ${MARKE.name}; E-Rechnungsempfang eingerichtet.` }], "2026-01-15") }) });

  dok({ id: "aufbewahrung", vorlage: "aufbewahrung", datum: "2026-01-15", worum: "Aufbewahrungsplan mit den Startzeilen der App und drei ergänzten Zeilen (Kassendaten, Lohnkonten, Gesellschaftsunterlagen).",
    daten: (h) => {
      const start = (leereDatenVon("aufbewahrung", h).eintraege as Eintrag[]).map((e) => ({ ...e, letzte: "2026", ort: `${MARKE.name} (verschlüsselt) und DATEV Unternehmen online; Papier im Büroschrank` }));
      return { eintraege: [...start, ...eintraege("aufbewahrung", "eintraege", [
        { art: "Kassendaten: TSE-Export und DSFinV-K-Export (Einzelaufzeichnungen)", jahre: "10", letzte: "2026", ort: "SalonKasse-Cloud und externe Festplatte" },
        { art: "Lohnkonten (§ 41 Abs. 1 EStG)", jahre: "6", letzte: "2026", ort: "Lohnbüro Elbe und Personalordner" },
        { art: "Gesellschaftsvertrag, Gesellschafterliste, Gesellschafterbeschlüsse, Handelsregisterauszüge", jahre: "10", letzte: "2026", ort: "Ordner „Gesellschaft“ im Büroschrank" },
      ], h)] };
    } });

  // ---------------------------------------------------------------- Personal
  const m = (id: keyof typeof D.MITARBEITER) => s.mitarbeiter.find((x) => x.id === id)!;
  const PAUSEN = "nach § 4 ArbZG: mindestens 30 Minuten bei mehr als sechs Stunden, 45 Minuten bei mehr als neun Stunden";
  const RUHE = "nach § 5 ArbZG: mindestens elf Stunden ununterbrochen nach Ende der täglichen Arbeitszeit";
  const nachweis = (id: keyof typeof D.MITARBEITER, datum: string, extra: Daten) => ({ ...personIn(v("nachweis_arbeitsbedingungen"), m(id)), arbeitsort: "betrieb", probezeit: "6", entgelt_art: "monat", faelligkeit: "am letzten Bankarbeitstag des laufenden Monats", auszahlung: "Überweisung auf das von der beschäftigten Person benannte Konto",
    pausen: PAUSEN, ruhezeit: RUHE, fortbildung: "Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht.", kuendigung_art: "gesetz", kollektiv: "keine", ausgestellt_am: datum, befristet: false, ...extra });
  dok({ id: "nachweis1", vorlage: "nachweis_arbeitsbedingungen", datum: "2026-06-22", worum: "Nachweis der Arbeitsbedingungen Friseurin Mia Petersen (aktualisiert wegen Gehaltserhöhung ab 01.07.2026: 3.000 € brutto, 40 Std./5 Tage Di–Sa, 26 Urlaubstage).",
    daten: (h) => nachweis("m1", h, { beginn: "2025-04-01", taetigkeit: "Friseur/in", entgelt_betrag: "3.000,00", zuschlaege: "Ab 01.07.2026. Provision 5 % auf den Verkauf von Pflegeprodukten, monatlich abgerechnet. Überstunden werden durch Freizeit ausgeglichen.", wochenstunden: "40", tage_pro_woche: "5", verteilung: "Dienstag bis Samstag", ueberstunden: "ja", ueberstunden_text: "bei Styling-Aufträgen außerhalb der Öffnungszeiten nach Absprache, höchstens 4 Stunden je Woche", urlaub: "26" }) });
  dok({ id: "nachweis2", vorlage: "nachweis_arbeitsbedingungen", datum: "2025-03-25", worum: "Nachweis der Arbeitsbedingungen Friseurin Leonie Brandt (Vollzeit seit 01.04.2025, 2.750 € brutto).",
    daten: (h) => nachweis("m2", h, { beginn: "2025-04-01", taetigkeit: "Friseur/in", entgelt_betrag: "2.750,00", zuschlaege: "Provision 5 % auf den Verkauf von Pflegeprodukten, monatlich abgerechnet.", wochenstunden: "40", tage_pro_woche: "5", verteilung: "Dienstag bis Samstag", ueberstunden: "nein", urlaub: "26" }) });
  dok({ id: "nachweis3", vorlage: "nachweis_arbeitsbedingungen", datum: "2025-09-24", worum: "Nachweis der Arbeitsbedingungen Teilzeit-Friseurin Aylin Demir (25 Std./Woche an 4 Tagen nach Dienstplan, 1.750 € brutto, seit 01.10.2025).",
    daten: (h) => nachweis("m3", h, { beginn: "2025-10-01", taetigkeit: "Friseur/in", entgelt_betrag: "1.750,00", zuschlaege: "Keine weiteren Bestandteile.", wochenstunden: "25", tage_pro_woche: "4", verteilung: "nach Dienstplan", schicht: false, ueberstunden: "nein", urlaub: "21" }) });
  infos.push("Auszubildender Finn Jürgensen: kein „Nachweis der Arbeitsbedingungen“ erzeugt – für Auszubildende gilt der Berufsausbildungsvertrag nach § 11 BBiG (Vertragsniederschrift); die App hat dafür keine Vorlage.");

  dok({ id: "fragebogen3", vorlage: "sv_meldedaten", datum: "2025-09-24", worum: "Personalfragebogen Teilzeit-Friseurin (Personengruppe 101, unbefristet Teilzeit, Mittlere Reife, Berufsausbildung).",
    daten: () => ({ ...personIn(v("sv_meldedaten"), m("m3")), art: "teilzeit", personengruppe: "101", vertragsform: "2", stunden: "25", entgelt: "1.750,00", taetigkeit: "Friseurin", schulabschluss: "3", ausbildung: "2", weitere: false }) });
  dok({ id: "fragebogen4", vorlage: "sv_meldedaten", datum: "2025-07-15", worum: "Personalfragebogen Auszubildender (Personengruppe 102, 16 Jahre, Erster allgemeinbildender Schulabschluss, ohne Berufsabschluss).",
    daten: () => ({ ...personIn(v("sv_meldedaten"), m("m4")), art: "ausbildung", personengruppe: "102", vertragsform: "3", stunden: "38", entgelt: "820,00", taetigkeit: "Auszubildender Friseur (1. Ausbildungsjahr)", schulabschluss: "2", ausbildung: "1", weitere: false }) });

  const lohnZeilen = (l: D.LohnMonat[], h: string) =>
    eintraege("lohnkonto", "monate", l.map((x) => ({ monat: x.monat, zahltag: x.zahltag, brutto: euro(x.brutto), lohnsteuer: x.lohnsteuer ? euro(x.lohnsteuer) : "0,00", soli: "0,00", kirchensteuer: "", sv_an: euro(x.sv_an), sv_ag: euro(x.sv_ag), auszahlung: euro(x.brutto - x.lohnsteuer - x.sv_an) })), h);
  dok({ id: "lohnkonto1", vorlage: "lohnkonto", datum: "2026-12-31", worum: "Lohnkonto 2026 Friseurin Mia Petersen: 2.900 € (Jan–Jun), 3.000 € (Jul–Dez), Steuerklasse I; LSt laut Lohnbüro (Annahme), SV AN 21,75 %, AG 21,15 %.",
    daten: (h) => ({ ...personIn(v("lohnkonto"), m("m1")), jahr: "2026", kinder: "0", religion: "keine Kirchensteuerpflicht", monate: lohnZeilen(D.LOHN.m1, h) }) });
  dok({ id: "lohnkonto4", vorlage: "lohnkonto", datum: "2026-12-31", worum: "Lohnkonto 2026 Auszubildender Finn Jürgensen: 820 € (Jan–Jul, 1. Jahr), 900 € (Aug–Dez, 2. Jahr), keine Lohnsteuer.",
    daten: (h) => ({ ...personIn(v("lohnkonto"), m("m4")), jahr: "2026", kinder: "0", religion: "keine Kirchensteuerpflicht", monate: lohnZeilen(D.LOHN.m4, h) }) });

  const azn: Eintrag[] = [
    ["2026-05-05", "09:00", "15:30", "30", ""], ["2026-05-06", "12:30", "19:00", "30", ""], ["2026-05-08", "09:00", "15:30", "30", ""], ["2026-05-09", "09:00", "15:30", "30", ""],
    ["2026-05-12", "12:30", "19:00", "30", ""], ["2026-05-13", "09:00", "15:30", "30", ""], ["2026-05-15", "", "", "", "Urlaub (6 Std. vergütet)"], ["2026-05-16", "09:00", "15:30", "30", ""],
    ["2026-05-19", "12:30", "19:00", "30", ""], ["2026-05-20", "09:00", "15:30", "30", ""], ["2026-05-22", "09:00", "15:30", "30", ""], ["2026-05-23", "09:00", "15:30", "30", ""],
    ["2026-05-26", "12:30", "19:00", "30", ""], ["2026-05-27", "09:00", "15:30", "30", ""], ["2026-05-29", "09:00", "15:30", "30", ""], ["2026-05-30", "09:00", "15:30", "30", ""],
  ].map(([datum, beginn, ende, pause, bemerkung]) => ({ datum: datum!, beginn: beginn!, ende: ende!, pause: pause!, bemerkung: bemerkung! }));
  dok({ id: "azn", vorlage: "arbeitszeitnachweis", datum: "2026-06-01", worum: "Arbeitszeitnachweis Mai 2026 Teilzeit-Friseurin (ob § 17 MiLoG für Friseurbetriebe gilt, ist in der App widersprüchlich – siehe Auffälligkeiten): 15 Tage à 6 Std. + 1 Urlaubstag.",
    daten: (h) => ({ name: m("m3").name, monat: "Mai 2026", leerzeilen: false, tage: eintraege("arbeitszeitnachweis", "tage", azn, h) }) });

  dok({ id: "ki", vorlage: "ki_kompetenz", datum: "2026-02-10", worum: "KI-Kompetenz-Schulung (Art. 4 KI-VO): Textassistent für Instagram-Texte, Bildbearbeitung mit KI für Vorher/Nachher-Fotos; alle Beschäftigten.",
    daten: (h) => ({ thema: "Sicherer Umgang mit KI-Assistenten im Betrieb", ki_systeme: "Textassistent (Chatbot)\nBildbearbeitung mit KI", dauer: "60 Minuten", durchgefuehrt_von: "Alex Sonnberg",
      themen: ["Funktionsweise und Grenzen der eingesetzten KI-Werkzeuge", "Keine personenbezogenen oder vertraulichen Daten in KI-Werkzeuge eingeben, soweit nicht ausdrücklich freigegeben", "Ergebnisse von KI-Werkzeugen vor der Verwendung prüfen", "Umgang mit KI-erzeugten Texten und Bildern gegenüber Kundinnen und Kunden"],
      inhalt: "Vorher/Nachher-Fotos von Kundinnen nur mit schriftlicher Einwilligung und ohne KI-Retusche der Frisur selbst; KI-bearbeitete Bilder auf Instagram als solche kennzeichnen.", teilnehmer: eintraege("ki_kompetenz", "teilnehmer", ["m1", "m2", "m3", "m4"].map((id) => ({ name: m(id as keyof typeof D.MITARBEITER).name })), h) }) });

  // ---------------------------------------------------------------- Arbeitsschutz und Beauty
  dok({ id: "gb-salon", vorlage: "gefaehrdungsbeurteilung", datum: "2026-02-03", worum: "Gefährdungsbeurteilung Salon: alle 15 Friseur-Vorschläge der App (u. a. Feuchtarbeit, Friseurchemikalien, Stäube/Dämpfe, Desinfektionsmittel, Stehen) plus eigene Zeilen Jugendlicher Auszubildender und Styling beim Kunden vor Ort; Mutterschutz: Umgestaltung.",
    daten: (h) => ({ arbeitsbereich: "Salon", taetigkeiten: "Waschen, Schneiden, Färben, Blondieren, Dauerwellen, Föhnen und Stylen; Make-up; Mischen von Färbe- und Blondiermitteln im Farbraum; Reinigung und Desinfektion von Werkzeugen; Styling bei Kunden vor Ort (Shootings, Hochzeiten)", beschaeftigte: "6", beurteilt_von: "Chris Sonnberg", mitwirkung: "Beschäftigte des Bereichs\nFachkraft für Arbeitssicherheit\nBetriebsärztin / Betriebsarzt", datum: "2026-02-03",
      gefaehrdungen: [
        ...vorschlaegeGruppe("gefaehrdungsbeurteilung", "gefaehrdungen", "Friseur", h, { verantwortlich: "Chris Sonnberg", umsetzen_bis: "2026-03-31", umgesetzt_am: "2026-03-15" }),
        ...eintraege("gefaehrdungsbeurteilung", "gefaehrdungen", [
          { beschreibung: "Jugendlicher Auszubildender (17 Jahre): Umgang mit Gefahrstoffen (Färbe-, Blondier-, Dauerwellmittel) nur, soweit für das Ausbildungsziel erforderlich und unter Aufsicht (§ 22 JArbSchG); Arbeitszeitgrenzen (§§ 8, 14, 15 JArbSchG).", massnahme: "Färben und Blondieren nur unter Aufsicht einer Fachkraft; keine Arbeit nach 20 Uhr, 5-Tage-Woche, Berufsschultage anrechnen; halbjährliche Unterweisung (§ 29 JArbSchG); Erstuntersuchung und Nachuntersuchung (§§ 32, 33 JArbSchG) im Personalordner.", schwere: "mittel", wahrscheinlichkeit: "moeglich", faktor: "qualifikation", verantwortlich: "Chris Sonnberg", umsetzen_bis: "2026-03-31", umgesetzt_am: "2026-02-10" },
          { beschreibung: "Styling bei Kunden vor Ort (Hotel, Fotostudio): fremde Arbeitsplätze, Transport von Koffern und Geräten, Stolperstellen durch Kabel, ungeprüfte Steckdosen.", massnahme: "Rollkoffer statt Tragen; eigene geprüfte Verlängerung mit FI-Adapter; Kabel abkleben; Arbeitsplatz vor Ort vorher besprechen.", schwere: "leicht", wahrscheinlichkeit: "moeglich", faktor: "arbeitsstaette", verantwortlich: "Alex Sonnberg", umsetzen_bis: "2026-03-31", umgesetzt_am: "2026-03-01" },
        ], h),
      ],
      mutterschutz_ergebnis: "umgestaltung", mutterschutz_details: "Kein Umgang mit Blondier- und Dauerwellmitteln sowie keine Tätigkeiten mit Stoffen, die als sensibilisierend (H317, H334) eingestuft sind; Färben nur mit Handschuhen und Absaugung im Farbraum nach Einzelfallprüfung; Sitzgelegenheit und zusätzliche Pausen; kein Styling-Einsatz außer Haus mit schwerem Gepäck.",
      wirksamkeit: "wirksam", wirksamkeit_am: "2026-09-08", bemerkung: "Begehung mit der Fachkraft für Arbeitssicherheit (BGW-Unternehmermodell) am 08.09.2026; Hautschutz wird eingehalten.", fortschreibung: "bei Änderungen von Tätigkeiten, Arbeitsmitteln oder Arbeitsstoffen, nach Unfällen sowie jährlich" }) });

  const ALLE = ["m1", "m2", "m3", "m4"].map((id) => ({ name: m(id as keyof typeof D.MITARBEITER).name }));
  dok({ id: "unterweisung", vorlage: "unterweisung", datum: "2026-02-10", worum: "Jährliche Unterweisung Arbeitsschutz (60 Min.) für alle vier Beschäftigten: Friseurchemikalien, Feuchtarbeit/Hautschutz, Infektionsschutz, Gefahrstoffe, Erste Hilfe, Brandschutz, Elektrogeräte, Rutschen.",
    daten: (h) => ({ thema: "Jährliche Unterweisung Arbeitsschutz", anlass: "wiederholung", dauer: "60 Minuten", durchgefuehrt_von: "Chris Sonnberg",
      themen: ["gefaehrdungen_am_eigenen_arbeitsplatz_un", "erste_hilfe_ersthelfer_standort_verbandk", "brandschutz_verhalten_im_brandfall_umgan", "stolper_rutsch_und_sturzgefahren_ordnung", "elektrische_geraete_sichtpruefung_vor_be", "gefahrstoffe_inhalt_der_betriebsanweisun", "hautschutz_hautschutzplan_richtige_schut", "persoenliche_schutzausruestung_auswahl_b", "friseurchemikalien_faerbe_blondier_dauer", "feuchtarbeit_und_hautschutz_im_salon_hau", "infektionsschutz_und_hygiene_stich_und_s"],
      inhalt: "Ersthelferin: Leonie Brandt (Kurs 03/2025). Verbandkasten im Farbraum, Feuerlöscher am Empfang. Blondierpulver nur staubarm (Paste) verwenden; Mischen nur im Farbraum mit eingeschalteter Absaugung.", teilnehmer: eintraege("unterweisung", "teilnehmer", ALLE, h) }) });
  dok({ id: "unterweisung-jarbschg", vorlage: "unterweisung", datum: "2026-08-10", worum: "Halbjährliche Unterweisung des jugendlichen Auszubildenden (§ 29 Abs. 2 JArbSchG) zu Gefahrstoffen, Hautschutz und Infektionsschutz.",
    daten: (h) => ({ thema: "Unterweisung Gefahrstoffe", anlass: "anlass", jugendliche: true, dauer: "30 Minuten", durchgefuehrt_von: "Chris Sonnberg",
      themen: ["gefahrstoffe_inhalt_der_betriebsanweisun", "friseurchemikalien_faerbe_blondier_dauer", "feuchtarbeit_und_hautschutz_im_salon_hau", "infektionsschutz_und_hygiene_stich_und_s"],
      inhalt: "Halbjährliche Unterweisung nach § 29 Abs. 2 JArbSchG (Auszubildender unter 18 Jahren). Betriebsanweisungen BA-01 (Blondiermittel) und BA-02 (Oxidationshaarfarben) besprochen; Färben nur unter Aufsicht.", teilnehmer: eintraege("unterweisung", "teilnehmer", [{ name: m("m4").name }], h) }) });

  const STOFFE: Eintrag[] = [
    { bezeichnung: "Blondierpulver „Lift 9+“ (staubarm)", hersteller: "Coiffeur Chemie Nord GmbH", gefahren: "Gefahr; H272, H302, H315, H317, H319, H334, H335 (Persulfate) – sensibilisierend", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Farbraum, Bedienplätze", verwendung: "Aufhellen und Strähnen, Mischen mit Entwickler", sdb: "liegt_vor", sdb_stand: "2025-06-01" },
    { bezeichnung: "Entwickler/Oxidationsmittel 6 % und 9 %", hersteller: "Coiffeur Chemie Nord GmbH", gefahren: "Achtung; H302, H315, H319 (Wasserstoffperoxid)", menge: "10 bis 100 kg bzw. l", arbeitsbereich: "Farbraum, Bedienplätze", verwendung: "Oxidation bei Färbung und Blondierung", sdb: "liegt_vor", sdb_stand: "2025-06-01" },
    { bezeichnung: "Oxidationshaarfarben „Color Pro“ (Tuben)", hersteller: "Coiffeur Chemie Nord GmbH", gefahren: "Kosmetisches Mittel; enthält Farbstoffvorstufen (z. B. Toluene-2,5-Diamine) – kann allergische Hautreaktionen verursachen (TRGS 530)", menge: "10 bis 100 kg bzw. l", arbeitsbereich: "Farbraum, Bedienplätze", verwendung: "Färben, Mischen mit Entwickler", sdb: "liegt_vor", sdb_stand: "2025-06-01" },
    { bezeichnung: "Dauerwellflüssigkeit alkalisch", hersteller: "Coiffeur Chemie Nord GmbH", gefahren: "Achtung; H302, H315, H317 (Thioglycolate)", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Bedienplätze", verwendung: "Dauerwelle", sdb: "liegt_vor", sdb_stand: "2024-11-20" },
    { bezeichnung: "Haarspray Strong Hold 500 ml", hersteller: "Hairtec Profi-Vertrieb GmbH", gefahren: "Gefahr; H222, H229 – extrem entzündbares Aerosol", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Bedienplätze, Styling vor Ort", verwendung: "Styling", sdb: "liegt_vor", sdb_stand: "2025-02-14" },
    { bezeichnung: "Flächendesinfektion alkoholisch", hersteller: "Hygienehandel Nord GmbH", gefahren: "Gefahr; H225, H319 – entzündbar", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Salon, Farbraum", verwendung: "Desinfektion von Arbeitsflächen und Stühlen", sdb: "liegt_vor", sdb_stand: "2025-01-10" },
    { bezeichnung: "Händedesinfektion (Spender)", hersteller: "Hygienehandel Nord GmbH", gefahren: "Gefahr; H225, H319 – entzündbar", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Salon, Personal-WC", verwendung: "hygienische Händedesinfektion", sdb: "liegt_vor", sdb_stand: "2025-01-10" },
    { bezeichnung: "Instrumentendesinfektion Konzentrat", hersteller: "Hygienehandel Nord GmbH", gefahren: "Gefahr; H302, H314, H410 (quartäre Ammoniumverbindungen) – ätzend", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Farbraum (Aufbereitung)", verwendung: "Tauchdesinfektion von Kämmen, Bürsten, Scheren", sdb: "fehlt" },
  ];
  dok({ id: "gefahrstoffe", vorlage: "gefahrstoffverzeichnis", datum: "2026-02-02", worum: "Gefahrstoffverzeichnis mit 8 Friseurchemikalien und Desinfektionsmitteln; beim Instrumentendesinfektionsmittel fehlt das Sicherheitsdatenblatt noch.",
    daten: (h) => ({ stand: "2026-02-02", verantwortlich: "Chris Sonnberg", stoffe: eintraege("gefahrstoffverzeichnis", "stoffe", STOFFE, h) }) });

  dok({ id: "ba1", vorlage: "betriebsanweisung", datum: "2026-02-02", worum: "Betriebsanweisung BA-01 für Blondierpulver und Entwickler (Persulfate, Wasserstoffperoxid; H272, H302, H315, H317, H319, H334, H335).",
    daten: () => ({ stoff: "Blondierpulver „Lift 9+“ mit Entwickler 6 %/9 % (Persulfate, Wasserstoffperoxid)", arbeitsbereich: "Salon", nummer: "BA-01",
      gefahren: "Kann bei Einatmen Allergie, asthmaartige Symptome oder Atembeschwerden verursachen (H334).\nKann allergische Hautreaktionen verursachen (H317).\nVerursacht Hautreizungen und schwere Augenreizung (H315, H319); kann die Atemwege reizen (H335).\nKann Brand verstärken; Oxidationsmittel (H272). Gesundheitsschädlich bei Verschlucken (H302).",
      schutz: [
        "Schutzhandschuhe bei den gekennzeichneten Tätigkeiten tragen.", "Beschädigte Handschuhe sofort austauschen.", "Produkte nur nach Herstellerangaben anwenden; Konzentrate genau nach Anleitung dosieren.", "Für ausreichende Lüftung sorgen; Sprühnebel, Stäube und Dämpfe nicht einatmen.",
        "Nur staubarmes Blondiermittel (Paste oder Granulat) verwenden; im Farbraum unter der Absaugung anmischen.", "Beim Mischen und Auftragen Einmalhandschuhe aus Nitril tragen, auch beim Auswaschen.", "Von brennbaren Stoffen fernhalten; Reste nicht in den Behälter zurückgeben.",
      ].join("\n"),
      gefahrfall: "Verschüttete Substanz sofort mit Schutzhandschuhen aufnehmen.\nVerunreinigungen und Behälterrückstände sofort beseitigen; Bindemittel bereithalten.\nVerschüttetes Pulver feucht aufnehmen, nicht kehren oder pusten.",
      erste_hilfe: "Nach Augenkontakt: mit viel Wasser spülen und ärztlichen Rat einholen.\nNach Hautkontakt: mit viel Wasser spülen; bei Beschwerden ärztlichen Rat einholen.\nNach Einatmen: bei Beschwerden ärztlichen Rat einholen.\nNach Verschlucken: ärztlichen Rat einholen.\nZum Arzt Gebrauchsanweisung oder Packung bzw. Behältnis des Produkts mitnehmen.",
      entsorgung: "Angemischte Reste nicht aufbewahren, mit viel Wasser verdünnt in den Ausguss nur nach Herstellerangabe; restentleerte Gebinde in den Gelben Sack.\nEntsorgung mit der örtlichen Gewerbeabfallberatung klären.",
      notruf: "Notruf 112 – Ersthelferin Leonie Brandt, Giftinformationszentrum Nord (Göttingen) 0551 19240", erstellt_von: "Chris Sonnberg", datum: "2026-02-02" }) });
  dok({ id: "ba2", vorlage: "betriebsanweisung", datum: "2026-02-02", worum: "Betriebsanweisung BA-02 für Oxidationshaarfarben (sensibilisierend nach TRGS 530).",
    daten: () => ({ stoff: "Oxidationshaarfarben „Color Pro“ mit Entwickler (Farbstoffvorstufen, Wasserstoffperoxid)", arbeitsbereich: "Salon", nummer: "BA-02",
      gefahren: "Kann allergische Hautreaktionen verursachen; Farbstoffvorstufen sind starke Kontaktallergene (TRGS 530).\nVerursacht schwere Augenreizung (H319).\nFeuchtarbeit mit Handschuhen kann die Haut zusätzlich belasten.",
      schutz: "Schutzhandschuhe bei den gekennzeichneten Tätigkeiten tragen.\nSchutzhandschuhe nur mit sauberen, trockenen Händen anziehen.\nChemikalienschutzhandschuhe regelmäßig, spätestens arbeitstäglich wechseln; maximale Tragedauer beachten.\nHandschuhe auch beim Auswaschen und Aufemulgieren tragen.\nKundinnen vor der Färbung nach Allergien fragen; Haut am Haaransatz mit Schutzcreme abdecken.",
      gefahrfall: "Verschüttete Substanz sofort mit Schutzhandschuhen aufnehmen.",
      erste_hilfe: "Nach Augenkontakt: mit viel Wasser spülen und ärztlichen Rat einholen.\nNach Hautkontakt: mit viel Wasser spülen; bei Beschwerden ärztlichen Rat einholen.\nZum Arzt Gebrauchsanweisung oder Packung bzw. Behältnis des Produkts mitnehmen.",
      entsorgung: "Nicht mehr benötigte Produkte fachgerecht entsorgen.", notruf: "Notruf 112 – Ersthelferin Leonie Brandt", erstellt_von: "Chris Sonnberg", datum: "2026-02-02" }) });

  const geraete: Eintrag[] = [
    ["Föhn", "Parlux 3800", "INV-01", "Platz 1", "bestanden", ""], ["Föhn", "Parlux 3800", "INV-02", "Platz 2", "bestanden", ""], ["Föhn", "Parlux 3800", "INV-03", "Platz 3", "bestanden", ""], ["Föhn", "Parlux 3800", "INV-04", "Platz 4", "maengel", "Kabel am Knickschutz beschädigt – ausgesondert, Ersatz beschafft"],
    ["Glätteisen", "ghd platinum+", "INV-05", "Platz 1–2", "bestanden", ""], ["Glätteisen", "ghd platinum+", "INV-06", "Platz 3–4", "bestanden", ""], ["Lockenstab", "BaByliss Pro 32 mm", "INV-07", "Styling-Koffer", "bestanden", ""],
    ["Haarschneidemaschine (Ladegerät)", "Wahl Magic Clip", "INV-08", "Platz 5", "bestanden", ""], ["Trockenhaube", "Climazon Duo", "INV-09", "Farbbereich", "bestanden", ""], ["Wasserkocher", "Thermo 1,7 l", "INV-10", "Küche", "bestanden", ""],
    ["Kaffeemaschine (Kundenkaffee)", "Jura E8", "INV-11", "Empfang", "bestanden", ""], ["Verlängerungskabel 10 m mit PRCD", "H07RN-F 3G1,5", "INV-12", "Styling-Koffer", "bestanden", ""], ["Mehrfachsteckdose", "6-fach mit Schalter", "INV-13", "Farbbereich", "bestanden", ""], ["Kassen-Terminal (Netzteil)", "SalonKasse T15", "INV-14", "Empfang", "bestanden", ""],
  ].map(([bezeichnung, typ, inventar, standort, ergebnis, maengel]) => ({ bezeichnung: bezeichnung!, typ: typ!, inventar: inventar!, standort: standort!, ergebnis: ergebnis!, maengel: maengel!, naechste: "2027-08-18" }));
  dok({ id: "elektro", vorlage: "pruefprotokoll_elektro", datum: "2026-08-18", worum: "DGUV-V3-Prüfung durch Elektro Kaiser GmbH (passt zu Beleg b30): 14 Geräte, ein Föhn mit Kabelschaden ausgesondert; nächste Prüfung 08/2027.",
    daten: (h) => ({ pruefer: "Elektro Kaiser GmbH, Elektrofachkraft Jan Kaiser", datum: "2026-08-18", messgeraet: "Gossen Metrawatt Secutest", pruefart: "Wiederholungsprüfung", umfang: ["Sichtprüfung", "Messung des Schutzleiterwiderstands", "Messung des Isolationswiderstands", "Funktionsprüfung"], norm: "DIN EN 50678 (VDE 0701) / DIN EN 50699 (VDE 0702)", einsatz: "ortsveraenderliche_elektrische_betriebsm", leerzeilen: false, geraete: eintraege("pruefprotokoll_elektro", "geraete", geraete, h) }) });

  dok({ id: "hautschutz", vorlage: "hautschutzplan", datum: "2026-02-03", worum: "Hautschutzplan Salon: alle 6 Friseur-Vorschläge der App (Shampoonieren, Färben/Dauerwelle/Blondierung, Auswaschen, Styling, Reinigung, lange Handschuhtragezeiten).",
    daten: (h) => ({ bereich: "Salon", eintraege: vorschlaegeGruppe("hautschutzplan", "eintraege", "Friseur", h), erstellt_von: "Chris Sonnberg", datum: "2026-02-03" }) });
  dok({ id: "hygiene", vorlage: "hygieneplan", datum: "2026-02-03", worum: "Hygieneplan Friseursalon: alle 18 Beauty-Vorschläge der App (Hände, Instrumente, Flächen, Wäsche, Abfall, Umgang mit Blut, Unterweisung).",
    daten: (h) => ({ bereich: "Friseursalon", eintraege: vorschlaegeGruppe("hygieneplan", "eintraege", "Alle Beauty-Betriebe", h), erstellt_von: "Chris Sonnberg", datum: "2026-02-03" }) });

  // ---------------------------------------------------------------- Umsatzsteuer-Voranmeldungen Januar–Dezember (Ist, Übernahme + Kasse von Hand)
  const erwartet = D.ustMonate();
  const ust: Bau["ust"] = [];
  for (const em of erwartet) {
    const id = `ust-${em.m}`;
    const tag = D.VA_TAG[em.m]!;
    let app: Record<string, string> = {};
    let anzahl = 0;
    let offen = 0;
    let versteuerung = "";
    dok({ id, vorlage: "ust_voranmeldung", datum: tag, worum: `USt-Voranmeldung ${D.MONATE[Number(em.m.slice(5)) - 1]} 2026 (Ist): „Aus Rechnungen übernehmen“ (umsaetzeFuer mit „ist“: Rechnungen nach Zahlungseingang${em.nummern.length ? ` – hier ${em.nummern.join(", ")}` : " – hier keine"}), Vorsteuer aus Belegen, danach Kassenumsätze laut Z-Bon von Hand addiert (19 %: ${euro(em.k19)} €).`,
      daten: () => ({}),
      danach: (u) => {
        versteuerung = String(u.daten.versteuerung ?? "");
        const erg = umsaetzeFuer(s.unterlagen, em.m, s.betrieb, versteuerung === "ist" ? "ist" : "soll", s.belege);
        if (!erg) {
          auffaellig.push(`umsaetzeFuer(${em.m}) lieferte null.`);
          return;
        }
        app = erg.werte;
        anzahl = erg.anzahl;
        offen = erg.offen;
        s = felderSetzen(s, id, erg.werte, t(tag, 9));
        const u19 = ausEuro(erg.werte.umsatz_19 ?? "0") + em.k19;
        s = felderSetzen(s, id, { umsatz_19: euro(u19), notiz: `Aus Rechnungen übernommen (${MARKE.name}, Ist-Versteuerung, ${erg.anzahl} Zahlungseingänge/Erstattungen): 19 % ${erg.werte.umsatz_19} €. Vorsteuer aus ${erg.vorsteuerBelege} ${erg.vorsteuerBelege === 1 ? "Beleg" : "Belegen"}.\nZuzüglich Kassenumsätze laut Z-Bon (netto, 19 %): ${euro(em.k19)} €.` }, t(tag, 9));
      } });
    vergleichText(`USt ${em.m}`, "Versteuerungsart in der Voranmeldung (aus „Mein Betrieb“)", versteuerung, "ist");
    vergleich(`USt ${em.m} (Übernahme, Ist)`, "Umsätze 19 % aus Rechnungen (nach Zahlungseingang)", ausEuro(app.umsatz_19 ?? "0"), em.r19);
    vergleich(`USt ${em.m} (Übernahme, Ist)`, "Umsätze 7 %", ausEuro(app.umsatz_7 ?? "0"), em.r7);
    vergleich(`USt ${em.m} (Übernahme aus Belegen)`, "Vorsteuer (nach Belegdatum)", ausEuro(app.vorsteuer ?? "0"), em.vorsteuer);
    vergleichText(`USt ${em.m} (Übernahme, Ist)`, "Anzahl zugeordneter Rechnungen/Stornos", String(anzahl), String(em.nummern.length));
    const erg = v("ust_voranmeldung").ergebnis!(unterlage(id).daten);
    vergleich(`USt ${em.m} (fertige Voranmeldung)`, "Zahllast (mit Cent)", ausEuro(erg[2]![1]) * (erg[2]![0] === "Erstattung" ? -1 : 1), em.zahllast);
    ust.push({ m: em.m, app, appAnzahl: anzahl, offen, versteuerung, final: Object.fromEntries(["umsatz_19", "umsatz_7", "umsatz_igl", "umsatz_48", "umsatz_13b", "umsatz_frei", "vorsteuer"].map((k) => [k, String(unterlage(id).daten[k] ?? "")])) });
  }
  // Januar 2027: die im Januar 2027 bezahlte Rechnung 2026-017 gehört dorthin (nur Übernahme, keine Unterlage)
  {
    const jan = umsaetzeFuer(s.unterlagen, "2027-01", s.betrieb, "ist", s.belege);
    const r17 = D.vorgaenge().find((x) => x.nummer === "2026-017")!;
    vergleich("USt 2027-01 (Übernahme, Ist)", "Umsätze 19 %: Rechnung 2026-017, bezahlt 12.01.2027", ausEuro(jan?.werte.umsatz_19 ?? "0"), r17.s.gruppen["19"]!.netto);
    infos.push(`Ist-Übernahme meldet ${ust.at(-1)?.offen ?? "?"} geteilte Rechnung(en) ohne Zahlungseingang (offeneRechnungen zum Zeitpunkt der VA Dezember, 11.01.2027 – erwartet 1: 2026-018; 2026-017 ist dort schon bezahlt vermerkt, weil der Stand das Jahresende abbildet).`);
  }
  // Gegenprobe Soll: Summe der Rechnungsumsätze 2026 nach Leistung (Grundlage der Umsatzerlöse in der GuV)
  const sollJahr = D.MONATE_2026.reduce((a, mm) => a + ausEuro(umsaetzeFuer(s.unterlagen, mm, s.betrieb, "soll", s.belege)?.werte.umsatz_19 ?? "0"), 0);
  const g = D.guv();
  vergleich("GuV-Gegenprobe", "Umsatzerlöse aus Rechnungen 2026 = Summe der Soll-Übernahmen Jan–Dez (App, Modus „soll“)", sollJahr, g.ertraege["Umsatzerlöse aus Rechnungen"]);

  // ---------------------------------------------------------------- Jahresabschluss: Bilanz und GuV (GmbH – keine EÜR)
  const bz = D.bilanz();
  dok({ id: "bilanz", vorlage: "bilanz_guv", datum: "2027-03-15", worum: "Jahresabschluss 2026 der GmbH (Kleinstkapitalgesellschaft): GuV nach HGB periodengerecht (Rechnungen nach Leistung inkl. offener, Kasse netto, Aufwand nach Belegdatum, AfA), Bilanz aus Eröffnungsbilanz und Zahlungsflüssen fortgeschrieben. Die App übernimmt hierfür nichts – Werte von Hand (wie von der Steuerkanzlei).",
    daten: (h) => ({ stichtag: "2026-12-31",
      ertraege: eintraege("bilanz_guv", "ertraege", Object.entries(g.ertraege).map(([posten, b]) => ({ posten, betrag: euro(b) })), h),
      aufwendungen: eintraege("bilanz_guv", "aufwendungen", Object.entries(g.aufwand).map(([posten, b]) => ({ posten, betrag: euro(b) })), h),
      aktiva: eintraege("bilanz_guv", "aktiva", bz.aktiva.map(([posten, b]) => ({ posten, betrag: euro(b) })), h),
      passiva: eintraege("bilanz_guv", "passiva", bz.passiva.map(([posten, b]) => ({ posten, betrag: euro(b) })), h) }) });
  {
    const erg = v("bilanz_guv").ergebnis!(unterlage("bilanz").daten);
    const j = erg[0]!;
    vergleich("Bilanz/GuV 2026", "Jahresüberschuss (vor Ertragsteuern)", ausEuro(j[1]) * (j[0] === "Jahresfehlbetrag" ? -1 : 1), g.jahresueberschuss);
    vergleich("Bilanz/GuV 2026", "Summe Aktiva", ausEuro(erg[1]![1]), bz.summeAktiva);
    vergleich("Bilanz/GuV 2026", "Summe Passiva", ausEuro(erg[2]![1]), bz.summePassiva);
    vergleichText("Bilanz/GuV 2026", "Bilanz geht auf (keine Zeile „Differenz – bitte prüfen“)", erg.some((z) => z[0].startsWith("Differenz")) ? "Differenz" : "geht auf", "geht auf");
  }

  // EÜR: gilt für die GmbH nicht. StB-Prüfung (E-4): die App sperrt die Übernahme für bilanzierende Betriebe („Bilanz
  // statt EÜR“) – erwartet sind deshalb leere Listen; die unabhängig gerechneten Zuflusswerte (D.euerZufluss) bleiben
  // nur zur Dokumentation in SZENARIO.md.
  const euer = euerUebernahme(s, "2026");
  {
    const zahl = (l: Record<string, string>[], f: (x: Record<string, string>) => boolean) => l.filter(f).reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0);
    vergleich("EÜR-Übernahme (gilt für GmbH nicht, gesperrt – E-4)", "Einnahmen netto aus 2026 bezahlten Rechnungen", zahl(euer.einnahmen, (x) => !/^Vereinnahmte Umsatzsteuer/.test(x.kategorie ?? "")), 0);
    vergleich("EÜR-Übernahme (gilt für GmbH nicht, gesperrt – E-4)", "Vorsteuer nach Zahlung", zahl(euer.ausgaben, (x) => x.kategorie === "Gezahlte Vorsteuerbeträge"), 0);
    vergleichText("EÜR-Übernahme (gilt für GmbH nicht)", "Hinweis der Übernahme auf Rechtsform/Bilanzierungspflicht", /GmbH|Bilanz|Kapitalgesellschaft|Buchführungspflicht/.test(euer.hinweis) ? "ja" : "nein", "ja");
  }

  // ---------------------------------------------------------------- Steuererklärungen (Zusammenstellung) KSt, GewSt, USt
  const vaSumme = (k: string) => erwartet.reduce((a, em) => a + ausEuro(String(unterlage(`ust-${em.m}`).daten[k] ?? "0")), 0);
  const ustJahr = erwartet.reduce((a, em) => a + ausEuro(v("ust_voranmeldung").ergebnis!(unterlage(`ust-${em.m}`).daten)[0]![1]), 0);
  dok({ id: "steuer", vorlage: "steuererklaerung", datum: "2027-05-31", worum: "Zusammenstellung für KSt, GewSt und USt 2026: Jahresüberschuss aus der Bilanz/GuV (vor Ertragsteuern), Umsätze/USt/Vorsteuer als Summe der zwölf Voranmeldungen (Ist), KSt-Vorauszahlungen 4 × 600 €, GewSt-Vorauszahlungen 4 × 550 €.",
    daten: (h) => ({ jahr: "2026", arten: ["kst", "gewst", "ust"], gewinn: euro(g.jahresueberschuss), umsatz: euro(vaSumme("umsatz_19") + vaSumme("umsatz_7") + (vaSumme("umsatz_frei") + vaSumme("umsatz_igl") + vaSumme("umsatz_48") + vaSumme("umsatz_13b"))), ust_jahr: euro(ustJahr), vorsteuer_jahr: euro(vaSumme("vorsteuer")),
      vorauszahlungen: eintraege("steuererklaerung", "vorauszahlungen", [...[1, 2, 3, 4].map((q) => ({ art: `Körperschaftsteuer Q${q} (inkl. SolZ)`, betrag: "600,00" })), ...[1, 2, 3, 4].map((q) => ({ art: `Gewerbesteuer Q${q}`, betrag: "550,00" }))], h),
      weiteres: eintraege("steuererklaerung", "weiteres", [{ was: "Verlustvortrag aus dem Rumpfwirtschaftsjahr 2025 (KSt und GewSt)", betrag: "6.900,00", beleg: true }, { was: "Geschäftsführergehälter (angemessen, Anstellungsverträge vom 10.03.2025)", betrag: euro(12 * 2 * D.GF_GEHALT), beleg: true }], h),
      notiz: "Gewinnermittlung durch Bestandsvergleich (§ 5 EStG, § 8 KStG) – Bilanz, GuV und E-Bilanz erstellt die Steuerkanzlei. Umsatzsteuer nach vereinnahmten Entgelten (§ 20 UStG); Kassenumsätze in den Voranmeldungen von Hand ergänzt." }) });
  {
    const j = D.jahresSummen();
    vergleich("Steuererklärung", "Umsätze im Jahr netto (Summe der Voranmeldungen, Ist)", vaSumme("umsatz_19") + vaSumme("umsatz_7") + (vaSumme("umsatz_frei") + vaSumme("umsatz_igl") + vaSumme("umsatz_48") + vaSumme("umsatz_13b")), j.r19 + j.r7 + j.r0 + j.k19);
    vergleich("Steuererklärung", "Umsatzsteuer im Jahr (Summe der Voranmeldungen, mit Cent)", ustJahr, j.ust);
    vergleich("Steuererklärung", "Vorsteuer im Jahr", vaSumme("vorsteuer"), j.vorsteuer);
  }

  // ---------------------------------------------------------------- übersprungene Vorlagen
  uebersprungen.push(
    { id: "euer", titel: v("euer").titel, grund: "GmbH: Formkaufmann (§ 6 HGB, § 13 Abs. 3 GmbHG), buchführungspflichtig nach § 238 HGB / § 140 AO – Gewinnermittlung durch Bestandsvergleich (Bilanz und GuV), keine EÜR. Die App bietet die EÜR trotzdem an (siehe Auffälligkeiten)." },
    { id: "allergene", titel: v("allergene").titel, grund: "Kein Lebensmittelbetrieb (Kundenkaffee wird kostenlos gereicht)." },
    { id: "haccp", titel: v("haccp").titel, grund: "Kein Lebensmittelbetrieb." },
    { id: "ifsg_belehrung", titel: v("ifsg_belehrung").titel, grund: "Keine Tätigkeit mit Lebensmitteln nach § 42 IfSG." },
    { id: "kassenbuch", titel: v("kassenbuch").titel, grund: "Elektronisches Kassensystem mit TSE; Kassenbericht kommt aus dem System (keine offene Ladenkasse)." },
    { id: "datenpanne", titel: v("datenpanne").titel, grund: "Im Jahr 2026 gab es keine Datenpanne." },
    // StB-Prüfung (5.2, C-9): OSS-Erklärung und Zusammenfassende Meldung (Übertragungshilfen, neu)
    { id: "oss_meldung", titel: v("oss_meldung").titel, grund: "Keine Fernverkäufe bzw. Leistungen an Privatpersonen im EU-Ausland – kein OSS-Verfahren." },
    { id: "zm_meldung", titel: v("zm_meldung").titel, grund: "Keine innergemeinschaftlichen Lieferungen oder Leistungen an Unternehmen im EU-Ausland." },
  );
  // E-167 (Sifa-Durchsicht): neue Vorlagen Betriebsanweisung Maschinen und Biostoffe, Expositionsverzeichnis
  uebersprungen.push(
    { id: "betriebsanweisung_maschine", titel: v("betriebsanweisung_maschine").titel, grund: "Föhne, Glätteisen und Trockenhauben werden nach der Betriebsanleitung benutzt; eine eigene Betriebsanweisung ist im Szenario nicht erstellt (Pflichten-Check nennt sie – siehe Auffälligkeiten)." },
    { id: "betriebsanweisung_biostoffe", titel: v("betriebsanweisung_biostoffe").titel, grund: "Friseurtätigkeiten ohne Behandlungen mit Blutkontakt – Hygiene über den Hygieneplan; ob eine Betriebsanweisung Biostoffe nötig ist, klärt die Gefährdungsbeurteilung (Pflichten-Check nennt sie – siehe Auffälligkeiten)." },
    { id: "expositionsverzeichnis", titel: v("expositionsverzeichnis").titel, grund: "Keine Gefahrstoffe der Kategorie 1A/1B im Gefahrstoffverzeichnis des Salons (Pflichten-Check nennt das Verzeichnis – siehe Auffälligkeiten)." },
  );
  const genutzt = new Set(docs.map((d) => d.vorlage));
  for (const vl of VORLAGEN) if (!genutzt.has(vl.id) && !uebersprungen.some((u) => u.id === vl.id)) auffaellig.push(`Vorlage ${vl.id} weder erzeugt noch als übersprungen begründet.`);

  // ---------------------------------------------------------------- Pflichten-Check der App für diesen Betrieb
  const stichtag = "2026-01-15";
  const a = auswertung(s.profil, stichtag, s.unterlagen.filter((u) => (u.ausgegeben ?? "") < "2026-01-16"), s.mitarbeiter);
  const zeile = (p: PflichtInfo): PflichtZeile => ({ id: p.id, titel: p.titel, vorlage: p.vorlage, erzeugt: !!p.vorlage && genutzt.has(p.vorlage), termin: p.naechsterTermin, termine: p.termine.length, grund: p.grund });
  const pflichten = { stichtag, gilt: a.gilt.map(zeile), gruendung: a.gruendung.map(zeile), unbekannt: a.unbekannt.map((p) => ({ titel: p.titel, fragen: p.offeneFragen })) };
  const istDa = (id: string) => (a.gilt.some((p) => p.id === id) ? "gilt" : a.gruendung.some((p) => p.id === id) ? "gilt (Gründung)" : a.unbekannt.some((p) => p.id === id) ? "unklar" : "fehlt");
  // Erwartung aus dem Profil (GmbH, Hamburg, Friseurhandwerk, 4 Beschäftigte inkl. 1 Jugendlicher, Website mit Terminbuchung)
  const ERWARTET: [string, "gilt" | "fehlt", string][] = [
    ["gesellschaft.jahresabschluss", "gilt", "GmbH: Jahresabschluss aufstellen (§ 242, § 264 HGB)"],
    ["gesellschaft.offenlegung", "gilt", "GmbH: Offenlegung/Hinterlegung (§ 325 HGB)"],
    ["steuern.buchfuehrungspflicht", "gilt", "GmbH als Formkaufmann (§ 238 HGB)"],
    ["steuern.e_bilanz", "gilt", "§ 5b EStG"],
    ["steuern.kst_erklaerung", "gilt", "Körperschaftsteuer"],
    ["steuern.gewst_erklaerung", "gilt", "Gewerbesteuer"],
    ["steuern.ust_voranmeldung", "gilt", "monatlich"],
    ["steuern.ust_jahreserklaerung", "gilt", "§ 18 Abs. 3 UStG"],
    ["personal.lohnsteuer_anmeldung", "gilt", "monatlich (Profil)"],
    ["personal.jugendarbeitsschutz", "gilt", "1 Jugendlicher (Profil)"],
    ["branche.beauty_hygieneplan", "gilt", "Beauty"],
    ["branche.beauty_hautschutzplan", "gilt", "Beauty"],
    ["arbeitsschutz.gefahrstoffe", "gilt", "Färbe-/Blondiermittel"],
    ["online.impressum", "gilt", "Website"],
    ["online.datenschutzerklaerung", "gilt", "Website"],
    ["steuern.kassenmeldung", "gilt", "elektronische Kasse"],
    ["steuern.euer", "fehlt", "GmbH bilanziert – keine Anlage EÜR"],
    ["steuern.est_erklaerung", "fehlt", "die GmbH gibt keine Einkommensteuererklärung ab"],
  ];
  for (const [id, soll, warum] of ERWARTET) {
    const ist = istDa(id);
    vergleichText(`Pflichten-Check (${D.de(stichtag)})`, `${id} (${warum})`, ist === "gilt (Gründung)" && soll === "gilt" ? "gilt" : ist, soll);
  }
  // Transparenzregister: bei Gründung (seit 2021 Vollregister) – darf in der Gründungsliste stehen
  vergleichText(`Pflichten-Check (${D.de(stichtag)})`, "gesellschaft.transparenzregister (GmbH, Mitteilung nach § 20 GwG)", istDa("gesellschaft.transparenzregister") === "fehlt" ? "fehlt" : "vorhanden", "vorhanden");
  const termin = (id: string) => [...a.gilt, ...a.gruendung].find((p) => p.id === id)?.naechsterTermin ?? "–";
  vergleichText(`Pflichten-Check (${D.de(stichtag)})`, "USt-Voranmeldung: nächster Termin (monatlich, Januar → 10.02.2026)", termin("steuern.ust_voranmeldung"), "2026-02-10");
  vergleichText(`Pflichten-Check (${D.de(stichtag)})`, "Lohnsteuer-Anmeldung: nächster Termin (monatlich → 10.02.2026)", termin("personal.lohnsteuer_anmeldung"), "2026-02-10");
  const ende = auswertung(s.profil, "2026-12-31", s.unterlagen).gilt.find((p) => p.id === "arbeitsschutz.unterweisung_wiederholen");
  vergleichText("Pflichten-Check (31.12.2026)", "Unterweisung wiederholen – nächster Termin (letzte jährliche 10.02.2026; Jugendlicher halbjährlich: 10.02.2027 bzw. früher)", ende?.naechsterTermin ?? "fehlt", "2027-02-10");
  for (const p of pflichten.gilt) if (p.vorlage && !p.erzeugt) auffaellig.push(`Pflichten-Check: „${p.titel}“ gilt, die zugehörige Vorlage ${p.vorlage} wurde im Szenario nicht erzeugt.`);
  const belegt = new Set([...a.gilt, ...a.gruendung].map((p) => p.vorlage).filter(Boolean));
  for (const vid of genutzt) if (!belegt.has(vid) && vid !== "rechnung") infos.push(`Pflichten-Check: keine geltende Pflicht verweist auf die erzeugte Vorlage „${v(vid).titel}“ (${vid}).`);

  return { s, docs, auffaellig, infos, belegDateien, xmls, ohneXml, vergleiche, ust, euer, uebersprungen, pflichten };
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

/** Steuerberater-Pakete für Juni 2026 (Monat mit Storno und Erstattung) und das Jahr – mit den Belegdateien */
export function pakete(s: Stand, dateien: Record<string, Uint8Array>): { monat: PaketErgebnis; jahr: PaketErgebnis } {
  const sb = s.steuerberatung;
  return {
    monat: steuerpaket(s, { von: "2026-06-01", bis: "2026-06-30", name: "2026-06" }, sb, dateien, "2026-07-06T09:30:00"),
    jahr: steuerpaket(s, { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, sb, dateien, "2027-02-15T10:00:00"),
  };
}

/** Nachtrag StB 22.10.2026: Jahrespaket mit der Kontenvorgabe „Zahlungseingänge buchen“ (Standard aus) – Gegenprobe A-4 */
export function jahrMitZahlungen(s: Stand, dateien: Record<string, Uint8Array>): PaketErgebnis {
  const sb = { ...s.steuerberatung, kontenvorgaben: { ...s.steuerberatung.kontenvorgaben, zahlungenBuchen: true } };
  return steuerpaket(s, { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, sb, dateien, "2027-02-15T10:00:00");
}

/**
 * E-165 (StB-Prüfung A-3): unabhängige Gegenprobe mit der Kontenvorgabe „Personenkonten für Kunden und Lieferanten
 * (OPOS)“ – eigenes Paket „mit Personenkonten“; das Standardpaket (Vorgabe aus) bleibt unverändert.
 */
export function jahrMitPersonenkonten(s: Stand, dateien: Record<string, Uint8Array>): PaketErgebnis {
  const sb = { ...s.steuerberatung, kontenvorgaben: { ...s.steuerberatung.kontenvorgaben, personenkonten: true } };
  return steuerpaket({ ...s, steuerberatung: sb }, { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, sb, dateien, "2027-02-15T10:00:00");
}

// ---------------------------------------------------------------- Belegdateien (so, wie die Lieferanten sie ausstellen würden)

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function belegHtml(b: D.BelegRoh): string {
  const sm = D.belegSumme(b);
  const [str, ort] = b.anschrift.split("\n");
  const bon = b.art === "brutto" && b.kategorie !== "versicherungen" && b.kategorie !== "personal";
  const eigen = b.kategorie === "personal";
  const kopf = `<div class="lief"><strong>${esc(b.lieferant)}</strong><br>${esc(str ?? "")}<br>${esc(ort ?? "")}</div>`;
  const zeilen = b.pos.map((x) => `<tr><td>${esc(x.text)}${x.menge ? `<br><small>${esc(x.menge)}</small>` : ""}</td><td class="r">${x.satz} %</td><td class="r">${D.eur(x.betrag)} €</td></tr>`).join("");
  const steuer = sm.jeSatz.map((x) => `<tr><td>${x.satz ? `${b.art === "brutto" ? "enth. " : ""}USt ${x.satz} %` : "ohne USt"}</td><td class="r">netto ${D.eur(x.netto)} €</td><td class="r">${x.satz ? `${D.eur(x.ust)} €` : "–"}</td></tr>`).join("");
  const css = `body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#222;margin:0}.blatt{${bon ? "width:80mm;margin:10mm auto;border:1px dashed #999;padding:6mm" : "margin:18mm 20mm"}}table{width:100%;border-collapse:collapse;margin-top:6mm}td,th{padding:3px 4px;border-bottom:1px solid #ddd;vertical-align:top}th{text-align:left;border-bottom:2px solid #444}.r{text-align:right;white-space:nowrap}.lief{font-size:${bon ? "10pt" : "11pt"}}h1{font-size:${bon ? "13pt" : "18pt"};margin:6mm 0 2mm}.an{margin-top:10mm}.summe td{font-weight:bold;border-top:2px solid #444}small{color:#666}`;
  const titel = eigen ? "Lohnjournal (Eigenbeleg)" : bon ? "Kassenbon" : b.kategorie === "versicherungen" ? "Beitragsrechnung" : "Rechnung";
  const an = bon || eigen ? "" : `<div class="an">${esc(D.BETRIEB.name)}<br>z. Hd. Geschäftsführung<br>${esc(D.BETRIEB.strasse)}<br>${D.BETRIEB.plz} ${D.BETRIEB.ort}</div>`;
  const fuss = b.zahlung === "bar" ? "Bar bezahlt." : b.zahlung === "privat" ? "Mit EC-Karte bezahlt (Karte der Geschäftsführerin, privat)." : eigen ? "Überweisungen laut Lohnabrechnung." : "Zahlbar per Überweisung bzw. SEPA-Lastschrift.";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="blatt">${kopf}${an}
<h1>${titel}${b.nummer ? ` ${esc(b.nummer)}` : ""}</h1><div>Datum: ${D.de(b.datum)}${!bon && !eigen ? ` · Leistung: ${D.de(b.datum)} bzw. laut Positionen` : ""}</div>
<table><tr><th>${bon ? "Artikel" : "Position"}</th><th class="r">USt</th><th class="r">${bon ? "Brutto" : b.art === "netto" ? "Netto" : "Betrag"}</th></tr>${zeilen}</table>
<table>${steuer}<tr class="summe"><td>${bon ? "SUMME" : eigen ? "Summe Personalkosten" : "Rechnungsbetrag"}</td><td></td><td class="r">${D.eur(sm.brutto)} €</td></tr></table>
<p><small>${fuss}${!bon && !eigen ? ` Steuernummer des Lieferanten: 4${b.id.slice(1)}/7${b.id.slice(1)}/0${b.id.slice(1)}19.` : ""}</small></p></div></body></html>`;
}
