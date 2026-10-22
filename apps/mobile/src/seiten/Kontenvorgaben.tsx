import { useState } from "react";
import { View } from "react-native";
import { BUCHUNGSKONTEN, KONTENVORGABE_FELDER, kontenFuer, kontenvorgabenAus, kontenvorgabenAusJson, kontenvorgabenGesetzt, kontenvorgabenJson, type KontenvorgabeKonto, type Kontenvorgaben } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Feld, Hinweis, Karte, Schalter, T, TextKnopf, Wahl, Zeile } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite } from "../ui/navigation";
import { dateiTeilen, dateiWaehlen } from "../unterlagen/sicherungDatei";
import { personenkontenListe } from "../unterlagen/steuerpaket";
import { useAmtlos } from "../zustand";
import { Inhalt } from "./gemeinsam";

/** Anzahl der gesetzten Vorgaben (Konten und Optionen) – für den Einstieg auf der Seite „Steuerberatung“. */
export const kontenvorgabenAnzahl = (v: Kontenvorgaben | undefined) => (v ? Object.keys(v.konten ?? {}).length + [v.belegeGegenBank, v.zahlungenBuchen, v.personenkonten, v.gewinnermittlung].filter((x) => x !== undefined).length : 0);

/** Standardkonto eines Felds im Kontenrahmen (ohne Vorgaben) – als Platzhalter. */
function standardKonto(id: KontenvorgabeKonto, kr: "SKR03" | "SKR04"): string {
  const k = kontenFuer(kr);
  switch (id) {
    case "erloesNullsatz":
      return k.erloese.nullsatz;
    case "erloesOss":
      return k.erloese.oss;
    case "anlageMaschinen":
      return k.anlagen.maschinen;
    case "anlageBga":
      return k.anlagen.bga;
    case "anlageKfz":
      return k.anlagen.kfz;
    case "anlageSoftware":
      return k.anlagen.software;
    case "kassendifferenzErtrag":
      return BUCHUNGSKONTEN[kr].erloese[19];
    default:
      return k[id];
  }
}

/**
 * Kontenvorgaben der Kanzlei (StB-Prüfung Heckler und Busch, B-4/B-6/B-9/B-10/B-11): einzelne Konten und Optionen, die
 * der Buchungsstapel statt der Standardkonten verwendet – von Hand oder aus der Datei der Kanzlei.
 */
