# Configuration Reference

Resonance is configured via a YAML file mounted at `/config/config.yaml`.

## Full Configuration Example

```yaml
# =============================================================================
# ListenBrainz Discovery
# Recommendations based on your listening history (scrobbles)
# =============================================================================
# Enable debug logging/features (optional)
debug: false

listenbrainz:
  # Your ListenBrainz username
  username: "your_username"

  # API token from https://listenbrainz.org/settings/
  token: "your_token"

  # Approval mode: "auto" or "manual"
  # auto:   Adds directly to wishlist for immediate download
  # manual: Adds to pending queue for review in Web UI
  approval_mode: "manual"

# Recommendation mode: "album" or "track"
# album: Resolve recommended tracks to their parent albums (recommended)
# track: Download individual tracks only
mode: "album"

# Minimum recommendation score (0-100)
# 0 = accept all recommendations
# Higher values = only highly-relevant recommendations
min_score: 0

# Number of recommendations to fetch per run
fetch_count: 100

# =============================================================================
# slskd Connection
# Soulseek client for downloading music
# =============================================================================
slskd:
  # slskd API URL
  host: "http://slskd:5030"

  # API key from slskd.yml (web.authentication.api_keys)
  api_key: "your_slskd_api_key"

  # URL base path (usually "/")
  url_base: "/"

  # Search timeout in milliseconds
  search_timeout: 15000

  # Minimum tracks to consider a valid album result
  # Helps filter out incomplete uploads
  min_album_tracks: 3

# =============================================================================
# Catalog Discovery
# Find new artists similar to ones you already own via Last.fm
# =============================================================================
catalog_discovery:
  # Enable/disable catalog discovery
  enabled: true

  # Navidrome connection (Subsonic API)
  navidrome:
    host: "http://navidrome:4533"
    username: "your_username"
    password: "your_password"

  # Last.fm API (get free key from https://www.last.fm/api/account/create)
  lastfm:
    api_key: "your_lastfm_api_key"

  # Maximum new artists to discover per run
  max_artists_per_run: 10

  # Minimum similarity score (0-1)
  # Higher = safer bets, lower = more adventurous
  # 0.3 is a good balance
  min_similarity: 0.3

  # Number of similar artists to fetch per library artist
  similar_artist_limit: 10

  # Number of albums to queue per discovered artist
  albums_per_artist: 3

  # Approval mode: "auto" or "manual"
  mode: "manual"

# =============================================================================
# Web UI Settings
# =============================================================================
ui:
  # Authentication settings
  auth:
    # Enable authentication (strongly recommended)
    enabled: true

    # Auth type: "basic", "api_key", or "proxy"
    type: "basic"

    # For type: "basic"
    username: "admin"
    password: "changeme"    # CHANGE THIS!

    # For type: "api_key"
    # api_key: "your_secret_api_key"

```

## Environment Variables

Environment variables can override or supplement the config file:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address for the server |
| `PORT` | `8080` | Port for the server |
| `LB_FETCH_INTERVAL` | `21600` | Seconds between lb-fetch runs (default: 6 hours) |
| `CATALOG_INTERVAL` | `604800` | Seconds between catalog discovery (default: 7 days) |
| `SLSKD_INTERVAL` | `3600` | Seconds between download runs (default: 1 hour) |
| `LIBRARY_SYNC_INTERVAL` | `86400` | Seconds between library sync runs (default: 24 hours) |
| `RUN_JOBS_ON_STARTUP` | `true` | Run jobs once on startup (`false` to disable) |
| `LOG_LEVEL` | `debug` (dev), `info` (prod) | Logging level (case-insensitive): `debug`, `info`, `warn`, `error` |
| `LOG_DIR` | `DATA_PATH` | Directory for log files (when file logging is enabled) |
| `LOG_TO_CONSOLE` | `true` | Enable console logging (stdout/stderr) |
| `LOG_TO_FILE` | `false` | Enable file logging |
| `CONFIG_PATH` | `/config/config.yaml` | Path to config file |
| `DATA_PATH` | `/data` | Path to data directory |
| `RESONANCE_DB_FILE` | `DATA_PATH/resonance.sqlite` | SQLite DB file path |
| `RESONANCE_DB_LOGGING` | `false` | Enable Sequelize SQL logging (`true`/`false`) |

### Override Config Values via Environment

Config values can be overridden using environment variables with the `RESONANCE_` prefix:

```bash
# Override ListenBrainz username
RESONANCE_LISTENBRAINZ__USERNAME=myuser

# Override slskd host
RESONANCE_SLSKD__HOST=http://10.100.0.11:5030

# Override catalog discovery enabled
RESONANCE_CATALOG_DISCOVERY__ENABLED=false
```

