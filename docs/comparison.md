# DeepCrate vs Alternatives

This document compares DeepCrate to similar self-hosted music discovery and automation tools. The goal is to help newcomers understand where DeepCrate fits in the ecosystem and what makes it distinct.

DeepCrate's design philosophy is the **digital record shop**: you browse curated crates shaped by your listening history and existing collection, preview what catches your ear, and decide what to take home. Other tools in this space optimize for automation; DeepCrate optimizes for intentional discovery.

## Quick Comparison

| Feature | DeepCrate | Explo | SoulSync | Lidarr | Lidify | Soularr | Beets |
|---|---|---|---|---|---|---|---|
| **Primary purpose** | Discovery pipeline with curation | Automated playlist generation | All-in-one automation platform | Collection management | Music server + discovery | Lidarr-to-Soulseek bridge | Library organization |
| **Discovery source** | ListenBrainz + Last.fm catalog | ListenBrainz | Spotify + music-map.com + Beatport | Manual artist monitoring | Last.fm similar artists | None (uses Lidarr wants) | None |
| **Download sources** | Soulseek (slskd) | YouTube + Soulseek | Soulseek + YouTube + Beatport | Usenet + BitTorrent | N/A (uses Lidarr) | Soulseek (slskd) | None (import only) |
| **Approval workflow** | Manual/auto queue with Web UI | Fully automated | Fully automated | Automated per-artist rules | N/A | Fully automated | N/A |
| **Audio previews** | 30s previews (Deezer/Spotify) | None | None | None | None | N/A | N/A |
| **Web UI** | Dashboard, queue, downloads | CLI/headless only | Full management UI | Full management UI | Full player UI | CLI/headless |  Basic optional |
| **Music server support** | Subsonic-compatible servers | Jellyfin, Emby, Plex, MPD, Subsonic | Plex, Jellyfin, Navidrome | Standalone | Standalone (is a server) | Via Lidarr | None (organizer) |

## DeepCrate vs Explo

