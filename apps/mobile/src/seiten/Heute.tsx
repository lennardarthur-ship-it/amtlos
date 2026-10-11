import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { datumLang, fuelle, offeneFragen } from "@amtlos/i18n";
import type { Karte as KarteT } from "../kern/api";
import type { Gruendung as GruendungT, Termin } from "../kern/typen";
import { useNav } from "../ui/navigation";
import { Gruendung } from "./mehr/Gruendung";
import { Postfach } from "./mehr/Postfach";
import { Fristblatt, Hinweis, Knopf, Status, Symbol, T, Zeile } from "../ui/bausteine";
import { RADIUS, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";
import { Leer, Seite, useLaden } from "./gemeinsam";
import { PflichtBlatt } from "./Pflicht";
import { Schnellstart } from "./Schnellstart";

/** Heutiges Datum in Worten: die Unterzeile von „Heute“ – ein Fristenplaner darf das Datum zeigen. */
function heuteInWorten(s: "de" | "en") {
  return new Intl.DateTimeFormat(s === "en" ? "en-GB" : "de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" }).format(new Date());
}

/** Zeile für eine Pflicht: Fristblatt, Titel, Status. */
export function PflichtZeile({ k, onPress, letzte }: { k: KarteT; onPress: () => void; letzte?: boolean }) {
  const { t, sprache } = useAmtlos();
  const status = (t.status as Record<string, string>)[k.status] ?? k.status;
  return (
    <Zeile
      links={<Fristblatt datum={k.faellig_am} status={k.status} sprache={sprache} />}
      titel={k.titel}
      text={k.faellig_am && k.status !== "erledigt" ? `${status} · ${fuelle(t.pflichten.bis, { datum: datumLang(k.faellig_am, sprache) })}` : status}
      onPress={onPress}
      letzte={letzte}
    />
  );
}

