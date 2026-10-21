/**
 * Jahres-Szenario „Elektro Brandt“ 2026 – der App-Ablauf: Der Stand entsteht mit denselben Funktionen wie in der App
 * (anlegen → felderSetzen → ausgeben/festschreiben → stornieren, kopieren für die Ersatzrechnung, bezahltSetzen,
 * belegSetzen, E-Rechnung einlesen, umsaetzeFuer (Soll), euerUebernahme, steuerpaket, Zahlungserinnerung, Kontrollmappe,
 * Pflichten-Check). Rohdaten und die unabhängig gerechneten Erwartungswerte stehen in jahr-szenario-elektro-daten.ts;
 * hier wird verglichen und jede Abweichung als Auffälligkeit gesammelt.
 *
 * Gebündelt und ausgeführt von werkzeuge/jahr-szenario-elektro.mjs (Chromium für die PDFs).
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
import { LEERER_STAND, anlegen, ausgeben, belegSetzen, bezahltSetzen, felderSetzen, kopieren, offenerBetrag, zahlungVermerken, personSetzen, profilSetzen, steuerberatungSetzen, stornieren, type Stand, type Unterlage } from "../src/unterlagen/speicher";
import { euerUebernahme, steuerpaket, type PaketErgebnis } from "../src/unterlagen/steuerpaket";
import { offeneRechnungen, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { euroText, faelligAm, offeneIds, rechnungBrutto, tageUeberfaellig } from "../src/unterlagen/ablage";
import { deckblattHtml, mappeDateiname, mappeZusammenfuegen, mappenAuswahl, seitenzahl, startSeiten, type MappenEintrag } from "../src/unterlagen/kontrollmappe";
import { fussAngaben, fusszeileStempeln } from "../src/unterlagen/fusszeile";
import { mitSchriften } from "../src/unterlagen/schriften";
import { auswertung, type PflichtInfo, type Profil } from "../src/pflichten/check";
import { T as TEXT } from "../src/texte";
import * as D from "./jahr-szenario-elektro-daten";
import { MARKE } from "@amtlos/marke";

export { RAENDER, fussAngaben, fusszeileStempeln, mitSchriften, unzipSync, D, deckblattHtml, mappeDateiname, mappeZusammenfuegen, seitenzahl, startSeiten };

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

interface PflichtZeile { id: string; titel: string; vorlage: string | null; vorlagen: string[]; erzeugt: boolean; termin: string | null; termine: number; grund: string; erklaerung: string }

export interface Bau {
  s: Stand;
  docs: Dok[];
  auffaellig: string[];
  infos: string[];
  belegDateien: { datei: string; html?: string; xml?: string }[];
  xmls: { datei: string; xml: string; nummer: string }[];
  ohneXml: { nummer: string; fehlt: string[] }[];
  vergleiche: { bereich: string; was: string; app: string; erwartet: string; ok: boolean }[];
  ust: { q: string; app: Record<string, string>; appAnzahl: number; ersatz: number; final: Record<string, string> }[];
  euer: { uebernahme: ReturnType<typeof euerUebernahme>; ergebnis: [string, string][] };
  erinnerung: { nummer: string; heute: string; text: string; faellig: string | null; tage: number };
  mappe: { eintraege: MappenEintrag[]; unvollstaendig: number; erwartet: string[] };
  uebersprungen: { id: string; titel: string; grund: string }[];
  pflichten: { stichtag: string; gilt: PflichtZeile[]; gruendung: PflichtZeile[]; unbekannt: { titel: string; fragen: string[] }[]; variante: { neu: PflichtZeile[]; weg: string[] } };
}

/** Profil für den Pflichten-Check (Elektro-Meisterbetrieb, Einzelunternehmen, Dortmund) */
export const PROFIL: Profil = {
  "taetigkeit.branchen": ["handwerk"],
  rechtsform: "einzelunternehmen",
  "taetigkeit.einordnung": "gewerbe",
  erwerb: "haupt",
  "handwerk.anlage": "a",
  "erlaubnis.gewo_paragraphen": ["keine"],
  "erlaubnis.gaststaette": false,
  "rentenversicherung.pflichtgruppe": ["handwerk_rolle"],
  bundesland: "NW",
  gemeinde_ags: "05913000",
  "betriebsstaetten.anzahl": 1,
  gruendungsdatum: D.GRUENDUNG,
  alg1_bezug: false,
  "beschaeftigte.gesamt": 3,
  "beschaeftigte.minijob": 0,
  "beschaeftigte.azubi": 1,
  "beschaeftigte.jugendlich": 1,
  "personal.sofortmeldebranchen": ["keine"],
  "personal.lohnsteuer_anmeldezeitraum": "monatlich",
  // seit r9 gefragt: Bauleistungen für andere Unternehmen (Bauabzugsteuer) und Investoren für alle Rechtsformen
  "bauleistungen.fuer_unternehmen": true,
  "gesellschafter.auslaendische_investoren": false,
  "kasse.elektronisch": false,
  "online.website": true,
  "ust.kleinunternehmer": false,
  steuerberater: true,
  "umsatz.vorjahr": 251000,
  "umsatz.prognose_laufendes_jahr": 285000,
  "gewinn.vorjahr": 31000,
  "gewinn.prognose_laufendes_jahr": 35000,
  "ust.zahllast_vorjahr": 8600,
  "ust.dauerfristverlaengerung": false,
  "vorauszahlung.est_kst": true,
  "vorauszahlung.gewst": true,
  "kunden.segmente": ["b2c", "b2b"],
  "kunden.regionen": ["inland"],
  "vertrieb.kanaele": ["vor_ort_beim_kunden"],
  "produkte.arten": ["dienstleistung", "physisch"],
  "handel.hohe_bargeschaefte": false,
  "arbeitsschutz.elektrische_geraete": true,
  "arbeitsschutz.gefahrstoffe": true,
  "datenverarbeitung.arten": ["kundendaten", "beschaeftigtendaten"],
  "datenschutz.dienstleister": true,
  "ki.nutzung": false,
  "ki.eigene_produkte": false,
  "nis2.betroffen": "nein",
  "gesellschafter.auslaendische_investoren": false,
};

