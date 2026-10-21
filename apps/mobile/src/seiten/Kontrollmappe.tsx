import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { BEREICHE, dokumentHtml, pdfDateiname, vorlageFuer } from "@amtlos/fachlogik";
import { betriebFuerDokument } from "../pro/regeln";
import { T as TEXT } from "../texte";
import { ChipLeiste, Fuss, Hinweis, Karte, Knopf, Symbol, T, Zeile } from "../ui/bausteine";
import { useMeldung, useMeldungLeeren } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { HAARLINIE, useFarben, weich } from "../ui/thema";
import { kasseSichtbar } from "../unterlagen/kasse";
import { BG_NACHWEISE, BG_SCHLUESSEL, KONTROLLARTEN, bgVorhanden, kassenMappe, datumDe, deckblattHtml, fehltInMappe, fuerKontrolle, mappeDateiname, mappeZusammenfuegen, mappenAuswahl, seitenzahl, startSeiten, type Kontrollart, type MappenEintrag } from "../unterlagen/kontrollmappe";
import { istErledigt } from "../pflichten/check";
import { useAuswertung } from "./Pflichten";
import { useOeffnen, useStarten } from "./starten";
import { pdfBytes } from "../unterlagen/pdf";
import { dateiTeilenBytes } from "../unterlagen/sicherungDatei";
import { heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Ansage } from "./felder";
import { Gruppe, Inhalt } from "./gemeinsam";

/** Eine Unterlage zum An- und Abwählen: Kästchen, Titel, Datum und ob sie schon geteilt ist. */
function MappenZeile({ e, an, umschalten, letzte }: { e: MappenEintrag; an: boolean; umschalten: () => void; letzte: boolean }) {
  const f = useFarben();
  const unter = e.geteilt ? TEXT.kontrollmappe_geteilt(datumDe(e.datum)) : TEXT.kontrollmappe_entwurf(datumDe(e.datum));
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: an }}
      aria-checked={an}
      accessibilityLabel={`${e.titel}, ${unter}`}
      onPress={() => {
        weich();
        umschalten();
      }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: an ? 0 : 2, borderColor: f.rahmen, backgroundColor: an ? f.amt : f.papier, alignItems: "center", justifyContent: "center" }}>
        {an ? <Symbol name="checkmark" groesse={14} farbe={f.amtText} gewicht="bold" /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 13, minHeight: 58, justifyContent: "center", borderBottomWidth: letzte ? 0 : HAARLINIE, borderColor: f.linie }}>
        <T fett={an} leise={!an}>{e.titel}</T>
        <T v="klein" leise stil={{ marginTop: 1 }}>{unter}</T>
      </View>
    </Pressable>
  );
}

/** Ein Nachweis ohne Vorlage (BG-Besichtigung) zum Abhaken: „vorhanden“ (R11, Tischlerei #22). */
function PapierZeile({ titel, an, umschalten, letzte }: { titel: string; an: boolean; umschalten: () => void; letzte: boolean }) {
  const f = useFarben();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: an }}
      aria-checked={an}
      accessibilityLabel={`${titel}, ${an ? TEXT.r11_vorhanden : TEXT.r11_nicht_vorhanden}`}
      onPress={() => {
        weich();
        umschalten();
      }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: an ? 0 : 2, borderColor: f.rahmen, backgroundColor: an ? f.amt : f.papier, alignItems: "center", justifyContent: "center" }}>
        {an ? <Symbol name="checkmark" groesse={14} farbe={f.amtText} gewicht="bold" /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 13, minHeight: 52, justifyContent: "center", borderBottomWidth: letzte ? 0 : HAARLINIE, borderColor: f.linie }}>
        <T fett={an}>{titel}</T>
        <T v="klein" leise stil={{ marginTop: 1 }}>{an ? TEXT.r11_vorhanden : TEXT.r11_nicht_vorhanden}</T>
      </View>
    </Pressable>
  );
}

/** Für welche Kontrollarten die Liste der BG-Nachweise ohne Vorlage erscheint */
const MIT_PAPIER: Kontrollart[] = ["alle", "bg"];

/**
 * Kontrollmappe: die aktuellen Nachweise (Arbeitsschutz, Hygiene, Lebensmittel, Datenschutz, Personal) in einem PDF –
 * Deckblatt mit Inhaltsverzeichnis, danach jede ausgewählte Unterlage. Das PDF entsteht auf dem Gerät.
 */
