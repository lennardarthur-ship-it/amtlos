/**
 * Demo-Server: Finanzen (wie apps/api/src/finanzen.controller.ts). Summen, Pflichtangaben und USt-Voranmeldung kommen
 * aus @amtlos/fachlogik – dieselbe Rechnung wie auf dem Server. Was die Demo nicht kann: PDF/E-Rechnung erzeugen
 * und Dateien aufbewahren (dafür braucht es den Server).
 */
import { fehlendFuerERechnung, summen, umsaetzeNachSatz, ustZeitraum, type Position, type RechnungsDaten } from "@amtlos/fachlogik";
import { fehler, nichtGefunden, ok, type Kontext, type Modul } from "./kontext";

interface Regelwert { id: string; version: number; wert: number; gueltig_ab: string; gueltig_bis: string | null; pruefung?: { status?: string } }
type PosEingabe = Omit<Position, "ust_satz"> & { ust_art: "regel" | "ermaessigt" | null; ust_satz?: number | null };
export interface DemoRechnung {
  id: string; nummer: string | null; status: "entwurf" | "gestellt" | "storniert"; art: "rechnung" | "storno"; storniert_rechnung_id: string | null;
  rechnungsdatum: string | null; leistungsdatum: string | null; faellig_am: string | null; kunde_id: string | null;
  kunde: Record<string, unknown> | null; steller: Record<string, unknown> | null; positionen: PosEingabe[]; kleinunternehmer: boolean; hinweis: string | null;
  netto_cent: number; ust_cent: number; brutto_cent: number; xml_dokument_id: null; pdf_dokument_id: null; gestellt_am: string | null; erstellt_am: string;
}
interface Beleg {
  id: string; belegdatum: string | null; lieferant: string | null; belegnummer: string | null; brutto_cent: number | null; ust_cent: number | null;
  kategorie: string | null; notiz: string | null; quelle: string; storniert: boolean; erfasst_am: string; datei_titel: string; mime: string;
}

const regelwert = (k: Kontext, id: string, stichtag: string) =>
  (k.katalog.regelwerte as unknown as Regelwert[]).find((r) => r.id === id && r.gueltig_ab <= stichtag && (!r.gueltig_bis || r.gueltig_bis >= stichtag));
const kleinunternehmer = (k: Kontext) => k.stand.profil.daten["ust.kleinunternehmer"] === true;
const text = (x: unknown, max = 200) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);
const datum = (x: unknown) => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);

const neuberechnen = (k: Kontext) => k.neuberechnen();

function naechsteNummer(k: Kontext, jahr: number) {
  const z = (k.stand.einstellungen.rechnungsnummern ??= {}) as Record<string, number>;
  z[jahr] = (z[jahr] ?? 0) + 1;
  return `${jahr}-${String(z[jahr]).padStart(4, "0")}`;
}

function stellen(k: Kontext, r: DemoRechnung, daten: RechnungsDaten) {
  const s = summen(daten.positionen, daten.kleinunternehmer);
  Object.assign(r, {
    status: "gestellt", nummer: daten.nummer, rechnungsdatum: daten.rechnungsdatum, steller: daten.steller, kunde: daten.kunde, positionen: daten.positionen,
    kleinunternehmer: daten.kleinunternehmer, netto_cent: s.netto_cent, ust_cent: s.ust_cent, brutto_cent: s.brutto_cent, gestellt_am: k.zeit(),
  });
  neuberechnen(k); // Kleinunternehmer-Wächter
  return r;
}

function positionen(x: unknown): PosEingabe[] | string {
  if (!Array.isArray(x)) return [];
  const aus: PosEingabe[] = [];
  for (const p of x as Record<string, unknown>[]) {
    const bezeichnung = text(p.bezeichnung, 300);
    const menge = Number(p.menge);
    const preis = Number(p.preis_cent);
    if (!bezeichnung || !(menge > 0) || !Number.isInteger(preis) || preis < 0) return "positionen";
    aus.push({ bezeichnung, menge, einheit: (p.einheit as Position["einheit"]) ?? "stueck", preis_cent: preis, ust_art: p.ust_art === "ermaessigt" ? "ermaessigt" : p.ust_art === null ? null : "regel" });
  }
  return aus;
}

