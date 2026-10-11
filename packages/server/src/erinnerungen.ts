import { minusDauer, type Datum } from "@amtlos/fristen";
import type { Datenbank, Tx } from "./datenbank.js";
import { heute } from "./berechnung.js";
import { ladeAktivenKatalog } from "./katalog.js";

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
 * Plant die Erinnerungen eines Unternehmens neu: alle noch nicht gesendeten werden verworfen
 * und aus den offenen Pflichten mit Datum neu erzeugt. Empfänger: Inhaber und Admins.
 */
export async function planeErinnerungen(tx: Tx, unternehmenId: string, stichtag: Datum = heute()): Promise<number> {
  await tx.abfrage("delete from app.erinnerung where unternehmen_id = $1 and status = 'geplant'", [unternehmenId]);
  const aktiv = await ladeAktivenKatalog(tx);
  if (!aktiv) return 0;
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

  const jetzt = Date.now();
  let anzahl = 0;
  for (const { konto_id } of empfaenger) {
    const eigene = einstellungen.filter((e) => e.konto_id === konto_id);
    const standard = [{ kanal: "email", vorlauf: undefined as unknown[] | undefined }, ...(mitGeraet.has(konto_id) ? [{ kanal: "push", vorlauf: undefined as unknown[] | undefined }] : [])];
    const kanaele = eigene.length ? eigene.filter((e) => e.aktiv && (e.kanal !== "push" || mitGeraet.has(konto_id))) : standard;
    for (const k of kanaele) {
      for (const i of instanzen) {
        const vorlauf = vorlaufJePflicht.get(i.pflicht_id) ?? (k.vorlauf?.length ? k.vorlauf.map((v) => intervallZuDauer(v as string)) : STANDARD_VORLAUF);
        const zeitpunkte = [...new Set(vorlauf)].map((v) => zeitpunktInZone(minusDauer(i.faellig_am, v), UHRZEIT)).filter((z) => z.getTime() > jetzt);
        // Frist so nah, dass alle Vorlauf-Zeitpunkte vorbei sind: einmal sofort erinnern – aber nur,
        // wenn für diese Pflicht noch keine Erinnerung an diese Person über diesen Kanal hinausging.
        if (!zeitpunkte.length) {
          const schon = await tx.eine("select 1 from app.erinnerung where pflicht_instanz_id = $1 and konto_id = $2 and kanal = $3 and status = 'gesendet'", [i.id, konto_id, k.kanal]);
          if (!schon) zeitpunkte.push(new Date(jetzt + 60_000));
        }
        for (const zeitpunkt of zeitpunkte) {
          await tx.abfrage(
            `insert into app.erinnerung (unternehmen_id, pflicht_instanz_id, konto_id, kanal, geplant_fuer)
             values ($1, $2, $3, $4, $5) on conflict do nothing`,
            [unternehmenId, i.id, konto_id, k.kanal, zeitpunkt],
          );
          anzahl++;
        }
      }
    }
  }
  return anzahl;
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

/** Versendet fällige Erinnerungen. Läuft als Worker; jedes Unternehmen in eigenem Kontext. */
export async function versendeFaelligeErinnerungen(db: Datenbank, versand: Versand, appUrl: string): Promise<{ gesendet: number; fehler: number }> {
  const faellig = await db.imKontext({}, (tx) =>
    tx.abfrage<{ erinnerung_id: string; unternehmen_id: string }>("select * from app.faellige_erinnerungen(500)"),
  );
  const z = { gesendet: 0, fehler: 0 };
  for (const unternehmenId of new Set(faellig.map((f) => f.unternehmen_id))) {
    const ids = faellig.filter((f) => f.unternehmen_id === unternehmenId).map((f) => f.erinnerung_id);
    await db.imKontext({ unternehmenId }, async (tx) => {
      const zeilen = await tx.abfrage<{ id: string; kanal: string; konto_id: string; email: string; sprache: string; faellig_am: Datum; titel: { de: string; en?: string }; pflicht_id: string; periode: string }>(
        `select e.id, e.kanal, e.konto_id, k.email, k.sprache, pi.faellig_am, pv.daten->'titel' as titel, pi.pflicht_id, pi.periode
           from app.erinnerung e
           join app.konto k on k.id = e.konto_id
           join app.pflicht_instanz pi on pi.id = e.pflicht_instanz_id
           join katalog.pflicht_version_anzeige pv on pv.id = pi.pflicht_version_id
          where e.id = any($1) and e.status = 'geplant' and pi.status = 'offen'
          for update of e skip locked`,
        [ids],
      );
      for (const z2 of zeilen) {
        try {
          const titel = (z2.sprache === "en" && z2.titel.en) || z2.titel.de;
          const datum = new Date(`${z2.faellig_am}T12:00:00Z`).toLocaleDateString(z2.sprache === "en" ? "en-GB" : "de-DE", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
          const betreff = z2.sprache === "en" ? `Due on ${datum}: ${titel}` : `Fällig am ${datum}: ${titel}`;
          const pfad = `/pflichten/${encodeURIComponent(z2.pflicht_id)}/${encodeURIComponent(z2.periode)}`;
          let status = "verworfen"; // sms: erst nach Anbieterwahl
          if (z2.kanal === "email") {
            await versand.email({ an: z2.email, betreff, text: `${titel}\n\n${appUrl}${pfad}` });
            status = "gesendet";
          } else if (z2.kanal === "push" && versand.push) {
            const tokens = (await tx.abfrage<{ push_token: string }>("select push_token from app.geraet where konto_id = $1 and aktiv", [z2.konto_id])).map((g) => g.push_token);
            if (tokens.length) {
              // Push zeigt nur Titel und Datum (Sperrbildschirm), keine weiteren Unternehmensdaten
              const r = await versand.push({ tokens, titel: betreff, text: z2.sprache === "en" ? "Open Amtlos to see what to do." : "Öffne Amtlos, um zu sehen, was zu tun ist.", link: pfad });
              if (r.ungueltig.length) await tx.abfrage("update app.geraet set aktiv = false where push_token = any($1)", [r.ungueltig]);
              status = "gesendet";
            }
          }
          await tx.abfrage("update app.erinnerung set status = $2, gesendet_am = now() where id = $1", [z2.id, status]);
          z.gesendet++;
        } catch {
          await tx.abfrage("update app.erinnerung set status = 'fehler' where id = $1", [z2.id]);
          z.fehler++;
        }
      }
      // Erinnerungen zu inzwischen erledigten Pflichten verwerfen
      await tx.abfrage(
        `update app.erinnerung e set status = 'verworfen' from app.pflicht_instanz pi
          where e.id = any($1) and e.status = 'geplant' and pi.id = e.pflicht_instanz_id and pi.status <> 'offen'`,
        [ids],
      );
    });
  }
  return z;
}
