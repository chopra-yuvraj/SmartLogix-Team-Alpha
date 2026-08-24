/**
 * SmartLogix — MapLibre GL Wrapper Component (Task 5.5)
 *
 * Runtime fallback: uses MapTiler vector tiles if NEXT_PUBLIC_MAPTILER_API_KEY
 * is present; otherwise falls back to free OSM raster tiles (no API key required).
 */

"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

interface MapWrapperProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  markers?: Array<{
    id: string;
    lng: number;
    lat: number;
    color?: string;
    label?: string;
  }>;
  routeGeoJSON?: GeoJSON.FeatureCollection;
  onMapLoad?: (map: maplibregl.Map) => void;
  className?: string;
}

export default function MapWrapper({
  center = [77.1025, 28.7041], // Default: Delhi
  zoom = 10,
  markers = [],
  routeGeoJSON,
  onMapLoad,
  className = "w-full h-[400px] rounded-xl overflow-hidden",
}: MapWrapperProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Determine tile source at runtime (Task 5.5 fallback logic)
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  const tileStyle: string | maplibregl.StyleSpecification = maptilerKey
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`
    : {
        version: 8 as const,
        name: "OSM Raster",
        sources: {
          osm: {
            type: "raster" as const,
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster" as const,
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      };

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: tileStyle,
      center: center,
      zoom: zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      setLoaded(true);
      onMapLoad?.(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    // Remove existing markers (simple approach — recreate all)
    const existingMarkers = document.querySelectorAll(".smartlogix-marker");
    existingMarkers.forEach((el) => el.remove());

    markers.forEach((m) => {
      const el = document.createElement("div");
      el.className = "smartlogix-marker";
      el.style.cssText = `
        width: 24px; height: 24px; border-radius: 50%;
        background: ${m.color || "#0066ff"};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .addTo(map);

      if (m.label) {
        marker.setPopup(
          new maplibregl.Popup({ offset: 15 }).setText(m.label),
        );
      }
    });
  }, [markers, loaded]);

  // Update route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !routeGeoJSON) return;

    const sourceId = "route-source";
    const layerId = "route-layer";

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(
        routeGeoJSON,
      );
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: routeGeoJSON,
      });

      map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#0066ff",
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });
    }
  }, [routeGeoJSON, loaded]);

  return <div ref={mapContainer} className={className} />;
}
