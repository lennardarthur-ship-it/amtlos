import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { BEREICHE, dokumentHtml, pdfDateiname, vorlageFuer } from "@amtlos/fachlogik";
import { betriebFuerDokument } from "../pro/regeln";
import { T as TEXT } from "../texte";
import { ChipLeiste, Feld, Fuss, Hinweis, Karte, Knopf, MehrfachWahl, Schalter, Symbol, T, Zeile } from "../ui/bausteine";
import { useMeldung, useMeldungLeeren } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { HAARLINIE, useFarben, weich } from "../ui/thema";
import { kasseSichtbar } from "../unterlagen/kasse";
import { BG_SCHLUESSEL, UMWELT_NACHWEISE, UMWELT_SCHLUESSEL, aufenthaltEintraege, bestaetigtOhneUnterlage, bgNachweiseFuer, bgVorhandenAm, dateiAlsPdf, eintragZusatz, entsorgungEintraege, kassenMappe, datumDe, deckblattHtml, fehltInMappe, fuerKontrolle, inStaette, kontrollartenFuer, lohnkontoEintraege, mappeDateiname, mappeZusammenfuegen, mappenAuswahl, personalUebersicht, seitenzahl, startSeiten, umweltVorhanden, type Kontrollart, type MappenEintrag } from "../unterlagen/kontrollmappe";
import { istErledigt } from "../pflichten/check";
import { useAuswertung } from "./Pflichten";
import { useOeffnen, useStarten } from "./starten";
import { pdfBytes } from "../unterlagen/pdf";
import { dateiTeilenBytes } from "../unterlagen/sicherungDatei";
import { HAUPT_STAETTE, alleStaetten, heute, personenSortiert, staetteVon } from "../unterlagen/speicher";
import { PersonSeite } from "./Betrieb";
import { mitAufenthalt } from "./Mitarbeiter";
import { useAmtlos } from "../zustand";
import { Ansage } from "./felder";
import { Gruppe, Inhalt } from "./gemeinsam";

/** Eine Unterlage zum An- und Abwählen: Kästchen, Titel, Datum und ob sie schon geteilt ist. */
function MappenZeile({ e, an, umschalten, letzte }: { e: MappenEintrag; an: boolean; umschalten: () => void; letzte: boolean }) {
  const f = useFarben();
  // R12 (Zoll #12): „Aufzeichnung bis … · geteilt am …“, Entwürfe „nicht abgeschlossen“, NachwG „gültig ab …“
  const zusatz = eintragZusatz(e);
  const unter = e.aufzeichnungBis || e.gueltigAb || e.datei || e.html || e.korrekturLaeuft ? zusatz : e.geteilt ? (e.geteiltAm && e.geteiltAm !== e.datum ? TEXT.r12p_mappe_geteilt_am(datumDe(e.datum), datumDe(e.geteiltAm)) : TEXT.kontrollmappe_geteilt(datumDe(e.datum))) : TEXT.kontrollmappe_entwurf(datumDe(e.datum));
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

/** Ein Nachweis ohne Vorlage (BG-Besichtigung) zum Abhaken: „vorhanden“ (R11, Tischlerei #22). */
function PapierZeile({ titel, an, umschalten, letzte, unter }: { titel: string; an: boolean; umschalten: () => void; letzte: boolean; unter?: string }) {
  const f = useFarben();
  const status = unter ?? (an ? TEXT.r11_vorhanden : TEXT.r11_nicht_vorhanden);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: an }}
      aria-checked={an}
      accessibilityLabel={`${titel}, ${status}`}
      onPress={() => {
        weich();
        umschalten();
      }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: an ? 0 : 2, borderColor: f.rahmen, backgroundColor: an ? f.amt : f.papier, alignItems: "center", justifyContent: "center" }}>
        {an ? <Symbol name="checkmark" groesse={14} farbe={f.amtText} gewicht="bold" /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 13, minHeight: 52, justifyContent: "center", borderBottomWidth: letzte ? 0 : HAARLINIE, borderColor: f.linie }}>
        <T fett={an}>{titel}</T>
        <T v="klein" leise stil={{ marginTop: 1 }}>{status}</T>
      </View>
    </Pressable>
  );
}

