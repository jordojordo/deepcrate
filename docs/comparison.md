# Resonance vs Alternatives

This document compares Resonance to similar self-hosted music discovery and automation tools. The goal is to help newcomers understand where Resonance fits in the ecosystem and what makes it distinct.

## Quick Comparison

| Feature | Resonance | Explo | Lidarr | Lidify | Soularr | Beets |
|---|---|---|---|---|---|---|
| **Primary purpose** | Discovery pipeline with curation | Automated playlist generation | Collection management | Music server + discovery | Lidarr-to-Soulseek bridge | Library organization |
| **Discovery source** | ListenBrainz + Last.fm catalog | ListenBrainz | Manual artist monitoring | Last.fm similar artists | None (uses Lidarr wants) | None |
| **Download sources** | Soulseek (slskd) | YouTube + Soulseek | Usenet + BitTorrent | N/A (uses Lidarr) | Soulseek (slskd) | None (import only) |
| **Approval workflow** | ✅ Manual/auto queue with Web UI | ❌ Fully automated | ❌ Automated per-artist rules | ❌ N/A | ❌ Fully automated | N/A |
| **Audio previews** | ✅ 30s previews (Deezer/Spotify) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Web UI** | ✅ Dashboard, queue, downloads | ❌ CLI/headless only | ✅ Full management UI | ✅ Full player UI | ❌ CLI/headless | ⚠️ Basic optional |
| **Music server support** | Subsonic-compatible servers | Jellyfin, Emby, Plex, MPD, Subsonic | Standalone | Standalone (is a server) | Via Lidarr | None (organizer) |

## Resonance vs Explo

