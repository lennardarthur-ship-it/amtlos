import { minusDauer, type Datum } from "@amtlos/fristen";
import type { Datenbank, Tx } from "./datenbank.js";
import { heute } from "./berechnung.js";
import { ladeAktivenKatalog } from "./katalog.js";
import { MARKE } from "@amtlos/marke";

const STANDARD_VORLAUF = ["P14D", "P3D"];
const UHRZEIT = 8; // 08:00 Ortszeit

/** Zeitpunkt „Datum, Stunde“ in einer Zeitzone als absoluter Zeitpunkt (robust gegen Sommerzeit). */
export function zeitpunktInZone(d: Datum, stunde: number, zone = "Europe/Berlin"): Date {
  const [y, m, t] = d.split("-").map(Number) as [number, number, number];
  const utc = Date.UTC(y, m - 1, t, stunde);
  const teile = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(utc));
  const teil = (typ: string) => Number(teile.find((p) => p.type === typ)!.value);
  const lokalAlsUtc = Date.UTC(teil("year"), teil("month") - 1, teil("day"), teil("hour"), teil("minute"));
  return new Date(utc - (lokalAlsUtc - utc));
}

/** Pg-Intervall wie '14 days' in ISO-Dauer P14D (nur Tage, wie in benachrichtigung_einstellung.vorlauf). */
function intervallZuDauer(i: string | { days?: number }): string {
  if (typeof i === "object") return `P${i.days ?? 0}D`;
  const m = /^(\d+) days?$/.exec(i);
  return m ? `P${m[1]}D` : "P0D";
}

/**
 * Plant die Erinnerungen eines Unternehmens neu: Soll-Menge aus den offenen Pflichten mit Datum; nicht mehr passende
 * geplante Erinnerungen werden gelöscht, neue eingefügt, unveränderte bleiben stehen. Empfänger: Inhaber und Admins.
 */