Note: Use double underscore `__` for nested keys.

## Configuration Sections

### ListenBrainz

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `username` | string | Yes | - | Your ListenBrainz username |
| `token` | string | Yes | - | API token from LB settings |
| `approval_mode` | string | No | `manual` | `auto` or `manual` |

### Mode Settings

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `debug` | bool | No | `false` | Enable debug logging/features |
| `mode` | string | No | `album` | `album` or `track` |
| `min_score` | float | No | `0` | Minimum recommendation score (0-100) |
| `fetch_count` | int | No | `100` | Recommendations per run |

### slskd

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `host` | string | Yes | - | slskd API URL |
| `api_key` | string | Yes | - | slskd API key |
| `url_base` | string | No | `/` | URL base path |
| `search_timeout` | int | No | `15000` | Search timeout (ms) |
| `min_album_tracks` | int | No | `3` | Min tracks for album |

### Catalog Discovery

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `enabled` | bool | No | `false` | Enable catalog discovery |
| `navidrome.host` | string | Yes* | - | Navidrome URL |
| `navidrome.username` | string | Yes* | - | Navidrome username |
| `navidrome.password` | string | Yes* | - | Navidrome password |
| `lastfm.api_key` | string | Yes* | - | Last.fm API key |
| `max_artists_per_run` | int | No | `10` | Max new artists per run |
| `min_similarity` | float | No | `0.3` | Min similarity (0-1) |
| `similar_artist_limit` | int | No | `10` | Similar artists per query |
| `albums_per_artist` | int | No | `3` | Albums per new artist |
| `mode` | string | No | `manual` | `auto` or `manual` |

*Required if `enabled: true`

### Library Duplicate Detection

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `enabled` | bool | No | `false` | Enable library duplicate checking |
| `auto_reject` | bool | No | `false` | Auto-reject items already in library |

Requires `catalog_discovery.navidrome` to be configured for library sync.

### UI Authentication

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `enabled` | bool | No | `false` | Enable authentication |
| `type` | string | No | `basic` | `basic`, `api_key`, `proxy` |
| `username` | string | Yes* | - | Username for basic auth |
| `password` | string | Yes* | - | Password for basic auth |
| `api_key` | string | Yes** | - | API key for api_key auth |

*Required if `type: basic`
**Required if `type: api_key`

## Minimal Configuration

The bare minimum to run Resonance with ListenBrainz only:

```yaml
listenbrainz:
  username: "your_username"
  token: "your_token"

slskd:
  host: "http://slskd:5030"
  api_key: "your_api_key"
```

## Docker Compose with Environment

```yaml
services:
  resonance:
    image: ghcr.io/jordonet/resonance:latest
    environment:
      - LB_FETCH_INTERVAL=21600
      - CATALOG_INTERVAL=604800
      - SLSKD_INTERVAL=3600
      - LOG_LEVEL=info
    volumes:
      - ./config.yaml:/config/config.yaml:ro
      - ./data:/data
    ports:
      - "8080:8080"
```

## Config Validation

On startup, Resonance validates the configuration and logs any issues:

```
2026-01-11 10:00:00 - INFO - Loading configuration from /config/config.yaml
2026-01-11 10:00:00 - INFO - ListenBrainz: enabled (user: saybis)
2026-01-11 10:00:00 - INFO - Catalog Discovery: enabled
2026-01-11 10:00:00 - INFO - slskd: http://10.100.0.11:5030
2026-01-11 10:00:00 - INFO - Web UI auth: basic
```

If required fields are missing:

```
2026-01-11 10:00:00 - ERROR - Missing required config: listenbrainz.token
```

## Secrets Management

For production, avoid putting secrets directly in config files:

### Option 1: Environment Variables

```yaml
listenbrainz:
  username: "saybis"
  token: "${LISTENBRAINZ_TOKEN}"  # Populated from env
```

### Option 2: Docker Secrets

```yaml
# docker-compose.yaml
services:
  resonance:
    secrets:
      - listenbrainz_token
      - slskd_api_key
    environment:
      - RESONANCE_LISTENBRAINZ__TOKEN_FILE=/run/secrets/listenbrainz_token

secrets:
  listenbrainz_token:
    file: ./secrets/listenbrainz_token.txt
  slskd_api_key:
    file: ./secrets/slskd_api_key.txt
```

### Option 3: External Secret Manager

For Kubernetes or advanced setups, mount secrets as files and reference via `*_FILE` environment variables.
