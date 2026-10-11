import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { datumLang, fuelle } from "@amtlos/i18n";
import { summen } from "@amtlos/fachlogik";
import { ApiFehler } from "../../kern/api";
import type { EinheitId, FinanzUebersicht, Kunde, Position, Rechnung } from "../../kern/typen";
import { BetragFeld, DatumFeld, Feld, Hinweis, Karte, Knopf, Status, Symbol, T, Wahl, Zeile, euroText } from "../../ui/bausteine";
import { Unterseite, useNav } from "../../ui/navigation";
import { useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { Inhalt, Leer, useAktion, useLaden } from "../gemeinsam";
import { Angaben } from "./Angaben";

const EINHEITEN: EinheitId[] = ["stunde", "stueck", "tag", "monat", "pauschal", "kilogramm"];

/** Rechnungen: Entwürfe oben, dann gestellte nach Datum. Neue Rechnung oben rechts. */
export function Rechnungen() {
  const { t, sprache, klient, unternehmenId, demo } = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const { daten, neu, laedt, fehler } = useLaden(() => klient.holen<Rechnung[]>("/v1/rechnungen"), [unternehmenId]);
  const oeffnen = (id: string | null) => nav.oeffnen(`rechnung-${id ?? "neu"}`, () => <RechnungSeite id={id} geaendert={() => void neu()} />);
  return (
    <Unterseite
      titel={t.finanzen.rechnungen}
      rechts={
        <Pressable accessibilityRole="button" accessibilityLabel={t.rechnung.neu} onPress={() => oeffnen(null)} hitSlop={8} style={{ padding: 6 }}>
          <Symbol name="plus" groesse={22} farbe={f.amt} gewicht="semibold" />
        </Pressable>
      }
    >
      <Inhalt laedt={laedt} neu={neu}>
        {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
        {demo ? <Hinweis text={t.mobil.demo_pdf} /> : null}
        {daten && !daten.length ? <Leer text={t.rechnung.liste_leer} /> : null}
        {daten?.length ? (
          <Karte>
            {daten.map((r, i) => (
              <Zeile
                key={r.id}
                titel={r.nummer ? `${r.art === "storno" ? `${t.rechnung.storno} ` : ""}${r.nummer}` : t.rechnung.entwurf}
                text={[r.kunde_name ?? r.kunde?.name, r.rechnungsdatum ? datumLang(r.rechnungsdatum, sprache) : null].filter(Boolean).join(" · ") || undefined}
                rechts={
                  <View style={{ alignItems: "flex-end" }}>
                    <T fett stil={{ fontVariant: ["tabular-nums"] }}>{r.status === "entwurf" ? "–" : euroText(r.brutto_cent, sprache)}</T>
                    <T v="caption" leise>{t.rechnung[r.status]}</T>
                  </View>
                }
                onPress={() => oeffnen(r.id)}
                letzte={i === daten.length - 1}
              />
            ))}
          </Karte>
        ) : null}
        <Knopf text={t.rechnung.neu} symbol="plus" onPress={() => oeffnen(null)} stil={{ marginTop: 20 }} />
      </Inhalt>
    </Unterseite>
  );
}

type PosForm = { bezeichnung: string; menge: string; einheit: EinheitId; preis_cent: number | null; ust_art: "regel" | "ermaessigt" };
const leerePosition = (): PosForm => ({ bezeichnung: "", menge: "1", einheit: "stunde", preis_cent: null, ust_art: "regel" });

/** Eine Rechnung: als Entwurf bearbeiten (Kunde, Datum, Positionen, Summen) oder gestellt ansehen und stornieren. */
function RechnungSeite({ id, geaendert }: { id: string | null; geaendert: () => void }) {
  const { t, sprache, klient, unternehmenId } = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const [rid, setRid] = useState<string | null>(id);
  const { daten, neu } = useLaden(async () => {
    const [r, kunden, u] = await Promise.all([rid ? klient.holen<Rechnung>(`/v1/rechnungen/${rid}`) : Promise.resolve(null), klient.holen<Kunde[]>("/v1/kunden"), klient.holen<FinanzUebersicht>("/v1/finanzen/uebersicht")]);
    return { r, kunden, ku: u.kleinunternehmer };
  }, [rid, unternehmenId]);
  const r = daten?.r ?? null;
  const ku = r?.kleinunternehmer ?? daten?.ku ?? false;
  const [kunde, setKunde] = useState<string | null>(null);
  const [leistung, setLeistung] = useState<string | null>(null);
  const [faellig, setFaellig] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState("");
  const [pos, setPos] = useState<PosForm[]>([leerePosition()]);
  const [fehlend, setFehlend] = useState<string[]>([]);
  const aktion = useAktion();

  useEffect(() => {
    if (!r) return;
    setKunde(r.kunde_id);
    setLeistung(r.leistungsdatum);
    setFaellig(r.faellig_am);
    setHinweis(r.hinweis ?? "");
    setPos(r.positionen.length ? r.positionen.map((p) => ({ bezeichnung: p.bezeichnung, menge: String(p.menge).replace(".", ","), einheit: p.einheit, preis_cent: p.preis_cent, ust_art: p.ust_art === "ermaessigt" ? "ermaessigt" : "regel" })) : [leerePosition()]);
  }, [r]);

  const entwurf = !r || r.status === "entwurf";
  const menge = (x: string) => Number(x.replace(",", "."));
  const positionen = pos.filter((p) => p.bezeichnung.trim() && menge(p.menge) > 0 && p.preis_cent !== null);
  // Vorschau der Summen mit denselben Regeln wie beim Stellen; Steuersätze kennt erst der Server – hier nur netto
  const netto = summen(positionen.map((p) => ({ bezeichnung: p.bezeichnung, menge: menge(p.menge), einheit: p.einheit, preis_cent: p.preis_cent!, ust_satz: null })), true).netto_cent;
  const koerper = () => ({
    kunde_id: kunde, leistungsdatum: leistung, faellig_am: faellig, hinweis: hinweis.trim() || null,
    positionen: positionen.map((p) => ({ bezeichnung: p.bezeichnung.trim(), menge: menge(p.menge), einheit: p.einheit, preis_cent: p.preis_cent!, ust_art: ku ? null : p.ust_art })),
  });

  async function speichern() {
    const neuR = await aktion.ausfuehren(() => (rid ? klient.schicken<Rechnung>(`/v1/rechnungen/${rid}`, "PUT", koerper()) : klient.schicken<Rechnung>("/v1/rechnungen", "POST", koerper())), t.mobil.gespeichert);
    if (neuR) {
      setRid(neuR.id);
      geaendert();
    }
    return neuR;
  }
  async function stellen() {
    setFehlend([]);
    const gespeichert = await speichern();
    if (!gespeichert) return;
    aktion.setMeldung(null);
    try {
      await klient.schicken<Rechnung>(`/v1/rechnungen/${gespeichert.id}/stellen`, "POST");
      geaendert();
      await neu();
      aktion.setMeldung(t.mobil.rechnung_gestellt);
    } catch (e) {
      // Die API nennt fehlende Angaben in „fehlend“ – die App zeigt sie in Worten und bietet den Weg zu den Angaben
      if (e instanceof ApiFehler && Array.isArray(e.daten.fehlend)) setFehlend(e.daten.fehlend as string[]);
      else aktion.setFehler(e instanceof Error ? e.message : String(e));
    }
  }

  const namen = t.rechnung.fehlend_namen as Record<string, string>;
  return (
    <Unterseite titel={r?.nummer ?? (rid ? t.rechnung.entwurf : t.rechnung.neu)}>
      <Inhalt>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {aktion.meldung ? <Hinweis art="erfolg" text={aktion.meldung} /> : null}
        {fehlend.length ? (
          <View>
            <Hinweis art="fehler" text={fuelle(t.rechnung.fehlend, { liste: fehlend.map((x) => namen[x.replaceAll(".", "_")] ?? x).join(", ") })} />
            {fehlend.some((x) => x.startsWith("steller") || x.startsWith("kunde")) ? <Knopf leise text={t.mobil.angaben_kurz} onPress={() => nav.oeffnen("angaben", () => <Angaben fertig={() => void neu()} />)} stil={{ alignSelf: "flex-start" }} /> : null}
          </View>
        ) : null}
        {!entwurf && r ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Status status={r.status === "gestellt" ? "erledigt" : "offen"} text={t.rechnung[r.status]} />
              {r.rechnungsdatum ? <T v="caption" leise>{datumLang(r.rechnungsdatum, sprache)}</T> : null}
            </View>
            <T v="titel" stil={{ marginTop: 8 }}>{r.kunde?.name ?? ""}</T>
            <Karte stil={{ marginTop: 16 }}>
              {r.positionen.map((p, i) => (
                <Zeile key={i} titel={p.bezeichnung} text={`${String(p.menge).replace(".", ",")} × ${euroText(p.preis_cent, sprache)}${p.ust_satz !== null && p.ust_satz !== undefined ? ` · ${p.ust_satz} %` : ""}`} letzte={i === r.positionen.length - 1} />
              ))}
            </Karte>
            <Summen netto={r.netto_cent} ust={r.ust_cent} brutto={r.brutto_cent} />
            {r.kleinunternehmer ? <T v="caption" leise stil={{ marginTop: 8 }}>{t.rechnung.ku_info}</T> : null}
            <Hinweis text={t.mobil.pdf_web} />
            {r.status === "gestellt" && r.art === "rechnung" ? (
              <Knopf leise gefahr text={t.rechnung.stornieren} onPress={() => void aktion.ausfuehren(async () => { await klient.schicken(`/v1/rechnungen/${r.id}/stornieren`, "POST"); geaendert(); await neu(); }, t.mobil.storniert)} laedt={aktion.laedt} stil={{ marginTop: 16 }} />
            ) : null}
          </>
        ) : (
          <>
            {ku ? <Hinweis text={t.rechnung.ku_info} /> : null}
            <T v="klein" fett stil={{ marginTop: 8 }}>{t.rechnung.kunde}</T>
            {daten?.kunden.length ? (
              <View style={{ marginTop: 8 }}>
                <Wahl wert={kunde} aendern={setKunde} optionen={daten.kunden.map((k) => ({ wert: k.id, text: k.name }))} />
              </View>
            ) : (
              <Hinweis text={t.rechnung.kein_kunde} />
            )}
            <Knopf leise text={t.angaben.kunde_neu} symbol="plus" onPress={() => nav.oeffnen("angaben", () => <Angaben fertig={() => void neu()} />)} stil={{ marginTop: 10, alignSelf: "flex-start" }} />
            <DatumFeld label={t.rechnung.leistungsdatum} wert={leistung} aendern={setLeistung} />
            <DatumFeld label={t.rechnung.faellig} wert={faellig} aendern={setFaellig} ohneHeute />

            <T v="gross" stil={{ marginTop: 24 }}>{t.rechnung.positionen}</T>
            {pos.map((p, i) => (
              <Karte key={i} stil={{ marginTop: 12, paddingBottom: 14 }}>
                <Feld label={t.rechnung.bezeichnung} wert={p.bezeichnung} aendern={(w) => setPos((x) => x.map((y, j) => (j === i ? { ...y, bezeichnung: w } : y)))} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Feld label={t.rechnung.menge} wert={p.menge} aendern={(w) => setPos((x) => x.map((y, j) => (j === i ? { ...y, menge: w } : y)))} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1.4 }}>
                    <BetragFeld label={t.rechnung.preis} cent={p.preis_cent} aendern={(c) => setPos((x) => x.map((y, j) => (j === i ? { ...y, preis_cent: c } : y)))} />
                  </View>
                </View>
                <Wahl label={t.rechnung.einheit} wert={p.einheit} aendern={(w) => setPos((x) => x.map((y, j) => (j === i ? { ...y, einheit: w } : y)))} optionen={EINHEITEN.map((e) => ({ wert: e, text: (t.rechnung.einheiten as Record<string, string>)[e] ?? e }))} />
                {!ku ? <Wahl label={t.rechnung.steuersatz} wert={p.ust_art} aendern={(w) => setPos((x) => x.map((y, j) => (j === i ? { ...y, ust_art: w } : y)))} optionen={[{ wert: "regel", text: t.rechnung.regel }, { wert: "ermaessigt", text: t.rechnung.ermaessigt }]} /> : null}
                {pos.length > 1 ? (
                  <Pressable accessibilityRole="button" onPress={() => setPos((x) => x.filter((_, j) => j !== i))} style={{ marginTop: 12, minHeight: 40, justifyContent: "center", alignSelf: "flex-start" }}>
                    <T v="klein" farbe={f.frist}>{t.mobil.position_entfernen}</T>
                  </Pressable>
                ) : null}
              </Karte>
            ))}
            <Knopf leise text={t.rechnung.zeile} symbol="plus" onPress={() => setPos((x) => [...x, leerePosition()])} stil={{ marginTop: 12, alignSelf: "flex-start" }} />
            <Feld label={t.rechnung.hinweis} wert={hinweis} aendern={setHinweis} mehrzeilig />
            <View style={{ marginTop: 20, flexDirection: "row", justifyContent: "space-between" }}>
              <T leise>{t.rechnung.summe_netto}</T>
              <T fett stil={{ fontVariant: ["tabular-nums"] }}>{euroText(netto, sprache)}</T>
            </View>
            {!ku ? <T v="caption" leise>{t.mobil.ust_beim_stellen}</T> : null}
            <Knopf text={t.rechnung.stellen} symbol="checkmark" onPress={() => void stellen()} laedt={aktion.laedt} deaktiviert={!positionen.length || !kunde} stil={{ marginTop: 20 }} />
            <T v="caption" leise stil={{ marginTop: 6 }}>{t.rechnung.stellen_text}</T>
            <Knopf leise text={t.rechnung.speichern} onPress={() => void speichern()} laedt={aktion.laedt} stil={{ marginTop: 12 }} />
            {rid ? (
              <Knopf leise gefahr text={t.rechnung.loeschen} onPress={() => void aktion.ausfuehren(async () => { await klient.schicken(`/v1/rechnungen/${rid}`, "DELETE"); geaendert(); nav.zurueck(); })} stil={{ marginTop: 12 }} />
            ) : null}
          </>
        )}
      </Inhalt>
    </Unterseite>
  );
}

function Summen({ netto, ust, brutto }: { netto: number; ust: number; brutto: number }) {
  const { t, sprache } = useAmtlos();
  const zeile = (label: string, cent: number, fett?: boolean) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
      <T fett={fett} leise={!fett}>{label}</T>
      <T fett={fett} stil={{ fontVariant: ["tabular-nums"] }}>{euroText(cent, sprache)}</T>
    </View>
  );
  return (
    <View style={{ marginTop: 16 }}>
      {zeile(t.rechnung.summe_netto, netto)}
      {zeile(t.rechnung.summe_ust, ust)}
      {zeile(t.rechnung.summe_brutto, brutto, true)}
    </View>
  );
}

export type { Position };
