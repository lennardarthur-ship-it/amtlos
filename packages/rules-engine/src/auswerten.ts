import {
  jahrVon,
  plusMonate,
  plusTage,
  relativerTermin,
  vergleiche,
  verschiebe,
  wiederkehrendeTermine,
  zerlege,
  type Datum,
  type Kalender,
  type Ort,
  type Rhythmus,
  type Termin,
} from "@amtlos/fristen";
import { fehlendeFakten, genutzteRegelwerte, werteAus, type Auswertungskontext, type Knoten } from "./bedingung.js";
import { mitAbgeleitetenFakten, zuErfragendeFakten } from "./fakten.js";
import { Regelwerte } from "./regelwerte.js";
import type { Ereignis, Ergebnis, Fakten, Katalog, Pflicht } from "./typen.js";

export const ENGINE_VERSION = "0.1.0";

export interface Eingabe {
  katalog: Katalog;
  /** Profil-Fakten (profil.*, finanzen.* …); abgeleitet.* werden ergänzt */
  fakten: Fakten;
  ereignisse: readonly Ereignis[];
  stichtag: Datum;
  kalender: Kalender;
  /** Erledigungsdaten je Pflicht-ID (für Fristen mit Bezug 'pflicht_erledigt') */
  erledigt?: Readonly<Record<string, Datum>>;
  /** Zeitfenster für Termine wiederkehrender Pflichten; Standard: 3 Monate zurück, 12 Monate voraus */
  fenster?: { von: Datum; bis: Datum };
}

export interface TerminErgebnis extends Termin {
  /** Termin liegt in einem späteren Kalenderjahr; Fakten wie „Vorjahreswerte“ können sich bis dahin ändern */
  vorlaeufig: boolean;
}

export interface PflichtErgebnis {
  pflicht_id: string;
  pflicht_version: number;
  kategorie: string;
  status_recht: Pflicht["status_recht"];
  /** true für entwurf/beschlossen/geplant: nicht im Pflichtenplan, sondern im Rechtsänderungs-Radar */
  radar: boolean;
  ergebnis: Ergebnis;
  begruendung: Knoten;
  fehlende_fakten: string[];
  regelwerte_genutzt: { id: string; version: number }[];
  termine: TerminErgebnis[];
  /** Hinweise zur Terminberechnung, z. B. „Termin hängt von Ereignis X ab“ */
  hinweise: string[];
}

const RADAR = new Set(["entwurf", "beschlossen", "geplant"]);

function gueltigAm(p: Pflicht, stichtag: Datum): boolean {
  if (p.gueltig_ab && vergleiche(p.gueltig_ab, stichtag) > 0 && !RADAR.has(p.status_recht)) return false;
  if (p.gueltig_bis && vergleiche(stichtag, p.gueltig_bis) > 0) return false;
  return p.status_recht !== "ausgelaufen";
}

function ortAus(f: Fakten): Ort {
  const bl = f["profil.bundesland"];
  const ags = f["profil.gemeinde_ags"];
  return { ...(typeof bl === "string" ? { bundesland: bl as Ort["bundesland"] } : {}), ...(typeof ags === "string" ? { ags } : {}) };
}

/**
 * Wertet den Katalog für ein Unternehmen aus. Reine Funktion ohne I/O (docs/03-regel-schema.md).
 * Gleiche Eingabe → gleiche Ausgabe; die Reihenfolge der Ergebnisse folgt der Katalogreihenfolge.
 */
export function auswerten(e: Eingabe): PflichtErgebnis[] {
  const regelwerte = new Regelwerte(e.katalog.regelwerte);
  const fakten = mitAbgeleitetenFakten(e.fakten, e.stichtag);
  const ctx: Auswertungskontext = { fakten, ereignisse: e.ereignisse, stichtag: e.stichtag, regelwerte };
  const ort = ortAus(fakten);
  const fenster = e.fenster ?? { von: plusMonate(e.stichtag, -3), bis: plusMonate(e.stichtag, 12) };

  return e.katalog.pflichten
    .filter((p) => gueltigAm(p, e.stichtag))
    .map((p) => {
      const begruendung = werteAus(p.ausloeser, ctx);
      const fehlend = new Set(fehlendeFakten(begruendung));
      const regelwerteGenutzt = genutzteRegelwerte(begruendung);
      const hinweise: string[] = [];
      let termine: TerminErgebnis[] = [];

      if (begruendung.ergebnis !== "gilt_nicht") {
        const t = termineFuer(p, ctx, ort, e, fenster, hinweise, fehlend, regelwerteGenutzt);
        const jahr = jahrVon(e.stichtag);
        termine = t.map((x) => ({ ...x, vorlaeufig: jahrVon(x.faellig_am) > jahr && p.frist.typ === "wiederkehrend" }));
      }
      return {
        pflicht_id: p.id,
        pflicht_version: p.version,
        kategorie: p.kategorie,
        status_recht: p.status_recht,
        radar: RADAR.has(p.status_recht),
        ergebnis: begruendung.ergebnis,
        begruendung,
        fehlende_fakten: zuErfragendeFakten(fehlend),
        regelwerte_genutzt: regelwerteGenutzt,
        termine,
        hinweise,
      };
    });
}

