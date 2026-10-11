/**
 * „Frag Amtlos“ (Spezifikation 6.10): Antworten ausschließlich aus dem eigenen Regelkatalog, immer mit Quelle und
 * Prüfstatus. Diese Stufe ist reine Suche (Retrieval) ohne Sprachmodell: Die Antwort besteht aus den Texten der
 * gefundenen Pflichten und Regelwerte – es wird nichts formuliert, was nicht im Katalog steht (E-100).
 *
 * Erkennt Fragen, die individuelle Beratung wären, und verweist auf Partner. Ohne ausreichenden Treffer: „weiß ich
 * nicht sicher“. Ein Sprachmodell (KiGateway) darf später nur die gefundenen Passagen umformulieren; die Quellen
 * bleiben die gefundenen Katalogobjekte.
 */
type Text = { de: string; en?: string };
export type Sprache = "de" | "en";
type Quelle = { titel: string; url: string };

/** Die Felder einer Pflichtversion, die der Assistent liest (Schema pflicht.schema.json). */
export interface KatalogPflicht {
  id: string;
  titel: Text;
  kurz: Text;
  erklaerung: Text;
  begriffe?: { begriff: Text; erklaerung: Text }[];
  rechtsgrundlage: string[];
  quellen: Quelle[];
  status_recht: string;
  pruefung?: { status: string; geprueft_am?: string | null };
  pruef_status?: string;
  geprueft_am?: string | null;
}
export interface KatalogRegelwert {
  id: string;
  version: number;
  wert: unknown;
  einheit: string;
  bezeichnung: Text;
  gueltig_ab: string | null;
  gueltig_bis?: string | null;
  status_recht: string;
  quellen?: Quelle[];
  pruefung?: { status: string };
}

export interface Treffer {
  art: "pflicht";
  pflicht_id: string;
  titel: string;
  kurz: string;
  erklaerung: string;
  rechtsgrundlage: string[];
  quellen: { titel: string; url: string }[];
  pruefung: { status: string; geprueft_am: string | null };
  gilt_fuer_dich: boolean | null;
  punkte: number;
}
export interface RegelwertTreffer {
  art: "regelwert";
  id: string;
  bezeichnung: string;
  wert: unknown;
  einheit: string;
  gueltig_ab: string | null;
  gueltig_bis: string | null;
  status_recht: string;
  quellen: { titel: string; url: string }[];
  pruefung: { status: string };
  punkte: number;
}
export interface Antwort {
  art: "antwort" | "beratung" | "unsicher";
  treffer: Treffer[];
  regelwerte: RegelwertTreffer[];
  ki_formuliert: false;
}

const STOPP = new Set(
  "der die das den dem des ein eine einen einem einer und oder aber ich du er sie es wir ihr mein meine dein deine muss musst müssen kann kannst können soll sollte wie was wann wo wer warum welche welcher welches für mit ist sind bin war bei von vom zu zum zur im in auf an am als auch noch nicht kein keine wenn dann ob man mir mich dir dich sich uns hat habe haben wird werden gibt geben brauche brauchen mal schon nur sehr viel viele mehr hier dort the a an and or is are do does how what when where who which for with to of in on my i".split(" "),
);

/** Kleinschreibung, Umlaute vereinheitlicht, Satzzeichen weg, Stoppwörter weg, grobe Wortstämme. */
export function woerter(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/§/g, " paragraf ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPP.has(w))
    .map((w) => (w.length > 6 ? w.replace(/(ungen|ung|en|er|es|e|n|s)$/, "") : w));
}

/** Fragen, die individuelle Steuer- oder Rechtsberatung wären (StBerG/RDG, Spezifikation 8). */
const BERATUNG = [
  /\bsoll(te)? ich\b/i,
  /\blohnt (es )?sich\b/i,
  /\bwas ist (für mich |in meinem fall )?(besser|günstiger|sinnvoller)\b/i,
  /\bsteuern? sparen\b/i,
  /\bin meinem (konkreten |speziellen )?fall\b/i,
  /\b(einspruch|widerspruch) (einlegen|gegen)\b/i,
  /\b(verklagen|klage einreichen|abmahnung erhalten)\b/i,
  /\bwie viel steuern? (zahle|muss) ich\b/i,
  /\b(absetzen|abziehen|abschreiben) kann ich\b/i,
  /\bshould i\b/i,
  /\bin my (specific )?case\b/i,
];

export function istBeratungsfrage(frage: string): boolean {
  return BERATUNG.some((m) => m.test(frage));
}

const t = (x: Text | undefined, s: Sprache) => (x ? (s === "en" && x.en ? x.en : x.de) : "");

interface Feld { woerter: string[]; gewicht: number }
function felderPflicht(p: KatalogPflicht): Feld[] {
  return [
    { woerter: woerter(`${p.titel.de} ${p.titel.en ?? ""}`), gewicht: 3 },
    { woerter: woerter((p.begriffe ?? []).map((b) => `${b.begriff.de} ${b.begriff.en ?? ""}`).join(" ")), gewicht: 2.5 },
    { woerter: woerter(`${p.kurz.de} ${p.kurz.en ?? ""}`), gewicht: 2 },
    { woerter: woerter(p.rechtsgrundlage.join(" ")), gewicht: 2 },
    { woerter: woerter(`${p.erklaerung.de} ${(p.begriffe ?? []).map((b) => b.erklaerung.de).join(" ")}`), gewicht: 1 },
    { woerter: woerter(p.id.replace(/[._]/g, " ")), gewicht: 1 },
  ];
}

