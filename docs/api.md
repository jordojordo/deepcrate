# API Reference

DeepCrate exposes a REST API for managing the music discovery pipeline.

## Base URL

```
http://localhost:8080/api/v1
```

## Authentication

All endpoints (except `/health`) require authentication when enabled.

### Basic Auth

```bash
curl -u admin:password http://localhost:8080/api/v1/queue/pending
```

### API Key Auth

```bash
curl -H "Authorization: Bearer your_api_key" http://localhost:8080/api/v1/queue/pending
```

Or via header:

```bash
curl -H "X-API-Key: your_api_key" http://localhost:8080/api/v1/queue/pending
```

---

## Endpoints

### Health

#### GET /health

Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "lb_fetch": "running",
    "catalog_discovery": "running",
    "slskd_downloader": "running"
  }
}
```

---

### Auth

#### GET /api/v1/auth/info

Get authentication configuration (no auth required).

**Response:**
```json
{
  "enabled": true,
  "type": "basic"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Whether authentication is enabled |
| `type` | string | Auth type: `basic`, `api_key`, `proxy`, or `disabled` |

#### GET /api/v1/auth/me

Get current authenticated user info (requires auth).

**Response:**
```json
{
  "username": "admin"
}
```

Username returned varies by auth mode:
- `basic`: Configured username from config
- `api_key`: "API User"
- `proxy`: Value of `Remote-User` header
- `disabled`: "Guest"

---

### Queue Management

#### GET /api/v1/queue/pending

List all pending items awaiting approval.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source` | string | all | Filter by source: `listenbrainz`, `catalog`, or `all` |
| `sort` | string | `added_at` | Sort by: `added_at`, `score`, `artist`, `year` |
| `order` | string | `desc` | Sort order: `asc` or `desc` |
| `limit` | int | 50 | Max items to return |
| `offset` | int | 0 | Pagination offset |

**Response:**
```json
{
  "items": [
    {
      "artist": "Justice",
      "album": "Cross",
      "mbid": "abc123-def456-...",
      "type": "album",
      "added_at": "2026-01-11T10:00:00Z",
      "score": 2.45,
      "source": "catalog",
      "similar_to": ["Daft Punk", "Kavinsky"],
      "cover_url": "https://coverartarchive.org/release-group/abc123/front-250",
      "year": 2007
    }
  ],
  "total": 71,
  "limit": 50,
  "offset": 0
}
```

#### GET /api/v1/queue/approved

List approved items (processed to wishlist).

**Response:** Same format as pending.

#### GET /api/v1/queue/rejected

List rejected MBIDs.

**Response:**
```json
{
  "rejected": ["mbid-1", "mbid-2", "mbid-3"],
  "total": 3
}
```

#### POST /api/v1/queue/approve

Approve one or more pending items.

**Request Body:**
```json
{
  "mbids": ["abc123-...", "def456-..."]
}
```

Or approve all:
```json
{
  "all": true
}
```

**Response:**
```json
{
  "approved": 2,
  "message": "2 items approved and added to wishlist"
}
```

#### POST /api/v1/queue/reject

Reject one or more pending items.

**Request Body:**
```json
{
  "mbids": ["abc123-...", "def456-..."]
}
```

**Response:**
```json
{
  "rejected": 2,
  "message": "2 items rejected"
}
```

#### DELETE /api/v1/queue/pending/{mbid}

Remove a specific item from pending queue without rejecting.

**Response:**
```json
{
  "removed": true,
  "mbid": "abc123-..."
}
```

---

### Wishlist

#### GET /api/v1/wishlist

List current wishlist entries.

**Response:**
```json
{
  "items": [
    {
      "entry": "a:\"Justice - Cross\"",
      "artist": "Justice",
      "title": "Cross",
      "type": "album"
    }
  ],
  "total": 5
}
```

#### POST /api/v1/wishlist

Add a manual entry to the wishlist.

**Request Body:**
```json
{
  "artist": "Daft Punk",
  "title": "Discovery",
  "type": "album"
}
```

**Response:**
```json
{
  "added": true,
  "entry": "a:\"Daft Punk - Discovery\""
}
```

#### DELETE /api/v1/wishlist/{entry}

Remove an entry from the wishlist.

**Response:**
```json
{
  "removed": true
}
```

---

### Downloads

#### GET /api/v1/downloads/active

Get active downloads from slskd.

**Response:**
```json
{
  "downloads": [
    {
      "id": "download-id",
      "username": "uploader123",
      "filename": "01 - Track.flac",
      "size": 45000000,
      "downloaded": 27000000,
      "progress": 60,
      "speed": 1200000,
      "state": "InProgress"
    }
  ],
  "total": 3
}
```

#### GET /api/v1/downloads/completed

Get recently completed downloads.

**Response:**
```json
{
  "downloads": [
    {
      "id": "download-id",
      "username": "uploader123",
      "directory": "Justice - Cross (2007) [FLAC]",
      "files": 12,
      "size": 450000000,
      "completed_at": "2026-01-11T10:30:00Z"
    }
  ],
  "total": 15
}
```

#### GET /api/v1/downloads/failed

Get failed downloads (from downloaded.json with no files).

**Response:**
```json
{
  "items": [
    {
      "entry": "a:\"Obscure Artist - Rare Album\"",
      "reason": "No results found",
      "failed_at": "2026-01-11T09:00:00Z"
    }
  ],
  "total": 2
}
```

#### POST /api/v1/downloads/retry

Retry a failed download.

**Request Body:**
```json
{
  "entry": "a:\"Obscure Artist - Rare Album\""
}
```

**Response:**
```json
{
  "queued": true,
  "message": "Added back to wishlist for retry"
}
```

#### POST /api/v1/downloads/search

Search slskd directly.

**Request Body:**
```json
{
  "query": "Justice Cross FLAC",
  "timeout": 15000
}
```

**Response:**
```json
{
  "results": [
    {
      "username": "uploader123",
      "files": [...],
      "score": 85
    }
  ],
  "total": 10
}
```

#### GET /api/v1/downloads/:id/search-results

Get cached search results for a download task in `pending_selection` status.

**Response:**
```json
{
  "task": {
    "id": "abc123-...",
    "artist": "Justice",
    "album": "Cross",
    "searchQuery": "Justice Cross",
    "selectionExpiresAt": "2026-01-12T10:00:00Z"
  },
  "results": [
    {
      "response": {
        "username": "uploader123",
        "hasFreeUploadSlot": true,
        "uploadSpeed": 1200000,
        "files": [...]
      },
      "score": 850,
      "musicFileCount": 12,
      "totalSize": 450000000,
      "qualityInfo": {
        "format": "FLAC",
        "bitDepth": 16,
        "sampleRate": 44100,
        "tier": "lossless"
      },
      "directories": [
        {
          "path": "Music/Justice - Cross (2007) [FLAC]",
          "files": [...],
          "totalSize": 450000000,
          "qualityInfo": {...}
        }
      ]
    }
  ],
  "skippedUsernames": []
}
```

#### POST /api/v1/downloads/:id/select

Select a specific search result for download.

**Request Body:**
```json
{
  "username": "uploader123",
  "directory": "Music/Justice - Cross (2007) [FLAC]"
}
```

**Response:**
```json
{
  "success": true
}
```

#### POST /api/v1/downloads/:id/skip

Skip a search result (hide from list for this download).

**Request Body:**
```json
{
  "username": "uploader123"
}
```

**Response:**
```json
{
  "success": true
}
```

#### POST /api/v1/downloads/:id/retry-search

Retry search with an optional modified query.

**Request Body:**
```json
{
  "query": "Justice Cross 2007 FLAC"
}
```

**Response:**
```json
{
  "success": true
}
```

#### POST /api/v1/downloads/:id/auto-select

Use the automatic selection algorithm to pick the best result.

**Response:**
```json
{
  "success": true
}
```

---

### Actions

#### POST /api/v1/actions/lb-fetch

Trigger lb-fetch immediately.

**Response:**
```json
{
  "started": true,
  "message": "lb-fetch started"
}
```

#### POST /api/v1/actions/catalog

Trigger catalog-discovery immediately.

**Response:**
```json
{
  "started": true,
  "message": "catalog-discovery started"
}
```

#### POST /api/v1/actions/downloader

Trigger slskd-downloader immediately.

**Response:**
```json
{
  "started": true,
  "message": "slskd-downloader started"
}
```

#### GET /api/v1/actions/status

Get status of running actions.

**Response:**
```json
{
  "lb_fetch": {
    "running": false,
    "last_run": "2026-01-11T10:00:00Z",
    "next_run": "2026-01-11T16:00:00Z"
  },
  "catalog_discovery": {
    "running": false,
    "last_run": "2026-01-10T10:00:00Z",
    "next_run": "2026-01-17T10:00:00Z"
  },
  "slskd_downloader": {
    "running": true,
    "started_at": "2026-01-11T10:45:00Z"
  }
}
```

---

### Library

#### GET /api/v1/library/stats

Get library statistics from Subsonic server.

**Response:**
```json
{
  "artists": 847,
  "albums": 2341,
  "tracks": 28456,
  "total_size": "245 GB",
  "total_duration": "1823 hours"
}
```

#### GET /api/v1/library/check

Check if an album exists in the library.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `artist` | string | Yes | Artist name |
| `album` | string | Yes | Album title |

**Response:**
```json
{
  "exists": true,
  "match": {
    "artist": "Daft Punk",
    "album": "Discovery",
    "year": 2001,
    "tracks": 14
  }
}
```

---

### Settings

#### GET /api/v1/settings

Get current configuration (sensitive values redacted).

**Response:**
```json
{
  "listenbrainz": {
    "username": "saybis",
    "approval_mode": "manual"
  },
  "mode": "album",
  "fetch_count": 100,
  "catalog_discovery": {
    "enabled": true,
    "max_artists_per_run": 10,
    "min_similarity": 0.3,
    "mode": "manual"
  }
}
```

#### PATCH /api/v1/settings

Update configuration values.

**Request Body:**
```json
{
  "catalog_discovery": {
    "max_artists_per_run": 15
  }
}
```

**Response:**
```json
{
  "updated": true,
  "restart_required": false
}
```

---

### Search

#### GET /api/v1/search/musicbrainz

Search MusicBrainz for artists/albums.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `type` | string | No | `artist` or `release-group` |

**Response:**
```json
{
  "results": [
    {
      "name": "Justice",
      "type": "artist",
      "mbid": "abc123-...",
      "country": "FR",
      "disambiguation": "French electronic duo"
    }
  ]
}
```

---

## WebSocket Endpoints (Phase 5)

### WS /api/v1/ws/logs

Real-time log streaming.

**Messages:**
```json
{
  "timestamp": "2026-01-11T10:00:00Z",
  "level": "INFO",
  "service": "lb-fetch",
  "message": "Added 5 albums to pending queue"
}
```

### WS /api/v1/ws/downloads

Download progress updates.

**Messages:**
```json
{
  "type": "progress",
  "id": "download-id",
  "progress": 65,
  "speed": 1200000
}
```

**Pending Selection Event:**
```json
{
  "type": "pending_selection",
  "id": "download-id",
  "artist": "Justice",
  "album": "Cross",
  "resultCount": 15,
  "selectionExpiresAt": "2026-01-12T10:00:00Z"
}
```

**Selection Expired Event:**
```json
{
  "type": "selection_expired",
  "id": "download-id",
  "artist": "Justice",
  "album": "Cross"
}
```

### WS /api/v1/ws/queue

Queue change notifications.

**Messages:**
```json
{
  "type": "added",
  "count": 5,
  "source": "catalog"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": true,
  "code": "INVALID_REQUEST",
  "message": "Missing required field: mbids",
  "details": {}
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_REQUEST` | 400 | Malformed request |
| `CONFLICT` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | External service unavailable |

---

## Rate Limiting

The API does not implement rate limiting by default. For public-facing deployments, configure rate limiting in your reverse proxy (Caddy, nginx, Traefik, etc.).

---

## OpenAPI Specification

The full OpenAPI spec is available at:

```
GET /api/v1/openapi.json
GET /docs  # Interactive Swagger UI
GET /redoc # ReDoc documentation
```
