import { T as TEXT } from "../texte";
import { Karte, Knopf } from "../ui/bausteine";
import { sortiert } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Leer, Seite } from "./gemeinsam";
import { useOeffnen } from "./starten";
import { UnterlageZeile } from "./Unterlagen";

/** Alle angelegten Unterlagen, zuletzt bearbeitete zuerst. Antippen öffnet den Abschluss mit Vorschau. */
export function Meine() {
  const { stand, tabWechseln } = useAmtlos();
  const oeffnen = useOeffnen();
  const liste = sortiert(stand);
  return (
    <Seite titel={TEXT.meine_titel}>
      {liste.length ? (
        <Karte>
          {liste.map((u, i) => (
            <UnterlageZeile key={u.id} u={u} letzte={i === liste.length - 1} onPress={() => oeffnen(u.id)} />
          ))}
        </Karte>
      ) : (
        <Leer text={TEXT.meine_leer}>
          <Knopf text={TEXT.zu_den_unterlagen} onPress={() => tabWechseln("unterlagen")} />
        </Leer>
      )}
    </Seite>
  );
}
