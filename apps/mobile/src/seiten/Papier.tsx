import { Pressable, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { cent, ohneVerdeckte, sichtbar, zahl, type Daten, type Eintrag, type Feld, type Vorlage } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Symbol, T, textAus, useGrosseSchrift } from "../ui/bausteine";
import { isoliert } from "../ui/trennen";
import { RADIUS, SCHRIFT } from "../ui/thema";
import { euroText } from "../unterlagen/ablage";

/** Papier ist immer weiß mit dunkler Schrift – wie das spätere PDF, auch im Dunkelmodus. */
const TINTE = "#0c1f18";
const LEISE = "#5b6b65";
const LINIE = "#e3e9e6";
/** gedrückter Bereich: Amtsgrün-Hauch (B12) */
const GEDRUECKT = "#e1f3ea";
const FEHLT = "#a05a00";
const FEHLT_GRUND = "#fff2dc";

type Zeile = { links: string; rechts?: string; voll?: boolean; fett?: boolean };

/** Wert eines Felds für das Papier – leer heißt: nicht zeigen. */
function wert(f: Feld, w: unknown): string {
  if (w === null || w === undefined || w === "" || w === false) return "";
  switch (f.art) {
    case "datum":
      return typeof w === "string" ? textAus(w) : "";
    case "schalter":
      return w === true ? TEXT.papier_ja : "";
    case "wahl":
      return f.optionen.find((o) => o.wert === w)?.text ?? String(w);
    case "mehrfach":
    case "bausteine":
      return Array.isArray(w) && w.length ? (w.length === 1 ? (f.optionen.find((o) => o.wert === w[0])?.text ?? String(w[0])) : TEXT.papier_ausgewaehlt(w.length)) : "";
    case "betrag": {
      const c = typeof w === "string" ? cent(w) : null;
      return c === null ? String(w) : euroText(c);
    }
    case "mehrzeilig":
      return String(w).split("\n").map((x) => x.trim()).filter(Boolean).join(", ");
    case "liste":
      return "";
    default:
      return String(w).trim();
  }
}

/** Ein Listeneintrag als Zeile: Bezeichnung links, bei Menge und Preis „2 × 25,00 €“ rechts. */
function eintragZeile(f: Extract<Feld, { art: "liste" }>, e: Eintrag): Zeile | null {
  const roh = typeof e[f.titelFeld] === "string" ? (e[f.titelFeld] as string).trim() : "";
  // R11 (Reinigung #18): Datum als TT.MM.JJJJ (Arbeitstage), nicht „2026-10-05“; dazu Beginn bis Ende, wenn eingetragen
  const istDatum = /^\d{4}-\d{2}-\d{2}$/.test(roh);
  const zeit = istDatum && typeof e.beginn === "string" && typeof e.ende === "string" && e.beginn && e.ende ? ` · ${e.beginn}–${e.ende}` : "";
  const titel = istDatum ? `${textAus(roh)}${zeit}` : roh;
  const preisFeld = f.felder.find((x) => x.art === "betrag");
  const preis = preisFeld && typeof e[preisFeld.id] === "string" ? cent(e[preisFeld.id] as string) : null;
  const mengeFeld = f.felder.find((x) => x.art === "zahl");
  const menge = mengeFeld && typeof e[mengeFeld.id] === "string" ? zahl(e[mengeFeld.id] as string) : null;
  if (!titel && preis === null) return null;
  const rechts = preis === null ? undefined : menge !== null && menge !== 1 ? `${String(menge).replace(".", ",")} × ${euroText(preis)}` : euroText(preis);
  return { links: titel || f.eintrag, rechts };
}

/** Zeilen eines Abschnitts: Listen als Einträge, sonst „Beschriftung – Wert“; höchstens acht. */
function zeilen(felder: Feld[], d: Daten, nameFeld?: string): Zeile[] {
  const z: Zeile[] = [];
  for (const f of felder) {
    if (!sichtbar(f, d)) continue;
    if (f.art === "liste") {
      for (const e of (Array.isArray(d[f.id]) ? (d[f.id] as Eintrag[]) : [])) {
        const r = eintragZeile(f, e);
        if (r) z.push(r);
      }
      continue;
    }
    const w = wert(f, d[f.id]);
    if (!w) continue;
    // Schalter mit Standard „an“ (z. B. „Leistungsdatum = Rechnungsdatum“) sind kein Inhalt, nur eine Voreinstellung
    if (f.art === "schalter") {
      if (f.vorbelegung !== true) z.push({ links: f.label, voll: true });
    } else if (f.id === nameFeld) z.push({ links: w, voll: true, fett: true });
    else if (f.art === "mehrzeilig") z.push({ links: w, voll: true });
    else z.push({ links: f.label, rechts: w });
  }
  // R12 (Zoll #15): mehr als acht Zeilen – sagen, dass es weitere gibt („… und 2 weitere“), statt still abzuschneiden
  return z.length > 8 ? [...z.slice(0, 7), { links: TEXT.r12p_und_weitere(z.length - 7), voll: true }] : z;
}

/** Zwei Schatten wie bei echtem Papier (B12): ein enger Kontaktschatten und ein weicher, tiefer. */
const SCHATTEN_NAH: ViewStyle = { shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 };
const SCHATTEN_FERN: ViewStyle = { shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 10 };

