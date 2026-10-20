import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { betragUnplausibel, cent, mengeUngueltig, summen, zahl, eintragAusVorschlag, kurztitelListe, neuerEintrag, ohneVerdeckteFelder, sichtbar, unlesbar, unlesbarText, vorlageFuer, type Daten, type Eintrag, type EintragWert, type ListenFeld, type Vorschlag } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { ChipLeiste, Fuss, HinzufuegenKnopf, Kaestchen, Karte, Knopf, Symbol, T, TextKnopf } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { BLATT_OBEN, HAARLINIE, RADIUS, RAND, ZIEL, useFarben } from "../ui/thema";
import { heute, personenSortiert } from "../unterlagen/speicher";
import { VORSCHLAG_GRUPPE } from "../pflichten/check";
import { useAmtlos } from "../zustand";
import { Ansage, Felder, gefuellt } from "./felder";
import { Inhalt } from "./gemeinsam";

/** Filter „passend zu deinem Betrieb“ (mehrere Gruppen, z. B. Friseur und Kosmetik bei Beauty) */
const PASSEND = "\u0001passend";

const titelText = (feld: ListenFeld, e: Eintrag) => (typeof e[feld.titelFeld] === "string" ? (e[feld.titelFeld] as string).trim().split("\n")[0]! : "");
const eintraegeVon = (d: Daten | undefined, feld: ListenFeld) => ((d && Array.isArray(d[feld.id]) ? d[feld.id] : []) as Eintrag[]);

/** Hat jemand in einem Eintrag etwas eingetragen? (Startwerte wie Datum, Auswahl oder Menge zählen nicht) */
function benutzt(feld: ListenFeld, e: Eintrag): boolean {
  return feld.felder.some((x) => (x.art === "text" || x.art === "mehrzeilig" || x.art === "betrag" || x.art === "zahl" || x.art === "uhrzeit" || x.art === "mehrfach" || x.art === "bausteine") && !("vorbelegung" in x && x.vorbelegung) && gefuellt(e[x.id]));
}
/** Fehlende Pflichtangaben eines Eintrags (Bezeichnungen der Felder) und unlesbare Beträge („45 Euro“). */
const fehltIn = (feld: ListenFeld, e: Eintrag) => {
  if (!benutzt(feld, e)) return [];
  const da = feld.felder.filter((x) => sichtbar(x, ohneVerdeckteFelder(feld.felder, e)));
  return [...da.filter((x) => x.pflicht && !gefuellt(e[x.id])).map((x) => x.label), ...da.filter((x) => unlesbar(x, e[x.id])).map(unlesbarText)];
};
/** Titel aller Einträge einer Liste – gekürzt, aber nie zwei gleiche („Färben, Dauerwelle“ zweimal). */
const anzeigeTitel = (feld: ListenFeld, eintraege: Eintrag[]) => {
  const roh = eintraege.map((e) => {
    const t = titelText(feld, e);
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t.split("-").reverse().join(".") : t;
  });
  const kurz = kurztitelListe(roh);
  return roh.map((t, i) => (t ? kurz[i]! : `${feld.eintrag} ${i + 1} ${TEXT.eintrag_leer}`));
};

function feldIn(vorlageId: string, feldId: string): ListenFeld | undefined {
  const f = vorlageFuer(vorlageId)?.abschnitte.flatMap((a) => a.felder).find((x) => x.id === feldId);
  return f?.art === "liste" ? f : undefined;
}