/** Für welche Kontrollarten die Liste der BG-Nachweise ohne Vorlage erscheint */
const MIT_PAPIER: Kontrollart[] = ["alle", "bg"];
/** R12: Umwelt-Nachweise ohne Vorlage */
const MIT_UMWELT: Kontrollart[] = ["alle", "umwelt"];
/** R12 (Zoll #8): Personalübersicht und Dienstplan auf dem Deckblatt */
const MIT_PERSONAL: Kontrollart[] = ["alle", "zoll"];

/**
 * Kontrollmappe: die aktuellen Nachweise (Arbeitsschutz, Hygiene, Lebensmittel, Datenschutz, Personal) in einem PDF –
 * Deckblatt mit Inhaltsverzeichnis, danach jede ausgewählte Unterlage. Das PDF entsteht auf dem Gerät.
 */
export function KontrollmappeSeite() {
  const z = useAmtlos();
  const f = useFarben();
  const nav = useNav();
  const melden = useMeldung();
  const leeren = useMeldungLeeren();
  useEffect(() => leeren(), [leeren]);
  const tag = heute();
  const { eintraege: alleEintraege, unvollstaendigListe } = useMemo(() => mappenAuswahl(z.stand), [z.stand]);
  const oeffnen = useOeffnen();
  // Kontrollart (R10): nur, was die jeweilige Stelle prüft
  const [art, setArt] = useState<Kontrollart>("alle");
  // R12 (Bäckerei #7): Mappe für eine Betriebsstätte
  const [staette, setStaette] = useState<string | null>(null);
  // R12 (Zoll #7, #8): Lohnkonto nur auf Verlangen; Dienstplan des Tages
  const [lohnkonto, setLohnkonto] = useState(false);
  const [dienst, setDienst] = useState<string[]>([]);
  const [dienstText, setDienstText] = useState("");
  // R12: Kassennachschau – Kassenbücher aus den Tagesabschlüssen, Kassenmeldung, Verfahrensdokumentation
  const kasseEintraege = useMemo(() => kassenMappe(z.stand), [z.stand]);
  // R12: Einträge ohne Vorlage – Kopien der Aufenthaltstitel, Lohnkonten, Entsorgungsbelege
  const aufenthalt = useMemo(() => aufenthaltEintraege(z.stand, tag), [z.stand, tag]);
  const lohn = useMemo(() => lohnkontoEintraege(z.stand, tag), [z.stand, tag]);
  const umwelt = useMemo(() => entsorgungEintraege(z.stand.belege, z.stand.betrieb.name, tag), [z.stand.belege, z.stand.betrieb.name, tag]);
  const mitEintraegen = useMemo(() => {
    const m = new Set<Kontrollart>();
    for (const e of [...alleEintraege, ...aufenthalt]) for (const k of ["hygiene", "zoll", "bg", "datenschutz", "umwelt"] as Kontrollart[]) if (fuerKontrolle(e.vorlage, k)) m.add(k);
    if (umwelt.length) m.add("umwelt");
    if (kasseEintraege.length || kasseSichtbar(z.stand)) m.add("kasse");
    return m;
  }, [alleEintraege, aufenthalt, umwelt, kasseEintraege, z.stand]);
  const arten = kontrollartenFuer(z.stand, mitEintraegen).filter((k) => k !== "kasse" || mitEintraegen.has("kasse"));
  const eintraege = useMemo(() => {
    const roh = art === "kasse" ? kasseEintraege : [...alleEintraege, ...aufenthalt, ...(art === "zoll" && lohnkonto ? lohn : []), ...(art === "umwelt" ? umwelt : [])].filter((e) => fuerKontrolle(e.vorlage, art));
    return roh.filter((e) => inStaette(e, staette, z.stand));
  }, [alleEintraege, kasseEintraege, aufenthalt, lohn, umwelt, lohnkonto, art, staette, z.stand]);
  // „Fehlt noch“: offene Pflichten aus dem Check mit einer Vorlage, die in diese Mappe gehört
  const a = useAuswertung();
  const starten = useStarten();
  const fehlt = useMemo(() => {
    const e = { erledigt: z.stand.erledigt, unterlagen: z.stand.unterlagen, betrieb: z.stand.betrieb };
    return fehltInMappe(a.gilt.filter((p) => !istErledigt(p, e)), eintraege, art).slice(0, 8);
  }, [a, z.stand.erledigt, z.stand.unterlagen, z.stand.betrieb, eintraege, art]);
  // R12 (UX #6): abgehakt ohne Unterlage – auf dem Deckblatt „vorhanden (bestätigt am …)“
  const bestaetigt = useMemo(() => bestaetigtOhneUnterlage(a.gilt, z.stand.erledigt, eintraege, art), [a, z.stand.erledigt, eintraege, art]);
  // R12 (Zoll #5): Personen, die einen Aufenthaltstitel brauchen, ohne Kopie in der App
  const ohneKopie = art === "zoll" || art === "alle" ? personenSortiert(z.stand.mitarbeiter).filter((p) => mitAufenthalt(p) && !p.aufenthalt_datei && !(p.ende && p.ende < tag) && (!staette || (p.betriebsstaette || HAUPT_STAETTE) === staette)) : [];
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
  // unvollständige Unterlagen dieser Kontrollart – mit dem Weg zum Ergänzen (R11, UX #2/#5)
  const halb = unvollstaendigListe.filter((x) => fuerKontrolle(x.vorlage, art));
  const papier = MIT_PAPIER.includes(art);
  const mitUmwelt = MIT_UMWELT.includes(art);
  const mitPersonal = MIT_PERSONAL.includes(art) && z.stand.mitarbeiter.length > 0;
  const personal = useMemo(() => (mitPersonal ? personalUebersicht(z.stand, tag, staette ?? undefined) : []), [mitPersonal, z.stand, tag, staette]);
  const bg = bgNachweiseFuer(z.stand.profil, z.stand.erledigt);
  const gruppen = BEREICHE.map((b) => ({ ...b, liste: eintraege.filter((e) => e.bereich === b.id) })).filter((g) => g.liste.length);
  const staetten = alleStaetten(z.stand);

  const los = async () => {
    setFehler(null);
    if (Platform.OS === "web") {
      setFehler(TEXT.kontrollmappe_web);
      return;
    }
    setLaedt(true);
    try {
      const b = betriebFuerDokument(z.stand.betrieb, z.pro);
      const teile: Uint8Array[] = [];
      const drin: MappenEintrag[] = [];
      for (const e of gewaehlt) {
        // R12: Datei (Aufenthaltstitel, Entsorgungsbeleg) bzw. fertiges HTML (Übersicht der Entsorgungsbelege)
        if (e.datei) {
          const roh = await z.dateiLesen(e.datei.name);
          const bytes = roh ? await dateiAlsPdf(roh, e.datei.name, e.datei.titel) : null;
          if (!bytes) continue;
          teile.push(bytes);
          drin.push(e);
          continue;
        }
        if (e.html) {
          const bytes = await pdfBytes(e.html, `${e.vorlage}.pdf`);
          if (!bytes) throw new Error("pdf");
          teile.push(bytes);
          drin.push(e);
          continue;
        }
        const u = z.stand.unterlagen.find((x) => x.id === e.id);
        const v = vorlageFuer(e.vorlage);
        // R12: Kassenbuch aus den Tagesabschlüssen hat keine gespeicherte Unterlage; frühere Fassungen ihre eigenen Daten
        const daten = e.daten ?? u?.daten;
        if (!daten || !v) continue;
        const bytes = await pdfBytes(dokumentHtml(v, daten, b), pdfDateiname(v, daten, tag), v.querformat);
        if (!bytes) throw new Error("pdf");
        teile.push(bytes);
        drin.push(e);
      }
      const seiten = await Promise.all(teile.map(seitenzahl));
      const papierListe = [
        ...(papier ? bg.map((n) => ({ titel: n.titel, am: bgVorhandenAm(z.stand.erledigt, n) ?? undefined })).filter((n) => n.am) : []),
        ...(mitUmwelt ? umweltVorhanden(z.stand.erledigt) : []),
        ...bestaetigt,
      ];
      const extra = {
        staette: staette ? [staetteVon(z.stand, staette).name, staetteVon(z.stand, staette).anschrift].filter(Boolean).join(", ") : undefined,
        personal,
        dienstplan: mitPersonal ? { namen: z.stand.mitarbeiter.filter((p) => dienst.includes(p.id)).map((p) => p.name.trim()), text: dienstText } : undefined,
        hinweis: art === "zoll" ? TEXT.r12p_mappe_bereithalten : undefined,
      };
      // Deckblatt zweimal, falls das Inhaltsverzeichnis über eine Seite hinausgeht – dann verschieben sich die Seiten
      let deckSeiten = 1;
      let deck: Uint8Array | null = null;
      for (let i = 0; i < 2; i++) {
        const start = startSeiten(deckSeiten, seiten);
        deck = await pdfBytes(deckblattHtml(z.stand.betrieb.name, tag, drin.map((e, j) => ({ ...e, seite: start[j] })), art === "alle" ? undefined : TEXT.kontrollmappe_arten[art] ?? TEXT.r12p_mappe_arten[art], papierListe, extra), "Kontrollmappe-Deckblatt.pdf");
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
        <ChipLeiste label={TEXT.kontrollmappe_art_label} wert={art} aendern={setArt} optionen={arten.map((k) => ({ wert: k, text: TEXT.kontrollmappe_arten[k] ?? TEXT.r12p_mappe_arten[k] ?? k }))} stil={{ marginTop: 0 }} />
        <T v="caption" leise stil={{ marginTop: 8 }}>{TEXT.r12p_mappe_art_hilfe[art] ?? TEXT.kontrollmappe_art_hilfe[art]}</T>
        {staetten.length > 1 ? (
          <ChipLeiste label={TEXT.r12p_mappe_staette_label} wert={staette ?? "alle"} aendern={(w) => setStaette(w === "alle" ? null : w)} optionen={[{ wert: "alle", text: TEXT.r12p_mappe_alle_staetten }, ...staetten.map((x) => ({ wert: x.id, text: x.name }))]} stil={{ marginTop: 14 }} />
        ) : null}
        {art === "zoll" ? <View style={{ marginTop: 12 }}><Hinweis art="info" symbol="printer" text={TEXT.r12p_mappe_bereithalten} /></View> : null}
        {fehlt.length ? (
          <Gruppe titel={TEXT.kontrollmappe_fehlt_titel} hilfe={TEXT.kontrollmappe_fehlt_hilfe}>
            <Karte>
              {fehlt.map((x, i) => (
                <Zeile key={x.id} symbol="plus.circle" ton="bald" titel={x.titel} text={vorlageFuer(x.vorlage)?.titel} onPress={() => starten(x.vorlage)} letzte={i === fehlt.length - 1} />
              ))}
            </Karte>
          </Gruppe>
        ) : null}
        {ohneKopie.length ? (
          <Gruppe titel={TEXT.r12p_mappe_ohne_kopie_titel} hilfe={TEXT.r12p_mappe_ohne_kopie_hilfe}>
            <Karte>
              {ohneKopie.map((p, i) => (
                <Zeile key={p.id} symbol="doc.text" ton="bald" titel={p.name} text={TEXT.r12p_mappe_ohne_kopie_zeile} onPress={() => nav.oeffnen(`person-${p.id}`, () => <PersonSeite art="mitarbeiter" id={p.id} />, true)} letzte={i === ohneKopie.length - 1} />
              ))}
            </Karte>
          </Gruppe>
        ) : null}
        {halb.length ? (
          <Gruppe titel={TEXT.r11_mappe_halb_titel(halb.length)} hilfe={TEXT.r11_mappe_halb_hilfe}>
            <Karte>
              {halb.map((x, i) => (
                <Zeile key={x.id} symbol="exclamationmark.circle" ton="bald" titel={x.titel} text={TEXT.r11_mappe_halb_zeile(x.fehlt)} onPress={() => oeffnen(x.id)} letzte={i === halb.length - 1} />
              ))}
            </Karte>
          </Gruppe>
        ) : null}
        {mitPersonal ? (
          <Gruppe titel={TEXT.r12p_mappe_dienstplan_titel} hilfe={TEXT.r12p_mappe_dienstplan_hilfe}>
            <Karte stil={{ paddingBottom: 14 }}>
              {personal.length ? <MehrfachWahl label={TEXT.r12p_mappe_dienstplan_wer} werte={dienst} aendern={setDienst} optionen={personenSortiert(z.stand.mitarbeiter).filter((p) => personal.some((x) => x.name === p.name.trim())).map((p) => ({ wert: p.id, text: p.name.trim() }))} /> : null}
              <Feld label={TEXT.r12p_mappe_dienstplan_text} wert={dienstText} aendern={setDienstText} mehrzeilig placeholder={TEXT.r12p_mappe_dienstplan_beispiel} />
              <T v="caption" leise stil={{ marginTop: 8 }}>{TEXT.r12p_mappe_personal_text(personal.length)}</T>
            </Karte>
          </Gruppe>
        ) : null}
        {art === "zoll" ? (
          <Karte stil={{ marginTop: 16, paddingVertical: 4 }}>
            <Schalter label={TEXT.r12p_mappe_lohnkonto} hilfe={lohn.length ? TEXT.r12p_mappe_lohnkonto_hilfe : TEXT.r12p_mappe_lohnkonto_keins} wert={lohnkonto} aendern={setLohnkonto} />
          </Karte>
        ) : null}
        {eintraege.length ? (
          gruppen.map((g, gi) => (
            <Gruppe key={g.id} titel={g.titel} hilfe={gi === 0 ? TEXT.kontrollmappe_gruppe_hilfe : undefined}>
              <Karte>
                {g.liste.map((e, i) => (
                  <MappenZeile key={e.id} e={e} an={!ab.has(e.id)} umschalten={() => umschalten(e.id)} letzte={i === g.liste.length - 1} />
                ))}
              </Karte>
            </Gruppe>
          ))
        ) : (
          <View style={{ marginTop: 16 }}>
            <Hinweis text={alleEintraege.length ? TEXT.kontrollmappe_art_leer : TEXT.kontrollmappe_leer} />
          </View>
        )}
        {papier ? (
          <Gruppe titel={TEXT.r11_bg_titel} hilfe={TEXT.r12p_bg_hilfe}>
            <Karte>
              {bg.map((n, i) => {
                const eigen = Boolean(z.stand.erledigt[BG_SCHLUESSEL(n.id)]);
                const am = bgVorhandenAm(z.stand.erledigt, n);
                // über die Pflicht abgehakt („Was hast du schon?“): vorhanden, Haken dort entfernen
                const ausPflicht = Boolean(am && !eigen);
                return <PapierZeile key={n.id} titel={n.titel} an={Boolean(am)} unter={ausPflicht ? TEXT.r12p_vorhanden_aus_check(datumDe(am!)) : undefined} umschalten={() => (ausPflicht ? melden(TEXT.r12p_vorhanden_aus_check_hinweis, "info") : z.erledigtSetzen(BG_SCHLUESSEL(n.id), eigen ? null : heute()))} letzte={i === bg.length - 1} />;
              })}
            </Karte>
          </Gruppe>
        ) : null}
        {mitUmwelt ? (
          <Gruppe titel={TEXT.r12p_umwelt_titel} hilfe={TEXT.r12p_umwelt_hilfe}>
            <Karte>
              {UMWELT_NACHWEISE.map((n, i) => {
                const an = Boolean(z.stand.erledigt[UMWELT_SCHLUESSEL(n.id)]);
                return <PapierZeile key={n.id} titel={n.titel} an={an} umschalten={() => z.erledigtSetzen(UMWELT_SCHLUESSEL(n.id), an ? null : heute())} letzte={i === UMWELT_NACHWEISE.length - 1} />;
              })}
            </Karte>
          </Gruppe>
        ) : null}
      </Inhalt>
      <Fuss
        ueber={
          // Fehler direkt über dem Knopf – im Inhalt läge er unter der Leiste; ohne Auswahl sagt ein Satz, warum der Knopf ruht
          fehler ? <Ansage text={fehler} farbe={f.frist} /> : gewaehlt.length ? <T v="caption" leise accessibilityLiveRegion="polite">{TEXT.kontrollmappe_auswahl(gewaehlt.length, eintraege.length)}</T> : <T v="caption" leise accessibilityLiveRegion="polite">{eintraege.length ? TEXT.r11_mappe_nichts_gewaehlt : TEXT.r11_mappe_leer_knopf}</T>
        }
      >
        <Knopf text={gewaehlt.length ? TEXT.kontrollmappe_teilen(gewaehlt.length) : TEXT.r11_mappe_teilen} symbol="square.and.arrow.up" laedt={laedt} deaktiviert={!gewaehlt.length} onPress={() => void los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}

/** Kontrollmappe öffnen – von „Heute“, „Unterlagen“ und „Mein Betrieb“ aus (R11, UX #1). */
export function useKontrollmappeOeffnen() {
  const nav = useNav();
  return () => nav.oeffnen("kontrollmappe", () => <KontrollmappeSeite />, true);
}
