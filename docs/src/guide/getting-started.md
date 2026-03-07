---
title: Getting Started
---

# Getting Started

DeepCrate is a self-hosted music discovery pipeline. It surfaces music through your listening history and existing collection, lets you preview and approve recommendations, then downloads via Soulseek.

## Prerequisites

- Docker and Docker Compose
- [slskd](https://github.com/slskd/slskd) running with API enabled
- Subsonic-compatible server ([Navidrome](https://www.navidrome.org/), [Gonic](https://github.com/sentriz/gonic), [Airsonic](https://airsonic.github.io/), etc.) for catalog discovery
- [ListenBrainz](https://listenbrainz.org/) account + [Last.fm API key](https://www.last.fm/api/account/create)

## Installation

### 1. Create configuration

```bash
mkdir -p deepcrate/data && cd deepcrate
```

Create `config.yaml`:

```yaml
listenbrainz:
  username: "your_username"

slskd:
  host: "http://slskd:5030"
  api_key: "your_api_key"

catalog_discovery:
  enabled: true
  subsonic:
    host: "http://subsonic-server:4533"
    username: "your_username"
    password: "your_password"
  lastfm:
    api_key: "your_lastfm_api_key"

ui:
  auth:
    enabled: true
    username: "admin"
    password: "changeme"
```

See the [Configuration](./configuration.md) guide for all options.

### 2. Run with Docker Compose

Create `docker-compose.yaml`:

```yaml
services:
  deepcrate:
    image: ghcr.io/jordojordo/deepcrate:latest
    container_name: deepcrate
    volumes:
      - ./config.yaml:/config/config.yaml:rw
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

## Minimal Configuration

The bare minimum to run DeepCrate with ListenBrainz only:

```yaml
listenbrainz:
  username: "your_username"
  # token not required for weekly_playlist mode (default)

slskd:
  host: "http://slskd:5030"
  api_key: "your_api_key"
```

## How It Works

```
Your Library ──┐
               ▼
Scrobbles ──> Discovery ──> Preview & Approve ──> Soulseek
                                                     │
                                                     └──> Your Library
```

1. **Discovery jobs run on schedule** -- ListenBrainz every 6 hours, catalog discovery weekly, slskd downloader hourly
2. **Discovered albums go to the queue** with status `pending`
3. **Web UI shows pending items** for manual approval or rejection, with 30-second audio previews
4. **Approved items go to the wishlist** for download via slskd

## Development

```bash
git clone https://github.com/jordojordo/deepcrate.git && cd deepcrate
pnpm install && pnpm dev  # Starts on http://localhost:5173
```

See [CONTRIBUTING.md](https://github.com/jordojordo/deepcrate/blob/master/CONTRIBUTING.md) for guidelines.

## Next Steps

- [Configuration Reference](./configuration.md) -- All configuration options
- [Authelia Integration](./authelia-integration.md) -- Advanced authentication with SSO/2FA
- [Architecture](../reference/architecture.md) -- How the system works internally
- [API Reference](../reference/api.md) -- Interactive API explorer
