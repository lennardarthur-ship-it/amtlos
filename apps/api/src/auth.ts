import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  SetMetadata,
  UnauthorizedException,
  BadRequestException,
  createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { Datenbank } from "@amtlos/server";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";

export type Rolle = "inhaber" | "mitarbeiter" | "steuerberater" | "admin";

export interface Anfragekontext {
  kontoId: string;
  sub: string;
  sprache: "de" | "en";
  unternehmenId?: string;
  rolle?: Rolle;
}

declare module "express" {
  interface Request {
    amtlos?: Anfragekontext;
  }
}

const OEFFENTLICH = "amtlos:oeffentlich";
const ROLLEN = "amtlos:rollen";
const UNTERNEHMEN_NOETIG = "amtlos:unternehmen";

/** Route ohne Anmeldung (Gesundheit, ICS mit Token). */
export const Oeffentlich = () => SetMetadata(OEFFENTLICH, true);
/** Route braucht den Header X-Unternehmen-Id und eine Mitgliedschaft; optional bestimmte Rollen. */
export const MitUnternehmen = (...rollen: Rolle[]) => (ziel: object, schluessel?: string | symbol, desc?: PropertyDescriptor) => {
  SetMetadata(UNTERNEHMEN_NOETIG, true)(ziel, schluessel!, desc!);
  if (rollen.length) SetMetadata(ROLLEN, rollen)(ziel, schluessel!, desc!);
};

export const Kontext = createParamDecorator((_: unknown, ctx: ExecutionContext): Anfragekontext => {
  const k = ctx.switchToHttp().getRequest<Request>().amtlos;
  if (!k) throw new UnauthorizedException();
  return k;
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prüft das Bearer-Token (OIDC, E-014; im Entwicklungsmodus HS256), legt beim ersten Login das Konto an
 * und löst den Mandanten aus X-Unternehmen-Id auf. Die eigentliche Datentrennung macht RLS in der Datenbank;
 * diese Prüfung liefert nur saubere Fehlermeldungen und die Rolle für Rollenprüfungen (E-012).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private jwks?: JWTVerifyGetKey;
  private readonly kontoCache = new Map<string, { id: string; sprache: "de" | "en"; bis: number }>();

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(KONFIGURATION) private readonly k: Konfiguration,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ziele = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(OEFFENTLICH, ziele)) return true;
    const req = ctx.switchToHttp().getRequest<Request>();

    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    if (!token) throw new UnauthorizedException("Anmeldung erforderlich");
    const claims = await this.pruefeToken(token);
    if (!claims.sub) throw new UnauthorizedException("Token ohne Subjekt");

    const konto = await this.konto(claims);
    // Die Oberfläche schickt ihre Sprache mit (X-Sprache); sonst gilt die Sprache des Kontos
    const gewuenscht = req.headers["x-sprache"];
    const sprache = gewuenscht === "de" || gewuenscht === "en" ? gewuenscht : konto.sprache;
    const kontext: Anfragekontext = { kontoId: konto.id, sub: claims.sub, sprache };

    const unternehmenNoetig = this.reflector.getAllAndOverride<boolean>(UNTERNEHMEN_NOETIG, ziele);
    const header = req.headers["x-unternehmen-id"];
    if (unternehmenNoetig) {
      if (typeof header !== "string" || !UUID.test(header)) throw new BadRequestException("Header X-Unternehmen-Id fehlt oder ist ungültig");
      const m = await this.db.imKontext({ kontoId: konto.id, unternehmenId: header }, (tx) =>
        tx.eine<{ rolle: Rolle }>("select rolle from app.mitgliedschaft where unternehmen_id = $1 and konto_id = $2", [header, konto.id]),
      );
      // Kein Unterschied zwischen „gibt es nicht“ und „gehört dir nicht“ (keine Existenz-Auskunft)
      if (!m) throw new NotFoundException("Unternehmen nicht gefunden");
      kontext.unternehmenId = header;
      kontext.rolle = m.rolle;
      const rollen = this.reflector.getAllAndOverride<Rolle[] | undefined>(ROLLEN, ziele);
      if (rollen && !rollen.includes(m.rolle)) throw new ForbiddenException("Für diese Aktion fehlt die Berechtigung");
    }
    req.amtlos = kontext;
    return true;
  }

  private async pruefeToken(token: string): Promise<JWTPayload & { email?: string; name?: string; preferred_username?: string }> {
    try {
      if (this.k.AUTH_MODUS === "dev") {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(this.k.DEV_JWT_SECRET!), { algorithms: ["HS256"], issuer: "amtlos-dev" });
        return payload;
      }
      this.jwks ??= await this.ladeJwks();
      const { payload } = await jwtVerify(token, this.jwks, { issuer: this.k.OIDC_ISSUER, audience: this.k.OIDC_AUDIENCE });
      return payload;
    } catch {
      throw new UnauthorizedException("Token ungültig oder abgelaufen");
    }
  }

  private async ladeJwks(): Promise<JWTVerifyGetKey> {
    const discovery = await fetch(new URL("/.well-known/openid-configuration", this.k.OIDC_ISSUER)).then((r) => r.json() as Promise<{ jwks_uri: string }>);
    return createRemoteJWKSet(new URL(discovery.jwks_uri));
  }

  private async konto(claims: JWTPayload & { email?: string; name?: string; preferred_username?: string }) {
    const sub = claims.sub!;
    const cache = this.kontoCache.get(sub);
    if (cache && cache.bis > Date.now()) return cache;
    const email = claims.email ?? `${sub}@unbekannt.invalid`;
    const name = claims.name ?? claims.preferred_username ?? email;
    const zeile = await this.db.imKontext({}, (tx) =>
      tx.eine<{ id: string }>("select app.konto_anmelden($1, $2, $3) as id", [sub, email, name]),
    );
    const sprache = await this.db.imKontext({ kontoId: zeile!.id }, (tx) => tx.eine<{ sprache: "de" | "en" }>("select sprache from app.konto where id = $1", [zeile!.id]));
    const eintrag = { id: zeile!.id, sprache: sprache?.sprache ?? "de", bis: Date.now() + 5 * 60_000 };
    if (this.kontoCache.size > 10_000) this.kontoCache.clear();
    this.kontoCache.set(sub, eintrag);
    return eintrag;
  }
}
