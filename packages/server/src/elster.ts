/**
 * ELSTER-Anbindung (Spezifikation 7, Abschnitt 3/4): einziger Weg zu ELSTER ist ein Gateway mit der ERiC-Bibliothek
 * in einem isolierten Dienst (docs/01: services/eric-gateway). Amtlos übermittelt nur im Auftrag und mit dem
 * Zertifikat der Nutzerin oder des Nutzers (Selbsthilfe, Spezifikation 8.1).
 *
 * Stand: nicht verfügbar. Es fehlen die Herstellerregistrierung bei ELSTER (ERiC-Bibliothek und Testzugang)
 * und die juristische Klärung J-1 (Verarbeitung des Nutzerzertifikats auf unserem Server). Bis dahin liefert
 * das Gateway eine klare Absage; die Oberfläche bietet Vorbereitung und den Weg über „Mein ELSTER“ an (E-086).
 */
export type ElsterVorgang = "fragebogen_steuerliche_erfassung" | "ust_voranmeldung" | "zusammenfassende_meldung" | "kassenmeldung";

export interface ElsterStatus {
  verfuegbar: boolean;
  grund?: string;
  /** Alternative, solange die direkte Übermittlung fehlt */
  alternative?: { titel: string; url: string };
}

export interface ElsterProtokoll {
  vorgang: ElsterVorgang;
  transferticket: string;
  uebermittelt_am: string;
}

export interface ElsterGateway {
  status(): ElsterStatus;
  uebermitteln(vorgang: ElsterVorgang, daten: Record<string, unknown>): Promise<ElsterProtokoll>;
}

export class ElsterNichtVerfuegbar extends Error {
  constructor(readonly status: ElsterStatus) {
    super(status.grund);
  }
}

export const MEIN_ELSTER = { titel: "Mein ELSTER", url: "https://www.elster.de/" };

export class NichtVerfuegbaresElster implements ElsterGateway {
  status(): ElsterStatus {
    return {
      verfuegbar: false,
      grund: "Die direkte Übermittlung an ELSTER ist noch nicht freigeschaltet. Dafür fehlen die Registrierung von Amtlos als Software-Hersteller bei ELSTER und eine rechtliche Klärung.",
      alternative: MEIN_ELSTER,
    };
  }
  async uebermitteln(): Promise<ElsterProtokoll> {
    throw new ElsterNichtVerfuegbar(this.status());
  }
}