[Explo](https://github.com/LumePart/Explo) is the closest alternative to Resonance in terms of scope. Both pull recommendations from ListenBrainz and can download via slskd. However, they differ meaningfully in philosophy and workflow.

### Where they overlap

Both tools solve the same core problem: turning ListenBrainz listening data into actual music files on your server. Both support Soulseek via slskd as a download backend, both run as single Docker containers, and both target the self-hosted music community.

### Where Resonance differs

**Curation over automation.** Explo is designed to be fire-and-forget. It fetches ListenBrainz playlists (Weekly Exploration, Weekly Jams, Daily Jams), downloads the tracks, and creates a playlist on your music server. Resonance takes a different approach. It presents discoveries in a pending queue where you can preview, approve, or reject each recommendation before anything downloads. This is intentional: the approval workflow gives you control over what enters your library, which matters if you care about library quality and coherence.

**Catalog discovery (ListenBrainz and Last.fm similar artists).** This is Resonance's most distinct feature. In addition to ListenBrainz recommendations (which are based on your *listening history*), Resonance scans your Navidrome library and queries ListenBrainz and Last.fm for artists similar to ones you already own. It then aggregates similarity scores across your collection, so an artist who is similar to *multiple* artists in your library ranks higher than one who's only similar to a single artist. This means Resonance can discover music through two independent paths: what you listen to and what you own. Explo only uses the listening history path.

**Audio previews.** Resonance lets you listen to 30-second audio previews (via Deezer or Spotify) directly in the Web UI before approving a download. This is a significant UX advantage when you're deciding whether to commit library space to a new artist or album.

**Interactive source selection.** When downloading, Resonance can show you multiple download sources from Soulseek, letting you compare file quality, format, and completeness before choosing which one to grab. Explo's downloads are fully automated with no manual source selection.

**Album-oriented workflow.** Resonance resolves track recommendations to their parent albums via MusicBrainz, then presents albums as the unit of approval. This aligns with how many collectors think about building a library. Explo is track-oriented, creating playlists of individual songs, more like a streaming "Discover Weekly" experience.

**Web UI.** Resonance ships with a full Vue 3 dashboard for managing the discovery pipeline: queue management, download monitoring, library stats, settings. Explo is a headless CLI tool with no web interface.

### Where Explo has advantages

**Broader music server support.** Explo creates playlists directly on Jellyfin, Emby, Plex, MPD, and any Subsonic-compatible server. Resonance currently integrates with Subsonic-compatible servers for library scanning but downloads into a directory rather than creating playlists on arbitrary servers.

**YouTube downloads.** Explo supports downloading from YouTube (via yt-dlp) in addition to Soulseek. Resonance currently only supports slskd.

**Simpler setup for passive discovery.** If you want a fully automated "just give me new music every week" experience without any manual intervention, Explo's simplicity is a strength. Resonance's approval workflow is powerful but requires engagement.

**More mature.** Explo has been around longer and has a larger community, which translates to more battle-tested edge cases.

## Resonance vs Lidarr

[Lidarr](https://lidarr.audio/) is a music collection manager in the *arr ecosystem (Sonarr, Radarr, etc.). It solves a fundamentally different problem than Resonance.

**Lidarr manages; Resonance discovers.** Lidarr monitors artists and albums you've told it about, watches for new releases, and downloads them automatically via Usenet or BitTorrent. It doesn't discover new artists for you, you need to manually add every artist you want to track. Resonance is the opposite: its entire purpose is surfacing artists and albums you *don't already know about*.

**Different download networks.** Lidarr integrates with Usenet indexers and BitTorrent trackers through a robust download client ecosystem. Resonance uses Soulseek via slskd, which is a different network with different content availability tradeoffs.

**Complementary tools.** Lidarr and Resonance can work well together. Resonance finds new music and gets it into your library; Lidarr can then monitor those artists for future releases. They don't compete, they address different stages of the music acquisition pipeline.

## Resonance vs Lidify

[Lidify](https://github.com/Chevron7Locked/lidify) is a full-featured music server and player with discovery features built in. It includes audio transcoding, playlist generation, vibe-based matching, Spotify/Deezer import, and ML mood detection.

The overlap with Resonance is narrow. Lidify uses Last.fm similar artist data for discovery (like Resonance's catalog discovery), but it's fundamentally a music server replacement rather than a discovery pipeline. Lidify doesn't download music on its own, it relies on Lidarr integration for acquisition. Resonance is laser-focused on the discovery-to-download workflow and delegates playback to your existing music server.

## Resonance vs Soularr

[Soularr](https://github.com/mrusse/soularr) bridges Lidarr to Soulseek via slskd, enabling automated downloads of albums marked "wanted" in Lidarr. It's the most direct alternative for Soulseek-based acquisition.

**Key difference: Discovery vs Acquisition.** Soularr is purely an acquisition tool, it downloads what you've already decided you want in Lidarr. Resonance is a discovery tool that surfaces music you don't know about yet, then handles acquisition.

**Workflow comparison:**
- Soularr: You mark albums wanted in Lidarr -> Soularr searches slskd -> Downloads import to Lidarr
- Resonance: ListenBrainz/Last.fm discover albums -> You approve in queue -> Downloads go to your library

**Where Soularr fits:** If you're deeply invested in the Lidarr ecosystem and maintain manual want lists, Soularr provides reliable hands-off Soulseek acquisition. It's battle-tested Python with quality controls (format preferences, regional filtering, multi-disc handling).

**Where Resonance differs:** Resonance doesn't require Lidarr, it works directly with any Subsonic-compatible server. Its value is in the discovery pipeline (what to download) rather than just the acquisition mechanics (how to download).

## Resonance vs Beets

[Beets](https://beets.io/) is the gold standard for music library organization and metadata management. It auto-tags files, fetches cover art, normalizes volume, and organizes your collection with customizable folder structures.

**Different stages of the pipeline.** Beets operates *after* you have music files, it organizes what you already own. Resonance operates *before*, it discovers what to acquire. They're complementary, not competitive.

**Potential workflow integration:**
1. Resonance discovers and downloads music via slskd
2. Beets imports the downloads, correcting metadata and organizing files
3. Your Subsonic server picks up the organized library

**No discovery features:** Despite having 70+ plugins, Beets has no music recommendation or discovery capabilities. Its Last.fm integration is for fetching genre tags, not finding similar artists.

**When to use both:** If you care deeply about metadata accuracy and folder organization, run Beets as a post-processing step after Resonance downloads complete.

## When to choose Resonance

Resonance is the right choice if you:

- Want **curated discovery**: You care about what enters your library and want to approve recommendations before downloading
- Value **multiple discovery sources**: Combining listening history (ListenBrainz) with library analysis (Last.fm catalog discovery) gives broader coverage
- Want to **preview before committing**: Audio previews and source selection let you make informed decisions
- Prefer an **album-oriented** approach to building a music collection
- Want a **unified Web UI** for managing the entire discovery pipeline
- Already use a **Subsonic-compatible server + slskd** in your stack

## When to choose something else

- If you want **fully automated, zero-interaction** weekly playlists -> **Explo**
- If you need to **manage and monitor known artists** for new releases -> **Lidarr**
- If you want a **full music server replacement** with built-in discovery -> **Lidify**
- If you're **deeply invested in Lidarr** and want Soulseek downloads for your want list -> **Soularr**
- If you need **library organization and metadata management** for existing music -> **Beets**
- If you need **YouTube as a download source** -> **Explo**
- If you use **Jellyfin/Emby/Plex** and want native playlist creation -> **Explo**

## Roadmap context

Resonance is in active early development, the project's scope and integrations will expand over time. See the [project board](https://github.com/jordojordo/resonance/projects) and [open issues](https://github.com/jordojordo/resonance/issues) for planned features.
