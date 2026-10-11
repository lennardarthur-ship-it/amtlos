import { Module, type OnApplicationShutdown } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Inject } from "@nestjs/common";
import type PgBoss from "pg-boss";
import path from "node:path";
import { DateiAblage, Datenbank, NichtVerfuegbaresElster, erzeugeWarteschlange } from "@amtlos/server";
import { ArbeitsschutzController } from "./arbeitsschutz.controller.js";
import { AssistentController } from "./assistent.controller.js";
import { AuthGuard } from "./auth.js";
import { BranchenController } from "./branchen.controller.js";
import { DatenschutzController } from "./datenschutz.controller.js";
import { BetriebController, METRIKEN, erzeugeMetriken } from "./betrieb.js";
import { ELSTER, ElsterController } from "./elster.controller.js";
import { ABLAGE, FinanzenController } from "./finanzen.controller.js";
import { KernController, WARTESCHLANGE } from "./kern.controller.js";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";
import { KanzleiController } from "./kanzlei.controller.js";
import { MobilController } from "./mobil.controller.js";
import { MarktplatzController } from "./marktplatz.controller.js";
import { OnlineCheckController } from "./onlinecheck.controller.js";
import { PersonalController } from "./personal.controller.js";
import { PflichtenController } from "./pflichten.controller.js";
import { PostfachController } from "./postfach.controller.js";
import { TeamController } from "./team.controller.js";

export function appModul(k: Konfiguration) {
  @Module({
    controllers: [KernController, PflichtenController, TeamController, ElsterController, FinanzenController, PersonalController, ArbeitsschutzController, DatenschutzController, OnlineCheckController, BranchenController, AssistentController, PostfachController, MarktplatzController, KanzleiController, MobilController, BetriebController],
    providers: [
      { provide: KONFIGURATION, useValue: k },
      { provide: METRIKEN, useFactory: erzeugeMetriken },
      { provide: ELSTER, useClass: NichtVerfuegbaresElster },
      { provide: ABLAGE, useFactory: () => new DateiAblage(path.resolve(k.ABLAGE_VERZEICHNIS ?? "ablage")) },
      { provide: Datenbank, useFactory: () => new Datenbank({ connectionString: k.DATABASE_URL, max: 20 }) },
      {
        provide: WARTESCHLANGE,
        useFactory: async () => {
          const boss = erzeugeWarteschlange(k.DATABASE_URL);
          boss.on("error", (e) => console.error("Warteschlange:", e.message));
          await boss.start();
          return boss;
        },
      },
      { provide: APP_GUARD, useClass: AuthGuard },
    ],
  })
  class AppModule implements OnApplicationShutdown {
    constructor(
      @Inject(Datenbank) private readonly db: Datenbank,
      @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
    ) {}
    async onApplicationShutdown() {
      await this.boss.stop({ graceful: true, wait: true }).catch(() => undefined);
      await this.db.schliessen();
    }
  }
  return AppModule;
}
