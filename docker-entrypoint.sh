#!/bin/sh
set -e

# Cannot chown without root. Check writability and exec directly.
if [ "$(id -u)" != "0" ]; then
    if [ ! -w /data ]; then
        echo "WARNING: /data is not writable by UID $(id -u). SQLite will fail." >&2
        echo "Remove 'user:' from compose, or chown /data to UID $(id -u) on the host." >&2
    fi
    exec "$@"
fi

# Fix permissions, then drop to the built-in node user (UID 1000).
mkdir -p /data /config
chown -R node:node /data
chown -R node:node /config 2>/dev/null || {
    echo "WARNING: Could not chown /config. Config updates via the UI will fail." >&2
    echo "Either mount config.yaml as :rw or chown it to UID 1000 on the host." >&2
}

exec su-exec node "$@"