export async function planeErinnerungen(tx: Tx, unternehmenId: string, stichtag: Datum = heute()): Promise<number> {
  const aktiv = await ladeAktivenKatalog(tx);
  if (!aktiv) {
    await tx.abfrage("delete from app.erinnerung where unternehmen_id = $1 and status = 'geplant'", [unternehmenId]);
    return 0;
  }
  const vorlaufJePflicht = new Map(aktiv.katalog.pflichten.map((p) => [p.id, ("erinnerung" in p.frist && p.frist.erinnerung) || undefined]));

  const instanzen = await tx.abfrage<{ id: string; pflicht_id: string; faellig_am: Datum }>(
    `select id, pflicht_id, faellig_am from app.pflicht_instanz
      where unternehmen_id = $1 and status = 'offen' and faellig_am is not null and faellig_am >= $2`,
    [unternehmenId, stichtag],
  );
  const empfaenger = await tx.abfrage<{ konto_id: string }>(
    "select konto_id from app.mitgliedschaft where unternehmen_id = $1 and rolle in ('inhaber','admin')",
    [unternehmenId],
  );
  const einstellungen = await tx.abfrage<{ konto_id: string; kanal: string; aktiv: boolean; vorlauf: unknown[] }>(
    "select konto_id, kanal, aktiv, vorlauf from app.benachrichtigung_einstellung where unternehmen_id = $1",
    [unternehmenId],
  );
  // Konten mit registriertem Gerät bekommen ohne eigene Einstellung zusätzlich Push (E-108)
  const mitGeraet = new Set(
    (await tx.abfrage<{ konto_id: string }>("select distinct konto_id from app.geraet where aktiv and konto_id = any($1)", [empfaenger.map((e) => e.konto_id)])).map((g) => g.konto_id),
  );
  // Bisherige Erinnerungen in einer Abfrage: gesendete (für „nur einmal sofort erinnern“) und geplante
  // (Sofort-Erinnerungen behalten ihren Zeitpunkt, sonst würde jede Neuplanung sie verschieben)
  const gesendet = new Set<string>();
  const geplant = new Map<string, string>();
  for (const g of await tx.abfrage<{ s: string; status: string; geplant_fuer: Date }>(
    "select pflicht_instanz_id || '|' || konto_id || '|' || kanal as s, status, geplant_fuer from app.erinnerung where unternehmen_id = $1 and status in ('gesendet', 'in_versand', 'geplant')",
    [unternehmenId],
  )) {
    if (g.status !== "geplant") gesendet.add(g.s); // im Versand zählt wie gesendet (keine zweite Sofort-Erinnerung)
    else if (!geplant.has(g.s) || g.geplant_fuer.toISOString() < geplant.get(g.s)!) geplant.set(g.s, g.geplant_fuer.toISOString());
  }

  const jetzt = Date.now();
  const soll: { pflicht_instanz_id: string; konto_id: string; kanal: string; geplant_fuer: string }[] = [];
  for (const { konto_id } of empfaenger) {
    const eigene = einstellungen.filter((e) => e.konto_id === konto_id);
    const standard = [{ kanal: "email", vorlauf: undefined as unknown[] | undefined }, ...(mitGeraet.has(konto_id) ? [{ kanal: "push", vorlauf: undefined as unknown[] | undefined }] : [])];
    const kanaele = eigene.length ? eigene.filter((e) => e.aktiv && (e.kanal !== "push" || mitGeraet.has(konto_id))) : standard;
    for (const k of kanaele) {
      for (const i of instanzen) {
        const vorlauf = vorlaufJePflicht.get(i.pflicht_id) ?? (k.vorlauf?.length ? k.vorlauf.map((v) => intervallZuDauer(v as string)) : STANDARD_VORLAUF);
        const zeitpunkte = [...new Set(vorlauf)].map((v) => zeitpunktInZone(minusDauer(i.faellig_am, v), UHRZEIT)).filter((z) => z.getTime() > jetzt);
        // Frist so nah, dass alle Vorlauf-Zeitpunkte vorbei sind: einmal sofort erinnern – aber nur, wenn für diese
        // Pflicht noch keine Erinnerung an diese Person über diesen Kanal hinausging.
        const schluessel = `${i.id}|${konto_id}|${k.kanal}`;
        if (!zeitpunkte.length && !gesendet.has(schluessel)) zeitpunkte.push(new Date(geplant.get(schluessel) ?? jetzt + 60_000));
        for (const z of zeitpunkte) soll.push({ pflicht_instanz_id: i.id, konto_id, kanal: k.kanal, geplant_fuer: z.toISOString() });
      }
    }
  }

  // Nur Unterschiede schreiben (Lasttest E-109): Überholtes löschen, Neues einfügen, Gleiches stehen lassen
  const json = JSON.stringify(soll);
  await tx.abfrage(
    `delete from app.erinnerung e where e.unternehmen_id = $1 and e.status = 'geplant' and e.versuche = 0
       and not exists (select 1 from jsonb_to_recordset($2::jsonb) as s(pflicht_instanz_id uuid, konto_id uuid, kanal text, geplant_fuer timestamptz)
                        where s.pflicht_instanz_id = e.pflicht_instanz_id and s.konto_id = e.konto_id and s.kanal = e.kanal and s.geplant_fuer = e.geplant_fuer)`,
    [unternehmenId, json],
  );
  await tx.abfrage(
    `insert into app.erinnerung (unternehmen_id, pflicht_instanz_id, konto_id, kanal, geplant_fuer)
     select $1, s.pflicht_instanz_id, s.konto_id, s.kanal, s.geplant_fuer
       from jsonb_to_recordset($2::jsonb) as s(pflicht_instanz_id uuid, konto_id uuid, kanal text, geplant_fuer timestamptz)
     on conflict do nothing`,
    [unternehmenId, json],
  );
  return soll.length;
}

export interface Nachricht {
  an: string;
  betreff: string;
  text: string;
}

