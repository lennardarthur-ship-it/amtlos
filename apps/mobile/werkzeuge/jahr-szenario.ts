/**
 * Jahres-Szenario „Café Morgenrot“ 2026 – der App-Ablauf: Der Stand entsteht mit denselben Funktionen wie in der App
 * (anlegen → felderSetzen → ausgeben/festschreiben → stornieren, bezahltSetzen, belegSetzen, E-Rechnung einlesen,
 * umsaetzeFuer, euerUebernahme, steuerpaket). Rohdaten und die unabhängig gerechneten Erwartungswerte stehen in
 * jahr-szenario-daten.ts; hier wird nur verglichen und jede Abweichung als Auffälligkeit gesammelt.
 *
 * Gebündelt und ausgeführt von werkzeuge/jahr-szenario.mjs (Chromium für die PDFs).
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
  fehlendeTage,
  kassenVerlauf,
  kassenbuchDaten,
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
import { kasseKorrigieren, kassensturzSpeichern, offenerBetrag, zahlungVermerken } from "../src/unterlagen/speicher";
import { kassenDifferenzBuchungen, skontoBuchungenBelege, kassenBuchungen as kassenBuchungenR12, type KassenInhalt } from "@amtlos/fachlogik";
import { LEERER_STAND, anlegen, ausgeben, belegSetzen, bezahltSetzen, felderSetzen, kasseSpeichern, personSetzen, profilSetzen, steuerberatungSetzen, stornieren, type Stand, type Unterlage } from "../src/unterlagen/speicher";
import { euerUebernahme, steuerpaket, type PaketErgebnis } from "../src/unterlagen/steuerpaket";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { kasseFuerUst } from "../src/unterlagen/kasse";
import { fussAngaben, fusszeileStempeln } from "../src/unterlagen/fusszeile";
import { mitSchriften } from "../src/unterlagen/schriften";
import { auswertung } from "../src/pflichten/check";
import * as D from "./jahr-szenario-daten";
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
  /** Eingaben in Alltagssprache */
  worum: string;
  fehlt: string[];
}

