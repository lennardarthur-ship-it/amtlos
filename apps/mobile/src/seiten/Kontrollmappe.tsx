import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { BEREICHE, dokumentHtml, pdfDateiname, vorlageFuer } from "@amtlos/fachlogik";
import { betriebFuerDokument } from "../pro/regeln";
import { T as TEXT } from "../texte";
import { Fuss, Hinweis, Karte, Knopf, Symbol, T } from "../ui/bausteine";
import { useMeldung, useMeldungLeeren } from "../ui/meldung";
import { Unterseite } from "../ui/navigation";
import { HAARLINIE, useFarben, weich } from "../ui/thema";
import { datumDe, deckblattHtml, mappeDateiname, mappeZusammenfuegen, mappenAuswahl, seitenzahl, startSeiten, type MappenEintrag } from "../unterlagen/kontrollmappe";
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
  const { eintraege, unvollstaendig } = useMemo(() => mappenAuswahl(z.stand), [z.stand]);
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
        if (!u || !v) continue;
        const bytes = await pdfBytes(dokumentHtml(v, u.daten, b), pdfDateiname(v, u.daten, tag), v.querformat);
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
        deck = await pdfBytes(deckblattHtml(z.stand.betrieb.name, tag, drin.map((e, j) => ({ ...e, seite: start[j] }))), "Kontrollmappe-Deckblatt.pdf");
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
        {eintraege.length ? (
          gruppen.map((g, gi) => (
            <Gruppe key={g.id} erste={gi === 0} titel={g.titel} hilfe={gi === 0 ? TEXT.kontrollmappe_gruppe_hilfe : undefined}>
              <Karte>
                {g.liste.map((e, i) => (
                  <MappenZeile key={e.id} e={e} an={!ab.has(e.id)} umschalten={() => umschalten(e.id)} letzte={i === g.liste.length - 1} />
                ))}
              </Karte>
            </Gruppe>
          ))
        ) : (
          <Hinweis text={TEXT.kontrollmappe_leer} />
        )}
        <View style={{ marginTop: 14 }}>
          {unvollstaendig ? <Hinweis text={TEXT.kontrollmappe_unvollstaendig(unvollstaendig)} /> : null}
        </View>
      </Inhalt>
      <Fuss
        ueber={
          // Fehler direkt über dem Knopf – im Inhalt läge er unter der Leiste
          fehler ? <Ansage text={fehler} farbe={f.frist} /> : eintraege.length ? <T v="caption" leise accessibilityLiveRegion="polite">{TEXT.kontrollmappe_auswahl(gewaehlt.length, eintraege.length)}</T> : undefined
        }
      >
        <Knopf text={TEXT.kontrollmappe_teilen(gewaehlt.length)} symbol="square.and.arrow.up" laedt={laedt} deaktiviert={!gewaehlt.length} onPress={() => void los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}
