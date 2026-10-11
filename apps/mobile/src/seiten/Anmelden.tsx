import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { ApiFehler, NetzFehler } from "../kern/api";
import { KONFIG } from "../konfig";
import { Hinweis, Knopf, T } from "../ui/bausteine";
import { RADIUS, RAND, SCHRIFT, ZIEL, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";

WebBrowser.maybeCompleteAuthSession();

/** Anmeldung: in dev mit Kennung (Token von der API), sonst OIDC mit PKCE beim Identity-Provider (E-061). */
export function Anmelden() {
  const { t, klient, anmelden, demoStarten } = useAmtlos();
  const f = useFarben();
  const [kennung, setKennung] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const discovery = AuthSession.useAutoDiscovery(KONFIG.oidcIssuer ?? "https://invalid.example");
  const [anfrage, , starten] = AuthSession.useAuthRequest(
    { clientId: KONFIG.oidcClientId ?? "", scopes: ["openid", "profile", "email", "offline_access"], redirectUri: AuthSession.makeRedirectUri({ scheme: "amtlos", path: "anmelden" }), usePKCE: true },
    discovery,
  );

  async function dev() {
    setLaedt(true);
    setFehler(null);
    try {
      await anmelden((await klient.devToken(kennung)).token);
    } catch (e) {
      setFehler(e instanceof NetzFehler ? t.mobil.fehler_netz : e instanceof ApiFehler ? e.message : String(e));
    } finally {
      setLaedt(false);
    }
  }

  async function oidc() {
    setFehler(null);
    const r = await starten();
    if (r.type !== "success" || !discovery || !anfrage) return;
    try {
      const tokens = await AuthSession.exchangeCodeAsync(
        { clientId: KONFIG.oidcClientId ?? "", code: r.params.code ?? "", redirectUri: anfrage.redirectUri, extraParams: { code_verifier: anfrage.codeVerifier ?? "" } },
        discovery,
      );
      await anmelden(tokens.accessToken);
    } catch (e) {
      setFehler(String(e));
    }
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: RAND, paddingTop: 72, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: f.amt, alignItems: "center", justifyContent: "center", marginBottom: 28 }} accessibilityElementsHidden>
        <Text style={{ fontFamily: SCHRIFT.bold, fontSize: 30, color: "#ffffff" }}>A</Text>
      </View>
      <T v="grossTitel" accessibilityRole="header">{t.app.name}</T>
      <T leise stil={{ marginTop: 8, maxWidth: 360 }}>{t.mobil.anmelden_text}</T>
      {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
      {KONFIG.authModus === "demo" ? null : KONFIG.authModus === "dev" ? (
        <View style={{ marginTop: 28 }}>
          <Hinweis text={t.mobil.anmelden_dev} />
          <T v="klein" fett nativeID="kennung" stil={{ marginTop: 12 }}>{t.mobil.kennung}</T>
          <TextInput
            accessibilityLabelledBy="kennung"
            accessibilityLabel={t.mobil.kennung}
            value={kennung}
            onChangeText={setKennung}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => kennung.trim().length >= 2 && void dev()}
            style={{ minHeight: ZIEL, borderWidth: 1.5, borderColor: f.linie, borderRadius: RADIUS.klein, paddingHorizontal: 14, color: f.tinte, backgroundColor: f.blatt, fontFamily: SCHRIFT.regular, fontSize: 17, marginTop: 6, marginBottom: 14 }}
          />
          <Knopf text={t.mobil.anmelden} onPress={dev} laedt={laedt} deaktiviert={kennung.trim().length < 2} />
        </View>
      ) : (
        <Knopf text={t.mobil.anmelden} onPress={oidc} deaktiviert={!anfrage} stil={{ marginTop: 28 }} />
      )}
      {KONFIG.authModus === "demo" ? (
        <View style={{ height: 28 }} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 28, marginBottom: 16 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={{ flex: 1, height: 1, backgroundColor: f.linie }} />
          <T v="caption" leise>{t.mobil.oder}</T>
          <View style={{ flex: 1, height: 1, backgroundColor: f.linie }} />
        </View>
      )}
      <Knopf leise={KONFIG.authModus !== "demo"} text={t.mobil.demo_starten} symbol="sparkles" onPress={() => void demoStarten()} />
      <T v="caption" leise stil={{ marginTop: 8, textAlign: "center" }}>{t.mobil.demo_text}</T>
    </ScrollView>
  );
}
