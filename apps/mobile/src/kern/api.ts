/**
 * API-Client der App (ohne React-Native-Abhängigkeiten, damit testbar). Schickt Token, Unternehmen und Sprache
 * mit – wie die Web-App. Netzfehler werden als NetzFehler gemeldet (Offline-Warteschlange), API-Fehler als ApiFehler.
 */
export type Sprache = "de" | "en";
export type Abruf = (url: string, init: { method: string; headers: Record<string, string>; body?: string | FormData }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class NetzFehler extends Error {}
export class ApiFehler extends Error {
  constructor(
    readonly status: number,
    meldung: string,
  ) {
    super(meldung);
  }
}

export interface Ich { konto: { id: string; email: string; anzeigename: string; sprache: Sprache }; unternehmen: { id: string; name: string; rolle: string }[] }
export interface Karte { pflicht_id: string; periode: string; titel: string; kurz: string; status: string; ergebnis?: "gilt" | "gilt_nicht" | "unbekannt"; faellig_am: string | null; kategorie?: string; bereich?: string }
export interface KartenDetail extends Karte {
  erklaerung: string;
  warum: string[];
  sanktion: { text: string; schwere: string };
  stelle: string;
  rechtsgrundlage: string[];
  quellen: { titel: string; url: string }[];
  begriffe: { begriff: string; erklaerung: string }[];
  erledigt_am?: string | null;
  fehlende_fakten: string[];
  pruefung: { status: string; geprueft_am: string | null };
  ungeprueft?: boolean;
}
export interface Profil { version: number; daten: Record<string, unknown> }
export interface Heute { als_naechstes: Karte[]; zaehler: { offen: number; ueberfaellig: number; angabe_fehlt: number; erledigt: number; klar: number; naechste_90: number }; ampel: Record<string, "gruen" | "gelb" | "rot"> }
export interface Beschaeftigter { id: string; vorname: string; nachname: string; austritt: string | null }
export interface Zeiteintrag { id: string; beschaeftigter_id: string; beginn: string; ende: string | null; offline?: boolean }

export interface KlientEinstellungen {
  basis: string;
  token: () => Promise<string | null>;
  unternehmen: () => string | null;
  sprache: () => Sprache;
  abruf?: Abruf;
}

export class ApiKlient {
  private readonly abruf: Abruf;
  constructor(private readonly e: KlientEinstellungen) {
    // Nicht die Funktion selbst übergeben: im Browser braucht fetch sein globales this
    this.abruf = e.abruf ?? ((url, init) => fetch(url, init as RequestInit) as unknown as ReturnType<Abruf>);
  }

  /** mitUnternehmen: true = aktuelles Unternehmen, false = keins, string = genau dieses (Offline-Stempel). */
  async anfrage<T>(pfad: string, methode = "GET", koerper?: unknown, mitUnternehmen: boolean | string = true): Promise<T> {
    const kopf: Record<string, string> = { Accept: "application/json", "X-Sprache": this.e.sprache() };
    const token = await this.e.token();
    if (token) kopf.Authorization = `Bearer ${token}`;
    const u = typeof mitUnternehmen === "string" ? mitUnternehmen : mitUnternehmen ? this.e.unternehmen() : null;
    if (u) kopf["X-Unternehmen-Id"] = u;
    let body: string | FormData | undefined;
    if (koerper instanceof FormData) body = koerper;
    else if (koerper !== undefined) {
      kopf["Content-Type"] = "application/json";
      body = JSON.stringify(koerper);
    }
    let r: Awaited<ReturnType<Abruf>>;
    try {
      r = await this.abruf(`${this.e.basis}${pfad}`, { method: methode, headers: kopf, body });
    } catch (e) {
      throw new NetzFehler((e as Error).message);
    }
    if (r.status === 204) return undefined as T;
    const j = (await r.json().catch(() => ({}))) as { meldung?: string; message?: string | string[]; fehler?: { meldung: string }[] };
    if (!r.ok) throw new ApiFehler(r.status, j.fehler?.map((f) => f.meldung).join("; ") ?? j.meldung ?? (Array.isArray(j.message) ? j.message.join("; ") : j.message) ?? `Fehler ${r.status}`);
    return j as T;
  }

  devToken(kennung: string) {
    return this.anfrage<{ token: string }>("/v1/dev/token", "POST", { kennung }, false);
  }
  ich() {
    return this.anfrage<Ich>("/v1/ich", "GET", undefined, false);
  }
  heute() {
    return this.anfrage<Heute>("/v1/heute");
  }
  pflichten(status = "alle") {
    return this.anfrage<Karte[]>(`/v1/pflichten?status=${status}`);
  }
  pflicht(id: string, periode: string) {
    return this.anfrage<KartenDetail>(`/v1/pflichten/${encodeURIComponent(id)}/${encodeURIComponent(periode)}`);
  }
  erledigen(id: string, periode: string, notiz?: string) {
    return this.anfrage<unknown>(`/v1/pflichten/${encodeURIComponent(id)}/${encodeURIComponent(periode)}/erledigen`, "POST", notiz ? { notiz } : {});
  }
  wiederOeffnen(id: string, periode: string) {
    return this.anfrage<unknown>(`/v1/pflichten/${encodeURIComponent(id)}/${encodeURIComponent(periode)}/wieder-oeffnen`, "POST");
  }
  profil() {
    return this.anfrage<Profil>("/v1/profil");
  }
  profilSpeichern(daten: Record<string, unknown>) {
    return this.anfrage<Profil>("/v1/profil", "PUT", { daten });
  }
  unternehmenAnlegen(name: string) {
    return this.anfrage<{ id: string; name: string; rolle: string }>("/v1/unternehmen", "POST", { name }, false);
  }
  abo() {
    return this.anfrage<{ status: string; test_bis: string; laeuft_bis: string | null; schreibbar: boolean }>("/v1/abo");
  }
  beschaeftigte() {
    return this.anfrage<Beschaeftigter[]>("/v1/beschaeftigte");
  }
  /** Laufende Stempel (für die Anzeige „läuft seit“). */
  async laufend(monat: string) {
    return (await this.anfrage<{ laufend: { beschaeftigter_id: string; beginn: string }[] }>(`/v1/zeiten?monat=${monat}`)).laufend;
  }
  kommen(d: { beschaeftigter_id: string; client_id: string; zeitpunkt?: string }, unternehmenId?: string) {
    return this.anfrage<Zeiteintrag>("/v1/zeiten/kommen", "POST", d, unternehmenId ?? true);
  }
  gehen(d: { beschaeftigter_id: string; client_id: string; zeitpunkt?: string; pause_minuten: number }, unternehmenId?: string) {
    return this.anfrage<Zeiteintrag>("/v1/zeiten/gehen", "POST", d, unternehmenId ?? true);
  }
  belegHochladen(datei: FormData) {
    return this.anfrage<{ id: string }>("/v1/belege", "POST", datei);
  }
  geraetRegistrieren(d: { push_token: string; plattform: "ios" | "android"; name: string }) {
    return this.anfrage<{ id: string }>("/v1/geraete", "POST", d, false);
  }
  geraetAbmelden(id: string) {
    return this.anfrage<void>(`/v1/geraete/${id}`, "DELETE", undefined, false);
  }
}
