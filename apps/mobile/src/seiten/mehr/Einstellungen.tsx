import { useEffect, useState } from "react";
import { Modal, Share } from "react-native";
import { fuelle, sichtbareSchritte } from "@amtlos/i18n";
import type { Erinnerungen } from "../../kern/typen";
import { Feld, Hinweis, Karte, Knopf, Schalter, Zeile } from "../../ui/bausteine";
import { Unterseite } from "../../ui/navigation";
import { useAmtlos } from "../../zustand";
import { Gruppe, Inhalt, useAktion, useLaden } from "../gemeinsam";
import { Schnellstart } from "../Schnellstart";

/** Einstellungen: Angaben zum Unternehmen (jeder Schritt einzeln), Erinnerungen, Datenexport, Unternehmen löschen. */
export function Einstellungen() {
  const { t, sprache, klient, unternehmenId, ich, abmelden, demo } = useAmtlos();
  const { daten, neu } = useLaden(async () => {
    const [profil, erinnerungen] = await Promise.all([klient.profil(), klient.holen<Erinnerungen>("/v1/benachrichtigungen/einstellungen")]);
    return { profil: profil.daten ?? {}, erinnerungen };
  }, [unternehmenId]);
  const [schritt, setSchritt] = useState<string | null>(null);
  const [kanaele, setKanaele] = useState<Erinnerungen["kanaele"]>([]);
  const [vorlauf, setVorlauf] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!daten) return;
    setKanaele(daten.erinnerungen.kanaele);
    setVorlauf(Object.fromEntries(daten.erinnerungen.kanaele.map((k) => [k.kanal, k.vorlauf_tage.join(", ")])));
  }, [daten]);
  const [loeschName, setLoeschName] = useState("");
  const aktion = useAktion();
  const loeschen = useAktion();
  const name = ich?.unternehmen.find((u) => u.id === unternehmenId)?.name ?? "";
  const kanalText = t.einstellungen.kanal as Record<string, string>;

  return (
    <Unterseite titel={t.einstellungen.titel}>
      <Inhalt>
        <Gruppe titel={t.einstellungen.profil} fuss={t.einstellungen.profil_text}>
          <Karte>
            {sichtbareSchritte(daten?.profil ?? {}).map((s, i, alle) => (
              <Zeile key={s.id} titel={s.titel[sprache]} onPress={() => setSchritt(s.id)} letzte={i === alle.length - 1} />
            ))}
          </Karte>
        </Gruppe>

        <Gruppe titel={t.einstellungen.erinnerungen} fuss={t.einstellungen.erinnerungen_text}>
          {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
          {aktion.meldung ? <Hinweis art="erfolg" text={aktion.meldung} /> : null}
          <Karte stil={{ paddingBottom: 14 }}>
            {kanaele.map((k) => (
              <Schalter
                key={k.kanal}
                label={kanalText[k.kanal] ?? k.kanal}
                hilfe={k.kanal === "push" && !daten?.erinnerungen.geraet_vorhanden ? (demo ? t.mobil.demo_push : t.mobil.push_hier) : undefined}
                wert={k.aktiv}
                aendern={(w) => setKanaele((x) => x.map((y) => (y.kanal === k.kanal ? { ...y, aktiv: w } : y)))}
              />
            ))}
            {kanaele.map((k) => (
              <Feld key={`v-${k.kanal}`} label={`${t.einstellungen.vorlauf} (${kanalText[k.kanal]})`} hilfe={t.einstellungen.vorlauf_hilfe} wert={vorlauf[k.kanal] ?? ""} aendern={(w) => setVorlauf((x) => ({ ...x, [k.kanal]: w }))} keyboardType="numbers-and-punctuation" />
            ))}
            <Knopf
              text={t.einstellungen.erinnerungen_speichern}
              laedt={aktion.laedt}
              onPress={() =>
                void aktion.ausfuehren(async () => {
                  const tage = (x: string) => [...new Set(x.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 90))].slice(0, 5);
                  await klient.schicken("/v1/benachrichtigungen/einstellungen", "PUT", { kanaele: kanaele.map((k) => ({ kanal: k.kanal, aktiv: k.aktiv, vorlauf_tage: tage(vorlauf[k.kanal] ?? "") })) });
                  await neu();
                }, t.einstellungen.gespeichert)
              }
              stil={{ marginTop: 16 }}
            />
          </Karte>
        </Gruppe>

        <Gruppe titel={t.loeschen.titel} fuss={t.loeschen.export_text}>
          <Knopf
            leise
            text={t.loeschen.export}
            symbol="square.and.arrow.up"
            onPress={() => void aktion.ausfuehren(async () => { const d = await klient.holen<unknown>("/v1/export"); await Share.share({ message: JSON.stringify(d, null, 2) }); })}
          />
        </Gruppe>

        <Gruppe titel={t.loeschen.unternehmen_titel} fuss={t.loeschen.unternehmen_text}>
          {loeschen.fehler ? <Hinweis art="fehler" text={loeschen.fehler} /> : null}
          <Karte stil={{ paddingBottom: 14 }}>
            <Feld label={fuelle(t.loeschen.unternehmen_bestaetigen, { name })} wert={loeschName} aendern={setLoeschName} autoCapitalize="none" />
            <Knopf
              gefahr
              text={t.loeschen.unternehmen_knopf}
              deaktiviert={loeschName !== name}
              laedt={loeschen.laedt}
              onPress={() => void loeschen.ausfuehren(async () => { await klient.schicken("/v1/unternehmen", "DELETE", { name: loeschName }); await abmelden(); })}
              stil={{ marginTop: 14 }}
            />
          </Karte>
        </Gruppe>
      </Inhalt>
      <Modal visible={Boolean(schritt)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSchritt(null)}>
        {schritt && daten ? <Schnellstart phase="alle" nurSchritt={schritt} profilStart={daten.profil} abbrechen={() => setSchritt(null)} fertig={() => { setSchritt(null); void neu(); }} /> : null}
      </Modal>
    </Unterseite>
  );
}
