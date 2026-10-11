/**
 * Rücksprungziel nach der Anmeldung: nur Pfade dieser Anwendung (kein offener Redirect).
 * Erlaubt „/einladung/abc“, verweigert „//böse.de“, „/\\böse.de“, „https://…“ und Steuerzeichen.
 */
export function sichererPfad(ziel: unknown, ersatz = "/heute"): string {
  if (typeof ziel !== "string" || ziel.length > 300) return ersatz;
  if (!/^\/(?![/\\])[A-Za-z0-9/_\-.~%?=&]*$/.test(ziel)) return ersatz;
  return ziel;
}
