"use client";

import { useEffect, useRef } from "react";
import type { GpsFix, SentinelSite } from "./types";

export function SentinelMap({
  sites,
  currentGpsFix,
  selectedSiteId,
  onSelectSite
}: {
  sites: SentinelSite[];
  currentGpsFix: GpsFix | null;
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let mapInstance: import("leaflet").Map | null = null;

    async function mountMap() {
      if (!containerRef.current || disposed) return;

      const L = await import("leaflet");
      if (!containerRef.current || disposed) return;

      const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? sites[0];
      mapInstance = L.map(containerRef.current, {
        center: selectedSite ? [selectedSite.lat, selectedSite.lng] : [-1.286389, 36.817223],
        zoom: 13,
        scrollWheelZoom: true
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstance);

      sites.forEach((site) => {
        const active = site.id === selectedSiteId;
        const color = active ? "#0f7b5c" : site.category === "verifier_site" ? "#246b9f" : "#b7791f";

        L.circle([site.lat, site.lng], {
          radius: site.radiusMeters,
          color,
          weight: active ? 3 : 2,
          fillColor: color,
          fillOpacity: active ? 0.14 : 0.08
        }).addTo(mapInstance as import("leaflet").Map);

        L.circleMarker([site.lat, site.lng], {
          radius: active ? 9 : 7,
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 1
        })
          .addTo(mapInstance as import("leaflet").Map)
          .bindPopup(`<strong>${site.name}</strong><br>${site.address}<br>${site.radiusMeters}m Sentinel radius`)
          .on("click", () => onSelectSite(site.id));
      });

      if (currentGpsFix) {
        L.circle([currentGpsFix.lat, currentGpsFix.lng], {
          radius: currentGpsFix.accuracyMeters,
          color: "#b42318",
          weight: 2,
          fillColor: "#b42318",
          fillOpacity: 0.08
        }).addTo(mapInstance);

        L.circleMarker([currentGpsFix.lat, currentGpsFix.lng], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#b42318",
          fillOpacity: 1
        })
          .addTo(mapInstance)
          .bindPopup(`<strong>Current GPS fix</strong><br>${Math.round(currentGpsFix.accuracyMeters)}m accuracy<br>${currentGpsFix.source}`);

        mapInstance.setView([currentGpsFix.lat, currentGpsFix.lng], 15);
      }

      setTimeout(() => mapInstance?.invalidateSize(), 50);
    }

    void mountMap();

    return () => {
      disposed = true;
      mapInstance?.remove();
    };
  }, [currentGpsFix, onSelectSite, selectedSiteId, sites]);

  return <div className="sentinel-map" ref={containerRef} aria-label="Sentinel streetmap" />;
}
