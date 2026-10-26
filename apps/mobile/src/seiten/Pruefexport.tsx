/**
 * E-200: „Daten für Betriebsprüfung exportieren“ – kostenlos, auch ohne und nach Pro (Datenzugriff, § 147 Abs. 6 AO).
 * ZIP mit Listen (CSV), Änderungsprotokoll, E-Rechnungen (XML, ausgehend und eingehend), Originalbelegen und
 * Feldbeschreibung (`unterlagen/pruefexport.ts`). Nach dem Teilen bestätigt der Nutzer, dass er die Datei gespeichert hat –
 * erst das zählt als Export (Voraussetzung für „Alle Daten löschen“ bei aufbewahrungspflichtigen Daten).
 */
import { useState } from "react";
import { View } from "react-native";
import { T as TEXT } from "../texte";
import { Fuss, Hinweis, Karte, Knopf, Schalter, T } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite, useNav } from "../ui/navigation";
import { pruefexport, pruefexportDateien } from "../unterlagen/pruefexport";
import { dateiTeilenBytes } from "../unterlagen/sicherungDatei";
import { pruefexportAktuell } from "../unterlagen/speicher";
import { gestellteRechnungen } from "../unterlagen/steuerpaket";
import { useAmtlos } from "../zustand";
import { Inhalt } from "./gemeinsam";

const gleich = () => new Promise((r) => setTimeout(r, 30));
const zeitDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Die Seite; `schliessen`: nach der Bestätigung „gespeichert“ zurück (z. B. zu „Alle Daten löschen“). */
export function PruefexportSeite({ schliessen }: { schliessen?: boolean } = {}) {
  const z = useAmtlos();
  const nav = useNav();
  const melden = useMeldung();
  const [laedt, setLaedt] = useState(false);
  const [fortschritt, setFortschritt] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);
  const [fehlend, setFehlend] = useState(0);
  const [geteilt, setGeteilt] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  const s = z.stand;
  const namen = pruefexportDateien(s);
  const los = async () => {
    setFehler(false);
    setGespeichert(false);
    setLaedt(true);
    try {
      await gleich();
      const dateien: Record<string, Uint8Array> = {};
      for (const [i, n] of namen.entries()) {
        setFortschritt(TEXT.e200_pruef_fortschritt(i + 1, namen.length));
        const b = await z.dateiLesen(n);
        if (b) dateien[n] = b;
      }
      setFortschritt(null);
      await gleich();
      const e = pruefexport(z.stand, dateien, new Date().toISOString());
      setFehlend(e.fehlend.length);
      if (!(await dateiTeilenBytes(e.dateiname, e.zip, "application/zip"))) return;
      setGeteilt(true);
      melden(TEXT.e200_pruef_fertig);
    } catch {
      setFehler(true);
    } finally {
      setLaedt(false);
      setFortschritt(null);
    }
  };
  const bestaetigt = s.pruefexport ? (pruefexportAktuell(s) ? TEXT.e200_pruef_bestaetigt(zeitDe(s.pruefexport)) : TEXT.e200_pruef_veraltet(zeitDe(s.pruefexport))) : null;
  return (
    <Unterseite titel={TEXT.e200_pruef_titel} unter={TEXT.e200_pruef_unter}>
      <Inhalt>
        <T v="klein">{TEXT.e200_pruef_text}</T>
        <Karte stil={{ marginTop: 12, paddingVertical: 12 }}>
          <T v="klein" leise>{TEXT.e200_pruef_umfang(gestellteRechnungen(s).length, s.belege.length + s.belegArchiv.length, s.kasse.length, namen.length)}</T>
        </Karte>
        <View style={{ marginTop: 12 }}>
          <Hinweis art="warnung" text={TEXT.e200_pruef_hinweis} />
          {bestaetigt && !geteilt ? <Hinweis art={pruefexportAktuell(s) ? "erfolg" : "info"} text={bestaetigt} /> : null}
          {fortschritt ? <Hinweis text={fortschritt} /> : null}
          {fehlend ? <Hinweis art="warnung" text={TEXT.e200_pruef_fehlend(fehlend)} /> : null}
          {fehler ? <Hinweis art="fehler" text={TEXT.e200_pruef_fehler} /> : null}
        </View>
        {geteilt ? (
          <View style={{ marginTop: 12 }}>
            <Schalter
              label={TEXT.e200_pruef_gespeichert}
              hilfe={TEXT.e200_pruef_gespeichert_hilfe}
              wert={gespeichert}
              aendern={(an) => {
                setGespeichert(an);
                if (!an) return;
                z.pruefexportBestaetigen();
                if (schliessen) setTimeout(() => nav.zurueck(), 400);
              }}
            />
          </View>
        ) : null}
      </Inhalt>
      <Fuss>
        <Knopf text={TEXT.e200_pruef_knopf} symbol="square.and.arrow.up" laedt={laedt} onPress={() => void los()} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}
