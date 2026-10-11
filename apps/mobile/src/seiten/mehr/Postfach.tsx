import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { datumLang, fuelle } from "@amtlos/i18n";
import type { Brief } from "../../kern/typen";
import { BetragFeld, DatumFeld, Feld, Hinweis, Karte, Knopf, Status, Symbol, T, Wahl, Zeile } from "../../ui/bausteine";
import { Unterseite, useNav } from "../../ui/navigation";
import { useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { fotoWaehlen } from "../foto";
import { Gruppe, Inhalt, Leer, useAktion, useLaden } from "../gemeinsam";

const ARTEN = ["bescheid", "mahnung", "anhoerung", "auskunftsersuchen", "sonstiges"] as const;
const FRISTARTEN = ["einspruch", "zahlung", "antwort", "sonstige"] as const;

/** Behörden-Postfach (6.11): Brief fotografieren, einordnen, Frist eintragen – Amtlos erinnert und zeigt sie im Kalender. */
export function Postfach({ geaendert }: { geaendert?: () => void } = {}) {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const { daten, neu, laedt, fehler } = useLaden(() => klient.holen<Brief[]>("/v1/briefe"), [unternehmenId]);
  const aktion = useAktion();
  const oeffnen = (b: Brief, uri?: string) => nav.oeffnen(`brief-${b.id}`, () => <BriefSeite id={b.id} foto={uri} geaendert={() => { void neu(); geaendert?.(); }} />);

  async function foto(kamera: boolean) {
    const r = await fotoWaehlen(kamera);
    if (r === "verweigert") return aktion.setFehler(t.mobil.kamera_verweigert);
    if (!r) return;
    const b = await aktion.ausfuehren(() => klient.schicken<Brief>("/v1/briefe", "POST", r.daten));
    if (b) {
      await neu();
      oeffnen(b, r.uri);
    }
  }
  const fristText = (b: Brief) => {
    if (b.erledigt_am) return fuelle(t.postfach.erledigt, { datum: datumLang(b.erledigt_am, sprache) });
    if (!b.frist_am) return b.absender ? (t.postfach.arten as Record<string, string>)[b.art] : t.postfach.neu;
    const n = b.tage_bis_frist ?? 0;
    return `${fuelle(t.postfach.frist, { datum: datumLang(b.frist_am, sprache) })} · ${n < 0 ? fuelle(t.postfach.frist_ueber, { n: -n }) : fuelle(t.postfach.frist_tage, { n })}`;
  };
  return (
    <Unterseite titel={t.mobil.postfach_kurz}>
      <Inhalt laedt={laedt} neu={neu}>
        <T leise>{t.postfach.text}</T>
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <Knopf text={t.mobil.brief_fotografieren} symbol="camera" onPress={() => void foto(true)} laedt={aktion.laedt} stil={{ flex: 2 }} />
          <Knopf leise text={t.mobil.aus_fotos} onPress={() => void foto(false)} stil={{ flex: 1, paddingHorizontal: 8 }} />
        </View>
        {daten && !daten.length ? <View style={{ marginTop: 16 }}><Leer text={t.postfach.leer} /></View> : null}
        {daten?.length ? (
          <Karte stil={{ marginTop: 16 }}>
            {daten.map((b, i) => {
              const status = b.erledigt_am ? "erledigt" : b.frist_am && (b.tage_bis_frist ?? 0) < 0 ? "ueberfaellig" : b.frist_am && (b.tage_bis_frist ?? 99) <= 14 ? "faellig_bald" : "offen";
              return (
                <Zeile
                  key={b.id}
                  links={<Symbol name="envelope" groesse={20} farbe={status === "ueberfaellig" ? f.frist : status === "faellig_bald" ? f.bald : f.amt} />}
                  titel={[b.absender, b.aktenzeichen].filter(Boolean).join(" · ") || t.postfach.neu}
                  text={fristText(b)}
                  onPress={() => oeffnen(b)}
                  letzte={i === daten.length - 1}
                />
              );
            })}
          </Karte>
        ) : null}
        <T v="caption" leise stil={{ marginTop: 12 }}>{t.postfach.hinweis}</T>
      </Inhalt>
    </Unterseite>
  );
}

/** Ein Brief: was die Briefart bedeutet, einordnen (Absender, Art, Frist, Betrag), erledigt markieren. */
function BriefSeite({ id, foto, geaendert }: { id: string; foto?: string; geaendert: () => void }) {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const { daten: b, neu } = useLaden(() => klient.holen<Brief>(`/v1/briefe/${id}`), [id, unternehmenId]);
  const [eingang, setEingang] = useState<string | null>(null);
  const [absender, setAbsender] = useState("");
  const [art, setArt] = useState<(typeof ARTEN)[number]>("sonstiges");
  const [az, setAz] = useState("");
  const [frist, setFrist] = useState<string | null>(null);
  const [fristArt, setFristArt] = useState<(typeof FRISTARTEN)[number] | null>(null);
  const [betrag, setBetrag] = useState<number | null>(null);
  const [notiz, setNotiz] = useState("");
  const aktion = useAktion();
  useEffect(() => {
    if (!b) return;
    setEingang(b.eingang_am);
    setAbsender(b.absender);
    setArt((b.art as (typeof ARTEN)[number]) ?? "sonstiges");
    setAz(b.aktenzeichen);
    setFrist(b.frist_am);
    setFristArt((b.frist_art as (typeof FRISTARTEN)[number]) ?? null);
    setBetrag(b.betrag_cent);
    setNotiz(b.notiz ?? "");
  }, [b]);
  const erklaerung = (t.postfach.erklaerungen as Record<string, string>)[art];
  return (
    <Unterseite titel={absender || t.postfach.neu}>
      <Inhalt>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {aktion.meldung ? <Hinweis art="erfolg" text={aktion.meldung} /> : null}
        {foto ? <Image source={{ uri: foto }} style={{ width: "100%", height: 220, borderRadius: 12, marginBottom: 8 }} resizeMode="cover" accessible={false} /> : null}
        {b?.erledigt_am ? <Status status="erledigt" text={fuelle(t.postfach.erledigt, { datum: datumLang(b.erledigt_am, sprache) })} /> : null}
        <Wahl label={t.postfach.art} wert={art} aendern={setArt} optionen={ARTEN.map((a) => ({ wert: a, text: (t.postfach.arten as Record<string, string>)[a]! }))} />
        {erklaerung ? (
          <Karte stil={{ marginTop: 12, paddingVertical: 12 }}>
            <T v="klein" fett>{t.postfach.erklaerung}</T>
            <T v="klein" stil={{ marginTop: 4 }}>{erklaerung}</T>
          </Karte>
        ) : null}
        <Feld label={t.postfach.absender} wert={absender} aendern={setAbsender} autoCapitalize="words" />
        <Feld label={t.postfach.aktenzeichen} wert={az} aendern={setAz} autoCapitalize="characters" />
        <DatumFeld label={t.postfach.eingang} wert={eingang} aendern={setEingang} />
        <DatumFeld label={t.postfach.frist_am} wert={frist} aendern={setFrist} ohneHeute />
        {frist ? <Wahl label={t.postfach.frist_art} wert={fristArt} aendern={setFristArt} optionen={FRISTARTEN.map((a) => ({ wert: a, text: (t.postfach.fristarten as Record<string, string>)[a]! }))} /> : null}
        <BetragFeld label={t.postfach.betrag} cent={betrag} aendern={setBetrag} />
        <Feld label={t.postfach.notiz} wert={notiz} aendern={setNotiz} mehrzeilig />
        <Knopf
          text={t.postfach.speichern}
          laedt={aktion.laedt}
          deaktiviert={!eingang || Boolean(frist && !fristArt)}
          onPress={() =>
            void aktion.ausfuehren(async () => {
              await klient.schicken(`/v1/briefe/${id}`, "PUT", { eingang_am: eingang, absender, art, aktenzeichen: az, frist_am: frist, frist_art: frist ? fristArt : null, betrag_cent: betrag, notiz: notiz.trim() || null });
              geaendert();
              await neu();
            }, frist ? t.mobil.frist_eingetragen : t.mobil.gespeichert)
          }
          stil={{ marginTop: 24 }}
        />
        <Knopf
          leise
          text={b?.erledigt_am ? t.postfach.wieder_offen : t.postfach.als_erledigt}
          onPress={() => void aktion.ausfuehren(async () => { await klient.schicken(`/v1/briefe/${id}/erledigt`, "POST", { datum: b?.erledigt_am ? null : new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()) }); geaendert(); await neu(); })}
          stil={{ marginTop: 12 }}
        />
        <Gruppe fuss={t.postfach.hinweis}>
          <View />
        </Gruppe>
      </Inhalt>
    </Unterseite>
  );
}