/** Blatt Papier: weiß, Ecken 6, zwei Schatten. Der Inhalt bestimmt die Höhe. */
export function Papier({ children, stil }: { children: ReactNode; stil?: ViewStyle }) {
  return (
    <View style={[{ borderRadius: RADIUS.blatt, backgroundColor: "#ffffff" }, SCHATTEN_FERN]}>
      <View style={[{ borderRadius: RADIUS.blatt, backgroundColor: "#ffffff" }, SCHATTEN_NAH, stil]}>{children}</View>
    </View>
  );
}

/**
 * Das Dokument als Blatt Papier zum Bearbeiten (E-144): jeder Abschnitt ist ein antippbarer Bereich auf dem Papier –
 * Antippen springt zu den Feldern dieses Abschnitts. Fehlendes steht bernsteinfarben im Bereich. Das echte PDF zeigt
 * „Vorschau groß ansehen“.
 */
export function PapierBlatt({ v, d, jeSchritt, ergebnis, springen }: { v: Vorlage; d: Daten; jeSchritt: string[][]; ergebnis: [string, string][]; springen: (schritt: number) => void }) {
  const summe = ergebnis.at(-1);
  // große Schrift: Bezeichnung und Wert untereinander – nebeneinander blieben vom Wert nur „2…“ (wie M4)
  const gross = useGrosseSchrift();
  d = ohneVerdeckte(v, d); // wie im PDF: nichts zeigen, was das Formular gerade verdeckt
  return (
    <Papier stil={{ paddingHorizontal: 20, paddingVertical: 22, gap: 6 }}>
      <View style={{ flexDirection: gross ? "column" : "row", alignItems: "flex-start", justifyContent: "space-between", gap: gross ? 0 : 10, marginBottom: 6 }}>
        <T farbe={TINTE} stil={{ ...SCHRIFT.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.7, flex: 1 }}>{v.titel}</T>
        <T v="caption" farbe={LEISE} stil={{ marginTop: gross ? 2 : 6 }}>{TEXT.papier_tippen}</T>
      </View>
      {v.abschnitte.map((a, i) => {
        const fehlt = jeSchritt[i] ?? [];
        const z = zeilen(a.felder, d, v.person?.felder.name);
        return (
          <View key={i}>
          {/* gerade Haarlinie zwischen den Bereichen – nicht am abgerundeten Bereich selbst */}
          {i > 0 && !fehlt.length && !(jeSchritt[i - 1] ?? []).length ? <View style={{ height: 1, backgroundColor: LINIE }} /> : null}
          <Pressable
            accessibilityRole="button"
            // VoiceOver liest, was auf dem Papier steht, und was fehlt – nicht nur „Rechnungsempfänger bearbeiten“
            accessibilityLabel={[`${a.titel ?? TEXT.schritt(i + 1, v.abschnitte.length)}: ${z.map((x) => (x.rechts ? `${x.links} ${x.rechts}` : x.links)).join(", ")}`.replace(/: $/, ""), fehlt.length ? TEXT.papier_fehlt(fehlt.join(", ")) : ""].filter(Boolean).join(". ")}
            accessibilityHint={TEXT.papier_tippen}
            onPress={() => springen(i)}
            style={({ pressed }) => ({ marginHorizontal: -10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: RADIUS.fein, backgroundColor: pressed ? GEDRUECKT : fehlt.length ? FEHLT_GRUND : "transparent" })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: z.length || fehlt.length ? 4 : 0 }}>
              <T v="caption" farbe={LEISE} stil={{ ...SCHRIFT.bold }}>{a.titel ?? ""}</T>
              <Symbol name="pencil" groesse={16} farbe={fehlt.length ? FEHLT : LEISE} />
            </View>
            {z.map((x, k) =>
              x.voll ? (
                <T key={k} v="klein" fett={x.fett} farbe={TINTE} numberOfLines={2} stil={{ writingDirection: "ltr" }}>{isoliert(x.links)}</T>
              ) : (
                <View key={k} style={{ flexDirection: gross ? "column" : "row", justifyContent: "space-between", gap: gross ? 0 : 12, paddingVertical: gross ? 3 : 1 }}>
                  {/* Beträge einer Liste (Positionen) werden nie gekürzt – die Bezeichnung bricht um */}
                  <T v="klein" farbe={x.rechts && a.felder.some((f) => f.art === "liste") ? TINTE : LEISE} numberOfLines={2} stil={{ flex: 1, flexShrink: 1, writingDirection: "ltr" }}>{isoliert(x.links)}</T>
                  {x.rechts ? <T v="klein" farbe={TINTE} numberOfLines={gross ? undefined : 1} stil={{ fontVariant: ["tabular-nums"], flexShrink: a.felder.some((f) => f.art === "liste") ? 0 : 1, textAlign: gross ? "left" : "right" }}>{x.rechts}</T> : null}
                </View>
              ),
            )}
            {fehlt.length ? <T v="caption" farbe={FEHLT} stil={{ ...SCHRIFT.halb, marginTop: 2 }}>{TEXT.papier_fehlt(fehlt.join(", "))}</T> : null}
          </Pressable>
          </View>
        );
      })}
      {summe ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: 1.5, borderColor: TINTE, paddingTop: 10, marginTop: 4 }}>
          <T fett farbe={TINTE}>{summe[0]}</T>
          <T farbe={TINTE} stil={{ ...SCHRIFT.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.8, fontVariant: ["tabular-nums"] }}>{summe[1]}</T>
        </View>
      ) : null}
    </Papier>
  );
}