function termineFuer(
  p: Pflicht,
  ctx: Auswertungskontext,
  ort: Ort,
  e: Eingabe,
  fenster: { von: Datum; bis: Datum },
  hinweise: string[],
  fehlend: Set<string>,
  regelwerteGenutzt: { id: string; version: number }[],
): Termin[] {
  const f = p.frist;
  switch (f.typ) {
    case "dauerhaft":
      return [];

    case "absolut": {
      const v = verschiebe(f.datum, f.verschiebung, ort, e.kalender);
      return [{ periode: "einmalig", roh: f.datum, faellig_am: v.datum, uebersprungen: v.uebersprungen }];
    }

    case "relativ": {
      const termin = (bezug: Datum, periode: string): Termin => {
        const r = relativerTermin(bezug, { versatz: f.versatz, verschiebung: f.verschiebung }, ort, e.kalender);
        // "vor_beginn": spätestens am Tag vor dem Bezugstag erledigt (docs/03, Fristen)
        if (f.zeitpunkt === "vor_beginn") {
          const roh = plusTage(r.roh, -1);
          const v = verschiebe(roh, f.verschiebung, ort, e.kalender);
          return { periode, roh, faellig_am: v.datum, uebersprungen: v.uebersprungen };
        }
        return { periode, ...r };
      };
      if ("ereignis" in f.bezug && f.je_ereignis) {
        // Eine Instanz je Ereignis (z. B. je Einstellung, je Unfall); gleiche Tage zählen einmal
        const typ = f.bezug.ereignis;
        const tage = [...new Set(e.ereignisse.filter((x) => x.typ === typ && !x.storniert).map((x) => x.datum))].sort();
        if (!tage.length) hinweise.push(`termin_abhaengig_von_ereignis:${typ}`);
        return tage.map((d) => termin(d, `aenderung-${d.replaceAll("-", "")}`));
      }
      let bezug: Datum | undefined;
      if ("ereignis" in f.bezug) {
        const typ = f.bezug.ereignis;
        bezug = e.ereignisse.filter((x) => x.typ === typ && !x.storniert).map((x) => x.datum).sort()[0];
        if (!bezug) hinweise.push(`termin_abhaengig_von_ereignis:${typ}`);
      } else if ("fakt" in f.bezug) {
        const wert = ctx.fakten[f.bezug.fakt];
        if (typeof wert === "string") bezug = wert;
        else {
          fehlend.add(f.bezug.fakt);
          hinweise.push(`termin_abhaengig_von_fakt:${f.bezug.fakt}`);
        }
      } else {
        bezug = e.erledigt?.[f.bezug.pflicht_erledigt];
        if (!bezug) hinweise.push(`termin_abhaengig_von_pflicht:${f.bezug.pflicht_erledigt}`);
      }
      if (!bezug) return [];
      return [termin(bezug, "einmalig")];
    }

    case "wiederkehrend": {
      let rhythmus: Rhythmus | undefined;
      if (typeof f.rhythmus === "string") rhythmus = f.rhythmus;
      else {
        for (const w of f.rhythmus.waehle) {
          const k = werteAus(w.wenn, ctx);
          regelwerteGenutzt.push(...genutzteRegelwerte(k).filter((r) => !regelwerteGenutzt.some((x) => x.id === r.id && x.version === r.version)));
          if (k.ergebnis === "gilt") {
            rhythmus = w.dann;
            break;
          }
          if (k.ergebnis === "unbekannt") {
            fehlendeFakten(k).forEach((x) => fehlend.add(x));
            hinweise.push("rhythmus_unbekannt");
            return [];
          }
        }
        rhythmus ??= f.rhythmus.sonst;
      }
      let verlaengerung: string | undefined;
      if (f.verlaengerung) {
        const k = werteAus(f.verlaengerung.wenn, ctx);
        if (k.ergebnis === "gilt") verlaengerung = f.verlaengerung.versatz;
        // Unbekannt: ohne Verlängerung rechnen – der frühere Termin ist der sichere (Hinweis für die Anzeige)
        if (k.ergebnis === "unbekannt") hinweise.push("verlaengerung_unbekannt_frueherer_termin");
      }
      // Termine erst ab Gründung
      const gruendung = ctx.fakten["profil.gruendungsdatum"];
      const von = typeof gruendung === "string" && vergleiche(gruendung, fenster.von) > 0 ? gruendung : fenster.von;
      return wiederkehrendeTermine({ rhythmus, faellig: f.faellig, verlaengerung, verschiebung: f.verschiebung }, von, fenster.bis, ort, e.kalender).filter(
        (t) => typeof gruendung !== "string" || periodeEndetNach(t.periode, gruendung),
      );
    }
  }
}

/** Periode endet am oder nach dem Datum (keine Pflichten für Zeiträume vor der Gründung). */
function periodeEndetNach(periode: string, d: Datum): boolean {
  const { jahr, monat } = zerlege(d);
  const m = /^(\d{4})(?:-(\d{2})|-Q(\d)|-H(\d))?$/.exec(periode);
  if (!m) return true;
  const pj = Number(m[1]);
  const endMonat = m[2] ? Number(m[2]) : m[3] ? Number(m[3]) * 3 : m[4] ? Number(m[4]) * 6 : 12;
  return pj * 12 + endMonat >= jahr * 12 + monat;
}
