FROM node:24-alpine AS ui-builder

WORKDIR /build
ENV CI=true

RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY ui/package.json ./ui/
COPY server/package.json ./server/

RUN pnpm --filter @deepcrate/ui install --frozen-lockfile

COPY ui/ ./ui/

RUN pnpm --filter @deepcrate/ui run build

FROM node:24-alpine AS server-builder

WORKDIR /build
ENV CI=true

RUN corepack enable

# Build tools for Sequelize SQLite
RUN apk add --no-cache python3 make g++ sqlite-dev

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY server/package.json ./server/
COPY ui/package.json ./ui/

RUN pnpm --filter @deepcrate/server install --frozen-lockfile

# Navigate into sqlite3's actual directory and build it manually
RUN cd /build/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3 && \
    npm run install && \
    ls -la build/ && \
    echo "SQLite3 build complete"

COPY server/src ./server/src
COPY server/tsconfig.json server/tsconfig.build.json ./server/

RUN pnpm --filter @deepcrate/server run build

FROM node:24-alpine AS production

ARG APP_VERSION=dev
WORKDIR /app
ENV CI=true

RUN corepack enable
RUN apk add --no-cache curl su-exec python3 make g++ sqlite-dev

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY server/package.json ./server/
COPY ui/package.json ./ui/

RUN pnpm --filter @deepcrate/server install --prod --frozen-lockfile

RUN cd /app/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3 && \
    npm run install && \
    ls -la build/ && \
    echo "SQLite3 production build complete"

COPY --from=server-builder /build/server/dist ./server/dist
COPY --from=ui-builder /build/ui/dist ./static
RUN apk del python3 make g++

ENV APP_VERSION=$APP_VERSION \
    NODE_ENV=production \
    CONFIG_PATH=/config/config.yaml \
    DATA_PATH=/data \
    LOG_LEVEL=info \
    PORT=8080 \
    HOST=0.0.0.0 \
    LB_FETCH_INTERVAL=21600 \
    CATALOG_INTERVAL=604800 \
    SLSKD_INTERVAL=3600 \
    RUN_JOBS_ON_STARTUP=true

RUN mkdir -p /data /config && chown node:node /data /config

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/dist/server.js"]
