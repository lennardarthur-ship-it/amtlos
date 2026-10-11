import { Absatz, Hinweis, Titel } from "../ui/bausteine";
import { useAmtlos } from "../zustand";
import { Seite, useLaden } from "./gemeinsam";
import { PflichtKarte } from "./Heute";

const OFFEN = new Set(["offen", "faellig_bald", "ueberfaellig", "angabe_fehlt"]);

export function Pflichten() {
  const { t, klient, unternehmenId } = useAmtlos();
  const { daten, fehler, laedt, neu } = useLaden(() => klient.pflichten(), [unternehmenId]);
  const offen = (daten ?? []).filter((k) => OFFEN.has(k.status));
  return (
    <Seite laedt={laedt} neu={neu}>
      <Titel>{t.pflichten.titel}</Titel>
      <Absatz leise>{t.mobil.alle_pflichten_web}</Absatz>
      {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
      {daten && !offen.length ? <Absatz>{t.mobil.nichts_offen}</Absatz> : null}
      {offen.map((k) => (
        <PflichtKarte key={`${k.pflicht_id}|${k.periode}`} k={k} />
      ))}
    </Seite>
  );
}
