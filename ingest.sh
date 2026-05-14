#!/bin/bash

# ==========================================
# CONFIGURATION - CHANGE THESE ONCE
# ==========================================
SD_CARD_NAME="Untitled"       # The name of your SD card volume
DEST_DRIVE="/Volumes/HD-00251" # Your main hard drive
# ==========================================

# --- 1. PRE-FLIGHT CHECKS ---
SOURCE_PATH="/Volumes/$SD_CARD_NAME"

if [ ! -d "$SOURCE_PATH" ]; then
    echo "ERROR: SD Card '$SD_CARD_NAME' not found in /Volumes/."
    echo "Check the name and make sure it is plugged in."
    exit 1
fi

if [ ! -d "$DEST_DRIVE" ]; then
    echo "ERROR: Destination drive $DEST_DRIVE not found!"
    exit 1
fi

# --- 2. GET USER INPUT ---
echo "Ingesting from: $SOURCE_PATH"
read -p "Enter Day Number (e.g. 1): " DAY_NUM
read -p "Enter Camera Letter (e.g. A): " CAM_LET

# Convert inputs to standard format
# Day 1 -> Day_01 | a -> A_CAM
DAY_FOLDER=$(printf "Day_%02d" $DAY_NUM)
CAM_LETTER=$(echo "$CAM_LET" | tr '[:lower:]' '[:upper:]')
CAM_FOLDER="${CAM_LETTER}_CAM"

# --- 3. AUTO-INCREMENT FOLDER (A001, A002...) ---
# Roll numbers are global per camera letter across ALL Day_* folders:
# same-day ingests stay sequential; a new calendar day picks up at the next number (e.g. Day_01/A005 -> Day_02/A006).
INGEST_BASE="$DEST_DRIVE/$DAY_FOLDER/$CAM_FOLDER"
mkdir -p "$INGEST_BASE"

MAX_ROLL=0
shopt -s nullglob
for roll_path in "$DEST_DRIVE"/Day_*/"$CAM_FOLDER"/"$CAM_LETTER"[0-9][0-9][0-9]; do
    [ -d "$roll_path" ] || continue
    roll_name=$(basename "$roll_path")
    suffix="${roll_name#$CAM_LETTER}"
    if [[ "$suffix" =~ ^[0-9]{3}$ ]]; then
        n=$((10#$suffix))
        if [ "$n" -gt "$MAX_ROLL" ]; then
            MAX_ROLL=$n
        fi
    fi
done
shopt -u nullglob

ROLL_NUM=$((MAX_ROLL + 1))
ROLL_FOLDER=$(printf "%s%03d" "$CAM_LETTER" "$ROLL_NUM")
FINAL_DEST="$INGEST_BASE/$ROLL_FOLDER"

# --- 4. START THE INGEST ---
echo ""
echo "----------------------------------------------------------"
echo "CREATING: $FINAL_DEST"
echo "COPYING:  Contents of $SD_CARD_NAME"
echo "----------------------------------------------------------"

mkdir -p "$FINAL_DEST"

# rsync flags:
# -a: archive (preserves all data)
# --modify-window=1: crucial for ExFAT compatibility
# The "/" at the end of $SOURCE_PATH/ copies the CONTENTS only
rsync -avh --progress --modify-window=1 \
    --exclude=".Trashes" \
    --exclude=".Spotlight-V100" \
    --exclude=".fseventsd" \
    --exclude=".DS_Store" \
    --exclude="._*" \
    "$SOURCE_PATH/" "$FINAL_DEST"

echo "----------------------------------------------------------"
echo "DONE! Card $ROLL_FOLDER is complete."
echo "----------------------------------------------------------"