/** Push an die Geräte eines Kontos. Rückgabe: Tokens, die der Dienst als ungültig meldet (werden abgemeldet). */
export interface PushNachricht {
  tokens: string[];
  titel: string;
  text: string;
  /** Ziel in der App, z. B. /pflichten/… */
  link: string;
}

/** Versandweg. Konkreter Anbieter (EU, AVV) wird vor Livegang gewählt; bis dahin Protokoll oder SMTP. */
export interface Versand {
  email(n: Nachricht): Promise<void>;
  /** Ohne Push-Anbieter fehlt die Methode: Push-Erinnerungen werden dann verworfen. */
  push?(n: PushNachricht): Promise<{ ungueltig: string[] }>;
}

export class ProtokollVersand implements Versand {
  readonly gesendet: Nachricht[] = [];
  readonly pushes: PushNachricht[] = [];
  async email(n: Nachricht): Promise<void> {
    this.gesendet.push(n);
  }
  async push(n: PushNachricht): Promise<{ ungueltig: string[] }> {
    this.pushes.push(n);
    return { ungueltig: n.tokens.filter((t) => t.includes("UNGUELTIG")) };
  }
}

/** Höchstens so viele Versuche je Erinnerung; Abstand 5, 10, 20, 40 Minuten … (M10) */
export const MAX_VERSUCHE = 5;
const abstandMinuten = (versuch: number) => 5 * 2 ** Math.max(0, versuch - 1);

interface Vorgemerkt {
  id: string; kanal: string; konto_id: string; email: string; sprache: string; faellig_am: Datum;
  titel: { de: string; en?: string }; pflicht_id: string; periode: string; versuche: number;
}

/**
 * Versendet fällige Erinnerungen (M10). Je Unternehmen in drei Schritten, damit nichts doppelt oder gar nicht ankommt:
 * 1. vormerken: Status „in_versand“ setzen und committen (eine zweite Instanz überspringt diese Zeilen),
 * 2. senden – außerhalb jeder Transaktion; ein Rollback kann keine schon verschickte Mail mehr „zurücknehmen“,
 * 3. Ergebnis je Erinnerung festhalten: gesendet, oder nach einem Fehler erneut „geplant“ mit wachsendem Abstand
 *    (nach MAX_VERSUCHE endgültig „fehler“). Bleibt eine Zeile in Schritt 2 hängen (Absturz), holt
 *    app.faellige_erinnerungen sie nach einer Stunde wieder.
 * Arbeitet in Paketen, bis nichts mehr ansteht (höchstens maxRunden × grenze je Lauf).
 */
export async function versendeFaelligeErinnerungen(
  db: Datenbank,
  versand: Versand,
  appUrl: string,
  optionen: { grenze?: number; maxRunden?: number } = {},
): Promise<{ gesendet: number; fehler: number }> {
  const grenze = optionen.grenze ?? 500;
  const z = { gesendet: 0, fehler: 0 };
  for (let runde = 0; runde < (optionen.maxRunden ?? 20); runde++) {
    const faellig = await db.imKontext({}, (tx) =>
      tx.abfrage<{ erinnerung_id: string; unternehmen_id: string }>("select * from app.faellige_erinnerungen($1)", [grenze]),
    );
    for (const unternehmenId of new Set(faellig.map((f) => f.unternehmen_id))) {
      const ids = faellig.filter((f) => f.unternehmen_id === unternehmenId).map((f) => f.erinnerung_id);
      const r = await versendeFuerUnternehmen(db, versand, appUrl, unternehmenId, ids);
      z.gesendet += r.gesendet;
      z.fehler += r.fehler;
    }
    if (faellig.length < grenze) break;
  }
  return z;
}

