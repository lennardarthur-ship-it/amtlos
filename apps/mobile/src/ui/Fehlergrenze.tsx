import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { Platform, ScrollView, Share, View } from "react-native";
import { T as TEXT } from "../texte";
import { APP_VERSION } from "../version";
import { fehlerbericht } from "./fehlerbericht";
import { Kachel, Knopf, T, TextKnopf } from "./bausteine";
import { useFarben } from "./thema";

interface Props {
  children: ReactNode;
  /**
   * Hook: ist der Stand sicher gespeichert? Nur die Grenze innerhalb von `AmtlosAnbieter` kann das sagen (der Anbieter
   * bleibt bestehen und speichert die letzte Änderung nach 300 ms bzw. beim Wechsel in den Hintergrund). Ohne ihn sagt
   * die Seite nur, dass gespeicherte Daten erhalten bleiben.
   */
  useGespeichert?: () => boolean;
}
interface Zustand {
  fehler: unknown;
  komponenten: string | null;
  /** neuer Schlüssel = Inhalt neu aufbauen (kein expo-updates im Projekt, daher Remount statt reloadAsync) */
  runde: number;
}

/**
 * Fehlergrenze (Code-Due-Diligence): fängt Abstürze beim Zeichnen ab und zeigt statt eines weißen Bildschirms eine
 * ruhige Seite mit „Neu laden“ und „Fehlerbericht teilen“. Kein Crash-SDK (Gründer-Entscheidung).
 */
export class Fehlergrenze extends Component<Props, Zustand> {
  state: Zustand = { fehler: null, komponenten: null, runde: 0 };

  static getDerivedStateFromError(fehler: unknown): Partial<Zustand> {
    return { fehler: fehler ?? new Error("Unbekannter Fehler") };
  }

  componentDidCatch(_fehler: unknown, info: ErrorInfo) {
    this.setState({ komponenten: info.componentStack ?? null });
  }

  neuLaden = () => this.setState((s) => ({ fehler: null, komponenten: null, runde: s.runde + 1 }));

  render() {
    if (this.state.fehler) return <FehlerSeite fehler={this.state.fehler} komponenten={this.state.komponenten} neuLaden={this.neuLaden} useGespeichert={this.props.useGespeichert ?? nieGemeldet} />;
    return <Fragment key={this.state.runde}>{this.props.children}</Fragment>;
  }
}

const nieGemeldet = () => false;

function FehlerSeite({ fehler, komponenten, neuLaden, useGespeichert }: { fehler: unknown; komponenten: string | null; neuLaden: () => void; useGespeichert: () => boolean }) {
  const f = useFarben();
  const gespeichert = useGespeichert();
  const teilen = () => {
    const message = fehlerbericht(fehler, komponenten, { version: APP_VERSION, plattform: `${Platform.OS} ${String(Platform.Version)}`, zeit: new Date() });
    void Share.share({ message, title: TEXT.fehler_bericht_betreff }).catch(() => undefined);
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: f.papier }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 28, paddingVertical: 64, gap: 14 }}>
      <View style={{ alignItems: "center", gap: 14 }}>
        <Kachel symbol="exclamationmark.triangle" ton="frist" groesse={64} />
        <T v="titel" accessibilityRole="header" stil={{ textAlign: "center", marginTop: 6 }}>{TEXT.fehler_titel}</T>
        <T leise stil={{ textAlign: "center" }}>{gespeichert ? TEXT.fehler_text_gespeichert : TEXT.fehler_text}</T>
      </View>
      <Knopf text={TEXT.fehler_neu_laden} symbol="arrow.clockwise" onPress={neuLaden} stil={{ marginTop: 12 }} />
      <TextKnopf symbol="square.and.arrow.up" text={TEXT.fehler_bericht_teilen} onPress={teilen} />
      <T v="caption" leise stil={{ textAlign: "center" }}>{TEXT.fehler_bericht_hinweis}</T>
    </ScrollView>
  );
}
