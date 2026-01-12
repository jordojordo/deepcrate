# =============================================================================
# Resonance Dockerfile (Node.js Migration)
# Multi-stage build: UI → Server → Production Runtime
# =============================================================================

# =============================================================================
# Stage 1: Build UI
# =============================================================================
FROM node:24-alpine AS ui-builder

WORKDIR /build

# Make pnpm non-interactive
ENV CI=true

# Enable pnpm
RUN corepack enable

# Copy package files first for layer caching
COPY ui/package.json ui/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY ui/ .

# Build production bundle
RUN pnpm run build

# =============================================================================
# Stage 2: Build Server
# =============================================================================
FROM node:24-alpine AS server-builder

WORKDIR /build

# Make pnpm non-interactive
ENV CI=true

# Enable pnpm
RUN corepack enable

# Build tools for native modules (Sequelize SQLite)
RUN apk add --no-cache python3 make g++ sqlite-dev

# Copy package files first for layer caching
COPY server/package.json server/pnpm-lock.yaml ./

# Install dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Navigate into sqlite3's actual directory and build it manually
RUN cd /build/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3 && \
    npm run install && \
    ls -la build/ && \
    echo "SQLite3 build complete"

# Copy server source
COPY server/src ./src
COPY server/tsconfig.json server/tsconfig.build.json ./

# Build TypeScript to JavaScript
RUN pnpm run build

# =============================================================================
# Stage 3: Production Runtime
# =============================================================================
FROM node:24-alpine AS production

WORKDIR /app

# Make pnpm non-interactive
ENV CI=true

# Enable pnpm
RUN corepack enable

# Install runtime dependencies (curl for healthcheck, su-exec for entrypoint, build tools for native modules)
RUN apk add --no-cache curl su-exec python3 make g++ sqlite-dev

# Copy package files
COPY server/package.json server/pnpm-lock.yaml ./

# Install production dependencies (this will rebuild native modules for runtime image)
RUN pnpm install --prod --frozen-lockfile

# Navigate into sqlite3's actual directory and build it manually for production
RUN cd /app/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3 && \
    npm run install && \
    ls -la build/ && \
    echo "SQLite3 production build complete"

# Copy built server from builder
COPY --from=server-builder /build/dist ./dist

# Copy built ui to static directory
COPY --from=ui-builder /build/dist ./static

# Clean up build tools to reduce image size
RUN apk del python3 make g++

# Environment variables
ENV NODE_ENV=production \
    CONFIG_PATH=/config/config.yaml \
    DATA_PATH=/data \
    LOG_LEVEL=INFO \
    PORT=8080 \
    HOST=0.0.0.0 \
    LB_FETCH_INTERVAL=21600 \
    CATALOG_INTERVAL=604800 \
    SLSKD_INTERVAL=3600 \
    RUN_JOBS_ON_STARTUP=true

# Create non-root user (use GID/UID 1001 to avoid conflict with node user at 1000)
RUN addgroup -g 1001 resonance \
    && adduser -D -u 1001 -G resonance resonance \
    && mkdir -p /data /config \
    && chown -R resonance:resonance /app /data /config

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose web UI port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Entrypoint handles permissions and drops to resonance user
ENTRYPOINT ["docker-entrypoint.sh"]
