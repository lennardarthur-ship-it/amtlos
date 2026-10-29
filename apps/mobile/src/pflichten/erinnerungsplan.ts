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
 *
 * E-207: Erinnert wird an jede Frist mit Datum, die die App zeigt – auch an die Termine der Einträge, die noch von Angaben
 * abhängen („Hängt von deinen Angaben ab“, z. B. Vorauszahlungen, EÜR, Gewerbesteuererklärung, solange Gewinn bzw.
 * Vorauszahlungen nicht angegeben sind): drei Tage vorher, mit „falls es für dich gilt“, ohne „heute“ und „überfällig“.
 * Weil lokale Mitteilungen nur geplant werden, wenn die App läuft, ist die letzte Mitteilung immer der Hinweis
 * „Öffne die App, damit sie die nächsten Fristen plant“ (`weiterplanen`): am Tag nach der letzten geplanten Erinnerung,
 * wenn die Höchstzahl den Plan kürzt, sonst elf Monate nach heute (der Plan reicht zwölf Monate weit). Wer die App
 * danach monatelang nicht öffnet, bekommt keine weiteren Erinnerungen – das kann eine App ohne Server nicht verhindern.
 *
 * E-212: Eine einmalige Frist, die schon vor dem ersten Pflichten-Check abgelaufen war (`vorCheck`), meldet sich nicht –
 * sie steht in der App als „Frist war am … – schon erledigt?“. „Falls es für dich gilt“ bleibt der Rückfall für
 * Einträge, deren Fragen (seit E-212 großteils im Kern-Check) noch offen sind.
 */
import { differenzTage, plusMonate, plusTage } from "@amtlos/fristen";
import { T as TEXT } from "../texte";
import { istErledigt, type Auswertung, type Erledigt } from "./check";

/** Höchstens so viele Mitteilungen auf einmal auf dem iPhone (iOS: 64 je App; der Rest bleibt als Reserve frei). */
export const MAX_MITTEILUNGEN = 60;
/**
 * E-238: Android kennt keine Grenze wie iOS. expo-notifications legt je Mitteilung einen Wecker beim System an (AlarmManager)
 * und speichert die Mitteilungen; nach einem Neustart oder einem Update der App setzt es sie selbst neu (Empfänger für
 * BOOT_COMPLETED, REBOOT, MY_PACKAGE_REPLACED; RECEIVE_BOOT_COMPLETED steht in app.json). Das System erlaubt bis zu 500
 * Wecker je App – 400 lassen Abstand und reichen für alle Termine der zwölf Monate (typisch 20 bis 120 Tage).
 */
export const MAX_MITTEILUNGEN_ANDROID = 400;
/** Höchstzahl für das Gerät (E-238). */
export const maxMitteilungen = (plattform: "ios" | "android" | "web"): number => (plattform === "android" ? MAX_MITTEILUNGEN_ANDROID : MAX_MITTEILUNGEN);
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
  /** E-200: letzter Tag zum Übermitteln (Eingang um 0 Uhr am Tag danach) – Text „Spätestens am … übermitteln“ */
  uebermitteln?: boolean;
  /** E-207: Eintrag hängt noch von Angaben ab – Text „…, falls es für dich gilt“ */
  vielleicht?: boolean;
}

