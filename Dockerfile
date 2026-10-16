# The OfCourse image for Cloud Run (`gcloud run deploy --source .` builds it; locally
# `docker build -t ofcourse .`). No secret is built in: .dockerignore keeps .env* out of the
# context, and every secret arrives as an environment variable when the container starts.
#
# Migrations run as a Cloud Run job from this same image:
#   --command bun --args scripts/migrate.ts

# 1. build: Node 24 with Bun's binary. Installs from the lockfile and builds inside Linux, so the
#    Linux @resvg/resvg-js binary is the one installed and traced into .next/standalone.
FROM node:24-slim AS build
COPY --from=oven/bun:1.3.10-slim /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# 2. runtime: the standalone server, its static files and public/. The brand fonts and the art
#    library are traced into standalone at their repo paths (next.config.ts), so the app's
#    process.cwd()-relative reads resolve under /app. Bun, drizzle-orm, postgres, the migrations
#    and scripts/migrate.ts are here for the migrations job only.
FROM node:24-slim AS runtime
COPY --from=oven/bun:1.3.10-slim /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=build /app/node_modules/postgres ./node_modules/postgres
COPY --from=build /app/src/shared/lib/db/migrations ./src/shared/lib/db/migrations
COPY --from=build /app/scripts/migrate.ts ./scripts/migrate.ts
USER node
EXPOSE 8080
CMD ["node", "server.js"]
