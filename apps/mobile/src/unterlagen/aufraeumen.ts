/**
 * Zwischendateien wegräumen (E-143): PDFs, Fotos und gewählte Dateien landen beim Erzeugen im Cache der App. Dort
 * lägen Kundendaten, IBAN und Belegfotos unverschlüsselt und überlebten „Alle Daten löschen“. Gelöscht wird nur, was
 * im Cache der App liegt – nie eine Datei an einem anderen Ort.
 */
import { File, Paths } from "expo-file-system";

/** Eine Datei im Cache löschen (stille Fehler: schon weg oder nicht unsere). */
export function cacheDateiLoeschen(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    // iOS meldet denselben Ordner mal mit, mal ohne „/private“ – beide Schreibweisen vergleichen
    const pfad = (u: string) => decodeURI(u).replace(/^file:\/\//, "").replace(/^\/private(?=\/var\/)/, "");
    if (!pfad(uri).startsWith(pfad(Paths.cache.uri))) return;
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* schon weg */
  }
}

/** Alles im Cache der App löschen (bei „Alle Daten löschen“). */
export function cacheLeeren(): void {
  try {
    for (const e of Paths.cache.list()) {
      try {
        e.delete();
      } catch {
        /* in Benutzung */
      }
    }
  } catch {
    /* kein Cache */
  }
}

