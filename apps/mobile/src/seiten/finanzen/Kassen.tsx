import { useState } from "react";
import { View } from "react-native";
import { datumLang, fuelle } from "@amtlos/i18n";
import type { Kasse } from "../../kern/typen";
import { DatumFeld, Feld, Hinweis, Karte, Knopf, T } from "../../ui/bausteine";
import { Unterseite } from "../../ui/navigation";
import { useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { Inhalt, Leer, useAktion, useLaden } from "../gemeinsam";

/** Elektronische Kassen: erfassen löst die Meldefrist aus (Ereignis „Kasse angeschafft“). */
export function Kassen() {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const { daten, neu } = useLaden(() => klient.holen<Kasse[]>("/v1/kassen"), [unternehmenId]);
  const [form, setForm] = useState(false);
  const [bezeichnung, setBezeichnung] = useState("");
  const [hersteller, setHersteller] = useState("");
  const [modell, setModell] = useState("");
  const [seriennummer, setSeriennummer] = useState("");
  const [tse, setTse] = useState("");
  const [angeschafft, setAngeschafft] = useState<string | null>(null);
  const [ende, setEnde] = useState<Record<string, string | null>>({});
  const aktion = useAktion();
  return (
    <Unterseite titel={t.kasse.titel}>
      <Inhalt>
        <T leise>{t.kasse.text}</T>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {aktion.meldung ? <Hinweis art="erfolg" text={aktion.meldung} /> : null}
        {daten && !daten.length && !form ? <View style={{ marginTop: 16 }}><Leer text={t.kasse.leer} /></View> : null}
        {daten?.map((k) => (
          <Karte key={k.id} stil={{ marginTop: 12, paddingVertical: 12 }}>
            <T fett>{k.bezeichnung}</T>
            <T v="klein" leise>{[k.hersteller, k.modell, k.seriennummer].filter(Boolean).join(" · ")}</T>
            <T v="klein" stil={{ marginTop: 4 }} farbe={k.ausser_betrieb_am ? f.tinteLeise : f.amt}>
              {k.ausser_betrieb_am ? fuelle(t.kasse.beendet, { datum: datumLang(k.ausser_betrieb_am, sprache) }) : fuelle(t.kasse.aktiv, { datum: datumLang(k.angeschafft_am, sprache) })}
            </T>
            {!k.ausser_betrieb_am ? (
              <>
                <DatumFeld label={t.kasse.ausser_betrieb} wert={ende[k.id] ?? null} aendern={(d) => setEnde((x) => ({ ...x, [k.id]: d }))} />
                <Knopf leise text={t.kasse.ausser_betrieb_knopf} deaktiviert={!ende[k.id]} onPress={() => void aktion.ausfuehren(async () => { await klient.schicken(`/v1/kassen/${k.id}/ausser-betrieb`, "POST", { datum: ende[k.id] }); await neu(); }, t.mobil.gespeichert)} stil={{ marginTop: 10, alignSelf: "flex-start" }} />
              </>
            ) : null}
          </Karte>
        ))}
        {form ? (
          <Karte stil={{ marginTop: 16, paddingBottom: 14 }}>
            <Feld label={t.kasse.bezeichnung} wert={bezeichnung} aendern={setBezeichnung} />
            <Feld label={t.kasse.hersteller} wert={hersteller} aendern={setHersteller} />
            <Feld label={t.kasse.modell} wert={modell} aendern={setModell} />
            <Feld label={t.kasse.seriennummer} wert={seriennummer} aendern={setSeriennummer} autoCapitalize="characters" />
            <Feld label={t.kasse.tse} wert={tse} aendern={setTse} autoCapitalize="characters" />
            <DatumFeld label={t.kasse.angeschafft} wert={angeschafft} aendern={setAngeschafft} />
            <Knopf
              text={t.kasse.erfassen}
              deaktiviert={!bezeichnung.trim() || !angeschafft}
              laedt={aktion.laedt}
              onPress={() =>
                void aktion.ausfuehren(async () => {
                  await klient.schicken("/v1/kassen", "POST", { bezeichnung, hersteller: hersteller || null, modell: modell || null, seriennummer: seriennummer || null, tse_seriennummer: tse || null, angeschafft_am: angeschafft });
                  setForm(false);
                  setBezeichnung("");
                  await neu();
                }, t.mobil.kasse_erfasst)
              }
              stil={{ marginTop: 18 }}
            />
          </Karte>
        ) : (
          <Knopf text={t.kasse.neu} symbol="plus" onPress={() => setForm(true)} stil={{ marginTop: 20 }} />
        )}
        <T v="caption" leise stil={{ marginTop: 12 }}>{t.kasse.elster}</T>
      </Inhalt>
    </Unterseite>
  );
}
