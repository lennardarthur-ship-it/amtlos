import { Module, type OnApplicationShutdown } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Inject } from "@nestjs/common";
import type PgBoss from "pg-boss";
import { Datenbank, erzeugeWarteschlange } from "@amtlos/server";
import { AuthGuard } from "./auth.js";
import { KernController, WARTESCHLANGE } from "./kern.controller.js";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";
import { PflichtenController } from "./pflichten.controller.js";

export function appModul(k: Konfiguration) {
  @Module({
    controllers: [KernController, PflichtenController],
    providers: [
      { provide: KONFIGURATION, useValue: k },
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
