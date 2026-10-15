import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from "@expo-google-fonts/inter";

/** Web-Vorschau: Inter (OFL 1.1) als Ersatz für SF Pro, damit Rundgänge und Store-Bilder der App auf dem iPhone ähneln. */
export function useSchrift(): boolean {
  const [da] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  return da;
}
