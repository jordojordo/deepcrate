# Resonance Implementation Roadmap

This document outlines the implementation plan for Resonance, broken into phases.

## Architecture Migration

**Status: Completed ✅**

The project has been migrated from Python/FastAPI to Node.js/TypeScript/Express:
- Server: Node.js + Express + TypeScript + Sequelize (SQLite)
- UI: Vue 3 + Vite + Tailwind CSS + Pinia
- Discovery jobs: Integrated as scheduled background jobs (node-cron)
- Single container deployment with Docker

---

## Phase 1: MVP (Web UI Foundation) ✅ COMPLETED

**Goal:** View and manage pending queue via web interface

### Server ✅
- [x] Express application with TypeScript
- [x] SQLite database with Sequelize 7
- [x] API endpoints:
  - [x] `GET /api/v1/queue/pending` - List pending items
  - [x] `POST /api/v1/queue/approve` - Approve items (batch)
  - [x] `POST /api/v1/queue/reject` - Reject items (batch)
  - [x] `GET /health` - Health check
- [x] Authentication middleware (Basic auth, API key, proxy mode)
- [x] QueueService and WishlistService
- [x] Config loader (YAML with env var overrides)

### UI ✅
- [x] Vue 3 + Vite + TypeScript
- [x] Tailwind CSS
- [x] Pinia state management
- [x] API client with interceptors
- [x] Views: Dashboard, Queue, Login
- [x] Components: QueueItem, Layout, Common utilities

### Infrastructure ✅
- [x] Multi-stage Dockerfile (ui build → server build → runtime)
- [x] Docker Compose example
- [x] GitHub Actions CI/CD
- [x] Docker image publishing to ghcr.io

---

## Phase 2: Discovery Integration ✅ COMPLETED

**Goal:** Automated music discovery from multiple sources

### Discovery Sources ✅
- [x] **ListenBrainz recommendations**
  - Fetches personalized track/album recommendations
  - Resolves tracks to albums via MusicBrainz
  - Runs every 6 hours (configurable)

- [x] **Catalog discovery** (Last.fm + Navidrome)
  - Syncs library artists from Navidrome
  - Queries Last.fm for similar artists
  - Aggregates and ranks by similarity
  - Fetches albums from MusicBrainz
  - Runs weekly (configurable)

### API Clients ✅
- [x] ListenBrainzClient
- [x] NavidromeClient (Subsonic API)
- [x] LastFmClient
- [x] MusicBrainzClient
- [x] CoverArtArchiveClient
- [x] SlskdClient

### Background Jobs ✅
- [x] Job scheduler (node-cron)
- [x] `listenbrainzFetch` - every 6 hours
- [x] `catalogDiscovery` - weekly
- [x] `slskdDownloader` - hourly
- [x] Configurable intervals via env vars

### Database Models ✅
- [x] QueueItem (pending, approved, rejected)
- [x] ProcessedRecording (deduplication tracking)
- [x] CatalogArtist (library artist cache)
- [x] DiscoveredArtist (catalog discovery tracking)
- [x] DownloadedItem (download history)

---

## Phase 3: Manual Controls (IN PROGRESS)

**Goal:** Trigger actions from UI

### Server Tasks
- [ ] **Manual trigger endpoints**
  - [ ] `POST /api/v1/actions/lb-fetch` - Trigger ListenBrainz fetch
  - [ ] `POST /api/v1/actions/catalog` - Trigger catalog discovery
  - [ ] `POST /api/v1/actions/downloader` - Trigger slskd downloader
  - [ ] `GET /api/v1/actions/status` - Get job status

- [ ] **Manual additions**
  - [ ] `POST /api/v1/wishlist` - Add manual entries
  - [ ] `GET /api/v1/search/musicbrainz` - Search for albums/artists

### UI Tasks
- [ ] **Actions panel on dashboard**
  - [ ] Trigger discovery jobs buttons
  - [ ] Job status indicators

- [ ] **Manual add functionality**
  - [ ] Search modal for MusicBrainz
  - [ ] Add to queue or wishlist

---

## Phase 4: Downloads Visibility

**Goal:** Monitor download pipeline

