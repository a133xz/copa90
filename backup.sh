#!/bin/bash

# --- CONFIGURATION ---
# The trailing slashes / are CRITICAL for rsync to copy folder contents correctly
SOURCE="/Volumes/HD-00251/"
DESTINATION="/Volumes/HD-00252/"

# --- PRE-FLIGHT CHECKS ---

# Ensure drives are actually mounted to prevent backing up to an empty folder
if [ ! -d "$SOURCE" ]; then
    echo "ERROR: Source Drive HD-00251 not found."
    exit 1
fi

if [ ! -d "$DESTINATION" ]; then
    echo "ERROR: Destination Drive HD-00252 not found."
    exit 1
fi

echo "----------------------------------------------------------"
echo "STARTING PROFESSIONAL SYNC: $(date)"
echo "SOURCE:      $SOURCE"
echo "DESTINATION: $DESTINATION"
# --- THE RSYNC COMMAND ---
# -a: Archive mode (Preserves timestamps, permissions, and directory structure)
# -v: Verbose (Displays filenames during backup)
# -h: Human-readable (Sizes in MB/GB)
# --delete: Mirrors the source exactly (removes files on B that were deleted on A)
# --progress: Shows a progress bar for large video files
# --modify-window=1: Professional fix for ExFAT drives (prevents re-copying due to 1-sec time drifts)

rsync -avh --delete --progress --modify-window=1 \
    --exclude=".Trashes" \
    --exclude=".Spotlight-V100" \
    --exclude=".fseventsd" \
    --exclude=".DS_Store" \
    --exclude="._*" \
    "$SOURCE" "$DESTINATION"

echo "----------------------------------------------------------"
echo "BACKUP SUCCESSFUL AT: $(date)"
echo "----------------------------------------------------------"
