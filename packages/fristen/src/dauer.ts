import { plusMonate, plusTage, type Datum } from "./datum.js";

/** ISO-8601-Dauer ohne Uhrzeitanteil, optional negativ: P1M, P7D, P1Y2M, -P2D, P2W. */
export interface Dauer {
  negativ: boolean;
  jahre: number;
  monate: number;
  wochen: number;
  tage: number;
}

const DAUER_MUSTER = /^(-)?P(?!$)(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/;

export function parseDauer(text: string): Dauer {
  const m = DAUER_MUSTER.exec(text);
  if (!m) throw new Error(`Ungültige Dauer: '${text}' (erwartet z. B. P1M, P7D, -P2D)`);
  return {
    negativ: m[1] === "-",
    jahre: Number(m[2] ?? 0),
    monate: Number(m[3] ?? 0),
    wochen: Number(m[4] ?? 0),
    tage: Number(m[5] ?? 0),
  };
}

/**
 * Dauer auf ein Datum anwenden. Reihenfolge: erst Jahre/Monate (mit Monatsende-Regel), dann Wochen/Tage.
 * Bei negativer Dauer umgekehrt (erst Tage abziehen, dann Monate), damit P1M und -P1M symmetrisch bleiben,
 * soweit die Monatsende-Regel das zulässt.
 */
export function plusDauer(d: Datum, dauer: Dauer | string): Datum {
  const x = typeof dauer === "string" ? parseDauer(dauer) : dauer;
  const vz = x.negativ ? -1 : 1;
  const monate = vz * (x.jahre * 12 + x.monate);
  const tage = vz * (x.wochen * 7 + x.tage);
  return x.negativ ? plusMonate(plusTage(d, tage), monate) : plusTage(plusMonate(d, monate), tage);
}

export function minusDauer(d: Datum, dauer: Dauer | string): Datum {
  const x = typeof dauer === "string" ? parseDauer(dauer) : dauer;
  return plusDauer(d, { ...x, negativ: !x.negativ });
}
