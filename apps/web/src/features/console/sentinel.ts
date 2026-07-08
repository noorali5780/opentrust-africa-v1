import type { GeoPoint, GpsFix, SentinelEvent, SentinelRiskLevel, SentinelSite } from "./types";
import { createId, today } from "./utils";

const earthRadiusMeters = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(first: GeoPoint, second: GeoPoint) {
  const deltaLat = toRadians(second.lat - first.lat);
  const deltaLng = toRadians(second.lng - first.lng);
  const firstLat = toRadians(first.lat);
  const secondLat = toRadians(second.lat);
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function sentinelStatus(distance: number, radiusMeters: number) {
  if (distance <= radiusMeters) return "inside_geofence";
  if (distance <= radiusMeters * 2) return "nearby";
  return "outside_geofence";
}

export function sentinelRisk(status: SentinelEvent["status"], accuracyMeters: number): SentinelRiskLevel {
  if (status === "inside_geofence" && accuracyMeters <= 100) return "low";
  if (status === "outside_geofence" || accuracyMeters > 250) return "high";
  return "medium";
}

export function sentinelReasonCodes(input: { status: SentinelEvent["status"]; accuracyMeters: number; source: GpsFix["source"] }) {
  return [
    input.status,
    input.accuracyMeters <= 100 ? "gps_accuracy_high" : input.accuracyMeters <= 250 ? "gps_accuracy_medium" : "gps_accuracy_low",
    input.source === "device_gps" ? "device_gps_used" : "demo_location_used"
  ];
}

export function createSentinelEvent(site: SentinelSite, fix: GpsFix): SentinelEvent {
  const distance = Math.round(distanceMeters(site, fix));
  const status = sentinelStatus(distance, site.radiusMeters);
  const riskLevel = sentinelRisk(status, fix.accuracyMeters);

  return {
    id: createId("sen"),
    siteId: site.id,
    siteName: site.name,
    status,
    riskLevel,
    distanceMeters: distance,
    radiusMeters: site.radiusMeters,
    accuracyMeters: Math.round(fix.accuracyMeters),
    source: fix.source,
    lat: Number(fix.lat.toFixed(6)),
    lng: Number(fix.lng.toFixed(6)),
    capturedAt: fix.capturedAt || today(),
    reasonCodes: sentinelReasonCodes({ status, accuracyMeters: fix.accuracyMeters, source: fix.source })
  };
}
