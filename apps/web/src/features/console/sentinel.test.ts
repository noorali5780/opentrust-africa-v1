import { describe, expect, it } from "vitest";
import { createSentinelEvent, distanceMeters, sentinelRisk, sentinelStatus } from "./sentinel";
import type { GpsFix, SentinelSite } from "./types";

const site: SentinelSite = {
  id: "site_1",
  name: "Training site",
  category: "training_site",
  lat: -1.286389,
  lng: 36.817223,
  radiusMeters: 350,
  address: "Nairobi"
};

describe("sentinel GPS calculations", () => {
  it("calculates distance in meters", () => {
    expect(distanceMeters(site, { lat: -1.286389, lng: 36.817223 })).toBeLessThan(1);
  });

  it("classifies geofence status and risk", () => {
    expect(sentinelStatus(120, 350)).toBe("inside_geofence");
    expect(sentinelStatus(500, 350)).toBe("nearby");
    expect(sentinelStatus(900, 350)).toBe("outside_geofence");
    expect(sentinelRisk("inside_geofence", 35)).toBe("low");
    expect(sentinelRisk("inside_geofence", 300)).toBe("high");
  });

  it("creates auditable Sentinel events", () => {
    const fix: GpsFix = {
      lat: -1.286389,
      lng: 36.817223,
      accuracyMeters: 40,
      capturedAt: "2026-07-08T10:00:00.000Z",
      source: "device_gps"
    };
    const event = createSentinelEvent(site, fix);

    expect(event.status).toBe("inside_geofence");
    expect(event.riskLevel).toBe("low");
    expect(event.reasonCodes).toContain("device_gps_used");
  });
});
