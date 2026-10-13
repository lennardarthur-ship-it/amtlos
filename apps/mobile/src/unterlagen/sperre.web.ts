/** Web (Vorschau, Rundgang): keine App-Sperre. */
export async function sperreMoeglich(): Promise<boolean> {
  return false;
}
export async function entsperren(_grund: string): Promise<boolean> {
  return true;
}
