# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

### Monorepo (from root)
```bash
pnpm install           # Install all workspace dependencies
pnpm run dev           # Start both backend and frontend in dev mode
```

### Backend (from `/backend`)
```bash
pnpm install           # Install dependencies
pnpm run dev           # Dev server with hot reload (http://localhost:8080)
pnpm run build         # TypeScript build to dist/
pnpm start             # Production server
pnpm run lint          # ESLint check
pnpm run lint:fix      # ESLint with auto-fix
pnpm run test          # Run tests (vitest watch mode)
pnpm run test:run      # Run tests once
pnpm run test:coverage # Run tests with coverage
```

### Frontend (from `/frontend`)
```bash
pnpm install           # Install dependencies
pnpm run dev           # Vite dev server (http://localhost:5173, proxies API to backend)
pnpm run build         # Production build to dist/
```

### Docker
```bash
docker build -t resonance .
docker run -v ./config.yaml:/config/config.yaml -v ./data:/data -p 8080:8080 resonance
```

## Architecture

Resonance is a music discovery pipeline with a Node.js/TypeScript backend and Vue 3 frontend.

### Backend (`/backend/src`)

**Entry point:** `server.ts` - initializes DB, starts Express server, schedules background jobs.

**Key directories:**
- `config/` - Database setup (Sequelize/SQLite), logger (Winston), job scheduling config
- `jobs/` - Background discovery jobs:
  - `listenbrainzFetch.ts` - Fetches recommendations from ListenBrainz API
  - `catalogDiscovery.ts` - Finds similar artists via Last.fm based on Navidrome library
  - `slskdDownloader.ts` - Processes wishlist via slskd Soulseek client
- `services/` - Business logic: `QueueService.ts`, `WishlistService.ts`, and external API clients in `clients/`
- `models/` - Sequelize models: `QueueItem`, `ProcessedRecording`, `CatalogArtist`, `DiscoveredArtist`, `DownloadedItem`
- `routes/api/` - Express routes under `/api/v1/`
- `middleware/` - Auth middleware
- `plugins/` - Express app setup (`app.ts`) and job scheduler (`jobs.ts`)

**Path alias:** `@server/*` maps to `./src/*` (configured in tsconfig.json)

### Frontend (`/frontend/src`)

Vue 3 + TypeScript + Pinia + Tailwind CSS.

- `views/` - Page components: Dashboard, Queue, Login
- `components/` - Reusable UI components in `common/`, `layout/`, `queue/`
- `stores/` - Pinia state management
- `api/` - Axios API client
- `router/` - Vue Router configuration

### Data Flow

1. Discovery jobs run on schedule (ListenBrainz every 6h, Catalog weekly, slskd hourly)
2. Discovered albums go to `QueueItem` table with status `pending`
3. Web UI shows pending items for manual approval/rejection
4. Approved items go to wishlist for download via slskd

### Database

SQLite via Sequelize 7 alpha. DB file at `$DATA_PATH/resonance.sqlite` (default `/data/resonance.sqlite`).

## Code Style

- Backend uses `@stylistic/eslint-plugin` with specific formatting: 2-space indent, single quotes, aligned object values
- Frontend uses Vue 3 Composition API with `<script setup lang="ts">`
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`

## Configuration

App config is YAML at `$CONFIG_PATH` (default `/config/config.yaml`). See `config.yaml` in root for structure. Key sections: `listenbrainz`, `slskd`, `catalog_discovery`, `ui.auth`.

## Testing

Backend tests use Vitest. Test files: `*.test.ts` or `*.spec.ts` in `src/` or `tests/`. Uses `nock` for HTTP mocking, `supertest` for API testing.
