/** Web (nur Vorschau und Rundgang): kein Schlüsselbund – Anmeldung und Sync-Schlüssel liegen im Browser. */
const speicher = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const geheimLesen = async (name: string) => speicher()?.getItem(name) ?? null;
export const geheimSchreiben = async (name: string, wert: string) => {
  speicher()?.setItem(name, wert);
};
export const geheimLoeschen = async (name: string) => {
  speicher()?.removeItem(name);
};