export function Heute() {
  const { t, sprache, klient, unternehmenId, wartend, fehlgeschlagen, online, demo } = useAmtlos();
  const f = useFarben();
  const { daten, fehler, laedt, neu } = useLaden(async () => {
    const [h, p, g, termine] = await Promise.all([
      klient.heute(),
      klient.profil(),
      klient.holen<GruendungT>("/v1/gruendung").catch(() => null),
      klient.holen<Termin[]>("/v1/termine").catch(() => [] as Termin[]),
    ]);
    return { h, profil: p.daten ?? {}, nachfragen: offeneFragen(p.daten ?? {}), gruendung: g?.fortschritt ?? null, termine };
  }, [unternehmenId]);
  const [gewaehlt, setGewaehlt] = useState<KarteT | null>(null);
  const [fragebogen, setFragebogen] = useState(false);
  const nav = useNav();
  const [vorStartLaedt, setVorStartLaedt] = useState(false);
  const bis60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  const h = daten?.h;
  const [jetzt, ...danach] = h?.als_naechstes ?? [];
  const gesamt = h ? h.zaehler.klar + h.zaehler.erledigt : 0;
  const anteil = gesamt ? Math.round((h!.zaehler.erledigt / gesamt) * 100) : 0;
  const rand = jetzt?.status === "ueberfaellig" ? f.frist : jetzt?.status === "faellig_bald" ? f.bald : f.linie;

  return (
    <Seite titel={t.heute.titel} unterzeile={heuteInWorten(sprache)} laedt={laedt} neu={neu}>
      {demo ? <Hinweis text={t.mobil.demo_hinweis} symbol="sparkles" /> : null}
      {!online ? <Hinweis text={t.mobil.offline} symbol="wifi.slash" /> : null}
      {wartend ? <Hinweis text={fuelle(t.mobil.wartend, { n: wartend })} symbol="arrow.triangle.2.circlepath" /> : null}
      {fehlgeschlagen.length ? <Hinweis art="fehler" text={fuelle(t.mobil.fehlgeschlagen, { n: fehlgeschlagen.length })} /> : null}
      {fehler && !h ? <Hinweis art="fehler" text={fehler} /> : null}

      {h ? (
        <>
          <T v="gross" accessibilityRole="header">{jetzt ? t.heute.jetzt_dran : t.heute.als_naechstes}</T>
          {jetzt ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t.heute.jetzt_oeffnen}
              onPress={() => setGewaehlt(jetzt)}
              style={({ pressed }) => ({ marginTop: 10, backgroundColor: f.blatt, borderRadius: RADIUS.karte, borderWidth: 1.5, borderColor: rand, padding: 16, opacity: pressed ? 0.85 : 1 })}
            >
              <View style={{ flexDirection: "row", gap: 16 }}>
                <Fristblatt datum={jetzt.faellig_am} status={jetzt.status} sprache={sprache} gross />
                <View style={{ flex: 1 }}>
                  <T v="titel">{jetzt.titel}</T>
                  <T v="klein" leise numberOfLines={3} stil={{ marginTop: 6 }}>{jetzt.kurz}</T>
                </View>
              </View>
              <View style={{ marginTop: 12 }}>
                <Status status={jetzt.status} text={`${(t.status as Record<string, string>)[jetzt.status]}${jetzt.faellig_am ? ` · ${fuelle(t.pflichten.bis, { datum: datumLang(jetzt.faellig_am, sprache) })}` : ""}`} />
              </View>
              <View style={{ marginTop: 14, minHeight: 44, borderRadius: 10, backgroundColor: f.amtHauch, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <T fett farbe={f.amt}>{t.heute.jetzt_oeffnen}</T>
                <Symbol name="arrow.right" groesse={15} farbe={f.amt} gewicht="semibold" />
              </View>
            </Pressable>
          ) : (
            <View style={{ marginTop: 10 }}>
              <Leer text={t.heute.nichts_offen} />
            </View>
          )}

          {danach.length ? (
            <View style={{ marginTop: 20 }}>
              <T v="klein" fett leise>{t.heute.danach}</T>
              {danach.map((k, i) => (
                <PflichtZeile key={`${k.pflicht_id}|${k.periode}`} k={k} onPress={() => setGewaehlt(k)} letzte={i === danach.length - 1} />
              ))}
            </View>
          ) : null}

          <View style={{ marginTop: 18, flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <T v="caption" leise>{fuelle(t.heute.zaehler_offen, { n: h.zaehler.klar })}</T>
            {h.zaehler.ueberfaellig ? <T v="caption" fett farbe={f.frist}>{fuelle(t.heute.zaehler_ueberfaellig, { n: h.zaehler.ueberfaellig })}</T> : null}
            {h.zaehler.erledigt ? <T v="caption" leise>{fuelle(t.heute.zaehler_erledigt, { n: h.zaehler.erledigt, prozent: anteil })}</T> : null}
          </View>
          {gesamt ? (
            <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: anteil }} style={{ marginTop: 8, height: 4, borderRadius: 2, backgroundColor: f.linieLeise, overflow: "hidden" }}>
              <View style={{ width: `${anteil}%`, height: 4, backgroundColor: f.amt }} />
            </View>
          ) : null}

          {daten?.gruendung && daten.gruendung.gesamt > 0 && !daten.gruendung.fertig ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.oeffnen("gruendung", () => <Gruendung geaendert={() => void neu()} />)}
              style={({ pressed }) => ({ marginTop: 24, borderRadius: RADIUS.karte, backgroundColor: f.blatt, borderWidth: 1.5, borderColor: f.amt, padding: 14, opacity: pressed ? 0.85 : 1 })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Symbol name="flag" groesse={22} farbe={f.amt} />
                <View style={{ flex: 1 }}>
                  <T fett>{fuelle(t.gruendung.heute_karte, { n: daten.gruendung.erledigt, gesamt: daten.gruendung.gesamt })}</T>
                  <T v="klein" farbe={f.amt}>{t.gruendung.heute_link}</T>
                </View>
                <Symbol name="chevron.right" groesse={16} />
              </View>
              <View style={{ marginTop: 10, height: 4, borderRadius: 2, backgroundColor: f.linieLeise, overflow: "hidden" }}>
                <View style={{ width: `${Math.round((daten.gruendung.erledigt / daten.gruendung.gesamt) * 100)}%`, height: 4, backgroundColor: f.amt }} />
              </View>
            </Pressable>
          ) : null}

          {daten?.termine.filter((w) => w.datum <= bis60).length ? (
            <View style={{ marginTop: 24 }}>
              <T v="klein" fett leise>{t.postfach.weitere_fristen}</T>
              {daten.termine.filter((w) => w.datum <= bis60).slice(0, 5).map((w, i, liste) => (
                <Zeile key={w.id} links={<Fristblatt datum={w.datum} status={w.datum < new Date().toISOString().slice(0, 10) ? "ueberfaellig" : "offen"} sprache={sprache} />} titel={w.titel} onPress={() => nav.oeffnen("postfach", () => <Postfach geaendert={() => void neu()} />)} letzte={i === liste.length - 1} />
              ))}
            </View>
          ) : null}

          {h.vor_start && h.vor_start.anzahl > 0 && h.vor_start.seit ? (
            <View style={{ marginTop: 24, borderRadius: RADIUS.karte, backgroundColor: f.blatt, borderWidth: 1, borderColor: f.linie, padding: 14 }}>
              <T fett>{t.heute.vor_start_titel}</T>
              <T v="klein" leise stil={{ marginTop: 4 }}>{fuelle(t.heute.vor_start_text, { n: h.vor_start.anzahl, datum: datumLang(h.vor_start.seit, sprache) })}</T>
              <Knopf
                leise
                text={t.heute.vor_start_ja}
                laedt={vorStartLaedt}
                onPress={async () => {
                  setVorStartLaedt(true);
                  try {
                    await klient.schicken("/v1/pflichten/vor-start-erledigt", "POST");
                    await neu();
                  } finally {
                    setVorStartLaedt(false);
                  }
                }}
                stil={{ marginTop: 12, alignSelf: "flex-start" }}
              />
            </View>
          ) : null}

          {daten?.nachfragen ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setFragebogen(true)}
              style={({ pressed }) => ({ marginTop: 24, borderRadius: RADIUS.karte, backgroundColor: f.blatt, borderWidth: 1, borderColor: f.linie, padding: 14, flexDirection: "row", gap: 12, alignItems: "center", opacity: pressed ? 0.8 : 1 })}
            >
              <Symbol name="sparkles" groesse={22} farbe={f.amt} />
              <View style={{ flex: 1 }}>
                <T fett>{t.onboarding.nachfragen_titel}</T>
                <T v="klein" leise>{fuelle(t.onboarding.nachfragen_heute, { n: daten.nachfragen })}</T>
              </View>
              <Symbol name="chevron.right" groesse={16} />
            </Pressable>
          ) : null}
          <Modal visible={fragebogen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFragebogen(false)}>
            <Schnellstart phase="nachfragen" profilStart={daten?.profil ?? {}} abbrechen={() => { setFragebogen(false); void neu(); }} fertig={() => { setFragebogen(false); void neu(); }} />
          </Modal>
        </>
      ) : null}
      <PflichtBlatt karte={gewaehlt} offen={gewaehlt !== null} schliessen={() => setGewaehlt(null)} geaendert={() => void neu()} />
    </Seite>
  );
}
