import { useState } from "react";
import { datumLang } from "@amtlos/i18n";
import type { Beleg } from "../../kern/typen";
import { BetragFeld, DatumFeld, Feld, Hinweis, Karte, Knopf, T, Zeile, euroText } from "../../ui/bausteine";
import { Unterseite, useNav } from "../../ui/navigation";
import { useAmtlos } from "../../zustand";
import { Inhalt, Leer, useAktion, useLaden } from "../gemeinsam";

/** Belege: neueste zuerst. Fehlt die Umsatzsteuer-Angabe, steht das in der Zeile – die Voranmeldung braucht sie. */
export function Belege() {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const nav = useNav();
  const { daten, neu, laedt, fehler } = useLaden(() => klient.holen<Beleg[]>("/v1/belege"), [unternehmenId]);
  const aktiv = daten?.filter((b) => !b.storniert) ?? [];
  return (
    <Unterseite titel={t.finanzen.belege}>
      <Inhalt laedt={laedt} neu={neu}>
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        <T v="caption" leise>{t.beleg.gobd}</T>
        {daten && !aktiv.length ? <Leer text={t.mobil.belege_leer} /> : null}
        {aktiv.length ? (
          <Karte stil={{ marginTop: 12 }}>
            {aktiv.map((b, i) => (
              <Zeile
                key={b.id}
                titel={b.lieferant ?? t.mobil.beleg_ohne_angaben}
                text={[b.belegdatum ? datumLang(b.belegdatum, sprache) : null, b.ust_cent === null ? t.mobil.ust_fehlt : null].filter(Boolean).join(" · ") || undefined}
                rechts={<T fett stil={{ fontVariant: ["tabular-nums"] }}>{euroText(b.brutto_cent, sprache)}</T>}
                onPress={() => nav.oeffnen(`beleg-${b.id}`, () => <BelegBearbeiten beleg={b} fertig={() => void neu()} />)}
                letzte={i === aktiv.length - 1}
              />
            ))}
          </Karte>
        ) : null}
        <T v="caption" leise stil={{ marginTop: 12 }}>{t.mobil.beleg_tab_hinweis}</T>
      </Inhalt>
    </Unterseite>
  );
}

/** Angaben zu einem Beleg: Datum, Lieferant, Betrag und Umsatzsteuer. Stornieren statt löschen (GoBD). */
export function BelegBearbeiten({ beleg, fertig }: { beleg: Beleg; fertig: () => void }) {
  const { t, klient } = useAmtlos();
  const nav = useNav();
  const [datum, setDatum] = useState<string | null>(beleg.belegdatum);
  const [lieferant, setLieferant] = useState(beleg.lieferant ?? "");
  const [nummer, setNummer] = useState(beleg.belegnummer ?? "");
  const [brutto, setBrutto] = useState<number | null>(beleg.brutto_cent);
  const [ust, setUst] = useState<number | null>(beleg.ust_cent);
  const aktion = useAktion();
  const speichern = () =>
    void aktion.ausfuehren(async () => {
      await klient.schicken(`/v1/belege/${beleg.id}`, "PUT", { belegdatum: datum, lieferant: lieferant.trim() || null, belegnummer: nummer.trim() || null, brutto_cent: brutto, ust_cent: ust });
      fertig();
      nav.zurueck();
    });
  return (
    <Unterseite titel={beleg.lieferant ?? t.finanzen.belege}>
      <Inhalt>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {beleg.quelle === "e_rechnung" ? <Hinweis art="erfolg" text={t.beleg.e_rechnung} /> : null}
        <DatumFeld label={t.beleg.datum} wert={datum} aendern={setDatum} />
        <Feld label={t.beleg.lieferant} wert={lieferant} aendern={setLieferant} autoCapitalize="words" />
        <Feld label={t.beleg.nummer} wert={nummer} aendern={setNummer} />
        <BetragFeld label={t.beleg.brutto} cent={brutto} aendern={setBrutto} />
        <BetragFeld label={t.beleg.ust} cent={ust} aendern={setUst} hilfe={t.mobil.ust_hilfe} />
        <Knopf text={t.beleg.speichern} onPress={speichern} laedt={aktion.laedt} stil={{ marginTop: 24 }} />
        <Knopf
          leise
          gefahr
          text={t.beleg.stornieren}
          onPress={() => void aktion.ausfuehren(async () => { await klient.schicken(`/v1/belege/${beleg.id}/stornieren`, "POST"); fertig(); nav.zurueck(); })}
          stil={{ marginTop: 12 }}
        />
        <T v="caption" leise stil={{ marginTop: 8 }}>{t.beleg.gobd}</T>
      </Inhalt>
    </Unterseite>
  );
}
