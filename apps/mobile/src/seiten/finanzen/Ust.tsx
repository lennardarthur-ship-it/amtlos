import { useState } from "react";
import { Linking, View } from "react-native";
import { datumLang, fuelle } from "@amtlos/i18n";
import type { UstVa } from "../../kern/typen";
import { Hinweis, Karte, Knopf, T, Wahl, euroText } from "../../ui/bausteine";
import { Unterseite } from "../../ui/navigation";
import { useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { Inhalt, useLaden } from "../gemeinsam";

/** Zeiträume zur Auswahl: dieser und letzter Monat, dieses und letztes Quartal (Berliner Zeit). */
function zeitraeume(sprache: "de" | "en") {
  const jetzt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const j = Number(jetzt.slice(0, 4));
  const mo = Number(jetzt.slice(5, 7));
  const monat = (jahr: number, m: number) => `${jahr}-${String(m).padStart(2, "0")}`;
  const vorMonat = mo === 1 ? monat(j - 1, 12) : monat(j, mo - 1);
  const q = Math.ceil(mo / 3);
  const vorQ = q === 1 ? `${j - 1}-Q4` : `${j}-Q${q - 1}`;
  const name = (p: string) =>
    p.includes("Q") ? `${p.slice(5)} ${p.slice(0, 4)}` : new Intl.DateTimeFormat(sprache === "en" ? "en-GB" : "de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${p}-01T00:00:00Z`));
  return [vorMonat, monat(j, mo), vorQ, `${j}-Q${q}`].map((p) => ({ wert: p, text: name(p) }));
}

/** USt-Voranmeldung vorbereiten: Summen aus Rechnungen und Belegen; übertragen musst du sie selbst in ELSTER. */
export function Ust() {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const optionen = zeitraeume(sprache);
  const [periode, setPeriode] = useState(optionen[0]!.wert);
  const { daten: v, fehler } = useLaden(() => klient.holen<UstVa>(`/v1/finanzen/ust-voranmeldung?periode=${periode}`), [periode, unternehmenId]);
  const zeile = (label: string, cent: number, fett?: boolean) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderColor: f.linieLeise }}>
      <T fett={fett} stil={{ flex: 1 }}>{label}</T>
      <T fett={fett} stil={{ fontVariant: ["tabular-nums"] }}>{euroText(cent, sprache)}</T>
    </View>
  );
  return (
    <Unterseite titel={t.mobil.ust_kurz}>
      <Inhalt>
        <T leise>{t.ust_va.text}</T>
        <Wahl label={t.ust_va.zeitraum} wert={periode} aendern={setPeriode} optionen={optionen} />
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        {v ? (
          <>
            <T v="caption" leise stil={{ marginTop: 16 }}>{datumLang(v.von, sprache)} – {datumLang(v.bis, sprache)} · {v.rechnungen} {t.finanzen.rechnungen} · {v.belege} {t.finanzen.belege}</T>
            <Karte stil={{ marginTop: 8 }}>
              <T v="klein" fett leise stil={{ marginTop: 12 }}>{t.ust_va.umsaetze}</T>
              {v.umsaetze.length ? (
                v.umsaetze.map((u) => (
                  <View key={String(u.satz)}>
                    {zeile(`${u.satz === null ? t.ust_va.ohne_ust : fuelle(t.ust_va.satz, { satz: u.satz })} · ${t.ust_va.netto}`, u.netto_cent)}
                    {u.satz !== null ? zeile(t.ust_va.ust, u.ust_cent) : null}
                  </View>
                ))
              ) : (
                <T leise stil={{ paddingVertical: 10 }}>–</T>
              )}
              {zeile(t.ust_va.vorsteuer, v.vorsteuer_cent)}
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 }}>
                <T fett stil={{ flex: 1 }}>{t.ust_va.zahllast}</T>
                <T v="gross" stil={{ fontVariant: ["tabular-nums"] }}>{euroText(v.zahllast_cent, sprache)}</T>
              </View>
            </Karte>
            {v.belege_ohne_steuerangabe ? <Hinweis text={fuelle(t.ust_va.belege_ohne, { n: v.belege_ohne_steuerangabe })} /> : null}
            <T v="caption" leise stil={{ marginTop: 10 }}>{t.ust_va.hinweis}</T>
            {!v.uebermittlung.verfuegbar && v.uebermittlung.alternative ? (
              <Knopf leise text={v.uebermittlung.alternative.titel} symbol="globe" onPress={() => void Linking.openURL(v.uebermittlung.alternative!.url)} stil={{ marginTop: 16 }} />
            ) : null}
          </>
        ) : null}
      </Inhalt>
    </Unterseite>
  );
}