export const finanzen: Modul = (a, k) => {
  const { teile: t, methode: m, s } = a;
  if (t[0] !== "v1") return undefined;
  const rechnungen = k.tabelle<DemoRechnung>("rechnungen");
  const kunden = k.tabelle<Record<string, unknown> & { id: string; name: string }>("kunden");
  const belege = k.tabelle<Beleg>("belege");
  const kassen = k.tabelle<Record<string, unknown> & { id: string; ausser_betrieb_am: string | null; angeschafft_am: string }>("kassen");

  if (t[1] === "rechnungssteller") {
    if (m === "GET") return ok(k.stand.einstellungen.rechnungssteller ?? {});
    const d = a.koerper;
    const steller = {
      name: text(d.name), strasse: text(d.strasse), plz: text(d.plz, 10), ort: text(d.ort), land: text(d.land, 2) ?? "DE", email: text(d.email),
      telefon: text(d.telefon, 40), steuernummer: text(d.steuernummer, 40), ust_idnr: text(d.ust_idnr, 20), iban: text(d.iban, 40)?.replace(/\s/g, "") ?? null, bic: text(d.bic, 11),
    };
    if (!steller.name || !steller.strasse || !steller.plz || !steller.ort || !steller.email?.includes("@"))
      return fehler(422, "Bitte Name, Anschrift und E-Mail angeben.", "Please enter name, address and email.", s);
    k.stand.einstellungen.rechnungssteller = steller;
    return ok(steller);
  }

  if (t[1] === "kunden") {
    if (m === "GET") return ok([...kunden].sort((x, y) => x.name.localeCompare(y.name)));
    const d = a.koerper;
    const name = text(d.name);
    if (!name) return fehler(422, "Bitte einen Namen angeben.", "Please enter a name.", s);
    const kunde = { id: k.id("kunde"), name, strasse: text(d.strasse), plz: text(d.plz, 10), ort: text(d.ort), land: text(d.land, 2) ?? "DE", email: text(d.email), ust_idnr: text(d.ust_idnr, 20), kaeufer_referenz: text(d.kaeufer_referenz, 100), geschaeftskunde: d.geschaeftskunde !== false };
    kunden.push(kunde);
    return ok(kunde);
  }

  if (t[1] === "rechnungen") {
    if (t.length === 2 && m === "GET") {
      const kundeName = (r: DemoRechnung) => (r.kunde?.name as string | undefined) ?? kunden.find((x) => x.id === r.kunde_id)?.name ?? null;
      return ok(
        [...rechnungen]
          .sort((x, y) => Number(y.status === "entwurf") - Number(x.status === "entwurf") || (y.rechnungsdatum ?? "9999").localeCompare(x.rechnungsdatum ?? "9999") || (y.nummer ?? "").localeCompare(x.nummer ?? ""))
          .map((r) => ({ ...r, kunde_name: kundeName(r) })),
      );
    }
    if (t.length === 2 && m === "POST") {
      const pos = positionen(a.koerper.positionen);
      if (typeof pos === "string") return fehler(422, "Eine Position ist unvollständig.", "A line item is incomplete.", s);
      const ku = kleinunternehmer(k);
      const r: DemoRechnung = {
        id: k.id("rechnung"), nummer: null, status: "entwurf", art: "rechnung", storniert_rechnung_id: null, rechnungsdatum: null,
        leistungsdatum: datum(a.koerper.leistungsdatum), faellig_am: datum(a.koerper.faellig_am), kunde_id: (a.koerper.kunde_id as string) ?? null,
        kunde: null, steller: null, positionen: ku ? pos.map((p) => ({ ...p, ust_art: null })) : pos, kleinunternehmer: ku, hinweis: text(a.koerper.hinweis, 1000),
        netto_cent: 0, ust_cent: 0, brutto_cent: 0, xml_dokument_id: null, pdf_dokument_id: null, gestellt_am: null, erstellt_am: k.zeit(),
      };
      rechnungen.push(r);
      return ok(r);
    }
    const r = rechnungen.find((x) => x.id === t[2]);
    if (!r) return fehler(404, "Rechnung nicht gefunden", "Invoice not found", s);
    if (t.length === 3 && m === "GET") return ok(r);
    if (t.length === 3 && m === "PUT") {
      if (r.status !== "entwurf") return fehler(409, "Gestellte Rechnungen können nicht geändert werden – stornieren und neu stellen", "Issued invoices cannot be changed – cancel and issue a new one", s);
      const pos = positionen(a.koerper.positionen);
      if (typeof pos === "string") return fehler(422, "Eine Position ist unvollständig.", "A line item is incomplete.", s);
      const ku = kleinunternehmer(k);
      Object.assign(r, { kunde_id: (a.koerper.kunde_id as string) ?? null, leistungsdatum: datum(a.koerper.leistungsdatum), faellig_am: datum(a.koerper.faellig_am), positionen: ku ? pos.map((p) => ({ ...p, ust_art: null })) : pos, hinweis: text(a.koerper.hinweis, 1000), kleinunternehmer: ku });
      return ok(r);
    }
    if (t.length === 3 && m === "DELETE") {
      if (r.status !== "entwurf") return fehler(404, "Kein Entwurf mit dieser ID", "No draft with this ID", s);
      rechnungen.splice(rechnungen.indexOf(r), 1);
      return ok(undefined, 204);
    }
    if (t[3] === "stellen" && m === "POST") {
      if (r.status !== "entwurf") return fehler(409, "Rechnung ist schon gestellt", "Invoice already issued", s);
      const steller = k.stand.einstellungen.rechnungssteller as RechnungsDaten["steller"] | undefined;
      if (!steller) return { status: 422, wert: { meldung: s === "en" ? "Details missing" : "Angaben fehlen", fehlend: ["steller"] } };
      const kunde = kunden.find((x) => x.id === r.kunde_id) as unknown as RechnungsDaten["kunde"] | undefined;
      if (!kunde) return { status: 422, wert: { meldung: s === "en" ? "Details missing" : "Angaben fehlen", fehlend: ["kunde"] } };
      const ku = kleinunternehmer(k);
      const heute = k.heute();
      const fehlendSatz: string[] = [];
      const pos: Position[] = r.positionen.map((p) => {
        if (ku || p.ust_art === null) return { bezeichnung: p.bezeichnung, menge: p.menge, einheit: p.einheit, preis_cent: p.preis_cent, ust_satz: null };
        const satz = regelwert(k, p.ust_art === "regel" ? "steuern.ust.satz_regel" : "steuern.ust.satz_ermaessigt", r.leistungsdatum ?? heute);
        if (!satz) fehlendSatz.push(`steuersatz.${p.ust_art}`);
        return { bezeichnung: p.bezeichnung, menge: p.menge, einheit: p.einheit, preis_cent: p.preis_cent, ust_satz: satz ? Number(satz.wert) : null };
      });
      if (fehlendSatz.length) return { status: 422, wert: { meldung: s === "en" ? "The tax rate has not been approved yet" : "Der Steuersatz ist noch nicht fachlich freigegeben", fehlend: fehlendSatz } };
      const daten: RechnungsDaten = { nummer: "VORLAEUFIG", rechnungsdatum: heute, leistungsdatum: r.leistungsdatum, faellig_am: r.faellig_am, steller, kunde: { ...kunde }, positionen: pos, kleinunternehmer: ku, hinweis: r.hinweis };
      const fehlend = fehlendFuerERechnung(daten).filter((f) => kunde.geschaeftskunde || !["steller.telefon", "steller.iban", "kunde.email"].includes(f));
      if (fehlend.length) return { status: 422, wert: { meldung: s === "en" ? "Details missing" : "Angaben fehlen", fehlend } };
      daten.nummer = naechsteNummer(k, Number(heute.slice(0, 4)));
      return ok(stellen(k, r, daten));
    }
    if (t[3] === "stornieren" && m === "POST") {
      if (r.status !== "gestellt" || r.art !== "rechnung") return fehler(409, "Nur gestellte Rechnungen können storniert werden", "Only issued invoices can be cancelled", s);
      const heute = k.heute();
      const storno: DemoRechnung = { ...r, id: k.id("rechnung"), art: "storno", status: "entwurf", storniert_rechnung_id: r.id, faellig_am: null, nummer: null, erstellt_am: k.zeit() };
      rechnungen.push(storno);
      stellen(k, storno, {
        nummer: naechsteNummer(k, Number(heute.slice(0, 4))), rechnungsdatum: heute, leistungsdatum: r.leistungsdatum, faellig_am: null,
        steller: r.steller as unknown as RechnungsDaten["steller"], kunde: r.kunde as unknown as RechnungsDaten["kunde"], positionen: r.positionen as unknown as Position[], kleinunternehmer: r.kleinunternehmer, art: "storno", storniert_nummer: r.nummer,
      });
      r.status = "storniert";
      neuberechnen(k);
      return ok(storno);
    }
    return nichtGefunden(s);
  }

  if (t[1] === "dokumente") return fehler(404, "Dateien gibt es in der Demo nicht – mit einem Konto erzeugt Amtlos PDF und E-Rechnung.", "Files are not available in the demo – with an account, Amtlos creates the PDF and e-invoice.", s);

  if (t[1] === "belege") {
    if (t.length === 2 && m === "GET") return ok([...belege].sort((x, y) => (y.belegdatum ?? "9999").localeCompare(x.belegdatum ?? "9999") || y.erfasst_am.localeCompare(x.erfasst_am)));
    if (t.length === 2 && m === "POST") {
      const b: Beleg = { id: k.id("beleg"), belegdatum: null, lieferant: null, belegnummer: null, brutto_cent: null, ust_cent: null, kategorie: null, notiz: null, quelle: "foto", storniert: false, erfasst_am: k.zeit(), datei_titel: s === "en" ? "Photo" : "Foto", mime: "image/jpeg" };
      belege.push(b);
      return ok(b);
    }
    const b = belege.find((x) => x.id === t[2]);
    if (!b || b.storniert) return fehler(404, "Beleg nicht gefunden", "Receipt not found", s);
    if (m === "PUT") {
      const d = a.koerper;
      const zahl = (x: unknown) => (x === null || x === undefined || x === "" ? null : Number.isInteger(Number(x)) ? Number(x) : null);
      Object.assign(b, { belegdatum: datum(d.belegdatum), lieferant: text(d.lieferant), belegnummer: text(d.belegnummer, 100), brutto_cent: zahl(d.brutto_cent), ust_cent: zahl(d.ust_cent), kategorie: text(d.kategorie, 60), notiz: text(d.notiz, 1000) });
      return ok(b);
    }
    if (t[3] === "stornieren" && m === "POST") {
      b.storniert = true;
      return ok({ id: b.id, storniert: true });
    }
    return nichtGefunden(s);
  }

  if (t[1] === "finanzen" && t[2] === "uebersicht") {
    const heute = k.heute();
    const jahr = Number(heute.slice(0, 4));
    const umsatz = k.umsatzLaufendesJahr(jahr);
    const ku = kleinunternehmer(k);
    const gruendungsjahr = typeof k.stand.profil.daten.gruendungsdatum === "string" && (k.stand.profil.daten.gruendungsdatum as string).startsWith(String(jahr));
    const g = ku ? regelwert(k, gruendungsjahr ? "steuern.ustg19.grenze_gruendungsjahr" : "steuern.ustg19.grenze_laufendes_jahr", heute) : undefined;
    return ok({
      jahr, umsatz_eur: umsatz ?? 0, kleinunternehmer: ku,
      grenze: g ? { id: g.id, wert_eur: Number(g.wert), anteil: umsatz === null ? 0 : umsatz / Number(g.wert), ungeprueft: g.pruefung?.status !== "freigegeben" } : null,
      entwuerfe: rechnungen.filter((r) => r.status === "entwurf").length, belege: belege.filter((b) => !b.storniert).length,
    });
  }

  if (t[1] === "finanzen" && t[2] === "ust-voranmeldung") {
    const periode = a.suche.get("periode") ?? "";
    const z = ustZeitraum(periode);
    if (!z) return fehler(400, "periode im Format JJJJ-MM oder JJJJ-Qn", "period as YYYY-MM or YYYY-Qn", s);
    const imZeitraum = rechnungen.filter((r) => r.status !== "entwurf" && r.rechnungsdatum && r.rechnungsdatum >= z.von && r.rechnungsdatum <= z.bis);
    const umsaetze = umsaetzeNachSatz(imZeitraum as unknown as { art: string; kleinunternehmer: boolean; positionen: Position[] }[]);
    const vb = belege.filter((b) => !b.storniert && b.belegdatum && b.belegdatum >= z.von && b.belegdatum <= z.bis);
    const ust = umsaetze.reduce((x, g) => x + g.ust_cent, 0);
    const vst = vb.reduce((x, b) => x + (b.ust_cent ?? 0), 0);
    return ok({
      periode, von: z.von, bis: z.bis, umsaetze, umsatzsteuer_cent: ust, vorsteuer_cent: vst, zahllast_cent: ust - vst,
      rechnungen: imZeitraum.length, belege: vb.length, belege_ohne_steuerangabe: vb.filter((b) => b.ust_cent === null).length,
      uebermittlung: { verfuegbar: false, grund: "Die direkte Übermittlung an ELSTER ist noch nicht freigeschaltet. Dafür fehlen die Registrierung von Amtlos als Software-Hersteller bei ELSTER und eine rechtliche Klärung.", alternative: { titel: "Mein ELSTER", url: "https://www.elster.de/" } },
    });
  }

  if (t[1] === "kassen") {
    if (t.length === 2 && m === "GET") return ok([...kassen].sort((x, y) => y.angeschafft_am.localeCompare(x.angeschafft_am)));
    const kassenProfil = () => {
      const p = k.stand.profil;
      const anzahl = kassen.filter((x) => !x.ausser_betrieb_am).length;
      const neu = { ...p.daten, "kasse.elektronisch": anzahl > 0 ? true : (p.daten["kasse.elektronisch"] ?? null), "kasse.anzahl": anzahl };
      if (p.daten["kasse.elektronisch"] === neu["kasse.elektronisch"] && p.daten["kasse.anzahl"] === anzahl) return;
      k.stand.profil = { ...p, version: p.version + 1, daten: neu, erstellt_am: k.zeit() };
    };
    if (t.length === 2 && m === "POST") {
      const d = a.koerper;
      const angeschafft = datum(d.angeschafft_am);
      if (!text(d.bezeichnung) || !angeschafft) return fehler(422, "Bitte Bezeichnung und Anschaffungsdatum angeben.", "Please enter a name and purchase date.", s);
      const kasse = { id: k.id("kasse"), bezeichnung: text(d.bezeichnung), art: text(d.art), hersteller: text(d.hersteller), modell: text(d.modell), seriennummer: text(d.seriennummer, 100), tse_seriennummer: text(d.tse_seriennummer, 100), betriebsstaette: text(d.betriebsstaette), angeschafft_am: angeschafft, ausser_betrieb_am: null };
      kassen.push(kasse);
      k.stand.ereignisse.push({ id: k.id("ereignis"), typ: "kasse_angeschafft", datum: angeschafft, erfasst_am: k.zeit(), storniert_ereignis_id: null, payload: { kasse_id: kasse.id } });
      kassenProfil();
      neuberechnen(k);
      return ok(kasse);
    }
    if (t[3] === "ausser-betrieb" && m === "POST") {
      const kasse = kassen.find((x) => x.id === t[2] && !x.ausser_betrieb_am);
      const am = datum(a.koerper.datum);
      if (!kasse) return fehler(404, "Keine aktive Kasse mit dieser ID", "No active register with this ID", s);
      if (!am) return fehler(422, "Bitte ein Datum angeben.", "Please enter a date.", s);
      kasse.ausser_betrieb_am = am;
      k.stand.ereignisse.push({ id: k.id("ereignis"), typ: "kasse_ausser_betrieb", datum: am, erfasst_am: k.zeit(), storniert_ereignis_id: null, payload: { kasse_id: kasse.id } });
      kassenProfil();
      neuberechnen(k);
      return ok(kasse);
    }
  }
  return undefined;
};