export function KontrollmappeSeite() {
  const z = useAmtlos();
  const f = useFarben();
  const melden = useMeldung();
  const leeren = useMeldungLeeren();
  useEffect(() => leeren(), [leeren]);
  const { eintraege: alleEintraege, unvollstaendigListe } = useMemo(() => mappenAuswahl(z.stand), [z.stand]);
  const oeffnen = useOeffnen();
  // Kontrollart (R10): nur, was die jeweilige Stelle prüft
  const [art, setArt] = useState<Kontrollart>("alle");
  // R12: Kassennachschau – Kassenbücher aus den Tagesabschlüssen, Kassenmeldung, Verfahrensdokumentation
  const kasseEintraege = useMemo(() => kassenMappe(z.stand), [z.stand]);
  const arten = KONTROLLARTEN.filter((k) => k !== "kasse" || kasseSichtbar(z.stand) || kasseEintraege.length > 0);
  const eintraege = useMemo(() => (art === "kasse" ? kasseEintraege : alleEintraege.filter((e) => fuerKontrolle(e.vorlage, art))), [alleEintraege, kasseEintraege, art]);
  // „Fehlt noch“: offene Pflichten aus dem Check mit einer Vorlage, die in diese Mappe gehört
  const a = useAuswertung();
  const starten = useStarten();
  const fehlt = useMemo(() => {
    const e = { erledigt: z.stand.erledigt, unterlagen: z.stand.unterlagen, betrieb: z.stand.betrieb };
    return fehltInMappe(a.gilt.filter((p) => !istErledigt(p, e)), eintraege, art).slice(0, 8);
  }, [a, z.stand.erledigt, z.stand.unterlagen, z.stand.betrieb, eintraege, art]);
  const [ab, setAb] = useState<Set<string>>(() => new Set());
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const gewaehlt = eintraege.filter((e) => !ab.has(e.id));
  const umschalten = (id: string) => {
    const neu = new Set(ab);
    if (neu.has(id)) neu.delete(id);
    else neu.add(id);
    setAb(neu);
  };
  // unvollständige Unterlagen dieser Kontrollart – mit dem Weg zum Ergänzen (R11, UX #2/#5)
  const halb = unvollstaendigListe.filter((x) => fuerKontrolle(x.vorlage, art));
  const papier = MIT_PAPIER.includes(art);
  const gruppen = BEREICHE.map((b) => ({ ...b, liste: eintraege.filter((e) => e.bereich === b.id) })).filter((g) => g.liste.length);

  const los = async () => {
    setFehler(null);
    if (Platform.OS === "web") {
      setFehler(TEXT.kontrollmappe_web);
      return;
    }
    setLaedt(true);
    try {
      const b = betriebFuerDokument(z.stand.betrieb, z.pro);
      const tag = heute();
      const teile: Uint8Array[] = [];
      const drin: MappenEintrag[] = [];
      for (const e of gewaehlt) {
        const u = z.stand.unterlagen.find((x) => x.id === e.id);
        const v = vorlageFuer(e.vorlage);
        // R12: Kassenbuch aus den Tagesabschlüssen hat keine gespeicherte Unterlage
        const daten = e.daten ?? u?.daten;
        if (!daten || !v) continue;
        const bytes = await pdfBytes(dokumentHtml(v, daten, b), pdfDateiname(v, daten, tag), v.querformat);
        if (!bytes) throw new Error("pdf");
        teile.push(bytes);
        drin.push(e);
      }
      const seiten = await Promise.all(teile.map(seitenzahl));
      // Deckblatt zweimal, falls das Inhaltsverzeichnis über eine Seite hinausgeht – dann verschieben sich die Seiten
      let deckSeiten = 1;
      let deck: Uint8Array | null = null;
      for (let i = 0; i < 2; i++) {
        const start = startSeiten(deckSeiten, seiten);
        deck = await pdfBytes(deckblattHtml(z.stand.betrieb.name, tag, drin.map((e, j) => ({ ...e, seite: start[j] })), art === "alle" ? undefined : TEXT.kontrollmappe_arten[art], papier ? bgVorhanden(z.stand.erledigt) : []), "Kontrollmappe-Deckblatt.pdf");
        if (!deck) throw new Error("pdf");
        const n = await seitenzahl(deck);
        if (n === deckSeiten) break;
        deckSeiten = n;
      }
      const mappe = await mappeZusammenfuegen([deck!, ...teile]);
      if (!(await dateiTeilenBytes(mappeDateiname(z.stand.betrieb.name, tag), mappe, "application/pdf"))) return;
      melden(TEXT.kontrollmappe_fertig(drin.length));
    } catch {
      setFehler(TEXT.kontrollmappe_fehler);
    } finally {
      setLaedt(false);
    }
  };

  return (
    <Unterseite titel={TEXT.kontrollmappe_titel} unter={TEXT.kontrollmappe_text}>
      <Inhalt>
        <ChipLeiste label={TEXT.kontrollmappe_art_label} wert={art} aendern={setArt} optionen={arten.map((k) => ({ wert: k, text: TEXT.kontrollmappe_arten[k]! }))} stil={{ marginTop: 0 }} />
        <T v="caption" leise stil={{ marginTop: 8 }}>{TEXT.kontrollmappe_art_hilfe[art]}</T>
        {fehlt.length ? (
          <Gruppe titel={TEXT.kontrollmappe_fehlt_titel} hilfe={TEXT.kontrollmappe_fehlt_hilfe}>
            <Karte>
              {fehlt.map((x, i) => (
                <Zeile key={x.id} symbol="plus.circle" ton="bald" titel={x.titel} text={vorlageFuer(x.vorlage)?.titel} onPress={() => starten(x.vorlage)} letzte={i === fehlt.length - 1} />
              ))}
            </Karte>
          </Gruppe>
        ) : null}
        {halb.length ? (
          <Gruppe titel={TEXT.r11_mappe_halb_titel(halb.length)} hilfe={TEXT.r11_mappe_halb_hilfe}>
            <Karte>
              {halb.map((x, i) => (
                <Zeile key={x.id} symbol="exclamationmark.circle" ton="bald" titel={x.titel} text={TEXT.r11_mappe_halb_zeile(x.fehlt)} onPress={() => oeffnen(x.id)} letzte={i === halb.length - 1} />
              ))}
            </Karte>
          </Gruppe>
        ) : null}
        {eintraege.length ? (
          gruppen.map((g, gi) => (
            <Gruppe key={g.id} titel={g.titel} hilfe={gi === 0 ? TEXT.kontrollmappe_gruppe_hilfe : undefined}>
              <Karte>
                {g.liste.map((e, i) => (
                  <MappenZeile key={e.id} e={e} an={!ab.has(e.id)} umschalten={() => umschalten(e.id)} letzte={i === g.liste.length - 1} />
                ))}
              </Karte>
            </Gruppe>
          ))
        ) : (
          <View style={{ marginTop: 16 }}>
            <Hinweis text={alleEintraege.length ? TEXT.kontrollmappe_art_leer : TEXT.kontrollmappe_leer} />
          </View>
        )}
        {papier ? (
          <Gruppe titel={TEXT.r11_bg_titel} hilfe={TEXT.r11_bg_hilfe}>
            <Karte>
              {BG_NACHWEISE.map((n, i) => {
                const an = Boolean(z.stand.erledigt[BG_SCHLUESSEL(n.id)]);
                return <PapierZeile key={n.id} titel={n.titel} an={an} umschalten={() => z.erledigtSetzen(BG_SCHLUESSEL(n.id), an ? null : heute())} letzte={i === BG_NACHWEISE.length - 1} />;
              })}
            </Karte>
          </Gruppe>
        ) : null}
      </Inhalt>
      <Fuss
        ueber={
          // Fehler direkt über dem Knopf – im Inhalt läge er unter der Leiste; ohne Auswahl sagt ein Satz, warum der Knopf ruht
          fehler ? <Ansage text={fehler} farbe={f.frist} /> : gewaehlt.length ? <T v="caption" leise accessibilityLiveRegion="polite">{TEXT.kontrollmappe_auswahl(gewaehlt.length, eintraege.length)}</T> : <T v="caption" leise accessibilityLiveRegion="polite">{eintraege.length ? TEXT.r11_mappe_nichts_gewaehlt : TEXT.r11_mappe_leer_knopf}</T>
        }
      >
        <Knopf text={gewaehlt.length ? TEXT.kontrollmappe_teilen(gewaehlt.length) : TEXT.r11_mappe_teilen} symbol="square.and.arrow.up" laedt={laedt} deaktiviert={!gewaehlt.length} onPress={() => void los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/** Kontrollmappe öffnen – von „Heute“, „Unterlagen“ und „Mein Betrieb“ aus (R11, UX #1). */
export function useKontrollmappeOeffnen() {
  const nav = useNav();
  return () => nav.oeffnen("kontrollmappe", () => <KontrollmappeSeite />, true);
}
