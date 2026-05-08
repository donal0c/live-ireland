import assert from "node:assert/strict";
import test from "node:test";

import { buildActionBrief } from "@/components/outages/action-brief";

test("buildActionBrief prioritizes dense hotspots before lower severity timeline items", () => {
  const items = buildActionBrief({
    spatialHotspots: [
      {
        cell: "8928308280fffff",
        count: 9,
        floodCount: 3,
        lat: 53.34,
        lng: -6.26,
        powerCount: 6,
      },
    ],
    timelineEntries: [
      {
        id: "weather-1",
        region: "Munster",
        severity: "warning",
        time: "2026-05-08T10:00:00.000Z",
        title: "Yellow rain warning",
        type: "Weather",
      },
    ],
  });

  assert.equal(items[0]?.action, "Inspect multi-signal hotspot");
  assert.equal(items[0]?.priority, "high");
  assert.equal(items[1]?.action, "Review weather warning area");
});

test("buildActionBrief ignores informational-only entries", () => {
  const items = buildActionBrief({
    spatialHotspots: [],
    timelineEntries: [
      {
        id: "info-1",
        region: "National",
        severity: "info",
        time: "2026-05-08T10:00:00.000Z",
        title: "Informational signal",
        type: "Power",
      },
    ],
  });

  assert.deepEqual(items, []);
});
