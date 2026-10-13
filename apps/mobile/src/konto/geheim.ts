/** Anmeldung und Sync-Schlüssel im Schlüsselbund – nur dieses Gerät, nur entsperrt, nicht in Backups (E-134). */
import * as SecureStore from "expo-secure-store";

const OPTIONEN: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const geheimLesen = (name: string) => SecureStore.getItemAsync(name, OPTIONEN);
export const geheimSchreiben = (name: string, wert: string) => SecureStore.setItemAsync(name, wert, OPTIONEN);
export const geheimLoeschen = (name: string) => SecureStore.deleteItemAsync(name, OPTIONEN);
