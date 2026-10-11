import { useState } from "react";
import { Pressable, View } from "react-native";
import { fuelle } from "@amtlos/i18n";
import type { Beschaeftigter, Zeiten as ZeitenT } from "../../kern/typen";
import { DatumFeld, Feld, Hinweis, Karte, Knopf, Symbol, T, Wahl, Zeile } from "../../ui/bausteine";
import { Unterseite } from "../../ui/navigation";
import { useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { Gruppe, Inhalt, Leer, useAktion, useLaden } from "../gemeinsam";

const berlinMonat = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).format(new Date());
const verschiebe = (monat: string, n: number) => {
  const d = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
/** Berliner Ortszeit (ISO-Datum + HH:MM) → ISO-Zeitpunkt mit Offset, ohne Zeitzonen-Bibliothek. */
function zeitpunkt(datum: string, uhr: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(uhr.trim());
  if (!m) return null;
  const roh = Date.parse(`${datum}T${m[1]!.padStart(2, "0")}:${m[2]}:00Z`);
  // Offset von Berlin zu diesem Zeitpunkt bestimmen
  const teile = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(roh));
  const w = (typ: string) => Number(teile.find((x) => x.type === typ)?.value);
  const berlin = Date.UTC(w("year"), w("month") - 1, w("day"), w("hour") % 24, w("minute"));
  return new Date(roh - (berlin - roh)).toISOString();
}

/** Arbeitszeiten eines Monats: je Person Summe und Einträge; Nachtrag und Korrektur mit Grund. */
export function Zeiten() {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const [monat, setMonat] = useState(berlinMonat());
  const { daten, neu, laedt } = useLaden(async () => {
    const [z, personen] = await Promise.all([klient.holen<ZeitenT>(`/v1/zeiten?monat=${monat}`), klient.holen<Beschaeftigter[]>("/v1/beschaeftigte")]);
    return { z, personen };
  }, [monat, unternehmenId]);
  const [form, setForm] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [beginn, setBeginn] = useState("");
  const [ende, setEnde] = useState("");
  const [pause, setPause] = useState("0");
  const [grund, setGrund] = useState("");
  const aktion = useAktion();
  const name = (id: string) => {
    const p = daten?.personen.find((x) => x.id === id);
    return p ? `${p.vorname} ${p.nachname}` : "";
  };
  const dauer = (min: number) => fuelle(t.zeit.stunden, { h: Math.floor(min / 60), m: min % 60 });
  const uhr = (iso: string) => new Intl.DateTimeFormat(sprache === "en" ? "en-GB" : "de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
  const tagText = (iso: string) => new Intl.DateTimeFormat(sprache === "en" ? "en-GB" : "de-DE", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));
  const monatName = new Intl.DateTimeFormat(sprache === "en" ? "en-GB" : "de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monat}-01T00:00:00Z`));
  return (
    <Unterseite titel={t.zeit.titel}>
      <Inhalt laedt={laedt} neu={neu}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.zeit.vormonat} onPress={() => setMonat((m) => verschiebe(m, -1))} style={{ padding: 12 }}>
            <Symbol name="chevron.left" groesse={20} farbe={f.amt} />
          </Pressable>
          <T v="gross" accessibilityRole="header">{monatName}</T>
          <Pressable accessibilityRole="button" accessibilityLabel={t.zeit.naechster_monat} onPress={() => setMonat((m) => verschiebe(m, 1))} style={{ padding: 12 }}>
            <Symbol name="chevron.right" groesse={20} farbe={f.amt} />
          </Pressable>
        </View>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {daten && !daten.personen.length ? <Leer text={t.zeit.keine_personen} /> : null}
        {daten?.personen.length && !daten.z.eintraege.length ? <T leise stil={{ marginTop: 8 }}>{t.zeit.keine}</T> : null}
        {daten?.personen.filter((p) => daten.z.eintraege.some((e) => e.beschaeftigter_id === p.id)).map((p) => {
          const eigene = daten.z.eintraege.filter((e) => e.beschaeftigter_id === p.id);
          return (
            <Gruppe key={p.id} titel={`${p.vorname} ${p.nachname} · ${t.zeit.summen}: ${dauer(daten.z.summen_minuten[p.id] ?? 0)}`}>
              <Karte>
                {eigene.map((e, i) => (
                  <Zeile key={e.id} titel={tagText(e.beginn)} text={`${uhr(e.beginn)} – ${e.ende ? uhr(e.ende) : "…"}${e.pause_minuten ? ` · ${e.pause_minuten} min` : ""} · ${(t.zeit.quelle as Record<string, string>)[e.quelle] ?? e.quelle}`} rechts={<T fett stil={{ fontVariant: ["tabular-nums"] }}>{dauer(e.minuten)}</T>} letzte={i === eigene.length - 1} />
                ))}
              </Karte>
            </Gruppe>
          );
        })}
        {daten?.personen.length ? (
          form ? (
            <Gruppe titel={t.zeit.nachtrag}>
              <Karte stil={{ paddingBottom: 14, paddingTop: 12 }}>
                <Wahl label={t.zeit.person} wert={person} aendern={setPerson} optionen={daten.personen.filter((p) => !p.austritt).map((p) => ({ wert: p.id, text: name(p.id) }))} />
                <DatumFeld label={t.mobil.tag} wert={tag} aendern={setTag} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}><Feld label={t.zeit.beginn} wert={beginn} aendern={setBeginn} placeholder="08:00" keyboardType="numbers-and-punctuation" /></View>
                  <View style={{ flex: 1 }}><Feld label={t.zeit.ende} wert={ende} aendern={setEnde} placeholder="16:30" keyboardType="numbers-and-punctuation" /></View>
                </View>
                <Feld label={t.zeit.pause} wert={pause} aendern={setPause} keyboardType="number-pad" />
                <Feld label={t.zeit.grund} wert={grund} aendern={setGrund} />
                <Knopf
                  text={t.zeit.nachtragen}
                  deaktiviert={!person || !tag || !zeitpunkt(tag ?? "", beginn) || !zeitpunkt(tag ?? "", ende) || !grund.trim()}
                  laedt={aktion.laedt}
                  onPress={() =>
                    void aktion.ausfuehren(async () => {
                      await klient.schicken("/v1/zeiten", "POST", { beschaeftigter_id: person, beginn: zeitpunkt(tag!, beginn), ende: zeitpunkt(tag!, ende), pause_minuten: Number(pause) || 0, grund });
                      setForm(false);
                      setGrund("");
                      await neu();
                    })
                  }
                  stil={{ marginTop: 16 }}
                />
              </Karte>
            </Gruppe>
          ) : (
            <Knopf leise text={t.zeit.nachtrag} symbol="plus" onPress={() => setForm(true)} stil={{ marginTop: 20 }} />
          )
        ) : null}
        <T v="caption" leise stil={{ marginTop: 12 }}>{t.zeit.text}</T>
      </Inhalt>
    </Unterseite>
  );
}