export interface Bau {
  s: Stand;
  docs: Dok[];
  auffaellig: string[];
  infos: string[];
  /** Belegdateien zum Rendern (PDF) bzw. fertig (XML) */
  belegDateien: { datei: string; html?: string; xml?: string }[];
  /** XRechnung der Ausgangsrechnungen */
  xmls: { datei: string; xml: string; nummer: string }[];
  ohneXml: { nummer: string; fehlt: string[] }[];
  vergleiche: { bereich: string; was: string; app: string; erwartet: string; ok: boolean }[];
  ust: { q: string; app: Record<string, string>; appAnzahl: number; kasse: { k19: number; k7: number; tage: number }; final: Record<string, string> }[];
  euer: { uebernahme: ReturnType<typeof euerUebernahme>; final: Daten; ergebnis: [string, string][] };
  uebersprungen: { id: string; titel: string; grund: string }[];
  /** Pflichten-Check der App für das Café (Stichtag 15.01.2026) */
  pflichten: { gilt: { id: string; titel: string; vorlage: string | null; erzeugt: boolean }[]; unbekannt: { titel: string; fragen: string[] }[] };
}

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
  /** Vergleich ohne Beträge (Texte, ja/nein, Datum) */
  const vergleichText = (bereich: string, was: string, app: string, erwartet: string) => {
    const ok = app === erwartet;
    vergleiche.push({ bereich, was, app, erwartet, ok });
    if (!ok) auffaellig.push(`${bereich} – ${was}: App „${app}“, erwartet „${erwartet}“.`);
    return ok;
  };

  // ---------------------------------------------------------------- Betrieb, Pflichten-Check, Personen
  let s: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, ...D.BETRIEB }, proTest: true };
  s = profilSetzen(s, {
    "taetigkeit.branchen": ["gastronomie_lebensmittel"],
    rechtsform: "einzelunternehmen",
    "taetigkeit.einordnung": "gewerbe",
    bundesland: "SN",
    "beschaeftigte.gesamt": 2,
    "kasse.elektronisch": true,
    // R12: montags Ruhetag – zählt nicht als fehlender Kassenabschluss
    "kasse.ruhetage": ["1"],
    "online.website": true,
    "ust.kleinunternehmer": false,
    steuerberater: true,
    gruendungsdatum: D.GRUENDUNG,
    erwerb: "haupt",
    "erlaubnis.gaststaette": true,
    "umsatz.vorjahr": 158400,
    "umsatz.prognose_laufendes_jahr": 166000,
    "gewinn.vorjahr": 38900,
    "gewinn.prognose_laufendes_jahr": 40000,
    "ust.zahllast_vorjahr": 12850,
    "ust.dauerfristverlaengerung": false,
    "vorauszahlung.est_kst": true,
    "vorauszahlung.gewst": true,
    "kunden.segmente": ["b2c", "b2b"],
    "kunden.regionen": ["inland", "eu"],
    "vertrieb.kanaele": ["ladengeschaeft", "vor_ort_beim_kunden"],
    "produkte.arten": ["lebensmittel", "dienstleistung", "verpackung"],
    "handel.hohe_bargeschaefte": false,
    "beschaeftigte.minijob": 1,
    "beschaeftigte.azubi": 0,
    "beschaeftigte.jugendlich": 0,
    "personal.sofortmeldebranchen": ["gastronomie"],
    // R11 (Rechtsprüfung Befund 7): IfSG-Pflichten nur bei Arbeit mit Lebensmitteln, Bescheinigung nur erstmals
    "ifsg.beschaeftigte": "erstmals",
    "ifsg.selbst": "bescheinigung",
    "arbeitsschutz.elektrische_geraete": true,
    "arbeitsschutz.gefahrstoffe": true,
    "datenverarbeitung.arten": ["kundendaten", "beschaeftigtendaten"],
    "datenschutz.dienstleister": true,
    "ki.nutzung": true,
    "ki.eigene_produkte": false,
    "nis2.betroffen": "nein",
    "gesellschafter.auslaendische_investoren": false,
  });
  s = steuerberatungSetzen(s, { kontenrahmen: "SKR03", beraternummer: "29098", mandantennummer: "10457" });
  for (const [id, k] of Object.entries(D.KUNDEN)) s = personSetzen(s, "kunde", { id, ...k } as never, t("2026-01-02"));
  for (const [id, m] of Object.entries(D.MITARBEITER)) s = personSetzen(s, "mitarbeiter", { id, ...m } as never, t("2026-01-02"));

  const docs: Dok[] = [];
  const uebersprungen: Bau["uebersprungen"] = [];
  let nr = 0;
  const v = (id: string) => vorlageFuer(id)!;
  const feld = (vid: string, fid: string) => v(vid).abschnitte.flatMap((a) => a.felder).find((f) => f.id === fid) as Extract<Feld, { art: "liste" }>;
  /** Listeneinträge mit allen Startwerten (wie „+ Eintrag“ in der App) */
  const eintraege = (vid: string, fid: string, l: Eintrag[], heute: string) => l.map((e) => ({ ...neuerEintrag(feld(vid, fid), s.betrieb, heute), ...e }));
  /** Vorschlag der Vorlage übernehmen (wie „Vorschlag antippen“), gesucht über den Titelanfang */
  const vorschlag = (vid: string, fid: string, titel: string, heute: string, extra: Eintrag = {}) => {
    const f = feld(vid, fid);
    const vs = (f.vorschlaege ?? []).find((x) => x.titel.startsWith(titel));
    if (!vs) throw new Error(`Vorschlag „${titel}“ in ${vid}.${fid} nicht gefunden`);
    return { ...eintragAusVorschlag(f, vs, s.betrieb, heute), ...extra };
  };
  const unterlage = (id: string) => s.unterlagen.find((u) => u.id === id)!;

  /** Unterlage wie in der App: anlegen (Startwerte), Felder setzen, optional nachbearbeiten, teilen (ausgeben) */
  function dok(o: { id: string; vorlage: string; datum: string; worum: string; daten: (heute: string) => Daten; danach?: (u: Unterlage) => void; ordner?: Dok["ordner"]; nichtAusgeben?: boolean }) {
    const [s1] = anlegen(s, o.vorlage, t(o.datum, 9), o.id);
    s = felderSetzen(s1, o.id, o.daten(o.datum), t(o.datum, 9));
    o.danach?.(unterlage(o.id));
    if (!o.nichtAusgeben) s = ausgeben(s, o.id, t(o.datum, 12));
    const u = unterlage(o.id);
    const vl = v(o.vorlage);
    const fehlt = fehlendeAngaben(vl, u.daten, s.betrieb);
    nr++;
    docs.push({ nr, uid: o.id, vorlage: o.vorlage, titel: vl.titel, datum: o.datum, datei: `${String(nr).padStart(2, "0")}-${pdfDateiname(vl, u.daten, o.datum)}`, ordner: o.ordner ?? "pdf", quer: !!vl.querformat, worum: o.worum, fehlt });
    if (fehlt.length) infos.push(`${vl.titel} (${o.id}): App meldet „Fehlt noch“: ${fehlt.join("; ")}`);
    return u;
  }

  // ---------------------------------------------------------------- Ausgangsrechnungen (inkl. Storno)
  const ereignisse: { nummer: string; datum: string; los: () => void }[] = [];
  for (const r of D.RECHNUNGEN) {
    ereignisse.push({
      nummer: r.nummer,
      datum: r.datum,
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
            positionen: r.pos.map((p) => ({ bezeichnung: p.bez, menge: menge(p.menge), einheit: p.einheit, preis: euro(p.preis), satz: String(p.satz) })),
            hinweise: r.hinweise ?? [],
            hinweis: r.hinweis,
          }),
        });
        if (u.daten.nummer !== r.nummer) auffaellig.push(`Rechnungsnummer: erwartet ${r.nummer}, App vergab ${String(u.daten.nummer)}.`);
        if (!u.festgeschrieben) auffaellig.push(`Rechnung ${r.nummer} ist nach dem Teilen nicht festgeschrieben.`);
        // R11: Ersatzrechnung wie in der App über „Kopie“ der stornierten Rechnung – sie merkt sich das Original (`ersetzt`)
        if (r.ersetzt) s = { ...s, unterlagen: s.unterlagen.map((x) => (x.id === r.id ? { ...x, ersetzt: r.ersetzt } : x)) };
        // R12 GoBD: bar an der Kasse bezahlt – die Zahlung kommt mit dem Tagesabschluss (unten)
        if (r.bezahlt && !r.barKasse) s = bezahltSetzen(s, r.id, r.bezahlt, t(r.bezahlt, 15));
      },
    });
    if (r.storno) {
      const st = r.storno;
      ereignisse.push({
        nummer: st.nummer,
        datum: st.datum,
        los: () => {
          const [s1, neu] = stornieren(s, r.id, t(st.datum, 9), st.id);
          if (!neu) {
            auffaellig.push(`Storno von ${r.nummer} nicht möglich (stornieren lieferte null).`);
            return;
          }
          s = s1;
          if (neu.daten.nummer !== st.nummer) auffaellig.push(`Stornonummer: erwartet ${st.nummer}, App vergab ${String(neu.daten.nummer)}.`);
          if (neu.daten.datum !== st.datum) auffaellig.push(`Stornorechnung ${st.nummer}: Datum ${String(neu.daten.datum)} statt ${st.datum}.`);
          // vor dem Teilen noch den Grund ergänzen (Entwurf ist änderbar)
          s = felderSetzen(s, st.id, { hinweis: `Grund: ${st.grund}.` }, t(st.datum, 9));
          s = ausgeben(s, st.id, t(st.datum, 10));
          const u = unterlage(st.id);
          const vl = v("rechnung");
          nr++;
          docs.push({ nr, uid: st.id, vorlage: "rechnung", titel: "Stornorechnung", datum: st.datum, datei: `${String(nr).padStart(2, "0")}-${pdfDateiname(vl, u.daten, st.datum)}`, ordner: "rechnungen", quer: false, worum: `Stornorechnung zu ${r.nummer}: ${st.grund}.`, fehlt: fehlendeAngaben(vl, u.daten, s.betrieb) });
          if (!unterlage(r.id).storniertDurch) auffaellig.push(`${r.nummer} trägt nach dem Storno keinen Verweis storniertDurch.`);
        },
      });
    }
  }
  for (const e of ereignisse.sort((a, b) => a.nummer.localeCompare(b.nummer))) e.los();

  // Summen je Rechnung gegen die unabhängige Rechnung, E-Rechnungen
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
    // was die Vorlage selbst als Ergebnis anzeigt (bei Storno mit negativem Vorzeichen)
    const erg = v("rechnung").ergebnis!(u.daten);
    const brutto = ausEuro(erg.find((z) => z[0] === "Rechnungsbetrag")![1]);
    vergleich("Rechnung " + x.nummer, "Rechnungsbetrag laut Formular", brutto, x.vz * x.s.brutto);
    if (fehlt.length) {
      ohneXml.push({ nummer: x.nummer, fehlt });
      continue;
    }
    const xml = xrechnungUbl(daten, KU_HINWEIS);
    xmls.push({ datei: `E-Rechnung-${daten.nummer.replace(/[^A-Za-z0-9-]+/g, "-")}.xml`, xml, nummer: x.nummer });
    const zahlbar = /<cbc:PayableAmount[^>]*>([-\d.]+)</.exec(xml)?.[1];
    vergleich("E-Rechnung " + x.nummer, "PayableAmount (BT-115)", Math.round(Number(zahlbar) * 100), x.vz * x.s.brutto);
    if (x.r.hinweise?.includes("igl") && !/VATEX-EU-IC/.test(xml)) auffaellig.push(`E-Rechnung ${x.nummer}: innergemeinschaftliche Lieferung ohne VATEX-EU-IC.`);
  }
  const privat = D.RECHNUNGEN.filter((r) => !("email" in D.KUNDEN[r.kunde])).map((r) => r.nummer);
  infos.push(`Ohne XRechnung (App: Angaben fehlen): ${ohneXml.map((o) => `${o.nummer} (${o.fehlt.join(", ")})`).join("; ") || "keine"}. Erwartet: nur Privatkunden ohne E-Mail (${privat.join(", ")}) – an Privatpersonen ist keine E-Rechnung nötig.`);

  // ---------------------------------------------------------------- Belege
  const belegDateien: Bau["belegDateien"] = [];
  for (const b of D.BELEGE) {
    const jetzt = t(b.datum, 18).toISOString();
    if (b.datei === "xml") {
      // die E-Rechnung schreibt der Lieferant – hier mit xrechnungUbl erzeugt, als käme sie von ihm
      const xml = xrechnungUbl(
        {
          nummer: b.nummer!, rechnungsdatum: b.datum, leistungsdatum: "2026-09-11", faellig_am: "2026-09-28",
          steller: { name: b.lieferant, strasse: "Weißenfelser Straße 65", plz: "04229", ort: "Leipzig", land: "DE", email: "rechnung@roestwerk-plagwitz.example", telefon: "0341 2290817", steuernummer: "231/117/40982", ust_idnr: "DE287334190", iban: "DE12860555921100778899", bic: "WELADE8LXXX" },
          kunde: { name: D.BETRIEB.name, strasse: D.BETRIEB.strasse, plz: D.BETRIEB.plz, ort: D.BETRIEB.ort, land: "DE", email: D.BETRIEB.email, kaeufer_referenz: "Kundennr. 10233", geschaeftskunde: true },
          positionen: D.ERECHNUNG_POS.map((p) => ({ bezeichnung: p.bez, menge: p.menge, einheit: "stueck", einheit_code: p.einheit === "Kilogramm" ? "KGM" : "LS", preis_cent: p.preis, ust_satz: p.satz })),
          kleinunternehmer: false,
          hinweis: "Zahlbar bis 28.09.2026 ohne Abzug.",
        },
        KU_HINWEIS,
      );
      const gelesen = eRechnungLesen(xml);
      if (!gelesen) {
        auffaellig.push(`E-Rechnung ${b.nummer} ließ sich nicht lesen (eRechnungLesen → null).`);
        continue;
      }
      // die Käuferreferenz (BT-10) ist kein Verwendungszweck; die XRechnung hat keinen (BT-83/PaymentID fehlt)
      vergleichText("E-Rechnung einlesen", `${b.nummer}: Verwendungszweck (Käuferreferenz „Kundennr. 10233“ zählt nicht)`, gelesen.verwendungszweck ?? "–", "–");
      const roh = belegAusERechnung(gelesen, b.id, jetzt);
      if (roh.notiz && /weicht|prüfen/.test(roh.notiz)) auffaellig.push(`E-Rechnung ${b.nummer} eingelesen mit Hinweis: ${roh.notiz.replace(/\n/g, " | ")}`);
      infos.push(`E-Rechnung ${b.nummer} eingelesen: Lieferant „${roh.lieferant}“, Kategorie zunächst „${kategorieFuer(roh.kategorie).titel}“ (von Hand auf „Waren und Material“ gestellt), Zahlung bank, Notiz: ${(roh.notiz ?? "").replace(/\n/g, " | ")}`);
      // in der App: Kategorie wählen und Zahlung vermerken
      s = belegSetzen(s, { ...roh, kategorie: b.kategorie, bezahlt: b.bezahlt, datei: `${b.id}.xml` }, t(b.datum, 18));
      belegDateien.push({ datei: `${b.id}.xml`, xml });
    } else {
      const sm = D.belegSumme(b);
      const beleg: Beleg = {
        id: b.id, datum: b.datum, lieferant: b.lieferant, nummer: b.nummer, kategorie: b.kategorie,
        steuer: sm.jeSatz.map((x) => ({ satz: x.satz, brutto_cent: x.brutto })),
        vorsteuer: b.vorsteuer, zahlung: b.zahlung, bezahlt: b.bezahlt, notiz: b.notiz ?? null, datei: `${b.id}.pdf`, quelle: "foto", erstellt: jetzt, geaendert: jetzt,
        ...(b.skonto ? { skonto_cent: b.skonto } : {}),
      };
      s = belegSetzen(s, beleg, t(b.datum, 18));
      belegDateien.push({ datei: `${b.id}.pdf`, html: belegHtml(b) });
    }
    const app = belegSummen(s.belege.find((x) => x.id === b.id)!);
    const erw = D.belegSumme(b);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Brutto", app.brutto_cent, erw.brutto);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Vorsteuer (App rechnet aus Brutto, Beleg weist aus)", app.vorsteuer_cent, erw.vorsteuer);
  }

  // ---------------------------------------------------------------- R12: Tagesabschlüsse der Kasse (Z-Bons) für das ganze Jahr
  // wie die Inhaberin jeden Abend: Umsatz je Satz brutto, Kartenanteil, Geldtransit bzw. Privatentnahme des Tages
  const SO = D.KASSE_SONDER;
  for (const [i, k] of D.KASSE_TAGE.entries()) {
    const bewegungen = D.KASSEN_BEWEGUNGEN_ROH.filter((b) => b.datum === k.datum).map((b) => ({ art: b.art, betrag_cent: b.betrag }));
    // R12 GoBD: Sonderfälle im November
    const karte = k.b7 + k.b19 - k.bar;
    const r15 = k.datum === SO.barRechnung.datum ? s.unterlagen.find((u) => u.id === SO.barRechnung.rechnung)! : null;
    const inhalt: KassenInhalt = {
      datum: k.datum, zbon: String(k.zbon), umsatz: [{ satz: 19, brutto_cent: k.b19 }, { satz: 7, brutto_cent: k.b7 }], karte_cent: karte, sonstige_cent: 0, bewegungen, ...(i === 0 ? { anfang_cent: D.KASSE_ANFANG_JAHR } : {}),
      ...(k.datum === SO.trinkgeld.datum ? { karte_cent: karte + SO.trinkgeld.cent, trinkgeld_cent: SO.trinkgeld.cent } : {}),
      ...(k.datum === SO.gutscheinVerkauf.datum ? { gutscheine: [{ vorgang: "verkauf" as const, art: "mehrzweck" as const, betrag_cent: SO.gutscheinVerkauf.mehrzweck }, { vorgang: "verkauf" as const, art: "einzweck" as const, satz: 7, betrag_cent: SO.gutscheinVerkauf.einzweck7 }] } : {}),
      ...(k.datum === SO.gutscheinEinloesung.datum ? { gutscheine: [{ vorgang: "einloesung" as const, art: "mehrzweck" as const, betrag_cent: SO.gutscheinEinloesung.mehrzweck }, { vorgang: "einloesung" as const, art: "einzweck" as const, satz: 7, betrag_cent: SO.gutscheinEinloesung.einzweck7 }] } : {}),
      ...(r15 ? { rechnungen_bar: [{ id: r15.id, nummer: String(r15.daten.nummer), betrag_cent: offenerBetrag(s, r15) }] } : {}),
      ...(k.datum === SO.zaehlung.datum ? { gezaehlt_cent: D.KASSE_GEZAEHLT() } : {}),
    };
    if (k.datum === SO.korrektur.datum) {
      // zuerst mit 10 € zu wenig Karte gespeichert, am nächsten Morgen mit Grund korrigiert
      [s] = kasseSpeichern(s, { ...inhalt, karte_cent: karte - SO.korrektur.karteZuWenig }, t(k.datum, 22), `z${k.zbon}`);
      s = kasseKorrigieren(s, `z${k.zbon}`, inhalt, SO.korrektur.grund, new Date(t(k.datum, 8).getTime() + 864e5));
    } else [s] = kasseSpeichern(s, inhalt, t(k.datum, 22), `z${k.zbon}`);
    // wie „Tagesabschluss speichern“ in der App: bar kassierte Rechnung an der Rechnung vermerken
    if (r15) s = zahlungVermerken(s, r15.id, { datum: k.datum, betrag_cent: inhalt.rechnungen_bar![0]!.betrag_cent }, t(k.datum, 22));
    // Kassensturz am Morgen des Zähltags (Zählprotokoll für die Kassennachschau)
    if (k.datum === SO.kassensturz.datum) [s] = kassensturzSpeichern(s, { gezaehlt_cent: 41230, stueckelung: { "5000": 4, "2000": 6, "1000": 7, "500": 5, "200": 8, "100": 12, "50": 10, "20": 15, "10": 6, "5": 4, "2": 5, "1": 2 }, anwesend: "Jana Weber" }, t(k.datum, 9), "sturz1");
  }
  {
    // R12 GoBD: Sonderfälle prüfen
    const v = kassenVerlauf(s.kasse, s.belege);
    const kor = s.kasse.find((x) => x.datum === SO.korrektur.datum)!;
    vergleichText("Kasse (R12 GoBD)", "Korrektur mit Grund in der Historie", kor.historie?.[0]?.grund ?? "–", SO.korrektur.grund);
    vergleichText("Kasse (R12 GoBD)", "Kassendifferenz am Zähltag (Überschuss)", String(v.differenzen.find((d) => d.datum === SO.zaehlung.datum)?.cent ?? 0), String(SO.zaehlung.ueberschuss));
    vergleichText("Kasse (R12 GoBD)", "Rechnung 2026-015 nach der Barzahlung bezahlt", s.unterlagen.find((u) => u.id === SO.barRechnung.rechnung)!.bezahlt ?? "offen", SO.barRechnung.datum);
    const kb = kassenbuchDaten(s.kasse, s.belege, "2026-11")!;
    vergleichText("Kasse (R12 GoBD)", "Kassenbuch November: Trinkgeld, bar kassierte Rechnung, Korrektur, Überschuss", [kb.eintraege.some((e) => e.text!.startsWith("Kartentrinkgeld")), kb.eintraege.some((e) => e.beleg === "RE 2026-015"), kb.eintraege.some((e) => e.text!.includes("korrigiert am")), kb.eintraege.some((e) => e.text!.includes("Überschuss"))].every(Boolean) ? "ja" : "nein", "ja");
    const b = [...kassenBuchungenR12(s.kasse.filter((x) => x.datum.startsWith("2026-11")), "SKR03"), ...kassenDifferenzBuchungen(v.differenzen, "SKR03")];
    const hat = (konto: string, gegen: string, betrag?: number) => b.some((x) => x.konto === konto && x.gegenkonto === gegen && (betrag === undefined || x.betrag_cent === betrag));
    vergleichText("Kasse (R12 GoBD)", "Stapel: Trinkgeld 1360 an 1000, Mehrzweck-Gutschein an 1700 (Verkauf) und 1700 an Erlöse (Einlösung), Überschuss 1000 an 8400, Barzahlung 1000 an 1410", [hat("1360", "1000", SO.trinkgeld.cent), b.filter((x) => x.gegenkonto === "1700").reduce((a, x) => a + x.betrag_cent, 0) === SO.gutscheinVerkauf.mehrzweck, b.filter((x) => x.konto === "1700").reduce((a, x) => a + x.betrag_cent, 0) === SO.gutscheinEinloesung.mehrzweck, hat("1000", "8400", SO.zaehlung.ueberschuss), hat("1000", "1410")].every(Boolean) ? "ja" : "nein", "ja");
    vergleichText("Kasse (R12 GoBD)", "Stapel: Kartenzahlungen direkt Geldtransit an Erlöse (keine Buchung Geldtransit an Kasse außer Bank und Trinkgeld)", b.some((x) => x.konto === "1360" && x.gegenkonto === "1000" && x.buchungstext.startsWith("Kartenzahlungen")) ? "nein" : "ja", "ja");
    const sk = skontoBuchungenBelege(s.belege.filter((x) => x.skonto_cent), "SKR03");
    vergleichText("Beleg b33 (R12 GoBD)", "erhaltenes Skonto auf Wartung gegen das Aufwandskonto 4900 mit BU 9", sk.map((x) => `${x.konto}→${x.gegenkonto} BU ${x.bu_schluessel} ${x.betrag_cent}`).join(", "), "1610→4900 BU 9 1142");
    vergleichText("Kasse (R12 GoBD)", "Kassensturz mit Zählprotokoll gespeichert", String(s.kassenstuerze.length), "1");
  }
  {
    const v = kassenVerlauf(s.kasse, s.belege);
    vergleichText("Kasse (Tagesabschlüsse)", "Anzahl Tagesabschlüsse 2026 (Di–So geöffnet)", String(s.kasse.length), String(D.KASSE_TAGE.length));
    vergleichText("Kasse (Tagesabschlüsse)", "Tage ohne Abschluss 2026 (Ruhetag Montag)", fehlendeTage(s.kasse, "2026-01-01", "2026-12-31", [1]).join(", ") || "keine", "keine");
    vergleichText("Kasse (Tagesabschlüsse)", "Tage mit negativem Bargeldbestand", v.negativ.join(", ") || "keine", "keine");
    const mai = v.tage.filter((x) => x.datum.startsWith("2026-05"));
    vergleich("Kasse (Tagesabschlüsse)", "Bargeld am 31.05. (App, mit Barbelegen b17–b19)", mai[mai.length - 1]!.ende, D.kassenbuchEnde());
    vergleich("Kasse (Tagesabschlüsse)", "Bargeld am Jahresende", v.tage[v.tage.length - 1]!.ende, D.kasseJahresende());
    const kb = kassenbuchDaten(s.kasse, s.belege, "2026-05")!;
    vergleich("Kasse (Tagesabschlüsse)", "Kassenbuch Mai aus der App: Anfangsbestand", cent(kb.anfang) ?? 0, D.KASSENBUCH_ANFANG);
    vergleich("Kasse (Tagesabschlüsse)", "Kassenbuch Mai aus der App: Endbestand (Vorlage „Kassenbuch“)", ausEuro(vorlageFuer("kassenbuch")!.ergebnis!(kb as unknown as Daten)[0]![1]), D.kassenbuchEnde());
  }

  // ---------------------------------------------------------------- Unterlagen zum Betrieb (Vorlagen)
  const B = D.BETRIEB;
  const m1 = s.mitarbeiter.find((m) => m.id === "m1")!;
  const m2 = s.mitarbeiter.find((m) => m.id === "m2")!;

  dok({ id: "gewerbe", vorlage: "gewerbeanmeldung", datum: "2022-02-14", worum: "Gewerbeanmeldung, wie sie zur Gründung (Beginn 01.03.2022) ausgesehen hätte: Inhaberin Jana Weber, Café mit Catering, Hauptbetrieb, 1 Beschäftigte.",
    daten: () => ({ name: D.INHABERIN.name, geburtsname: D.INHABERIN.geburtsname, geburtsdatum: D.INHABERIN.geburtsdatum, geburtsort: D.INHABERIN.geburtsort, staatsangehoerigkeit: "deutsch", wohnanschrift: D.INHABERIN.wohnanschrift, rechtsform: "Einzelunternehmen",
      taetigkeit: "Betrieb eines Cafés: Abgabe von Speisen und Getränken (auch alkoholischer Getränke) zum Verzehr an Ort und Stelle und zum Mitnehmen; Catering für Veranstaltungen; Verkauf von Röstkaffee und Backwaren",
      beginn: D.GRUENDUNG, erwerb: "haupt", beschaeftigte: "1 (Vollzeit)", erlaubnis: "Gaststättenrecht Sachsen: Anzeige des Gaststättenbetriebs zusammen mit der Gewerbeanmeldung (SächsGastG) – keine Handwerkskarte nötig" }) });

  dok({ id: "kasse", vorlage: "kassenmeldung", datum: "2025-06-12", worum: "Kassenmeldung (Mitteilung nach § 146a Abs. 4 AO, Frist für Bestandskassen 31.07.2025): 1 Tablet-Kasse KassaVista mit Cloud-TSE.",
    daten: (h) => ({ stand: "2025-06-12", kassen: eintraege("kassenmeldung", "kassen", [{ art: "Tablet-/App-Kassensysteme", hersteller: "KassaVista GmbH", modell: "KassaVista POS auf iPad (10. Generation)", seriennummer: "KV-2022-018734", software: "KassaVista POS 6.4", anschaffung: "2022-02-20", tse_art: "Cloud-TSE", tse_seriennummer: "9f3c27a1d84e5b06c2f1e7a9b3d04c18e6f2a5b7c9d1e3f5a7b9c2d4e6f8a0b1", tse_zertifikat: "BSI-K-TR-0490-2022" }], h) }) });

  dok({ id: "impressum", vorlage: "impressum", datum: "2026-01-12", worum: "Impressum der Website: Einzelunternehmen, Inhaberin, Wirtschafts-ID, Verantwortliche für Inhalte, keine Teilnahme an Verbraucherschlichtung.",
    daten: () => ({ rechtsform: "Einzelunternehmen", vertreten: "Jana Weber", wirtschafts_id: "DE318452976-00001", redaktion: `Jana Weber, ${B.strasse}, ${B.plz} ${B.ort}`, vsbg: "nicht_bereit" }) });

  dok({ id: "dse", vorlage: "datenschutzerklaerung_website", datum: "2026-01-12", worum: "Datenschutzerklärung der Website: Hosting bei Hostwerk Leipzig, Server-Logfiles 14 Tage, Kontakt per E-Mail/Telefon, Schriften lokal eingebunden, Link zu Instagram, keine Cookies/kein Tracking.",
    daten: () => ({ website: "https://www.cafe-morgenrot.example", module: ["hosting", "server_logfiles", "kontakt", "google_fonts_lokal", "social_media_links"], hoster_name: "Hostwerk Leipzig GmbH", hoster_anschrift: "Spinnereistraße 7, 04179 Leipzig", logfile_tage: "14", netzwerke: "Instagram", stand: "2026-01-12" }) });

  dok({ id: "avv", vorlage: "avv", datum: "2024-05-10", worum: "Auftragsverarbeitungsvertrag mit dem Website-Host Hostwerk Leipzig GmbH (Hosting, E-Mail-Postfächer).",
    daten: () => ({ rolle: "auftraggeber", partner: "Hostwerk Leipzig GmbH", partner_anschrift: "Spinnereistraße 7\n04179 Leipzig", hauptvertrag: "Webhosting-Vertrag „Business S“ vom 10.05.2024 (Kundennummer HW-20418)",
      gegenstand: "Hosting der Website\nBereitstellung von E-Mail-Postfächern", zweck: "Bereitstellung der Website www.cafe-morgenrot.example und der geschäftlichen E-Mail-Kommunikation", dauer: "für die Laufzeit des Hauptvertrags",
      datenarten: "Name\nKontaktdaten (Telefon, E-Mail)\nInhalte von E-Mails und Kontaktanfragen\nIP-Adressen und Server-Logfiles", betroffene: "Kundinnen und Kunden\nInteressenten\nBesucherinnen und Besucher der Website\nBeschäftigte",
      unterauftrag: "Rechenzentrum: DataHall Frankfurt GmbH, Frankfurt am Main (Serverstandort Deutschland)", tom: "siehe Anlage (TOM-Beschreibung des Auftragsverarbeiters)", ort_datum: "Leipzig" }) });

  dok({ id: "dsinfo", vorlage: "datenschutzinformation", datum: "2026-01-12", worum: "Datenschutzinformation nach Art. 13 DSGVO für Kundinnen und Kunden (Catering-Anfragen, Rechnungen, Kasse/Kartenzahlung).",
    daten: () => ({ fuer_wen: "Kundinnen und Kunden", verarbeitungen: ["Kundenverwaltung / Kundenkartei", "Rechnungsstellung und Buchhaltung", "Kontaktanfragen (Kontaktformular, E-Mail, Telefon)", "Kassensystem und Zahlungsabwicklung (inkl. EC-/Kartenzahlung)"], interessen: "Sicherer und störungsfreier Betrieb unserer IT\nDurchsetzung und Abwehr von Ansprüchen", bereitstellung: "vertrag", stand: "2026-01-12" }) });

  dok({ id: "vvt", vorlage: "datenschutz_dokumentation", datum: "2026-01-14", worum: "Verzeichnis der Verarbeitungstätigkeiten: 9 Tätigkeiten aus den Vorschlägen (Catering-Kunden, Rechnungen, Lohn, Personal, Website, Kontakt, E-Mail, Lieferanten, Kasse) und 18 TOM; Dienstleister Hostwerk, KassaVista, Lohnbüro (je mit AVV), Steuerkanzlei (eigenverantwortlich).",
    daten: (h) => ({
      verantwortlich: "Jana Weber",
      verarbeitungen: [
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kundenverwaltung", h, { bezeichnung: "Kundenverwaltung (Catering- und Bestellkunden)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Rechnungsstellung", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lohn- und Gehalts", h, { empfaenger: "Lohnbüro Lorenz (Auftragsverarbeiter), Krankenkassen, Minijob-Zentrale, Finanzamt, Steuerkanzlei Albrecht & Partner" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Personalverwaltung", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Betrieb der Website", h, { empfaenger: "Hostwerk Leipzig GmbH (Auftragsverarbeiter)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kontaktanfragen", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Geschäftliche E-Mail", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lieferanten", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kassensystem", h, { empfaenger: "KassaVista GmbH (Auftragsverarbeiter, Cloud-TSE), Zahlungsdienstleister für Kartenzahlung, Steuerkanzlei, Finanzamt (Kassen-Nachschau)" }),
      ],
      tom: [
        "Website ausschließlich über HTTPS", "WLAN mit aktueller Verschlüsselung", "Geräteverschlüsselung und Bildschirmsperre", "Persönliche Benutzerkonten", "Starke, individuelle Passwörter", "Zwei-Faktor-Authentisierung",
        "Abschließbare Räume/Schränke", "Verpflichtung aller Beschäftigten", "Akten- und Datenträgervernichtung", "Auftragsverarbeitungsverträge", "Automatische Sicherheitsupdates", "Firewall des Routers",
        "Protokollierung von Änderungen in Kassen", "Regelmäßige Datensicherung", "Mindestens eine Sicherungskopie", "Regelmäßiger Test der Wiederherstellung", "Jährliche Überprüfung des Verzeichnisses", "Regelmäßige Sensibilisierung",
      ].map((x) => vorschlag("datenschutz_dokumentation", "tom", x, h, { umgesetzt_am: "2025-03-01", verantwortlich: "Jana Weber" })),
      dienstleister: eintraege("datenschutz_dokumentation", "dienstleister", [
        { name: "Hostwerk Leipzig GmbH", leistung: "Website-Hosting", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2024-05-10", drittland: "keine Übermittlung in Drittländer" },
        { name: "KassaVista GmbH", leistung: "Kassensystem", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2022-02-20", drittland: "keine Übermittlung in Drittländer" },
        { name: "Lohnbüro Lorenz, Petra Lorenz", leistung: "Lohnabrechnung (Lohnbüro)", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2022-02-28", drittland: "keine Übermittlung in Drittländer" },
        { name: "Steuerkanzlei Albrecht & Partner mbB", leistung: "Steuerberatung (eigenverantwortlich, keine Auftragsverarbeitung)", auftragsverarbeitung: false, drittland: "keine Übermittlung in Drittländer" },
      ], h),
    }) });

  dok({ id: "verfahren", vorlage: "verfahrensdokumentation", datum: "2026-01-15", worum: `Verfahrensdokumentation (GoBD): ${MARKE.name} für Rechnungen/Belege, KassaVista mit Cloud-TSE, Online-Banking, Kanzleiportal; Belege teils Papier (fotografiert), teils digital und E-Rechnung; tägliche Kassenzählung.`,
    daten: () => ({ version: "1.2", verantwortlich: "Jana Weber",
      organisation: "Café mit 34 Sitzplätzen und Catering für Firmen- und Privatkunden. Inhaberin Jana Weber (Buchhaltung, Einkauf, Service), eine Köchin in Vollzeit, eine Servicekraft im Minijob. Öffnungszeiten Di–So 8–18 Uhr.",
      steuerberatung: "Jahresabschluss durch die Steuerberatung; laufende Buchführung im Betrieb",
      systeme: eintraege("verfahrensdokumentation", "systeme", [
        { name: `${MARKE.name} (App, iPhone)`, zweck: "Rechnungsprogramm", version: "seit 01/2026" },
        { name: "KassaVista POS mit Cloud-TSE (Tablet-Kasse)", zweck: "Kassensystem", version: "6.4, seit 03/2022" },
        { name: "Sparkasse Leipzig Online-Banking", zweck: "Online-Banking", version: "seit 03/2022" },
        { name: "Kanzleiportal Albrecht & Partner", zweck: "Upload-Portal der Steuerberatung", version: "seit 01/2023" },
        { name: "Lohnbüro Lorenz (extern)", zweck: "Lohnprogramm", version: "seit 03/2022" },
      ], "2026-01-15"),
      belegeingang: ["Papier (Post/persönlich)", "E-Mail mit PDF-Anhang", "E-Rechnung (XRechnung/ZUGFeRD) per E-Mail oder Portal", "Kassensystem/Kassenbericht", "Kontoauszug/Bank-Schnittstelle", "Eigenbeleg"],
      belegart: ["originär Papier, Ablage in Papier (Muster 4.1)", "originär digital (Muster 4.3)"],
      ablage: ["Papierordner (chronologisch/nach Belegart)", "Upload an Steuerberater (z. B. Kanzlei-Portal)"],
      erfassung: `Belege werden wöchentlich in ${MARKE.name} erfasst (Foto bzw. Datei) und quartalsweise als Paket an die Steuerberatung übermittelt.\nEingangsrechnungen werden vor der Zahlung sachlich und rechnerisch geprüft.\nAusgangsrechnungen werden fortlaufend nummeriert in ${MARKE.name} erstellt und beim Teilen festgeschrieben; Korrekturen nur per Stornorechnung.`,
      scannen: false, sicherung_intervall: "wöchentlich", sicherung_ort: ["Cloud-Backup", "durch Softwareanbieter/Rechenzentrum"], e_rechnung: true,
      zugriff: "Zugriff auf Buchhaltung und Belege nur für Inhaber/in und Steuerberatung\nKasse: eigene Bedienerkennung je Person",
      kontrollen: "Tägliches Zählen der Kasse und Abgleich mit dem Kassenbericht\nMonatlicher Abgleich von Kontoauszügen und Buchungen",
      aenderungen: eintraege("verfahrensdokumentation", "aenderungen", [{ datum: "2026-01-15", aenderung: `Umstellung der Rechnungsstellung und Belegerfassung auf ${MARKE.name}; E-Rechnungsempfang eingerichtet.` }], "2026-01-15") }) });

  dok({ id: "aufbewahrung", vorlage: "aufbewahrung", datum: "2026-01-15", worum: "Aufbewahrungsplan mit den Startzeilen der App (Fristbeginn 2026, Ablageort) und zwei ergänzten Zeilen (Kassendaten, Lohnkonten).",
    daten: (h) => {
      const start = (leereDatenVon("aufbewahrung", h).eintraege as Eintrag[]).map((e) => ({ ...e, letzte: "2026", ort: `${MARKE.name} (verschlüsselt) und Kanzleiportal; Papier im Büroschrank` }));
      return { eintraege: [...start, ...eintraege("aufbewahrung", "eintraege", [
        { art: "Kassendaten: TSE-Export und DSFinV-K-Export, Z-Bons, Kassenberichte", jahre: "8", letzte: "2026", ort: "KassaVista-Cloud und externe Festplatte" },
        { art: "Lohnkonten (§ 41 Abs. 1 EStG)", jahre: "6", letzte: "2026", ort: "Lohnbüro Lorenz und Personalordner" },
      ], h)] };
    } });

  // Personal
  dok({ id: "nachweis1", vorlage: "nachweis_arbeitsbedingungen", datum: "2026-06-20", worum: "Nachweis der Arbeitsbedingungen Köchin Sabine Krüger (aktualisiert wegen Gehaltserhöhung ab 01.07.2026: 3.050 € brutto, 40 Std./5 Tage, 28 Urlaubstage).",
    daten: () => ({ ...personIn(v("nachweis_arbeitsbedingungen"), m1), beginn: "2022-03-01", befristet: false, arbeitsort: "betrieb", taetigkeit: "Koch/Köchin", probezeit: "6", entgelt_art: "monat", entgelt_betrag: "3.050,00",
      zuschlaege: "Ab 01.07.2026. Überstunden werden durch Freizeit ausgeglichen.", faelligkeit: "am letzten Bankarbeitstag des laufenden Monats", auszahlung: "Überweisung auf das von der beschäftigten Person benannte Konto",
      wochenstunden: "40", tage_pro_woche: "5", verteilung: "Dienstag bis Samstag", pausen: "nach § 4 ArbZG: mindestens 30 Minuten bei mehr als sechs Stunden, 45 Minuten bei mehr als neun Stunden", ruhezeit: "nach § 5 ArbZG: mindestens elf Stunden ununterbrochen nach Ende der täglichen Arbeitszeit",
      ueberstunden: "ja", ueberstunden_text: "bei Catering-Veranstaltungen nach Absprache, höchstens 5 Stunden je Woche", urlaub: "28", fortbildung: "Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht.", kuendigung_art: "gesetz", kollektiv: "keine", ausgestellt_am: "2026-06-20" }) });

  dok({ id: "nachweis2", vorlage: "nachweis_arbeitsbedingungen", datum: "2025-08-25", worum: "Nachweis der Arbeitsbedingungen Minijobber Leon Schubert (Service, 14,50 €/Std., rund 9,5 Std./Woche an 2 Tagen, Wochenende nach Dienstplan, 10 Urlaubstage).",
    daten: () => ({ ...personIn(v("nachweis_arbeitsbedingungen"), m2), beginn: "2025-09-01", befristet: false, arbeitsort: "betrieb", taetigkeit: "Servicekraft", probezeit: "3", entgelt_art: "stunde", entgelt_betrag: "14,50",
      zuschlaege: "Keine weiteren Bestandteile. Monatliches Entgelt höchstens bis zur Minijob-Grenze (2026: 603 €).", faelligkeit: "am letzten Bankarbeitstag des laufenden Monats", auszahlung: "Überweisung auf das von der beschäftigten Person benannte Konto",
      wochenstunden: "9,5", tage_pro_woche: "2", verteilung: "nach Dienstplan, überwiegend Samstag und Sonntag", pausen: "nach § 4 ArbZG: mindestens 30 Minuten bei mehr als sechs Stunden, 45 Minuten bei mehr als neun Stunden", ruhezeit: "nach § 5 ArbZG: mindestens elf Stunden ununterbrochen nach Ende der täglichen Arbeitszeit",
      ueberstunden: "nein", urlaub: "10", fortbildung: "Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht.", kuendigung_art: "gesetz", kollektiv: "keine", ausgestellt_am: "2025-08-25" }) });

  dok({ id: "fragebogen1", vorlage: "sv_meldedaten", datum: "2022-02-25", worum: "Personalfragebogen Köchin (Vollzeit, Personengruppe 101, unbefristet Vollzeit, Mittlere Reife, Berufsausbildung).",
    daten: () => ({ ...personIn(v("sv_meldedaten"), m1), art: "vollzeit", personengruppe: "101", vertragsform: "1", stunden: "40", entgelt: "2.950,00", taetigkeit: "Köchin", schulabschluss: "3", ausbildung: "2", weitere: false }) });
  dok({ id: "fragebogen2", vorlage: "sv_meldedaten", datum: "2025-08-25", worum: "Personalfragebogen Minijobber (Personengruppe 109, unbefristet Teilzeit, Abitur, Student ohne Berufsabschluss, keine weitere Beschäftigung).",
    daten: () => ({ ...personIn(v("sv_meldedaten"), m2), art: "minijob", personengruppe: "109", vertragsform: "2", stunden: "9,5", entgelt: "580,00", taetigkeit: "Servicekraft", schulabschluss: "4", ausbildung: "1", weitere: false }) });

  const lohnZeilen = (l: D.LohnMonat[], h: string) =>
    eintraege("lohnkonto", "monate", l.map((m) => ({ monat: m.monat, zahltag: m.zahltag, brutto: euro(m.brutto), lohnsteuer: m.lohnsteuer ? euro(m.lohnsteuer) : "", soli: m.lohnsteuer ? "0,00" : "", kirchensteuer: "", sv_an: euro(m.sv_an), sv_ag: euro(m.sv_ag), auszahlung: euro(m.brutto - m.lohnsteuer - m.sv_an) })), h);
  dok({ id: "lohnkonto1", vorlage: "lohnkonto", datum: "2026-12-31", worum: "Lohnkonto 2026 Köchin: 2.950 € (Jan–Jun), 3.050 € (Jul–Dez), Steuerklasse I, keine Kirchensteuer; LSt laut Lohnbüro, SV AN 22,25 %, AG 22,84 %.",
    daten: (h) => ({ ...personIn(v("lohnkonto"), m1), jahr: "2026", kinder: "0", religion: "keine Kirchensteuerpflicht", monate: lohnZeilen(D.LOHN_M1, h) }) });
  dok({ id: "lohnkonto2", vorlage: "lohnkonto", datum: "2026-12-31", worum: "Lohnkonto 2026 Minijobber: Stunden × 14,50 €, RV-befreit, Pauschalabgaben 31,47 % in „SV AG“ (inkl. 2 % Pauschsteuer).",
    daten: (h) => ({ ...personIn(v("lohnkonto"), m2), jahr: "2026", kinder: "0", religion: "keine Kirchensteuerpflicht", monate: lohnZeilen(D.LOHN_M2, h) }) });

  const azn: Eintrag[] = [
    ["2026-05-02", "10:00", "14:30", "0", ""], ["2026-05-03", "09:30", "14:00", "0", ""], ["2026-05-09", "10:00", "14:30", "0", ""], ["2026-05-10", "10:00", "15:00", "30", ""],
    ["2026-05-16", "10:00", "14:30", "0", ""], ["2026-05-17", "09:30", "14:00", "0", ""], ["2026-05-23", "", "", "", "Urlaub (4,5 Std. vergütet)"], ["2026-05-30", "10:00", "14:30", "0", ""], ["2026-05-31", "10:00", "15:00", "30", ""],
  ].map(([datum, beginn, ende, pause, bemerkung]) => ({ datum: datum!, beginn: beginn!, ende: ende!, pause: pause!, bemerkung: bemerkung! }));
  dok({ id: "azn", vorlage: "arbeitszeitnachweis", datum: "2026-06-01", worum: "Arbeitszeitnachweis Mai 2026 für den Minijobber (§ 17 MiLoG): 8 Einsätze à 4,5 Std. (zweimal 10–15 Uhr mit 30 Min. Pause), Urlaub am 23.05. (4,5 Std. vergütet) → 36 Std. gearbeitet, 40,5 Std. vergütet = 587,25 €.",
    daten: (h) => ({ name: m2.name, monat: "Mai 2026", leerzeilen: false, tage: eintraege("arbeitszeitnachweis", "tage", azn, h) }) });

  dok({ id: "ki", vorlage: "ki_kompetenz", datum: "2026-02-10", worum: "KI-Kompetenz-Schulung (Art. 4 KI-VO): Textassistent für Instagram-Texte und Übersetzung der Speisekarte; Teilnehmende Jana Weber, Leon Schubert.",
    daten: (h) => ({ thema: "Sicherer Umgang mit KI-Assistenten im Betrieb", ki_systeme: "Textassistent (Chatbot)\nÜbersetzungsprogramm", dauer: "60 Minuten", durchgefuehrt_von: "Jana Weber",
      themen: ["Funktionsweise und Grenzen der eingesetzten KI-Werkzeuge", "Keine personenbezogenen oder vertraulichen Daten in KI-Werkzeuge eingeben, soweit nicht ausdrücklich freigegeben", "Ergebnisse von KI-Werkzeugen vor der Verwendung prüfen", "Umgang mit KI-erzeugten Texten und Bildern gegenüber Kundinnen und Kunden"],
      inhalt: "Allergenangaben und Preise werden nie aus KI-Texten übernommen, sondern immer aus der Allergenliste bzw. der Kasse.", teilnehmer: eintraege("ki_kompetenz", "teilnehmer", [{ name: "Jana Weber" }, { name: "Leon Schubert" }], h) }) });

  // Arbeitsschutz
  const gb = (bereich: string, titel: string[], extra: Eintrag[], h: string) => [
    ...titel.map((x) => vorschlag("gefaehrdungsbeurteilung", "gefaehrdungen", x, h, { verantwortlich: "Jana Weber", umsetzen_bis: "2026-03-31", umgesetzt_am: "2026-02-20" })),
    ...eintraege("gefaehrdungsbeurteilung", "gefaehrdungen", extra.map((e) => ({ verantwortlich: "Jana Weber", umsetzen_bis: "2026-03-31", umgesetzt_am: "2026-02-20", ...e })), h),
  ];
  dok({ id: "gb-kueche", vorlage: "gefaehrdungsbeurteilung", datum: "2026-02-05", worum: "Gefährdungsbeurteilung Küche: 9 Gastro-Vorschläge der App (Rutschen, Lüftung, Schnitt, Glasbruch, Verbrennung, Feuchtarbeit, Reinigungsmittel, Heben, Lagergut, Gerätemängel) plus eigene Zeile Siebträger/Dampflanze; Mutterschutz: Umgestaltung.",
    daten: (h) => ({ arbeitsbereich: "Küche", taetigkeiten: "Zubereitung von Frühstück, Mittagstisch, Kuchen und Catering; Spülen (Haubenspülmaschine); Wareneingang und Lagerung", beschaeftigte: "2", beurteilt_von: "Jana Weber", mitwirkung: "Beschäftigte des Bereichs\nFachkraft für Arbeitssicherheit", datum: "2026-02-05",
      gefaehrdungen: gb("kueche", ["Ausrutschen und Stürzen", "Hohe Temperatur und Feuchte", "Schnittverletzungen an Messern", "Schnittverletzungen durch Glasbruch", "Verbrennungen und Verbrühungen", "Hautbelastung durch Wasser", "Verätzungen und Reizungen", "Muskel-Skelett-Belastung", "Unerkannte Mängel"],
        [{ beschreibung: "Verbrühung an Dampflanze und Brühgruppe der Siebträgermaschine sowie beim Entleeren der Haubenspülmaschine.", massnahme: "Dampflanze nur mit Kännchen öffnen, Haube erst nach Ende des Programms öffnen; Unterweisung neuer Beschäftigter am Gerät.", risiko: "mittel", faktor: "arbeitsmittel" }], h),
      mutterschutz_ergebnis: "umgestaltung", mutterschutz_details: "Kein Heben über 5 kg regelmäßig bzw. 10 kg gelegentlich, keine Arbeiten an Spülmaschine und Herd mit Verbrühungsgefahr, kein Umgang mit ätzenden Reinigern (Ofenreiniger), Sitzgelegenheit und zusätzliche Pausen.",
      wirksamkeit: "wirksam", wirksamkeit_am: "2026-09-15", bemerkung: "Begehung mit der Fachkraft für Arbeitssicherheit am 15.09.2026, keine neuen Gefährdungen.", fortschreibung: "bei Änderungen von Tätigkeiten, Arbeitsmitteln oder Arbeitsstoffen, nach Unfällen sowie jährlich" }) });
  dok({ id: "gb-service", vorlage: "gefaehrdungsbeurteilung", datum: "2026-02-05", worum: "Gefährdungsbeurteilung Gastraum und Service: Rutschen, Glasbruch, heiße Getränke, Tragen, Gästekontakt (Vorschläge) plus eigene Zeilen Kellertreppe zum Lager, Bargeld/Überfall, Außengastronomie; Mutterschutz: keine Maßnahmen nötig über die allgemeinen hinaus.",
    daten: (h) => ({ arbeitsbereich: "Gastraum und Service", taetigkeiten: "Bedienung im Gastraum und auf der Terrasse, Kasse, Zubereitung von Kaffeegetränken an der Theke, Abräumen", beschaeftigte: "2", beurteilt_von: "Jana Weber", datum: "2026-02-05",
      gefaehrdungen: gb("service", ["Ausrutschen und Stürzen", "Schnittverletzungen durch Glasbruch", "Verbrennungen und Verbrühungen", "Muskel-Skelett-Belastung", "Psychische Belastung"],
        [
          { beschreibung: "Sturz auf der steilen Kellertreppe zum Getränkelager beim Tragen von Kisten.", massnahme: "Handlauf beidseitig, Stufenkanten markiert, Beleuchtung mit Bewegungsmelder; Kisten nur einzeln tragen, Sackkarre oben.", risiko: "hoch", faktor: "arbeitsstaette" },
          { beschreibung: "Überfall oder Bedrohung beim Kassenabschluss und beim Geldtransport zur Bank.", massnahme: "Bargeldbestand klein halten (Abschöpfen in den Tresor), Geldtransport unregelmäßig und nicht allein, Unterweisung „Verhalten bei Überfällen“.", risiko: "mittel", faktor: "psychisch" },
          { beschreibung: "Sonne, Hitze und Kälte beim Bedienen auf der Terrasse.", massnahme: "Sonnenschirme, Trinkwasser, Arbeitskleidung nach Witterung, Arbeitswechsel innen/außen.", risiko: "gering", faktor: "einwirkungen" },
        ], h),
      mutterschutz_ergebnis: "keine_massnahmen", mutterschutz_details: "Allgemeine Maßnahmen genügen: kein Tragen schwerer Kisten über die Kellertreppe, Sitzgelegenheit.", wirksamkeit: "wirksam", wirksamkeit_am: "2026-09-15", fortschreibung: "bei Änderungen von Tätigkeiten, Arbeitsmitteln oder Arbeitsstoffen, nach Unfällen sowie jährlich" }) });

  dok({ id: "unterweisung", vorlage: "unterweisung", datum: "2026-02-10", worum: "Jährliche Unterweisung Arbeitsschutz (45 Min.) für beide Beschäftigten: Gefährdungen, Erste Hilfe, Brandschutz, Rutschen, Elektrogeräte, Gefahrstoffe, Hautschutz, Heben, Konflikte, Bargeld/Überfall.",
    daten: (h) => ({ thema: "Jährliche Unterweisung Arbeitsschutz", anlass: "wiederholung", dauer: "45 Minuten", durchgefuehrt_von: "Jana Weber",
      themen: ["gefaehrdungen_am_eigenen_arbeitsplatz_un", "erste_hilfe_ersthelfer_standort_verbandk", "brandschutz_verhalten_im_brandfall_umgan", "stolper_rutsch_und_sturzgefahren_ordnung", "elektrische_geraete_sichtpruefung_vor_be", "gefahrstoffe_inhalt_der_betriebsanweisun", "hautschutz_hautschutzplan_richtige_schut", "heben_und_tragen_hilfsmittel_rueckengere", "psychische_belastungen_verhalten_bei_kon", "umgang_mit_zahlungsmitteln_und_verhalten"],
      inhalt: "Ersthelferin: Jana Weber (Kurs 11/2025). Verbandkasten und Brandschutzdecke in der Küche neben der Tür, Feuerlöscher an Theke und Küchenausgang. Neue Haubenspülmaschine: Haube erst nach Programmende öffnen.",
      teilnehmer: eintraege("unterweisung", "teilnehmer", [{ name: "Sabine Krüger" }, { name: "Leon Schubert" }], h) }) });

  const STOFFE: Eintrag[] = [
    { bezeichnung: "ProClean Backofen- und Grillreiniger", hersteller: "Hygienewerk Sachsen GmbH", gefahren: "Gefahr; H290, H314 (Natriumhydroxid) – ätzend", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Küche", verwendung: "Reinigung Backofen und Kontaktgrill, wöchentlich", sdb: "liegt_vor", sdb_stand: "2025-04-01" },
    { bezeichnung: "ProClean Spülmaschinenreiniger flüssig", hersteller: "Hygienewerk Sachsen GmbH", gefahren: "Gefahr; H290, H314 – ätzend", menge: "10 bis 100 kg bzw. l", arbeitsbereich: "Küche (Spülbereich)", verwendung: "automatische Dosierung Haubenspülmaschine", sdb: "liegt_vor", sdb_stand: "2025-04-01" },
    { bezeichnung: "ProClean Klarspüler", hersteller: "Hygienewerk Sachsen GmbH", gefahren: "Achtung; H319", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Küche (Spülbereich)", verwendung: "automatische Dosierung Haubenspülmaschine", sdb: "liegt_vor", sdb_stand: "2025-04-01" },
    { bezeichnung: "Entkalker für Kaffeemaschinen (Amidosulfonsäure)", hersteller: "Baristatec GmbH", gefahren: "Achtung; H315, H319, H412", menge: "bis 1 kg bzw. 1 l", arbeitsbereich: "Theke", verwendung: "Entkalken Siebträgermaschine monatlich", sdb: "liegt_vor", sdb_stand: "2024-11-15" },
    { bezeichnung: "DesiQuick Flächendesinfektion alkoholisch", hersteller: "Hygienewerk Sachsen GmbH", gefahren: "Gefahr; H225, H319 – entzündbar", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Küche, Theke", verwendung: "Desinfektion Arbeitsflächen und Schneidebretter", sdb: "liegt_vor", sdb_stand: "2025-02-10" },
    { bezeichnung: "Händedesinfektion (Spender)", hersteller: "Hygienewerk Sachsen GmbH", gefahren: "Gefahr; H225, H319 – entzündbar", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Küche, Personal-WC", verwendung: "hygienische Händedesinfektion", sdb: "liegt_vor", sdb_stand: "2025-02-10" },
    { bezeichnung: "Sanitärreiniger sauer", hersteller: "Hygienewerk Sachsen GmbH", gefahren: "Achtung; H290, H315, H319", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Gäste- und Personal-WC", verwendung: "tägliche Reinigung", sdb: "fehlt" },
  ];
  dok({ id: "gefahrstoffe", vorlage: "gefahrstoffverzeichnis", datum: "2026-02-03", worum: "Gefahrstoffverzeichnis mit 7 Reinigungs-/Desinfektionsmitteln (H-Sätze, Mengen, Bereiche); beim Sanitärreiniger fehlt das Sicherheitsdatenblatt noch.",
    daten: (h) => ({ stand: "2026-02-03", verantwortlich: "Jana Weber", stoffe: eintraege("gefahrstoffverzeichnis", "stoffe", STOFFE, h) }) });

  dok({ id: "ba", vorlage: "betriebsanweisung", datum: "2026-02-03", worum: "Betriebsanweisung (TRGS 555) für den stark alkalischen Backofen- und Grillreiniger (H290, H314) in der Küche.",
    daten: () => ({ stoff: "ProClean Backofen- und Grillreiniger (enthält Natriumhydroxid)", arbeitsbereich: "Küche", nummer: "BA-03",
      gefahren: "Verursacht schwere Verätzungen der Haut und schwere Augenschäden (H314).\nKann gegenüber Metallen korrosiv sein (H290).\nSprühnebel reizt die Atemwege.",
      schutz: "Nur im abgekühlten Ofen anwenden, Küchenlüftung einschalten.\nChemikalienschutzhandschuhe (Nitril, lang) und Schutzbrille tragen.\nNicht sprühen, sondern mit Schwamm/Pinsel auftragen.\nNicht mit sauren Reinigern mischen.\nNur im Originalbehälter, verschlossen und getrennt von Lebensmitteln lagern.",
      gefahrfall: "Verschüttete Substanz sofort mit Schutzhandschuhen und Bindemittel aufnehmen.\nRaum lüften.",
      erste_hilfe: "Nach Augenkontakt: sofort mindestens 10 Minuten unter fließendem Wasser spülen, Augenarzt aufsuchen.\nNach Hautkontakt: verunreinigte Kleidung ausziehen, mit viel Wasser spülen.\nNach Verschlucken: Mund ausspülen, kein Erbrechen herbeiführen, sofort Arzt rufen.",
      entsorgung: "Restentleerte Gebinde mit dem Gelben Sack bzw. über den Lieferanten; Reste nicht in den Ausguss.\nEntsorgung mit der örtlichen Gewerbeabfallberatung klären.",
      notruf: "Notruf 112 – Ersthelferin Jana Weber, Giftnotruf Erfurt 0361 730730", erstellt_von: "Jana Weber", datum: "2026-02-03" }) });

  const geraete: Eintrag[] = [
    ["Siebträger-Espressomaschine", "Baristatec Duo 2-gruppig", "INV-01", "Theke", "bestanden", ""], ["Espressomühle", "Gastrotechnik EM-64", "INV-02", "Theke", "bestanden", ""], ["Kaffeemühle Filterkaffee", "Baristatec FM-2", "INV-03", "Theke", "bestanden", ""],
    ["Kühlschrank Getränke", "Coolline GK 400", "INV-04", "Theke", "bestanden", ""], ["Kuchenvitrine", "Coolline KV 1200", "INV-05", "Gastraum", "bestanden", ""], ["Kühlschrank Küche", "Coolline GN 600", "INV-06", "Küche", "bestanden", ""],
    ["Kontaktgrill", "Gastrotechnik KG-2", "INV-07", "Küche", "bestanden", ""], ["Stabmixer", "Profimix 750", "INV-08", "Küche", "bestanden", ""], ["Wasserkocher", "Thermo 1,7 l", "INV-09", "Theke", "bestanden", ""],
    ["Mehrfachsteckdose 5-fach", "ohne Typ", "INV-10", "Büro/Kasse", "maengel", "Gehäuse gerissen – ausgesondert und vernichtet, Ersatz beschafft"], ["Verlängerungskabel 10 m", "H07RN-F 3G1,5", "INV-11", "Terrasse", "bestanden", ""], ["Tablet-Netzteil Kasse", "USB-C 20 W", "INV-12", "Theke", "bestanden", ""],
  ].map(([bezeichnung, typ, inventar, standort, ergebnis, maengel]) => ({ bezeichnung: bezeichnung!, typ: typ!, inventar: inventar!, standort: standort!, ergebnis: ergebnis!, maengel: maengel!, naechste: "2027-08-12" }));
  dok({ id: "elektro", vorlage: "pruefprotokoll_elektro", datum: "2026-08-12", worum: "DGUV-V3-Prüfung durch Elektro Wendt GmbH (passt zu Beleg b31): 12 ortsveränderliche Geräte, 11 bestanden, Mehrfachsteckdose mit Mangel ausgesondert; nächste Prüfung 08/2027.",
    daten: (h) => ({ pruefer: "Elektro Wendt GmbH, Elektrofachkraft Marco Wendt", datum: "2026-08-12", messgeraet: "Benning ST 760", pruefart: "Wiederholungsprüfung", umfang: ["Sichtprüfung", "Messung des Schutzleiterwiderstands", "Messung des Isolationswiderstands", "Funktionsprüfung"], norm: "DIN EN 50678 (VDE 0701) / DIN EN 50699 (VDE 0702)", einsatz: "ortsveraenderliche_elektrische_betriebsm", leerzeilen: false, geraete: eintraege("pruefprotokoll_elektro", "geraete", geraete, h) }) });

  dok({ id: "hautschutz", vorlage: "hautschutzplan", datum: "2026-02-05", worum: "Hautschutzplan Küche/Spülbereich (Feuchtarbeit): Spülen, Gemüse/Fleisch, Reinigen mit Gefahrstoffen, Service; eigene Einträge, weil die Vorlage nur Friseur-Vorschläge hat.",
    daten: (h) => ({ bereich: "Küche und Spülbereich", eintraege: eintraege("hautschutzplan", "eintraege", [
      { anlass: "Spülen von Hand, Ein- und Ausräumen der Spülmaschine (Feuchtarbeit)", schutz: "Hautschutzcreme vor Arbeitsbeginn und nach Pausen", handschuhe: "flüssigkeitsdichte Nitrilhandschuhe mit Baumwoll-Unterziehhandschuhen", reinigung: "pH-hautneutrales Flüssigsyndet, lauwarm", pflege: "rückfettende Pflegecreme nach Arbeitsende" },
      { anlass: "Gemüse, Obst, Fleisch und Fisch vorbereiten", schutz: "–", handschuhe: "Einmalhandschuhe Nitril (lebensmittelgeeignet), bei Schneidarbeiten schnitthemmende Handschuhe", reinigung: "Flüssigsyndet", pflege: "Pflegecreme in Pausen" },
      { anlass: "Reinigung mit Backofenreiniger und Sanitärreiniger (Gefahrstoffe)", schutz: "–", handschuhe: "Chemikalienschutzhandschuhe Nitril, lang (EN ISO 374)", reinigung: "Flüssigsyndet", pflege: "Pflegecreme nach Arbeitsende" },
      { anlass: "Service und Theke (häufiges Händewaschen, Desinfektion)", schutz: "Hautschutzcreme vor Arbeitsbeginn", handschuhe: "keine", reinigung: "Flüssigsyndet; Händedesinfektion statt häufigem Waschen", pflege: "Pflegecreme in Pausen und nach Arbeitsende" },
    ], h), erstellt_von: "Jana Weber", datum: "2026-02-05" }) });

  // Gastronomie
  dok({ id: "ifsg", vorlage: "ifsg_belehrung", datum: "2026-02-10", worum: "Folgebelehrung nach § 43 Abs. 4 IfSG für Köchin (Erstbelehrung 15.02.2022) und Minijobber (Erstbelehrung 20.08.2025), alle sechs Inhalte, Liste nach § 42 angehängt.",
    daten: (h) => ({ belehrt_von: "Jana Weber", inhalte: (leereDatenVon("ifsg_belehrung", h).inhalte as string[]).concat(["bei Krankheitszeichen ärztlichen Rat einholen und mitteilen, dass man mit Lebensmitteln arbeitet (Merkblatt Gesundheitsamt)"]), liste_anhaengen: true,
      teilnehmer: eintraege("ifsg_belehrung", "teilnehmer", [{ name: "Sabine Krüger", erstbelehrung_am: "2022-02-15" }, { name: "Leon Schubert", erstbelehrung_am: "2025-08-20" }], h) }) });

  const GERICHTE: [string, string, string[]][] = [
    ["Croissant mit Butter und Konfitüre", "Frühstück", ["gluten", "eier", "milch"]],
    ["Rührei mit Schnittlauch und Bauernbrot", "Frühstück", ["gluten", "eier", "milch"]],
    ["Avocadobrot mit Sesam und Chili (Sauerteig)", "Frühstück", ["gluten", "sesam"]],
    ["Granola-Bowl mit Joghurt, Beeren und Haselnüssen", "Frühstück", ["gluten", "milch", "schalenfruechte"]],
    ["Quiche Lorraine mit Blattsalat", "Hauptgerichte", ["gluten", "eier", "milch"]],
    ["Tomatensuppe mit Basilikum (Gemüsefond mit Sellerie)", "Hauptgerichte", ["sellerie"]],
    ["Linsensalat mit Senf-Dressing", "Hauptgerichte", ["senf"]],
    ["Käsekuchen nach Omas Art", "Kuchen und Torten", ["gluten", "eier", "milch"]],
    ["Rüblitorte mit Mandeln und Frischkäsehaube", "Kuchen und Torten", ["gluten", "eier", "milch", "schalenfruechte"]],
    ["Leipziger Lerche (Mürbeteig, Marzipan, Kirsche)", "Kuchen und Torten", ["gluten", "eier", "milch", "schalenfruechte"]],
    ["Obstsalat der Saison", "Desserts", []],
    ["Cappuccino mit Kuhmilch", "Heißgetränke", ["milch"]],
    ["Espresso", "Heißgetränke", []],
    ["Hausgemachte Zitronenlimonade", "Kaltgetränke", []],
    ["Weißweinschorle", "Kaltgetränke", ["schwefeldioxid"]],
  ];
  dok({ id: "allergene", vorlage: "allergene", datum: "2026-03-01", worum: "Allergenliste mit 15 Speisen und Getränken; bei Obstsalat, Espresso und Limonade ist der Schalter „Enthält keines der 14 Hauptallergene“ gesetzt.",
    daten: (h) => ({ stand: "2026-03-01", legende: true, gerichte: eintraege("allergene", "gerichte", GERICHTE.map(([name, kategorie, allergene]) => ({ name, kategorie, allergene, keine: allergene.length === 0 })), h) }) });

  const messungen: Eintrag[] = [];
  for (let tag = 1; tag <= 15; tag++) {
    const iso = `2026-05-${String(tag).padStart(2, "0")}`;
    if (new Date(`${iso}T12:00:00Z`).getUTCDay() === 1) continue;
    const k = (2 + ((tag * 7) % 4) + ((tag * 3) % 10) / 10).toFixed(1).replace(".", ",");
    const tk = (-18 - ((tag * 5) % 4) - ((tag * 7) % 10) / 10).toFixed(1).replace(".", ",");
    messungen.push({ datum: iso, uhrzeit: "07:45", kontrollpunkt: "Kühlschrank Küche", wert: `${k} °C`, in_ordnung: "ja", kuerzel: "SK" });
    if (iso === "2026-05-12") messungen.push({ datum: iso, uhrzeit: "08:00", kontrollpunkt: "Kuchenvitrine", wert: "9,1 °C", in_ordnung: "nein", massnahme: "Tür war nicht geschlossen; Thermostat geprüft, Sahnetorte verworfen; Nachmessung 11:30 Uhr: 5,8 °C", kuerzel: "JW" });
    else messungen.push({ datum: iso, uhrzeit: "08:00", kontrollpunkt: "Kuchenvitrine", wert: `${(4 + ((tag * 3) % 3) + ((tag * 9) % 10) / 10).toFixed(1).replace(".", ",")} °C`, in_ordnung: "ja", kuerzel: "JW" });
    messungen.push({ datum: iso, uhrzeit: "08:05", kontrollpunkt: "Tiefkühltruhe", wert: `${tk} °C`, in_ordnung: "ja", kuerzel: "SK" });
  }
  messungen.push({ datum: "2026-05-05", uhrzeit: "09:30", kontrollpunkt: "Wareneingang Großmarkt (Molkereiprodukte)", wert: "6,2 °C, Verpackung einwandfrei, MHD ok", in_ordnung: "ja", kuerzel: "SK" });
  messungen.push({ datum: "2026-05-12", uhrzeit: "09:15", kontrollpunkt: "Wareneingang Großmarkt (Tiefkühlware)", wert: "−19,5 °C", in_ordnung: "ja", kuerzel: "SK" });
  messungen.sort((a, b) => String(a.datum).localeCompare(String(b.datum)) || String(a.uhrzeit).localeCompare(String(b.uhrzeit)));
  dok({ id: "haccp", vorlage: "haccp", datum: "2026-05-16", worum: "HACCP-Eigenkontrollen Mai 2026 (1.–15.05.): 9 Kontrollpunkte aus den App-Vorschlägen (Kühlung, Milchprodukte, Konditorwaren, Tiefkühlung, Kaltspeisen, Abkühlen, Wareneingang, Reinigung, Schädlinge); tägliche Messungen, eine Abweichung am 12.05. (Kuchenvitrine 9,1 °C) mit Korrektur.",
    daten: (h) => ({ zeitraum: "Mai 2026", leerzeilen: false,
      punkte: ["Kühllagerung allgemein", "Kühlung Milcherzeugnisse", "Kühlung feine Backwaren", "Tiefkühlung", "Ausgabetemperatur Kaltspeisen", "Abkühlen heißer Speisen", "Wareneingangskontrolle", "Reinigung und Desinfektion", "Schädlingsmonitoring"].map((x) => vorschlag("haccp", "punkte", x, h)),
      messungen: eintraege("haccp", "messungen", messungen, h) }) });

  const HYG: Eintrag[] = [
    { was: "Hände", wann: "vor Arbeitsbeginn, nach Pausen, WC, Abfall, rohem Fleisch/Ei", womit: "Flüssigseife, Einmalhandtücher", wie: "30 Sekunden waschen, abtrocknen", wer: "alle" },
    { was: "Hygienische Händedesinfektion", wann: "nach Umgang mit rohen Eiern, Geflügel; nach Naseputzen", womit: "Händedesinfektion (Spender Küche)", wie: "3 ml einreiben, 30 Sekunden", wer: "alle" },
    { was: "Arbeitsflächen Küche", wann: "nach jedem Arbeitsgang, Desinfektion nach rohem Fleisch/Ei und abends", womit: "Neutralreiniger, DesiQuick Flächendesinfektion", wie: "reinigen, desinfizieren, Einwirkzeit beachten, nachspülen", wer: "Küche" },
    { was: "Schneidebretter und Messer", wann: "nach Benutzung", womit: "Haubenspülmaschine", wie: "farbcodierte Bretter (rot Fleisch, grün Gemüse); bei 82 °C Klarspülen", wer: "Küche" },
    { was: "Kühlschränke und Kuchenvitrine", wann: "wöchentlich (Montag), bei Verschmutzung sofort", womit: "Neutralreiniger, Flächendesinfektion", wie: "ausräumen, Ware auf MHD prüfen, auswischen, desinfizieren", wer: "Küche" },
    { was: "Siebträgermaschine und Dampflanze", wann: "Dampflanze nach jedem Gebrauch, Brühgruppe täglich, Entkalken monatlich", womit: "feuchtes Tuch, Reinigungstabletten, Entkalker", wie: "Lanze abwischen und ausblasen; Rückspülen mit Blindsieb", wer: "Service" },
    { was: "Geschirr, Gläser, Besteck", wann: "nach Gebrauch", womit: "Haubenspülmaschine, Spülmaschinenreiniger, Klarspüler", wie: "Spültemperatur 60 °C, Klarspülen 82 °C; Temperaturanzeige täglich prüfen", wer: "Küche/Service" },
    { was: "Fußboden Küche und Theke", wann: "täglich nach Schließung", womit: "Bodenreiniger", wie: "kehren, nass wischen, trocknen lassen", wer: "Küche/Service" },
    { was: "Tische und Stühle Gastraum", wann: "nach jedem Gast, abends gründlich", womit: "Neutralreiniger", wie: "abwischen mit sauberem Tuch (Tuchwechsel täglich)", wer: "Service" },
    { was: "Gäste- und Personal-WC", wann: "täglich, Sichtkontrolle alle 2 Stunden", womit: "Sanitärreiniger sauer", wie: "reinigen, Verbrauchsmaterial auffüllen, Kontrollliste abzeichnen", wer: "Service" },
    { was: "Abfall und Bioabfall", wann: "täglich und bei Bedarf", womit: "verschließbare Behälter", wie: "leeren, Behälter wöchentlich reinigen", wer: "Küche" },
    { was: "Wischtücher und Arbeitskleidung", wann: "täglich wechseln", womit: "Waschmaschine 60 °C", wie: "getrennt von Privatwäsche waschen", wer: "Inhaberin" },
  ];
  dok({ id: "hygiene", vorlage: "hygieneplan", datum: "2026-02-05", worum: "Hygiene- und Reinigungsplan für Café-Küche und Gastraum (12 eigene Einträge), weil die Vorlage nur Beauty-Vorschläge hat.",
    daten: (h) => ({ bereich: "Café Morgenrot – Küche, Theke und Gastraum", eintraege: eintraege("hygieneplan", "eintraege", HYG, h), erstellt_von: "Jana Weber", datum: "2026-02-05" }) });

  // Kassenbuch Mai
  dok({ id: "kassenbuch", vorlage: "kassenbuch", datum: "2026-06-01", worum: `Kassenbuch der Bargeldkasse Mai 2026: Anfangsbestand ${euro(D.KASSENBUCH_ANFANG)} €, ${D.KASSE_MAI.length} Tageseinnahmen bar laut Z-Bon, Geldtransit zur Bank dienstags, drei Bareinkäufe (Belege b17, b18, b19), eine Privatentnahme; Endbestand unabhängig ${euro(D.kassenbuchEnde())} €.`,
    daten: (h) => ({ zeitraum: "Mai 2026", anfang: euro(D.KASSENBUCH_ANFANG), eintraege: eintraege("kassenbuch", "eintraege", D.KASSENBUCH_MAI.map((x) => ({ datum: x.datum, beleg: x.beleg, text: x.text, einnahme: x.einnahme ? euro(x.einnahme) : "", ausgabe: x.ausgabe ? euro(x.ausgabe) : "" })), h) }) });
  {
    const erg = v("kassenbuch").ergebnis!(unterlage("kassenbuch").daten);
    vergleich("Kassenbuch Mai", "Endbestand", ausEuro(erg[0]![1]), D.kassenbuchEnde());
  }

  // ---------------------------------------------------------------- Umsatzsteuer-Voranmeldungen Q1–Q4 (Übernahme aus Rechnungen und Tagesabschlüssen)
  const erwartetQ = D.ustQuartale();
  const periodeVon = (iso: string) => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
  const ust: Bau["ust"] = [];
  const vaDatum = ["2026-04-08", "2026-07-08", "2026-10-08", "2027-01-08"];
  for (const [i, eq] of erwartetQ.entries()) {
    const periode = eq.q;
    let app: Record<string, string> = {};
    let anzahl = 0;
    const id = `ust-q${i + 1}`;
    let kasseTage = 0;
    dok({ id, vorlage: "ust_voranmeldung", datum: vaDatum[i]!, worum: `USt-Voranmeldung ${i + 1}. Quartal 2026: Umsätze und Vorsteuer mit „Aus Rechnungen übernehmen“ (umsaetzeFuer, Soll) – seit R12 samt Kassenumsätzen aus den Tagesabschlüssen (19 %: ${euro(eq.k19)} €, 7 %: ${euro(eq.k7)} € netto), nichts von Hand ergänzt.`,
      daten: () => ({}),
      danach: () => {
        const erg = umsaetzeFuer(s.unterlagen, periode, s.betrieb, "soll", s.belege, undefined, kasseFuerUst(s, vaDatum[i]!));
        if (!erg) {
          auffaellig.push(`umsaetzeFuer(${periode}) lieferte null.`);
          return;
        }
        app = erg.werte;
        anzahl = erg.anzahl;
        kasseTage = erg.kasseTage;
        vergleichText(`USt ${periode} (Kasse)`, "Tage ohne Kassenabschluss (Kassenhinweis entfällt)", erg.kasseFehlend?.join(", ") || "keine", "keine");
        s = felderSetzen(s, id, { ...erg.werte, notiz: `Aus Rechnungen und Tagesabschlüssen übernommen (${MARKE.name}, ${erg.anzahl} Rechnungen, ${erg.kasseTage} Kassenabschlüsse${eq.r0 ? "; innergemeinschaftliche Lieferung, Kz 41 – Zusammenfassende Meldung abgeben" : ""}). Vorsteuer aus ${erg.vorsteuerBelege} Belegen.` }, t(vaDatum[i]!, 9));
        if (erg.ersatz) infos.push(`${periode}: ${erg.ersatz} Rechnung(en) ohne eindeutiges Leistungsdatum nach Rechnungsdatum zugeordnet.`);
      } });
    const u = unterlage(id);
    vergleich(`USt ${periode} (Übernahme Rechnungen + Kasse)`, "Umsätze 19 % (Kz 81)", ausEuro(app.umsatz_19 ?? "0"), eq.r19 + eq.k19);
    vergleich(`USt ${periode} (Übernahme Rechnungen + Kasse)`, "Umsätze 7 % (Kz 86)", ausEuro(app.umsatz_7 ?? "0"), eq.r7 + eq.k7);
    vergleich(`USt ${periode} (Übernahme aus Rechnungen)`, "Umsätze ohne USt (igl, Kz 41)", ausEuro(app.umsatz_igl ?? "0"), eq.r0);
    vergleich(`USt ${periode} (Übernahme aus Belegen)`, "Vorsteuer", ausEuro(app.vorsteuer ?? "0"), eq.vorsteuer);
    vergleichText(`USt ${periode} (Kasse)`, "übernommene Tagesabschlüsse", String(kasseTage), String(D.KASSE_TAGE.filter((k) => periodeVon(k.datum) === periode).length));
    const erg = v("ust_voranmeldung").ergebnis!(u.daten);
    vergleich(`USt ${periode} (fertige Voranmeldung)`, "Zahllast (mit Cent)", ausEuro(erg[2]![1]) * (erg[2]![0] === "Erstattung" ? -1 : 1), eq.zahllast);
    ust.push({ q: periode, app, appAnzahl: anzahl, kasse: { k19: eq.k19, k7: eq.k7, tage: kasseTage }, final: Object.fromEntries(["umsatz_19", "umsatz_7", "umsatz_igl", "umsatz_48", "umsatz_13b", "umsatz_frei", "vorsteuer"].map((k) => [k, String(u.daten[k] ?? "")])) });
  }

  // ---------------------------------------------------------------- EÜR 2026 (Übernahme + Kasse, USt-Zahlungen, AfA von Hand)
  const eu = D.euerUnabhaengig();
  let uebernahme!: ReturnType<typeof euerUebernahme>;
  dok({ id: "euer", vorlage: "euer", datum: "2027-02-15", worum: "EÜR 2026: „Aus Rechnungen und Belegen übernehmen“ (euerUebernahme, seit R12 mit den Kasseneinnahmen aus den Tagesabschlüssen), danach von Hand ergänzt: an das Finanzamt gezahlte USt (Q4/2025, Q1–Q3/2026), AfA Haubenspülmaschine.",
    daten: () => ({}),
    danach: () => {
      uebernahme = euerUebernahme(s, "2026");
      s = felderSetzen(s, "euer", { jahr: "2026", einnahmen: uebernahme.einnahmen, ausgaben: uebernahme.ausgaben }, t("2027-02-15", 9));
      const zahl = (l: Record<string, string>[], k: string) => l.filter((x) => x.kategorie === k).reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0);
      // igl gehört in die Zeile „Umsatzsteuerfreie … Betriebseinnahmen“, nicht zu den steuerpflichtigen
      const igl = D.vorgaenge().filter((x) => x.bezahlt?.startsWith("2026-")).reduce((a, x) => a + x.vz * (x.s.gruppen["0"]?.netto ?? 0), 0);
      const kasseZeile = (anfang: string) => uebernahme.einnahmen.filter((x) => (x.text ?? "").startsWith(anfang)).reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0);
      vergleich("EÜR-Übernahme", "Einnahmen netto aus bezahlten Rechnungen, steuerpflichtig", zahl(uebernahme.einnahmen, EUER_ZEILE_STEUERPFLICHTIG) - kasseZeile("Kasseneinnahmen laut"), eu.reNetto - igl);
      // R12: Kasseneinnahmen kommen aus den Tagesabschlüssen (vorher von Hand ergänzt)
      vergleich("EÜR-Übernahme", "Kasseneinnahmen netto (Tagesabschlüsse)", kasseZeile("Kasseneinnahmen laut"), eu.kasseNetto);
      vergleich("EÜR-Übernahme", "Umsatzsteuer auf Kasseneinnahmen", kasseZeile("Umsatzsteuer auf Kasseneinnahmen"), eu.kasseUst);
      vergleich("EÜR-Übernahme", "Einnahmen netto aus bezahlten Rechnungen, steuerfrei (igL 2026-012)", zahl(uebernahme.einnahmen, EUER_ZEILE_STEUERFREI), igl);
      vergleichText("EÜR-Übernahme", "Hinweis: USt-Vorauszahlungen und AfA selbst ergänzen", /Umsatzsteuer-Vorauszahlungen/.test(uebernahme.hinweis) && /AfA/.test(uebernahme.hinweis) ? "ja" : "nein", "ja");
      vergleich("EÜR-Übernahme", "Vereinnahmte USt aus Rechnungen", zahl(uebernahme.einnahmen, "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben") - kasseZeile("Umsatzsteuer auf Kasseneinnahmen"), eu.reUst);
      vergleich("EÜR-Übernahme", "Gezahlte Vorsteuer", zahl(uebernahme.ausgaben, "Gezahlte Vorsteuerbeträge"), eu.vorsteuer);
      vergleich("EÜR-Übernahme", "Betriebsausgaben aus Belegen (ohne Vorsteuer, ohne Anlage)", uebernahme.ausgaben.filter((x) => x.kategorie !== "Gezahlte Vorsteuerbeträge").reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0), eu.ausgabenBelege);
      for (const [kat, w] of Object.entries(eu.nachKategorie)) {
        const titel = kategorieFuer(kat).titel;
        const zeile = uebernahme.ausgaben.find((x) => (x.text ?? "").startsWith(titel));
        vergleich("EÜR-Übernahme", `Kategorie ${titel}`, zeile ? ausEuro(zeile.betrag ?? "0") : 0, w.betrag);
      }
      if (uebernahme.anlagen !== 1) auffaellig.push(`EÜR-Übernahme meldet ${uebernahme.anlagen} Anlagen statt 1.`);
      if (uebernahme.unbezahlt !== 1) infos.push(`EÜR-Übernahme meldet ${uebernahme.unbezahlt} unbezahlte Rechnungen des Jahres (erwartet 1: 2026-016 bezahlt 2027 – die App zählt nur Rechnungen ohne Zahlungsvermerk; 2026-015 wurde bar an der Kasse bezahlt).`);
      // Kategorien der Übernahme gegen die Vorschlagsliste der EÜR-Vorlage
      const vsA = (feld("euer", "ausgaben").felder.find((f) => f.id === "kategorie") as { vorschlaege?: string[] }).vorschlaege ?? [];
      const vsE = (feld("euer", "einnahmen").felder.find((f) => f.id === "kategorie") as { vorschlaege?: string[] }).vorschlaege ?? [];
      for (const x of uebernahme.ausgaben) if (!vsA.includes(x.kategorie ?? "")) auffaellig.push(`EÜR-Übernahme: Zeile „${x.kategorie}“ (für „${x.text}“) steht nicht in der Vorschlagsliste „Zeile der Anlage EÜR“ der EÜR-Vorlage.`);
      for (const x of uebernahme.einnahmen) if (!vsE.includes(x.kategorie ?? "")) auffaellig.push(`EÜR-Übernahme: Einnahmen-Zeile „${x.kategorie}“ steht nicht in der Vorschlagsliste der EÜR-Vorlage.`);
      // von Hand ergänzen
      const d = unterlage("euer").daten;
      const ein = [...(d.einnahmen as Eintrag[])];
      const qz = D.ustQuartale();
      const aus = [...(d.ausgaben as Eintrag[]),
        { datum: D.UST_Q4_2025.gezahlt, text: "USt-Vorauszahlung Q4/2025", kategorie: "An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer", betrag: euro(D.UST_Q4_2025.betrag) },
        ...qz.filter((q) => D.UST_ZAHLTAGE[q.q]!.startsWith("2026-")).map((q) => ({ datum: D.UST_ZAHLTAGE[q.q]!, text: `USt-Vorauszahlung ${q.q.replace("2026-", "")}/2026 (laut ELSTER)`, kategorie: "An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer", betrag: euro(q.elsterZahllast) }))];
      const anlage = D.BELEGE.find((b) => b.id === D.AFA.beleg)!;
      s = felderSetzen(s, "euer", { einnahmen: ein, ausgaben: aus, afa: [{ text: `Haubenspülmaschine HX-500 (${euro(D.belegSumme(anlage).netto)} € netto, 03/2026, 5 Jahre, 10/12)`, betrag: euro(eu.afa) }] }, t("2027-02-15", 10));
    } });
  const euerErgebnis = v("euer").ergebnis!(unterlage("euer").daten);
  {
    const g = euerErgebnis.find((z) => z[0] === "Gewinn" || z[0] === "Verlust")!;
    vergleich("EÜR 2026 (fertig)", "Summe Betriebseinnahmen", ausEuro(euerErgebnis[0]![1]), eu.einnahmen);
    vergleich("EÜR 2026 (fertig)", "Summe Betriebsausgaben", ausEuro(euerErgebnis[1]![1]), eu.ausgaben);
    vergleich("EÜR 2026 (fertig)", "AfA", ausEuro(euerErgebnis[2]![1]), eu.afa);
    vergleich("EÜR 2026 (fertig)", "Gewinn", ausEuro(g[1]) * (g[0] === "Verlust" ? -1 : 1), eu.ergebnis);
  }

  // ---------------------------------------------------------------- Steuererklärung (Zusammenstellung) aus den eigenen Unterlagen
  const vaSumme = (k: string) => [1, 2, 3, 4].reduce((a, q) => a + ausEuro(String(unterlage(`ust-q${q}`).daten[k] ?? "0")), 0);
  const ustJahr = [1, 2, 3, 4].reduce((a, q) => a + ausEuro(v("ust_voranmeldung").ergebnis!(unterlage(`ust-q${q}`).daten)[0]![1]), 0);
  const gewinn = euerErgebnis.find((z) => z[0] === "Gewinn" || z[0] === "Verlust")!;
  dok({ id: "steuer", vorlage: "steuererklaerung", datum: "2027-03-01", worum: "Zusammenstellung für ESt, GewSt und USt 2026: Gewinn aus der EÜR, Umsätze/USt/Vorsteuer als Summe der vier Voranmeldungen, ESt-Vorauszahlungen 4 × 1.850 €, GewSt-Vorauszahlungen 4 × 220 €, Kranken-/Pflegeversicherung und Rürup-Beiträge.",
    daten: (h) => ({ jahr: "2026", arten: ["est", "gewst", "ust"], gewinn: `${gewinn[0] === "Verlust" ? "-" : ""}${gewinn[1].replace(/[€\s\u00a0]/g, "")}`, umsatz: euro(vaSumme("umsatz_19") + vaSumme("umsatz_7") + (vaSumme("umsatz_frei") + vaSumme("umsatz_igl") + vaSumme("umsatz_48") + vaSumme("umsatz_13b"))), ust_jahr: euro(ustJahr), vorsteuer_jahr: euro(vaSumme("vorsteuer")),
      vorauszahlungen: eintraege("steuererklaerung", "vorauszahlungen", [...[1, 2, 3, 4].map((q) => ({ art: `Einkommensteuer Q${q}`, betrag: "1.850,00" })), ...[1, 2, 3, 4].map((q) => ({ art: `Gewerbesteuer Q${q}`, betrag: "220,00" }))], h),
      weiteres: eintraege("steuererklaerung", "weiteres", [{ was: "Kranken- und Pflegeversicherung (freiwillig gesetzlich, AOK PLUS)", betrag: "5.874,00", beleg: true }, { was: "Basisrente (Rürup), Beiträge 2026", betrag: "2.400,00", beleg: true }, { was: "Spende an den Kunstverein Plagwitz e. V.", betrag: "150,00", beleg: false }], h),
      notiz: `Kassenumsätze kommen aus den Tagesabschlüssen in ${MARKE.name} (Z-Bons). Innergemeinschaftliche Lieferung nach Österreich: Zusammenfassende Meldung für das 3. Quartal abgegeben.` }) });
  {
    const j = D.jahresSummen();
    vergleich("Steuererklärung", "Umsätze im Jahr netto (Summe der Voranmeldungen)", vaSumme("umsatz_19") + vaSumme("umsatz_7") + (vaSumme("umsatz_frei") + vaSumme("umsatz_igl") + vaSumme("umsatz_48") + vaSumme("umsatz_13b")), j.r19 + j.r7 + j.r0 + j.k19 + j.k7);
    vergleich("Steuererklärung", "Umsatzsteuer im Jahr (Summe der Voranmeldungen, mit Cent)", ustJahr, j.ust);
    vergleich("Steuererklärung", "Vorsteuer im Jahr", vaSumme("vorsteuer"), j.vorsteuer);
  }

  // ---------------------------------------------------------------- übersprungene Vorlagen
  uebersprungen.push(
    { id: "bilanz_guv", titel: v("bilanz_guv").titel, grund: "Einzelunternehmen ohne Handelsregistereintrag unter den Grenzen des § 141 AO – Gewinnermittlung per EÜR, keine Bilanz." },
    { id: "handelsregister", titel: v("handelsregister").titel, grund: "Kein Eintrag: Kleingewerbe/Einzelunternehmen ohne „e. K.“." },
    { id: "transparenzregister", titel: v("transparenzregister").titel, grund: "Gilt nur für juristische Personen und eingetragene Personengesellschaften, nicht für ein Einzelunternehmen." },
    { id: "datenpanne", titel: v("datenpanne").titel, grund: "Im Jahr 2026 gab es keine Datenpanne – die Vorlage wird nur im Ernstfall ausgefüllt." },
  );
  const genutzt = new Set(docs.map((d) => d.vorlage));
  for (const vl of VORLAGEN) if (!genutzt.has(vl.id) && !uebersprungen.some((u) => u.id === vl.id)) auffaellig.push(`Vorlage ${vl.id} weder erzeugt noch als übersprungen begründet.`);

  // ---------------------------------------------------------------- Pflichten-Check der App: passt das zu den erzeugten Unterlagen?
  // Stichtag 15.01.2026 mit den Unterlagen, die die App dann hat; Ereignisse leitet die App aus Profil und Unterlagen ab
  // R10: wie die App mit den gespeicherten Mitarbeitern (Beschäftigt seit ⇒ Einstellung; Leon seit 01.09.2025 ⇒ Einstellungs-Pflichten dran)
  const a = auswertung(s.profil, "2026-01-15", s.unterlagen.filter((u) => (u.ausgegeben ?? "") < "2026-01-16"), s.mitarbeiter);
  for (const id of ["branche.gastro_ifsg_belehrung", "arbeitsschutz.erstunterweisung", "personal.nachweisgesetz"]) vergleichText("Pflichten-Check (15.01.2026)", `gilt: ${id} (Auslöser „einstellung“, 2 Beschäftigte)`, a.gilt.some((p) => p.id === id) ? "ja" : "nein", "ja");
  // R10: ohne neue Einstellung in den letzten sechs Monaten stehen sie unter „Bei Neueinstellung“ (Nutzertests Sabine, Jonas)
  const ohneNeue = auswertung(s.profil, "2026-01-15", s.unterlagen.filter((u) => (u.ausgegeben ?? "") < "2026-01-16"), s.mitarbeiter.map((m) => ({ ...m, beginn: "2022-03-01" })));
  vergleichText("Pflichten-Check (15.01.2026)", "ohne neue Einstellung: Sofortmeldung unter „Bei Neueinstellung“", ohneNeue.beiEinstellung.some((p) => p.id === "personal.sofortmeldung") && !ohneNeue.gilt.some((p) => p.id === "personal.sofortmeldung") ? "ja" : "nein", "ja");
  // Jahresende: die Unterweisung vom 10.02.2026 ist ausgegeben ⇒ Wiederholung spätestens 10.02.2027
  const ende = auswertung(s.profil, "2026-12-31", s.unterlagen, s.mitarbeiter).gilt.find((p) => p.id === "arbeitsschutz.unterweisung_wiederholen");
  vergleichText("Pflichten-Check (31.12.2026)", "Unterweisung wiederholen – nächster Termin", ende?.naechsterTermin ?? "fehlt", "2027-02-10");
  const pflichten = {
    gilt: a.gilt.map((p) => ({ id: p.id, titel: p.titel, vorlage: p.vorlage, erzeugt: !!p.vorlage && genutzt.has(p.vorlage) })),
    unbekannt: a.unbekannt.map((p) => ({ titel: p.titel, fragen: p.offeneFragen })),
  };
  for (const p of pflichten.gilt) if (p.vorlage && !p.erzeugt) auffaellig.push(`Pflichten-Check: „${p.titel}“ gilt, die zugehörige Vorlage ${p.vorlage} wurde im Szenario nicht erzeugt.`);
  const belegt = new Set(a.gilt.map((p) => p.vorlage).filter(Boolean));
  for (const vid of genutzt) if (!belegt.has(vid) && vid !== "rechnung") infos.push(`Pflichten-Check: keine geltende Pflicht verweist auf die erzeugte Vorlage „${v(vid).titel}“ (${vid}).`);

  return { s, docs, auffaellig, infos, belegDateien, xmls, ohneXml, vergleiche, ust, euer: { uebernahme, final: unterlage("euer").daten, ergebnis: euerErgebnis }, uebersprungen, pflichten };
}

function leereDatenVon(vid: string, heute: string): Daten {
  const [s1] = anlegen({ ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, ...D.BETRIEB } }, vid, t(heute), "tmp");
  return s1.unterlagen[0]!.daten;
}

/** HTML eines Dokuments genau wie die App (Abschluss.tsx: dokumentHtml mit „Mein Betrieb“, Pro: mit Hausfarbe) */
export function dokHtml(s: Stand, uid: string): string {
  const u = s.unterlagen.find((x) => x.id === uid)!;
  return dokumentHtml(vorlageFuer(u.vorlage) as Vorlage, u.daten, s.betrieb);
}

/** Steuerberater-Pakete für Q4 und das Jahr – mit den Belegdateien */
export function pakete(s: Stand, dateien: Record<string, Uint8Array>): { q4: PaketErgebnis; jahr: PaketErgebnis } {
  const sb = s.steuerberatung;
  const jetzt = "2027-01-15T09:30:00";
  return {
    q4: steuerpaket(s, { von: "2026-10-01", bis: "2026-12-31", name: "2026-Q4" }, sb, dateien, jetzt),
    jahr: steuerpaket(s, { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, sb, dateien, "2027-02-15T10:00:00"),
  };
}

// ---------------------------------------------------------------- Belegdateien (so, wie die Lieferanten sie ausstellen würden)

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function belegHtml(b: D.BelegRoh): string {
  const sm = D.belegSumme(b);
  const [str, ort] = b.anschrift.split("\n");
  const bon = b.art === "brutto";
  const kopf = `<div class="lief"><strong>${esc(b.lieferant)}</strong><br>${esc(str ?? "")}<br>${esc(ort ?? "")}</div>`;
  const zeilen = b.pos.map((p) => `<tr><td>${esc(p.text)}${p.menge ? `<br><small>${esc(p.menge)}</small>` : ""}</td><td class="r">${p.satz} %</td><td class="r">${D.eur(p.betrag)} €</td></tr>`).join("");
  const steuer = sm.jeSatz.map((x) => `<tr><td>${x.satz ? `${bon ? "enth. " : ""}USt ${x.satz} %` : "ohne USt"}</td><td class="r">netto ${D.eur(x.netto)} €</td><td class="r">${x.satz ? `${D.eur(x.ust)} €` : "–"}</td></tr>`).join("");
  const css = `body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#222;margin:0}.blatt{${bon ? "width:80mm;margin:10mm auto;border:1px dashed #999;padding:6mm" : "margin:18mm 20mm"}}table{width:100%;border-collapse:collapse;margin-top:6mm}td,th{padding:3px 4px;border-bottom:1px solid #ddd;vertical-align:top}th{text-align:left;border-bottom:2px solid #444}.r{text-align:right;white-space:nowrap}.lief{font-size:${bon ? "10pt" : "11pt"}}h1{font-size:${bon ? "13pt" : "18pt"};margin:6mm 0 2mm}.an{margin-top:10mm}.summe td{font-weight:bold;border-top:2px solid #444}small{color:#666}`;
  const titel = b.kategorie === "personal" ? "Lohnjournal (Eigenbeleg)" : bon ? "Kassenbon" : "Rechnung";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="blatt">${kopf}${bon || b.kategorie === "personal" ? "" : `<div class="an">${esc(D.BETRIEB.name)}<br>Jana Weber<br>${esc(D.BETRIEB.strasse)}<br>${D.BETRIEB.plz} ${D.BETRIEB.ort}</div>`}
<h1>${titel}${b.nummer ? ` ${esc(b.nummer)}` : ""}</h1><div>Datum: ${D.de(b.datum)}${!bon && b.kategorie !== "personal" ? ` · Leistung: ${D.de(b.datum)} bzw. laut Positionen` : ""}</div>
<table><tr><th>${bon ? "Artikel" : "Position"}</th><th class="r">USt</th><th class="r">${bon ? "Brutto" : b.art === "netto" ? "Netto" : "Betrag"}</th></tr>${zeilen}</table>
<table>${steuer}<tr class="summe"><td>${bon ? "SUMME" : "Rechnungsbetrag"}</td><td></td><td class="r">${D.eur(sm.brutto)} €</td></tr></table>
<p><small>${b.zahlung === "bar" ? "Bar bezahlt." : b.zahlung === "privat" ? "Mit EC-Karte (privat) bezahlt." : b.kategorie === "personal" ? "Überweisungen laut Lohnabrechnung." : "Zahlbar per Überweisung bzw. SEPA-Lastschrift."}${!bon && b.kategorie !== "personal" ? " Steuernummer des Lieferanten: 231/1" + b.id.slice(1) + "/40" + b.id.slice(1) + "1." : ""}</small></p></div></body></html>`;
}
