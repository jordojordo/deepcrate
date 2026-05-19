# Using Your Own Organizer

DeepCrate can be aware of what's already in your library, for duplicate detection in the discovery queue **without** organizing your music itself. This is the right setup if you already rely on a tool like [wrtag](https://github.com/sentriz/wrtag), [beets](https://github.com/beetbox/beets), [Lidarr](https://lidarr.audio), or a slskd post-processing script to move and tag your downloads.

## The Two Features Are Independent

| Feature | What it does | Touches filesystem? |
|---------|--------------|---------------------|
| `library_duplicate` | Reads your library from a Subsonic-compatible server and flags discoveries you already own | No, API only |
| `library_organize` | Moves completed slskd downloads into a library folder | Yes, moves/copies/deletes files |

If you let another tool organize, you want `library_duplicate` **enabled** and `library_organize` **disabled** (which is the default). DeepCrate will never read or write files on your music library when configured this way.

## Example Configuration

```yaml
catalog_discovery:
  subsonic:
    host: "http://navidrome:4533"
    username: "your_subsonic_username"
    password: "your_subsonic_password"

library_duplicate:
  enabled: true
  auto_reject: false   # set true to silently drop duplicates instead of flagging them

library_organize:
  enabled: false       # leave off, your existing tool handles layout
```

The Subsonic block under `catalog_discovery` is shared with the [Catalog Discovery](/guide/configuration#catalog-discovery) feature; you don't need a separate connection.

## What DeepCrate Reads

DeepCrate calls the Subsonic [`getAlbumList2`](https://www.subsonic.org/pages/api.jsp#getAlbumList2) endpoint and caches `(artist, album, year)` tuples in its own SQLite database. It does not:

- read your music files
- read your music directory
- write anything back to the Subsonic server
- care about how your files are laid out on disk

Any Subsonic-compatible server works: Navidrome, Gonic, Airsonic, Airsonic-Advanced, etc. Your organizer's job is to keep that server's index up to date; DeepCrate's job is to read it.

## How Matching Works

Duplicates are matched at the **album** level on normalized `(artist, album)` pairs. Normalization is lowercase + trim, there is no diacritic folding, no leading-`The` stripping, and no track-level matching. See [Limitations](#limitations) below.

## Sync Schedule

The library is re-synced periodically by the `library-sync` background job:

| Setting | Default | Description |
|---------|---------|-------------|
| `LIBRARY_SYNC_INTERVAL` (env var) | `86400` (24h) | Seconds between automatic syncs |

After each sync, all `pending` queue items are re-checked against the new library snapshot. If `auto_reject: true`, items now found in the library are moved to `rejected`; otherwise they're flagged with an "In Library" badge.

## Verifying It's Working

Once you've enabled `library_duplicate` and pointed `catalog_discovery.subsonic` at your server:

1. Open the **Queue** page. Near the top you should see `Library: N albums · synced X ago`. If `N` is `0` or the timestamp never updates, the sync isn't reaching your server, check the server logs for `Subsonic` errors.
2. Click **Sync Now** on the Queue page to trigger a sync immediately instead of waiting for the schedule.
3. Use the **Hide Owned** toggle in the queue filters to confirm duplicates are being detected.

You can also trigger a sync via the API:

```bash
curl -X POST http://localhost:8080/api/v1/jobs/library-sync/trigger \
  -H "Authorization: Basic <credentials>"
```

## Limitations

- **Matching is naive.** Because normalization is only lowercase + trim, slight differences will *not* be treated as duplicates:
  - `Blue Öyster Cult` in your library vs. `Blue Oyster Cult` in the queue
  - `The Chemical Brothers` vs. `Chemical Brothers`
  - `Siamese Dream (Deluxe Edition)` vs. `Siamese Dream`
- **Album-level only.** DeepCrate has no awareness of individual tracks within an album. If a recommendation is for a single track, it's resolved up to its parent album (when `mode: "album"`) before being matched.
- **No filesystem fallback.** If you don't run a Subsonic server, there is currently no way to make DeepCrate aware of your library.
- **Sync is best-effort.** If your Subsonic server is unreachable when the job runs, the existing cached snapshot is preserved and the next run will retry.

## Related

- [Library Duplicate Detection](/guide/configuration#library-duplicate-detection): full config reference
- [Library Organization](/guide/configuration#library-organization): the feature you're *not* using, for completeness
- [Catalog Discovery](/guide/configuration#catalog-discovery): uses the same Subsonic connection to discover similar artists from your library
