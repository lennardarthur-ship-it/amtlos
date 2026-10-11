import nodemailer from "nodemailer";
import { z } from "zod";
import { Datenbank, ProtokollVersand, erzeugeWarteschlange, type Nachricht, type Versand } from "@amtlos/server";
import { arbeiterStarten, type Protokoll } from "./arbeit.js";

const Konfig = z
  .object({
    UMGEBUNG: z.enum(["dev", "test", "staging", "prod"]).default("dev"),
    WORKER_DATABASE_URL: z.string().min(1),
    WEB_URL: z.string().url().default("http://localhost:3000"),
    SMTP_URL: z.string().url().optional(),
    MAIL_ABSENDER: z.string().default("Amtlos <erinnerung@amtlos.de>"),
  })
  .superRefine((k, ctx) => {
    if ((k.UMGEBUNG === "prod" || k.UMGEBUNG === "staging") && !k.SMTP_URL)
      ctx.addIssue({ code: "custom", message: "SMTP_URL ist in staging/prod Pflicht (sonst gehen Erinnerungen verloren)" });
  });

/** Strukturierte Logs ohne personenbezogene Daten (E-017): nur IDs und Zähler. */
const log: Protokoll = {
  info: (msg, daten) => console.warn(JSON.stringify({ zeit: new Date().toISOString(), stufe: "info", msg, ...daten })),
  fehler: (msg, daten) => console.error(JSON.stringify({ zeit: new Date().toISOString(), stufe: "fehler", msg, ...daten })),
};

class SmtpVersand implements Versand {
  private readonly transport;
  constructor(url: string, private readonly absender: string) {
    this.transport = nodemailer.createTransport(url);
  }
  async email(n: Nachricht): Promise<void> {
    await this.transport.sendMail({ from: this.absender, to: n.an, subject: n.betreff, text: n.text });
  }
}

const k = Konfig.parse(process.env);
const db = new Datenbank({ connectionString: k.WORKER_DATABASE_URL, max: 10 });
const boss = erzeugeWarteschlange(k.WORKER_DATABASE_URL, { planen: true });
boss.on("error", (e) => log.fehler("warteschlange", { meldung: e.message }));
const versand: Versand = k.SMTP_URL ? new SmtpVersand(k.SMTP_URL, k.MAIL_ABSENDER) : new ProtokollVersand();

await boss.start();
await arbeiterStarten(boss, db, versand, k.WEB_URL, log);
log.info("worker_gestartet", { umgebung: k.UMGEBUNG, versand: k.SMTP_URL ? "smtp" : "protokoll" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    log.info("worker_stoppt", { signal });
    await boss.stop({ graceful: true, wait: true, timeout: 30_000 });
    await db.schliessen();
    process.exit(0);
  });
}
