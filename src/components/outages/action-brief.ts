export type TimelineSeverity = "critical" | "info" | "warning";

export type TimelineEntry = {
  id: string;
  region: string;
  severity: TimelineSeverity;
  time: string;
  title: string;
  type: string;
};

export type SpatialHotspot = {
  cell: string;
  count: number;
  floodCount: number;
  powerCount: number;
  lat: number;
  lng: number;
};

export type ActionBriefItem = {
  id: string;
  action: string;
  detail: string;
  priority: "high" | "low" | "medium";
  region: string;
  source: string;
};

const severityScore: Record<TimelineSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

const priorityForSeverity = (severity: TimelineSeverity): ActionBriefItem["priority"] => {
  if (severity === "critical") {
    return "high";
  }
  if (severity === "warning") {
    return "medium";
  }
  return "low";
};

const actionForEntry = (entry: TimelineEntry) => {
  if (entry.type === "Power") {
    return entry.severity === "critical" ? "Check outage concentration" : "Monitor planned works";
  }
  if (entry.type === "Flood") {
    return "Review flood station trend";
  }
  if (entry.type === "Weather") {
    return "Review weather warning area";
  }
  if (entry.type === "Rail") {
    return "Watch rail disruption";
  }
  return "Review signal";
};

export const buildActionBrief = ({
  timelineEntries,
  spatialHotspots,
  limit = 4,
}: {
  timelineEntries: TimelineEntry[];
  spatialHotspots: SpatialHotspot[];
  limit?: number;
}): ActionBriefItem[] => {
  const hotspotItems: ActionBriefItem[] = spatialHotspots
    .filter((hotspot) => hotspot.count >= 3)
    .map((hotspot) => ({
      id: `hotspot-${hotspot.cell}`,
      action: "Inspect multi-signal hotspot",
      detail: `${hotspot.count} nearby signals: ${hotspot.powerCount} power, ${hotspot.floodCount} flood`,
      priority: hotspot.count >= 8 ? "high" : "medium",
      region: `${hotspot.lat.toFixed(2)}, ${hotspot.lng.toFixed(2)}`,
      source: "Hotspot",
    }));

  const timelineItems: ActionBriefItem[] = timelineEntries
    .filter((entry) => entry.severity !== "info")
    .sort((a, b) => {
      const severityDelta = severityScore[b.severity] - severityScore[a.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    })
    .map((entry) => ({
      id: `timeline-${entry.id}`,
      action: actionForEntry(entry),
      detail: entry.title,
      priority: priorityForSeverity(entry.severity),
      region: entry.region,
      source: entry.type,
    }));

  return [...hotspotItems, ...timelineItems]
    .sort((a, b) => {
      const score = { high: 3, medium: 2, low: 1 };
      return score[b.priority] - score[a.priority];
    })
    .slice(0, limit);
};