/** Ein Eintrag einer Liste auf eigener Seite (E-124): ruhiger als aufgeklappte Karten, Tastatur hat Platz. */
function EintragSeite({ id, feldId, index, neu }: { id: string; feldId: string; index: number; neu?: boolean }) {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const f = useFarben();
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const feld = u ? feldIn(u.vorlage, feldId) : undefined;
  const e = feld ? eintraegeVon(u?.daten, feld)[index] : undefined;
  const anfang = useRef(e ? JSON.stringify(e) : "");
  const zRef = useRef(z);
  zRef.current = z;
  const weg = useRef(false);
  // ein neuer Eintrag, in den nichts eingetragen wurde, verschwindet beim Verlassen wieder
  useEffect(
    () => () => {
      if (!neu || !feld) return;
      const liste = eintraegeVon(zRef.current.daten(id), feld);
      if (liste[index] && JSON.stringify(liste[index]) === anfang.current) zRef.current.setzen(id, { [feld.id]: liste.filter((_, j) => j !== index) });
    },
    [neu, feld, id, index],
  );
  useEffect(() => {
    if (!e && !weg.current) {
      weg.current = true;
      nav.zurueck();
    }
  }, [e, nav]);
  if (!feld || !e) return <Unterseite titel="">{null}</Unterseite>;
  // ein unlesbarer Preis würde als 0,00 € auf der Rechnung stehen – erst korrigieren (rote Zeile am Feld)
  const unlesbarDa = feld.felder.some((x) => sichtbar(x, ohneVerdeckteFelder(feld.felder, e)) && unlesbar(x, e[x.id]));
  // Menge 0 oder negativ (M6): ergäbe eine Zeile über 0,00 € – die E-Rechnung lehnt sie ab; Rabatte als negativer Preis
  const mengeFalsch = feld.felder.some((x) => x.id === "menge" && x.art === "zahl") && benutzt(feld, e) && typeof e.menge === "string" && e.menge.trim() !== "" && zahl(e.menge) !== null && mengeUngueltig(zahl(e.menge)!);
  const setze = (k: string, w: EintragWert) => {
    const liste = eintraegeVon(z.daten(id), feld);
    z.setzen(id, { [feld.id]: liste.map((y, j) => (j === index ? { ...y, [k]: w } : y)) });
  };
  return (
    <Unterseite titel={`${feld.eintrag} ${index + 1}`}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: BLATT_OBEN - 20, paddingBottom: 32 }}>
        <Felder felder={feld.felder} werte={e} fehlt={fehltIn(feld, e)} setze={setze} />
        <Rechnung e={e} kleinunternehmer={u?.daten.kleinunternehmer === true} />
        <TextKnopf
          symbol="trash"
          gefahr
          text={TEXT.entfernen}
          onPress={() => {
            anfang.current = "";
            weg.current = true;
            z.setzen(id, { [feld.id]: eintraegeVon(z.daten(id), feld).filter((_, j) => j !== index) });
            // die Meldungen können (noch) keine Aktion wie „Rückgängig“ – wenigstens sagen, was passiert ist
            melden(TEXT.eintrag_entfernt, "info");
            nav.zurueck();
          }}
          stil={{ marginTop: 24 }}
        />
      </Inhalt>
      <Fuss ueber={unlesbarDa ? <Ansage v="caption" text={TEXT.preis_unlesbar_fertig} farbe={f.frist} /> : mengeFalsch ? <Ansage v="caption" text={TEXT.menge_null} farbe={f.frist} /> : null}>
        <Knopf text={TEXT.fertig} deaktiviert={unlesbarDa} onPress={nav.zurueck} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/**
 * Rechnung der Position live unter den Feldern (B10): „2 × 25,00 € = 50,00 € netto · 59,50 € brutto“ – mit der
 * Summenrechnung der Fachlogik, damit hier dieselbe Zahl steht wie auf der Rechnung.
 */
function Rechnung({ e, kleinunternehmer }: { e: Eintrag; kleinunternehmer: boolean }) {
  const f = useFarben();
  const preis = typeof e.preis === "string" ? cent(e.preis) : null;
  if (preis === null || !("menge" in e || "satz" in e)) return null;
  const menge = typeof e.menge === "string" && e.menge.trim() ? (zahl(e.menge) ?? 1) : 1;
  const satz = kleinunternehmer ? null : Number(typeof e.satz === "string" && e.satz ? e.satz : "19");
  const s = summen([{ bezeichnung: "", menge, einheit: "stueck", preis_cent: preis, ust_satz: satz }], kleinunternehmer);
  const eur = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
  const text = TEXT.position_rechnung(new Intl.NumberFormat("de-DE", { maximumFractionDigits: 4 }).format(menge), eur(preis), eur(s.netto_cent), kleinunternehmer ? null : eur(s.brutto_cent));
  return (
    <View accessibilityRole="summary" style={{ marginTop: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.klein, backgroundColor: f.amtHauch }}>
      <T v="klein" fett farbe={f.amtTief} stil={{ fontVariant: ["tabular-nums"] }}>{text}</T>
      {/* ungewöhnlich hoher Betrag (G6): nur ein Hinweis – Menge und Preis vertauscht oder Komma vergessen? */}
      {betragUnplausibel(s.brutto_cent) ? <T v="caption" farbe={f.bald} stil={{ marginTop: 6 }}>{TEXT.betrag_unplausibel}</T> : null}
    </View>
  );
}