export function KontenvorgabenSeite() {
  const z = useAmtlos();
  const melden = useMeldung();
  const sb = z.stand.steuerberatung;
  const v = sb.kontenvorgaben ?? {};
  // Eingaben erst speichern, wenn sie vollständig sind (vier Ziffern) – halbe Nummern bleiben nur auf dem Bildschirm
  const [eingabe, setEingabe] = useState<Partial<Record<KontenvorgabeKonto, string>>>(() => ({ ...(v.konten ?? {}) }));
  const [meldung, setMeldung] = useState<{ text: string; art: "info" | "fehler" } | null>(null);
  const setzen = (neu: Kontenvorgaben) => {
    const sauber = kontenvorgabenAus(neu);
    const { kontenvorgaben: _alt, ...rest } = sb;
    z.steuerberatungSetzen(kontenvorgabenGesetzt(sauber) || sauber.kanzlei ? { ...rest, kontenvorgaben: sauber } : rest);
  };
  const konto = (id: KontenvorgabeKonto, w: string) => {
    const ziffern = w.replace(/\D/g, "").slice(0, 4);
    setEingabe((e) => ({ ...e, [id]: ziffern }));
    if (ziffern.length !== 4 && ziffern !== "") return;
    const konten = { ...(v.konten ?? {}) };
    if (ziffern) konten[id] = ziffern;
    else delete konten[id];
    setzen({ ...v, konten });
  };
  const laden = async () => {
    setMeldung(null);
    const d = await dateiWaehlen().catch(() => null);
    if (!d) return;
    try {
      const r = kontenvorgabenAusJson(d.text);
      setEingabe({ ...(r.vorgaben.konten ?? {}) });
      const neu = kontenvorgabenAus(r.vorgaben);
      z.steuerberatungSetzen({ ...sb, ...(r.kontenrahmen ? { kontenrahmen: r.kontenrahmen } : {}), kontenvorgaben: neu });
      setMeldung({ text: [TEXT.stb_kv_geladen(kontenvorgabenAnzahl(neu)), r.kontenrahmen ? TEXT.stb_kv_kontenrahmen(r.kontenrahmen) : "", r.warnungen.length ? TEXT.stb_kv_warnungen(r.warnungen.join(", ")) : ""].filter(Boolean).join(" "), art: "info" });
    } catch (e) {
      setMeldung({ text: TEXT.stb_kv_fehler(e instanceof Error ? e.message : String(e)), art: "fehler" });
    }
  };
  const herkunft = TEXT.stb_kv_herkunft(v.kanzlei ?? "", v.stand ? `${v.stand.slice(8, 10)}.${v.stand.slice(5, 7)}.${v.stand.slice(0, 4)}` : "");
  return (
    <Unterseite titel={TEXT.stb_kv_titel} unter={TEXT.stb_kv_unter}>
      <Inhalt>
        <Hinweis text={TEXT.stb_kv_hinweis} />
        <View style={{ marginTop: 8, gap: 4 }}>
          <TextKnopf symbol="folder" text={TEXT.stb_kv_laden} onPress={() => void laden()} />
          <T v="caption" leise>{TEXT.stb_kv_laden_hilfe}</T>
          {herkunft ? <T v="caption" leise>{herkunft}</T> : null}
          {meldung ? <Hinweis art={meldung.art} text={meldung.text} /> : null}
        </View>
        <T v="klein" fett stil={{ marginTop: 22 }}>{TEXT.stb_kv_konten} · {sb.kontenrahmen}</T>
        <Karte stil={{ marginTop: 8, paddingVertical: 4 }}>
          {KONTENVORGABE_FELDER.map((f) => {
            const w = eingabe[f.id] ?? "";
            return <Feld key={f.id} label={f.titel} hilfe={[TEXT.stb_kv_standard(standardKonto(f.id, sb.kontenrahmen)), f.hilfe].filter(Boolean).join(" · ")} wert={w} placeholder={standardKonto(f.id, sb.kontenrahmen)} aendern={(x) => konto(f.id, x)} keyboardType="number-pad" maxLength={4} optional fehler={w && w.length !== 4 ? TEXT.stb_kv_ungueltig : null} />;
          })}
        </Karte>
        <T v="klein" fett stil={{ marginTop: 22 }}>{TEXT.stb_kv_optionen}</T>
        <Schalter label={TEXT.stb_kv_bank} hilfe={TEXT.stb_kv_bank_hilfe} wert={v.belegeGegenBank === true} aendern={(x) => setzen({ ...v, belegeGegenBank: x })} />
        <Schalter label={TEXT.stb_kv_zahlungen} hilfe={TEXT.stb_kv_zahlungen_hilfe} wert={v.zahlungenBuchen === true} aendern={(x) => setzen({ ...v, zahlungenBuchen: x })} />
        {/* E-165 (StB-Prüfung A-3): Personenkonten – Standard aus; vergebene Nummern nur zum Ansehen */}
        <Schalter label={TEXT.stb_kv_personenkonten} hilfe={TEXT.stb_kv_personenkonten_hilfe} wert={v.personenkonten === true} aendern={(x) => setzen({ ...v, personenkonten: x })} />
        {v.personenkonten ? <Personenkonten /> : null}
        <Wahl
          label={TEXT.stb_kv_gewinn}
          hilfe={TEXT.stb_kv_gewinn_hilfe}
          wert={v.gewinnermittlung ?? "auto"}
          aendern={(x) => setzen({ ...v, gewinnermittlung: x === "auto" ? undefined : x })}
          optionen={[
            { wert: "auto" as const, text: TEXT.stb_kv_gewinn_auto },
            { wert: "bilanz" as const, text: TEXT.stb_kv_gewinn_bilanz },
            { wert: "euer" as const, text: TEXT.stb_kv_gewinn_euer },
          ]}
        />
        <View style={{ marginTop: 22, gap: 6 }}>
          {kontenvorgabenGesetzt(v) ? <TextKnopf symbol="square.and.arrow.up" text={TEXT.stb_kv_teilen} onPress={() => void dateiTeilen("kontenvorgaben.json", kontenvorgabenJson(v, sb.kontenrahmen), "application/json")} /> : null}
          {kontenvorgabenGesetzt(v) || v.kanzlei ? (
            <TextKnopf
              gefahr
              symbol="arrow.uturn.backward"
              text={TEXT.stb_kv_entfernen}
              onPress={() => {
                setEingabe({});
                setMeldung(null);
                setzen({});
                melden(TEXT.stb_kv_entfernt);
              }}
            />
          ) : null}
        </View>
      </Inhalt>
    </Unterseite>
  );
}

/** E-165: vergebene Personenkonten (Kunden und Lieferanten) – nur zum Ansehen. */
function Personenkonten() {
  const z = useAmtlos();
  const liste = personenkontenListe(z.stand);
  return (
    <View style={{ marginTop: 10, gap: 6 }}>
      <T v="klein" fett>{TEXT.stb_kv_pk_titel(liste.length)}</T>
      <T v="caption" leise>{liste.length ? TEXT.stb_kv_pk_hilfe : TEXT.stb_kv_pk_leer}</T>
      {liste.length ? (
        <Karte>
          {liste.map((e, i) => (
            <Zeile key={`${e.art}-${e.konto}`} symbol={e.art === "debitor" ? "person" : "shippingbox"} titel={e.name} text={e.art === "debitor" ? TEXT.stb_kv_pk_debitor : TEXT.stb_kv_pk_kreditor} wert={e.konto} letzte={i === liste.length - 1} />
          ))}
        </Karte>
      ) : null}
    </View>
  );
}
