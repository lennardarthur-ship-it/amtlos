import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { ApiFehler, NetzFehler } from "../kern/api";
import { KONFIG } from "../konfig";
import { Absatz, Hinweis, Knopf, Titel } from "../ui/bausteine";
import { GROESSE, ZIEL, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";

WebBrowser.maybeCompleteAuthSession();

/** Anmeldung: in dev mit Kennung (Token von der API), sonst OIDC mit PKCE beim Identity-Provider (E-061). */
export function Anmelden() {
  const { t, klient, anmelden } = useAmtlos();
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
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 48 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: GROESSE.titel, fontWeight: "700", color: f.tinte, marginBottom: 32 }}>{t.app.name}</Text>
      <Titel>{t.anmelden.titel}</Titel>
      <Absatz>{t.mobil.anmelden_text}</Absatz>
      {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
      {KONFIG.authModus === "dev" ? (
        <View style={{ marginTop: 16 }}>
          <Hinweis text={t.mobil.anmelden_dev} />
          <Text nativeID="kennung" style={{ fontWeight: "700", color: f.tinte, marginTop: 12, fontSize: GROESSE.basis }}>
            {t.mobil.kennung}
          </Text>
          <TextInput
            accessibilityLabelledBy="kennung"
            accessibilityLabel={t.mobil.kennung}
            value={kennung}
            onChangeText={setKennung}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ minHeight: ZIEL, borderWidth: 2, borderColor: f.linie, borderRadius: 6, paddingHorizontal: 12, color: f.tinte, backgroundColor: f.blatt, fontSize: GROESSE.basis, marginVertical: 8 }}
          />
          <Knopf text={t.mobil.anmelden} onPress={dev} laedt={laedt} deaktiviert={kennung.trim().length < 2} />
        </View>
      ) : (
        <Knopf text={t.mobil.anmelden} onPress={oidc} deaktiviert={!anfrage} />
      )}
    </ScrollView>
  );
}
