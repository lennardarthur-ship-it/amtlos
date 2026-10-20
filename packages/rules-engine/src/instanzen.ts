import { type Datum } from "@amtlos/fristen";
import { entscheidendeSaetze } from "./erklaerung.js";
import type { PflichtErgebnis } from "./auswerten.js";
import type { Ereignis, Pflicht } from "./typen.js";

/**
 * Vom Ergebnis der Regel-Engine zu Pflicht-Instanzen (Periode, Fälligkeit) und deren Anzeige-Status.
 * Rein, ohne Datenbank: der Server gleicht das Ergebnis mit app.pflicht_instanz ab, die App rechnet damit im
 * Demo-Modus auf dem Gerät (E-119). Eine Quelle für beide, damit Demo und Server nicht auseinanderlaufen.
 */
export interface Instanz {
  id: string;
  pflicht_id: string;
  periode: string;
  status: "offen" | "erledigt" | "nicht_zutreffend" | "entfallen";
  faellig_am: Datum | null;
  erledigt_am: string | null;
  erledigt_mit_version_id: string | null;
  pflicht_version_id?: string;
}

export interface Soll {
  pflicht_id: string;
  pflicht_version_id: string;
  periode: string;
  ergebnis: PflichtErgebnis["ergebnis"];
  status: "offen" | "nicht_zutreffend";
  faellig_am: Datum | null;
  faellig_roh: Datum | null;
  begruendung: { knoten: PflichtErgebnis["begruendung"]; hinweise: string[]; regelwerte: PflichtErgebnis["regelwerte_genutzt"] };
  fehlende_fakten: string[];
  nicht_zutreffend_grund: string | null;
}

export type AnzeigeStatus = "offen" | "faellig_bald" | "ueberfaellig" | "angabe_fehlt" | "erledigt" | "nicht_zutreffend" | "entfallen";

/** Wie die Sicht app.pflicht_instanz_anzeige (db/migrations/0001_basis.sql): überfällig vor heute, bald fällig bis 14 Tage. */
export function anzeigeStatus(i: { status: Instanz["status"]; ergebnis: PflichtErgebnis["ergebnis"]; faellig_am: Datum | null }, heute: Datum): AnzeigeStatus {
  if (i.status !== "offen") return i.status;
  if (i.ergebnis === "unbekannt") return "angabe_fehlt";
  if (!i.faellig_am) return "offen";
  if (i.faellig_am < heute) return "ueberfaellig";
  const bald = new Date(Date.parse(`${heute}T00:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10);
  return i.faellig_am <= bald ? "faellig_bald" : "offen";
}

/**
 * Begründung für „gilt nicht“ (H6): Die entscheidenden Sätze beschreiben die Bedingung, unter der die Pflicht gilt
 * („Du stellst jemanden ein.“) – nicht ihre Verneinung. Deshalb als Bedingung formuliert: „Gilt erst, wenn: …“.
 */
export function nichtZutreffendGrund(saetze: string[]): string | null {
  return saetze.length ? `Gilt erst, wenn: ${saetze.join(" ")}` : null;
}

export function sollInstanzen(
  ergebnisse: PflichtErgebnis[],
  pflichten: Map<string, Pflicht>,
  versionIds: Map<string, string>,
  bestand: Instanz[],
  ereignisse: Ereignis[],
): Soll[] {
  const soll: Soll[] = [];
  for (const e of ergebnisse) {
    if (e.radar) continue; // Radar wird getrennt angezeigt, nicht als Aufgabe
    const p = pflichten.get(e.pflicht_id)!;
    const versionId = versionIds.get(e.pflicht_id)!;
    const basis = {
      pflicht_id: e.pflicht_id,
      pflicht_version_id: versionId,
      ergebnis: e.ergebnis,
      begruendung: { knoten: e.begruendung, hinweise: e.hinweise, regelwerte: e.regelwerte_genutzt },
      fehlende_fakten: e.fehlende_fakten,
    };

    if (e.ergebnis === "gilt_nicht") {
      soll.push({ ...basis, periode: "einmalig", status: "nicht_zutreffend", faellig_am: null, faellig_roh: null,
        nicht_zutreffend_grund: nichtZutreffendGrund(entscheidendeSaetze(e.begruendung)) });
      continue;
    }
    if (e.ergebnis === "unbekannt" && p.frist.typ === "wiederkehrend") {
      // Ob die Pflicht gilt, ist offen: eine Frage-Karte statt einer „Angabe fehlt“-Karte je Termin
      soll.push({ ...basis, periode: "einmalig", status: "offen", faellig_am: null, faellig_roh: null, nicht_zutreffend_grund: null });
    } else if (e.termine.length) {
      for (const t of e.termine)
        soll.push({ ...basis, periode: t.periode, status: "offen", faellig_am: t.faellig_am, faellig_roh: t.verlaengert ?? t.roh, nicht_zutreffend_grund: null });
    } else if (p.frist.typ !== "wiederkehrend" || e.hinweise.includes("rhythmus_unbekannt")) {
      // einmalig/dauerhaft/bei_aenderung ohne Termin, oder Rhythmus noch unbekannt → eine Instanz ohne Datum
      soll.push({ ...basis, periode: "einmalig", status: "offen", faellig_am: null, faellig_roh: null, nicht_zutreffend_grund: null });
    }

    // E-036: neue Version mit erneut_erledigen öffnet erledigte Pflicht erneut
    // bei_aenderung: auslösendes Ereignis nach der letzten Erledigung öffnet die Pflicht erneut
    const letzteErledigung = bestand
      .filter((i) => i.pflicht_id === e.pflicht_id && i.status === "erledigt")
      .sort((a, b) => (a.erledigt_am ?? "").localeCompare(b.erledigt_am ?? ""))
      .at(-1);
    if (letzteErledigung) {
      if (p.erneut_erledigen && letzteErledigung.erledigt_mit_version_id !== versionId) {
        soll.push({ ...basis, periode: `aenderung-${p.version}`, status: "offen", faellig_am: null, faellig_roh: null, nicht_zutreffend_grund: null });
      }
      if (p.wiederholung.art === "bei_aenderung") {
        const typen = new Set((p.wiederholung.neu_ausloesen_bei ?? []).flatMap((x) => ("ereignis" in x ? [x.ereignis] : [])));
        const ausloeser = ereignisse
          .filter((x) => typen.has(x.typ) && !x.storniert && x.datum > (letzteErledigung.erledigt_am ?? ""))
          .map((x) => x.datum)
          .sort()
          .at(-1);
        const periode = `aenderung-${ausloeser?.replaceAll("-", "")}`;
        // Gibt es für dieses Ereignis schon eine Instanz mit Termin (je_ereignis), nicht durch eine ohne Termin ersetzen
        if (ausloeser && !soll.some((s) => s.pflicht_id === e.pflicht_id && s.periode === periode))
          soll.push({ ...basis, periode, status: "offen", faellig_am: null, faellig_roh: null, nicht_zutreffend_grund: null });
      }
    }
  }
  return soll;
}
