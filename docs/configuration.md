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
  # Only required if source_type is "collaborative"
  # token: "your_token"

  # Approval mode: "auto" or "manual"
  # auto:   Adds directly to wishlist for immediate download
  # manual: Adds to pending queue for review in Web UI
  approval_mode: "manual"

  # Source type: where to get recommendations from
  # weekly_playlist: Uses weekly exploration playlists (default, no token needed)
  # collaborative: Uses CF recommendations based on listening history (requires token)
  source_type: "weekly_playlist"

# Recommendation mode: "album" or "track"
# album: Resolve recommended tracks to their parent albums (recommended)
# track: Download individual tracks only
mode: "album"

# Minimum recommendation score (0-100)
# 0 = accept all recommendations
# Higher values = only highly-relevant recommendations
# (If you prefer, you can also use 0-1 and it will be treated as a fraction.)
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

  # Search timeout in milliseconds (legacy, prefer search.search_timeout_ms)
  search_timeout: 15000

  # Minimum tracks to consider a valid album result (legacy, prefer search.min_response_files)
  # Helps filter out incomplete uploads
  min_album_tracks: 3

  # Advanced search configuration (optional)
  search:
    # Query templates - variables: {artist}, {album}, {title}, {year}
    album_query_template: "{artist} {album}"
    track_query_template: "{artist} {title}"

    # Fallback queries to try if primary search returns no results
    # Tried in order when retry is enabled
    fallback_queries:
      - "{album}"
      - "{artist} {album} {year}"

    # Terms to remove when simplifying queries (e.g., on retry)
    exclude_terms:
      - "live"
      - "remix"
      - "cover"
      - "karaoke"

    # Search timing
    search_timeout_ms: 15000      # Timeout for slskd search API call
    max_wait_ms: 20000            # Max time to wait for search completion

    # Response filtering
    min_response_files: 3         # Minimum files to consider a valid result
    max_responses_to_evaluate: 50 # Limit responses to evaluate (performance)

    # File size constraints (MB) - filters out suspiciously small/large files
    min_file_size_mb: 1
    max_file_size_mb: 500

    # Album preferences (soft scoring, not strict filters)
    prefer_complete_albums: true  # Bonus score for results with enough tracks
    prefer_album_folder: true     # Bonus score for proper folder structure

    # Retry configuration
    retry:
      enabled: false              # Enable retry with fallback queries
      max_attempts: 3             # Total attempts including primary
      simplify_on_retry: true     # Simplify query (remove diacritics, special chars)
      delay_between_retries_ms: 5000

    # Audio quality preferences (optional)
    quality_preferences:
      enabled: true               # Enable quality-based filtering and scoring
      preferred_formats:          # Formats to prioritize (bonus scoring)
        - flac
        - wav
        - alac
        - mp3
        - m4a
        - ogg
      min_bitrate: 256            # Minimum acceptable bitrate (kbps) for lossy formats
      prefer_lossless: true       # Give lossless formats higher priority
      reject_low_quality: false   # Hard reject files below min_bitrate (vs just deprioritize)
      reject_lossless: false      # Hard reject lossless files (for users who only want lossy)

  # Interactive selection mode (optional)
  # Allows manual review and selection of search results before downloading
  selection:
    mode: "auto"                  # "auto" (default) or "manual"
    timeout_hours: 24             # Hours before pending selection expires (0 = no timeout)

# =============================================================================
# Catalog Discovery
# Find new artists similar to ones you already own
# =============================================================================
catalog_discovery:
  # Enable/disable catalog discovery
  enabled: true

  # Subsonic server connection (Navidrome, Gonic, Airsonic, etc.)
  # Note: "navidrome:" key is deprecated but still supported for backward compatibility
  subsonic:
    host: "http://navidrome:4533"
    username: "your_username"
    password: "your_password"

  # Last.fm API (get free key from https://www.last.fm/api/account/create)
  lastfm:
    api_key: "your_lastfm_api_key"

  # ListenBrainz (optional) - no API key needed
  # Uses ListenBrainz Labs similar artists API
  listenbrainz:
    enabled: true

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
# Library Duplicate Detection (Optional)
# Avoid downloading albums you already own
# Requires catalog_discovery.subsonic to be configured
# =============================================================================
library_duplicate:
  # Enable library duplicate checking
  enabled: true

  # Auto-reject items that already exist in your library
  # If false, items are just marked as "In Library" for manual review
  auto_reject: false

