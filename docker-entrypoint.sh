#!/bin/sh
set -e

# Ensure data and config directories exist and are writable
# This handles the case where bind mounts override the image's directory permissions

# If running as root, fix permissions and re-exec as deepcrate user
if [ "$(id -u)" = "0" ]; then
    # Ensure directories exist
    mkdir -p /data /config

    # Fix ownership for data directory (needs write access)
    chown -R deepcrate:deepcrate /data

    # Config directory may be read-only mounted, only chown if writable
    chown -R deepcrate:deepcrate /config 2>/dev/null || true

    # Re-exec this script as deepcrate user
    exec su-exec deepcrate "$0" "$@"
fi

# Now running as deepcrate user - start the application
exec node server/dist/server.js
