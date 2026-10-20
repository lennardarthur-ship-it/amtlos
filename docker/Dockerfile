# syntax=docker/dockerfile:1.7
# Ein Dockerfile, ein Ziel je Dienst (E-084):
#   docker build -f docker/Dockerfile --target api .
#   Ziele: api, worker, web, studio, werkzeug (Migrationen, Katalog-Import, Betriebskommandos)
# Laufzeit: Node 22 (wie .nvmrc), ohne Root, ohne Paketmanager im Image, nur Produktionsabhängigkeiten.

# Genaue Version (Reproduzierbarkeit); Dependabot schlägt Updates vor (.github/dependabot.yml)
ARG NODE_BILD=node:22.22.0-bookworm-slim

FROM ${NODE_BILD} AS basis
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /quelle

FROM basis AS bau
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build
# Schlanke Bündel je Node-Dienst (nur Produktionsabhängigkeiten, Workspace-Pakete mit dist/)
RUN pnpm --filter @amtlos/api deploy --prod /buendel/api \
 && pnpm --filter @amtlos/worker deploy --prod /buendel/worker \
 && pnpm --filter @amtlos/server deploy --prod /buendel/werkzeug \
 && cp -r db /buendel/werkzeug/db && cp -r catalog /buendel/werkzeug/catalog

FROM ${NODE_BILD} AS laufzeit
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
USER node

FROM laufzeit AS api
COPY --from=bau --chown=node:node /buendel/api /app
EXPOSE 3001
ENV PORT=3001
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/v1/gesundheit').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]

FROM laufzeit AS worker
COPY --from=bau --chown=node:node /buendel/worker /app
CMD ["node", "dist/main.js"]

FROM laufzeit AS werkzeug
COPY --from=bau --chown=node:node /buendel/werkzeug /app
ENV MIGRATIONEN=/app/db/migrations KATALOG=/app/catalog
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["migrieren"]

FROM laufzeit AS web
COPY --from=bau --chown=node:node /quelle/apps/web/.next/standalone /app
COPY --from=bau --chown=node:node /quelle/apps/web/.next/static /app/apps/web/.next/static
COPY --from=bau --chown=node:node /quelle/apps/web/public /app/apps/web/public
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]

FROM laufzeit AS studio
COPY --from=bau --chown=node:node /quelle/apps/studio/.next/standalone /app
COPY --from=bau --chown=node:node /quelle/apps/studio/.next/static /app/apps/studio/.next/static
EXPOSE 3100
ENV PORT=3100 HOSTNAME=0.0.0.0
CMD ["node", "apps/studio/server.js"]
