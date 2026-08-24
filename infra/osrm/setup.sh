#!/usr/bin/env bash
# ============================================================
# SmartLogix — OSRM Data Preparation Script
# ============================================================
# Downloads an OSM extract and prepares it for osrm-routed.
#
# Usage:
#   ./setup.sh                  # Uses default region (Delhi NCR)
#   ./setup.sh india-latest     # Full India extract (large, ~1.5GB)
#
# The default region is a small Delhi/NCR bounding box suitable
# for local development. For production, use the full India extract:
#   REGION=india-latest ./setup.sh
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data"
OSRM_IMAGE="osrm/osrm-backend:v5.27.1"

# Default: Delhi NCR sub-region. Override with REGION env var.
# For full India: REGION=india-latest
# Geofabrik download base URL for India subregions
REGION="${REGION:-delhi}"

mkdir -p "${DATA_DIR}"

# ---- Download OSM extract ----
if [ "${REGION}" = "delhi" ]; then
    # Small bounding-box extract via Overpass API for local dev
    # Covers Delhi NCR (~28.4°N–28.9°N, 76.8°E–77.4°E)
    OSM_FILE="${DATA_DIR}/delhi.osm.pbf"
    if [ ! -f "${OSM_FILE}" ]; then
        echo "📥 Downloading Delhi NCR OSM extract..."
        # Use BBBike extract service or a pre-cut file
        # Fallback: download full India and clip (too large for dev)
        # For hackathon: use the Geofabrik India extract with osmium clip
        INDIA_URL="https://download.geofabrik.de/asia/india-latest.osm.pbf"
        INDIA_FILE="${DATA_DIR}/india-latest.osm.pbf"

        if [ ! -f "${INDIA_FILE}" ]; then
            echo "   Downloading India extract from Geofabrik (this may take a while)..."
            curl -L -o "${INDIA_FILE}" "${INDIA_URL}"
        fi

        # If osmium is available, clip to Delhi NCR bounding box
        if command -v osmium &> /dev/null; then
            echo "   Clipping to Delhi NCR bounding box..."
            osmium extract -b 76.8,28.4,77.4,28.9 "${INDIA_FILE}" -o "${OSM_FILE}" --overwrite
        else
            echo "   osmium-tool not found, using full India extract for OSRM."
            echo "   (Install osmium-tool for a smaller, faster dev extract.)"
            OSM_FILE="${INDIA_FILE}"
        fi
    else
        echo "✅ Delhi NCR extract already exists."
    fi
elif [ "${REGION}" = "india-latest" ]; then
    OSM_FILE="${DATA_DIR}/india-latest.osm.pbf"
    if [ ! -f "${OSM_FILE}" ]; then
        echo "📥 Downloading full India OSM extract from Geofabrik..."
        curl -L -o "${OSM_FILE}" "https://download.geofabrik.de/asia/india-latest.osm.pbf"
    else
        echo "✅ India extract already exists."
    fi
else
    echo "❌ Unknown region: ${REGION}"
    echo "   Supported: delhi (default), india-latest"
    exit 1
fi

# ---- OSRM Pre-processing ----
OSRM_FILE="${DATA_DIR}/region.osrm"
if [ ! -f "${OSRM_FILE}.ebg" ]; then
    echo "⚙️  Running OSRM extract..."
    docker run --rm -v "${DATA_DIR}:/data" "${OSRM_IMAGE}" \
        osrm-extract -p /opt/car.lua /data/$(basename "${OSM_FILE}")

    # Rename to consistent name for docker-compose
    BASENAME=$(basename "${OSM_FILE}" .osm.pbf)
    if [ "${BASENAME}" != "region" ]; then
        for ext in osrm osrm.ebg osrm.edges osrm.enw osrm.fileIndex \
                   osrm.geometry osrm.icd osrm.maneuver_overrides \
                   osrm.names osrm.nbg_nodes osrm.partition osrm.cell_metrics \
                   osrm.cells osrm.properties osrm.ramIndex osrm.timestamp \
                   osrm.tld osrm.tls osrm.turn_duration_penalties \
                   osrm.turn_penalties_index osrm.turn_weight_penalties; do
            [ -f "${DATA_DIR}/${BASENAME}.${ext}" ] && \
                mv "${DATA_DIR}/${BASENAME}.${ext}" "${DATA_DIR}/region.${ext}" 2>/dev/null || true
        done
    fi

    echo "⚙️  Running OSRM partition..."
    docker run --rm -v "${DATA_DIR}:/data" "${OSRM_IMAGE}" \
        osrm-partition /data/region.osrm

    echo "⚙️  Running OSRM customize..."
    docker run --rm -v "${DATA_DIR}:/data" "${OSRM_IMAGE}" \
        osrm-customize /data/region.osrm

    echo "✅ OSRM data prepared successfully!"
else
    echo "✅ OSRM data already prepared."
fi

echo ""
echo "🚀 Start OSRM with:"
echo "   docker compose -f ${SCRIPT_DIR}/../docker-compose.yml up -d osrm"
echo ""
echo "   OSRM will be available at http://localhost:5000"
echo "   Test: curl 'http://localhost:5000/route/v1/driving/77.1025,28.7041;77.2090,28.6139'"