### Server Tasks
- [ ] **slskd integration endpoints**
  - [ ] `GET /api/v1/downloads/active`
  - [ ] `GET /api/v1/downloads/completed`
  - [ ] `GET /api/v1/downloads/failed`
  - [ ] `POST /api/v1/downloads/retry`
  - [ ] `GET /api/v1/wishlist`

### UI Tasks
- [ ] **Downloads view**
  - [ ] Active downloads with progress
  - [ ] Completed downloads
  - [ ] Failed downloads with retry
  - [ ] Wishlist view

---

## Phase 5: Library Duplicate Detection

**Goal:** Avoid downloading what you already own

### Server Tasks
- [ ] **Library checking**
  - [ ] Check if album exists in Navidrome library
  - [ ] Mark duplicates in queue
  - [ ] Optional: auto-reject duplicates

### UI Tasks
- [ ] **UI indicators**
  - [ ] "Already in library" badge on queue items
  - [ ] Library stats on dashboard

---

## Phase 6: Real-time Updates

**Goal:** Live updates without refresh

### Server Tasks
- [ ] **WebSocket support**
  - [ ] `WS /api/v1/ws/logs` - Live log streaming
  - [ ] `WS /api/v1/ws/downloads` - Download progress
  - [ ] `WS /api/v1/ws/queue` - Queue updates

### UI Tasks
- [ ] WebSocket connection manager
- [ ] Auto-reconnect logic
- [ ] Real-time UI updates
- [ ] Toast notifications

---

## Phase 7: UI Restructure & PrimeVue Migration

**Goal:** Align ui with bastion project structure and upgrade to PrimeVue

### UI Structure Refactor
Migrate from current structure to match `bastion` project patterns:

```
ui/src/
├── App.vue
├── main.ts
├── assets/
│   └── styles/          # CSS + custom PrimeVue theme preset
├── components/
│   ├── common/          # Shared components (LoadingSpinner, etc.)
│   ├── Dashboard/       # Dashboard-specific components
│   ├── Queue/           # Queue-specific components
│   └── Settings/        # Settings-specific components
├── composables/         # Vue 3 composables (useQueue, useAuth, etc.)
├── constants/           # Static constants
├── pages/               # Page layouts (private/public)
├── router/              # Vue Router config
├── services/            # API client (axios instance)
├── stores/              # Pinia stores
├── types/               # Centralized TypeScript types
├── utils/               # Utility functions (formatters, etc.)
└── views/
    ├── Dashboard/       # Dashboard views
    ├── Queue/           # Queue views
    └── Settings/        # Settings views
```

### Tasks
- [ ] **PrimeVue Migration**
  - [ ] Install PrimeVue 4 and dependencies (`primevue`, `primeicons`, `@primeuix/themes`)
  - [ ] Create custom theme preset (dark mode first)
  - [ ] Replace Tailwind components with PrimeVue equivalents
  - [ ] Set up ToastService for notifications
  - [ ] Add Tooltip directive

- [ ] **Structure Refactor**
  - [ ] Add `@/` path alias to vite.config.ts
  - [ ] Create `composables/` directory with useQueue, useAuth, etc.
  - [ ] Create `types/` directory for centralized TypeScript types
  - [ ] Create `utils/` directory for formatters and helpers
  - [ ] Create `constants/` directory for static data
  - [ ] Reorganize components by feature (Queue/, Dashboard/, Settings/)
  - [ ] Reorganize views by feature

- [ ] **Component Upgrades**
  - [ ] DataTable for queue list (sorting, filtering, pagination)
  - [ ] Card components for stats
  - [ ] Button components with loading states
  - [ ] Dialog/Modal components
  - [ ] Toast notifications
  - [ ] Skeleton loaders

---

## Phase 8: Polish

**Goal:** Production-ready v1.0

### Tasks
- [ ] **UI/UX**
  - [ ] Mobile responsive design
  - [ ] Dark mode support (via PrimeVue theme)
  - [ ] Keyboard shortcuts
  - [ ] Loading states and error handling
  - [ ] Empty states

- [ ] **Documentation**
  - [x] README.md with Quick Start
  - [x] CONTRIBUTING.md
  - [x] CLAUDE.md for AI coding assistants
  - [ ] API documentation (OpenAPI/Swagger)
  - [ ] Troubleshooting guide
  - [ ] Video walkthrough

