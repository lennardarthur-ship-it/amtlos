/**
 * Jahres-Szenario „Kerzenwerk Lina Hoff“ 2026 – der App-Ablauf: Der Stand entsteht mit denselben Funktionen wie in der
 * App (anlegen → felderSetzen → ausgeben/festschreiben → stornieren, bezahltSetzen, belegSetzen, umsaetzeFuer mit Soll,
 * euerUebernahme, steuerpaket, mappenAuswahl, Pflichten-Check). Rohdaten und die unabhängig gerechneten Erwartungswerte
 * stehen in jahr-szenario-shop-daten.ts; hier wird verglichen und jede Abweichung als Auffälligkeit gesammelt.
 *
 * Besonderheit gegenüber Café, Salon und Grafikdesign: Der Großteil des Umsatzes läuft über den eigenen Onlineshop
 * (Umsatzberichte, keine Einzelrechnungen), Marktstände (offene Ladenkasse), Fernverkäufe in die EU über der Schwelle
 * (OSS), innergemeinschaftliche Lieferungen und § 13b-Belege aus Irland.
 *
 * Gebündelt und ausgeführt von werkzeuge/jahr-szenario-shop.mjs (Chromium für die PDFs).
 */
import {
  KU_HINWEIS,
  RAENDER,
  VORLAGEN,
  belegSummen,
  cent,
  dokumentHtml,
  eRechnungAus,
  eintragAusVorschlag,
  fehlendeAngaben,
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
import { euerUebernahme, kassenLage, steuerpaket, type PaketErgebnis } from "../src/unterlagen/steuerpaket";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { fussAngaben, fusszeileStempeln } from "../src/unterlagen/fusszeile";
import { mitSchriften } from "../src/unterlagen/schriften";
import { deckblattHtml, mappeDateiname, mappeZusammenfuegen, mappenAuswahl, seitenzahl, startSeiten } from "../src/unterlagen/kontrollmappe";
import { auswertung, type PflichtInfo, type Profil } from "../src/pflichten/check";
import * as D from "./jahr-szenario-shop-daten";

export { RAENDER, fussAngaben, fusszeileStempeln, mitSchriften, unzipSync, D, deckblattHtml, mappeDateiname, mappeZusammenfuegen, seitenzahl, startSeiten };

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

export interface PflichtZeile { id: string; titel: string; vorlage: string | null; vorlagen: string[]; erzeugt: boolean; termin: string | null; termine: number; grund: string; schwere: string; rechtsgrundlage: string }

export interface Bau {
  s: Stand;
  docs: Dok[];
  auffaellig: string[];
  infos: string[];
  belegDateien: { datei: string; html: string }[];
  xmls: { datei: string; xml: string; nummer: string }[];
  ohneXml: { nummer: string; fehlt: string[] }[];
  vergleiche: { bereich: string; was: string; app: string; erwartet: string; ok: boolean }[];
  ust: { m: string; app: Record<string, string>; appAnzahl: number; final: Record<string, string>; zahllast: string }[];
  euer: { uebernahme: ReturnType<typeof euerUebernahme>; ergebnis: [string, string][] };
  uebersprungen: { id: string; titel: string; grund: string }[];
  pflichten: { stichtag: string; gilt: PflichtZeile[]; gruendung: PflichtZeile[]; unbekannt: { id: string; titel: string; fragen: string[] }[] };
  varianten: { titel: string; ergebnis: string }[];
}

/** Profil im Pflichten-Check (wie es die Inhaberin beantwortet) */
export const PROFIL: Profil = {
  "taetigkeit.branchen": ["onlinehandel", "beauty_kosmetik"],
  rechtsform: "einzelunternehmen",
  "taetigkeit.einordnung": "gewerbe",
  erwerb: "haupt",
  "handwerk.anlage": "keine",
  "erlaubnis.gewo_paragraphen": ["keine"],
  "erlaubnis.gaststaette": false,
  "rentenversicherung.pflichtgruppe": ["keine"],
  bundesland: "HH",
  gemeinde_ags: "02000000",
  "betriebsstaetten.anzahl": 1,
  gruendungsdatum: D.GRUENDUNG,
  alg1_bezug: false,
  "beschaeftigte.gesamt": 1,
  "beschaeftigte.minijob": 1,
  "beschaeftigte.azubi": 0,
  "beschaeftigte.jugendlich": 0,
  "personal.sofortmeldebranchen": ["keine"],
  "kasse.elektronisch": false,
  "online.website": true,
  "ust.kleinunternehmer": false,
  steuerberater: true,
  "umsatz.vorjahr": 128000,
  "umsatz.prognose_laufendes_jahr": 165000,
  "gewinn.vorjahr": 41000,
  "gewinn.prognose_laufendes_jahr": 60000,
  "ust.zahllast_vorjahr": 14200,
  "ust.dauerfristverlaengerung": false,
  "vorauszahlung.est_kst": true,
  "vorauszahlung.gewst": true,
  "kunden.segmente": ["b2c", "b2b"],
  "kunden.regionen": ["inland", "eu"],
  // Marktstand seit r9 als eigene Antwort; Lohnsteuer „keine“ (nur Minijob mit Pauschsteuer); Investoren-Frage für alle Rechtsformen
  "vertrieb.kanaele": ["onlineshop", "marktstand"],
  "personal.lohnsteuer_anmeldezeitraum": "keine",
  "gesellschafter.auslaendische_investoren": false,
  "produkte.arten": ["physisch", "verpackung", "kosmetik"],
  // R10: eigene Seife – die Kosmetikverordnung gilt erst mit dieser Antwort (Frage „eigene Produkte?“)
  "produkte.hersteller": true,
  "handel.hohe_bargeschaefte": false,
  "arbeitsschutz.elektrische_geraete": true,
  "arbeitsschutz.gefahrstoffe": true,
  "datenverarbeitung.arten": ["kundendaten", "beschaeftigtendaten", "newsletter", "tracking"],
  "datenschutz.dienstleister": true,
  "ki.nutzung": false,
  "ki.eigene_produkte": false,
  "nis2.betroffen": "nein",
};

export function standBauen(): Bau {
  const auffaellig: string[] = [];
  const infos: string[] = [];
  const varianten: Bau["varianten"] = [];
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
  s = profilSetzen(s, PROFIL);
  s = steuerberatungSetzen(s, { kontenrahmen: "SKR03", beraternummer: "52190", mandantennummer: "10744" });
  for (const [id, k] of Object.entries(D.KUNDEN)) s = personSetzen(s, "kunde", { id, ...k } as never, t("2026-01-02"));
  for (const [id, m] of Object.entries(D.MITARBEITERIN)) s = personSetzen(s, "mitarbeiter", { id, ...m } as never, t("2026-01-02"));

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
    docs.push({ nr, uid: o.id, vorlage: o.vorlage, titel: vl.titelFuer?.(u.daten) ?? vl.titel, datum: o.datum, datei: `${String(nr).padStart(2, "0")}-${pdfDateiname(vl, u.daten, o.datum)}`, ordner: o.ordner ?? "pdf", quer: !!vl.querformat, worum: o.worum, fehlt });
    if (fehlt.length) infos.push(`${vl.titel} (${o.id}): App meldet „Fehlt noch“: ${fehlt.join("; ")}`);
    return u;
  }

  // ---------------------------------------------------------------- Ausgangsrechnungen (Storno, Zahlungseingänge)
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
            datum: r.datum,
            leistung_gleich: !r.leistung,
            leistung: r.leistung ? D.de(r.leistung) : "",
            zahlungsziel: r.ziel,
            positionen: r.pos.map((x) => ({ bezeichnung: x.bez, menge: menge(x.menge), einheit: x.einheit, preis: euro(x.preis), satz: String(x.satz) })),
            hinweise: r.igl ? ["igl"] : [],
            hinweis: r.hinweis,
            // schon bezahlt am oder vor dem Rechnungsdatum (Shop-Bestellung): Feld „Schon bezahlt am“ (r9)
            ...(r.bezahlt && r.bezahlt <= r.datum ? { bezahlt_am: r.bezahlt } : {}),
          }),
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
    const vz = x.vz;
    vergleich("Rechnung " + x.nummer, "Netto", vz * Math.abs(sm.netto_cent), vz * x.s.netto);
    vergleich("Rechnung " + x.nummer, "Umsatzsteuer", vz * Math.abs(sm.ust_cent), vz * x.s.ust);
    const erg = v("rechnung").ergebnis!(u.daten);
    vergleich("Rechnung " + x.nummer, "Rechnungsbetrag laut Formular", ausEuro(erg.find((z) => z[0] === "Rechnungsbetrag")![1]), vz * x.s.brutto);
    if (x.r.igl && x.art === "rechnung") vergleichText("Rechnung " + x.nummer, "Steuerart der E-Rechnung (innergemeinschaftliche Lieferung)", daten.steuerart ?? "–", "igl");
    if (fehlt.length) {
      ohneXml.push({ nummer: x.nummer, fehlt });
      continue;
    }
    const xml = xrechnungUbl(daten, KU_HINWEIS);
    xmls.push({ datei: `E-Rechnung-${daten.nummer.replace(/[^A-Za-z0-9-]+/g, "-")}.xml`, xml, nummer: x.nummer });
    const zahlbar = /<cbc:PayableAmount[^>]*>([-\d.]+)</.exec(xml)?.[1];
    vergleich("E-Rechnung " + x.nummer, "PayableAmount (BT-115)", Math.round(Number(zahlbar) * 100), vz * x.s.brutto);
    if (x.r.igl && x.art === "rechnung") {
      vergleichText("E-Rechnung " + x.nummer, "Steuerkategorie K (innergemeinschaftliche Lieferung)", /<cac:ClassifiedTaxCategory>\s*<cbc:ID>K</.test(xml) ? "K" : (/<cac:ClassifiedTaxCategory>\s*<cbc:ID>([A-Z]+)</.exec(xml)?.[1] ?? "?"), "K");
      vergleichText("E-Rechnung " + x.nummer, "USt-IdNr. der Käuferin (BT-48)", /ATU68215437/.test(xml) ? "ATU68215437" : "fehlt", "ATU68215437");
    }
  }
  const privat = D.RECHNUNGEN.filter((r) => !("email" in D.KUNDEN[r.kunde])).map((r) => r.nummer);
  infos.push(`Ohne XRechnung (App: Angaben fehlen): ${ohneXml.map((o) => `${o.nummer} (${o.fehlt.join(", ")})`).join("; ") || "keine"}. Erwartet: nur Privatkunden ohne E-Mail (${privat.join(", ")}).`);
  // Rechnung 2026-011 an einen Shop-Kunden: Brutto der App ↔ Brutto laut Shop (Netto-Eingabe, Rundung)
  {
    const r11 = D.vorgaenge().find((x) => x.nummer === "2026-011")!;
    infos.push(`Rechnung 2026-011 (Shop-Bestellung #2391): Rechnungsbetrag ${euro(r11.s.brutto)} € gegenüber ${euro(r11.r.shopBestellung!.brutto)} € im Shop – die Rechnung nimmt nur Netto-Einzelpreise (24,90 € brutto → 20,92 € netto); Bruttopreise für Verbraucher lassen sich nicht eingeben. Die App weiß nicht, dass dieser Umsatz schon im Shop-Bericht steht.`);
  }

  // ---------------------------------------------------------------- Belege (§ 13b und steuerfreie Gebühren mit 0 %, ohne Vorsteuer)
  const belegDateien: Bau["belegDateien"] = [];
  for (const b of D.BELEGE) {
    const jetzt = t(b.datum, 18).toISOString();
    const sm = D.belegSumme(b);
    const beleg: Beleg = {
      id: b.id, datum: b.datum, lieferant: b.lieferant, nummer: b.nummer, kategorie: b.kategorie,
      steuer: sm.jeSatz.map((x) => ({ satz: x.satz, brutto_cent: x.brutto })),
      vorsteuer: b.vorsteuer || !!b.p13b, zahlung: b.zahlung, bezahlt: b.bezahlt, notiz: b.notiz ?? null, datei: `${b.id}.pdf`, quelle: "foto", erstellt: jetzt, geaendert: jetzt,
      // R10: Leistungen aus Irland als § 13b-Beleg (Kz 46/47, Vorsteuer Kz 67)
      ...(b.p13b ? { steuerschuld: "eu" as const } : {}),
    };
    s = belegSetzen(s, beleg, t(b.datum, 18));
    belegDateien.push({ datei: `${b.id}.pdf`, html: belegHtml(b) });
    const app = belegSummen(s.belege.find((x) => x.id === b.id)!);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Brutto", app.brutto_cent, sm.brutto);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Vorsteuer (App rechnet aus Brutto, Beleg weist aus)", app.vorsteuer_cent, sm.vorsteuer);
  }
  infos.push(`§ 13b-Belege (${D.BELEGE.filter((b) => b.p13b).map((b) => b.id).join(", ")}): in der App mit dem Schalter „Ich schulde die Umsatzsteuer (§ 13b UStG)“ und „Dienstleistung aus dem EU-Ausland“ erfasst (seit R10).`);

  // ---------------------------------------------------------------- Website und Datenschutz
  const SHOP_ERG = [
    "Bestellungen im Onlineshop: Für die Abwicklung Ihrer Bestellung verarbeiten wir Name, Rechnungs- und Lieferanschrift, E-Mail-Adresse, Telefonnummer (freiwillig), bestellte Artikel und Zahlungsart (Art. 6 Abs. 1 lit. b DSGVO). Bestell- und Rechnungsdaten bewahren wir wegen handels- und steuerrechtlicher Pflichten bis zu zehn Jahre auf (§ 147 AO, § 257 HGB). Der Shop läuft auf der Plattform Shopwerk Commerce Ltd., 1 Grand Canal Quay, Dublin, Irland, die als Auftragsverarbeiter für uns tätig ist.",
    "Zahlungsdienstleister: Je nach gewählter Zahlungsart geben wir die für die Zahlung nötigen Daten an PayPal (Europe) S.à r.l. et Cie, S.C.A., 22-24 Boulevard Royal, L-2449 Luxemburg, oder an Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Dublin, Irland, weiter (Art. 6 Abs. 1 lit. b DSGVO). Die Anbieter verarbeiten die Daten auch eigenverantwortlich (z. B. zur Betrugsprävention); es gelten deren Datenschutzhinweise.",
    "Versand: Für die Zustellung geben wir Name und Lieferanschrift an die HanseVersand Paketdienst GmbH, Hörgensweg 5, 22523 Hamburg, weiter (Art. 6 Abs. 1 lit. b DSGVO); Ihre E-Mail-Adresse nur, wenn Sie der Sendungsbenachrichtigung zugestimmt haben (Art. 6 Abs. 1 lit. a DSGVO).",
    "Meta-Pixel: Nur mit Ihrer Einwilligung über das Einwilligungsbanner setzen wir das Meta-Pixel der Meta Platforms Ireland Ltd., Merrion Road, Dublin 4, Irland, ein, um die Wirkung unserer Werbeanzeigen zu messen (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO). Für die Erhebung und Übermittlung sind wir mit Meta gemeinsam verantwortlich (Art. 26 DSGVO). Übermittlungen in die USA stützt Meta auf den Angemessenheitsbeschluss zum EU-US Data Privacy Framework.",
  ].join("\n\n");

  dok({ id: "impressum", vorlage: "impressum", datum: "2026-01-12", worum: "Impressum des Onlineshops: Einzelunternehmen, Inhaberin, Kontakt, USt-IdNr. aus „Mein Betrieb“, keine Teilnahme an Verbraucherschlichtung (1 Beschäftigte).",
    daten: () => ({ rechtsform: "Einzelunternehmen", vertreten: "Lina Hoff", vsbg: "nicht_bereit" }) });

  dok({ id: "dse", vorlage: "datenschutzerklaerung_website", datum: "2026-01-12", worum: "Datenschutzerklärung des Onlineshops: Hosting beim Shop-System (Irland), Logfiles 14 Tage, Kontaktformular, Einwilligungsbanner, technisch notwendige Cookies (Warenkorb), Newsletter (Postfach Marketing GmbH), Schriften lokal, Instagram-Link; Bestellung, Zahlungsdienstleister, Versand und Meta-Pixel nur über „Weitere Verarbeitungen“ (keine Bausteine dafür).",
    daten: () => ({ website: "https://www.kerzenwerk-hoff.example", module: ["hosting", "server_logfiles", "kontakt", "cookies_einwilligung", "technisch_notwendige_cookies", "newsletter", "google_fonts_lokal", "social_media_links", "widerruf_einwilligung"],
      hoster_name: "Shopwerk Commerce Ltd.", hoster_anschrift: "1 Grand Canal Quay, Dublin D02 Y925, Irland", kontaktformular: true, logfile_tage: "14", link_einstellungen: "den Link „Cookie-Einstellungen“ am Ende jeder Seite",
      cookie_zwecke: "Speicherung Ihrer Cookie-Auswahl und des Warenkorbs", cookie_dauer: "nach Ende der Sitzung bzw. die Cookie-Auswahl nach 12 Monaten",
      newsletter_themen: "neue Düfte, saisonale Kollektionen und Rabattaktionen", newsletter_dienst: "Postfach Marketing GmbH, Chausseestraße 86, 10115 Berlin", netzwerke: "Instagram", ergaenzung: SHOP_ERG, stand: "2026-01-12" }) });

  dok({ id: "avv-shop", vorlage: "avv", datum: "2025-11-20", worum: "Auftragsverarbeitungsvertrag mit dem Shop-System (Hosting, Bestell- und Kundendaten, Irland; Unterauftragsverarbeiter in den USA).",
    daten: () => ({ rolle: "auftraggeber", partner: "Shopwerk Commerce Ltd.", partner_anschrift: "1 Grand Canal Quay\nDublin D02 Y925\nIrland", hauptvertrag: "Nutzungsbedingungen Shopwerk, Tarif „Grow“ (Kundenkonto SW-77120) vom 20.11.2025",
      gegenstand: "Hosting des Onlineshops www.kerzenwerk-hoff.example\nSpeicherung und Verarbeitung von Bestell-, Kunden- und Zahlungsstatusdaten\nVersand von Bestell- und Versandbestätigungen", zweck: "Betrieb des Onlineshops und Abwicklung von Bestellungen", dauer: "für die Laufzeit des Hauptvertrags",
      datenarten: "Name\nKontaktdaten (Telefon, E-Mail)\nRechnungs- und Lieferanschrift\nBestelldaten und Zahlungsstatus\nKundenkonto (Login, Bestellhistorie)", betroffene: "Kundinnen und Kunden\nInteressenten (Newsletter-Formular, Warenkorb)",
      unterauftrag: "Rechenzentrum: Cloud-Anbieter mit Serverstandort Frankfurt am Main (EU)\nSupport und Betrugsprävention: Konzerngesellschaft in den USA (Standardvertragsklauseln, EU-US Data Privacy Framework)", tom: "siehe Anlage (TOM-Beschreibung des Auftragsverarbeiters)", ort_datum: "Hamburg" }) });

  dok({ id: "avv-newsletter", vorlage: "avv", datum: "2025-12-01", worum: "Auftragsverarbeitungsvertrag mit dem Newsletter-Dienst (E-Mail-Adressen, Double-Opt-in-Protokoll, Öffnungsstatistik).",
    daten: () => ({ rolle: "auftraggeber", partner: "Postfach Marketing GmbH", partner_anschrift: "Chausseestraße 86\n10115 Berlin", hauptvertrag: "Vertrag über den Newsletter-Tarif „Start“ vom 01.12.2025 (Kundennummer PM-77120)",
      gegenstand: "Versand von E-Mail-Newslettern\nVerwaltung der Empfängerliste mit Double-Opt-in\nAuswertung von Öffnungen und Klicks", zweck: "Versand des Newsletters an Personen, die eingewilligt haben", dauer: "für die Laufzeit des Hauptvertrags",
      datenarten: "E-Mail-Adresse\nVorname (freiwillig)\nZeitpunkt und IP-Adresse von Anmeldung und Bestätigung\nÖffnungs- und Klickdaten", betroffene: "Newsletter-Abonnentinnen und -Abonnenten",
      unterauftrag: "Rechenzentrum: RZ Nord GmbH, Nürnberg (Serverstandort Deutschland)", tom: "siehe Anlage (TOM-Beschreibung des Auftragsverarbeiters)", ort_datum: "Hamburg" }) });

  dok({ id: "dsinfo", vorlage: "datenschutzinformation", datum: "2026-01-12", worum: "Datenschutzinformation nach Art. 13 DSGVO für Kundinnen und Kunden außerhalb der Website (Marktstand, Großhandel, Rechnungen per E-Mail, Newsletter-Anmeldung am Stand).",
    daten: () => ({ fuer_wen: "Kundinnen und Kunden (Großhandel, Marktstand, Bestellungen per E-Mail)", verarbeitungen: ["Kundenverwaltung / Kundenkartei", "Rechnungsstellung und Buchhaltung", "Kontaktanfragen (Kontaktformular, E-Mail, Telefon)", "Geschäftliche E-Mail-Kommunikation", "E-Mail-Newsletter / E-Mail-Werbung", "Lieferanten- und Dienstleisterverwaltung"],
      interessen: "Durchsetzung und Abwehr von Ansprüchen\nSicherer und störungsfreier Betrieb unserer IT", bereitstellung: "vertrag",
      ergaenzung: "Bestellungen im Onlineshop: siehe Datenschutzerklärung unter www.kerzenwerk-hoff.example/datenschutz. Versand von Bestellungen: Name und Lieferanschrift an die HanseVersand Paketdienst GmbH.", stand: "2026-01-12" }) });

  dok({ id: "vvt", vorlage: "datenschutz_dokumentation", datum: "2026-01-14", worum: "Verzeichnis der Verarbeitungstätigkeiten: 9 Tätigkeiten aus den Vorschlägen und 2 eigene (Onlineshop-Bestellabwicklung, Meta-Pixel), 12 TOM; Dienstleister Shopwerk und Postfach Marketing (AVV), PayPal, Stripe, HanseVersand, Steuerbüro (eigenverantwortlich), Meta (gemeinsam verantwortlich).",
    daten: (h) => ({
      verantwortlich: "Kerzenwerk Lina Hoff, Inhaberin Lina Hoff",
      verarbeitungen: [
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kundenverwaltung", h, { datenarten: "Name, Anschrift, E-Mail, Telefon, Bestellhistorie (Großhandel und Privatkundschaft mit Rechnung)" }),
        ...eintraege("datenschutz_dokumentation", "verarbeitungen", [
          { bezeichnung: "Onlineshop: Bestellabwicklung, Zahlung, Versand und Retouren", zweck: "Abschluss und Erfüllung von Kaufverträgen im Fernabsatz, Widerruf und Erstattung", rechtsgrundlage: "Art. 6 Abs. 1 lit. b und c DSGVO", betroffene: "Kundinnen und Kunden des Onlineshops", datenarten: "Name, Rechnungs- und Lieferanschrift, E-Mail, Telefon (freiwillig), Bestelldaten, Zahlungsart und -status", empfaenger: "Shopwerk Commerce Ltd. (Auftragsverarbeiter), PayPal und Stripe (eigenverantwortlich), HanseVersand Paketdienst GmbH (eigenverantwortlich), Steuerbüro Ahrens", drittland: "USA (Unterauftragsverarbeiter des Shop-Systems; EU-US Data Privacy Framework)", loeschfrist: "Bestell- und Rechnungsdaten 10 Jahre (§ 147 AO), Kundenkonto bei Löschung durch die Kundin bzw. den Kunden" },
          { bezeichnung: "Reichweitenmessung von Werbeanzeigen (Meta-Pixel)", zweck: "Messung der Wirkung von Anzeigen auf Instagram/Facebook", rechtsgrundlage: "§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO (Einwilligung über das Banner)", betroffene: "Besucherinnen und Besucher der Website mit Einwilligung", datenarten: "Cookie-Kennung, IP-Adresse, aufgerufene Seiten, Kaufereignis", empfaenger: "Meta Platforms Ireland Ltd.", drittland: "USA (EU-US Data Privacy Framework)", gemeinsam: "Meta Platforms Ireland Ltd. (gemeinsame Verantwortung für Erhebung und Übermittlung, Art. 26 DSGVO)", loeschfrist: "Widerruf der Einwilligung; Cookies nach 90 Tagen" },
        ], h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Rechnungsstellung", h, { empfaenger: "Steuerbüro Ahrens, Finanzamt Hamburg-Altona" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lohn- und Gehalts", h, { empfaenger: "Minijob-Zentrale, Steuerbüro Ahrens, Berufsgenossenschaft Handel und Warenlogistik" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Personalverwaltung", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Betrieb der Website", h, { empfaenger: "Shopwerk Commerce Ltd. (Auftragsverarbeiter)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kontaktanfragen", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "E-Mail-Newsletter", h, { empfaenger: "Postfach Marketing GmbH (Auftragsverarbeiter)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lieferanten", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Unternehmensauftritt", h, { gemeinsam: "Meta Platforms Ireland Ltd. (Instagram-Seite, Seiten-Statistiken, Art. 26 DSGVO)" }),
      ],
      tom: [
        "Geräteverschlüsselung und Bildschirmsperre", "Website ausschließlich über HTTPS", "WLAN mit aktueller Verschlüsselung", "Persönliche Benutzerkonten", "Starke, individuelle Passwörter", "Zwei-Faktor-Authentisierung",
        "Abschließbare Räume/Schränke", "Verpflichtung aller Beschäftigten", "Auftragsverarbeitungsverträge", "Automatische Sicherheitsupdates", "Regelmäßige Datensicherung", "Jährliche Überprüfung des Verzeichnisses",
      ].map((x) => vorschlag("datenschutz_dokumentation", "tom", x, h, { umgesetzt_am: "2025-09-01", verantwortlich: "Lina Hoff" })),
      dienstleister: eintraege("datenschutz_dokumentation", "dienstleister", [
        { name: "Shopwerk Commerce Ltd. (Irland)", leistung: "Shop-System und Hosting", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2025-11-20", drittland: "USA (Unterauftragsverarbeiter, EU-US Data Privacy Framework)" },
        { name: "Postfach Marketing GmbH", leistung: "Newsletter-Versand", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2025-12-01", drittland: "keine Übermittlung in Drittländer" },
        { name: "PayPal (Europe) S.à r.l. et Cie, S.C.A.", leistung: "Zahlungsabwicklung (eigenverantwortlich)", auftragsverarbeitung: false, drittland: "laut Anbieter" },
        { name: "Stripe Payments Europe, Ltd.", leistung: "Kartenzahlung (eigenverantwortlich)", auftragsverarbeitung: false, drittland: "laut Anbieter" },
        { name: "HanseVersand Paketdienst GmbH", leistung: "Paketversand (eigenverantwortlich)", auftragsverarbeitung: false, drittland: "keine Übermittlung in Drittländer" },
        { name: "Steuerbüro Ahrens", leistung: "Steuerberatung (eigenverantwortlich)", auftragsverarbeitung: false, drittland: "keine Übermittlung in Drittländer" },
      ], h),
    }) });

  dok({ id: "verfahren", vorlage: "verfahrensdokumentation", datum: "2026-01-15", worum: "Verfahrensdokumentation (GoBD) für Onlineshop, Märkte und Großhandel: Amtlos für Rechnungen und Belege, Shop-System mit Umsatzberichten, PayPal/Stripe, Kassenbuch für die Marktkasse, Online-Banking, Upload an das Steuerbüro.",
    daten: () => ({ version: "1.0", verantwortlich: "Lina Hoff (Inhaberin)",
      organisation: "Kerzenwerk Lina Hoff, Herstellung von Duftkerzen und Naturseifen in der eigenen Werkstatt. Verkauf über den eigenen Onlineshop (Deutschland und EU), an Marktständen (Kunsthandwerkermarkt, Weihnachtsmarkt) und an Händler/Hotels. Inhaberin Lina Hoff (Herstellung, Buchhaltung, Einkauf), eine Minijobberin (Packen und Versand).",
      steuerberatung: "Jahresabschluss durch die Steuerberatung; laufende Buchführung im Betrieb",
      systeme: eintraege("verfahrensdokumentation", "systeme", [
        { name: "Amtlos (App, iPhone)", zweck: "Rechnungsprogramm und Belegerfassung", version: "seit 01/2026" },
        { name: "Shopwerk (Shop-System)", zweck: "Onlineshop, Bestellungen, monatliche Umsatz- und Steuerberichte (CSV), OSS-Bericht je Land", version: "Tarif „Grow“, seit 04/2023" },
        { name: "PayPal-Geschäftskonto und Stripe-Dashboard", zweck: "Zahlungsabwicklung, Auszahlungs- und Gebührenberichte", version: "seit 04/2023" },
        { name: "Kassenbuch (Papier) für die Marktkasse", zweck: "offene Ladenkasse an Marktständen, tägliches Zählprotokoll", version: "seit 04/2023" },
        { name: "Haspa Online-Banking", zweck: "Online-Banking", version: "seit 04/2023" },
        { name: "Upload-Portal Steuerbüro Ahrens", zweck: "Upload-Portal der Steuerberatung", version: "seit 01/2024" },
      ], "2026-01-15"),
      belegeingang: ["Papier (Post/persönlich)", "E-Mail mit PDF-Anhang", "Download aus Kunden-/Lieferantenportal", "Kontoauszug/Bank-Schnittstelle", "Eigenbeleg"],
      belegart: ["originär Papier, Ablage in Papier (Muster 4.1)", "originär digital (Muster 4.3)"],
      ablage: ["Buchhaltungssoftware mit Belegarchiv", "Upload an Steuerberater (z. B. Kanzlei-Portal)", "Papierordner (chronologisch/nach Belegart)"],
      erfassung: "Belege werden wöchentlich in Amtlos erfasst (Foto bzw. PDF); Gebührenübersichten von PayPal, Stripe, Shopwerk und Meta werden monatlich bzw. quartalsweise aus den Portalen geladen.\nShop-Umsätze: Am Monatsende wird der Umsatz- und Steuerbericht des Shop-Systems (je Land und Steuersatz, mit Erstattungen) als CSV und PDF exportiert, unverändert archiviert und für die Voranmeldung bzw. OSS-Erklärung verwendet; die einzelnen Bestellungen bleiben im Shop-System gespeichert.\nMarktkasse: Zählprotokoll und Kassenbuch täglich nach Marktschluss.\nAusgangsrechnungen (Großhandel, Rechnungen auf Wunsch) werden fortlaufend nummeriert in Amtlos erstellt und beim Teilen festgeschrieben; Korrekturen nur per Stornorechnung.",
      scannen: false, sicherung_intervall: "wöchentlich", sicherung_ort: ["Cloud-Backup", "durch Softwareanbieter/Rechenzentrum"], e_rechnung: true,
      zugriff: "Zugriff auf Buchhaltung, Shop-Verwaltung und Zahlungskonten nur für die Inhaberin; die Minijobberin hat im Shop-System nur die Rolle „Versand“ (Bestellungen ansehen, Versandlabels drucken)",
      kontrollen: "Monatlicher Abgleich Shop-Bericht ↔ Auszahlungen PayPal/Stripe ↔ Kontoauszug\nTägliches Zählen der Marktkasse\nVor jeder Voranmeldung: Rechnungen zu Shop-Bestellungen aus dem Shop-Umsatz herausrechnen",
      aenderungen: eintraege("verfahrensdokumentation", "aenderungen", [{ datum: "2026-01-15", aenderung: "Rechnungsstellung und Belegerfassung auf Amtlos umgestellt." }, { datum: "2026-07-17", aenderung: "EU-Lieferschwelle überschritten: Shop berechnet ab Bestellung #2219 die Steuer des Bestimmungslands; OSS-Registrierung beim BZSt." }], "2026-01-15") }) });

  dok({ id: "aufbewahrung", vorlage: "aufbewahrung", datum: "2026-01-15", worum: "Aufbewahrungsplan mit den Startzeilen der App und fünf ergänzten Zeilen (Shop-Berichte und Bestelldaten, OSS-Aufzeichnungen, Kassenbuch Markt, Lohnkonto/Arbeitszeit Minijob, Produktinformationsdatei Kosmetik).",
    daten: (h) => {
      const start = (leereDatenVon("aufbewahrung", h).eintraege as Eintrag[]).map((e) => ({ ...e, letzte: "2026", ort: "Amtlos (verschlüsselt) und Upload-Portal Steuerbüro; Papier im Büroschrank" }));
      return { eintraege: [...start, ...eintraege("aufbewahrung", "eintraege", [
        { art: "Shop-Umsatzberichte, Bestell- und Erstattungsdaten (Export aus dem Shop-System), Auszahlungsberichte PayPal/Stripe", jahre: "10", letzte: "2026", ort: "Export auf externer Festplatte und im Cloud-Backup" },
        { art: "Aufzeichnungen zum OSS-Verfahren (§ 22 Abs. 1 UStG i. V. m. Art. 63c MwStVO)", jahre: "10", letzte: "2026", ort: "Ordner „OSS“ (digital)" },
        { art: "Kassenbuch und Zählprotokolle der Marktkasse", jahre: "10", letzte: "2026", ort: "Ordner „Markt“ im Büroschrank" },
        { art: "Lohnkonto und Arbeitszeitnachweise Minijob (§ 41 EStG, § 17 MiLoG)", jahre: "6", letzte: "2026", ort: "Personalordner" },
        { art: "Produktinformationsdatei je Seifenrezeptur (Art. 11 VO (EG) Nr. 1223/2009, 10 Jahre nach der letzten Charge)", jahre: "10", letzte: "2026", ort: "Ordner „Kosmetik“ (digital)" },
      ], h)] };
    } });

  // ---------------------------------------------------------------- Personal (Minijob)
  const m1 = s.mitarbeiter.find((x) => x.id === "m1")!;
  dok({ id: "nachweis", vorlage: "nachweis_arbeitsbedingungen", datum: "2025-08-25", worum: "Nachweis der Arbeitsbedingungen Minijobberin Paula Krüger (Packen und Versand, 14,50 €/Std., 40 Std. im Monat an 2 Tagen je Woche, 10 Urlaubstage).",
    daten: () => ({ ...personIn(v("nachweis_arbeitsbedingungen"), m1), beginn: "2025-09-01", befristet: false, arbeitsort: "betrieb", taetigkeit: "Packen und Versand, Etikettieren, Lagerpflege", probezeit: "3", entgelt_art: "stunde", entgelt_betrag: "14,50",
      zuschlaege: "Keine weiteren Bestandteile. Monatliches Entgelt höchstens bis zur Minijob-Grenze (2026: 603 €).", faelligkeit: "am letzten Bankarbeitstag des laufenden Monats", auszahlung: "Überweisung auf das von der beschäftigten Person benannte Konto",
      wochenstunden: "9,25", tage_pro_woche: "2", verteilung: "Montag und Donnerstag, 9–13 Uhr", pausen: "nach § 4 ArbZG: mindestens 30 Minuten bei mehr als sechs Stunden, 45 Minuten bei mehr als neun Stunden", ruhezeit: "nach § 5 ArbZG: mindestens elf Stunden ununterbrochen nach Ende der täglichen Arbeitszeit",
      ueberstunden: "nein", urlaub: "10", fortbildung: "Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht.", kuendigung_art: "gesetz", kollektiv: "keine", ausgestellt_am: "2025-08-25" }) });
  dok({ id: "fragebogen", vorlage: "sv_meldedaten", datum: "2025-08-25", worum: "Personalfragebogen Minijobberin (Personengruppe 109, unbefristet Teilzeit, Abitur, Studentin ohne Berufsabschluss, keine weitere Beschäftigung, RV-pflichtig).",
    daten: () => ({ ...personIn(v("sv_meldedaten"), m1), art: "minijob", personengruppe: "109", vertragsform: "2", stunden: "9,25", entgelt: "580,00", taetigkeit: "Packen und Versand", schulabschluss: "4", ausbildung: "1", weitere: false }) });
  dok({ id: "lohnkonto", vorlage: "lohnkonto", datum: "2026-12-31", worum: "Lohnkonto 2026 Minijob: 12 × 580,00 €, keine individuelle Lohnsteuer (einheitliche Pauschsteuer 2 % – in „SV AG“ enthalten, die Vorlage hat dafür keine Spalte), RV-Anteil Arbeitnehmerin 3,6 %, Pauschalabgaben 180,79 €. Steuerklasse bleibt leer (keine ELStAM bei Pauschsteuer).",
    daten: (h) => ({ ...personIn(v("lohnkonto"), m1), jahr: "2026", kinder: "", religion: "", monate: eintraege("lohnkonto", "monate", D.LOHN_MONATE.map((x) => ({ monat: x.monat, zahltag: x.zahltag, brutto: euro(x.brutto), lohnsteuer: "", soli: "", kirchensteuer: "", sv_an: euro(x.sv_an), sv_ag: euro(x.sv_ag), auszahlung: euro(x.brutto - x.sv_an) })), h) }) });
  const azn: Eintrag[] = ["2026-11-02", "2026-11-05", "2026-11-09", "2026-11-12", "2026-11-16", "2026-11-19", "2026-11-23", "2026-11-24", "2026-11-26", "2026-11-30"].map((datum) => ({ datum, beginn: "09:00", ende: "13:00", pause: "0", bemerkung: datum === "2026-11-24" ? "zusätzlicher Einsatz Weihnachtsversand" : "" }));
  dok({ id: "azn", vorlage: "arbeitszeitnachweis", datum: "2026-12-01", worum: "Arbeitszeitnachweis November 2026 (§ 17 MiLoG): 10 Einsätze à 4 Std. = 40 Std. × 14,50 € = 580,00 €.",
    daten: (h) => ({ name: m1.name, monat: "November 2026", leerzeilen: false, tage: eintraege("arbeitszeitnachweis", "tage", azn, h) }) });
  {
    const erg = v("arbeitszeitnachweis").ergebnis!(unterlage("azn").daten);
    vergleichText("Arbeitszeitnachweis November", "Arbeitszeit im Monat (40 Std. = 580 € / 14,50 €)", erg[0]?.[1] ?? "–", "40:00 h");
  }

  // ---------------------------------------------------------------- Arbeitsschutz: Werkstatt mit heißem Wachs, Lauge, ätherischen Ölen
  const GB_EIGENE: Eintrag[] = [
    { beschreibung: "Verbrennungen und Verbrühungen durch heißes Wachs (bis 85 °C) beim Schmelzen, Umfüllen und Gießen; Spritzer beim Kontakt mit Wasser.", massnahme: "Schmelzgerät mit Thermostat (b29), Gießkannen mit isoliertem Griff, hitzebeständige Handschuhe und Schürze; Wasser vom Gießplatz fernhalten; Gießen nur durch die Inhaberin.", risiko: "mittel", faktor: "arbeitsmittel" },
    { beschreibung: "Wachsbrand durch Überhitzung oder offene Flamme beim Abbrennen von Probekerzen.", massnahme: "Thermostat begrenzt auf 95 °C, Schmelzgerät nie unbeaufsichtigt; Deckel und Löschdecke griffbereit, Feuerlöscher für Fett- und Wachsbrände; brennendes Wachs nie mit Wasser löschen; Abbrandtests nur auf nicht brennbarer Unterlage.", risiko: "hoch", faktor: "einwirkungen" },
    { beschreibung: "Verätzung von Haut und Augen durch Natriumhydroxid (Ätznatron, H290, H314) beim Ansetzen der Lauge; starke Erwärmung und Dämpfe beim Lösen.", massnahme: "Lauge nur durch die Inhaberin ansetzen, immer Ätznatron ins Wasser (nie umgekehrt); Gesichtsschild bzw. Korbbrille, Chemikalienschutzhandschuhe (Nitril), langärmlig; Fenster offen bzw. Abzug; Augenspülflasche am Arbeitsplatz; Betriebsanweisung BA-01.", risiko: "hoch", faktor: "einwirkungen" },
    { beschreibung: "Hautsensibilisierung und Entzündbarkeit durch ätherische Öle und Duftöle (H226, H304, H315, H317, H411).", massnahme: "Abfüllen mit Nitrilhandschuhen, kleine Gebinde, kühl und fern von Zündquellen lagern; Betriebsanweisung BA-02.", risiko: "mittel", faktor: "einwirkungen" },
    { beschreibung: "Marktstand im Winter: Kälte, Nässe, langes Stehen, Auf- und Abbau mit Kisten bis 15 kg.", massnahme: "Thermomatte und Heizstrahler (geprüft), Pausen im Warmen, Sackkarre für den Transport, Auf- und Abbau zu zweit.", risiko: "gering", faktor: "arbeitsstaette" },
  ];
  dok({ id: "gb", vorlage: "gefaehrdungsbeurteilung", datum: "2026-01-12", worum: "Gefährdungsbeurteilung Werkstatt und Versand: 5 eigene Zeilen (heißes Wachs, Wachsbrand, Natronlauge, ätherische Öle, Marktstand) + 6 Vorschläge „Büro / Laden“ und „Handwerk“ (die App hat keine Vorschläge für Kerzen-/Seifenherstellung); Mutterschutz: Umgestaltung.",
    daten: (h) => ({ arbeitsbereich: "Werkstatt (Kerzen- und Seifenherstellung) und Versand", taetigkeiten: "Wachs schmelzen und gießen, Dochte setzen; Seifen kaltrühren (Laugenansatz mit Natriumhydroxid), in Formen gießen, schneiden und reifen lassen; Etikettieren; Packen und Versand; Auf- und Abbau am Marktstand", beschaeftigte: "2", beurteilt_von: "Lina Hoff", mitwirkung: "Beschäftigte des Bereichs\nFachkraft für Arbeitssicherheit", datum: "2026-01-12",
      gefaehrdungen: [
        ...eintraege("gefaehrdungsbeurteilung", "gefaehrdungen", GB_EIGENE.map((g) => ({ ...g, verantwortlich: "Lina Hoff", umsetzen_bis: "2026-02-28", umgesetzt_am: "2026-02-10" })), h),
        ...["Gesundheitsschäden durch Gefahrstoffe", "Schnittverletzungen beim Öffnen", "Belastung durch Heben, Tragen", "Stolpern, Ausrutschen", "Elektrische Gefährdung durch beschädigte", "Brandentstehung und unzureichende"].map((x) => vorschlag("gefaehrdungsbeurteilung", "gefaehrdungen", x, h, { verantwortlich: "Lina Hoff", umsetzen_bis: "2026-02-28", umgesetzt_am: "2026-02-10" })),
      ],
      mutterschutz_ergebnis: "umgestaltung", mutterschutz_details: "Kein Ansetzen von Natronlauge und kein Umgang mit H314-, H317- und H304-Stoffen; kein Gießen von heißem Wachs; kein Heben über 5 kg regelmäßig; Sitzgelegenheit beim Packen; kein Einsatz am Marktstand bei Kälte.",
      wirksamkeit: "wirksam", wirksamkeit_am: "2026-06-15", bemerkung: "Begehung mit der Fachkraft für Arbeitssicherheit (Unternehmermodell der BG) am 15.06.2026.", fortschreibung: "bei Änderungen von Tätigkeiten, Arbeitsmitteln oder Stoffen, nach Unfällen sowie jährlich" }) });

  dok({ id: "unterweisung", vorlage: "unterweisung", datum: "2026-01-12", worum: "Jährliche Unterweisung der Minijobberin (Erstunterweisung 01.09.2025): Gefährdungen am Arbeitsplatz, Erste Hilfe, Brandschutz (Wachsbrand), Stolpern, Elektrogeräte, Gefahrstoffe (keine Lauge!), Hautschutz, PSA, Heben und Tragen.",
    daten: (h) => ({ thema: "Jährliche Unterweisung Arbeitsschutz Werkstatt und Versand", anlass: "wiederholung", dauer: "45 Minuten", durchgefuehrt_von: "Lina Hoff",
      themen: ["gefaehrdungen_am_eigenen_arbeitsplatz_un", "erste_hilfe_ersthelfer_standort_verbandk", "brandschutz_verhalten_im_brandfall_umgan", "stolper_rutsch_und_sturzgefahren_ordnung", "elektrische_geraete_sichtpruefung_vor_be", "gefahrstoffe_inhalt_der_betriebsanweisun", "hautschutz_hautschutzplan_richtige_schut", "persoenliche_schutzausruestung_auswahl_b", "heben_und_tragen_hilfsmittel_rueckengere"],
      inhalt: "Natronlauge setzt nur die Inhaberin an; der Laugenplatz ist für die Minijobberin tabu. Brennendes Wachs nie mit Wasser löschen – Deckel bzw. Löschdecke. Verbandkasten und Augenspülflasche in der Werkstatt.", teilnehmer: eintraege("unterweisung", "teilnehmer", [{ name: m1.name }], h) }) });

  const STOFFE: Eintrag[] = [
    { bezeichnung: "Natriumhydroxid (Ätznatron) Plätzchen 99 %", hersteller: "Seifenrohstoffe Bremen GmbH", gefahren: "Gefahr; H290, H314 – verursacht schwere Verätzungen der Haut und schwere Augenschäden", menge: "10 bis 100 kg bzw. l", arbeitsbereich: "Werkstatt (Laugenplatz)", verwendung: "Laugenansatz für kaltgerührte Seife", sdb: "liegt_vor", sdb_stand: "2025-11-03" },
    { bezeichnung: "Lavendelöl fein, ätherisch", hersteller: "Aromaservice Lüneburg GmbH", gefahren: "Achtung; H315, H317, H319", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Werkstatt (Duftregal)", verwendung: "Beduftung von Seifen und Kerzen", sdb: "liegt_vor", sdb_stand: "2025-08-14" },
    { bezeichnung: "Orangenöl süß, ätherisch", hersteller: "Aromaservice Lüneburg GmbH", gefahren: "Gefahr; H226, H304, H315, H317, H410", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Werkstatt (Duftregal)", verwendung: "Beduftung von Seifen und Kerzen", sdb: "liegt_vor", sdb_stand: "2025-08-14" },
    { bezeichnung: "Eukalyptusöl, ätherisch", hersteller: "Aromaservice Lüneburg GmbH", gefahren: "Gefahr; H226, H304, H315, H317, H411", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Werkstatt (Duftregal)", verwendung: "Beduftung von Seifen", sdb: "liegt_vor", sdb_stand: "2025-08-14" },
    { bezeichnung: "Kerzenduftöl „Winterwald“ (Parfümölmischung)", hersteller: "Aromaservice Lüneburg GmbH", gefahren: "Achtung; H317, H411", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Werkstatt (Duftregal)", verwendung: "Beduftung von Kerzen", sdb: "fehlt" },
    { bezeichnung: "Isopropanol 99,9 %", hersteller: "Drogerie- und Laborbedarf (Handel)", gefahren: "Gefahr; H225, H319, H336 – leicht entzündbar", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Werkstatt", verwendung: "Reinigen von Gießformen und Arbeitsflächen, Glätten von Seifenoberflächen", sdb: "liegt_vor", sdb_stand: "2024-10-01" },
  ];
  dok({ id: "gefahrstoffe", vorlage: "gefahrstoffverzeichnis", datum: "2026-01-12", worum: "Gefahrstoffverzeichnis: Natriumhydroxid, drei ätherische Öle, Kerzenduftöl (Sicherheitsdatenblatt fehlt noch), Isopropanol.",
    daten: (h) => ({ stand: "2026-01-12", verantwortlich: "Lina Hoff", stoffe: eintraege("gefahrstoffverzeichnis", "stoffe", STOFFE, h) }) });

  dok({ id: "ba1", vorlage: "betriebsanweisung", datum: "2026-01-12", worum: "Betriebsanweisung BA-01 Natriumhydroxid (Ätznatron) beim Laugenansatz (H290, H314).",
    daten: () => ({ stoff: "Natriumhydroxid (Ätznatron) Plätzchen 99 % und daraus angesetzte Natronlauge", arbeitsbereich: "Werkstatt – Laugenplatz", nummer: "BA-01",
      gefahren: "Verursacht schwere Verätzungen der Haut und schwere Augenschäden (H314).\nKann gegenüber Metallen korrosiv sein (H290).\nBeim Lösen in Wasser starke Erwärmung; Dämpfe reizen die Atemwege.",
      schutz: "Nur die Inhaberin setzt Lauge an; Minijobberin und Besucher nicht am Laugenplatz.\nImmer Ätznatron langsam ins kalte Wasser geben, nie Wasser auf Ätznatron.\nGesichtsschild bzw. Korbbrille, Chemikalienschutzhandschuhe (Nitril, 0,4 mm), langärmlige Kleidung, Schürze.\nNur in Gefäßen aus Edelstahl oder PP ansetzen, nicht aus Aluminium.\nFenster öffnen bzw. Abzug einschalten; Dämpfe nicht einatmen.\nBehälter beschriften und verschlossen, für Kinder unzugänglich lagern.",
      gefahrfall: "Verschüttete Plätzchen trocken aufnehmen; verschüttete Lauge mit viel Wasser verdünnen und aufnehmen.\nBeschädigte Gebinde sofort umfüllen und kennzeichnen.",
      erste_hilfe: "Nach Augenkontakt: sofort mindestens 15 Minuten mit Wasser bzw. Augenspülflasche spülen, Augenarzt aufsuchen.\nNach Hautkontakt: verunreinigte Kleidung ausziehen, Haut sofort mit viel Wasser spülen; bei Beschwerden ärztlichen Rat einholen.\nNach Verschlucken: Mund ausspülen, Wasser trinken lassen, kein Erbrechen herbeiführen, sofort Arzt.\nSicherheitsdatenblatt zum Arzt mitnehmen.",
      entsorgung: "Laugenreste nicht in den Ausguss; mit Fett zu Seife verarbeiten oder als Sonderabfall über das Schadstoffmobil abgeben.\nLeere Gebinde ausspülen und über den Gelben Sack entsorgen.", notruf: "Notruf 112 – Giftinformationszentrum Nord (Göttingen) 0551 19240", erstellt_von: "Lina Hoff", datum: "2026-01-12" }) });
  dok({ id: "ba2", vorlage: "betriebsanweisung", datum: "2026-01-12", worum: "Betriebsanweisung BA-02 ätherische Öle und Duftöle (entzündbar, hautsensibilisierend, Aspirationsgefahr).",
    daten: () => ({ stoff: "Ätherische Öle (Lavendel, Orange, Eukalyptus) und Kerzenduftöl „Winterwald“", arbeitsbereich: "Werkstatt – Duftregal und Gießplatz", nummer: "BA-02",
      gefahren: "Flüssigkeit und Dampf entzündbar (H226).\nKann allergische Hautreaktionen verursachen (H317); verursacht Hautreizungen (H315).\nKann bei Verschlucken und Eindringen in die Atemwege tödlich sein (H304).\nGiftig für Wasserorganismen mit langfristiger Wirkung (H410, H411).",
      schutz: "Beim Abfüllen und Dosieren Nitrilhandschuhe tragen.\nVon Zündquellen und heißem Wachs über 70 °C fernhalten; Duftöl erst bei der Gießtemperatur zugeben.\nNur kleine Gebinde am Arbeitsplatz, Vorrat kühl und dunkel lagern.\nFür ausreichende Lüftung sorgen.",
      gefahrfall: "Verschüttetes mit Bindemittel aufnehmen; Zündquellen entfernen.\nBei Brand: Löschdecke bzw. Feuerlöscher, kein Wasserstrahl.",
      erste_hilfe: "Nach Hautkontakt: mit Wasser und Seife waschen; bei Hautreaktionen ärztlichen Rat einholen.\nNach Augenkontakt: mit viel Wasser spülen.\nNach Verschlucken: KEIN Erbrechen herbeiführen, sofort Arzt (Aspirationsgefahr).",
      entsorgung: "Reste nicht in den Ausguss; als Sonderabfall über das Schadstoffmobil.", notruf: "Notruf 112 – Giftinformationszentrum Nord (Göttingen) 0551 19240", erstellt_von: "Lina Hoff", datum: "2026-01-12" }) });

  dok({ id: "hautschutz", vorlage: "hautschutzplan", datum: "2026-01-12", worum: "Hautschutzplan Werkstatt mit eigenen Zeilen (Laugenansatz, Umgang mit ätherischen Ölen, Packen/Karton) – die Vorschläge der App gibt es nur für Friseure.",
    daten: (h) => ({ bereich: "Werkstatt und Versand", erstellt_von: "Lina Hoff", datum: "2026-01-12",
      eintraege: eintraege("hautschutzplan", "eintraege", [
        { anlass: "Laugenansatz und frische Seife schneiden (alkalisch)", schutz: "vor der Arbeit Hautschutzcreme auf Unterarme", handschuhe: "Chemikalienschutzhandschuhe Nitril 0,4 mm, Stulpe", reinigung: "milde, pH-hautneutrale Reinigung, gründlich abspülen", pflege: "rückfettende Pflegecreme nach der Arbeit" },
        { anlass: "Ätherische Öle und Duftöle abfüllen", schutz: "–", handschuhe: "Einmalhandschuhe Nitril, nach Kontakt wechseln", reinigung: "Hände mit Wasser und Seife waschen", pflege: "Pflegecreme" },
        { anlass: "Packen und Versand (Karton, Papierstaub)", schutz: "Hautschutzcreme bei trockener Haut", handschuhe: "bei Bedarf Baumwoll-Arbeitshandschuhe", reinigung: "Hände waschen", pflege: "Pflegecreme nach Arbeitsende" },
      ], h) }) });

  // ---------------------------------------------------------------- Kassenbuch Dezember (Marktkasse, offene Ladenkasse)
  {
    const tage = D.MARKT_DEZ_TAGE.map((betrag, i) => ({ datum: `2026-12-${String(i + 1).padStart(2, "0")}`, beleg: `ZP-${String(i + 1).padStart(2, "0")}`, text: "Tageseinnahmen Weihnachtsmarkt laut Zählprotokoll", einnahme: euro(betrag), ausgabe: "" }));
    const ein = D.KASSE_DEZ.einzahlungen.map((x, i) => ({ datum: x.datum, beleg: `EZ-${i + 1}`, text: "Einzahlung auf das Geschäftskonto (Haspa)", einnahme: "", ausgabe: euro(x.betrag) }));
    const alle = [...tage, ...ein].sort((a, b) => a.datum.localeCompare(b.datum) || (a.ausgabe ? 1 : -1));
    dok({ id: "kassenbuch", vorlage: "kassenbuch", datum: "2026-12-31", worum: "Kassenbuch Dezember 2026 der Marktkasse (offene Ladenkasse am Weihnachtsmarkt): 23 Tageseinnahmen laut Zählprotokoll, 4 Einzahlungen auf das Konto.",
      daten: (h) => ({ zeitraum: "Dezember 2026", anfang: euro(D.KASSE_DEZ.anfang), eintraege: eintraege("kassenbuch", "eintraege", alle, h) }) });
    const ende = D.KASSE_DEZ.anfang + D.MARKT["2026-12"]! - summe(D.KASSE_DEZ.einzahlungen.map((x) => x.betrag));
    const erg = v("kassenbuch").ergebnis?.(unterlage("kassenbuch").daten) ?? [];
    const z = erg.find((x) => /Endbestand|Bestand/.test(x[0]));
    if (z) vergleich("Kassenbuch Dezember", "Endbestand", ausEuro(z[1]), ende);
    const ez = erg.find((x) => /Einnahmen/.test(x[0]));
    if (ez) vergleich("Kassenbuch Dezember", "Summe Einnahmen = Marktumsatz Dezember (brutto)", ausEuro(ez[1]), D.MARKT["2026-12"]!);
  }

  // ---------------------------------------------------------------- Umsatzsteuer-Voranmeldungen (Soll: Übernahme + Shop/Markt von Hand)
  const erwartet = D.ustMonate();
  const ust: Bau["ust"] = [];
  for (const em of erwartet) {
    const id = `ust-${em.m}`;
    const tag = D.VA_TAG[em.m]!;
    const sh = D.shopMonat(em.m);
    let app: Record<string, string> = {};
    let anzahl = 0;
    let versteuerung = "";
    dok({ id, vorlage: "ust_voranmeldung", datum: tag, worum: `USt-Voranmeldung ${D.MONATE[Number(em.m.slice(5)) - 1]} 2026 (Soll): „Aus Rechnungen übernehmen“, danach von Hand: Shop Inland/EU vor der Schwelle ${euro(sh.netto19)} € und Markt ${euro(sh.marktNetto)} € netto zu umsatz_19${sh.doppelt ? ` (Shop-Bestellung #2391 herausgerechnet, sie steht als Rechnung 2026-011 in der App)` : ""}; § 13b ${em.kz46 ? `(Kz 46 ${euro(em.kz46)} €)` : ""} nur in der Notiz.`,
      daten: () => ({}),
      danach: (u) => {
        versteuerung = String(u.daten.versteuerung ?? "");
        const erg = umsaetzeFuer(s.unterlagen, em.m, s.betrieb, versteuerung === "ist" ? "ist" : "soll", s.belege, false);
        if (!erg) {
          auffaellig.push(`umsaetzeFuer(${em.m}) lieferte null.`);
          return;
        }
        app = erg.werte;
        anzahl = erg.anzahl;
        s = felderSetzen(s, id, erg.werte, t(tag, 9));
        const u19 = ausEuro(erg.werte.umsatz_19 ?? "0") + sh.netto19 + sh.marktNetto;
        const notiz = [
          `Aus Rechnungen übernommen (Amtlos, Soll): 19 % ${erg.werte.umsatz_19} €, Kz 41 (igL) ${erg.werte.umsatz_igl} €, weitere ohne USt ${erg.werte.umsatz_frei} €. Vorsteuer aus ${erg.vorsteuerBelege} Belegen.`,
          `Zuzüglich Shop-Umsätze laut Umsatzbericht (Inland und EU-Fernverkäufe vor der Schwelle, netto 19 %): ${euro(sh.netto19)} €; Marktkasse laut Kassenbuch: ${euro(sh.marktNetto)} €.`,
          em.kz46 ? `§ 13b UStG (Leistungen von Unternehmern aus Irland, ${em.b13.join(", ")}): Kz 46 ${euro(em.kz46)} €, Kz 47 ${euro(em.kz47)} €, Kz 67 ${euro(em.kz67)} € – in ELSTER zusätzlich eintragen.` : "",
          sh.ossBrutto ? `Fernverkäufe nach der Schwelle (${euro(sh.ossNetto)} € netto) gehören in die OSS-Erklärung, nicht hierher.` : "",
        ].filter(Boolean).join("\n");
        s = felderSetzen(s, id, { umsatz_19: euro(u19), notiz }, t(tag, 9));
      } });
    vergleichText(`USt ${em.m}`, "Versteuerungsart in der Voranmeldung (aus „Mein Betrieb“)", versteuerung, "soll");
    vergleich(`USt ${em.m} (Übernahme, Soll)`, "Umsätze 19 % aus Rechnungen", ausEuro(app.umsatz_19 ?? "0"), em.r19);
    vergleich(`USt ${em.m} (Übernahme, Soll)`, "Umsätze ohne USt aus Rechnungen = Kz 41 (igL)", ausEuro(app.umsatz_igl ?? "0"), em.kz41);
    vergleich(`USt ${em.m} (Übernahme aus Belegen)`, "Vorsteuer Kz 66 (nach Belegdatum)", ausEuro(app.vorsteuer ?? "0"), em.kz66);
    vergleichText(`USt ${em.m} (Übernahme, Soll)`, "zugeordnete Rechnungen/Stornos", String(anzahl), String(em.nummern.length));
    const erg = v("ust_voranmeldung").ergebnis!(unterlage(id).daten);
    vergleich(`USt ${em.m} (fertige Voranmeldung)`, "Kz 81 Bemessungsgrundlage 19 % (Rechnungen + Shop + Markt)", ausEuro(String(unterlage(id).daten.umsatz_19 ?? "0")), em.kz81);
    vergleich(`USt ${em.m} (fertige Voranmeldung)`, "Zahllast (mit Cent; § 13b gleicht sich aus)", ausEuro(erg[2]![1]) * (erg[2]![0] === "Erstattung" ? -1 : 1), em.zahllast);
    if (em.kz46) vergleichText(`USt ${em.m} (fertige Voranmeldung)`, `Kz 46/47/67 § 13b als Felder der Voranmeldung`, `${euro(ausEuro(app.rc_eu_netto ?? "0"))} / ${euro(ausEuro(app.rc_eu_steuer ?? "0"))} / ${euro(ausEuro(app.vorsteuer_13b ?? "0"))}`, `${euro(em.kz46)} / ${euro(em.kz47)} / ${euro(em.kz67)}`);
    ust.push({ m: em.m, app, appAnzahl: anzahl, final: Object.fromEntries(["umsatz_19", "umsatz_7", "umsatz_igl", "umsatz_48", "umsatz_13b", "umsatz_frei", "vorsteuer"].map((k) => [k, String(unterlage(id).daten[k] ?? "")])), zahllast: `${erg[2]![0]} ${erg[2]![1]}` });
  }
  infos.push(`Pflichten-Check: Kasse laut Profil „${kassenLage(s.profil)}“ – ohne elektronische Kasse sagt die App bei der USt-Übernahme nichts zu fehlenden Shop- und Marktumsätzen (kassenHinweis gibt null zurück bzw. nur „Falls du …“).`);

  // ---------------------------------------------------------------- OSS (gibt es in der App nicht – nur dokumentiert)
  const oss = D.ossQuartale();
  for (const q of oss) vergleichText(`OSS ${q.quartal}`, `Erklärung beim BZSt (${q.laender.map((z) => `${z.land} ${euro(z.netto)} € → ${euro(z.steuer)} €`).join(", ")}; Summe ${euro(q.steuer)} €)`, "keine Vorlage, keine Pflicht im Check", "Vorlage oder Pflicht");

  // ---------------------------------------------------------------- EÜR 2026 (Übernahme + Shop, Markt, OSS, USt-Zahlungen, AfA von Hand)
  const eu = D.euerUnabhaengig();
  let uebernahme!: ReturnType<typeof euerUebernahme>;
  const zahl = (l: Record<string, string>[], f: (x: Record<string, string>) => boolean) => l.filter(f).reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0);
  const ZEILE_PFL = "Umsatzsteuerpflichtige Betriebseinnahmen";
  const ZEILE_FREI = "Umsatzsteuerfreie, nicht umsatzsteuerbare Betriebseinnahmen sowie Betriebseinnahmen, für die der Leistungsempfänger die Umsatzsteuer nach § 13b UStG schuldet";
  const ZEILE_UST = "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben";
  const ZEILE_FA = "An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer";
  dok({ id: "euer", vorlage: "euer", datum: "2027-02-20", worum: "EÜR 2026: „Aus Rechnungen und Belegen übernehmen“ (euerUebernahme), danach von Hand: Shop-Umsätze (Inland/EU vor Schwelle, ohne #2391), OSS-Fernverkäufe (nicht steuerbar) und die darin vereinnahmte ausländische USt, Marktkasse, USt-Zahlungen an Finanzamt und BZSt, USt-Erstattungen, AfA.",
    daten: () => ({ jahr: "2026" }),
    danach: () => {
      uebernahme = euerUebernahme(s, "2026");
      vergleich("EÜR-Übernahme", "Rechnungen: steuerpflichtige Einnahmen netto (Zufluss 2026)", zahl(uebernahme.einnahmen, (x) => x.kategorie === ZEILE_PFL), eu.reNettoPflichtig);
      vergleich("EÜR-Übernahme", "Rechnungen: igL in Zeile „Umsatzsteuerfreie …“", zahl(uebernahme.einnahmen, (x) => x.kategorie === ZEILE_FREI), eu.reFrei);
      vergleich("EÜR-Übernahme", "Rechnungen: vereinnahmte Umsatzsteuer", zahl(uebernahme.einnahmen, (x) => x.kategorie === ZEILE_UST), eu.reUst);
      vergleich("EÜR-Übernahme", "Belege: Ausgaben ohne Vorsteuer und ohne Anlage", zahl(uebernahme.ausgaben, (x) => x.kategorie !== "Gezahlte Vorsteuerbeträge"), eu.ausgabenBelege);
      vergleich("EÜR-Übernahme", "Belege: gezahlte Vorsteuer", zahl(uebernahme.ausgaben, (x) => x.kategorie === "Gezahlte Vorsteuerbeträge"), eu.vorsteuer);
      vergleichText("EÜR-Übernahme", "Anlagegüter erkannt (Wachsschmelzgerät)", String(uebernahme.anlagen), "1");
      vergleichText("EÜR-Übernahme", "Hinweis nennt fehlende Shop-/Markt-/OSS-Umsätze", /Shop|Kasse|Markt|OSS|Plattform/.test(uebernahme.hinweis) ? "ja" : "nein", "ja");
      const anlage = D.BELEGE.find((b) => b.id === D.AFA.beleg)!;
      s = felderSetzen(s, "euer", {
        jahr: "2026",
        einnahmen: [
          ...uebernahme.einnahmen,
          { datum: "", text: "Shop-Umsätze Inland und EU vor der Schwelle laut Umsatzberichten (netto, ohne Bestellung #2391)", kategorie: ZEILE_PFL, betrag: euro(eu.shopNetto19) },
          { datum: "", text: "Marktkasse laut Kassenbuch (netto)", kategorie: ZEILE_PFL, betrag: euro(eu.marktNetto) },
          { datum: "", text: "EU-Fernverkäufe nach der Schwelle (OSS, in Deutschland nicht steuerbar), netto", kategorie: ZEILE_FREI, betrag: euro(eu.ossNetto) },
          { datum: "", text: "Umsatzsteuer aus Shop und Markt (19 %)", kategorie: ZEILE_UST, betrag: euro(eu.shopUst19 + eu.marktUst) },
          { datum: "", text: "Vereinnahmte ausländische Umsatzsteuer (OSS: AT, NL, FR, BE)", kategorie: ZEILE_UST, betrag: euro(eu.ossUst) },
          { datum: "", text: "Erstattungen aus Umsatzsteuer-Voranmeldungen (März, September, Oktober)", kategorie: "Vom Finanzamt erstattete und gegebenenfalls verrechnete Umsatzsteuer", betrag: euro(eu.vaErstattet) },
        ],
        ausgaben: [
          ...uebernahme.ausgaben,
          { datum: "", text: "Umsatzsteuer-Vorauszahlungen (Dezember 2025 und Januar–November 2026)", kategorie: ZEILE_FA, betrag: euro(eu.vaGezahlt) },
          { datum: "2026-10-28", text: "OSS-Zahlung Q3/2026 an das BZSt", kategorie: ZEILE_FA, betrag: euro(eu.ossGezahlt) },
        ],
        afa: [
          { text: `Wachsschmelzgerät (${euro(D.belegSumme(anlage).netto)} € netto, 02/2026, ${D.AFA.jahre} Jahre, ${D.AFA.monate}/12)`, betrag: euro(eu.afaNeu) },
          { text: "AfA Altbestand laut Anlagenverzeichnis", betrag: euro(D.AFA.altbestand) },
        ],
      }, t("2027-02-20", 10));
    } });
  const euerErgebnis = v("euer").ergebnis!(unterlage("euer").daten);
  {
    const g = euerErgebnis.find((z) => z[0] === "Gewinn" || z[0] === "Verlust")!;
    vergleich("EÜR 2026 (fertig)", "Summe Betriebseinnahmen", ausEuro(euerErgebnis[0]![1]), eu.einnahmen);
    vergleich("EÜR 2026 (fertig)", "Summe Betriebsausgaben (ohne AfA)", ausEuro(euerErgebnis[1]![1]), eu.ausgaben);
    vergleich("EÜR 2026 (fertig)", "AfA", ausEuro(euerErgebnis[2]![1]), eu.afa);
    vergleich("EÜR 2026 (fertig)", "Gewinn", ausEuro(g[1]) * (g[0] === "Verlust" ? -1 : 1), eu.gewinn);
    const vorschlaegeEin = (feld("euer", "einnahmen").felder.find((f) => f.id === "kategorie") as { vorschlaege?: string[] }).vorschlaege ?? [];
    const fehlendeZeilen = [...new Set((unterlage("euer").daten.einnahmen as Eintrag[]).map((x) => String(x.kategorie ?? "")))].filter((k) => k && !vorschlaegeEin.includes(k));
    vergleichText("EÜR 2026 (fertig)", "alle verwendeten Einnahme-Zeilen stehen in der Vorschlagsliste", fehlendeZeilen.join(" | ") || "alle", "alle");
  }

  // ---------------------------------------------------------------- Steuererklärung (Zusammenstellung)
  const vaSumme = (k: string) => erwartet.reduce((a, em) => a + ausEuro(String(unterlage(`ust-${em.m}`).daten[k] ?? "0")), 0);
  const ustJahr = erwartet.reduce((a, em) => a + ausEuro(v("ust_voranmeldung").ergebnis!(unterlage(`ust-${em.m}`).daten)[0]![1]), 0);
  const gewinnZeile = euerErgebnis.find((z) => z[0] === "Gewinn" || z[0] === "Verlust")!;
  dok({ id: "steuer", vorlage: "steuererklaerung", datum: "2027-03-15", worum: "Zusammenstellung für ESt (Anlage G, EÜR), GewSt und USt 2026: Gewinn aus der EÜR, Umsatz/USt/Vorsteuer als Summe der zwölf Voranmeldungen der App (ohne § 13b, ohne OSS), ESt-Vorauszahlungen 4 × 2.400 €, GewSt 4 × 650 €.",
    daten: (h) => ({ jahr: "2026", arten: ["est", "gewst", "ust"], gewinn: gewinnZeile[1].replace(/\s*€$/, ""), umsatz: euro(vaSumme("umsatz_19") + vaSumme("umsatz_7") + (vaSumme("umsatz_frei") + vaSumme("umsatz_igl") + vaSumme("umsatz_48") + vaSumme("umsatz_13b"))), ust_jahr: euro(ustJahr), vorsteuer_jahr: euro(vaSumme("vorsteuer") + vaSumme("vorsteuer_13b")),
      vorauszahlungen: eintraege("steuererklaerung", "vorauszahlungen", [...[1, 2, 3, 4].map((q) => ({ art: `Einkommensteuer Q${q}`, betrag: "2.400,00" })), ...[1, 2, 3, 4].map((q) => ({ art: `Gewerbesteuer Q${q}`, betrag: "650,00" }))], h),
      weiteres: eintraege("steuererklaerung", "weiteres", [{ was: "Kranken- und Pflegeversicherung (freiwillig gesetzlich)", betrag: "5.880,00", beleg: true }, { was: "OSS-Erklärungen Q3/Q4 2026 (BZSt): ausländische USt, nicht Teil der deutschen USt-Erklärung", betrag: euro(summe(oss.map((q) => q.steuer))), beleg: true }, { was: "Zusammenfassende Meldungen Q1 und Q3 (igL Österreich)", betrag: euro(D.jahresSummen().kz41), beleg: true }], h),
      notiz: `Umsatzsteuer nach vereinbarten Entgelten. In der Jahreserklärung zusätzlich § 13b: Bemessungsgrundlage ${euro(D.jahresSummen().kz46)} €, Steuer ${euro(D.jahresSummen().kz47)} € und gleich hohe Vorsteuer (in den Feldern oben nicht enthalten).` }) });
  {
    const j = D.jahresSummen();
    vergleich("Steuererklärung", "Gewinn = EÜR (unabhängig)", ausEuro(String(unterlage("steuer").daten.gewinn ?? "0")), eu.gewinn);
    vergleich("Steuererklärung", "Umsätze im Jahr (Inland 19 % + igL, Summe der Voranmeldungen)", vaSumme("umsatz_19") + (vaSumme("umsatz_frei") + vaSumme("umsatz_igl") + vaSumme("umsatz_48") + vaSumme("umsatz_13b")), j.kz81 + j.kz41);
    vergleich("Steuererklärung", "Umsatzsteuer im Jahr inkl. § 13b (Summe der Voranmeldungen)", ustJahr, j.ust);
    vergleich("Steuererklärung", "Vorsteuer im Jahr inkl. § 13b (Kz 66 + Kz 67)", vaSumme("vorsteuer") + vaSumme("vorsteuer_13b"), j.kz66 + j.kz67);
  }

  // ---------------------------------------------------------------- Varianten (eigener Stand, ändern den Hauptstand nicht)
  {
    // Teil-Retoure eines Händlers als „Gutschrift“ (so heißt es im Handel) – was macht die App daraus?
    let sv = s;
    const [s1] = anlegen(sv, "rechnung", t("2026-12-10", 9), "var-gutschrift");
    sv = felderSetzen(s1, "var-gutschrift", { ...personIn(v("rechnung"), s.kunden.find((k) => k.id === "k1")!), datum: "2026-12-10", leistung_gleich: true, zahlungsziel: "sofort", positionen: [{ bezeichnung: `Rücknahme ${12} Duftkerzen aus Rechnung 2026-016 (Glasbruch)`, menge: "12", einheit: "Stück", preis: "11,20", satz: "19" }], hinweise: ["gutschrift"], hinweis: "Wir schreiben Ihnen den Betrag gut." }, t("2026-12-10", 9));
    sv = ausgeben(sv, "var-gutschrift", t("2026-12-10", 10));
    const vorher = umsaetzeFuer(s.unterlagen, "2026-12", s.betrieb, "soll", s.belege, false)!;
    const nachher = umsaetzeFuer(sv.unterlagen, "2026-12", sv.betrieb, "soll", sv.belege, false)!;
    varianten.push({ titel: "Teil-Retoure Hafenliebe (12 Kerzen à 11,20 €) als Rechnung mit Hinweis „Gutschrift“", ergebnis: `umsatz_19 Dezember vorher ${vorher.werte.umsatz_19} €, nachher ${nachher.werte.umsatz_19} € (gutschriften: ${nachher.gutschriften}) – erwartet wäre eine Minderung um 134,40 € (§ 17 UStG). Die App behandelt „Gutschrift“ als Abrechnung des Leistungsempfängers (§ 14 Abs. 2 Satz 2 UStG) und lässt sie aus; für eine Teil-Rechnungskorrektur gibt es nur „Stornieren“ (ganze Rechnung) – oder eine negative Rechnung, die die Prüfung („Rechnungsbetrag ist negativ“) anmahnt.` });
    // Rechnung an eine Verbraucherin in Österreich nach der Schwelle: 20 % österreichische USt
    const saetze = (feld("rechnung", "positionen").felder.find((f) => f.id === "satz") as { optionen?: { wert: string }[] }).optionen?.map((o) => o.wert) ?? [];
    varianten.push({ titel: "Rechnung auf Wunsch an eine Verbraucherin in Wien nach der Schwelle (österreichische USt 20 %)", ergebnis: `Steuersätze der Rechnung: ${saetze.join(", ")} % – 20 % (AT), 21 % (NL/BE) usw. sind nicht wählbar; eine korrekte Rechnung über einen OSS-Fernverkauf lässt sich nicht schreiben.` });
    // Pflichten-Check ohne Branche „Beauty und Kosmetik“ (Seife als Produkt, Branche nur „Onlinehandel“)
    const ohneBeauty = auswertung({ ...PROFIL, "taetigkeit.branchen": ["onlinehandel"] }, "2026-01-15", []);
    const da = (id: string) => (ohneBeauty.gilt.some((p) => p.id === id) ? "gilt" : "fehlt");
    varianten.push({ titel: "Pflichten-Check, wenn die Inhaberin als Branche nur „Onlinehandel“ wählt (Produkte weiter „Kosmetik“)", ergebnis: `Kosmetikverordnung: ${da("branche.beauty_kosmetikverordnung")}, Hygieneplan: ${da("branche.beauty_hygieneplan")}, Hautschutzplan: ${da("branche.beauty_hautschutzplan")}, GPSR: ${da("produkte.gpsr")}, Verpackung: ${da("produkte.verpackung")}.` });
    // Markt als „Über Marktplätze“ gelesen
    const markt = auswertung({ ...PROFIL, "vertrieb.kanaele": ["onlineshop", "marktplatz"] }, "2026-01-15", []);
    const neu = markt.gilt.filter((p) => !auswertung(PROFIL, "2026-01-15", []).gilt.some((x) => x.id === p.id)).map((p) => p.id);
    varianten.push({ titel: "Pflichten-Check, wenn die Inhaberin ihre Marktstände unter „Über Marktplätze“ ankreuzt", ergebnis: `zusätzliche Pflichten: ${neu.join(", ") || "keine"} – die Option meint Online-Marktplätze; für Markt-, Messe- oder Weihnachtsmarktstände (offene Ladenkasse) gibt es keine Antwort.` });
  }

  // ---------------------------------------------------------------- übersprungene Vorlagen
  uebersprungen.push(
    { id: "bilanz_guv", titel: v("bilanz_guv").titel, grund: "Einzelunternehmen ohne Handelsregistereintrag unter den Grenzen des § 141 AO – Gewinnermittlung durch EÜR." },
    { id: "kassenmeldung", titel: v("kassenmeldung").titel, grund: "Keine elektronische Kasse (offene Ladenkasse am Markt)." },
    { id: "gewerbeanmeldung", titel: v("gewerbeanmeldung").titel, grund: "Gewerbe seit 2023 angemeldet; nicht Teil des Jahres 2026." },
    { id: "handelsregister", titel: v("handelsregister").titel, grund: "Einzelunternehmen ohne Eintragung." },
    { id: "transparenzregister", titel: v("transparenzregister").titel, grund: "Keine Gesellschaft." },
    { id: "datenpanne", titel: v("datenpanne").titel, grund: "Im Jahr 2026 gab es keine Datenpanne." },
    { id: "ki_kompetenz", titel: v("ki_kompetenz").titel, grund: "Profil: keine KI-Werkzeuge im Betrieb." },
    { id: "pruefprotokoll_elektro", titel: v("pruefprotokoll_elektro").titel, grund: "Nicht beauftragt (Prüfung der Geräte durch Elektrofachkraft im Szenario nicht modelliert)." },
    { id: "hygieneplan", titel: v("hygieneplan").titel, grund: "Vorlage und Vorschläge für Beauty-Studios (Instrumente, Behandlung, IfSG); für die Herstellung von Kosmetik gilt die gute Herstellungspraxis (Art. 8 VO (EG) Nr. 1223/2009) – passt nicht (siehe Auffälligkeiten)." },
    { id: "ifsg_belehrung", titel: v("ifsg_belehrung").titel, grund: "Kein Lebensmittelbetrieb." },
    { id: "allergene", titel: v("allergene").titel, grund: "Kein Lebensmittelbetrieb." },
    { id: "haccp", titel: v("haccp").titel, grund: "Kein Lebensmittelbetrieb." },
  );
  const genutzt = new Set(docs.map((d) => d.vorlage));
  for (const vl of VORLAGEN) if (!genutzt.has(vl.id) && !uebersprungen.some((u) => u.id === vl.id)) auffaellig.push(`Vorlage ${vl.id} weder erzeugt noch als übersprungen begründet.`);

  // ---------------------------------------------------------------- Pflichten-Check der App für diesen Betrieb
  const stichtag = "2026-01-15";
  const a = auswertung(s.profil, stichtag, s.unterlagen.filter((u) => (u.ausgegeben ?? "") < "2026-01-16"));
  const zeile = (p: PflichtInfo): PflichtZeile => ({ id: p.id, titel: p.titel, vorlage: p.vorlage, vorlagen: p.vorlagen, erzeugt: p.vorlagen.some((x) => genutzt.has(x)), termin: p.naechsterTermin, termine: p.termine.length, grund: p.grund, schwere: p.schwere, rechtsgrundlage: p.rechtsgrundlage.join("; ") });
  const pflichten = { stichtag, gilt: a.gilt.map(zeile), gruendung: a.gruendung.map(zeile), unbekannt: a.unbekannt.map((p) => ({ id: p.id, titel: p.titel, fragen: p.offeneFragen })) };
  const istDa = (id: string) => (a.gilt.some((p) => p.id === id) ? "gilt" : a.gruendung.some((p) => p.id === id) ? "gilt" : a.unbekannt.some((p) => p.id === id) ? "unklar" : "fehlt");
  // Erwartung aus dem Profil (nur Pflichten, die der Katalog kennt; neue Pflichten stehen unter „Auffälligkeiten“)
  const ERWARTET: [string, "gilt" | "fehlt", string][] = [
    ["steuern.euer", "gilt", "Einzelunternehmen, nicht buchführungspflichtig"],
    ["steuern.est_erklaerung", "gilt", "Einkommensteuer"],
    ["steuern.gewst_erklaerung", "gilt", "Gewerbe"],
    ["steuern.ust_voranmeldung", "gilt", "monatlich (Zahllast Vorjahr 14.200 €)"],
    ["steuern.ust_jahreserklaerung", "gilt", "§ 18 Abs. 3 UStG"],
    ["steuern.zusammenfassende_meldung", "gilt", "igL an Unternehmen in Österreich (§ 18a UStG)"],
    ["steuern.buchfuehrungspflicht", "fehlt", "unter den Grenzen des § 141 AO"],
    ["steuern.kassenmeldung", "fehlt", "keine elektronische Kasse"],
    ["online.impressum", "gilt", "Website/Shop"],
    ["online.datenschutzerklaerung", "gilt", "Website/Shop"],
    ["online.cookie_einwilligung", "gilt", "Tracking (Meta-Pixel)"],
    ["online.widerrufsbelehrung", "gilt", "Fernabsatz an Verbraucher"],
    ["online.button_loesung", "gilt", "Bestellbutton § 312j BGB"],
    ["online.preisangaben", "gilt", "PAngV (Grundpreis bei Seife nach Gewicht)"],
    ["online.vsbg_hinweis", "fehlt", "nur 1 Beschäftigte (§ 36 Abs. 3 VSBG)"],
    ["online.barrierefreiheit", "fehlt", "Kleinstunternehmen (1 Beschäftigte, < 2 Mio. €) – Dienstleistungs-Ausnahme BFSG"],
    ["produkte.verpackung", "gilt", "VerpackG (LUCID, Systembeteiligung)"],
    ["produkte.gpsr", "gilt", "Verbraucherprodukte (Kerzen)"],
    ["branche.beauty_kosmetikverordnung", "gilt", "eigene kosmetische Mittel (Seife)"],
    ["produkte.batterien", "fehlt", "keine Batterien"],
    ["produkte.elektrogeraete", "fehlt", "keine Elektrogeräte"],
    ["personal.minijob_grenze", "gilt", "Minijob"],
    ["personal.arbeitszeit_milog", "gilt", "Minijob (§ 17 MiLoG)"],
    ["personal.sofortmeldung", "fehlt", "keine § 2a-SchwarzArbG-Branche"],
    ["arbeitsschutz.gefaehrdungsbeurteilung", "gilt", "1 Beschäftigte"],
    ["arbeitsschutz.gefahrstoffe", "gilt", "Natriumhydroxid, ätherische Öle"],
    ["datenschutz.avv", "gilt", "Shop-System, Newsletter"],
    ["datenschutz.vvt", "gilt", "Kunden- und Beschäftigtendaten"],
  ];
  for (const [id, soll, warum] of ERWARTET) vergleichText(`Pflichten-Check (${D.de(stichtag)})`, `${id} (${warum})`, istDa(id), soll);
  const termin = (id: string) => [...a.gilt, ...a.gruendung].find((p) => p.id === id)?.naechsterTermin ?? "–";
  vergleichText(`Pflichten-Check (${D.de(stichtag)})`, "USt-Voranmeldung: nächster Termin (monatlich, Januar → 10.02.2026)", termin("steuern.ust_voranmeldung"), "2026-02-10");
  // R11 (Steuerprüfung 16): mit Warenlieferungen rechnet der Katalog mit dem monatlichen Termin (25.) – die Wahl „vierteljährlich bei
  // igL bis 50.000 € je Quartal“ fragt die App nicht ab; nur sonstige Leistungen wären immer vierteljährlich
  vergleichText(`Pflichten-Check (${D.de(stichtag)})`, "Zusammenfassende Meldung: nächster Termin (monatlich am 25., verschoben auf Montag 26.01.2026; vierteljährlich 27.04.2026 wäre bei igL bis 50.000 € je Quartal zulässig, § 18a Abs. 1 UStG)", termin("steuern.zusammenfassende_meldung"), "2026-01-26");
  {
    const sommer = auswertung(s.profil, "2026-07-01", s.unterlagen.filter((u) => (u.ausgegeben ?? "") < "2026-07-02"));
    vergleichText("Pflichten-Check (01.07.2026)", "online.widerrufsbutton (gilt ab 19.06.2026)", sommer.gilt.some((p) => p.id === "online.widerrufsbutton") ? "gilt" : "fehlt", "gilt");
    vergleichText(`Pflichten-Check (${D.de(stichtag)})`, "Widerrufsbutton als kommende Pflicht im 12-Monats-Blick (ab 19.06.2026)", [...a.gilt, ...a.gruendung, ...a.kommend].some((p) => p.id === "online.widerrufsbutton") ? "angekündigt" : "nicht sichtbar", "angekündigt");
  }
  const lst = [...a.gilt, ...a.gruendung, ...a.unbekannt].find((p) => p.id === "personal.lohnsteuer_anmeldung");
  infos.push(`Pflichten-Check: „Lohnsteuer-Anmeldung“ ${lst ? `erscheint (${a.unbekannt.some((p) => p.id === lst.id) ? "unklar" : "gilt"}, Grund: ${(lst as PflichtInfo).grund ?? ""})` : "erscheint nicht"} – bei einem einzigen Minijob mit einheitlicher Pauschsteuer (2 %) geht die Steuer an die Minijob-Zentrale, eine Lohnsteuer-Anmeldung beim Finanzamt fällt dafür nicht an.`);
  for (const p of pflichten.gilt) if (p.vorlagen.length && !p.erzeugt && !uebersprungen.some((u) => p.vorlagen.includes(u.id))) infos.push(`Pflichten-Check: „${p.titel}“ gilt, keine der Vorlagen (${p.vorlagen.join(", ")}) wurde im Szenario erzeugt.`);

  return { s, docs, auffaellig, infos, belegDateien, xmls, ohneXml, vergleiche, ust, euer: { uebernahme, ergebnis: euerErgebnis }, uebersprungen, pflichten, varianten };
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

/** Kontrollmappe wie die Seite „Kontrollmappe“: Auswahl der App, Reihenfolge der App */
export function mappe(s: Stand) {
  const a = mappenAuswahl(s);
  return { ...a, html: a.eintraege.map((e) => ({ e, html: dokHtml(s, e.id), quer: !!vorlageFuer(e.vorlage)?.querformat, datei: pdfDateiname(vorlageFuer(e.vorlage)!, s.unterlagen.find((u) => u.id === e.id)!.daten, "2026-12-31") })) };
}

/** Steuerberater-Pakete für November 2026 (Weihnachtsgeschäft, § 13b Meta, Rechnung mit Leistung November) und das Jahr */
export function pakete(s: Stand, dateien: Record<string, Uint8Array>): { monat: PaketErgebnis; jahr: PaketErgebnis } {
  const sb = s.steuerberatung;
  return {
    monat: steuerpaket(s, { von: "2026-11-01", bis: "2026-11-30", name: "2026-11" }, sb, dateien, "2026-12-07T09:30:00"),
    jahr: steuerpaket(s, { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, sb, dateien, "2027-02-15T10:00:00"),
  };
}

// ---------------------------------------------------------------- Belegdateien (so, wie die Lieferanten sie ausstellen würden)

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function belegHtml(b: D.BelegRoh): string {
  const sm = D.belegSumme(b);
  const zeilenAnschrift = b.anschrift.split("\n");
  const bon = b.art === "brutto" && b.zahlung !== "bank";
  const eigen = b.kategorie === "personal";
  const kopf = `<div class="lief"><strong>${esc(b.lieferant)}</strong><br>${zeilenAnschrift.map(esc).join("<br>")}</div>`;
  const zeilen = b.pos.map((x) => `<tr><td>${esc(x.text)}${x.menge ? `<br><small>${esc(x.menge)}</small>` : ""}</td><td class="r">${x.satz} %</td><td class="r">${D.eur(x.betrag)} €</td></tr>`).join("");
  const steuer = sm.jeSatz.map((x) => `<tr><td>${x.satz ? `${b.art === "brutto" ? "enth. " : ""}USt ${x.satz} %` : b.p13b ? "Reverse Charge – VAT 0 %" : "ohne USt"}</td><td class="r">netto ${D.eur(x.netto)} €</td><td class="r">${x.satz ? `${D.eur(x.ust)} €` : "–"}</td></tr>`).join("");
  const css = `body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#222;margin:0}.blatt{${bon ? "width:80mm;margin:10mm auto;border:1px dashed #999;padding:6mm" : "margin:18mm 20mm"}}table{width:100%;border-collapse:collapse;margin-top:6mm}td,th{padding:3px 4px;border-bottom:1px solid #ddd;vertical-align:top}th{text-align:left;border-bottom:2px solid #444}.r{text-align:right;white-space:nowrap}.lief{font-size:${bon ? "10pt" : "11pt"}}h1{font-size:${bon ? "13pt" : "18pt"};margin:6mm 0 2mm}.an{margin-top:10mm}.summe td{font-weight:bold;border-top:2px solid #444}small{color:#666}`;
  const titel = eigen ? "Lohnjournal (Eigenbeleg)" : bon ? "Kassenbon" : b.p13b ? "Invoice / Rechnung" : b.kategorie === "versicherungen" ? "Beitragsrechnung" : b.frei ? "Gebührenübersicht" : "Rechnung";
  const an = bon || eigen ? "" : `<div class="an">${esc(D.BETRIEB.name)}<br>Lina Hoff<br>${esc(D.BETRIEB.strasse)}<br>${D.BETRIEB.plz} ${D.BETRIEB.ort}${b.p13b || b.frei ? "<br>Deutschland<br>VAT ID: DE347215896" : ""}</div>`;
  const fuss = b.zahlung === "bar" ? "Bar bezahlt." : b.zahlung === "privat" ? "Mit EC-Karte bezahlt (Privatkonto der Inhaberin)." : eigen ? "Überweisungen laut Abrechnung." : b.p13b ? "Reverse charge: VAT to be accounted for by the recipient (Art. 196 Council Directive 2006/112/EC). Steuerschuldnerschaft des Leistungsempfängers." : b.frei ? "Mit den Zahlungseingängen verrechnet. Finanzdienstleistung – ohne Umsatzsteuer." : "Zahlbar per Überweisung bzw. SEPA-Lastschrift.";
  const steuerNr = !bon && !eigen && !b.p13b && !b.frei && b.kategorie !== "versicherungen" ? ` Steuernummer des Lieferanten: 2${b.id.slice(1)}/8${b.id.slice(1)}/1${b.id.slice(1)}47.` : b.p13b ? ` VAT ID of supplier: IE9${b.id.slice(1)}2287${b.id.slice(2)}W.` : "";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="blatt">${kopf}${an}
<h1>${titel}${b.nummer ? ` ${esc(b.nummer)}` : ""}</h1><div>Datum: ${D.de(b.datum)}${!bon && !eigen ? " · Leistung: laut Positionen" : ""}</div>
<table><tr><th>${bon ? "Artikel" : "Position"}</th><th class="r">USt</th><th class="r">${bon ? "Brutto" : b.art === "netto" ? "Netto" : "Betrag"}</th></tr>${zeilen}</table>
<table>${steuer}<tr class="summe"><td>${bon ? "SUMME" : eigen ? "Summe Personalkosten" : "Rechnungsbetrag"}</td><td></td><td class="r">${D.eur(sm.brutto)} €</td></tr></table>
<p><small>${fuss}${steuerNr}</small></p></div></body></html>`;
}
