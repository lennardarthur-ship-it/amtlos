/**
 * Wo eine Pflicht in Amtlos selbst erledigt wird: aus dem Aktionsziel des Katalogs (`aktion.ziel`) oder,
 * wo der Katalog noch kein Ziel nennt, aus der Pflicht-ID. Unbekannte Ziele → kein Link.
 */
const NACH_ZIEL: Record<string, string> = {
  "app.unterweisungen": "/personal/unterweisungen",
  "app.zeiterfassung": "/personal/zeiten",
  "vorlage.gefaehrdungsbeurteilung": "/personal/gefaehrdungsbeurteilungen",
  "elster.fragebogen": "/gruendung/fragebogen",
  "elster.ust_va": "/finanzen/ust",
};
const NACH_PFLICHT: Record<string, string> = {
  "arbeitsschutz.dguv_v3": "/personal/arbeitsmittel",
  "arbeitsschutz.gefahrstoffe": "/personal/gefahrstoffe",
  "personal.mutterschutz_gefaehrdungsbeurteilung": "/personal/gefaehrdungsbeurteilungen",
  "steuern.kassenmeldung": "/finanzen/kassen",
};

export function zielPfad(pflichtId: string, ziel: string | undefined | null): string | null {
  return (ziel ? NACH_ZIEL[ziel] : undefined) ?? NACH_PFLICHT[pflichtId] ?? null;
}
