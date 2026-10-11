import { createHmac, timingSafeEqual } from "node:crypto";
import type { Datenbank, Tx } from "./datenbank.js";

/**
 * Abo über Stripe (E-113). Kein SDK: die wenigen Aufrufe (Checkout-Session, Kundenportal) gehen als
 * Formular-POST an die Stripe-REST-API; Webhooks werden mit dem Stripe-Signaturverfahren (HMAC-SHA256 über
 * "t.payload") geprüft. Preise und Pläne stehen in der Konfiguration, nie im Code (Spezifikation 9).
 */
export interface StripeKlient {
  /** POST an /v1/<pfad> mit Formularfeldern; gibt das JSON-Objekt zurück. */
  post(pfad: string, felder: Record<string, string>): Promise<Record<string, unknown>>;
}

export class StripeRest implements StripeKlient {
  constructor(
    private readonly geheim: string,
    private readonly abruf: typeof fetch = fetch,
    private readonly basis = "https://api.stripe.com",
  ) {}
  async post(pfad: string, felder: Record<string, string>) {
    const r = await this.abruf(`${this.basis}/v1/${pfad}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.geheim}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20" },
      body: new URLSearchParams(felder).toString(),
    });
    const j = (await r.json()) as Record<string, unknown>;
    if (!r.ok) throw new Error(`Stripe ${pfad}: ${(j.error as { message?: string } | undefined)?.message ?? r.status}`);
    return j;
  }
}

/** Webhook-Signatur nach Stripe: Kopf "t=<zeit>,v1=<hex>"; Toleranz 5 Minuten gegen Wiederholung. */
export function pruefeStripeSignatur(roh: string, kopf: string | undefined, geheim: string, jetzt = Date.now()): boolean {
  if (!kopf) return false;
  const teile = Object.fromEntries(kopf.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(teile.t);
  if (!Number.isFinite(t) || Math.abs(jetzt / 1000 - t) > 300) return false;
  const erwartet = createHmac("sha256", geheim).update(`${teile.t}.${roh}`).digest("hex");
  const v1 = kopf
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  return v1.some((s) => s.length === erwartet.length && timingSafeEqual(Buffer.from(s, "hex"), Buffer.from(erwartet, "hex")));
}

export interface AboStand { status: string; test_bis: string; laeuft_bis: string | null; schreibbar: boolean }

export async function aboStand(tx: Tx, unternehmenId: string): Promise<AboStand | undefined> {
  const r = await tx.eine<{ status: string; test_bis: string; laeuft_bis: string | null; schreibbar: boolean }>("select status, test_bis::text, laeuft_bis::text, schreibbar from app.abo_stand($1)", [unternehmenId]);
  return r;
}

/** Checkout-Session: Stripe-Kunde je Unternehmen (einmal), dann Abo-Checkout mit dem konfigurierten Preis. */
export async function checkoutStarten(db: Datenbank, stripe: StripeKlient, e: { unternehmenId: string; kontoId: string; email: string; name: string; preisId: string; webUrl: string }): Promise<string> {
  const vorhanden = await db.imKontext({ kontoId: e.kontoId, unternehmenId: e.unternehmenId }, (tx) =>
    tx.eine<{ stripe_kunde_id: string | null; stripe_abo_id: string | null }>("select stripe_kunde_id, stripe_abo_id from app.abo where unternehmen_id = $1", [e.unternehmenId]),
  );
  let kunde = vorhanden?.stripe_kunde_id ?? null;
  if (!kunde) {
    const k = await stripe.post("customers", { email: e.email, name: e.name, "metadata[unternehmen_id]": e.unternehmenId });
    kunde = String(k.id);
    await db.imKontext({ kontoId: e.kontoId, unternehmenId: e.unternehmenId }, (tx) => tx.abfrage("select app.abo_kunde_setzen($1, $2)", [e.unternehmenId, kunde]));
  }
  const s = await stripe.post("checkout/sessions", {
    mode: "subscription",
    customer: kunde,
    "line_items[0][price]": e.preisId,
    "line_items[0][quantity]": "1",
    success_url: `${e.webUrl}/einstellungen/abo?ok=1`,
    cancel_url: `${e.webUrl}/einstellungen/abo`,
    "subscription_data[metadata][unternehmen_id]": e.unternehmenId,
    "metadata[unternehmen_id]": e.unternehmenId,
    locale: "de",
    "automatic_tax[enabled]": "true",
    "tax_id_collection[enabled]": "true",
    "customer_update[name]": "auto",
    "customer_update[address]": "auto",
  });
  return String(s.url);
}

export async function portalOeffnen(db: Datenbank, stripe: StripeKlient, e: { unternehmenId: string; kontoId: string; webUrl: string }): Promise<string | null> {
  const a = await db.imKontext({ kontoId: e.kontoId, unternehmenId: e.unternehmenId }, (tx) => tx.eine<{ stripe_kunde_id: string | null }>("select stripe_kunde_id from app.abo where unternehmen_id = $1", [e.unternehmenId]));
  if (!a?.stripe_kunde_id) return null;
  const s = await stripe.post("billing_portal/sessions", { customer: a.stripe_kunde_id, return_url: `${e.webUrl}/einstellungen/abo` });
  return String(s.url);
}

type Ereignis = { id: string; type: string; data: { object: Record<string, unknown> } };

const STATUS: Record<string, string> = { trialing: "aktiv", active: "aktiv", past_due: "ueberfaellig", unpaid: "ueberfaellig", canceled: "abgelaufen", incomplete_expired: "abgelaufen", paused: "abgelaufen" };
const datum = (s: unknown) => (typeof s === "number" ? new Date(s * 1000).toISOString().slice(0, 10) : null);

/**
 * Webhook verarbeiten: Abo-Status aus Stripe übernehmen. Idempotent über die Ereignis-ID. Unbekannte Typen werden
 * nur protokolliert. Rückgabe: was passiert ist (für Logs ohne personenbezogene Daten).
 */
export async function stripeEreignis(db: Datenbank, roh: Ereignis): Promise<"verarbeitet" | "doppelt" | "ignoriert"> {
  const o = roh.data.object;
  let unternehmen: string | null = null;
  let status: string | null = null;
  let laeuftBis: string | null = null;
  const kunde: string | null = typeof o.customer === "string" ? o.customer : null;
  let abo: string | null = null;
  let plan: string | null = null;
  if (roh.type === "checkout.session.completed") {
    unternehmen = ((o.metadata as Record<string, string> | undefined)?.unternehmen_id ?? null) as string | null;
    abo = typeof o.subscription === "string" ? o.subscription : null;
    status = "aktiv";
  } else if (roh.type.startsWith("customer.subscription.")) {
    unternehmen = ((o.metadata as Record<string, string> | undefined)?.unternehmen_id ?? null) as string | null;
    abo = typeof o.id === "string" ? o.id : null;
    const st = String(o.status ?? "");
    status = roh.type === "customer.subscription.deleted" ? "abgelaufen" : o.cancel_at_period_end === true && st === "active" ? "gekuendigt" : (STATUS[st] ?? null);
    laeuftBis = datum(o.current_period_end);
    const preis = (o.items as { data?: { price?: { lookup_key?: string; id?: string } }[] } | undefined)?.data?.[0]?.price;
    plan = preis?.lookup_key ?? preis?.id ?? null;
  } else if (roh.type === "invoice.payment_failed") {
    status = "ueberfaellig";
  } else if (roh.type === "invoice.paid") {
    status = "aktiv";
    const zeilen = (o.lines as { data?: { period?: { end?: number } }[] } | undefined)?.data ?? [];
    laeuftBis = datum(zeilen[zeilen.length - 1]?.period?.end);
  } else {
    // Nur merken, nichts ändern
    const neu = await db.imKontext({}, (tx) => tx.eine<{ ok: boolean }>("select app.abo_webhook($1, $2, $3, null, null, null, null, null, null) as ok", [roh.id, roh.type, roh]));
    return neu?.ok ? "ignoriert" : "doppelt";
  }
  return db.imKontext({}, async (tx) => {
    if (!unternehmen && kunde) unternehmen = (await tx.eine<{ u: string | null }>("select app.abo_unternehmen_zu_kunde($1) as u", [kunde]))?.u ?? null;
    const neu = await tx.eine<{ ok: boolean }>("select app.abo_webhook($1, $2, $3, $4, $5, $6, $7, $8, $9) as ok", [roh.id, roh.type, roh, unternehmen, status, laeuftBis, kunde, abo, plan]);
    return neu?.ok ? "verarbeitet" : "doppelt";
  });
}
