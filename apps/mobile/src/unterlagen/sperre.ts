/** App-Sperre (E-129): Öffnen nur nach Face ID, Touch ID oder Gerätecode. */
import * as LocalAuthentication from "expo-local-authentication";

export async function sperreMoeglich(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function entsperren(grund: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: grund, cancelLabel: "Abbrechen", disableDeviceFallback: false });
    return r.success;
  } catch {
    return false;
  }
}
