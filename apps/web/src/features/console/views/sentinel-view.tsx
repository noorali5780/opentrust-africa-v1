"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Crosshair, MapPinned, Navigation, Radar, ShieldCheck } from "lucide-react";
import { useConsole } from "../console-context";
import { SentinelMap } from "../sentinel-map";
import { formatDate, statusTone } from "../utils";

function riskTone(riskLevel: string) {
  if (riskLevel === "low") return "good";
  if (riskLevel === "medium") return "warn";
  return "bad";
}

export function SentinelView() {
  const {
    sentinelSites,
    sentinelEvents,
    gpsStatus,
    gpsMessage,
    currentGpsFix,
    selectedSentinelSiteId,
    setSelectedSentinelSiteId,
    requestGpsFix,
    useDemoGpsFix,
    runSentinelCheck
  } = useConsole();
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());
  const toggleEvent = (id: string) => {
    setExpandedEventIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectedSite = sentinelSites.find((site) => site.id === selectedSentinelSiteId) ?? sentinelSites[0];
  const latestEvent = sentinelEvents[0];

  return (
    <section className="sentinel-workspace">
      <div className="panel sentinel-map-panel">
        <div className="panel-header">
          <div className="panel-title">
            <MapPinned size={22} aria-hidden />
            <div>
              <h2>Sentinel streetmap</h2>
              <p>OpenStreetMap, GPS fixes, and trust zones</p>
            </div>
          </div>
        </div>
        <div className="panel-body">
          <SentinelMap sites={sentinelSites} currentGpsFix={currentGpsFix} selectedSiteId={selectedSentinelSiteId} onSelectSite={setSelectedSentinelSiteId} />
          <div className="map-attribution-note">Map data by OpenStreetMap contributors</div>
        </div>
      </div>

      <div className="sentinel-side">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <Radar size={22} aria-hidden />
              <div>
                <h2>Sentinel check</h2>
                <p>Location evidence for field trust events</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="field">
                <label>Trust site</label>
                <select value={selectedSentinelSiteId} onChange={(event) => setSelectedSentinelSiteId(event.target.value)}>
                  {sentinelSites.map((site) => (
                    <option value={site.id} key={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSite && (
                <div className="sentinel-site-summary">
                  <strong>{selectedSite.address}</strong>
                  <span>{selectedSite.radiusMeters}m Sentinel radius</span>
                </div>
              )}

              <div className="sentinel-status-grid">
                <div>
                  <span>GPS</span>
                  <strong>{gpsStatus}</strong>
                </div>
                <div>
                  <span>Accuracy</span>
                  <strong>{currentGpsFix ? `${Math.round(currentGpsFix.accuracyMeters)}m` : "none"}</strong>
                </div>
              </div>

              <div className="button-row">
                <button className="primary-button" type="button" onClick={requestGpsFix} title="Use device GPS">
                  <Navigation size={18} aria-hidden />
                  GPS
                </button>
                <button className="secondary-button" type="button" onClick={useDemoGpsFix} title="Use demo location">
                  <Crosshair size={18} aria-hidden />
                  Demo fix
                </button>
                <button className="secondary-button" type="button" onClick={runSentinelCheck} title="Run Sentinel location check">
                  <ShieldCheck size={18} aria-hidden />
                  Check
                </button>
              </div>

              <div className="sentinel-message">{gpsMessage}</div>

              {latestEvent && (
                <div className="sentinel-result">
                  <span className="status" data-tone={statusTone(latestEvent.status)}>
                    {latestEvent.status}
                  </span>
                  <h3>{latestEvent.siteName}</h3>
                  <div className="record-meta">
                    <span>{latestEvent.distanceMeters}m from site</span>
                    <span className="status" data-tone={riskTone(latestEvent.riskLevel)}>
                      {latestEvent.riskLevel} risk
                    </span>
                    <span>{latestEvent.source}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <ShieldCheck size={22} aria-hidden />
              <div>
                <h2>Sentinel journal</h2>
                <p>GPS evidence added to local audit context</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="sentinel-event-list">
              {sentinelEvents.map((event) => (
                <div className="sentinel-event" data-expanded={expandedEventIds.has(event.id)} key={event.id}>
                  <div className="data-row-summary">
                    <div>
                      <div className="record-meta">
                        <span className="status" data-tone={statusTone(event.status)}>
                          {event.status}
                        </span>
                        <strong>{event.siteName}</strong>
                        <span>{formatDate(event.capturedAt)}</span>
                      </div>
                      <p>{event.distanceMeters}m from site, {event.accuracyMeters}m accuracy</p>
                    </div>
                    <button className="secondary-button compact-button" type="button" onClick={() => toggleEvent(event.id)} title={expandedEventIds.has(event.id) ? "Minimize Sentinel event" : "Expand Sentinel event"}>
                      {expandedEventIds.has(event.id) ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
                      {expandedEventIds.has(event.id) ? "Minimize" : "Expand"}
                    </button>
                  </div>
                  {expandedEventIds.has(event.id) && (
                    <div className="record-details">
                      <div className="detail-grid">
                        <div>
                          <span>Coordinates</span>
                          <strong>{event.lat}, {event.lng}</strong>
                        </div>
                        <div>
                          <span>Source</span>
                          <strong>{event.source}</strong>
                        </div>
                        <div>
                          <span>Distance</span>
                          <strong>{event.distanceMeters}m</strong>
                        </div>
                        <div>
                          <span>Accuracy</span>
                          <strong>{event.accuracyMeters}m</strong>
                        </div>
                      </div>
                      <div className="reason-list">
                        {event.reasonCodes.map((code) => (
                          <span className="reason-code" data-tone={code.includes("low") || code.includes("outside") ? "negative" : code.includes("medium") ? "neutral" : "positive"} key={code}>
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {sentinelEvents.length === 0 && <div className="empty">No Sentinel checks yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