# =============================================================================
# Library Organization (Optional)
# Move completed slskd downloads into your music library
# =============================================================================
library_organize:
  # Enable library organization
  enabled: false

  # Where slskd saves completed downloads (must be accessible to Resonance)
  # This path must be mounted as a volume in your docker-compose.yaml
  downloads_path: "/downloads/complete"

  # Destination music library path (must be accessible to Resonance)
  # This path must be mounted as a volume in your docker-compose.yaml
  library_path: "/music/library"

  # Organization mode: "flat" or "artist_album"
  # flat: Places album folders directly in library_path
  # artist_album: Creates Artist/Album folder structure
  organization: "artist_album"

  # If true, run automatically on an interval (see LIBRARY_ORGANIZE_INTERVAL env var)
  auto_organize: false

  # Delete the source folder after a successful transfer
  delete_after_move: true

  # Trigger a Subsonic server rescan after organizing (requires catalog_discovery.subsonic)
  # Note: "navidrome_rescan:" key is deprecated but still supported for backward compatibility
  subsonic_rescan: false

  # Optional beets integration for tagging/import (requires beets installed in the container)
  beets:
    enabled: false
    command: "beet import --quiet"

# =============================================================================
# Preview Player (Optional)
# Listen to 30-second track previews before approving/rejecting
# =============================================================================
preview:
  # Enable preview player feature (defaults to true)
  enabled: true

  # Optional Spotify fallback (requires Spotify Developer credentials)
  # Deezer is used by default and requires no API key
  spotify:
    enabled: false
    client_id: "your_spotify_client_id"
    client_secret: "your_spotify_client_secret"

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
| `LIBRARY_ORGANIZE_INTERVAL` | `0` | Seconds between library organize runs (0 = manual only) |
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
| `token` | string | No* | - | API token from LB settings |
| `approval_mode` | string | No | `manual` | `auto` or `manual` |
| `source_type` | string | No | `weekly_playlist` | `weekly_playlist` or `collaborative` |

\*Required if `source_type: collaborative`

