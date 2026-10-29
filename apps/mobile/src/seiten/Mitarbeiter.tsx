/**
 * R12 Personal (Zoll #5, #8, Kurier #13): Zusätze auf der Seite einer beschäftigten Person – Betriebsstätte, Kopie des
 * Aufenthaltstitels (verschlüsselt wie Belegfotos) mit Ablaufhinweis und die Rückfrage bei doppelten Namen.
 */
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { STAAT_NAMEN, STAAT_OPTIONEN, STAAT_UNGEKLAERT, staatAuswahl, staatsangehoerigkeitArt, staatsangehoerigkeitErkennen, staatsangehoerigkeitText, type Person } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { Auswahl, Hinweis, Karte, Knopf, Symbol, T, TextKnopf } from "../ui/bausteine";
import { bestaetigen } from "../ui/bestaetigen";
import { useMeldung } from "../ui/meldung";
import { useNav } from "../ui/navigation";
import { istNativ, useFarben } from "../ui/thema";
import { belegFoto } from "../unterlagen/belegfoto";
import { dateiTeilenBytes, dateiWaehlenBytes } from "../unterlagen/sicherungDatei";
import { AUFENTHALT_VORLAUF_TAGE, aufenthaltLaeuftAb, heute } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { datumKurz } from "./gemeinsam";
import { StaettenWahl } from "./BetriebStaetten";

const endung = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" };

/**
 * Braucht die Person einen Aufenthaltstitel? Bei einer Staatsangehörigkeit sicher außerhalb von EU, EWR und Schweiz (auch
 * staatenlos) oder wenn schon etwas dazu eingetragen ist. E-238: „deutsche“, „Polin“, „deutsch/türkisch“ nicht; nicht
 * sicher zuzuordnende Angaben auch nicht – dort bittet die Auswahl, den Staat zu wählen.
 */
export function mitAufenthalt(p: Person): boolean {
  if (p.aufenthalt_datei || p.aufenthalt_bis || p.aufenthalt_art) return true;
  return staatsangehoerigkeitArt(p) === "drittstaat";
}

/** Werte für die Felder einer beschäftigten Person: die Auswahl auch bei älteren Daten (aus dem Text sicher erkannt). */
export function mitarbeiterWerte(p: Person): Person {
  return { ...p, staat: staatAuswahl(p) ?? "" };
}

/**
 * E-238: Staatsangehörigkeit aus der Liste wählen (Deutschland, EU, EWR, Schweiz, mehrere, anderer Staat, staatenlos,
 * ungeklärt). Ist etwas gewählt, steht nur die Wahl da („Ändern“ zeigt die Liste). Ältere Freitexte bleiben lesbar: sicher
 * erkannt → als Wahl vorbelegt; sonst der Text mit der Bitte, aus der Liste zu wählen (bei einem Tippfehler mit Vorschlag).
 */
export function StaatWahl({ p }: { p: Person }) {
  const z = useAmtlos();
  const gewaehlt = staatAuswahl(p);
  const gespeichert = typeof p.staat === "string" && p.staat !== "";
  const [offen, setOffen] = useState(!gewaehlt);
  const text = (p.staatsangehoerigkeit ?? "").trim();
  const art = staatsangehoerigkeitArt(p);
  const vorschlag = !gewaehlt && text ? staatsangehoerigkeitErkennen(text).vorschlag : undefined;
  const waehlen = (w: string) => {
    z.personSetzen("mitarbeiter", { ...p, staat: w, staatsangehoerigkeit: staatsangehoerigkeitText(w, p.staatsangehoerigkeit) || null } as Person);
    setOffen(false);
  };
  const optionen = offen || !gewaehlt ? [...STAAT_OPTIONEN] : STAAT_OPTIONEN.filter((o) => o.wert === gewaehlt);
  return (
    <View>
      <Auswahl label={TEXT.e238_staat} hilfe={TEXT.e238_staat_hilfe} wert={gewaehlt} aendern={waehlen} optionen={optionen} />
      {gewaehlt && !offen ? <TextKnopf symbol="chevron.down" text={TEXT.e238_staat_aendern} onPress={() => setOffen(true)} stil={{ marginTop: 4 }} /> : null}
      {/* älterer Freitext, sicher erkannt: zeigen, woraus die Wahl kommt */}
      {gewaehlt && !gespeichert && text ? <T v="caption" leise stil={{ marginTop: 6 }}>{TEXT.e238_staat_erkannt(text)}</T> : null}
      {/* nicht sicher zuzuordnen: nie still Drittstaat – die Pflicht ist „zu prüfen“, bis gewählt ist */}
      {!gewaehlt && text ? (
        <View style={{ marginTop: 8 }}>
          <Hinweis art="warnung" text={art === "frei" ? TEXT.e238_staat_genauer(text) : TEXT.e238_staat_unklar(text)} />
          {vorschlag ? <TextKnopf symbol="checkmark" text={TEXT.e238_staat_vorschlag(STAAT_NAMEN[vorschlag] ?? vorschlag)} onPress={() => waehlen(vorschlag)} /> : null}
        </View>
      ) : null}
      {gewaehlt === STAAT_UNGEKLAERT ? <View style={{ marginTop: 8 }}><Hinweis text={TEXT.e238_staat_ungeklaert} /></View> : null}
    </View>
  );
}