[Explo](https://github.com/LumePart/Explo) is the closest alternative to DeepCrate in terms of scope. Both pull recommendations from ListenBrainz and can download via slskd. However, they differ meaningfully in philosophy and workflow.

### Where they overlap

Both tools solve the same core problem: turning ListenBrainz listening data into actual music files on your server. Both support Soulseek via slskd as a download backend, both run as single Docker containers, and both target the self-hosted music community.

### Where DeepCrate differs

**Curation over automation.** Explo is designed to be fire-and-forget. It fetches ListenBrainz playlists (Weekly Exploration, Weekly Jams, Daily Jams), downloads the tracks, and creates a playlist on your music server. DeepCrate takes a different approach. It presents discoveries in a pending queue where you can preview, approve, or reject each recommendation before anything downloads. This is intentional: the approval workflow gives you control over what enters your library, which matters if you care about library quality and coherence.

**Catalog discovery (ListenBrainz and Last.fm similar artists).** This is DeepCrate's most distinct feature. In addition to ListenBrainz recommendations (which are based on your *listening history*), DeepCrate scans your Navidrome library and queries ListenBrainz and Last.fm for artists similar to ones you already own. It then aggregates similarity scores across your collection, so an artist who is similar to *multiple* artists in your library ranks higher than one who's only similar to a single artist. This means DeepCrate can discover music through two independent paths: what you listen to and what you own. Explo only uses the listening history path.

**Audio previews.** DeepCrate lets you listen to 30-second audio previews (via Deezer or Spotify) directly in the Web UI before approving a download. This is a significant UX advantage when you're deciding whether to commit library space to a new artist or album.

**Interactive source selection.** When downloading, DeepCrate can show you multiple download sources from Soulseek, letting you compare file quality, format, and completeness before choosing which one to grab. Explo's downloads are fully automated with no manual source selection.

**Album-oriented workflow.** DeepCrate resolves track recommendations to their parent albums via MusicBrainz, then presents albums as the unit of approval. This aligns with how many collectors think about building a library. Explo is track-oriented, creating playlists of individual songs, more like a streaming "Discover Weekly" experience.

**Web UI.** DeepCrate ships with a full Vue 3 dashboard for managing the discovery pipeline: queue management, download monitoring, library stats, settings. Explo is a headless CLI tool with no web interface.

### Where Explo has advantages

**Broader music server support.** Explo creates playlists directly on Jellyfin, Emby, Plex, MPD, and any Subsonic-compatible server. DeepCrate currently integrates with Subsonic-compatible servers for library scanning but downloads into a directory rather than creating playlists on arbitrary servers.

**YouTube downloads.** Explo supports downloading from YouTube (via yt-dlp) in addition to Soulseek. DeepCrate currently only supports slskd.

**Simpler setup for passive discovery.** If you want a fully automated "just give me new music every week" experience without any manual intervention, Explo's simplicity is a strength. DeepCrate's approval workflow is powerful but requires engagement.

**More mature.** Explo has been around longer and has a larger community, which translates to more battle-tested edge cases.

## DeepCrate vs SoulSync

[SoulSync](https://github.com/Nezreka/SoulSync) is an all-in-one music automation platform that combines discovery, downloading, playlist generation, metadata tagging, and library management into a single application. It's the most feature-rich tool in this space.

### Where they overlap

Both tools discover music and download via slskd, both offer web UIs for managing the pipeline, both do duplicate detection against your existing library, and both target the self-hosted music community.

### Where DeepCrate differs

**Curation vs automation.** This is the fundamental split. SoulSync's tagline is "zero manual effort", it automates the entire chain from discovery to organized files. DeepCrate puts human judgment at the center: you browse, preview, and approve before anything downloads. If you care about intentionally building a library rather than accumulating tracks, the approval workflow matters.

**No Spotify dependency.** SoulSync's richest discovery features (Discovery Weekly, personalized playlists, metadata) depend on Spotify's API, falling back to iTunes when unavailable. DeepCrate uses ListenBrainz and Last.fm exclusively, open services with no proprietary API dependency.

**Album-oriented workflow.** DeepCrate resolves track-level recommendations to their parent albums via MusicBrainz, presenting albums as the unit of approval. SoulSync is track-oriented, generating playlists of individual songs. This reflects different philosophies about how a library should grow.

**Catalog discovery.** DeepCrate scans your Subsonic library and queries ListenBrainz and Last.fm for artists similar to ones you already own, aggregating similarity scores across your collection. This means an artist similar to *multiple* artists you own ranks higher. SoulSync uses music-map.com for similar artist lookups from a watchlist, which doesn't weight against your full library.

**Focused scope.** DeepCrate deliberately delegates post-download work (tagging, organizing, metadata) to specialized tools like beets or wrtag. SoulSync handles tagging, LRC lyrics, file organization templates, quality scanning, and duplicate cleaning itself. DeepCrate's restraint keeps the codebase lean and composable with existing toolchains.

### Where SoulSync has advantages

**Broader download sources.** SoulSync downloads from Soulseek, YouTube (via yt-dlp), and Beatport charts. DeepCrate currently only supports slskd.

**Playlist generation.** SoulSync generates 12+ playlist types: Release Radar, Discovery Weekly, seasonal playlists, decade/genre mixes, daily mixes, and more. DeepCrate doesn't generate playlists, its output is approved albums in your library.

**Artist monitoring.** SoulSync includes a watchlist for monitoring artists and auto-detecting new releases, similar to Lidarr. DeepCrate focuses on discovering new-to-you artists rather than tracking known ones.

**Built-in library management.** Quality scanning (find low-bitrate files), duplicate cleaning, album completion tracking, and template-based file organization are all built in. DeepCrate expects you to use other tools for these tasks.

**Broader server support.** SoulSync syncs with Plex, Jellyfin, and Navidrome. DeepCrate integrates with Subsonic-compatible servers only.

**Metadata enrichment.** SoulSync fetches synchronized lyrics (LRC), album art, and proper tags automatically. DeepCrate delegates metadata work to external tools.

## DeepCrate vs Lidarr

[Lidarr](https://lidarr.audio/) is a music collection manager in the *arr ecosystem (Sonarr, Radarr, etc.). It solves a fundamentally different problem than DeepCrate.

**Lidarr manages; DeepCrate discovers.** Lidarr monitors artists and albums you've told it about, watches for new releases, and downloads them automatically via Usenet or BitTorrent. It doesn't discover new artists for you, you need to manually add every artist you want to track. DeepCrate is the opposite: its entire purpose is surfacing artists and albums you *don't already know about*.

**Different download networks.** Lidarr integrates with Usenet indexers and BitTorrent trackers through a robust download client ecosystem. DeepCrate uses Soulseek via slskd, which is a different network with different content availability tradeoffs.

**Complementary tools.** Lidarr and DeepCrate can work well together. DeepCrate finds new music and gets it into your library; Lidarr can then monitor those artists for future releases. They don't compete, they address different stages of the music acquisition pipeline.

## DeepCrate vs Lidify

[Lidify](https://github.com/Chevron7Locked/lidify) is a full-featured music server and player with discovery features built in. It includes audio transcoding, playlist generation, vibe-based matching, Spotify/Deezer import, and ML mood detection.

The overlap with DeepCrate is narrow. Lidify uses Last.fm similar artist data for discovery (like DeepCrate's catalog discovery), but it's fundamentally a music server replacement rather than a discovery pipeline. Lidify doesn't download music on its own, it relies on Lidarr integration for acquisition. DeepCrate is laser-focused on the discovery-to-download workflow and delegates playback to your existing music server.

## DeepCrate vs Soularr

[Soularr](https://github.com/mrusse/soularr) bridges Lidarr to Soulseek via slskd, enabling automated downloads of albums marked "wanted" in Lidarr. It's the most direct alternative for Soulseek-based acquisition.

**Key difference: Discovery vs Acquisition.** Soularr is purely an acquisition tool, it downloads what you've already decided you want in Lidarr. DeepCrate is a discovery tool that surfaces music you don't know about yet, then handles acquisition.

**Workflow comparison:**
- Soularr: You mark albums wanted in Lidarr -> Soularr searches slskd -> Downloads import to Lidarr
- DeepCrate: ListenBrainz/Last.fm discover albums -> You approve in queue -> Downloads go to your library

**Where Soularr fits:** If you're deeply invested in the Lidarr ecosystem and maintain manual want lists, Soularr provides reliable hands-off Soulseek acquisition. It's battle-tested Python with quality controls (format preferences, regional filtering, multi-disc handling).

**Where DeepCrate differs:** DeepCrate doesn't require Lidarr, it works directly with any Subsonic-compatible server. Its value is in the discovery pipeline (what to download) rather than just the acquisition mechanics (how to download).

## DeepCrate vs Beets

[Beets](https://beets.io/) is the gold standard for music library organization and metadata management. It auto-tags files, fetches cover art, normalizes volume, and organizes your collection with customizable folder structures.

**Different stages of the pipeline.** Beets operates *after* you have music files, it organizes what you already own. DeepCrate operates *before*, it discovers what to acquire. They're complementary, not competitive.

**Potential workflow integration:**
1. DeepCrate discovers and downloads music via slskd
2. Beets imports the downloads, correcting metadata and organizing files
3. Your Subsonic server picks up the organized library

**No discovery features:** Despite having 70+ plugins, Beets has no music recommendation or discovery capabilities. Its Last.fm integration is for fetching genre tags, not finding similar artists.

**When to use both:** If you care deeply about metadata accuracy and folder organization, run Beets as a post-processing step after DeepCrate downloads complete.

## When to choose DeepCrate

DeepCrate is the right choice if you:

- Want **curated discovery**: You care about what enters your library and want to approve recommendations before downloading
- Value **multiple discovery sources**: Combining listening history (ListenBrainz) with library analysis (Last.fm catalog discovery) gives broader coverage
- Want to **preview before committing**: Audio previews and source selection let you make informed decisions
- Prefer an **album-oriented** approach to building a music collection
- Want a **unified Web UI** for managing the entire discovery pipeline
- Already use a **Subsonic-compatible server + slskd** in your stack

## When to choose something else

- If you want an **all-in-one automation platform** that handles discovery, downloading, tagging, organizing, and playlist generation -> **SoulSync**
- If you want **fully automated, zero-interaction** weekly playlists -> **Explo**
- If you need to **manage and monitor known artists** for new releases -> **Lidarr**
- If you want a **full music server replacement** with built-in discovery -> **Lidify**
- If you're **deeply invested in Lidarr** and want Soulseek downloads for your want list -> **Soularr**
- If you need **library organization and metadata management** for existing music -> **Beets**
- If you need **YouTube as a download source** -> **Explo**
- If you use **Jellyfin/Emby/Plex** and want native playlist creation -> **Explo**

## Roadmap context

DeepCrate is in active early development, the project's scope and integrations will expand over time. See the [project board](https://github.com/jordojordo/deepcrate/projects) and [open issues](https://github.com/jordojordo/deepcrate/issues) for planned features.