export function standBauen(): Bau {
  const auffaellig: string[] = [];
  const infos: string[] = [];
  const vergleiche: Bau["vergleiche"] = [];
  const vergleich = (bereich: string, was: string, app: number, erwartet: number, grund = "") => {
    const ok = app === erwartet;
    vergleiche.push({ bereich, was, app: euro(app), erwartet: euro(erwartet), ok });
    if (!ok) auffaellig.push(`${bereich} – ${was}: App ${euro(app)} €, unabhängig gerechnet ${euro(erwartet)} € (Differenz ${euro(app - erwartet)} €).${grund ? ` ${grund}` : ""}`);
    return ok;
  };
  const vergleichText = (bereich: string, was: string, app: string, erwartet: string, grund = "") => {
    const ok = app === erwartet;
    vergleiche.push({ bereich, was, app, erwartet, ok });
    if (!ok) auffaellig.push(`${bereich} – ${was}: App „${app}“, erwartet „${erwartet}“.${grund ? ` ${grund}` : ""}`);
    return ok;
  };

  // ---------------------------------------------------------------- Betrieb, Pflichten-Check, Personen
  let s: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, ...D.BETRIEB }, proTest: true };
  s = profilSetzen(s, PROFIL);
  s = steuerberatungSetzen(s, { kontenrahmen: "SKR03", beraternummer: "41522", mandantennummer: "30318" });
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
  const vorschlaegeGruppe = (vid: string, fid: string, gruppe: string, heute: string, extra: Eintrag = {}) =>
    (feld(vid, fid).vorschlaege ?? []).filter((x) => x.gruppe === gruppe).map((vs) => ({ ...eintragAusVorschlag(feld(vid, fid), vs, s.betrieb, heute), ...extra }));
  const unterlage = (id: string) => s.unterlagen.find((u) => u.id === id)!;
  const neuesDok = (uid: string, vorlage: string, titel: string, datum: string, worum: string, ordner: Dok["ordner"]) => {
    const u = unterlage(uid);
    const vl = v(vorlage);
    nr++;
    docs.push({ nr, uid, vorlage, titel, datum, datei: `${String(nr).padStart(2, "0")}-${pdfDateiname(vl, u.daten, datum)}`, ordner, quer: !!vl.querformat, worum, fehlt: fehlendeAngaben(vl, u.daten, s.betrieb) });
  };

  function dok(o: { id: string; vorlage: string; datum: string; worum: string; daten: (heute: string) => Daten; danach?: (u: Unterlage) => void; ordner?: Dok["ordner"] }) {
    const [s1] = anlegen(s, o.vorlage, t(o.datum, 9), o.id);
    s = felderSetzen(s1, o.id, o.daten(o.datum), t(o.datum, 9));
    o.danach?.(unterlage(o.id));
    s = ausgeben(s, o.id, t(o.datum, 12));
    const u = unterlage(o.id);
    const vl = v(o.vorlage);
    neuesDok(o.id, o.vorlage, vl.titel, o.datum, o.worum, o.ordner ?? "pdf");
    const fehlt = docs.at(-1)!.fehlt;
    if (fehlt.length) infos.push(`${vl.titel} (${o.id}): App meldet „Fehlt noch“: ${fehlt.join("; ")}`);
    return u;
  }

  // ---------------------------------------------------------------- Ausgangsrechnungen (inkl. Storno, Ersatz per „Kopieren“, Zahlungseingänge)
  const rechnungsDaten = (r: D.Rechnung): Daten => ({
    datum: r.datum,
    leistung_gleich: !r.leistung,
    leistung: r.leistungText ?? (r.leistung ? D.de(r.leistung) : ""),
    zahlungsziel: r.ziel,
    positionen: r.pos.map((x) => ({ bezeichnung: x.bez, menge: menge(x.menge), einheit: x.einheit, preis: euro(x.preis), satz: String(x.satz) })),
    hinweise: r.hinweise ?? [],
    befreiung: r.befreiung ?? "",
    hinweis: r.hinweis,
    // R12: Skonto als Bedingung der Rechnung (Zahlungsblock, XRechnung BT-20)
    ...(r.skonto ? { skonto: true, skonto_prozent: String(r.skonto), skonto_tage: String(r.skontoTage ?? 10) } : {}),
    // R10: Abschlagsrechnung (Steuer mit Zahlung) und Leitweg-ID der Stadt (BT-10)
    abschlag: r.abschlag === true,
    kunde_leitweg_id: r.leitweg ?? "",
  });
  const ereignisse: { nummer: string; los: () => void }[] = [];
  for (const r of D.RECHNUNGEN) {
    ereignisse.push({
      nummer: r.nummer,
      los: () => {
        const kunde = s.kunden.find((k) => k.id === r.kunde)!;
        let u: Unterlage;
        if (r.ersetzt) {
          // in der App: stornierte Rechnung „Kopieren“ → neuer Entwurf mit nächster Nummer und heutigem Datum, dann ändern
          const [s1, kopie] = kopieren(s, r.ersetzt, t(r.datum, 11), r.id);
          if (!kopie) throw new Error(`kopieren(${r.ersetzt}) lieferte null`);
          s = felderSetzen(s1, r.id, rechnungsDaten(r), t(r.datum, 11));
          s = ausgeben(s, r.id, t(r.datum, 12));
          u = unterlage(r.id);
          vergleichText(`Rechnung ${r.nummer} (Kopie von ${D.RECHNUNGEN.find((x) => x.id === r.ersetzt)!.nummer})`, "Kopie trägt keinen Storno-Bezug, Datum = Tag der Kopie", `${u.daten.storno_zu ?? "–"} / ${String(u.daten.datum)}`, `– / ${r.datum}`);
          neuesDok(r.id, "rechnung", "Rechnung", r.datum, r.worum, "rechnungen");
        } else {
          u = dok({ id: r.id, vorlage: "rechnung", datum: r.datum, worum: r.worum, ordner: "rechnungen", daten: () => ({ ...personIn(v("rechnung"), kunde), ...rechnungsDaten(r) }) });
        }
        if (u.daten.nummer !== r.nummer) auffaellig.push(`Rechnungsnummer: erwartet ${r.nummer}, App vergab ${String(u.daten.nummer)}.`);
        if (!u.festgeschrieben) auffaellig.push(`Rechnung ${r.nummer} ist nach dem Teilen nicht festgeschrieben.`);
        const warn = v("rechnung").pruefen?.(u.daten, s.betrieb) ?? [];
        if (warn.length) infos.push(`Rechnung ${r.nummer}: Prüfung der App meldet „${warn.join("“, „")}“.`);
        // Zahlungseingänge aus 2027 erst nach dem Erinnerungstest setzen – hier nur, was 2026 passiert
        if (r.bezahlt && r.bezahlt.startsWith("2026-")) {
          // R12: mit Skonto – Zahlungseingang mit Betrag, Differenz als Skonto (§ 17 UStG)
          if (r.skonto) {
            const sk = D.skontoVon(r);
            s = zahlungVermerken(s, r.id, { datum: r.bezahlt, betrag_cent: D.rechnungsSumme(r.pos).brutto - sk.brutto, minderung_cent: sk.brutto, art: "skonto" }, t(r.bezahlt, 15), `${r.id}-zahlung`);
            const z = unterlage(r.id);
            vergleichText(`Rechnung ${r.nummer} (Skonto)`, "nach Zahlung mit Skonto bezahlt, nichts offen", `${z.bezahlt ?? "offen"} / ${euro(offenerBetrag(s, z))}`, `${r.bezahlt} / 0,00`);
            vergleichText(`Rechnung ${r.nummer} (Skonto)`, "XRechnung: Skonto-Zeile in BT-20", /#SKONTO#TAGE=\d+#PROZENT=2\.00#\n/.test(xrechnungUbl(eRechnungAus(z.daten, s.betrieb).daten, KU_HINWEIS)) ? "ja" : "nein", "ja");
          } else s = bezahltSetzen(s, r.id, r.bezahlt, t(r.bezahlt, 15));
        }
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
          neuesDok(st.id, "rechnung", "Stornorechnung", st.datum, `Stornorechnung zu ${r.nummer}: ${st.grund}. Keine Erstattung (Original nie bezahlt).`, "rechnungen");
        },
      });
    }
  }
  for (const e of ereignisse.sort((a, b) => a.nummer.localeCompare(b.nummer))) e.los();

  // Summen, XRechnung, Einheiten-Codes, Steuerkategorie
  const xmls: Bau["xmls"] = [];
  const ohneXml: Bau["ohneXml"] = [];
  const ERW_CODE: Record<string, string> = { Stück: "C62", Stunde: "HUR", Meter: "MTR", Pauschale: "LS", Tag: "DAY", m: "MTR", "Std.": "HUR" };
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
    vergleichText("Rechnung " + x.nummer, "Steuerart (eRechnungAus)", daten.steuerart ?? "–", x.steuerart);
    if (fehlt.length) {
      ohneXml.push({ nummer: x.nummer, fehlt });
      continue;
    }
    const xml = xrechnungUbl(daten, KU_HINWEIS);
    xmls.push({ datei: `E-Rechnung-${daten.nummer.replace(/[^A-Za-z0-9-]+/g, "-")}.xml`, xml, nummer: x.nummer });
    const zahlbar = /<cbc:PayableAmount[^>]*>([-\d.]+)</.exec(xml)?.[1];
    vergleich("E-Rechnung " + x.nummer, "PayableAmount (BT-115)", Math.round(Number(zahlbar) * 100), x.vz * x.s.brutto);
    const codes = [...xml.matchAll(/<cbc:InvoicedQuantity unitCode="([^"]+)"/g)].map((m) => m[1]!);
    // StB-Prüfung (C-16): Nachlässe (negativer Preis) stehen als AllowanceCharge auf Dokumentebene, nicht als Zeile – außer im Storno
    const soll = x.r.pos.filter((p) => x.vz < 0 || p.preis >= 0).map((p) => ERW_CODE[p.einheit] ?? "C62");
    vergleichText("E-Rechnung " + x.nummer, `Einheiten-Codes (BT-130) für ${[...new Set(x.r.pos.map((p) => p.einheit))].join(", ")}`, codes.join(","), soll.join(","), codes.join(",") !== soll.join(",") ? "„m“ und „Std.“ (übliche Schreibweise im Handwerk) werden nicht erkannt und als Stück (C62) übertragen (packages/fachlogik/src/erechnung.ts:135–139)." : "");
    if (x.steuerart === "reverse_charge") {
      vergleichText("E-Rechnung " + x.nummer, "Steuerkategorie AE und Befreiungsgrund VATEX-EU-AE (§ 13b)", /<cbc:ID>AE<\/cbc:ID>/.test(xml) && /VATEX-EU-AE/.test(xml) ? "ja" : "nein", "ja");
      vergleichText("E-Rechnung " + x.nummer, "USt-IdNr. des Käufers (BT-48) enthalten", /DE814527390/.test(xml) ? "ja" : "nein", "ja");
    }
    if (x.r.leitweg) vergleichText("E-Rechnung " + x.nummer, "Käuferreferenz BT-10 = Leitweg-ID des öffentlichen Auftraggebers", /<cbc:BuyerReference>([^<]*)/.exec(xml)?.[1] ?? "–", x.r.leitweg, "Die Rechnungsvorlage hat kein Feld für Leitweg-ID/Käuferreferenz; eRechnungAus setzt keine kaeufer_referenz, BT-10 bekommt die Rechnungsnummer (packages/fachlogik/src/dokumente/buchhaltung.ts:139–170). Rechnungseingangsplattformen des Bundes/der Länder weisen eine XRechnung ohne Leitweg-ID zurück.");
    if (x.steuerart === "nullsatz") infos.push(`E-Rechnung ${x.nummer} (PV, Nullsteuersatz): Steuerkategorie ${/<cac:ClassifiedTaxCategory>\s*<cbc:ID>([A-Z]+)/.exec(xml)?.[1] ?? "?"}, Befreiungsgrund „${/<cbc:TaxExemptionReason>([^<]*)/.exec(xml)?.[1] ?? "–"}“ (fachlich klären: E „befreit“ oder Z „Nullsatz“).`);
    if (x.r.abschlag || x.r.schlussZu) infos.push(`E-Rechnung ${x.nummer} (${x.r.abschlag ? "Abschlagsrechnung" : "Schlussrechnung"}): InvoiceTypeCode ${/<cbc:InvoiceTypeCode>(\d+)/.exec(xml)?.[1] ?? "?"} (R11: Abschlagsrechnung als Teilrechnung 326; 875 ff. für Bau und die Schlussrechnung 877 kennt die App nicht).`);
  }
  const privat = D.RECHNUNGEN.filter((r) => !("email" in D.KUNDEN[r.kunde])).map((r) => r.nummer);
  infos.push(`Ohne XRechnung (App: Angaben fehlen): ${ohneXml.map((o) => `${o.nummer} (${o.fehlt.join(", ")})`).join("; ") || "keine"}. Erwartet: nur Privatkunden ohne E-Mail (${privat.join(", ")}).`);
  // § 13b ohne USt-IdNr. des Kunden: die App verlangt sie für die E-Rechnung (EN 16931 BR-AE-02 verlangt BT-48 oder BT-47)
  {
    const u = s.unterlagen.find((y) => y.daten.nummer === "2026-003")!;
    const ohne = eRechnungAus({ ...u.daten, kunde_ust_idnr: "" }, s.betrieb).fehlt;
    infos.push(`§ 13b-Rechnung ohne USt-IdNr. des Generalunternehmers: App meldet für die E-Rechnung „${ohne.join("; ") || "nichts"}“.`);
  }
  // Pflichthinweis § 14 Abs. 4 Nr. 9 UStG bei Privatkunden: prüft die App ihn? (2026-017 absichtlich ohne)
  {
    const u = s.unterlagen.find((y) => y.daten.nummer === "2026-017")!;
    const w = v("rechnung").pruefen?.(u.daten, s.betrieb) ?? [];
    // StB-Prüfung (C-3): Kunde als „Privatperson“ gemerkt, Schalter „Leistung an einem Grundstück“ im Handwerk vorbelegt –
    // der Hinweis steht dann von selbst auf der Rechnung (oder die Prüfung meldet ihn)
    const html = v("rechnung").html(u.daten, s.betrieb);
    vergleichText("Rechnung 2026-017 (Privatkunde, Gartenbeleuchtung)", "App weist auf den fehlenden Aufbewahrungshinweis (§ 14 Abs. 4 Nr. 9, § 14b Abs. 1 Satz 5 UStG) hin bzw. setzt ihn", w.some((x) => /aufbewahr|14b|Grundstück/i.test(x)) || /zwei Jahre aufzubewahren/.test(html) ? "ja" : "nein", "ja", "Die Rechnung an eine Privatperson über eine Leistung am Grundstück ist ohne den Hinweis teilbar; die App fragt nicht, ob der Empfänger eine Privatperson ist.");
  }

  // ---------------------------------------------------------------- Zahlungserinnerung (2026-023, fällig 17.11.2026, erinnert am 01.12.2026)
  let erinnerung: Bau["erinnerung"] = { nummer: "", heute: "", text: "", faellig: null, tage: 0 };
  {
    const r = D.RECHNUNGEN.find((x) => x.erinnerung)!;
    const u = unterlage(r.id);
    const heute = r.erinnerung!;
    const faellig = faelligAm(u);
    vergleichText(`Zahlungserinnerung ${r.nummer}`, "Fälligkeit nach Zahlungsziel (faelligAm)", faellig ?? "–", D.faellig(r));
    const offen = offeneIds(s.unterlagen);
    const tage = tageUeberfaellig(u, heute, offen);
    vergleichText(`Zahlungserinnerung ${r.nummer}`, `Tage überfällig am ${D.de(heute)}`, String(tage), String(Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${D.faellig(r)}T12:00:00Z`)) / 864e5)));
    // wie Abschluss.tsx (Zahlung → erinnern): Knopf nur bei überfälliger, unbezahlter Rechnung
    const ueberfaellig = !u.bezahlt && Boolean(faellig && faellig < heute);
    vergleichText(`Zahlungserinnerung ${r.nummer}`, "Knopf „Zahlungserinnerung senden“ sichtbar (überfällig, offen)", ueberfaellig ? "ja" : "nein", "ja");
    const b = s.betrieb;
    const datumDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
    const text = TEXT.erinnerung_text({ nummer: String(u.daten.nummer ?? "").trim(), betrag: euroText(rechnungBrutto(u, b)), faellig: faellig ? datumDe(faellig) : "", kunde: String(u.daten.kunde_name ?? "").trim(), iban: b.iban.trim(), absender: [b.verantwortlich.trim(), b.name.trim()].filter(Boolean).join("\n") });
    const brutto = D.rechnungsSumme(r.pos).brutto;
    vergleichText(`Zahlungserinnerung ${r.nummer}`, "Text nennt Nummer, Betrag, Fälligkeit, IBAN", [r.nummer, `${D.eur(brutto)} €`, D.de(D.faellig(r)), D.BETRIEB.iban.replace(/\s+/g, "")].filter((x) => !text.replace(/\u00a0/g, " ").replace(/(?<=IBAN [A-Z0-9 ]*) (?=[A-Z0-9])/g, "").includes(x)).join(", ") || "alle", "alle");
    vergleichText(`Zahlungserinnerung ${r.nummer}`, "Rechnung steht in „offene Rechnungen“ (offeneRechnungen)", offeneRechnungen(s.unterlagen).some((x) => x.id === r.id) ? "ja" : "nein", "ja");
    erinnerung = { nummer: r.nummer, heute, text, faellig, tage };
    // Zahlungseingänge 2027 erst jetzt vermerken (der Stand bildet das Jahresende ab)
    for (const x of D.RECHNUNGEN) if (x.bezahlt && !x.bezahlt.startsWith("2026-")) s = bezahltSetzen(s, x.id, x.bezahlt, t(x.bezahlt, 15));
  }

  // ---------------------------------------------------------------- Belege
  const belegDateien: Bau["belegDateien"] = [];
  for (const b of D.BELEGE) {
    const jetzt = t(b.datum, 18).toISOString();
    if (b.datei === "xml") {
      const H = D.GROSSHANDEL;
      const xml = xrechnungUbl(
        {
          nummer: b.nummer!, rechnungsdatum: b.datum, leistungsdatum: "2026-09-07", faellig_am: "2026-09-22",
          steller: { name: H.lieferant, strasse: H.strasse, plz: H.plz, ort: H.ort, land: "DE", email: H.email, telefon: H.telefon, steuernummer: H.steuernummer, ust_idnr: H.ust_idnr, iban: H.iban, bic: H.bic },
          kunde: { name: D.BETRIEB.name, strasse: D.BETRIEB.strasse, plz: D.BETRIEB.plz, ort: D.BETRIEB.ort, land: "DE", email: D.BETRIEB.email, kaeufer_referenz: "Kd.-Nr. 40-77812", geschaeftskunde: true },
          positionen: D.ERECHNUNG_POS.map((x) => ({ bezeichnung: x.bez, menge: x.menge, einheit: "stueck", einheit_code: x.code, preis_cent: x.preis, ust_satz: x.satz })),
          kleinunternehmer: false,
          hinweis: "Zahlbar bis 22.09.2026 ohne Abzug. Bei Zahlung bis 15.09.2026 2 % Skonto.",
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
      infos.push(`E-Rechnung ${b.nummer} des Großhändlers eingelesen: Lieferant „${roh.lieferant}“, Datum ${roh.datum}, Kategorie zunächst „${kategorieFuer(roh.kategorie).titel}“ (von Hand auf „Waren und Material“ gestellt), Notiz: ${(roh.notiz ?? "").replace(/\n/g, " | ")}`);
      vergleichText("E-Rechnung einlesen", `${b.nummer}: Belegdatum`, roh.datum, b.datum);
      s = belegSetzen(s, { ...roh, kategorie: b.kategorie, bezahlt: b.bezahlt, datei: `${b.id}.xml` }, t(b.datum, 18));
      belegDateien.push({ datei: `${b.id}.xml`, xml });
    } else {
      const sm = D.belegSumme(b);
      const beleg: Beleg = {
        id: b.id, datum: b.datum, lieferant: b.lieferant, nummer: b.nummer, kategorie: b.kategorie,
        steuer: sm.jeSatz.map((x) => ({ satz: x.satz, brutto_cent: x.brutto })),
        vorsteuer: b.vorsteuer || !!b.p13b, zahlung: b.zahlung, bezahlt: b.bezahlt, notiz: b.notiz ?? null, datei: `${b.id}.pdf`, quelle: "foto", erstellt: jetzt, geaendert: jetzt,
        // R10: Subunternehmer-Bauleistung nach § 13b – als Steuerschuldnerschaft erfasst (Kz 84/85, Vorsteuer Kz 67)
        ...(b.p13b ? { steuerschuld: "bau" as const } : {}),
      };
      s = belegSetzen(s, beleg, t(b.datum, 18));
      belegDateien.push({ datei: `${b.id}.pdf`, html: belegHtml(b) });
    }
    const app = belegSummen(s.belege.find((x) => x.id === b.id)!);
    const erw = D.belegSumme(b);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Brutto", app.brutto_cent, erw.brutto);
    vergleich(`Beleg ${b.id} ${b.lieferant}`, "Vorsteuer (App rechnet aus Brutto, Beleg weist aus)", app.vorsteuer_cent, erw.vorsteuer);
  }

  // ---------------------------------------------------------------- Betrieb, Website, Datenschutz
  const B = D.BETRIEB;
  const I = D.INHABER;
  dok({ id: "gewerbe", vorlage: "gewerbeanmeldung", datum: "2014-03-20", worum: "Gewerbeanmeldung zur Gründung (Beginn 01.04.2014): Einzelunternehmen Jens Brandt, Elektrotechnikerhandwerk (Anlage A HwO), Handwerkskarte.",
    daten: () => ({ name: I.name, geburtsname: I.geburtsname, geburtsdatum: I.geburtsdatum, geburtsort: I.geburtsort, staatsangehoerigkeit: "deutsch", wohnanschrift: I.wohnanschrift, rechtsform: "Einzelunternehmen",
      taetigkeit: "Elektrotechnikerhandwerk (zulassungspflichtiges Handwerk, Anlage A Nr. 25 HwO): Elektroinstallation und Gebäudetechnik, Photovoltaik und Ladeinfrastruktur, Prüfung elektrischer Anlagen und Geräte; Handel mit Elektromaterial im Zusammenhang mit den Arbeiten",
      beginn: D.GRUENDUNG, erwerb: "haupt", beschaeftigte: "1 (Vollzeit)", erlaubnis: "Eintragung in die Handwerksrolle der Handwerkskammer Dortmund (Inhaber ist Elektrotechnikermeister), Handwerkskarte vom 25.03.2014" }) });

  dok({ id: "impressum", vorlage: "impressum", datum: "2026-01-12", worum: "Impressum: Einzelunternehmen, Inhaber, USt-IdNr. (aus „Mein Betrieb“), reglementierter Beruf Elektrotechnikermeister mit Handwerkskammer und HwO, keine Verbraucherschlichtung.",
    daten: () => ({ rechtsform: "Einzelunternehmen", vertreten: "Jens Brandt", reglementiert: true, kammer: "Handwerkskammer Dortmund, Ardeystraße 93, 44139 Dortmund (Eintragung in die Handwerksrolle)", berufsbezeichnung: "Elektrotechnikermeister", verleihung: "Deutschland", regelungen: "Handwerksordnung (HwO), abrufbar unter www.gesetze-im-internet.de",
      redaktion: `Jens Brandt, ${B.strasse}, ${B.plz} ${B.ort}`, vsbg: "nicht_bereit" }) });

  dok({ id: "dse", vorlage: "datenschutzerklaerung_website", datum: "2026-01-12", worum: "Datenschutzerklärung: Hosting Webhosting Ruhr, Logfiles 10 Tage, Kontaktformular, Schriften lokal, keine Cookies.",
    daten: () => ({ website: "https://www.elektro-brandt.example", module: ["hosting", "server_logfiles", "kontakt", "google_fonts_lokal"], hoster_name: "Webhosting Ruhr GmbH", hoster_anschrift: "Rheinische Straße 1, 44137 Dortmund", kontaktformular: true, logfile_tage: "10", stand: "2026-01-12" }) });

  dok({ id: "avv", vorlage: "avv", datum: "2024-02-05", worum: "AVV mit dem Website-Host (Hosting, Kontaktformular, E-Mail).",
    daten: () => ({ rolle: "auftraggeber", partner: "Webhosting Ruhr GmbH", partner_anschrift: "Rheinische Straße 1\n44137 Dortmund", hauptvertrag: "Hostingvertrag Tarif Handwerk M vom 05.02.2024 (Kundennummer WR-30871)",
      gegenstand: "Hosting der Website mit Kontaktformular\nBereitstellung von E-Mail-Postfächern", zweck: "Betrieb von www.elektro-brandt.example und der geschäftlichen E-Mail", dauer: "für die Laufzeit des Hauptvertrags",
      datenarten: "Name\nKontaktdaten (Telefon, E-Mail, Anschrift)\nInhalte von Anfragen (auch Fotos von Elektroanlagen)\nIP-Adressen und Server-Logfiles", betroffene: "Kundinnen und Kunden\nInteressenten\nBesucherinnen und Besucher der Website\nBeschäftigte",
      unterauftrag: "Rechenzentrum: DataPark Essen GmbH, Essen (Serverstandort Deutschland)", tom: "siehe Anlage (TOM-Beschreibung des Auftragsverarbeiters)", ort_datum: "Dortmund" }) });

  dok({ id: "dsinfo", vorlage: "datenschutzinformation", datum: "2026-01-12", worum: "Datenschutzinformation (Art. 13 DSGVO) für Kundinnen und Kunden: Kundenkartei, Rechnungen, Kontaktanfragen, Lieferanten.",
    daten: () => ({ fuer_wen: "Kundinnen und Kunden", verarbeitungen: ["Kundenverwaltung / Kundenkartei", "Rechnungsstellung und Buchhaltung", "Kontaktanfragen (Kontaktformular, E-Mail, Telefon)", "Geschäftliche E-Mail-Kommunikation"], interessen: "Sicherer und störungsfreier Betrieb unserer IT\nDurchsetzung und Abwehr von Ansprüchen (Gewährleistung)", bereitstellung: "vertrag",
      ergaenzung: "Für die Anmeldung von Zählerplätzen, Wallboxen und Photovoltaikanlagen übermitteln wir Name, Anschrift und Anlagendaten an den zuständigen Netzbetreiber (Art. 6 Abs. 1 lit. b und c DSGVO).", stand: "2026-01-12" }) });

  dok({ id: "vvt", vorlage: "datenschutz_dokumentation", datum: "2026-01-14", worum: "VVT: 8 Tätigkeiten aus den Vorschlägen (Kunden, Rechnungen, Lohn, Personal, Website, Kontakt, E-Mail, Lieferanten), 14 TOM; Dienstleister Webhosting Ruhr (AVV), Steuerbüro (Lohn als AV, Steuerberatung eigenverantwortlich).",
    daten: (h) => ({
      verantwortlich: "Jens Brandt",
      verarbeitungen: [
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kundenverwaltung", h, { empfaenger: "Netzbetreiber (Anmeldung von Anlagen), Steuerbüro" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Rechnungsstellung", h, { empfaenger: "Steuerbüro Hagemann & Kurt, Finanzamt Dortmund-Ost" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lohn- und Gehalts", h, { empfaenger: "Steuerbüro Hagemann & Kurt (Auftragsverarbeiter Lohn), Krankenkassen, Finanzamt, BG ETEM, Handwerkskammer (Ausbildung), Berufsschule" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Personalverwaltung", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Betrieb der Website", h, { empfaenger: "Webhosting Ruhr GmbH (Auftragsverarbeiter)" }),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Kontaktanfragen", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Geschäftliche E-Mail", h),
        vorschlag("datenschutz_dokumentation", "verarbeitungen", "Lieferanten", h),
      ],
      tom: [
        "Geräteverschlüsselung und Bildschirmsperre", "Website ausschließlich über HTTPS", "WLAN mit aktueller Verschlüsselung", "Persönliche Benutzerkonten", "Starke, individuelle Passwörter", "Zwei-Faktor-Authentisierung",
        "Abschließbare Räume/Schränke", "Verpflichtung aller Beschäftigten", "Akten- und Datenträgervernichtung", "Auftragsverarbeitungsverträge", "Automatische Sicherheitsupdates", "Regelmäßige Datensicherung", "Jährliche Überprüfung des Verzeichnisses", "Regelmäßige Sensibilisierung",
      ].map((x) => vorschlag("datenschutz_dokumentation", "tom", x, h, { umgesetzt_am: "2024-03-01", verantwortlich: "Jens Brandt" })),
      dienstleister: eintraege("datenschutz_dokumentation", "dienstleister", [
        { name: "Webhosting Ruhr GmbH", leistung: "Website-Hosting und E-Mail", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2024-02-05", drittland: "keine Übermittlung in Drittländer" },
        { name: "Steuerbüro Hagemann & Kurt PartG mbB (Lohnabrechnung)", leistung: "Lohnabrechnung", auftragsverarbeitung: true, avv_vorhanden: true, avv_datum: "2017-08-20", drittland: "keine Übermittlung in Drittländer" },
        { name: "Steuerbüro Hagemann & Kurt PartG mbB (Steuerberatung)", leistung: "Steuerberatung (eigenverantwortlich)", auftragsverarbeitung: false, drittland: "keine Übermittlung in Drittländer" },
      ], h),
    }) });

  dok({ id: "verfahren", vorlage: "verfahrensdokumentation", datum: "2026-01-15", worum: `Verfahrensdokumentation (GoBD): ${MARKE.name} für Rechnungen/Belege, Aufmaß auf Papier, Online-Banking, Steuerbüro mit DATEV; keine Kasse, Bareinkäufe über die Portokasse.`,
    daten: () => ({ version: "2.0", verantwortlich: "Jens Brandt",
      organisation: "Elektro-Meisterbetrieb (Einzelunternehmen) mit Werkstatt und Lager in Dortmund-Aplerbeck; Inhaber Jens Brandt (Elektrotechnikermeister, Angebote, Aufmaß, Rechnungen, Buchhaltung), zwei Gesellen, ein Auszubildender. Arbeiten überwiegend auf Baustellen und bei Kunden vor Ort; ein Werkstattwagen.",
      steuerberatung: "Jahresabschluss durch die Steuerberatung; laufende Buchführung im Betrieb",
      systeme: eintraege("verfahrensdokumentation", "systeme", [
        { name: `${MARKE.name} (App, iPhone)`, zweck: "Rechnungsprogramm und Belegerfassung", version: "seit 01/2026" },
        { name: "Aufmaß- und Stundenzettel (Papier, je Baustelle)", zweck: "Grundlage der Rechnungen", version: "laufend" },
        { name: "Sparkasse Dortmund Online-Banking", zweck: "Online-Banking", version: "seit 04/2014" },
        { name: "DATEV Unternehmen online (Steuerbüro)", zweck: "Belegaustausch und Lohnabrechnung", version: "seit 01/2020" },
      ], "2026-01-15"),
      belegeingang: ["Papier (Post/persönlich)", "E-Mail mit PDF-Anhang", "E-Rechnung (XRechnung/ZUGFeRD) per E-Mail oder Portal", "Kontoauszug/Bank-Schnittstelle", "Eigenbeleg"],
      belegart: ["originär Papier, Ablage in Papier (Muster 4.1)", "originär digital (Muster 4.3)"],
      ablage: ["Papierordner (chronologisch/nach Belegart)", "Upload an Steuerberater (z. B. Kanzlei-Portal)"],
      erfassung: `Belege werden wöchentlich in ${MARKE.name} erfasst (Foto bzw. Datei) und quartalsweise als Paket an das Steuerbüro übermittelt.\nAufmaß und Stundenzettel der Baustellen werden zur Rechnung abgelegt (Rechnungsnummer auf dem Aufmaß).\nAusgangsrechnungen werden fortlaufend nummeriert in ${MARKE.name} erstellt und beim Teilen festgeschrieben; Korrekturen nur per Stornorechnung.`,
      scannen: false, sicherung_intervall: "wöchentlich", sicherung_ort: ["Cloud-Backup", "durch Steuerberater"], e_rechnung: true,
      zugriff: "Zugriff auf Buchhaltung und Belege nur für den Inhaber und das Steuerbüro",
      kontrollen: "Monatlicher Abgleich von Kontoauszügen, offenen Rechnungen und Zahlungseingängen\nZahlungserinnerung bei überfälligen Rechnungen nach 14 Tagen",
      aenderungen: eintraege("verfahrensdokumentation", "aenderungen", [{ datum: "2026-01-15", aenderung: `Rechnungen und Belegerfassung auf ${MARKE.name} umgestellt; E-Rechnungsempfang vom Großhandel eingerichtet.` }], "2026-01-15") }) });

  dok({ id: "aufbewahrung", vorlage: "aufbewahrung", datum: "2026-01-15", worum: "Aufbewahrungsplan mit den Startzeilen der App und drei ergänzten Zeilen (Aufmaß/Stundenzettel, Prüfprotokolle, Lohnkonten).",
    daten: (h) => {
      const start = (leereDatenVon("aufbewahrung", h).eintraege as Eintrag[]).map((e) => ({ ...e, letzte: "2026", ort: `${MARKE.name} (verschlüsselt) und DATEV Unternehmen online; Papier im Büro der Werkstatt` }));
      return { eintraege: [...start, ...eintraege("aufbewahrung", "eintraege", [
        { art: "Aufmaß und Stundenzettel (Grundlage der Rechnungen)", jahre: "8", letzte: "2026", ort: "Ordner je Kunde/Baustelle" },
        { art: "Prüfprotokolle elektrischer Anlagen (DIN VDE 0100-600) und Geräte (DGUV V3)", jahre: "10", letzte: "2026", ort: "Ordner Prüfprotokolle" },
        { art: "Lohnkonten (§ 41 Abs. 1 EStG)", jahre: "6", letzte: "2026", ort: "Steuerbüro und Personalordner" },
      ], h)] };
    } });

  // ---------------------------------------------------------------- Personal
  const m = (id: keyof typeof D.MITARBEITER) => s.mitarbeiter.find((x) => x.id === id)!;
  const PAUSEN = "nach § 4 ArbZG: mindestens 30 Minuten bei mehr als sechs Stunden, 45 Minuten bei mehr als neun Stunden";
  const RUHE = "nach § 5 ArbZG: mindestens elf Stunden ununterbrochen nach Ende der täglichen Arbeitszeit";
  const nachweis = (id: keyof typeof D.MITARBEITER, datum: string, extra: Daten) => ({ ...personIn(v("nachweis_arbeitsbedingungen"), m(id)), arbeitsort: "verschieden", probezeit: "6", entgelt_art: "monat", faelligkeit: "am letzten Bankarbeitstag des laufenden Monats", auszahlung: "Überweisung auf das von der beschäftigten Person benannte Konto",
    pausen: PAUSEN, ruhezeit: RUHE, fortbildung: "Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht.", kuendigung_art: "gesetz", kollektiv: "keine", ausgestellt_am: datum, befristet: false, wochenstunden: "39", tage_pro_woche: "5", verteilung: "Montag bis Freitag", urlaub: "30", ...extra });
  dok({ id: "nachweis1", vorlage: "nachweis_arbeitsbedingungen", datum: "2026-06-24", worum: "Nachweis der Arbeitsbedingungen Geselle Dennis Kowalczyk (aktualisiert: 3.550 € ab 01.07.2026; Arbeitsort wechselnde Baustellen, Fahrzeit ab Werkstatt).",
    daten: (h) => nachweis("m1", h, { beginn: "2017-09-01", taetigkeit: "Geselle/Gesellin im Handwerk", entgelt_betrag: "3.550,00", zuschlaege: "Ab 01.07.2026. Überstunden werden mit dem vereinbarten Stundenlohn vergütet oder durch Freizeit ausgeglichen. Auslösung nach betrieblicher Regelung bei auswärtigen Baustellen.", ueberstunden: "ja", ueberstunden_text: "bei Notdienst und Terminbaustellen nach Anordnung, höchstens 5 Stunden je Woche" }) });
  dok({ id: "nachweis2", vorlage: "nachweis_arbeitsbedingungen", datum: "2020-02-20", worum: "Nachweis der Arbeitsbedingungen Geselle Tobias Reinartz (seit 01.03.2020, 3.250 €, wechselnde Einsatzorte).",
    daten: (h) => nachweis("m2", h, { beginn: "2020-03-01", taetigkeit: "Geselle/Gesellin im Handwerk", entgelt_betrag: "3.250,00", zuschlaege: "Überstunden werden mit dem vereinbarten Stundenlohn vergütet.", ueberstunden: "ja", ueberstunden_text: "bei Notdienst nach Dienstplan" }) });
  infos.push("Auszubildender Leon Hagedorn: kein „Nachweis der Arbeitsbedingungen“ erzeugt – für Auszubildende gilt der Berufsausbildungsvertrag (§ 11 BBiG) und die Eintragung in die Lehrlingsrolle der Handwerkskammer; die App hat dafür keine Vorlage.");

  dok({ id: "fragebogen1", vorlage: "sv_meldedaten", datum: "2017-08-20", worum: "Personalfragebogen Geselle Kowalczyk (Personengruppe 101, Vollzeit unbefristet, Mittlere Reife, Berufsausbildung).",
    daten: () => ({ ...personIn(v("sv_meldedaten"), m("m1")), art: "vollzeit", personengruppe: "101", vertragsform: "1", stunden: "39", entgelt: "2.650,00", taetigkeit: "Elektroniker für Energie- und Gebäudetechnik", schulabschluss: "3", ausbildung: "2", weitere: false }) });
  dok({ id: "fragebogen2", vorlage: "sv_meldedaten", datum: "2020-02-20", worum: "Personalfragebogen Geselle Reinartz (Personengruppe 101).",
    daten: () => ({ ...personIn(v("sv_meldedaten"), m("m2")), art: "vollzeit", personengruppe: "101", vertragsform: "1", stunden: "39", entgelt: "2.950,00", taetigkeit: "Elektroniker für Energie- und Gebäudetechnik", schulabschluss: "3", ausbildung: "2", weitere: false }) });
  dok({ id: "fragebogen3", vorlage: "sv_meldedaten", datum: "2025-07-10", worum: "Personalfragebogen Auszubildender (Personengruppe 102, 16 Jahre bei Beginn, Hauptschulabschluss, ohne Berufsabschluss).",
    daten: () => ({ ...personIn(v("sv_meldedaten"), m("m3")), art: "ausbildung", personengruppe: "102", vertragsform: "3", stunden: "39", entgelt: "960,00", taetigkeit: "Auszubildender Elektroniker für Energie- und Gebäudetechnik (1. Ausbildungsjahr)", schulabschluss: "2", ausbildung: "1", weitere: false }) });

  const lohnZeilen = (l: D.LohnMonat[], h: string) =>
    eintraege("lohnkonto", "monate", l.map((x) => ({ monat: x.monat, zahltag: x.zahltag, brutto: euro(x.brutto), lohnsteuer: euro(x.lohnsteuer), soli: "0,00", kirchensteuer: "", sv_an: euro(x.sv_an), sv_ag: euro(x.sv_ag), auszahlung: euro(x.brutto - x.lohnsteuer - x.sv_an) })), h);
  dok({ id: "lohnkonto1", vorlage: "lohnkonto", datum: "2026-12-31", worum: "Lohnkonto 2026 Geselle Kowalczyk: 3.450 € (Jan–Jun), 3.550 € (Jul–Dez), StKl I; LSt laut Steuerbüro (Annahme).",
    daten: (h) => ({ ...personIn(v("lohnkonto"), m("m1")), jahr: "2026", kinder: "0", religion: "keine Kirchensteuerpflicht", monate: lohnZeilen(D.LOHN.m1, h) }) });
  dok({ id: "lohnkonto2", vorlage: "lohnkonto", datum: "2026-12-31", worum: "Lohnkonto 2026 Geselle Reinartz: 3.250 €, StKl III.",
    daten: (h) => ({ ...personIn(v("lohnkonto"), m("m2")), jahr: "2026", kinder: "1,0", religion: "rk (römisch-katholisch)", monate: lohnZeilen(D.LOHN.m2, h) }) });
  dok({ id: "lohnkonto3", vorlage: "lohnkonto", datum: "2026-12-31", worum: "Lohnkonto 2026 Auszubildender Hagedorn (17): 960 € (Jan–Jul), 1.050 € (Aug–Dez), keine Lohnsteuer.",
    daten: (h) => ({ ...personIn(v("lohnkonto"), m("m3")), jahr: "2026", kinder: "0", religion: "keine Kirchensteuerpflicht", monate: lohnZeilen(D.LOHN.m3, h) }) });

  const tag = ([datum, beginn, ende, pause, bemerkung]: string[]) => ({ datum: datum!, beginn: beginn!, ende: ende!, pause: pause!, bemerkung: bemerkung! });
  dok({ id: "azn1", vorlage: "arbeitszeitnachweis", datum: "2026-06-01", worum: "Arbeitszeitnachweis Mai 2026 Geselle Kowalczyk: Baustelle Kirchhörder Straße (Feininstallation), Notdienst Samstag 23.05., Berufsschule entfällt; 7:00–16:00 mit 45 Min. Pause.",
    daten: (h) => ({ name: m("m1").name, monat: "Mai 2026", leerzeilen: false, tage: eintraege("arbeitszeitnachweis", "tage", [
      ["2026-05-04", "07:00", "16:00", "45", "BV Kirchhörder Str."], ["2026-05-05", "07:00", "16:00", "45", "BV Kirchhörder Str."], ["2026-05-06", "07:00", "16:00", "45", "BV Kirchhörder Str., Kernbohrer vor Ort"], ["2026-05-07", "07:00", "16:00", "45", "BV Kirchhörder Str."], ["2026-05-08", "07:00", "13:00", "0", "BV Kirchhörder Str."],
      ["2026-05-11", "07:00", "16:00", "45", "BV Kirchhörder Str."], ["2026-05-12", "07:00", "16:00", "45", "BV Kirchhörder Str."], ["2026-05-13", "07:00", "16:30", "45", "BV Kirchhörder Str., Abschluss 2. BA"], ["2026-05-14", "", "", "", "Feiertag (Christi Himmelfahrt)"], ["2026-05-15", "07:00", "13:00", "0", "Werkstatt"],
      ["2026-05-18", "07:00", "16:00", "45", "Seminar DIN VDE 0100 (Bildungszentrum)"], ["2026-05-19", "07:00", "16:00", "45", "Kundendienst"], ["2026-05-20", "07:00", "16:00", "45", "Kundendienst"], ["2026-05-21", "07:00", "16:00", "45", "Kundendienst"], ["2026-05-22", "07:00", "13:00", "0", "Werkstatt"],
      ["2026-05-23", "09:00", "11:30", "0", "Notdienst Bäckerei Hollmann (Samstag)"], ["2026-05-25", "", "", "", "Feiertag (Pfingstmontag)"], ["2026-05-26", "07:00", "16:00", "45", "Kundendienst"], ["2026-05-27", "07:00", "16:00", "45", "Kundendienst"], ["2026-05-28", "07:00", "16:00", "45", "Kundendienst"], ["2026-05-29", "07:00", "13:00", "0", "Werkstatt"],
    ].map(tag), h) }) });
  dok({ id: "azn3", vorlage: "arbeitszeitnachweis", datum: "2026-06-01", worum: "Arbeitszeitnachweis Mai 2026 Auszubildender (17 Jahre, JArbSchG: höchstens 8 Std./Tag, 40 Std./Woche, Berufsschultage mittwochs angerechnet).",
    daten: (h) => ({ name: m("m3").name, monat: "Mai 2026", leerzeilen: false, tage: eintraege("arbeitszeitnachweis", "tage", [
      ["2026-05-04", "07:00", "15:30", "60", "BV Kirchhörder Str. mit Geselle"], ["2026-05-05", "07:00", "15:30", "60", "BV Kirchhörder Str."], ["2026-05-06", "", "", "", "Berufsschule (8 Std. angerechnet)"], ["2026-05-07", "07:00", "15:30", "60", "BV Kirchhörder Str."], ["2026-05-08", "07:00", "13:00", "30", "Werkstatt"],
      ["2026-05-11", "07:00", "15:30", "60", "BV Kirchhörder Str."], ["2026-05-12", "07:00", "15:30", "60", "BV Kirchhörder Str."], ["2026-05-13", "", "", "", "Berufsschule (8 Std. angerechnet)"], ["2026-05-14", "", "", "", "Feiertag (Christi Himmelfahrt)"], ["2026-05-15", "07:00", "13:00", "30", "Werkstatt"],
      ["2026-05-18", "07:00", "15:30", "60", "Kundendienst mit Geselle"], ["2026-05-19", "07:00", "15:30", "60", "Kundendienst"], ["2026-05-20", "", "", "", "Berufsschule (8 Std. angerechnet)"], ["2026-05-21", "07:00", "15:30", "60", "Kundendienst"], ["2026-05-22", "07:00", "13:00", "30", "Werkstatt"],
      ["2026-05-25", "", "", "", "Feiertag (Pfingstmontag)"], ["2026-05-26", "07:00", "15:30", "60", "Kundendienst"], ["2026-05-27", "", "", "", "Berufsschule (8 Std. angerechnet)"], ["2026-05-28", "07:00", "15:30", "60", "Kundendienst"], ["2026-05-29", "07:00", "13:00", "30", "Werkstatt"],
    ].map(tag), h) }) });

  // ---------------------------------------------------------------- Arbeitsschutz
  const GB_EXTRA = { verantwortlich: "Jens Brandt", umsetzen_bis: "2026-03-31", umgesetzt_am: "2026-02-27" };
  dok({ id: "gb-baustelle", vorlage: "gefaehrdungsbeurteilung", datum: "2026-02-02", worum: "Gefährdungsbeurteilung Baustelle beim Kunden: alle 13 Handwerk-Vorschläge der App plus eigene Zeilen: Arbeiten an/nahe unter Spannung stehenden Teilen (5 Sicherheitsregeln), Störlichtbogen, Zusammenarbeit mit anderen Gewerken (§ 8 ArbSchG, SiGe-Plan), Azubi (JArbSchG), Alleinarbeit im Notdienst.",
    daten: (h) => ({ arbeitsbereich: "Baustelle beim Kunden", taetigkeiten: "Rohinstallation (Schlitzen, Bohren, Leitungsverlegung), Feininstallation, Montage von Verteilern und Zählerschränken, Inbetriebnahme und Erstprüfung, Fehlersuche in bestehenden Anlagen, Montage von PV-Anlagen und Wallboxen, Notdienst", beschaeftigte: "3", beurteilt_von: "Jens Brandt", mitwirkung: "Beschäftigte des Bereichs\nFachkraft für Arbeitssicherheit\nBetriebsärztin / Betriebsarzt", datum: "2026-02-02",
      gefaehrdungen: [
        ...vorschlaegeGruppe("gefaehrdungsbeurteilung", "gefaehrdungen", "Handwerk", h, GB_EXTRA),
        ...eintraege("gefaehrdungsbeurteilung", "gefaehrdungen", [
          { beschreibung: "Elektrischer Schlag beim Arbeiten an oder in der Nähe aktiver Teile (Fehlersuche, Erweiterung bestehender Anlagen, Zählerschrank).", massnahme: "Arbeiten nur im spannungsfreien Zustand nach den fünf Sicherheitsregeln (DIN VDE 0105-100): freischalten, gegen Wiedereinschalten sichern, Spannungsfreiheit feststellen, erden und kurzschließen, benachbarte aktive Teile abdecken. Arbeiten unter Spannung nur nach gesonderter Gefährdungsbeurteilung durch den Meister.", risiko: "hoch", faktor: "arbeitsmittel", ...GB_EXTRA },
          { beschreibung: "Störlichtbogen beim Arbeiten in Hausanschlusskästen, Zählerschränken und Hauptverteilungen.", massnahme: "Störlichtbogen-Gesichtsschutz Klasse 2, isolierende Handschuhe Klasse 0, schwer entflammbare Kleidung; nur Elektrofachkräfte.", risiko: "hoch", faktor: "einwirkungen", ...GB_EXTRA },
          { beschreibung: "Zusammenarbeit mit anderen Gewerken auf Baustellen (Gerüste, offene Schlitze, Kernbohrungen des Subunternehmers).", massnahme: "Abstimmung mit dem Bauleiter und dem Koordinator nach Baustellenverordnung; SiGe-Plan einsehen; gegenseitige Unterrichtung (§ 8 ArbSchG).", risiko: "mittel", faktor: "ablaeufe_arbeitszeit", ...GB_EXTRA },
          { beschreibung: "Auszubildender unter 18 Jahren: elektrotechnische Arbeiten, Leitern, Lärm und Staub auf Baustellen.", massnahme: "Nur unter Aufsicht einer Elektrofachkraft (§ 22 JArbSchG, Ausbildungszweck); keine Arbeiten unter Spannung, keine Alleinarbeit; Arbeitszeit höchstens 8 Std./Tag; halbjährliche Unterweisung (§ 29 JArbSchG); Erst- und Nachuntersuchung (§§ 32, 33 JArbSchG).", risiko: "mittel", faktor: "qualifikation", ...GB_EXTRA },
          { beschreibung: "Alleinarbeit im Notdienst (abends, am Wochenende).", massnahme: "Notdienst nur durch Gesellen; Mobiltelefon, Meldung bei Beginn und Ende an den Meister; keine Arbeiten unter Spannung im Notdienst.", risiko: "mittel", faktor: "ablaeufe_arbeitszeit", ...GB_EXTRA },
        ], h),
      ],
      mutterschutz_ergebnis: "umgestaltung", mutterschutz_details: "Keine Arbeiten unter Spannung oder in der Nähe aktiver Teile, keine Arbeiten auf Leitern und Gerüsten, kein Heben über 5 kg regelmäßig; Tätigkeiten in der Werkstatt (Vorkonfektion, Prüfung von Geräten) nach Einzelfallprüfung.",
      wirksamkeit: "wirksam", wirksamkeit_am: "2026-09-17", bemerkung: "Baustellenbegehung mit der Fachkraft für Arbeitssicherheit (BG-ETEM-Unternehmermodell) am 17.09.2026.", fortschreibung: "bei Änderungen von Tätigkeiten, Arbeitsmitteln oder Arbeitsstoffen, nach Unfällen sowie jährlich" }) });
  dok({ id: "gb-werkstatt", vorlage: "gefaehrdungsbeurteilung", datum: "2026-02-02", worum: "Gefährdungsbeurteilung Werkstatt und Lager: ausgewählte Handwerk-Vorschläge (Leiter, Lärm, Staub, Gefahrstoffe, Stromschlag, Heben, Druckgas fehlt bewusst) plus eigene Zeilen Prüfplatz für die DGUV-V3-Prüfung, Kabeltrommeln/Regale, Laden des Werkstattwagens.",
    daten: (h) => ({ arbeitsbereich: "Werkstatt", taetigkeiten: "Vorkonfektion von Verteilern, Prüfung ortsveränderlicher Geräte (Prüfplatz), Lagerung von Kabeln und Material, Beladen des Werkstattwagens", beschaeftigte: "3", beurteilt_von: "Jens Brandt", mitwirkung: "Beschäftigte des Bereichs\nFachkraft für Arbeitssicherheit", datum: "2026-02-02",
      gefaehrdungen: [
        ...["Absturz von Anlege", "Gehörschäden", "Gesundheitsschäden durch Gefahrstoffe", "Stromschlag durch beschädigte", "Unfälle mit Kraftfahrzeugen", "Schwere körperliche Belastung"].map((x) => vorschlag("gefaehrdungsbeurteilung", "gefaehrdungen", x, h, GB_EXTRA)),
        ...eintraege("gefaehrdungsbeurteilung", "gefaehrdungen", [
          { beschreibung: "Prüfplatz für die eigene Prüfung ortsveränderlicher Geräte (DGUV V3): Prüfspannung, Berührung bei Isolationsmessung.", massnahme: "Prüfplatz mit Not-Aus und Fehlerstrom-Schutz; Prüfung nur durch Elektrofachkräfte; Prüfgerät jährlich kalibriert.", risiko: "mittel", faktor: "arbeitsmittel", ...GB_EXTRA },
          { beschreibung: "Umkippende Kabeltrommeln und überladene Regale im Lager.", massnahme: "Trommelständer, Regale gegen Umkippen gesichert, Belastungsangaben angebracht.", risiko: "gering", faktor: "arbeitsstaette", ...GB_EXTRA },
        ], h),
      ],
      mutterschutz_ergebnis: "keine_massnahmen", mutterschutz_details: "Werkstatttätigkeiten ohne Heben schwerer Lasten möglich.", wirksamkeit: "wirksam", wirksamkeit_am: "2026-09-17", fortschreibung: "bei Änderungen von Tätigkeiten, Arbeitsmitteln oder Arbeitsstoffen, nach Unfällen sowie jährlich" }) });

  const ALLE = (["m1", "m2", "m3"] as const).map((id) => ({ name: m(id).name }));
  dok({ id: "unterweisung", vorlage: "unterweisung", datum: "2026-01-20", worum: "Jährliche Unterweisung (90 Min.) für alle drei Beschäftigten: Gefährdungen, Erste Hilfe, Brandschutz, Leitern, Elektrogeräte, Gefahrstoffe, PSA, Lärm, Staub; ergänzt um die fünf Sicherheitsregeln und Verhalten auf Baustellen (eigener Text, keine Vorlage).",
    daten: (h) => ({ thema: "Jährliche Unterweisung Arbeitsschutz", anlass: "wiederholung", dauer: "90 Minuten", durchgefuehrt_von: "Jens Brandt",
      themen: ["gefaehrdungen_am_eigenen_arbeitsplatz_un", "erste_hilfe_ersthelfer_standort_verbandk", "brandschutz_verhalten_im_brandfall_umgan", "sichere_benutzung_von_leitern_und_tritte", "elektrische_geraete_sichtpruefung_vor_be", "gefahrstoffe_inhalt_der_betriebsanweisun", "persoenliche_schutzausruestung_auswahl_b", "laerm_gehoerschutz_ab_80_85_db_a", "staubarmes_arbeiten_absaugung_nassbearbe", "heben_und_tragen_hilfsmittel_rueckengere"],
      inhalt: "Fünf Sicherheitsregeln nach DIN VDE 0105-100 mit praktischer Übung am Verteiler; Störlichtbogen-Schutzausrüstung; Verhalten auf fremden Baustellen (SiGe-Plan, Absprache mit Bauleitung); Ersthelfer: Tobias Reinartz (Kurs 10/2025), Verbandkasten im Werkstattwagen und in der Werkstatt.", teilnehmer: eintraege("unterweisung", "teilnehmer", ALLE, h) }) });
  dok({ id: "unterweisung-azubi", vorlage: "unterweisung", datum: "2026-07-20", worum: "Halbjährliche Unterweisung des Auszubildenden (17) nach § 29 Abs. 2 JArbSchG: elektrische Gefährdungen, Leitern, Gefahrstoffe (Gießharz, Montageschaum).",
    daten: (h) => ({ thema: "Halbjährliche Unterweisung Auszubildender (§ 29 JArbSchG)", anlass: "anlass", jugendliche: true, dauer: "45 Minuten", durchgefuehrt_von: "Jens Brandt",
      themen: ["gefaehrdungen_am_eigenen_arbeitsplatz_un", "sichere_benutzung_von_leitern_und_tritte", "elektrische_geraete_sichtpruefung_vor_be", "gefahrstoffe_inhalt_der_betriebsanweisun", "persoenliche_schutzausruestung_auswahl_b"],
      inhalt: "Zweite Unterweisung im Jahr für den Jugendlichen (erste am 20.01.2026 mit allen). Arbeiten an elektrischen Anlagen nur unter Aufsicht einer Elektrofachkraft; Betriebsanweisungen BA-01 (Gießharz) und BA-02 (PU-Montageschaum) besprochen.", teilnehmer: eintraege("unterweisung", "teilnehmer", [{ name: m("m3").name }], h) }) });

  const STOFFE: Eintrag[] = [
    { bezeichnung: "Gießharz für Kabelmuffen (2-Komponenten-Epoxidharz)", hersteller: "Kabelzubehör Westfalen GmbH", gefahren: "Achtung; H315, H317, H319, H411 – sensibilisierend", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Baustelle (Erdkabel), Werkstatt", verwendung: "Vergießen von Kabelverbindungsmuffen", sdb: "liegt_vor", sdb_stand: "2025-05-12" },
    { bezeichnung: "PU-Montageschaum B2 (Aerosol)", hersteller: "Baustoffchemie Ruhr GmbH", gefahren: "Gefahr; H222, H229, H332, H315, H319, H334, H317, H335, H351, H373 (Diisocyanate) – Schulungspflicht nach REACH Anhang XVII", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Baustelle", verwendung: "Abdichten von Leitungsdurchführungen", sdb: "liegt_vor", sdb_stand: "2025-09-01" },
    { bezeichnung: "Kontaktspray / Reinigungsspray", hersteller: "Elektrochemie Nord GmbH", gefahren: "Gefahr; H222, H229, H336, H411 – extrem entzündbares Aerosol", menge: "bis 1 kg bzw. 1 l", arbeitsbereich: "Werkstatt, Werkstattwagen", verwendung: "Reinigen von Kontakten", sdb: "liegt_vor", sdb_stand: "2024-11-20" },
    { bezeichnung: "Brandschutz-Acryl", hersteller: "Brandschutz Systeme GmbH", gefahren: "nicht eingestuft (laut SDB) – im Verzeichnis zur Vollständigkeit", menge: "1 bis 10 kg bzw. l", arbeitsbereich: "Baustelle", verwendung: "Brandschutzabschottung von Leitungsdurchführungen", sdb: "liegt_vor", sdb_stand: "2025-02-03" },
    { bezeichnung: "Lötzinn mit Flussmittelseele", hersteller: "Elektrochemie Nord GmbH", gefahren: "Achtung; H317, H334 (Kolophonium-Dämpfe beim Löten)", menge: "bis 1 kg bzw. 1 l", arbeitsbereich: "Werkstatt", verwendung: "Löten von Steuerleitungen", sdb: "fehlt" },
  ];
  dok({ id: "gefahrstoffe", vorlage: "gefahrstoffverzeichnis", datum: "2026-02-03", worum: "Gefahrstoffverzeichnis mit 5 Stoffen (Gießharz, PU-Schaum mit Diisocyanaten, Kontaktspray, Brandschutz-Acryl, Lötzinn – beim Lötzinn fehlt das SDB).",
    daten: (h) => ({ stand: "2026-02-03", verantwortlich: "Jens Brandt", stoffe: eintraege("gefahrstoffverzeichnis", "stoffe", STOFFE, h) }) });
  dok({ id: "ba1", vorlage: "betriebsanweisung", datum: "2026-02-03", worum: "Betriebsanweisung BA-01 Gießharz für Kabelmuffen (Epoxidharz, sensibilisierend).",
    daten: () => ({ stoff: "Gießharz für Kabelmuffen (2-Komponenten-Epoxidharz)", arbeitsbereich: "Baustelle beim Kunden", nummer: "BA-01",
      gefahren: "Kann allergische Hautreaktionen verursachen (H317).\nVerursacht Hautreizungen und schwere Augenreizung (H315, H319).\nGiftig für Wasserorganismen mit langfristiger Wirkung (H411).",
      schutz: ["Schutzhandschuhe bei den gekennzeichneten Tätigkeiten tragen.", "Beschädigte Handschuhe sofort austauschen.", "Bei ätzenden Stoffen Schutzbrille tragen.", "Für ausreichende Lüftung sorgen; Sprühnebel, Stäube und Dämpfe nicht einatmen.", "Am Arbeitsplatz nicht essen, trinken oder rauchen.", "Harz und Härter nur im Mischbeutel anmischen; Hautkontakt vermeiden, Nitrilhandschuhe tragen."].join("\n"),
      gefahrfall: "Verschüttete Substanz sofort mit Schutzhandschuhen aufnehmen.\nVerunreinigungen und Behälterrückstände sofort beseitigen; Bindemittel bereithalten.",
      erste_hilfe: "Nach Augenkontakt: mit viel Wasser spülen und ärztlichen Rat einholen.\nNach Hautkontakt: mit viel Wasser spülen; bei Beschwerden ärztlichen Rat einholen.\nZum Arzt Gebrauchsanweisung oder Packung bzw. Behältnis des Produkts mitnehmen.",
      entsorgung: "Ausgehärtete Reste als Hausmüll/Gewerbeabfall; nicht ausgehärtete Reste und Gebinde über den Lieferanten bzw. als Sonderabfall.\nEntsorgung mit der örtlichen Gewerbeabfallberatung klären.",
      notruf: "Notruf 112 – Ersthelfer Tobias Reinartz, Giftinformationszentrum Bonn 0228 19240", erstellt_von: "Jens Brandt", datum: "2026-02-03" }) });
  dok({ id: "ba2", vorlage: "betriebsanweisung", datum: "2026-02-03", worum: "Betriebsanweisung BA-02 PU-Montageschaum (Diisocyanate, extrem entzündbares Aerosol).",
    daten: () => ({ stoff: "PU-Montageschaum B2 (Diisocyanate)", arbeitsbereich: "Baustelle beim Kunden", nummer: "BA-02",
      gefahren: "Extrem entzündbares Aerosol; Behälter steht unter Druck (H222, H229).\nKann bei Einatmen Allergie, asthmaartige Symptome oder Atembeschwerden verursachen (H334); kann allergische Hautreaktionen verursachen (H317).\nKann vermutlich Krebs erzeugen (H351).",
      schutz: "Nur mit nachgewiesener Schulung zu Diisocyanaten verwenden.\nSchutzhandschuhe und Schutzbrille tragen; für Lüftung sorgen.\nVon Zündquellen fernhalten, nicht rauchen; Dose nicht über 50 °C erwärmen (Werkstattwagen im Sommer).",
      gefahrfall: "Frischen Schaum mit Reiniger entfernen, ausgehärteten mechanisch.\nBei Brand: Dosen aus dem Brandbereich entfernen, Feuerwehr 112.",
      erste_hilfe: "Nach Einatmen: an die frische Luft, bei Atembeschwerden Arzt.\nNach Hautkontakt: sofort mit Wasser und Seife waschen.\nNach Augenkontakt: mindestens 10 Minuten spülen, Augenarzt.",
      entsorgung: "Restentleerte Spraydosen sicher entsorgen; auch geleerte Behälter entzündbarer Flüssigkeiten können Brand- und Explosionsgefahr verursachen.\nNicht entleerte Dosen als Sonderabfall.",
      notruf: "Notruf 112 – Ersthelfer Tobias Reinartz", erstellt_von: "Jens Brandt", datum: "2026-02-03" }) });

  const geraeteBaustelle: Eintrag[] = [
    ["Bohrhammer", "Akku-Kombihammer 18 V (Ladegerät)", "EB-01", "Werkstattwagen", "bestanden", ""], ["Mauernutfräse", "MF 150 mit Absaugung", "EB-02", "Werkstattwagen", "bestanden", ""], ["Kernbohrgerät (Netz)", "KB 160", "EB-03", "Werkstattwagen", "bestanden", ""],
    ["Industriestaubsauger Klasse M", "ISS 35 M", "EB-04", "Werkstattwagen", "bestanden", ""], ["Kabeltrommel 50 m", "H07RN-F 3G2,5, IP44", "EB-05", "Werkstattwagen", "bestanden", ""], ["Kabeltrommel 25 m", "H07RN-F 3G1,5", "EB-06", "Werkstattwagen", "maengel", "Mantel eingeschnitten – Leitung gekürzt und neu angeschlossen, Wiederholungsprüfung bestanden"],
    ["Baustromverteiler klein", "PRCD-S, 3 × Schuko, 1 × CEE 16 A", "EB-07", "Lager", "bestanden", ""], ["Baustrahler LED", "50 W, IP65", "EB-08", "Werkstattwagen", "bestanden", ""], ["Akku-Ladegerät", "18 V Schnellladegerät", "EB-09", "Werkstattwagen", "bestanden", ""],
  ].map(([bezeichnung, typ, inventar, standort, ergebnis, maengel]) => ({ bezeichnung: bezeichnung!, typ: typ!, inventar: inventar!, standort: standort!, ergebnis: ergebnis!, maengel: maengel!, naechste: "2026-12-14" }));
  dok({ id: "pruef-baustelle", vorlage: "pruefprotokoll_elektro", datum: "2026-09-14", worum: "DGUV-V3-Prüfung der BAUSTELLENGERÄTE durch den Betrieb selbst (Elektrotechnikermeister): 9 Geräte, Einsatz Baustelle (Richtwert 3 Monate), eine Kabeltrommel instandgesetzt; nächste Prüfung 14.12.2026.",
    daten: (h) => ({ pruefer: "Elektro Brandt, Elektrotechnikermeister Jens Brandt (Elektrofachkraft)", datum: "2026-09-14", messgeraet: "Gerätetester VDE 0701-0702 (kalibriert 11/2025)", pruefart: "Wiederholungsprüfung", umfang: ["Sichtprüfung", "Messung des Schutzleiterwiderstands", "Messung des Isolationswiderstands", "Messung des Schutzleiter- bzw. Berührungsstroms", "Funktionsprüfung"], norm: "DIN EN 50678 (VDE 0701) / DIN EN 50699 (VDE 0702)", einsatz: "baustellen", leerzeilen: false, geraete: eintraege("pruefprotokoll_elektro", "geraete", geraeteBaustelle, h) }) });
  const geraeteWerkstatt: Eintrag[] = [
    ["Standbohrmaschine", "SB 25", "EW-01", "Werkstatt", "bestanden", ""], ["Kappsäge", "KS 216", "EW-02", "Werkstatt", "bestanden", ""], ["Lötstation", "LS 80 W", "EW-03", "Werkstatt", "bestanden", ""],
    ["Verlängerungskabel 10 m", "H05VV-F 3G1,5", "EW-04", "Werkstatt", "bestanden", ""], ["Kaffeemaschine", "Filter 1,2 l", "EW-05", "Pausenraum", "bestanden", ""], ["Computer mit Netzteil", "Büro-PC", "EW-06", "Büro", "bestanden", ""], ["Drucker", "Laser s/w", "EW-07", "Büro", "bestanden", ""],
  ].map(([bezeichnung, typ, inventar, standort, ergebnis, maengel]) => ({ bezeichnung: bezeichnung!, typ: typ!, inventar: inventar!, standort: standort!, ergebnis: ergebnis!, maengel: maengel!, naechste: "2027-02-09" }));
  dok({ id: "pruef-werkstatt", vorlage: "pruefprotokoll_elektro", datum: "2026-02-09", worum: "DGUV-V3-Prüfung der Werkstatt- und Bürogeräte durch den Betrieb selbst: 7 Geräte, Einsatz Werkstatt; nächste Prüfung 09.02.2027.",
    daten: (h) => ({ pruefer: "Elektro Brandt, Elektrotechnikermeister Jens Brandt (Elektrofachkraft)", datum: "2026-02-09", messgeraet: "Gerätetester VDE 0701-0702 (kalibriert 11/2025)", pruefart: "Wiederholungsprüfung", umfang: ["Sichtprüfung", "Messung des Schutzleiterwiderstands", "Messung des Isolationswiderstands", "Funktionsprüfung"], norm: "DIN EN 50678 (VDE 0701) / DIN EN 50699 (VDE 0702)", einsatz: "fertigungsstaetten_werkstaetten_oder_unt", leerzeilen: false, geraete: eintraege("pruefprotokoll_elektro", "geraete", geraeteWerkstatt, h) }) });

  // ---------------------------------------------------------------- Umsatzsteuer-Voranmeldungen Q1–Q4 (Soll, Übernahme – keine Kasse)
  const erwartetQ = D.ustQuartale();
  const ust: Bau["ust"] = [];
  const vaDatum = ["2026-04-08", "2026-07-08", "2026-10-08", "2027-01-08"];
  for (const [i, eq] of erwartetQ.entries()) {
    const id = `ust-q${i + 1}`;
    let app: Record<string, string> = {};
    let anzahl = 0;
    let ersatz = 0;
    dok({ id, vorlage: "ust_voranmeldung", datum: vaDatum[i]!, worum: `USt-Voranmeldung ${i + 1}. Quartal 2026 (Soll): „Aus Rechnungen übernehmen“ (umsaetzeFuer) und Vorsteuer aus Belegen; nichts von Hand ergänzt (kein Hinweis der App, dass etwas fehlt).`,
      daten: () => ({}),
      danach: (u) => {
        const erg = umsaetzeFuer(s.unterlagen, eq.q, s.betrieb, u.daten.versteuerung === "ist" ? "ist" : "soll", s.belege);
        if (!erg) {
          auffaellig.push(`umsaetzeFuer(${eq.q}) lieferte null.`);
          return;
        }
        app = erg.werte;
        anzahl = erg.anzahl;
        ersatz = erg.ersatz;
        s = felderSetzen(s, id, { ...erg.werte, notiz: `Aus Rechnungen übernommen (${MARKE.name}, ${erg.anzahl} Rechnungen, davon ${erg.ersatz} nach Rechnungsdatum zugeordnet). Vorsteuer aus ${erg.vorsteuerBelege} Belegen${erg.ohneVorsteuer ? `, ${erg.ohneVorsteuer} mit USt ohne Vorsteuerabzug` : ""}.` }, t(vaDatum[i]!, 9));
      } });
    const u = unterlage(id);
    const grund19 = eq.skonto19 ? `Skonto-Minderung ${euro(eq.skonto19)} € (Zahlung 2026-021 am 09.10. mit 2 %) – seit R12 als Minderung im Zeitraum der Zahlung vermerkt.` : "";
    // Rechnungen, die die App wegen eines Leistungszeitraums (Text statt Datum) nach dem Rechnungsdatum einordnet, bzw. Abschläge
    const verschoben = D.vorgaenge().filter((x) => x.art === "rechnung" && (x.r.abschlag || (x.r.leistungText && !/^\d{2}\.\d{2}\.\d{4}$/.test(x.r.leistungText))) && D.steuerQuartal(x).q !== D.quartal(x.datum) && (D.steuerQuartal(x).q === eq.q || D.quartal(x.datum) === eq.q));
    const grundAbschlag = verschoben.map((x) => `${x.nummer} (${x.r.abschlag ? "Abschlag vor Ausführung, Steuer mit Zahlung am " + D.de(x.bezahlt!) + " – Mindest-Ist, § 13 Abs. 1 Nr. 1 a Satz 4 UStG" : "Leistungszeitraum „" + x.r.leistungText + "“ endet im " + D.steuerQuartal(x).q}) zählt die App nach dem Rechnungsdatum ${D.de(x.datum)} in ${D.quartal(x.datum)}, gesetzlich in ${D.steuerQuartal(x).q}`).join("; ");
    vergleich(`USt ${eq.q} (Übernahme, Soll)`, "Umsätze 19 % (Kz 81)", ausEuro(app.umsatz_19 ?? "0"), eq.r19, [grundAbschlag, grund19].filter(Boolean).join(" "));
    vergleich(`USt ${eq.q} (Übernahme, Soll)`, "Umsätze ohne USt = § 13b-Bauleistungen (Kz 60) + Nullsteuersatz PV (Kz 87)", ausEuro(app.umsatz_13b ?? "0") + ausEuro(app.umsatz_87 ?? "0") + ausEuro(app.umsatz_frei ?? "0"), eq.r13b + eq.rNull);
    vergleich(`USt ${eq.q} (Übernahme aus Belegen)`, "Vorsteuer aus Rechnungen (Kz 66)", ausEuro(app.vorsteuer ?? "0"), eq.vorsteuer66);
    if (eq.r13b) vergleichText(`USt ${eq.q} (Formular)`, `§ 13b-Bauleistungen als eigene Kennzahl 60 (${euro(eq.r13b)} €)`, ausEuro(app.umsatz_13b ?? "0") === eq.r13b ? "Kz 60" : `nein – Kz 60: ${app.umsatz_13b ?? "fehlt"} €`, "Kz 60", "Die Voranmeldung hat keine Zeile für Kz 60; der Hinweistext nennt 41, 43 und 21, nicht 60 (packages/fachlogik/src/dokumente/buchhaltung.ts:693).");
    if (eq.rNull) vergleichText(`USt ${eq.q} (Formular)`, `Nullsteuersatz-Umsätze PV als eigene Kennzahl (${euro(eq.rNull)} €)`, ausEuro(app.umsatz_87 ?? "0") === eq.rNull ? "Kz 87" : `nein – Kz 87: ${app.umsatz_87 ?? "fehlt"} €`, "Kz 87");
    if (eq.kz84) vergleichText(`USt ${eq.q} (Formular)`, `empfangene § 13b-Bauleistung Kz 84 ${euro(eq.kz84)} € / Kz 85 ${euro(eq.kz85)} € / Kz 67 ${euro(eq.kz67)} €`, `Kz 84 ${euro(ausEuro(app.rc_bau_netto ?? "0"))} € / Kz 85 ${euro(ausEuro(app.rc_bau_steuer ?? "0"))} € / Kz 67 ${euro(ausEuro(app.vorsteuer_13b ?? "0"))} €`, `Kz 84 ${euro(eq.kz84)} € / Kz 85 ${euro(eq.kz85)} € / Kz 67 ${euro(eq.kz67)} €`);
    const erg = v("ust_voranmeldung").ergebnis!(u.daten);
    vergleich(`USt ${eq.q} (fertige Voranmeldung)`, "Zahllast (mit Cent)", ausEuro(erg[2]![1]) * (erg[2]![0] === "Erstattung" ? -1 : 1), eq.zahllast, [grundAbschlag, grund19].filter(Boolean).join(" "));
    ust.push({ q: eq.q, app, appAnzahl: anzahl, ersatz, final: Object.fromEntries(["umsatz_19", "umsatz_7", "umsatz_igl", "umsatz_48", "umsatz_13b", "umsatz_87", "umsatz_frei", "rc_bau_netto", "rc_bau_steuer", "vorsteuer", "vorsteuer_13b"].map((k) => [k, String(u.daten[k] ?? "")])) });
  }

  // ---------------------------------------------------------------- EÜR 2026 (Übernahme + USt-Zahlungen und AfA von Hand)
  const eu = D.euerUnabhaengig();
  let uebernahme!: ReturnType<typeof euerUebernahme>;
  dok({ id: "euer", vorlage: "euer", datum: "2027-02-15", worum: "EÜR 2026: „Aus Rechnungen und Belegen übernehmen“, danach wie von der App verlangt ergänzt: an das Finanzamt gezahlte USt (Q4/2025, Q1–Q3/2026) und AfA Installationstester. Skonto kommt aus dem Zahlungseingang (R12).",
    daten: () => ({}),
    danach: () => {
      uebernahme = euerUebernahme(s, "2026");
      s = felderSetzen(s, "euer", { jahr: "2026", einnahmen: uebernahme.einnahmen, ausgaben: uebernahme.ausgaben }, t("2027-02-15", 9));
      const zahl = (l: Record<string, string>[], k: string) => l.filter((x) => x.kategorie === k).reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0);
      const skontoGrund = `Skonto 2026-021 (${euro(eu.skontoSumme)} € brutto) mindert den Zufluss (seit R12 beim Zahlungseingang vermerkt).`;
      vergleich("EÜR-Übernahme", "Umsatzsteuerpflichtige Betriebseinnahmen (19 % netto + Nullsteuersatz PV)", zahl(uebernahme.einnahmen, EUER_ZEILE_STEUERPFLICHTIG), eu.rePflichtig, `${skontoGrund} PV zum Nullsteuersatz (${euro(eu.reNull)} €) stellt die App in die Zeile „umsatzsteuerfrei …“ (Steuerart „befreit“, apps/mobile/src/unterlagen/steuerpaket.ts:117).`);
      vergleich("EÜR-Übernahme", "Einnahmen für die der Empfänger die USt nach § 13b schuldet (Zeile „steuerfrei … § 13b“)", zahl(uebernahme.einnahmen, EUER_ZEILE_STEUERFREI), eu.re13b, "Nullsteuersatz-PV gehört nicht in diese Zeile (fachlich bestätigen).");
      vergleich("EÜR-Übernahme", "Vereinnahmte USt aus Rechnungen", zahl(uebernahme.einnahmen, "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben"), eu.reUst, skontoGrund);
      vergleich("EÜR-Übernahme", "Gezahlte Vorsteuer", zahl(uebernahme.ausgaben, "Gezahlte Vorsteuerbeträge"), eu.vorsteuer);
      vergleich("EÜR-Übernahme", "Betriebsausgaben aus Belegen (ohne Vorsteuer, ohne Anlage)", uebernahme.ausgaben.filter((x) => x.kategorie !== "Gezahlte Vorsteuerbeträge").reduce((a, x) => a + ausEuro(x.betrag ?? "0"), 0), eu.ausgabenBelege);
      for (const [kat, w] of Object.entries(eu.nachKategorie)) {
        const titel = kategorieFuer(kat).titel;
        const z = uebernahme.ausgaben.find((x) => (x.text ?? "").startsWith(titel));
        vergleich("EÜR-Übernahme", `Kategorie ${titel}`, z ? ausEuro(z.betrag ?? "0") : 0, w.betrag);
      }
      vergleichText("EÜR-Übernahme", "Anlagen über 800 € gemeldet", String(uebernahme.anlagen), "1");
      vergleichText("EÜR-Übernahme", "geteilte Rechnungen 2026 ohne Zahlungseingang (Stand Jahresende inkl. Zahlungen 2027)", String(uebernahme.unbezahlt), "0");
      vergleichText("EÜR-Übernahme", "Hinweis: USt-Vorauszahlungen und AfA selbst ergänzen", /Umsatzsteuer-Vorauszahlungen/.test(uebernahme.hinweis) && /AfA/.test(uebernahme.hinweis) ? "ja" : "nein", "ja");
      const d = unterlage("euer").daten;
      const imJahrQ = erwartetQ.filter((q) => D.UST_ZAHLTAGE[q.q]!.startsWith("2026-"));
      const aus = [...(d.ausgaben as Eintrag[]),
        { datum: D.UST_Q4_2025.gezahlt, text: "USt-Vorauszahlung Q4/2025", kategorie: "An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer", betrag: euro(D.UST_Q4_2025.betrag) },
        ...imJahrQ.filter((q) => q.elsterZahllast > 0).map((q) => ({ datum: D.UST_ZAHLTAGE[q.q]!, text: `USt-Vorauszahlung ${q.q.replace("2026-", "")}/2026 (laut ELSTER)`, kategorie: "An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer", betrag: euro(q.elsterZahllast) }))];
      // Überschuss (Erstattung) ist eine Betriebseinnahme, keine negative Ausgabe
      const ein = [...(d.einnahmen as Eintrag[]), ...imJahrQ.filter((q) => q.elsterZahllast < 0).map((q) => ({ datum: D.UST_ZAHLTAGE[q.q]!, text: `USt-Erstattung ${q.q.replace("2026-", "")}/2026 (laut ELSTER)`, kategorie: "Vom Finanzamt erstattete und gegebenenfalls verrechnete Umsatzsteuer", betrag: euro(-q.elsterZahllast) }))];
      const anlage = D.BELEGE.find((b) => b.id === D.AFA.beleg)!;
      s = felderSetzen(s, "euer", { einnahmen: ein, ausgaben: aus, afa: [{ text: `Installationstester (${euro(D.belegSumme(anlage).netto)} € netto, 04/2026, 5 Jahre, 9/12)`, betrag: euro(eu.afa) }] }, t("2027-02-15", 10));
    } });
  const euerErgebnis = v("euer").ergebnis!(unterlage("euer").daten);
  {
    const g = euerErgebnis.find((z) => z[0] === "Gewinn" || z[0] === "Verlust")!;
    const grund = `Skonto ${euro(eu.skontoSumme)} € beim Zahlungseingang abgezogen (R12).`;
    vergleich("EÜR 2026 (fertig)", "Summe Betriebseinnahmen", ausEuro(euerErgebnis[0]![1]), eu.einnahmen, grund);
    vergleich("EÜR 2026 (fertig)", "Summe Betriebsausgaben", ausEuro(euerErgebnis[1]![1]), eu.ausgaben);
    vergleich("EÜR 2026 (fertig)", "AfA", ausEuro(euerErgebnis[2]![1]), eu.afa);
    vergleich("EÜR 2026 (fertig)", "Gewinn", ausEuro(g[1]) * (g[0] === "Verlust" ? -1 : 1), eu.ergebnis, grund);
  }

  // ---------------------------------------------------------------- Steuererklärung (Zusammenstellung)
  const vaSumme = (k: string) => [1, 2, 3, 4].reduce((a, q) => a + ausEuro(String(unterlage(`ust-q${q}`).daten[k] ?? "0")), 0);
  const ustJahr = [1, 2, 3, 4].reduce((a, q) => a + ausEuro(v("ust_voranmeldung").ergebnis!(unterlage(`ust-q${q}`).daten)[0]![1]), 0);
  const gewinn = euerErgebnis.find((z) => z[0] === "Gewinn" || z[0] === "Verlust")!;
  dok({ id: "steuer", vorlage: "steuererklaerung", datum: "2027-03-01", worum: "Zusammenstellung für ESt, GewSt und USt 2026: Gewinn aus der EÜR, Umsätze/USt/Vorsteuer als Summe der vier Voranmeldungen, ESt-Vorauszahlungen 4 × 2.400 €, GewSt 4 × 650 €, Kranken-/Pflegeversicherung, Rentenversicherung (Handwerkerpflichtversicherung).",
    daten: (h) => ({ jahr: "2026", arten: ["est", "gewst", "ust"], gewinn: `${gewinn[0] === "Verlust" ? "-" : ""}${gewinn[1].replace(/[€\s\u00a0]/g, "")}`, umsatz: euro(vaSumme("umsatz_19") + vaSumme("umsatz_7") + (vaSumme("umsatz_frei") + vaSumme("umsatz_igl") + vaSumme("umsatz_48") + vaSumme("umsatz_13b") + vaSumme("umsatz_87"))), ust_jahr: euro(ustJahr), vorsteuer_jahr: euro(vaSumme("vorsteuer") + vaSumme("vorsteuer_13b")),
      vorauszahlungen: eintraege("steuererklaerung", "vorauszahlungen", [...[1, 2, 3, 4].map((q) => ({ art: `Einkommensteuer Q${q}`, betrag: "2.400,00" })), ...[1, 2, 3, 4].map((q) => ({ art: `Gewerbesteuer Q${q}`, betrag: "650,00" }))], h),
      weiteres: eintraege("steuererklaerung", "weiteres", [{ was: "Kranken- und Pflegeversicherung (freiwillig gesetzlich)", betrag: "8.412,00", beleg: true }, { was: "Pflichtbeiträge Rentenversicherung als Handwerker (Handwerksrolle, § 2 Satz 1 Nr. 8 SGB VI)", betrag: "8.234,40", beleg: true }], h),
      notiz: "Umsatzsteuer: Skonto 2026-021 mit der Steuerberatung abstimmen." }) });
  {
    const j = D.jahresSummen();
    vergleich("Steuererklärung", "Umsätze im Jahr netto (Summe der Voranmeldungen)", vaSumme("umsatz_19") + vaSumme("umsatz_7") + (vaSumme("umsatz_frei") + vaSumme("umsatz_igl") + vaSumme("umsatz_48") + vaSumme("umsatz_13b") + vaSumme("umsatz_87")), j.r19 + j.r13b + j.rNull, "Skonto fehlt.");
    vergleich("Steuererklärung", "Umsatzsteuer im Jahr (Summe der Voranmeldungen, mit Cent)", ustJahr, j.ust, "Skonto-Minderung fehlt.");
    vergleich("Steuererklärung", "Vorsteuer im Jahr (Kz 66 + Kz 67)", vaSumme("vorsteuer") + vaSumme("vorsteuer_13b"), j.vorsteuer);
  }

  // ---------------------------------------------------------------- Kontrollmappe (Auswahl wie in der App)
  const auswahl = mappenAuswahl(s);
  const erwartetMappe = ["gb-baustelle", "gb-werkstatt", "unterweisung", "unterweisung-azubi", "gefahrstoffe", "ba1", "ba2", "pruef-baustelle", "pruef-werkstatt", "azn1", "azn3", "nachweis1", "nachweis2", "vvt", "avv", "dsinfo"];
  {
    const ids = new Set(auswahl.eintraege.map((e) => e.id));
    vergleichText("Kontrollmappe (mappenAuswahl)", "fehlende Nachweise", erwartetMappe.filter((x) => !ids.has(x)).join(", ") || "keine", "keine", erwartetMappe.some((x) => x.startsWith("pruef") && !ids.has(x)) ? "Prüfprotokolle werden nach dem Namensfeld „datum“ (Zeitfeld) zusammengefasst – nur das neueste Protokoll kommt in die Mappe, obwohl Baustellen- und Werkstattgeräte getrennte Protokolle mit eigenen Fristen haben (apps/mobile/src/unterlagen/kontrollmappe.ts:20, 56–60)." : "");
    vergleichText("Kontrollmappe (mappenAuswahl)", "zusätzliche Unterlagen", auswahl.eintraege.filter((e) => !erwartetMappe.includes(e.id)).map((e) => e.id).join(", ") || "keine", "keine");
  }

  // ---------------------------------------------------------------- übersprungene Vorlagen
  uebersprungen.push(
    { id: "bilanz_guv", titel: v("bilanz_guv").titel, grund: "Einzelunternehmen ohne Handelsregistereintrag unter den Grenzen des § 141 AO – Gewinnermittlung per EÜR." },
    { id: "handelsregister", titel: v("handelsregister").titel, grund: "Kein Eintrag (kein e. K.)." },
    // StB-Prüfung (5.2, C-9): OSS-Erklärung und Zusammenfassende Meldung (Übertragungshilfen, neu)
    { id: "oss_meldung", titel: v("oss_meldung").titel, grund: "Nur Kunden im Inland – kein OSS-Verfahren." },
    { id: "zm_meldung", titel: v("zm_meldung").titel, grund: "Keine innergemeinschaftlichen Lieferungen oder Leistungen an Unternehmen im EU-Ausland." },
    { id: "transparenzregister", titel: v("transparenzregister").titel, grund: "Gilt nicht für Einzelunternehmen." },
    { id: "kassenbuch", titel: v("kassenbuch").titel, grund: "Keine Bareinnahmen; die wenigen Bareinkäufe laufen über die Portokasse des Inhabers (Belege b38–b40)." },
    { id: "kassenmeldung", titel: v("kassenmeldung").titel, grund: "Keine elektronische Kasse." },
    { id: "ki_kompetenz", titel: v("ki_kompetenz").titel, grund: "Keine KI-Nutzung im Betrieb (Profil)." },
    { id: "datenpanne", titel: v("datenpanne").titel, grund: "Keine Datenpanne im Jahr 2026." },
    { id: "ifsg_belehrung", titel: v("ifsg_belehrung").titel, grund: "Kein Lebensmittelbetrieb." },
    { id: "allergene", titel: v("allergene").titel, grund: "Kein Lebensmittelbetrieb." },
    { id: "haccp", titel: v("haccp").titel, grund: "Kein Lebensmittelbetrieb." },
    { id: "hautschutzplan", titel: v("hautschutzplan").titel, grund: "Beauty-Vorlage; Hautschutz ist für das Elektrohandwerk in der Gefährdungsbeurteilung (Gießharz, PU-Schaum) behandelt." },
    { id: "hygieneplan", titel: v("hygieneplan").titel, grund: "Beauty-Vorlage." },
  );
  const genutzt = new Set(docs.map((d) => d.vorlage));
  for (const vl of VORLAGEN) if (!genutzt.has(vl.id) && !uebersprungen.some((u) => u.id === vl.id)) auffaellig.push(`Vorlage ${vl.id} weder erzeugt noch als übersprungen begründet.`);

  // ---------------------------------------------------------------- Pflichten-Check der App für diesen Betrieb
  const stichtag = "2026-01-15";
  const a = auswertung(s.profil, stichtag, s.unterlagen.filter((u) => (u.ausgegeben ?? "") < "2026-01-16"), s.mitarbeiter);
  const zeile = (p: PflichtInfo): PflichtZeile => ({ id: p.id, titel: p.titel, vorlage: p.vorlage, vorlagen: p.vorlagen, erzeugt: !!p.vorlage && genutzt.has(p.vorlage), termin: p.naechsterTermin, termine: p.termine.length, grund: p.grund, erklaerung: p.erklaerung });
  const istDa = (id: string) => (a.gilt.some((p) => p.id === id) ? "gilt" : a.gruendung.some((p) => p.id === id) ? "gilt (Gründung)" : a.unbekannt.some((p) => p.id === id) ? "unklar" : "fehlt");
  const ERWARTET: [string, "gilt" | "fehlt", string][] = [
    ["steuern.euer", "gilt", "Einzelunternehmen, EÜR"],
    ["steuern.est_erklaerung", "gilt", "§ 25 EStG"],
    ["steuern.gewst_erklaerung", "gilt", "Gewerbebetrieb"],
    ["steuern.ust_voranmeldung", "gilt", "vierteljährlich (Zahllast Vorjahr 8.600 € ≤ 9.000 €, § 18 Abs. 2 UStG)"],
    ["steuern.ust_jahreserklaerung", "gilt", "§ 18 Abs. 3 UStG"],
    ["steuern.e_rechnung_empfang", "gilt", "seit 2025"],
    ["personal.lohnsteuer_anmeldung", "gilt", "monatlich (Profil)"],
    ["personal.jugendarbeitsschutz", "gilt", "1 Jugendlicher"],
    ["arbeitsschutz.gefaehrdungsbeurteilung", "gilt", "Beschäftigte"],
    ["arbeitsschutz.unterweisung_wiederholen", "gilt", "§ 12 ArbSchG"],
    ["arbeitsschutz.dguv_v3", "gilt", "elektrische Geräte"],
    ["arbeitsschutz.gefahrstoffe", "gilt", "Gießharz, PU-Schaum"],
    ["arbeitsschutz.fasi_betriebsarzt", "gilt", "ASiG/DGUV V2"],
    ["branche.handwerk_gefaehrdung_gewerk", "gilt", "Handwerk"],
    ["online.impressum", "gilt", "Website"],
    ["online.datenschutzerklaerung", "gilt", "Website"],
    ["datenschutz.vvt", "gilt", "Beschäftigtendaten"],
    ["steuern.kassenmeldung", "fehlt", "keine elektronische Kasse"],
    ["personal.minijob_grenze", "fehlt", "keine Minijobber"],
    ["steuern.bauabzugsteuer_freistellung", "gilt", "Bauleistungen an Unternehmer (Generalunternehmer) und empfangene Bauleistung – § 48 ff. EStG gilt unabhängig von der Branchenwahl „Bau“"],
  ];
  for (const [id, soll, warum] of ERWARTET) {
    const ist = istDa(id);
    vergleichText(`Pflichten-Check (${D.de(stichtag)})`, `${id} (${warum})`, ist === "gilt (Gründung)" && soll === "gilt" ? "gilt" : ist, soll, id === "steuern.bauabzugsteuer_freistellung" ? "Der Katalog löst die Pflicht nur mit der Branche „Bau“ aus (Auslöser profil.taetigkeit.branchen enthält „bau“)." : id === "arbeitsschutz.unterweisung_wiederholen" ? `Auslöser ist das Ereignis „unterweisung_durchgefuehrt“ aus einer in der App ausgegebenen Unterweisung – ein Betrieb mit Beschäftigten seit 2017 sieht die jährliche Wiederholung erst, nachdem er eine Unterweisung in ${MARKE.name} erfasst hat (bis dahin nur die Erstunterweisung).` : "");
  }
  vergleichText(`Pflichten-Check (${D.de(stichtag)})`, "gruendung.handwerksrolle vorhanden (Anlage A)", istDa("gruendung.handwerksrolle") === "fehlt" ? "fehlt" : "vorhanden", "vorhanden");
  vergleichText(`Pflichten-Check (${D.de(stichtag)})`, "gruendung.rentenversicherungspflicht (Handwerker in der Handwerksrolle)", istDa("gruendung.rentenversicherungspflicht") === "fehlt" ? "fehlt" : "vorhanden", "vorhanden");
  const termin = (id: string) => [...a.gilt, ...a.gruendung].find((p) => p.id === id)?.naechsterTermin ?? "–";
  vergleichText(`Pflichten-Check (${D.de(stichtag)})`, "USt-Voranmeldung: nächster Termin (Q1 → 10.04.2026)", termin("steuern.ust_voranmeldung"), "2026-04-10");
  vergleichText(`Pflichten-Check (${D.de(stichtag)})`, "Lohnsteuer-Anmeldung: nächster Termin (Januar → 10.02.2026)", termin("personal.lohnsteuer_anmeldung"), "2026-02-10");
  const ende = auswertung(s.profil, "2026-12-31", s.unterlagen).gilt.find((p) => p.id === "arbeitsschutz.unterweisung_wiederholen");
  vergleichText("Pflichten-Check (31.12.2026)", "Unterweisung wiederholen – nächster Termin (jährlich 20.01.2026 → 20.01.2027; Azubi halbjährlich: 20.01.2027 nach der Unterweisung vom 20.07.2026)", ende?.naechsterTermin ?? "fehlt", "2027-01-20");
  // Variante: dieselbe Firma wählt zusätzlich die Branche „Bau“ und die Sofortmeldebranche „Bau“ – was ändert sich?
  const pv: Profil = { ...s.profil, "taetigkeit.branchen": ["handwerk", "bau"], "personal.sofortmeldebranchen": ["bau"] };
  const av = auswertung(pv, stichtag, s.unterlagen.filter((u) => (u.ausgegeben ?? "") < "2026-01-16"));
  const vorher = new Set([...a.gilt, ...a.gruendung].map((p) => p.id));
  const nachher = new Set([...av.gilt, ...av.gruendung].map((p) => p.id));
  const variante = { neu: [...av.gilt, ...av.gruendung].filter((p) => !vorher.has(p.id)).map(zeile), weg: [...vorher].filter((id) => !nachher.has(id)) };
  const pflichten = { stichtag, gilt: a.gilt.map(zeile), gruendung: a.gruendung.map(zeile), unbekannt: a.unbekannt.map((p) => ({ titel: p.titel, fragen: p.offeneFragen })), variante };
  for (const p of pflichten.gilt) if (p.vorlage && !p.erzeugt) auffaellig.push(`Pflichten-Check: „${p.titel}“ gilt, die zugehörige Vorlage ${p.vorlage} wurde im Szenario nicht erzeugt.`);
  const belegt = new Set([...a.gilt, ...a.gruendung].flatMap((p) => p.vorlagen));
  for (const vid of genutzt) if (!belegt.has(vid) && vid !== "rechnung") infos.push(`Pflichten-Check: keine geltende Pflicht verweist auf die erzeugte Vorlage „${v(vid).titel}“ (${vid}).`);

  return { s, docs, auffaellig, infos, belegDateien, xmls, ohneXml, vergleiche, ust, euer: { uebernahme, ergebnis: euerErgebnis }, erinnerung, mappe: { ...auswahl, erwartet: erwartetMappe }, uebersprungen, pflichten };
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

/** Steuerberater-Pakete Q4 und Jahr – mit Belegdateien und (wie in der App) den Rechnungs-PDFs */
export function pakete(s: Stand, dateien: Record<string, Uint8Array>, rechnungsPdfs: Record<string, Uint8Array>): { q4: PaketErgebnis; jahr: PaketErgebnis } {
  const sb = s.steuerberatung;
  return {
    q4: steuerpaket(s, { von: "2026-10-01", bis: "2026-12-31", name: "2026-Q4" }, sb, dateien, "2027-01-15T09:30:00", { rechnungsPdfs }),
    jahr: steuerpaket(s, { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, sb, dateien, "2027-02-15T10:00:00", { rechnungsPdfs }),
  };
}

// ---------------------------------------------------------------- Belegdateien (so, wie die Lieferanten sie ausstellen würden)

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function belegHtml(b: D.BelegRoh): string {
  const sm = D.belegSumme(b);
  const [str, ort] = b.anschrift.split("\n");
  const bon = b.art === "brutto" && b.kategorie !== "versicherungen" && b.kategorie !== "personal" && b.kategorie !== "fahrzeug" ? true : b.art === "brutto" && /Bon|Ticket/.test(b.nummer ?? "");
  const eigen = b.kategorie === "personal";
  const kopf = `<div class="lief"><strong>${esc(b.lieferant)}</strong><br>${esc(str ?? "")}<br>${esc(ort ?? "")}</div>`;
  const zeilen = b.pos.map((x) => `<tr><td>${esc(x.text)}${x.menge ? `<br><small>${esc(x.menge)}</small>` : ""}</td><td class="r">${x.satz} %</td><td class="r">${D.eur(x.betrag)} €</td></tr>`).join("");
  const steuer = sm.jeSatz.map((x) => `<tr><td>${x.satz ? `${b.art === "brutto" ? "enth. " : ""}USt ${x.satz} %` : b.p13b ? "ohne USt (§ 13b UStG)" : "ohne USt"}</td><td class="r">netto ${D.eur(x.netto)} €</td><td class="r">${x.satz ? `${D.eur(x.ust)} €` : "–"}</td></tr>`).join("");
  const css = `body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#222;margin:0}.blatt{${bon ? "width:80mm;margin:10mm auto;border:1px dashed #999;padding:6mm" : "margin:18mm 20mm"}}table{width:100%;border-collapse:collapse;margin-top:6mm}td,th{padding:3px 4px;border-bottom:1px solid #ddd;vertical-align:top}th{text-align:left;border-bottom:2px solid #444}.r{text-align:right;white-space:nowrap}.lief{font-size:${bon ? "10pt" : "11pt"}}h1{font-size:${bon ? "13pt" : "18pt"};margin:6mm 0 2mm}.an{margin-top:10mm}.summe td{font-weight:bold;border-top:2px solid #444}small{color:#666}.rc{margin-top:6mm;font-weight:bold}`;
  const titel = eigen ? "Lohnjournal (Eigenbeleg)" : bon ? "Kassenbon" : b.kategorie === "versicherungen" ? "Beitragsrechnung" : b.lieferant.startsWith("Hauptzollamt") ? "Steuerbescheid (Auszug)" : "Rechnung";
  const an = bon || eigen ? "" : `<div class="an">${esc(D.BETRIEB.name)}<br>Inhaber Jens Brandt<br>${esc(D.BETRIEB.strasse)}<br>${D.BETRIEB.plz} ${D.BETRIEB.ort}${b.p13b ? `<br>USt-IdNr. ${D.BETRIEB.ust_idnr}` : ""}</div>`;
  const fuss = b.zahlung === "bar" ? "Bar bezahlt." : b.zahlung === "privat" ? "Mit EC-Karte bezahlt (Privatkonto des Inhabers)." : eigen ? "Überweisungen laut Lohnabrechnung." : "Zahlbar per Überweisung bzw. SEPA-Lastschrift.";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="blatt">${kopf}${an}
<h1>${titel}${b.nummer ? ` ${esc(b.nummer)}` : ""}</h1><div>Datum: ${D.de(b.datum)}${!bon && !eigen ? ` · Leistung: ${D.de(b.datum)} bzw. laut Positionen` : ""}</div>
<table><tr><th>${bon ? "Artikel" : "Position"}</th><th class="r">USt</th><th class="r">${bon ? "Brutto" : b.art === "netto" ? "Netto" : "Betrag"}</th></tr>${zeilen}</table>
<table>${steuer}<tr class="summe"><td>${bon ? "SUMME" : eigen ? "Summe Personalkosten" : "Rechnungsbetrag"}</td><td></td><td class="r">${D.eur(sm.brutto)} €</td></tr></table>
${b.p13b ? `<p class="rc">Steuerschuldnerschaft des Leistungsempfängers (§ 13b Abs. 2 Nr. 4, Abs. 5 UStG).</p>` : ""}
<p><small>${fuss}${!bon && !eigen ? ` Steuernummer des Lieferanten: 3${b.id.slice(1)}/5${b.id.slice(1)}/0${b.id.slice(1)}19.` : ""}</small></p></div></body></html>`;
}