- [ ] **Testing**
  - [ ] Server unit tests (vitest)
  - [ ] UI component tests
  - [ ] Integration tests
  - [ ] E2E tests

- [ ] **CI/CD Improvements**
  - [x] Automated builds
  - [x] Docker image publishing
  - [ ] Automated releases with GitHub Releases
  - [ ] Semantic versioning

---

## Future Enhancements (Post-v1.0)

- [ ] Additional discovery sources
  - [ ] Spotify API integration
  - [ ] Bandcamp scraping
  - [ ] RateYourMusic recommendations

- [ ] Notification integrations
  - [ ] Discord webhooks
  - [ ] Telegram bot
  - [ ] Email notifications

- [ ] Advanced features
  - [ ] Download quality preferences
  - [ ] Statistics and analytics dashboard
  - [ ] Multi-user support
  - [ ] Plugin system for custom sources
  - [ ] Genre filtering
  - [ ] Artist/album blocklist

---

## Technical Stack

### Server
- **Runtime:** Node.js 24
- **Framework:** Express 5
- **Language:** TypeScript
- **Database:** SQLite 3 via Sequelize 7
- **Jobs:** node-cron
- **Logging:** Winston
- **Validation:** Zod
- **Testing:** Vitest + Supertest + Nock

### UI
- **Framework:** Vue 3 (Composition API)
- **Build:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** Pinia
- **HTTP:** Axios
- **Router:** Vue Router

### Infrastructure
- **Container:** Docker (multi-stage build)
- **Registry:** ghcr.io
- **CI/CD:** GitHub Actions
- **Package Manager:** pnpm

---

## Development Workflow

### Local Development
```bash
# Install dependencies
pnpm install

# Server dev server (with hot reload)
cd server && pnpm run dev

# UI dev server (proxies API to server)
cd ui && pnpm run dev

# Run tests
cd server && pnpm run test

# Lint and format
cd server && pnpm run lint:fix
```

### Building for Production
```bash
# Build Docker image
docker build -t resonance .

# Or build individually
cd server && pnpm run build
cd ui && pnpm run build
```

### Project Structure
```
resonance/
├── server/
│   ├── src/
│   │   ├── config/         # DB, logger, settings, jobs
│   │   ├── jobs/           # Background discovery jobs
│   │   ├── services/       # Business logic + API clients
│   │   ├── models/         # Sequelize models
│   │   ├── routes/         # Express routes
│   │   ├── middleware/     # Auth, error handling
│   │   ├── plugins/        # App setup, job scheduler
│   │   ├── types/          # TypeScript types
│   │   └── server.ts       # Entry point
│   └── package.json
│
├── ui/
│   ├── src/
│   │   ├── views/          # Page components
│   │   ├── components/     # Reusable components
│   │   ├── stores/         # Pinia stores
│   │   ├── api/            # API client
│   │   └── router/         # Vue Router
│   └── package.json
│
├── docs/                   # Documentation
├── examples/               # Example configs
├── Dockerfile              # Multi-stage build
└── config.yaml             # App configuration
```

---

## Configuration

Configuration is loaded from `config.yaml` with environment variable overrides:

- `CONFIG_PATH` - Path to config.yaml (default: `/config/config.yaml` in Docker, `./config.yaml` locally)
- `DATA_PATH` - Data directory for SQLite and logs (default: `/data`)
- `PORT` - HTTP server port (default: `8080`)
- `LB_FETCH_INTERVAL` - ListenBrainz fetch interval in seconds (default: `21600` = 6h)
- `CATALOG_INTERVAL` - Catalog discovery interval in seconds (default: `604800` = 7d)
- `SLSKD_INTERVAL` - Download job interval in seconds (default: `3600` = 1h)
- `RUN_JOBS_ON_STARTUP` - Run all jobs once on startup (default: `true`)

Use `RESONANCE_*` env vars for nested config overrides:
- `RESONANCE_DEBUG=true`
- `RESONANCE_UI__AUTH__ENABLED=false`
- `RESONANCE_SLSKD__HOST=http://localhost:5030`
