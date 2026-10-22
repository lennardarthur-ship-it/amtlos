import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { T as TEXT } from "../texte";
import { Karte, T } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { BLATT_OBEN, RADIUS, RAND, SCHRIFT, useFarben } from "../ui/thema";
import { istErledigt, type PflichtInfo } from "../pflichten/check";
import { useAmtlos } from "../zustand";
import { Inhalt, Leer } from "./gemeinsam";
import { PflichtZeile } from "./Pflichten";

export interface Monat {
  /** „2026-11“ */
  schluessel: string;
  kurz: string;
  lang: string;
  termine: number;
  jetzt: boolean;
}

/** Monatskürzel und Termine je Monat für die nächsten zwölf Monate (ab dem laufenden Monat). */
export function jahresblick(gilt: readonly PflichtInfo[], tag: string): Monat[] {
  const [j, m] = tag.split("-").map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(j, m - 1 + i, 15));
    const schluessel = d.toISOString().slice(0, 7);
    const termine = gilt.reduce((n, p) => n + p.termine.filter((t) => t.startsWith(schluessel)).length, 0);
    const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", ...o }).format(d);
    return { schluessel, kurz: fmt({ month: "short" }).replace(".", ""), lang: fmt({ month: "long", year: "numeric" }), termine, jetzt: i === 0 };
  });
}

/** Termine eines Monats: je Pflicht der erste Termin in diesem Monat, nach Datum. */
export function termineIm(gilt: readonly PflichtInfo[], schluessel: string): { p: PflichtInfo; termin: string }[] {
  return gilt
    .map((p) => ({ p, termin: p.termine.find((t) => t.startsWith(schluessel)) }))
    .filter((x): x is { p: PflichtInfo; termin: string } => Boolean(x.termin))
    .sort((a, b) => a.termin.localeCompare(b.termin) || a.p.titel.localeCompare(b.p.titel, "de"));
}

/** R12 (UX #22): Blatt mit den Terminen eines Monats – aus dem Jahresraster. */
function MonatSeite({ monat, gilt }: { monat: Monat; gilt: readonly PflichtInfo[] }) {
  const z = useAmtlos();
  const liste = termineIm(gilt, monat.schluessel);
  const e = { erledigt: z.stand.erledigt, unterlagen: z.stand.unterlagen, betrieb: z.stand.betrieb };
  return (
    <Unterseite titel={monat.lang} unter={TEXT.monat_termine(monat.lang, liste.length)}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: BLATT_OBEN, paddingBottom: 40 }}>
        {liste.length ? (
          <Karte>
            {liste.map(({ p }, i) => (
              <PflichtZeile key={p.id} p={{ ...p, naechsterTermin: p.termine.find((t) => t.startsWith(monat.schluessel)) ?? p.naechsterTermin }} erledigt={istErledigt(p, e)} ohneWichtig letzte={i === liste.length - 1} />
            ))}
          </Karte>
        ) : (
          <Leer symbol="calendar" text={TEXT.r12_monat_leer} />
        )}
      </Inhalt>
    </Unterseite>
  );
}

/**
 * Jahresblick auf der Bühne (E-142, R12 UX #22): zwölf Monatskacheln ab jetzt in zwei Reihen zu sechs – auf 375 pt
 * stand sonst ein Rest von zwei breiten Kacheln in einer dritten Reihe. Jede Kachel ist antippbar und zeigt die
 * Termine des Monats. Der laufende Monat in Minze, Monate mit Terminen getönt, ruhige Monate gestrichelt.
 */
export function Jahresraster({ gilt, tag }: { gilt: readonly PflichtInfo[]; tag: string }) {
  const f = useFarben();
  const nav = useNav();
  const monate = useMemo(() => jahresblick(gilt, tag), [gilt, tag]);
  const reihen = [monate.slice(0, 6), monate.slice(6, 12)];
  return (
    <View accessibilityLabel={TEXT.jahr_zusammen(monate.filter((m) => m.termine).map((m) => TEXT.monat_termine(m.lang, m.termine)))} style={{ gap: 6 }}>
      {reihen.map((reihe, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 6 }}>
          {reihe.map((mo) => (
            <Pressable
              key={mo.schluessel}
              accessibilityRole="button"
              accessibilityLabel={TEXT.monat_termine(mo.lang, mo.termine)}
              accessibilityHint={TEXT.r12_monat_hinweis}
              onPress={() => nav.oeffnen(`monat-${mo.schluessel}`, () => <MonatSeite monat={mo} gilt={gilt} />, true)}
              // R11 (UX #13): flach statt knopfartig – nur der laufende Monat ist hervorgehoben
              style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 54, borderRadius: RADIUS.klein, padding: 6, justifyContent: "space-between", opacity: pressed ? 0.7 : 1, backgroundColor: mo.jetzt ? f.minze : "transparent", borderTopWidth: mo.jetzt ? 0 : 1, borderColor: mo.termine ? "rgba(124,245,200,0.55)" : "rgba(255,255,255,0.18)" })}
            >
              <T v="caption" numberOfLines={1} maxFontSizeMultiplier={1.4} farbe={mo.jetzt ? f.buehneKnopfText : f.buehneLeise} stil={{ ...SCHRIFT.halb, fontSize: 12, lineHeight: 14 }}>{mo.kurz}</T>
              {mo.termine ? <T maxFontSizeMultiplier={1.4} farbe={mo.jetzt ? f.buehneKnopfText : f.buehneText} stil={{ ...SCHRIFT.display, fontSize: 17, lineHeight: 19 }}>{String(mo.termine)}</T> : null}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
