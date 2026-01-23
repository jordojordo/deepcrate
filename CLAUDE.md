# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

### Monorepo (from root)
```bash
pnpm install           # Install all workspace dependencies
pnpm run dev           # Start both server and ui in dev mode
```

### Server (from `/server`)
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

### UI (from `/ui`)
```bash
pnpm install           # Install dependencies
pnpm run dev           # Vite dev server (http://localhost:5173, proxies API to server)
pnpm run build         # Production build to dist/
```

### Docker
```bash
docker build -t resonance .
docker run -v ./config.yaml:/config/config.yaml -v ./data:/data -p 8080:8080 resonance
```

## Architecture

Resonance is a music discovery pipeline with a Node.js/TypeScript server and Vue 3 ui.

### Server (`/server/src`)

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

### UI (`/ui/src`)

Vue 3 + TypeScript + Pinia + PrimeVue 4.

**Key directories:**
- `pages/private/` - Authenticated page components: DashboardPage, QueuePage
- `pages/public/` - Public page components: LoginPage
- `components/` - Reusable UI components:
  - `common/` - LoadingSpinner, StatsCard
  - `layout/` - AppShell, SidebarNavList
  - `queue/` - QueueFilters, QueueList
- `stores/` - Pinia state management (source of truth for state)
- `composables/` - Reusable composition functions: useQueue, useAuth, useToast, useStats
- `services/` - API clients (Axios): api.ts (base client), queue.ts
- `types/` - TypeScript type definitions organized by feature: queue.ts, auth.ts, api.ts
- `utils/` - Utility functions: formatters.ts, validation.ts
- `constants/` - Static constants: queue.ts, routes.ts
- `assets/styles/` - Theme preset (theme.ts) and global styles (index.css)
- `router/` - Vue Router configuration

**Path alias:** `@/*` maps to `./src/*` (configured in vite.config.ts and tsconfig.app.json)

**Theme:** Custom Resonance preset extending PrimeVue Aura base theme with indigo primary colors and dark mode optimized surfaces. See `assets/styles/theme.ts`.

**Composables Pattern:** Composables wrap Pinia stores for convenient access and don't duplicate state. Always use composables in page components for better separation of concerns.

### Data Flow

1. Discovery jobs run on schedule (ListenBrainz every 6h, Catalog weekly, slskd hourly)
2. Discovered albums go to `QueueItem` table with status `pending`
3. Web UI shows pending items for manual approval/rejection
4. Approved items go to wishlist for download via slskd

### Database

SQLite via Sequelize 7 alpha. DB file at `$DATA_PATH/resonance.sqlite` (default `/data/resonance.sqlite`).

## Code Style

- Server uses `@stylistic/eslint-plugin` with specific formatting: 2-space indent, single quotes, aligned object values
- UI uses Vue 3 Composition API with `<script setup lang="ts">`
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Prefer small, focused functions over large ones (aim for <30 lines per function)
- New services should follow existing patterns in `services/`—check before creating new abstractions

## Configuration

App config is YAML at `$CONFIG_PATH` (default `/config/config.yaml`). See `config.yaml` in root for structure. Key sections: `listenbrainz`, `slskd`, `catalog_discovery`, `ui.auth`.

## Testing

Server tests use Vitest. Test files: `*.test.ts` or `*.spec.ts` in `src/` or `tests/`. Uses `nock` for HTTP mocking, `supertest` for API testing.

## Implementation Guidelines

### Pacing & Review Checkpoints

- **One file at a time.** Implement changes to a single file, then stop for review before moving to the next. Do not modify multiple files in a single response unless they are trivially coupled (e.g., a type definition and its single consumer).

- **100 line limit.** If a change exceeds ~100 lines, break it into smaller chunks. Stop and ask how to proceed.

- **Show structure first.** Before implementing a new module or feature, show the proposed interfaces, types, and function signatures. Wait for approval before writing implementation bodies.

- **Explain as you go.** When writing code, include brief inline comments or explanations for non-obvious decisions. If you can't explain why, reconsider the approach.

- **No drive-by refactors.** Only modify code directly related to the current task. If you notice something that should be refactored, note it separately—don't fix it in the same change.

### Planning Phase

When asked to implement a feature:
1. Ask clarifying questions first—do not assume
2. Propose a plan with discrete, reviewable steps
3. Wait for approval before starting implementation
4. Implement one step at a time

### Testing

- New features require tests before the implementation is considered complete
- Run `pnpm run test:run` to verify changes don't break existing tests

### Command Patterns

When a prompt includes "plan" or "planning", produce ONLY:
- Clarifying questions (if any)
- A numbered implementation plan

Do not write any code until explicitly told "begin implementation" or "implement step N".
