/**
 * E-210: Firma und Rechtsform zusammensetzen, ohne den Rechtsformzusatz doppelt zu drucken („Muster UG UG (haftungsbeschränkt)“).
 *
 * Der Name aus „Mein Betrieb“ ist Freitext: „Muster UG“, „Muster UG (haftungsbeschraenkt)“, „Muster GmbH & Co KG“,
 * „Muster e.Kfm.“, „Muster Verwaltungs-GmbH“ … Verglichen wird wortweise ohne Groß-/Kleinschreibung, Punkte, Klammern,
 * Bindestriche und Leerzeichen („G.m.b.H.“ = „GmbH“, „e. K.“ = „e.K.“), „&“, „u.“ und „und“ gelten gleich. Ein Zusatz
 * zählt nur als ganze Wörter („Augustin“ enthält kein „AG“, „Gugelhupf“ kein „UG“). Ohne Abhängigkeiten (auch für html.ts).
 */

/** Rechtsformen und ihre Schreibweisen (nach `woerter` zusammengezogen); Familie = gleiche Rechtsform. */
const FAMILIEN: { familie: string; formen: string[] }[] = [
  { familie: "ug_co_kg", formen: [] },
  { familie: "gmbh_co_kg", formen: [] },
  { familie: "ug", formen: ["ug", "ughaftungsbeschraenkt", "unternehmergesellschaft", "unternehmergesellschafthaftungsbeschraenkt"] },
  { familie: "gmbh", formen: ["gmbh", "ggmbh", "mbh", "gesellschaftmitbeschraenkterhaftung", "gemeinnuetzigegmbh"] },
  { familie: "ag", formen: ["ag", "aktiengesellschaft"] },
  { familie: "kgaa", formen: ["kgaa", "kommanditgesellschaftaufaktien"] },
  { familie: "kg", formen: ["kg", "kommanditgesellschaft"] },
  { familie: "ohg", formen: ["ohg", "offenehandelsgesellschaft"] },
  { familie: "ek", formen: ["ek", "ekfm", "ekfr", "eingetragenerkaufmann", "eingetragenekauffrau", "eingetragenerkaufmannfrau"] },
  { familie: "partg", formen: ["partg", "partgmbb", "partnerschaftsgesellschaft", "partnerschaftsgesellschaftmbb", "partnerschaftsgesellschaftmitbeschraenkterberufshaftung"] },
  { familie: "gbr", formen: ["gbr", "egbr", "gesellschaftbuergerlichenrechts", "eingetragenegesellschaftbuergerlichenrechts"] },
  { familie: "eg", formen: ["eg", "eingetragenegenossenschaft"] },
  { familie: "se", formen: ["se"] },
  { familie: "ltd", formen: ["ltd", "limited"] },
];
const UG = FAMILIEN.find((f) => f.familie === "ug")!.formen;
const GMBH = FAMILIEN.find((f) => f.familie === "gmbh")!.formen.filter((x) => x !== "mbh");
const CO_KG = ["&cokg", "&cokommanditgesellschaft"];
FAMILIEN[0]!.formen.push(...UG.flatMap((u) => CO_KG.map((c) => u + c)));
FAMILIEN[1]!.formen.push(...GMBH.flatMap((g) => CO_KG.map((c) => g + c)));

/** Wörter eines Namens: klein, Umlaute ausgeschrieben, „&“/„u.“/„und“ als „&“, ohne Satzzeichen, Klammern und Bindestriche. */
function woerter(t: string): string[] {
  return t
    .toLocaleLowerCase("de")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/&/g, " & ")
    .split(/[\s.,;:()[\]/\-–+]+/)
    .filter(Boolean)
    .map((w) => (w === "und" || w === "u" ? "&" : w));
}

/** Kommt eine der Schreibweisen als Folge ganzer Wörter im Namen vor? */
function enthaelt(namensWoerter: string[], formen: readonly string[]): boolean {
  const set = new Set(formen);
  for (let i = 0; i < namensWoerter.length; i++) {
    let s = "";
    for (let j = i; j < namensWoerter.length && j < i + 6; j++) {
      s += namensWoerter[j];
      if (set.has(s)) return true;
    }
  }
  return false;
}

/** Familie einer Rechtsform („UG“, „UG (haftungsbeschränkt)“, „ug (haftungsbeschraenkt)“ → „ug“) oder null. */
function familieVon(rechtsform: string): string | null {
  const s = woerter(rechtsform).join("");
  return FAMILIEN.find((f) => f.formen.includes(s))?.familie ?? null;
}

const OHNE_ZUSATZ = /^(?:einzelunternehmen|einzelunternehmer(?:in)?|freiberuf(?:lich|ler|lerin)?|kleingewerbe)$/;

/**
 * Steht die Rechtsform (in irgendeiner üblichen Schreibweise) schon im Namen? „Muster UG“ enthält „UG (haftungsbeschränkt)“,
 * „Muster GmbH & Co KG“ enthält „GmbH & Co. KG“; „Muster GmbH & Co. KG“ enthält „GmbH“ und „KG“ als Wort, aber nicht als
 * Rechtsform der Gesellschaft (eine GmbH & Co. KG ist weder GmbH noch einfache KG).
 */
export function rechtsformImNamen(name: string, rechtsform: string | undefined): boolean {
  const rf = (rechtsform ?? "").trim();
  if (!rf) return true;
  const w = woerter(name);
  const fam = familieVon(rf);
  if (!fam) return enthaelt(w, [woerter(rf).join("")]);
  const co = enthaelt(w, [...FAMILIEN[0]!.formen, ...FAMILIEN[1]!.formen]);
  if (co && fam !== "gmbh_co_kg" && fam !== "ug_co_kg") return false;
  return enthaelt(w, FAMILIEN.find((f) => f.familie === fam)!.formen);
}

/** Nennt der Name irgendeinen Rechtsformzusatz (auch einen anderen als die gewählte Rechtsform)? */
export function rechtsformzusatzImNamen(name: string): boolean {
  const w = woerter(name);
  return FAMILIEN.some((f) => enthaelt(w, f.formen));
}

/**
 * Firma mit Rechtsformzusatz: der Name, und nur wenn er noch keinen Rechtsformzusatz nennt, die Rechtsform dahinter.
 * Einzelunternehmen (und ohne Rechtsform) nie. Nennt der Name einen anderen Zusatz als die Rechtsform, bleibt er, wie er
 * ist – zwei Zusätze wären in jedem Fall falsch; den Widerspruch meldet die Prüfung der Vorlage.
 */
export function firmaMitRechtsform(name: string, rechtsform: string | undefined): string {
  const n = name.trim();
  const rf = (rechtsform ?? "").trim();
  if (!rf || OHNE_ZUSATZ.test(woerter(rf).join(""))) return n;
  if (!n) return n;
  if (rechtsformImNamen(n, rf) || rechtsformzusatzImNamen(n)) return n;
  return `${n} ${rf}`;
}
