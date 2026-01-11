# Resonance

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fjordojordo%2Fresonance-blue)](https://ghcr.io/jordojordo/resonance)

**Resonance** is a self-hosted music discovery pipeline that automatically finds and downloads music based on your listening habits and existing library. It combines multiple discovery sources into a unified approval workflow with a modern web UI.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RESONANCE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    Your Music Library          Your Listening History                       │
│    (Navidrome/etc)             (ListenBrainz scrobbles)                     │
│          │                              │                                   │
│          ▼                              ▼                                   │
│    ┌───────────┐                 ┌────────────┐                             │
│    │ Catalog   │                 │ lb-fetch   │                             │
│    │ Discovery │                 │            │                             │
│    │ (Last.fm) │                 │(ListenBrainz)                            │
│    └─────┬─────┘                 └──────┬─────┘                             │
│          │                              │                                   │
│          └──────────────┬───────────────┘                                   │
│                         ▼                                                   │
│              ┌─────────────────────┐                                        │
│              │   Pending Queue     │◄──── Web UI (approve/reject)           │
│              │  (unified approval) │                                        │
│              └──────────┬──────────┘                                        │
│                         ▼                                                   │
│              ┌─────────────────────┐                                        │
│              │  slskd-downloader   │                                        │
│              │   (Soulseek P2P)    │                                        │
│              └──────────┬──────────┘                                        │
│                         ▼                                                   │
│              ┌─────────────────────┐                                        │
│              │  Downloaded Music   │──────► Your Music Library              │
│              └─────────────────────┘                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

- **Multi-source discovery** - Combines ListenBrainz recommendations (based on what you listen to) with Last.fm similar artists (based on what you own)
- **Unified approval queue** - Review all recommendations in one place before downloading
- **Modern web UI** - Dashboard with cover art, metadata, and one-click approve/reject
- **Automatic downloads** - Integrates with slskd (Soulseek) for P2P music downloads
- **Library awareness** - Checks your existing library to avoid duplicates
- **Flexible auth** - Built-in API auth or integrate with Authelia/OAuth
- **Single container** - Everything runs in one Docker image

## Quick Start

### Prerequisites

- Docker and Docker Compose
- [slskd](https://github.com/slskd/slskd) running with API enabled
- [Navidrome](https://www.navidrome.org/) or compatible music server (for catalog discovery)
- [ListenBrainz](https://listenbrainz.org/) account with scrobbling set up
- [Last.fm API key](https://www.last.fm/api/account/create) (free)

### 1. Create configuration

```bash
mkdir -p resonance/data
cd resonance
```

Create `config.yaml`:

```yaml
# ListenBrainz recommendations (based on listening history)
listenbrainz:
  username: "your_username"
  token: "your_token"           # From https://listenbrainz.org/settings/
  approval_mode: "manual"       # "auto" or "manual"

mode: album                     # "album" or "track"
fetch_count: 100

# slskd connection
slskd:
  host: "http://slskd:5030"
  api_key: "your_slskd_api_key"

# Catalog discovery (based on library artists → Last.fm similar)
catalog_discovery:
  enabled: true
  navidrome:
    host: "http://navidrome:4533"
    username: "your_username"
    password: "your_password"
  lastfm:
    api_key: "your_lastfm_api_key"
  max_artists_per_run: 10
  min_similarity: 0.3
  mode: "manual"

# Web UI settings
ui:
  auth:
    enabled: true
    type: "basic"               # "basic", "api_key", or "none"
    username: "admin"
    password: "changeme"        # Change this!
```

### 2. Run with Docker Compose

Create `docker-compose.yaml`:

```yaml
services:
  resonance:
    image: ghcr.io/jordojordo/resonance:latest
    container_name: resonance
    environment:
      - TZ=America/New_York
    volumes:
      - ./config.yaml:/config/config.yaml:ro
      - ./data:/data
    ports:
      - "8080:8080"
    restart: unless-stopped
```

```bash
docker compose up -d
```

### 3. Access the UI

Open `http://localhost:8080` and log in with your configured credentials.

## Discovery Sources

### ListenBrainz (lb-fetch)

Fetches track recommendations from ListenBrainz based on your listening history (scrobbles). Recommendations are resolved to albums via MusicBrainz.

**How it works:**
1. You listen to music → Navidrome scrobbles to ListenBrainz
2. ListenBrainz builds a taste profile and generates recommendations
3. lb-fetch pulls recommendations every 6 hours
4. Tracks are resolved to parent albums
5. Albums go to pending queue (manual mode) or wishlist (auto mode)

**Requirements:**
- ListenBrainz account with active scrobbling
- Several weeks of listening history for good recommendations

### Catalog Discovery

Finds new artists similar to ones you already own using Last.fm's similarity data.

**How it works:**
1. Scans your Navidrome library for artists
2. Queries Last.fm for similar artists
3. Ranks by aggregate similarity (artists similar to multiple library artists score higher)
4. Fetches discographies from MusicBrainz
5. Albums go to pending queue (manual mode) or wishlist (auto mode)

**Requirements:**
- Navidrome with Subsonic API enabled
- Last.fm API key

## Configuration Reference

See [docs/configuration.md](docs/configuration.md) for full configuration options.

## Web UI

The web UI provides:

- **Dashboard** - Quick stats and recent activity
- **Pending Queue** - Review and approve/reject recommendations
- **Downloads** - Monitor slskd download status
- **Settings** - Configure discovery parameters

## Authentication

### Built-in Auth

Resonance includes built-in authentication options:

```yaml
ui:
  auth:
    enabled: true
    type: "basic"        # HTTP Basic Auth
    username: "admin"
    password: "secure_password"
```

Or use API key authentication:

```yaml
ui:
  auth:
    enabled: true
    type: "api_key"
    api_key: "your_secret_api_key"
```

### Authelia Integration

For advanced authentication (SSO, 2FA, LDAP), integrate with [Authelia](https://www.authelia.com/) via your reverse proxy. See [docs/authelia-integration.md](docs/authelia-integration.md).

## API

Resonance exposes a REST API for automation and integration:

```
GET  /api/v1/queue/pending      # List pending items
POST /api/v1/queue/approve      # Approve items
POST /api/v1/queue/reject       # Reject items
POST /api/v1/actions/lb-fetch   # Trigger lb-fetch
POST /api/v1/actions/catalog    # Trigger catalog discovery
GET  /api/v1/health             # Health check
```

See [docs/api.md](docs/api.md) for full API documentation.

## Architecture

Resonance runs multiple services in a single container using s6-overlay:

| Service | Schedule | Purpose |
|---------|----------|---------|
| lb-fetch | Every 6 hours | ListenBrainz recommendations |
| catalog-discovery | Weekly | Last.fm similar artists |
| slskd-downloader | Every hour | Process wishlist via slskd |
| web-ui | Always | FastAPI + Vue web interface |

See [docs/architecture.md](docs/architecture.md) for technical details.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `UTC` | Timezone |
| `LB_FETCH_INTERVAL` | `21600` | Seconds between lb-fetch runs (6h) |
| `CATALOG_INTERVAL` | `604800` | Seconds between catalog discovery (7d) |
| `SLSKD_INTERVAL` | `3600` | Seconds between download runs (1h) |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

## Data Directory

All state is stored in `/data`:

```
/data/
├── wishlist.txt              # Albums to download
├── pending_queue.json        # Awaiting approval
├── processed.json            # Already-fetched from ListenBrainz
├── downloaded.json           # Already-sent to slskd
├── catalog_artists.json      # Cached library artists
└── catalog_discovered.json   # Already-discovered artists
```

## Network Requirements

Resonance needs network access to:

| Service | Purpose |
|---------|---------|
| slskd | Queue downloads |
| Navidrome | Scan library artists |
| api.listenbrainz.org | Fetch recommendations |
| ws.audioscrobbler.com | Last.fm similar artists |
| musicbrainz.org | Album metadata |
| coverartarchive.org | Album artwork |

## Development

### Building from source

```bash
git clone https://github.com/jordojordo/resonance.git
cd resonance
docker build -t resonance .
```

### Running locally

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn api.main:app --reload

# Frontend
cd frontend
pnpm install
pnpm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Roadmap

- [x] ListenBrainz recommendations (lb-fetch)
- [x] Catalog-based discovery (Last.fm similar artists)
- [x] Unified pending queue with manual approval
- [ ] Web UI (Phase 1 - MVP)
- [ ] Download status dashboard
- [ ] Library duplicate checking
- [ ] Real-time WebSocket updates
- [ ] Mobile-responsive design
- [ ] Notification webhooks (Discord, etc.)

## Related Projects

- [slskd](https://github.com/slskd/slskd) - Modern Soulseek client
- [Navidrome](https://www.navidrome.org/) - Music streaming server
- [ListenBrainz](https://listenbrainz.org/) - Open music listening data
- [Lidarr](https://lidarr.audio/) - Music collection manager (alternative approach)

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

## Acknowledgments

- [ListenBrainz](https://listenbrainz.org/) for the recommendations API
- [MusicBrainz](https://musicbrainz.org/) for comprehensive music metadata
- [Last.fm](https://www.last.fm/) for similar artist data
- [slskd](https://github.com/slskd/slskd) for the excellent Soulseek client

---

**Resonance** - *Let your music library guide you to new discoveries.*
