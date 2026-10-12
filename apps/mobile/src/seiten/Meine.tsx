import { T as TEXT } from "../texte";
import { Karte, Knopf } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { sortiert } from "../unterlagen/speicher";
import { useAmtlos } from "../zustand";
import { Formular } from "./Formular";
import { Leer, Seite } from "./gemeinsam";
import { UnterlageZeile } from "./Unterlagen";

/** Alle angelegten Unterlagen, zuletzt bearbeitete zuerst. */
export function Meine() {
  const { stand, tabWechseln } = useAmtlos();
  const nav = useNav();
  const liste = sortiert(stand);
  return (
    <Seite titel={TEXT.meine_titel}>
      {liste.length ? (
        <Karte>
          {liste.map((u, i) => (
            <UnterlageZeile key={u.id} u={u} letzte={i === liste.length - 1} onPress={() => nav.oeffnen(`formular-${u.id}`, () => <Formular id={u.id} />)} />
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
