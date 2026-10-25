/**
 * Plan der lokalen Erinnerungen (E-128, neu gefasst in E-192) – reine Funktionen, ohne Gerät testbar.
 *
 * „Erinnerung vor jeder Frist“ ist das Hauptversprechen von Pro. Deshalb plant die App nicht nur den nächsten Termin,
 * sondern alle Termine der nächsten zwölf Monate über alle Pflichten: drei Tage vorher und am Tag selbst, jeweils um
 * 9 Uhr; ein versäumter, nicht abgehakter Termin meldet sich am nächsten Morgen und danach wöchentlich (dreimal). Termine
 * desselben Tages teilen sich eine Mitteilung („2 Fristen“). iOS behält höchstens 64 geplante lokale Mitteilungen je
 * App, Android begrenzt Wecker je App ebenfalls – geplant werden die ersten `MAX_MITTEILUNGEN` Tage nach Datum. Endet der
 * Plan dadurch vor dem letzten Termin, sagt die App das („geplant bis …“); bei jedem Start, jeder Rückkehr in die App
 * und jeder Änderung plant sie neu (`ErinnerungsPlaner`).
 */
import { differenzTage, plusTage } from "@amtlos/fristen";
import { T as TEXT } from "../texte";
import { istErledigt, type Auswertung, type Erledigt } from "./check";

/** Höchstens so viele Mitteilungen auf einmal (iOS: 64 je App; der Rest bleibt als Reserve frei). */
export const MAX_MITTEILUNGEN = 60;
/** Tage vor dem Termin für die Vorab-Erinnerung */
export const VORLAUF_TAGE = 3;
/** Erinnerungen an einen versäumten Termin: Tage nach heute (morgen, dann wöchentlich) */
export const UEBERFAELLIG_TAGE = [1, 8, 15] as const;

export type ErinnerungsArt = "ueberfaellig" | "heute" | "vorher";

/** Eine Erinnerung an einen Termin einer Pflicht. */
export interface Erinnerung {
  pflichtId: string;
  titel: string;
  termin: string;
  /** Tag der Mitteilung (ISO), zugestellt um 9 Uhr */
  am: string;
  art: ErinnerungsArt;
}

/** Eine Mitteilung auf dem Gerät: alle Erinnerungen eines Tages. */
export interface Mitteilung {
  am: string;
  titel: string;
  text: string;
  erinnerungen: Erinnerung[];
}

export interface ErinnerungsPlan {
  mitteilungen: Mitteilung[];
  /** letzter Tag mit geplanter Mitteilung, wenn der Plan wegen der Höchstzahl vor dem letzten Termin endet – sonst null */
  geplantBis: string | null;
}

const RANG: Record<ErinnerungsArt, number> = { ueberfaellig: 0, heute: 1, vorher: 2 };

/**
 * Alle Erinnerungen ab heute für offene Pflichten mit Termin – `a` mit dem Stand der Haken (`terminStand`), damit
 * Versäumtes dabei ist. Der aktuelle Termin entfällt, wenn er abgehakt ist; spätere Termine derselben Pflicht bleiben
 * (der Haken gilt nur für einen Termin). Was Lohnbüro bzw. Steuerberatung erledigt, meldet sich nicht.
 */
export function erinnerungen(a: Auswertung, e: Erledigt, heute: string, o: { vorlauf?: number; amTag?: boolean } = {}): Erinnerung[] {
  const vorlauf = o.vorlauf ?? VORLAUF_TAGE;
  const amTag = o.amTag ?? true;
  const ee = { ...e, heute: e.heute ?? heute };
  const aus: Erinnerung[] = [];
  for (const p of a.gilt) {
    if (!p.naechsterTermin || p.lohnbuero) continue;
    const neu = (termin: string, am: string, art: ErinnerungsArt) => aus.push({ pflichtId: p.id, titel: p.titel, termin, am, art });
    const fuer = (termin: string) => {
      if (termin > heute) {
        const frueh = plusTage(termin, -vorlauf);
        neu(termin, frueh > heute ? frueh : heute, "vorher");
      }
      if (amTag || termin === heute) neu(termin, termin, "heute");
    };
    const aktuell = p.naechsterTermin;
    const offen = !istErledigt(p, ee);
    if (offen && aktuell < heute) for (const n of UEBERFAELLIG_TAGE) neu(aktuell, plusTage(heute, n), "ueberfaellig");
    else if (offen) fuer(aktuell);
    for (const t of p.termine) if (t > aktuell) fuer(t);
  }
  // je Termin und Tag nur eine Erinnerung (z. B. Termin heute: „vorher“ und „heute“ fielen zusammen)
  const gesehen = new Set<string>();
  return aus
    .sort((x, y) => x.am.localeCompare(y.am) || RANG[x.art] - RANG[y.art] || x.termin.localeCompare(y.termin) || x.titel.localeCompare(y.titel, "de"))
    .filter((x) => {
      const k = `${x.pflichtId}|${x.termin}|${x.am}`;
      if (gesehen.has(k)) return false;
      gesehen.add(k);
      return true;
    });
}

const datumDe = (iso: string) => iso.split("-").reverse().join(".");

/** Text einer Erinnerung am Tag der Mitteilung („Fällig am …“, „Heute fällig“, „Seit 3 Tagen überfällig“). */
export function erinnerungsText(x: Erinnerung): string {
  if (x.art === "ueberfaellig") return TEXT.frist_ueber(differenzTage(x.termin, x.am));
  if (x.am === x.termin) return TEXT.frist_heute;
  return TEXT.mitteilung_vorher(datumDe(x.termin));
}

/** Erinnerungen eines Tages als eine Mitteilung: eine Pflicht mit ihrem Titel, mehrere als „N Fristen“ mit je einer Zeile. */
export function mitteilung(am: string, l: Erinnerung[]): Mitteilung {
  if (l.length === 1) return { am, titel: l[0]!.titel, text: `${erinnerungsText(l[0]!)} – ${TEXT.mitteilung_ansehen}`, erinnerungen: l };
  return { am, titel: TEXT.mitteilung_mehrere(l.length), text: l.map((x) => `${x.titel}: ${erinnerungsText(x)}`).join("\n"), erinnerungen: l };
}

/** Der Plan für das Gerät: eine Mitteilung je Tag, nach Datum, höchstens `max`. */
export function erinnerungsPlan(a: Auswertung, e: Erledigt, heute: string, o: { vorlauf?: number; amTag?: boolean; max?: number } = {}): ErinnerungsPlan {
  const max = o.max ?? MAX_MITTEILUNGEN;
  const tage = new Map<string, Erinnerung[]>();
  for (const x of erinnerungen(a, e, heute, o)) tage.set(x.am, [...(tage.get(x.am) ?? []), x]);
  const alle = [...tage.entries()].map(([am, l]) => mitteilung(am, l));
  const mitteilungen = alle.slice(0, max);
  return { mitteilungen, geplantBis: alle.length > max && mitteilungen.length ? mitteilungen[mitteilungen.length - 1]!.am : null };
}
