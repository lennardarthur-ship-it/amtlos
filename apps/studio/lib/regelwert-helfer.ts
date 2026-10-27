/** Regelwert-Formular ↔ Dokument (ohne React, testbar). */
export type Quelle = { titel?: string; url?: string; abgerufen?: string | null; fundstelle?: string };
export interface RegelwertDaten {
  id?: string; bezeichnung?: { de?: string; en?: string }; einheit?: string; wert?: number; gueltig_ab?: string | null; gueltig_bis?: string | null;
  status_recht?: string; rechtsgrundlage?: string[]; katalog_nr?: string; quellen?: Quelle[]; fachlich_zu_pruefen?: string[];
}

const zeilen = (x: FormDataEntryValue | null) => String(x ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
const text = (x: FormDataEntryValue | null) => String(x ?? "").trim();

/** Formular → Regelwert-Dokument. Leere optionale Felder entfallen; das Schema prüft danach im Server. */
/** „25.000,50“ (deutsch, Punkte als Tausendertrenner) oder „25000.5“. */
export function zahlAusText(roh: string): number | null {
  const t = roh.trim();
  if (!t) return null;
  // Mit Komma: deutsch. Ohne Komma, aber in Dreiergruppen („25.000“): Tausendertrenner. Sonst Dezimalpunkt („13.90“).
  const n = Number(t.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
}

export function ausFormular(f: FormData, id: string, einheitFest?: string): Record<string, unknown> {
  const quellen: Quelle[] = [];
  for (let i = 0; i < 3; i++) {
    const q = { titel: text(f.get(`q${i}_titel`)), url: text(f.get(`q${i}_url`)), abgerufen: text(f.get(`q${i}_abgerufen`)) || null, fundstelle: text(f.get(`q${i}_fundstelle`)) };
    if (!q.titel && !q.url) continue;
    quellen.push(q.fundstelle ? q : { titel: q.titel, url: q.url, abgerufen: q.abgerufen });
  }
  const en = text(f.get("bezeichnung_en"));
  const doc: Record<string, unknown> = {
    id,
    bezeichnung: en ? { de: text(f.get("bezeichnung_de")), en } : { de: text(f.get("bezeichnung_de")) },
    einheit: einheitFest ?? text(f.get("einheit")),
    wert: zahlAusText(text(f.get("wert"))),
    // E-213: leer = ohne Stichtag (null), sonst bekäme eine solche Version beim Bearbeiten ein erfundenes Anfangsdatum
    gueltig_ab: text(f.get("gueltig_ab")) || null,
    gueltig_bis: text(f.get("gueltig_bis")) || null,
    status_recht: text(f.get("status_recht")),
    rechtsgrundlage: zeilen(f.get("rechtsgrundlage")),
    quellen,
  };
  const nr = text(f.get("katalog_nr"));
  if (nr) doc.katalog_nr = nr;
  const fz = zeilen(f.get("fachlich_zu_pruefen"));
  if (fz.length) doc.fachlich_zu_pruefen = fz;
  return doc;
}

