import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Einheitliche Fehlerantworten und Logs (G4): Fehler erscheinen als eine JSON-Zeile wie das Zugriffsprotokoll, ohne
 * mehrzeilige Stacktraces. 4xx sind Bedienfehler und werden nicht als Fehler protokolliert (das Zugriffsprotokoll
 * zeigt sie schon); 5xx mit Meldung, aber ohne personenbezogene Daten. Die Antwort an den Client enthält nie Details.
 */
@Catch()
export class FehlerFilter implements ExceptionFilter {
  constructor(private readonly protokollieren: boolean) {}

  catch(fehler: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    if (res.headersSent) return;
    if (fehler instanceof HttpException) {
      // Parser-Details (Position, Ausschnitt der Eingabe) nicht durchreichen (G3)
      if (fehler.getStatus() === 400 && /JSON|Unexpected token|position \d+/i.test(fehler.message)) {
        res.status(400).json({ statusCode: 400, message: "Anfrage ungültig (kein gültiges JSON)" });
        return;
      }
      const antwort = fehler.getResponse();
      res.status(fehler.getStatus()).json(typeof antwort === "string" ? { statusCode: fehler.getStatus(), message: antwort } : antwort);
      return;
    }
    // Fehler aus Express-Middleware (z. B. body-parser: 413, kaputtes JSON 400) tragen ihren Status selbst
    const status = typeof fehler === "object" && fehler !== null && "status" in fehler && typeof (fehler as { status: unknown }).status === "number" ? (fehler as { status: number }).status : 500;
    if (status >= 400 && status < 500) {
      res.status(status).json({ statusCode: status, message: status === 413 ? "Die Anfrage ist zu groß." : "Anfrage ungültig" });
      return;
    }
    if (this.protokollieren) {
      const e = fehler instanceof Error ? fehler : new Error(String(fehler));
      console.error(
        JSON.stringify({
          zeit: new Date().toISOString(),
          stufe: "fehler",
          msg: "unbehandelter_fehler",
          anfrage: res.getHeader("X-Request-Id"),
          methode: req.method,
          route: req.route?.path ? `${req.baseUrl ?? ""}${req.route.path as string}` : "unbekannt",
          art: e.name,
          code: (fehler as { code?: unknown }).code,
          meldung: e.message.slice(0, 300),
          ort: e.stack?.split("\n").slice(1, 4).map((z) => z.trim()),
        }),
      );
    }
    res.status(500).json({ statusCode: 500, message: "Interner Fehler" });
  }
}
