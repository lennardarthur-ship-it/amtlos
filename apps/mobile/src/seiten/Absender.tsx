import { Fuss, Knopf } from "../ui/bausteine";
import { Unterseite, useNav } from "../ui/navigation";
import { T as TEXT } from "../texte";
import { BetriebFormular } from "./Betrieb";
import { Inhalt } from "./gemeinsam";

/**
 * R12: Teile von „Mein Betrieb“ mitten im Rechnungsablauf – mit „Fertig“ zurück. `bank`: Steuer und Bankverbindung
 * (UX #4: ohne IBAN kein Zahlungsweg und kein GiroCode); `gesellschaft`: Rechtsform und Register (Kfz #6, § 35a GmbHG –
 * die Rechtsform aus dem Pflichten-Check ist dort vorbelegt).
 */
export function BetriebTeilSeite({ teil }: { teil: "bank" | "gesellschaft" }) {
  const nav = useNav();
  return (
    <Unterseite titel={teil === "bank" ? TEXT.r12_bank_titel : TEXT.r12_gesellschaft_titel} unter={teil === "bank" ? TEXT.r12_bank_text : TEXT.r12_gesellschaft_text}>
      <Inhalt>
        <BetriebFormular teile={[teil === "bank" ? "steuer" : "gesellschaft"]} />
      </Inhalt>
      <Fuss>
        <Knopf text={TEXT.absender_fertig} symbol="checkmark" onPress={nav.zurueck} stil={{ flex: 1 }} />
      </Fuss>
    </Unterseite>
  );
}