/** Vorschläge für eine Liste: nach Gruppe filtern, kurze Titel ankreuzen, Details bei Bedarf. Schon übernommene sind markiert. */
function VorschlagSeite({ id, feldId }: { id: string; feldId: string }) {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const f = useFarben();
  const u = z.stand.unterlagen.find((x) => x.id === id);
  const feld = u ? feldIn(u.vorlage, feldId) : undefined;
  const alle = feld?.vorschlaege ?? [];
  const gruppen = [...new Set(alle.map((v) => v.gruppe).filter((g): g is string => Boolean(g)))];
  // Branche aus dem Pflichten-Check: passende Gruppen zuerst („Passend für dich“), damit beim Maler keine Friseurchemikalien stehen
  const passend = gruppen.filter((g) => (Array.isArray(z.stand.profil["taetigkeit.branchen"]) ? (z.stand.profil["taetigkeit.branchen"] as string[]) : []).some((b) => (VORSCHLAG_GRUPPE[b] ?? []).includes(g)));
  const [gruppe, setGruppe] = useState<string>(passend.length === 1 ? passend[0]! : passend.length > 1 ? PASSEND : "");
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [offen, setOffen] = useState<string | null>(null);
  if (!feld || !u) return <Unterseite titel="">{null}</Unterseite>;
  const vorhanden = eintraegeVon(u.daten, feld).map((e) => titelText(feld, e));
  const liste = alle.filter((v) => !gruppe || (gruppe === PASSEND ? passend.includes(v.gruppe ?? "") : v.gruppe === gruppe));
  const istDa = (v: Vorschlag) => vorhanden.includes(titelText(feld, v.werte) || v.titel);
  // Kurztitel über alle Vorschläge der Liste (nicht nur die gefilterten) – so bleibt ein Titel beim Filtern gleich
  const kurzAlle = kurztitelListe(alle.map((v) => v.titel));
  const kurzVon = (v: Vorschlag) => kurzAlle[alle.indexOf(v)] ?? v.titel;
  // erste lange Angabe eines Vorschlags (z. B. Schutzmaßnahmen) als Details
  const details = (v: Vorschlag) => feld.felder.filter((x) => x.id !== feld.titelFeld && (x.art === "text" || x.art === "mehrzeilig") && typeof v.werte[x.id] === "string" && (v.werte[x.id] as string).length > 0).slice(0, 2);
  const uebernehmen = () => {
    const neu = alle.filter((v) => gewaehlt.has(v.titel)).map((v) => eintragAusVorschlag(feld, v, z.stand.betrieb, heute()));
    const behalten = eintraegeVon(z.daten(id), feld).filter((e) => benutzt(feld, e));
    z.setzen(id, { [feld.id]: [...behalten, ...neu] });
    melden(TEXT.uebernommen(neu.length));
    nav.zurueck();
  };
  return (
    <Unterseite titel={`${TEXT.vorschlaege_titel}: ${feld.label}`} unter={TEXT.vorschlaege_text}>
      <Inhalt contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: BLATT_OBEN, paddingBottom: 32 }}>
        {gruppen.length > 1 ? (
          <ChipLeiste label={feld.gruppenLabel ?? TEXT.gruppe} wert={gruppe} aendern={setGruppe} optionen={[...(passend.length > 1 ? [{ wert: PASSEND, text: TEXT.passend }] : []), { wert: "", text: TEXT.alle }, ...gruppen.map((g) => ({ wert: g, text: g }))]} stil={{ marginTop: 0 }} />
        ) : null}
        <Karte stil={{ marginTop: 16 }}>
          {liste.map((v, i) => {
            const da = istDa(v);
            const an = da || gewaehlt.has(v.titel);
            const auf = offen === v.titel;
            const kurz = kurzVon(v);
            return (
              <View key={`${v.gruppe}-${v.titel}`} style={{ borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={kurz}
                    accessibilityState={{ checked: an, disabled: da }}
                    aria-checked={an}
                    disabled={da}
                    onPress={() => setGewaehlt((g) => { const n = new Set(g); if (n.has(v.titel)) n.delete(v.titel); else n.add(v.titel); return n; })}
                    style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: ZIEL + 4, paddingVertical: 8, opacity: da ? 0.5 : pressed ? 0.7 : 1 })}
                  >
                    <Kaestchen an={an} />
                    <View style={{ flex: 1 }}>
                      <T v="klein" fett={an}>{kurz}</T>
                      {da ? <T v="caption" leise>{TEXT.schon_drin}</T> : !gruppe && v.gruppe && gruppen.length > 1 ? <T v="caption" leise>{v.gruppe}</T> : null}
                    </View>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${auf ? TEXT.weniger : TEXT.details}: ${kurz}`} accessibilityState={{ expanded: auf }} onPress={() => setOffen(auf ? null : v.titel)} hitSlop={6} style={{ width: ZIEL - 4, height: ZIEL, alignItems: "center", justifyContent: "center" }}>
                    <Symbol name={auf ? "chevron.up" : "chevron.down"} groesse={16} />
                  </Pressable>
                </View>
                {auf ? (
                  <View style={{ paddingLeft: 34, paddingBottom: 12, gap: 6 }}>
                    {kurz !== v.titel ? <T v="klein">{v.titel}</T> : null}
                    {details(v).map((x) => (
                      <View key={x.id}>
                        <T v="caption" fett leise>{x.label}</T>
                        <T v="caption">{ohneTitel(String(v.werte[x.id]), [v.titel, kurz])}</T>
                      </View>
                    ))}
                    {v.quelle ? <T v="caption" leise>{`${TEXT.quelle}: ${v.quelle}`}</T> : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Karte>
      </Inhalt>
      <Fuss>
        <Knopf text={gewaehlt.size ? TEXT.uebernehmen(gewaehlt.size) : TEXT.nichts_gewaehlt} deaktiviert={!gewaehlt.size} symbol="plus" onPress={uebernehmen} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/**
 * Beschreibung ohne den Titel davor (A21): viele Vorschläge wiederholen in der ersten Angabe den Titel („Ausrutschen …:
 * Ausrutschen …, weil …“) – dann nur der Rest, mit großem Anfangsbuchstaben.
 */
export function ohneTitel(text: string, titel: string[]): string {
  const roh = text.trim();
  for (const t of titel.map((x) => x.trim()).filter(Boolean).sort((a, b) => b.length - a.length)) {
    if (roh.toLocaleLowerCase("de").startsWith(t.toLocaleLowerCase("de"))) {
      const rest = roh.slice(t.length).replace(/^[\s:,;.–-]+/, "");
      if (rest.length < 3) return roh;
      return rest[0]!.toLocaleUpperCase("de") + rest.slice(1);
    }
  }
  return roh;
}

/** Rechnungsposition: „2 Stunde × 45,00 € = 90,00 €“ – damit man in der Liste sieht, was die Position kostet. */
function betragszeile(e: Record<string, unknown>): string | null {
  const preis = typeof e.preis === "string" ? cent(e.preis) : null;
  if (preis === null) return null;
  const menge = typeof e.menge === "string" && e.menge.trim() ? (zahl(e.menge) ?? 1) : 1;
  const einheit = typeof e.einheit === "string" && e.einheit.trim() ? ` ${e.einheit.trim()}` : "";
  const fmt = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 4 }).format(menge)}${einheit} × ${fmt(preis)} = ${fmt(Math.round(menge * preis))}`;
}

/** Liste in einem Schritt: Einträge als ruhige Zeilen, darunter Vorschläge, Mitarbeiter übernehmen, eigener Eintrag. */
export function ListenSchritt({ feld, id }: { feld: ListenFeld; id: string }) {
  const z = useAmtlos();
  const nav = useNav();
  const f = useFarben();
  const eintraege = eintraegeVon(z.stand.unterlagen.find((u) => u.id === id)?.daten, feld);
  const titel = anzeigeTitel(feld, eintraege);
  const oeffnen = (i: number, neu = false) => nav.oeffnen(`eintrag-${id}-${feld.id}-${i}`, () => <EintragSeite id={id} feldId={feld.id} index={i} neu={neu} />, true);
  const mitarbeiter = feld.ausMitarbeitern ? personenSortiert(z.stand.mitarbeiter) : [];
  const fehlend = mitarbeiter.filter((p) => !eintraege.some((e) => titelText(feld, e).toLocaleLowerCase("de") === p.name.trim().toLocaleLowerCase("de")));
  return (
    <View style={{ marginTop: 16, gap: 10 }}>
      {eintraege.length ? (
        <Karte>
          {eintraege.map((e, i) => {
            const fehlt = fehltIn(feld, e);
            return (
              <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${feld.eintrag} ${i + 1}: ${titel[i]}${fehlt.length ? `, ${TEXT.eintrag_fehlt(fehlt.length)}: ${fehlt.join(", ")}` : betragszeile(e) ? `, ${betragszeile(e)}` : ""}`} onPress={() => oeffnen(i)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: ZIEL + 12, paddingVertical: 12, borderTopWidth: i ? HAARLINIE : 0, borderColor: f.linie, opacity: pressed ? 0.6 : 1 })}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: fehlt.length ? f.baldHauch : f.amtHauch, alignItems: "center", justifyContent: "center" }}>
                  <T v="caption" fett farbe={fehlt.length ? f.bald : f.amt} stil={{}}>{i + 1}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T fett={benutzt(feld, e)} leise={!benutzt(feld, e)} numberOfLines={2}>{titel[i]}</T>
                  {fehlt.length ? <T v="caption" farbe={f.bald}>{TEXT.eintrag_fehlt(fehlt.length)}</T> : betragszeile(e) ? <T v="caption" leise>{betragszeile(e)}</T> : null}
                </View>
                <Symbol name="chevron.right" groesse={14} farbe={f.zeiger} gewicht="semibold" />
              </Pressable>
            );
          })}
        </Karte>
      ) : (
        <T v="klein" leise>{TEXT.liste_leer}</T>
      )}
      {feld.vorschlaege?.length ? <Knopf ton symbol="checklist" text={TEXT.aus_vorschlaegen(feld.vorschlaege.length)} onPress={() => nav.oeffnen(`vorschlaege-${id}-${feld.id}`, () => <VorschlagSeite id={id} feldId={feld.id} />, true)} /> : null}
      {fehlend.length ? (
        <Knopf
          ton
          symbol="person.2"
          text={TEXT.alle_mitarbeiter(fehlend.length)}
          onPress={() => {
            const behalten = eintraegeVon(z.daten(id), feld).filter((e) => benutzt(feld, e));
            z.setzen(id, { [feld.id]: [...behalten, ...fehlend.map((p) => ({ ...neuerEintrag(feld, z.stand.betrieb, heute()), [feld.titelFeld]: p.name }))] });
          }}
        />
      ) : null}
      {/* Hinzufügen als gestrichelte Zeile – zeigt, wo der nächste Eintrag hinkommt */}
      <HinzufuegenKnopf
        text={feld.vorschlaege?.length ? TEXT.eigener_eintrag(feld.eintrag) : TEXT.hinzufuegen(feld.eintrag)}
        onPress={() => {
          const liste = eintraegeVon(z.daten(id), feld);
          z.setzen(id, { [feld.id]: [...liste, neuerEintrag(feld, z.stand.betrieb, heute())] });
          oeffnen(liste.length, true);
        }}
      />
    </View>
  );
}
