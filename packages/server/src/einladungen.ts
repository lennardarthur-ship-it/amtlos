import type { Datenbank } from "./datenbank.js";
import type { Versand } from "./erinnerungen.js";
import type { EinladungsJob } from "./warteschlange.js";
import { MARKE } from "@amtlos/marke";

const ROLLEN: Record<"de" | "en", Record<string, string>> = {
  de: { inhaber: "Inhaber:in", mitarbeiter: "Mitarbeiter:in", steuerberater: "Steuerberatung", admin: "Admin" },
  en: { inhaber: "Owner", mitarbeiter: "Employee", steuerberater: "Tax adviser", admin: "Admin" },
};
const ROLLEN_DE = ROLLEN.de;

/** Text der Einladungs-E-Mail. Kein Tracking, keine Bilder; nur das Nötige und der Link. */
export function einladungsText(
  e: { unternehmen: string; rolle: string; eingeladen_von: string | null; laeuft_ab: Date; sprache?: string },
  link: string,
) {
  if (e.sprache === "en") {
    const bis = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/Berlin" }).format(e.laeuft_ab);
    const einstieg = e.eingeladen_von ? `${e.eingeladen_von} invites you` : "You are invited";
    return {
      betreff: `Invitation to ${e.unternehmen} on ${MARKE.name}`,
      text:
        `${einstieg} to work on ${e.unternehmen} in ${MARKE.name} (role: ${ROLLEN.en[e.rolle] ?? e.rolle}).\n\n` +
        `Accept the invitation:\n${link}\n\n` +
        `The link is valid until ${bis} and only if you sign in with this email address.\n` +
        `If you don't know anyone at ${e.unternehmen}, you can ignore this email.`,
    };
  }
  const bis = new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeZone: "Europe/Berlin" }).format(e.laeuft_ab);
  const einstieg = e.eingeladen_von ? `${e.eingeladen_von} lädt dich ein` : "Du bist eingeladen";
  return {
    betreff: `Einladung zu ${e.unternehmen} bei ${MARKE.name}`,
    text:
      `${einstieg}, bei ${e.unternehmen} in ${MARKE.name} mitzuarbeiten (Rolle: ${ROLLEN_DE[e.rolle] ?? e.rolle}).\n\n` +
      `Einladung annehmen:\n${link}\n\n` +
      `Der Link gilt bis ${bis} und nur, wenn du dich mit dieser E-Mail-Adresse anmeldest.\n` +
      `Wenn du niemanden bei ${e.unternehmen} kennst, kannst du diese E-Mail ignorieren.`,
  };
}

/** Worker: Einladungs-E-Mail senden. Widerrufene, angenommene oder abgelaufene Einladungen werden still übersprungen. */
export async function versendeEinladung(db: Datenbank, versand: Versand, appUrl: string, job: EinladungsJob): Promise<"gesendet" | "uebersprungen"> {
  const e = await db.imKontext({}, (tx) =>
    tx.eine<{ email: string; rolle: string; unternehmen: string; eingeladen_von: string | null; laeuft_ab: Date; sprache: string }>(
      "select * from app.einladung_fuer_versand($1)",
      [job.einladungId],
    ),
  );
  if (!e) return "uebersprungen";
  const { betreff, text } = einladungsText(e, `${appUrl}/einladung/${job.token}`);
  await versand.email({ an: e.email, betreff, text });
  return "gesendet";
}