**Source Types:**
- **weekly_playlist** (default) - Uses ListenBrainz's weekly exploration playlists. These are curated playlists generated for your profile based on collaborative filtering. No API token required.
- **collaborative** - Uses the collaborative filtering recommendation API directly based on your listening history. Requires an API token from your [ListenBrainz settings](https://listenbrainz.org/settings/).

### Mode Settings

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `debug` | bool | No | `false` | Enable debug logging/features |
| `mode` | string | No | `album` | `album` or `track` |
| `min_score` | float | No | `0` | Minimum recommendation score (0-100, or 0-1 as a fraction) |
| `fetch_count` | int | No | `100` | Recommendations per run |

### slskd

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `host` | string | Yes | - | slskd API URL |
| `api_key` | string | Yes | - | slskd API key |
| `url_base` | string | No | `/` | URL base path |
| `search_timeout` | int | No | `15000` | Search timeout (ms), legacy - prefer `search.search_timeout_ms` |
| `min_album_tracks` | int | No | `3` | Min tracks for album, legacy - prefer `search.min_response_files` |

### slskd Search (Advanced)

Optional advanced search configuration under `slskd.search`:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `album_query_template` | string | `{artist} - {album}` | Template for album searches. Variables: `{artist}`, `{album}`, `{year}` |
| `track_query_template` | string | `{artist} - {title}` | Template for track searches. Variables: `{artist}`, `{title}` |
| `fallback_queries` | string[] | `[]` | Queries to try if primary fails (e.g., `["{album}", "{artist} {album} {year}"]`) |
| `exclude_terms` | string[] | `[]` | Terms to remove from queries (e.g., `["live", "remix"]`) |
| `search_timeout_ms` | int | `15000` | Timeout for slskd search API call |
| `max_wait_ms` | int | `20000` | Max time to wait for search completion |
| `min_response_files` | int | `3` | Minimum files to consider a valid result |
| `max_responses_to_evaluate` | int | `50` | Limit responses to evaluate (performance) |
| `min_file_size_mb` | float | `1` | Minimum file size in MB |
| `max_file_size_mb` | float | `500` | Maximum file size in MB |
| `prefer_complete_albums` | bool | `true` | Bonus score for results with enough tracks |
| `prefer_album_folder` | bool | `true` | Bonus score for proper folder structure |

### slskd Search Retry

Optional retry configuration under `slskd.search.retry`:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | bool | `false` | Enable retry with fallback queries |
| `max_attempts` | int | `3` | Total attempts including primary |
| `simplify_on_retry` | bool | `true` | Simplify query on retry (remove diacritics, special chars) |
| `delay_between_retries_ms` | int | `5000` | Delay between retry attempts |

### slskd Quality Preferences

Optional quality preferences configuration under `slskd.search.quality_preferences`:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | bool | `true` | Enable quality-based filtering and scoring |
| `preferred_formats` | string[] | `["flac", "wav", "alac", "mp3", "m4a", "ogg"]` | Formats to prioritize (bonus scoring) |
| `min_bitrate` | int | `256` | Minimum acceptable bitrate (kbps) for lossy formats |
| `prefer_lossless` | bool | `true` | Give lossless formats higher priority in scoring |
| `reject_low_quality` | bool | `false` | Hard reject files below min_bitrate (vs just deprioritize) |
| `reject_lossless` | bool | `false` | Hard reject lossless files (for users who only want lossy formats) |

**Quality Tiers:**
- **Lossless** - FLAC, WAV, ALAC, AIFF (highest priority by default)
- **High** - 320+ kbps lossy (MP3, AAC, OGG, etc.)
- **Standard** - 256-319 kbps lossy
- **Low** - Below 256 kbps lossy

When `reject_low_quality: true`, files in the "Low" tier are filtered out entirely. When `false`, they are just scored lower and deprioritized.

When `reject_lossless: true`, lossless files (FLAC, WAV, ALAC, AIFF) are filtered out entirely. This is useful for users with limited storage who only want lossy formats.

### slskd Interactive Selection

Optional interactive selection configuration under `slskd.selection`:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `mode` | string | `auto` | `auto` (automatic best-match) or `manual` (user selects from results) |
| `timeout_hours` | int | `24` | Hours before pending selection expires and fails (0 = no timeout) |

**Selection Modes:**
- **auto** - Default behavior. Automatically selects the best matching result based on quality, file count, and user availability.
- **manual** - Shows all search results in the UI for manual review. Users can compare sources, view file lists, and choose the preferred download source.

When `mode: manual`, downloads enter a `pending_selection` status after search completes. Users can:
- View all available sources with quality info and file counts
- Expand results to see individual files
- Select a specific source to download from
- Skip sources they don't want
- Edit the search query and retry
- Use auto-select to let the algorithm choose

If `timeout_hours` is set and the user doesn't select within that time, the download is marked as failed.

### Catalog Discovery

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `enabled` | bool | No | `false` | Enable catalog discovery |
| `subsonic.host` | string | Yes* | - | Subsonic server URL (Navidrome, Gonic, Airsonic, etc.) |
| `subsonic.username` | string | Yes* | - | Subsonic server username |
| `subsonic.password` | string | Yes* | - | Subsonic server password |
| `lastfm.api_key` | string | No | - | Last.fm API key (enables Last.fm provider) |
| `listenbrainz.enabled` | bool | No | `true` | Enable ListenBrainz similarity provider (no API key needed) |
| `max_artists_per_run` | int | No | `10` | Max new artists per run |
| `min_similarity` | float | No | `0.3` | Min similarity (0-1) |
| `similar_artist_limit` | int | No | `10` | Similar artists per query |
| `albums_per_artist` | int | No | `3` | Albums per new artist |
| `mode` | string | No | `manual` | `auto` or `manual` |

\*Required if `enabled: true`. At least one similarity provider (`lastfm` or `listenbrainz`) must be configured when enabled.

> **Note:** The `navidrome` key is deprecated but still supported for backward compatibility. Use `subsonic` for new configurations.

**Similarity Providers:**

Catalog discovery uses similarity providers to find artists related to your library. At least one provider must be configured when catalog discovery is enabled.

- **Last.fm** - Requires API key from [last.fm/api](https://www.last.fm/api/account/create). Well-established similarity data.
- **ListenBrainz** - No API key required. Uses ListenBrainz Labs similar artists API.

When both providers are configured, results are combined and artists found by multiple providers receive higher scores.

### Library Duplicate Detection

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `enabled` | bool | No | `false` | Enable library duplicate checking |
| `auto_reject` | bool | No | `false` | Auto-reject items already in library |

Requires `catalog_discovery.subsonic` to be configured for library sync.

### Library Organization

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `enabled` | bool | No | `false` | Enable library organization |
| `downloads_path` | string | Yes* | - | Where slskd writes completed downloads |
| `library_path` | string | Yes* | - | Destination music library path |
| `organization` | string | No | `artist_album` | `flat` or `artist_album`. **`flat`**: Places album folders directly in library_path **`artist_album`**: Creates Artist/Album folder structure |
| `auto_organize` | bool | No | `false` | Enable scheduling (requires `LIBRARY_ORGANIZE_INTERVAL > 0`) |
| `delete_after_move` | bool | No | `true` | Delete source after organizing |
| `subsonic_rescan` | bool | No | `false` | Trigger Subsonic server `startScan` after organizing |
| `beets.enabled` | bool | No | `false` | Run beets import before moving |
| `beets.command` | string | No | `beet import --quiet` | beets command (import path is appended) |

*Required if `enabled: true`

If `subsonic_rescan: true`, `catalog_discovery.subsonic` must be configured.

> **Note:** The `navidrome_rescan` key is deprecated but still supported for backward compatibility.

### Preview Player

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `enabled` | bool | No | `true` | Enable preview player feature |
| `spotify.enabled` | bool | No | `false` | Enable Spotify as fallback source |
| `spotify.client_id` | string | Yes* | - | Spotify application client ID |
| `spotify.client_secret` | string | Yes* | - | Spotify application client secret |

*Required if `spotify.enabled: true`

The preview player uses Deezer by default (no API key required). Spotify can be enabled as a fallback for tracks not found on Deezer. Get Spotify credentials from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

**Note:** Preview clips are limited to 30 seconds by the streaming services (Deezer/Spotify). This is an industry-standard limitation to protect copyrighted content.

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

**Auth Mode Behaviors:**

| Mode | Login UI | API Header | Username Source |
|------|----------|------------|-----------------|
| `basic` | Username + Password form | `Authorization: Basic <credentials>` | Config `username` |
| `api_key` | API Key input field | `Authorization: Bearer <token>` | "API User" |
| `proxy` | Auto-redirect (no login) | None (proxy handles auth) | `Remote-User` header |
| `disabled` | Auto-redirect (no login) | None | "Guest" |

When `enabled: false`, the UI behaves the same as `proxy` mode - users are automatically authenticated and redirected to the dashboard.

## Minimal Configuration

The bare minimum to run Resonance with ListenBrainz only:

```yaml
listenbrainz:
  username: "your_username"
  # token not required for weekly_playlist mode (default)

slskd:
  host: "http://slskd:5030"
  api_key: "your_api_key"
```

## Docker Compose with Environment

```yaml
services:
  resonance:
    image: ghcr.io/jordojordo/resonance:latest
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

## Wishlist Import/Export

The UI supports importing and exporting wishlist items as JSON files. This is useful for:
- Bulk importing wishlists from other sources
- Backing up your wishlist
- Migrating between Resonance instances

### JSON Schema

Import files must be a JSON array of objects with the following structure:

```json
[
  {
    "artist": "Artist Name",
    "title": "Album or Track Title",
    "type": "album",
    "year": 2023,
    "mbid": "abc123-def456-...",
    "source": "manual",
    "coverUrl": "https://example.com/cover.jpg"
  }
]
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `artist` | string | Yes | Artist name |
| `title` | string | Yes* | Album or track title |
| `type` | string | Yes | `album`, `track`, or `artist` |
| `year` | number | No | Release year |
| `mbid` | string | No | MusicBrainz ID (release-group or recording) |
| `source` | string | No | `listenbrainz`, `catalog`, or `manual` (defaults to `manual`) |
| `coverUrl` | string | No | URL to album artwork |

\*Required for `album` and `track` types; optional for `artist` type.

### Example Import File

```json
[
  {
    "artist": "Dream Theater",
    "title": "Awake",
    "type": "album",
    "year": 1994
  },
  {
    "artist": "Aphex Twin",
    "title": "Selected Ambient Works 85-92",
    "type": "album",
    "year": 1992,
    "source": "manual"
  },
  {
    "artist": "Boards of Canada",
    "title": "Music Has the Right to Children",
    "type": "album"
  }
]
```

### Import Behavior

- **Duplicates are skipped** - Items matching an existing artist/title/type combination are not re-added
- **Validation errors** - Invalid items are reported but don't prevent other items from importing
- **Source defaults to `manual`** - If not specified, imported items are marked as manually added

## Network Requirements

Resonance needs network access to the following services:

| Service | Purpose |
|---------|---------|
| slskd | Queue downloads |
| Navidrome | Scan library artists |
| api.listenbrainz.org | Fetch recommendations |
| ws.audioscrobbler.com | Last.fm similar artists |
| musicbrainz.org | Album metadata |
| coverartarchive.org | Album artwork |
| api.deezer.com | Audio previews (default) |
| api.spotify.com | Audio previews (optional fallback) |