/** Kopie des Aufenthaltstitels: aufnehmen bzw. wählen, ansehen, teilen, ersetzen. */
function AufenthaltKopie({ p, setze }: { p: Person; setze: (werte: Partial<Person>) => void }) {
  const z = useAmtlos();
  const f = useFarben();
  const melden = useMeldung();
  const [bild, setBild] = useState<string | null>(null);
  const datei = p.aufenthalt_datei ?? null;
  const art = datei ? endung(datei) : "";
  useEffect(() => {
    if (!datei || !["jpg", "jpeg", "png"].includes(art)) return setBild(null);
    let aktiv = true;
    let entfernen: (() => void) | null = null;
    void z.dateiAnzeigen(datei, MIME[art] ?? "image/jpeg").then((a) => {
      if (!a) return;
      if (!aktiv) return a.entfernen();
      entfernen = a.entfernen;
      setBild(a.uri);
    });
    return () => {
      aktiv = false;
      entfernen?.();
    };
  }, [datei, art]);
  const ablegen = async (bytes: Uint8Array | null, endungNeu: string) => {
    if (!bytes) return;
    const name = await z.dateiSpeichern(bytes, endungNeu);
    setze({ aufenthalt_datei: name });
    melden(TEXT.r12p_aufenthalt_gespeichert);
  };
  const foto = (kamera: boolean) => void belegFoto(kamera).then((b) => ablegen(b, "jpg")).catch(() => melden(TEXT.beleg_fehler, "info"));
  const waehlen = () =>
    void dateiWaehlenBytes(["application/pdf", "image/*"])
      .then((d) => (d ? ablegen(d.bytes, endung(d.name) || (d.mime.includes("pdf") ? "pdf" : "jpg")) : undefined))
      .catch(() => melden(TEXT.beleg_fehler, "info"));
  const teilen = async () => {
    if (!datei) return;
    const bytes = await z.dateiLesen(datei);
    if (bytes) await dateiTeilenBytes(`Aufenthaltstitel-${p.name.trim().replace(/\s+/g, "-") || "Person"}.${art}`, bytes, MIME[art] ?? "application/octet-stream").catch(() => undefined);
  };
  return (
    <Karte stil={{ marginTop: 16, paddingVertical: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Symbol name={datei ? "checkmark.circle" : "doc.text"} groesse={20} farbe={datei ? f.erfolg : f.tinteLeise} />
        <View style={{ flex: 1 }}>
          <T fett>{TEXT.r12p_aufenthalt_kopie}</T>
          <T v="caption" leise>{datei ? TEXT.r12p_aufenthalt_kopie_da(art.toUpperCase()) : TEXT.r12p_aufenthalt_kopie_text}</T>
        </View>
      </View>
      {bild ? <Image source={{ uri: bild }} style={{ width: "100%", height: 200, borderRadius: 8, backgroundColor: f.papier }} resizeMode="contain" accessibilityLabel={TEXT.r12p_aufenthalt_kopie} /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {istNativ ? <TextKnopf symbol="camera" text={TEXT.beleg_foto} onPress={() => foto(true)} /> : null}
        <TextKnopf symbol="doc.text" text={datei ? TEXT.r12p_aufenthalt_ersetzen : TEXT.beleg_datei} onPress={waehlen} />
        {istNativ ? <TextKnopf symbol="photo" text={TEXT.beleg_aus_fotos} onPress={() => foto(false)} /> : null}
        {datei ? <TextKnopf symbol="square.and.arrow.up" text={TEXT.beleg_teilen} onPress={() => void teilen()} /> : null}
      </View>
    </Karte>
  );
}

/** Zusätze unter den Feldern einer beschäftigten Person. */
export function MitarbeiterZusatz({ p }: { p: Person }) {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const setze = (werte: Partial<Person>) => z.personSetzen("mitarbeiter", { ...p, ...werte } as Person);
  const doppelt = z.doppeltePerson("mitarbeiter", p.id);
  const bald = aufenthaltLaeuftAb({ mitarbeiter: [p] }, heute(), AUFENTHALT_VORLAUF_TAGE)[0];
  return (
    <View>
      {doppelt ? (
        <Karte stil={{ marginTop: 16, paddingVertical: 14, gap: 10 }}>
          <Hinweis art="warnung" text={TEXT.r12p_doppelt(doppelt.name, doppelt.beginn ? datumKurz(doppelt.beginn) : null)} />
          <Knopf
            symbol="person.2"
            text={TEXT.r12p_zusammenfuehren}
            onPress={() =>
              void bestaetigen({ titel: TEXT.r12p_zusammenfuehren_frage(doppelt.name), text: TEXT.r12p_zusammenfuehren_text, ja: TEXT.r12p_zusammenfuehren }).then((ok) => {
                if (!ok) return;
                // es bleibt der Eintrag mit mehr Angaben (bei Gleichstand der schon vorhandene)
                const angaben = (x: Person) => Object.entries(x).filter(([k, w]) => k !== "id" && k !== "geaendert" && typeof w === "string" && w.trim()).length;
                const bleibt = angaben(p) > angaben(doppelt) ? p : doppelt;
                z.personenZusammenfuehren("mitarbeiter", bleibt.id, bleibt.id === p.id ? doppelt.id : p.id);
                melden(TEXT.r12p_zusammengefuehrt);
                if (bleibt.id !== p.id) nav.zurueck();
              })
            }
          />
        </Karte>
      ) : null}
      {z.stand.betriebsstaetten.length ? (
        <View style={{ marginTop: 16 }}>
          <StaettenWahl wert={p.betriebsstaette} aendern={(id) => setze({ betriebsstaette: id })} hilfe={TEXT.r12p_staette_person_hilfe} />
        </View>
      ) : null}
      {bald ? <View style={{ marginTop: 12 }}><Hinweis art={bald.tage < 0 ? "fehler" : "warnung"} text={TEXT.r12p_aufenthalt_bald(p.name.trim(), datumKurz(bald.bis), bald.tage)} /></View> : null}
      {mitAufenthalt(p) ? <AufenthaltKopie p={p} setze={setze} /> : null}
    </View>
  );
}