async function versendeFuerUnternehmen(db: Datenbank, versand: Versand, appUrl: string, unternehmenId: string, ids: string[]) {
  const z = { gesendet: 0, fehler: 0 };
  // 1. vormerken (eigene Transaktion, sofort committet)
  const zeilen = await db.imKontext({ unternehmenId }, async (tx) => {
    // Erinnerungen zu inzwischen erledigten Pflichten verwerfen
    await tx.abfrage(
      `update app.erinnerung e set status = 'verworfen' from app.pflicht_instanz pi
        where e.id = any($1) and e.status in ('geplant', 'in_versand') and pi.id = e.pflicht_instanz_id and pi.status <> 'offen'`,
      [ids],
    );
    const vorgemerkt = await tx.abfrage<Vorgemerkt>(
      `select e.id, e.kanal, e.konto_id, k.email, k.sprache, pi.faellig_am, pv.daten->'titel' as titel, pi.pflicht_id, pi.periode, e.versuche
         from app.erinnerung e
         join app.konto k on k.id = e.konto_id
         join app.pflicht_instanz pi on pi.id = e.pflicht_instanz_id
         join katalog.pflicht_version_anzeige pv on pv.id = pi.pflicht_version_id
        where e.id = any($1) and pi.status = 'offen'
          and (e.status = 'geplant' or (e.status = 'in_versand' and e.versand_begonnen_am < now() - interval '1 hour'))
        for update of e skip locked`,
      [ids],
    );
    if (vorgemerkt.length)
      await tx.abfrage("update app.erinnerung set status = 'in_versand', versand_begonnen_am = now() where id = any($1)", [vorgemerkt.map((v) => v.id)]);
    return vorgemerkt;
  });

  // 2. senden, 3. Ergebnis je Erinnerung festhalten
  for (const e of zeilen) {
    let status: "gesendet" | "verworfen" = "verworfen"; // sms: erst nach Anbieterwahl
    let ungueltig: string[] = [];
    try {
      const titel = (e.sprache === "en" && e.titel.en) || e.titel.de;
      const datum = new Date(`${e.faellig_am}T12:00:00Z`).toLocaleDateString(e.sprache === "en" ? "en-GB" : "de-DE", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
      const betreff = e.sprache === "en" ? `Due on ${datum}: ${titel}` : `Fällig am ${datum}: ${titel}`;
      const pfad = `/pflichten/${encodeURIComponent(e.pflicht_id)}/${encodeURIComponent(e.periode)}`;
      if (e.kanal === "email") {
        await versand.email({ an: e.email, betreff, text: `${titel}\n\n${appUrl}${pfad}` });
        status = "gesendet";
      } else if (e.kanal === "push" && versand.push) {
        const tokens = await db.imKontext({ unternehmenId }, async (tx) =>
          (await tx.abfrage<{ push_token: string }>("select push_token from app.geraet where konto_id = $1 and aktiv", [e.konto_id])).map((g) => g.push_token),
        );
        if (tokens.length) {
          // Push zeigt nur Titel und Datum (Sperrbildschirm), keine weiteren Unternehmensdaten
          const r = await versand.push({ tokens, titel: betreff, text: e.sprache === "en" ? `Open ${MARKE.name} to see what to do.` : `Öffne ${MARKE.name}, um zu sehen, was zu tun ist.`, link: pfad });
          ungueltig = r.ungueltig;
          status = "gesendet";
        }
      }
    } catch {
      const versuche = e.versuche + 1;
      await db.imKontext({ unternehmenId }, (tx) =>
        tx.abfrage(
          `update app.erinnerung set versuche = $2, status = $3, versand_begonnen_am = null,
                  naechster_versuch = now() + make_interval(mins => $4) where id = $1`,
          [e.id, versuche, versuche >= MAX_VERSUCHE ? "fehler" : "geplant", abstandMinuten(versuche)],
        ),
      );
      z.fehler++;
      continue;
    }
    await db.imKontext({ unternehmenId }, async (tx) => {
      if (ungueltig.length) await tx.abfrage("update app.geraet set aktiv = false where push_token = any($1)", [ungueltig]);
      await tx.abfrage("update app.erinnerung set status = $2, gesendet_am = now(), versand_begonnen_am = null where id = $1", [e.id, status]);
    });
    z.gesendet++;
  }
  return z;
}