/** Punkte: je Suchwort das beste Feld, in dem es (als Wort oder Wortanfang ab 4 Zeichen) vorkommt. */
function punkte(suche: string[], felder: Feld[]): number {
  let summe = 0;
  for (const w of new Set(suche)) {
    let best = 0;
    for (const f of felder)
      if (f.gewicht > best && f.woerter.some((x) => x === w || (w.length >= 4 && (x.startsWith(w) || (x.length >= 4 && w.startsWith(x)))))) best = f.gewicht;
    summe += best;
  }
  return summe;
}

/** Mindestpunkte für eine sichere Antwort (darunter: „weiß ich nicht sicher“). */
export const SCHWELLE = 3;

export function frageBeantworten(
  frage: string,
  katalog: { pflichten: readonly KatalogPflicht[]; regelwerte: readonly KatalogRegelwert[] },
  kontext: { geltend?: ReadonlySet<string>; nichtGeltend?: ReadonlySet<string>; stichtag: string; sprache: Sprache },
): Antwort {
  const suche = woerter(frage);
  const s = kontext.sprache;
  const pflichtTreffer: Treffer[] = katalog.pflichten
    .filter((p) => p.status_recht !== "ausgelaufen")
    .map((p) => {
      let n = punkte(suche, felderPflicht(p));
      const gilt = kontext.geltend?.has(p.id) ? true : kontext.nichtGeltend?.has(p.id) ? false : null;
      if (gilt) n *= 1.3;
      return {
        art: "pflicht" as const,
        pflicht_id: p.id,
        titel: t(p.titel, s),
        kurz: t(p.kurz, s),
        erklaerung: t(p.erklaerung, s),
        rechtsgrundlage: p.rechtsgrundlage,
        quellen: p.quellen.map((q) => ({ titel: q.titel, url: q.url })),
        pruefung: { status: p.pruef_status ?? p.pruefung?.status ?? "entwurf", geprueft_am: p.geprueft_am ?? p.pruefung?.geprueft_am ?? null },
        gilt_fuer_dich: gilt,
        punkte: Math.round(n * 10) / 10,
      };
    })
    .filter((x) => x.punkte >= SCHWELLE)
    .sort((a, b) => b.punkte - a.punkte)
    .slice(0, 3);

  // Regelwerte: die am Stichtag gültige Version je ID
  const aktuell = new Map<string, KatalogRegelwert>();
  for (const r of katalog.regelwerte) {
    if (r.gueltig_ab && r.gueltig_ab > kontext.stichtag) continue;
    if (r.gueltig_bis && r.gueltig_bis < kontext.stichtag) continue;
    const alt = aktuell.get(r.id);
    if (!alt || (r.gueltig_ab ?? "") > (alt.gueltig_ab ?? "") || ((r.gueltig_ab ?? "") === (alt.gueltig_ab ?? "") && r.version > alt.version)) aktuell.set(r.id, r);
  }
  const regelwertTreffer: RegelwertTreffer[] = [...aktuell.values()]
    .map((r) => ({
      art: "regelwert" as const,
      id: r.id,
      bezeichnung: t(r.bezeichnung, s),
      wert: r.wert,
      einheit: r.einheit,
      gueltig_ab: r.gueltig_ab ?? null,
      gueltig_bis: r.gueltig_bis ?? null,
      status_recht: r.status_recht,
      quellen: (r.quellen ?? []).map((q) => ({ titel: q.titel, url: q.url })),
      pruefung: { status: r.pruefung?.status ?? "entwurf" },
      punkte: punkte(suche, [{ woerter: woerter(`${r.bezeichnung.de} ${r.bezeichnung.en ?? ""}`), gewicht: 3 }, { woerter: woerter(r.id.replace(/[._]/g, " ")), gewicht: 1.5 }]),
    }))
    .filter((x) => x.punkte >= SCHWELLE)
    .sort((a, b) => b.punkte - a.punkte)
    .slice(0, 2);

  const art = istBeratungsfrage(frage) ? "beratung" : pflichtTreffer.length || regelwertTreffer.length ? "antwort" : "unsicher";
  return { art, treffer: pflichtTreffer, regelwerte: regelwertTreffer, ki_formuliert: false };
}

/** Schnittstelle für ein späteres Sprachmodell (AVV, EU-Hosting nötig). Darf nur Passagen umformulieren (E-100). */
export interface KiGateway {
  readonly verfuegbar: boolean;
  umformulieren(frage: string, passagen: string[], sprache: Sprache): Promise<string>;
}
export class NichtVerfuegbareKi implements KiGateway {
  readonly verfuegbar = false;
  async umformulieren(): Promise<string> {
    throw new Error("Kein Sprachmodell angebunden");
  }
}
