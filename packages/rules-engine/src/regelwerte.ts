import { vergleiche, type Datum } from "@amtlos/fristen";
import type { RegelwertVersion } from "./typen.js";

export interface AufgeloesterRegelwert {
  id: string;
  version: number;
  wert: number;
}

/** Index der Regelwerte; liefert je ID die Version, die zum Stichtag gilt. */
export class Regelwerte {
  private readonly nachId = new Map<string, RegelwertVersion[]>();

  constructor(versionen: readonly RegelwertVersion[]) {
    for (const v of versionen) {
      const liste = this.nachId.get(v.id) ?? [];
      liste.push(v);
      this.nachId.set(v.id, liste);
    }
  }

  /** undefined, wenn zum Stichtag keine Version gilt (→ Vergleich wird "unbekannt"). */
  zumStichtag(id: string, stichtag: Datum): AufgeloesterRegelwert | undefined {
    const treffer = (this.nachId.get(id) ?? []).filter(
      (v) => vergleiche(v.gueltig_ab, stichtag) <= 0 && (v.gueltig_bis == null || vergleiche(stichtag, v.gueltig_bis) <= 0),
    );
    if (treffer.length > 1) {
      // Datenbank und Validator verhindern das; hier hart abbrechen statt zu raten.
      throw new Error(`Regelwert ${id}: ${treffer.length} Versionen gelten gleichzeitig am ${stichtag}`);
    }
    const v = treffer[0];
    return v ? { id: v.id, version: v.version, wert: v.wert } : undefined;
  }
}
