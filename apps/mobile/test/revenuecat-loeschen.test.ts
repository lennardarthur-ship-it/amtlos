import { describe, expect, it } from "vitest";
// @ts-expect-error – reines ESM-Werkzeug ohne Typen (werkzeuge/revenuecat-loeschen.mjs)
import { csvLesen, faellig } from "../../../werkzeuge/revenuecat-loeschen.mjs";

describe("Löschfrist bei RevenueCat (E-159)", () => {
  const csv = 'rc_original_app_user_id,effective_end_time,product\n"a","2026-01-01T00:00:00Z",jahr\nb,2026-09-01T00:00:00Z,monat\nc,,jahr\nc,2025-01-01T00:00:00Z,monat\n"d, mit Komma","2026-06-01T00:00:00Z","x ""y"""\na,2026-02-01T00:00:00Z,monat\n';
  it("liest CSV mit Anführungszeichen", () => {
    const z = csvLesen(csv);
    expect(z).toHaveLength(6);
    expect(z[4].rc_original_app_user_id).toBe("d, mit Komma");
  });
  it("löscht nur Kennungen, deren letztes Abo-Ende mehr als 90 Tage zurückliegt – nie laufende", () => {
    expect(faellig(csvLesen(csv), new Date("2026-10-21T00:00:00Z"))).toEqual(["a", "d, mit Komma"]);
  });
});