/** Eine Mitteilung auf dem Gerät: alle Erinnerungen eines Tages. */
export interface Mitteilung {
  am: string;
  titel: string;
  text: string;
  erinnerungen: Erinnerung[];
  /** E-207: Hinweis „App öffnen, damit die nächsten Fristen geplant werden“ (letzte Mitteilung des Plans, ohne Erinnerungen) */
  weiterplanen?: boolean;
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
    // E-212 (T-240): eine Frist, die schon vor dem ersten Check vorbei war, steht ruhig in der App – keine Mitteilung
    if (!p.naechsterTermin || p.lohnbuero || p.vorCheck) continue;
    const neu = (termin: string, am: string, art: ErinnerungsArt) => aus.push({ pflichtId: p.id, titel: p.titel, termin, am, art, ...(p.uebermittelnVortag ? { uebermitteln: true } : {}) });
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
  // E-207: Termine der Einträge, die noch von Angaben abhängen – die Pflicht-Seite zeigt sie mit Datum. Nur vorher.
  const gilt = new Set(a.gilt.map((p) => p.id));
  for (const p of a.unbekannt) {
    if (gilt.has(p.id) || p.lohnbuero) continue;
    for (const t of p.termine) {
      if (t <= heute) continue;
      const frueh = plusTage(t, -vorlauf);
      aus.push({ pflichtId: p.id, titel: p.titel, termin: t, am: frueh > heute ? frueh : heute, art: "vorher", vielleicht: true });
    }
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
  if (x.vielleicht) return TEXT.mitteilung_vielleicht(datumDe(x.termin));
  // E-200: Beitragsnachweis – der Termin ist der letzte Tag zum Übermitteln
  if (x.uebermitteln) return x.am === x.termin ? TEXT.e200_heute_uebermitteln : TEXT.e200_uebermitteln_bis(datumDe(x.termin));
  if (x.am === x.termin) return TEXT.frist_heute;
  return TEXT.mitteilung_vorher(datumDe(x.termin));
}

/** Erinnerungen eines Tages als eine Mitteilung: eine Pflicht mit ihrem Titel, mehrere als „N Fristen“ mit je einer Zeile. */
export function mitteilung(am: string, l: Erinnerung[]): Mitteilung {
  if (l.length === 1) return { am, titel: l[0]!.titel, text: `${erinnerungsText(l[0]!)} – ${TEXT.mitteilung_ansehen}`, erinnerungen: l };
  return { am, titel: TEXT.mitteilung_mehrere(l.length), text: l.map((x) => `${x.titel}: ${erinnerungsText(x)}`).join("\n"), erinnerungen: l };
}

/** E-207: Monate bis zum Hinweis „weiterplanen“, wenn der Plan nicht gekürzt ist (der Plan reicht zwölf Monate weit). */
export const WEITERPLANEN_NACH_MONATEN = 11;

/** E-207: der Hinweis am Ende des Plans – lokale Mitteilungen plant nur die laufende App. */
const weiter = (am: string): Mitteilung => ({ am, titel: TEXT.mitteilung_weiterplanen_titel, text: TEXT.mitteilung_weiterplanen, erinnerungen: [], weiterplanen: true });

/**
 * E-238: Kern einer Erinnerung – der Fälligkeitstag, drei Tage vorher und die erste Erinnerung an Versäumtes. Weitere
 * Erinnerungen an Versäumtes (nach einer und nach zwei Wochen) und „falls es für dich gilt“ sind Zusatz: Reicht die
 * Höchstzahl nicht (iPhone), bekommen sie keinen eigenen Tag, sondern stehen nur mit in der Mitteilung eines Tages, der
 * ohnehin eine hat – so reicht der Plan mit gleich vielen Mitteilungen weiter.
 *
 * Der Plan für das Gerät: eine Mitteilung je Tag (alle Termine des Tages zusammen), nach Datum, höchstens `max` – die
 * letzte davon ist der Hinweis „weiterplanen“ (E-207). Passt nicht alles (iPhone), gehen die Kern-Erinnerungen vor:
 * Tage mit Kern-Erinnerungen nach Datum, Zusatz nur an diesen Tagen; bleibt Platz, auch eigene Tage für Zusatz.
 * `geplantBis`: letzter Tag mit geplanter Kern-Erinnerung, wenn die Höchstzahl die Kern-Erinnerungen kürzt.
 */
export function erinnerungsPlan(a: Auswertung, e: Erledigt, heute: string, o: { vorlauf?: number; amTag?: boolean; max?: number } = {}): ErinnerungsPlan {
  const max = o.max ?? MAX_MITTEILUNGEN;
  const liste = erinnerungen(a, e, heute, o);
  // erste Erinnerung je versäumtem Termin (Kern); die weiteren sind Zusatz
  const erst = new Map<string, string>();
  for (const x of liste) if (x.art === "ueberfaellig" && !erst.has(`${x.pflichtId}|${x.termin}`)) erst.set(`${x.pflichtId}|${x.termin}`, x.am);
  const kern = (x: Erinnerung) => !x.vielleicht && (x.art !== "ueberfaellig" || erst.get(`${x.pflichtId}|${x.termin}`) === x.am);
  const tage = new Map<string, Erinnerung[]>();
  for (const x of liste) tage.set(x.am, [...(tage.get(x.am) ?? []), x]);
  const alle = [...tage.entries()].map(([am, l]) => mitteilung(am, l));
  if (!alle.length) return { mitteilungen: [], geplantBis: null };
  if (alle.length < max) {
    // alles passt: der Hinweis elf Monate nach heute – nach der letzten Erinnerung, falls die später liegt
    const am = plusMonate(heute, WEITERPLANEN_NACH_MONATEN);
    const vorher = alle.filter((m) => m.am < am);
    const nachher = alle.filter((m) => m.am > am);
    const gleich = alle.find((m) => m.am === am);
    // eine Mitteilung je Tag: am selben Tag wie Erinnerungen steht der Hinweis in derselben Mitteilung
    const hinweis = gleich ? { ...gleich, text: `${gleich.text}\n${TEXT.mitteilung_weiterplanen}`, weiterplanen: true } : weiter(am);
    return { mitteilungen: nachher.length ? [...alle, weiter(plusTage(nachher[nachher.length - 1]!.am, 1))] : [...vorher, hinweis], geplantBis: null };
  }
  // E-238: zu viele Tage – Kern-Tage zuerst (nach Datum), Zusatz nur an diesen Tagen, freie Plätze für Zusatz-Tage
  const platz = max - 1;
  const kernTage = [...tage.keys()].filter((t) => tage.get(t)!.some(kern)).sort();
  const gewaehlt = new Set(kernTage.slice(0, platz));
  const kernGekuerzt = kernTage.length > platz;
  if (!kernGekuerzt) for (const t of [...tage.keys()].sort()) if (gewaehlt.size < platz && !gewaehlt.has(t)) gewaehlt.add(t);
  const mitteilungen = [...gewaehlt].sort().map((t) => mitteilung(t, tage.get(t)!));
  const letzte = mitteilungen[mitteilungen.length - 1]?.am ?? heute;
  if (!kernGekuerzt) {
    // alle Kern-Erinnerungen sind geplant – nur Zusatz fehlt: Hinweis wie beim vollständigen Plan
    const am = plusMonate(heute, WEITERPLANEN_NACH_MONATEN);
    if (letzte >= am) return { mitteilungen: [...mitteilungen, weiter(plusTage(letzte, 1))], geplantBis: null };
    // eine Mitteilung je Tag – fällt der Hinweis auf einen Tag mit Erinnerungen, steht er in derselben Mitteilung
    const gleich = mitteilungen.find((m) => m.am === am);
    if (gleich) return { mitteilungen: mitteilungen.map((m) => (m === gleich ? { ...m, text: `${m.text}\n${TEXT.mitteilung_weiterplanen}`, weiterplanen: true } : m)), geplantBis: null };
    return { mitteilungen: [...mitteilungen, weiter(am)].sort((x, y) => x.am.localeCompare(y.am)), geplantBis: null };
  }
  return { mitteilungen: [...mitteilungen, weiter(plusTage(letzte, 1))], geplantBis: letzte };
}
