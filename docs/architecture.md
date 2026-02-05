# Resonance Architecture

## Overview

Resonance is designed as a self-contained, single-container application that runs multiple services using s6-overlay for process supervision. This document describes the technical architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESONANCE CONTAINER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        s6-overlay (PID 1)                           │    │
│  │                     Process Supervisor                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                │                │                │                │
│         ▼                ▼                ▼                ▼                │
│  ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐           │
│  │ lb-fetch  │    │ catalog-  │    │  slskd-   │    │  web-ui   │           │
│  │           │    │ discovery │    │downloader │    │ (FastAPI) │           │
│  │ (6 hours) │    │ (weekly)  │    │ (1 hour)  │    │  (:8080)  │           │
│  └─────┬─────┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘           │
│        │                │                │                │                 │
│        └────────────────┴────────────────┴────────────────┘                 │
│                                    │                                        │
│                         ┌──────────┴──────────────┐                         │
│                         │   /data (volume)        │                         │
│                         │  - pending_queue.json   │                         │
│                         │  - wishlist.txt         │                         │
│                         │  - processed.json       │                         │
│                         │  - downloaded.json      │                         │
│                         │  - catalog_*.json       │                         │
│                         └─────────────────────────┘                         │
│                                                                             │
└──────────────────────────────────────────────────────────────────────────┬──┘
                                                                           │
                    ┌──────────────────────────────────────────────────────┤
                    │                                                      │
                    ▼                                                      ▼
          ┌─────────────────┐                                   ┌─────────────────┐
          │  External APIs  │                                   │  Local Services │
          ├─────────────────┤                                   ├─────────────────┤
          │ • ListenBrainz  │                                   │ • slskd         │
          │ • MusicBrainz   │                                   │ • Subsonic      │
          │ • Last.fm       │                                   │                 │
          │ • CoverArtArchive                                   │                 │
          └─────────────────┘                                   └─────────────────┘
```

## Components

### s6-overlay

[s6-overlay](https://github.com/just-containers/s6-overlay) provides:
- Process supervision (auto-restart on crash)
- Proper signal handling (graceful shutdown)
- Dependency management between services
- Log handling

Each service is defined in `/etc/s6-overlay/s6-rc.d/`:

```
/etc/s6-overlay/s6-rc.d/
├── user/
│   └── contents.d/
│       ├── lb-fetch
│       ├── catalog-discovery
│       ├── slskd-downloader
│       └── web-ui
├── lb-fetch/
│   ├── type              # "longrun"
│   ├── run               # Service start script
│   └── dependencies.d/
│       └── base          # Waits for base setup
├── catalog-discovery/
│   ├── type
│   ├── run
│   └── dependencies.d/
│       └── base
├── slskd-downloader/
│   ├── type
│   ├── run
│   └── dependencies.d/
│       └── lb-fetch      # Waits for first lb-fetch run
└── web-ui/
    ├── type
    ├── run
    └── dependencies.d/
        └── base
```

### Discovery Services

#### lb-fetch

**Purpose:** Fetch album recommendations from ListenBrainz based on listening history.

**Flow:**
1. Query ListenBrainz recommendation API
2. Resolve track MBIDs to album release-groups via MusicBrainz
3. Deduplicate against `processed.json`
4. Output to `wishlist.txt` (auto) or `pending_queue.json` (manual)

**Schedule:** Every 6 hours (configurable via `LB_FETCH_INTERVAL`)

**State files:**
- `processed.json` - Album MBIDs already fetched

#### catalog-discovery

**Purpose:** Find new artists similar to ones in your library using Last.fm.

**Flow:**
1. Fetch library artists from Subsonic server (Navidrome, Gonic, Airsonic, etc.)
2. Query Last.fm `artist.getSimilar` for each artist
3. Aggregate similarity scores (artists similar to multiple library artists rank higher)
4. Filter out artists already in library
5. Fetch discographies from MusicBrainz
6. Output to `wishlist.txt` (auto) or `pending_queue.json` (manual)

**Schedule:** Weekly (configurable via `CATALOG_INTERVAL`)

**State files:**
- `catalog_artists.json` - Cached library artists
- `catalog_discovered.json` - Artists already processed

#### slskd-downloader

**Purpose:** Process wishlist entries by searching and queueing downloads in slskd.

**Flow:**
1. Read `wishlist.txt`
2. For each entry, search slskd
3. Score results (file count, format, user speed)
4. Queue best match for download
5. Record in `downloaded.json`

**Schedule:** Every hour (configurable via `SLSKD_INTERVAL`)

**State files:**
- `downloaded.json` - Wishlist entries already sent to slskd

### Web UI

**Stack:**
- **Server:** Node.js
- **UI:** Vue 3 + Tailwind CSS
- **Build:** Vite

**Purpose:**
- View and manage pending queue
- Monitor download status
- Trigger manual discovery runs
- Configure settings

**API endpoints:** See [api.md](api.md)

## Data Flow

### Manual Approval Mode (Default)

```
Discovery Sources                 Pending Queue                    Download
      │                                │                               │
      │   lb-fetch                     │                               │
      │   catalog-discovery            │                               │
      │           │                    │                               │
      │           ▼                    │                               │
      │   pending_queue.json ──────────┤                               │
      │           │                    │                               │
      │           │◄─── User approves ─┤                               │
      │           │     via Web UI     │                               │
      │           ▼                    │                               │
      │   wishlist.txt ────────────────┼───────────────────────────────┤
      │           │                    │                               │
      │           ▼                    │                               ▼
      │   slskd-downloader             │                          slskd
      │           │                    │                               │
      │           ▼                    │                               ▼
      │   downloaded.json              │                    /mnt/music/Downloads/
