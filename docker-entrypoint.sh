#!/bin/sh
set -e

# Ensure data and config directories exist and are writable
# This handles the case where bind mounts override the image's directory permissions

# If running as root, fix permissions and re-exec as resonance user
if [ "$(id -u)" = "0" ]; then
    # Ensure directories exist
    mkdir -p /data /config

    # Fix ownership for data directory (needs write access)
    chown -R resonance:resonance /data

    # Config directory may be read-only mounted, only chown if writable
    chown -R resonance:resonance /config 2>/dev/null || true

    # Re-exec this script as resonance user
    exec su-exec resonance "$0" "$@"
fi

# Now running as resonance user - start the application
exec node server/dist/server.js