```

### Auto Mode

```
Discovery Sources                                          Download
      │                                                        │
      │   lb-fetch                                             │
      │   catalog-discovery                                    │
      │           │                                            │
      │           ▼                                            │
      │   wishlist.txt ────────────────────────────────────────┤
      │           │                                            │
      │           ▼                                            ▼
      │   slskd-downloader                                slskd
      │           │                                            │
      │           ▼                                            ▼
      │   downloaded.json                          /mnt/music/Downloads/
```

## File Formats

### pending_queue.json

```json
{
  "pending": [
    {
      "artist": "Justice",
      "album": "Cross",
      "mbid": "abc123-...",
      "type": "album",
      "added_at": "2026-01-11T10:00:00Z",
      "score": 82.5,
      "source": "catalog",
      "similar_to": ["Daft Punk", "Kavinsky"],
      "cover_url": "https://coverartarchive.org/...",
      "year": 2007
    },
    {
      "artist": "Boards of Canada",
      "album": "Music Has the Right to Children",
      "mbid": "def456-...",
      "type": "album",
      "added_at": "2026-01-11T10:00:00Z",
      "score": 85,
      "source": "listenbrainz",
      "source_track": "Roygbiv",
      "cover_url": "https://coverartarchive.org/...",
      "year": 1998
    }
  ],
  "approved": [],
  "rejected": ["mbid-of-rejected-album"]
}
```

### wishlist.txt

```
a:"Artist Name - Album Title"
a:"Another Artist - Another Album"
```

The `a:` prefix indicates album mode (vs track mode).

### processed.json / downloaded.json / catalog_discovered.json

Simple JSON arrays of identifiers (MBIDs or entry strings).

## API Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FastAPI Application                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Routers   │  │  Services   │  │   Models    │              │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤              │
│  │ • queue     │  │ • queue_mgr │  │ • QueueItem │              │
│  │ • wishlist  │  │ • slskd     │  │ • Settings  │              │
│  │ • downloads │  │ • subsonic  │  │ • Download  │              │
│  │ • actions   │  │ • scripts   │  │ • etc.      │              │
│  │ • settings  │  │ • config    │  │             │              │
│  │ • health    │  │             │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                │                                      │
│         └────────────────┤                                      │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │   Auth Middleware     │                          │
│              │  (Basic / API Key)    │                          │
│              └───────────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Security Model

### Built-in Authentication

Three options:

1. **HTTP Basic Auth** - Username/password login form
2. **API Key Auth** - Bearer token login form
3. **Proxy Auth** - Delegates to external auth (Authelia, etc.), auto-redirects users

### Authelia Integration

For production deployments, use Authelia via reverse proxy forward auth:

```
Client → Reverse Proxy (Caddy/nginx/Traefik) → Authelia (verify) → Resonance
```

Supported reverse proxies:
- **Caddy** - Recommended for automatic HTTPS and simpler configuration
- **nginx** - Traditional choice with extensive ecosystem
- **Traefik** - Container-native with automatic service discovery

See [authelia-integration.md](authelia-integration.md) for configuration examples.

## Resource Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2 cores |
| RAM | 256 MB | 512 MB |
| Storage | 100 MB | 500 MB (for logs) |
| Network | Required | Required |

The container is lightweight - most resource usage comes from API calls to external services.

## Scalability

Resonance is designed for single-user/household use. It is **not** designed for:
- Multi-tenant deployments
- Horizontal scaling
- High-availability

For larger deployments, consider running multiple instances with separate configs.

## Logging

Logs are written to stdout/stderr and can be viewed via:

```bash
docker logs resonance
docker logs -f resonance  # Follow
```

Log levels are controlled via `LOG_LEVEL` environment variable.
To also write `/data/combined.log` and `/data/error.log`, set `LOG_TO_FILE=true` (optionally `LOG_DIR`).

## Failure Handling

| Failure | Behavior |
|---------|----------|
| API request fails | Logged, continues to next item |
| Service crashes | s6-overlay restarts it automatically |
| Container restart | All services resume, state preserved in /data |
| slskd unreachable | Downloads skip, retry next run |
| Subsonic server unreachable | Catalog discovery skips run |

## Future Architecture Considerations

### WebSocket Support

Phase 5 will add WebSocket endpoints for real-time updates:

```
/api/v1/ws/logs       - Live log streaming
/api/v1/ws/downloads  - Download progress
/api/v1/ws/queue      - Queue change notifications
```

### Plugin System (Future)

Potential future enhancement - pluggable discovery sources:

```python
class DiscoverySource(Protocol):
    def fetch(self) -> list[Recommendation]: ...
    def get_schedule(self) -> str: ...
```
