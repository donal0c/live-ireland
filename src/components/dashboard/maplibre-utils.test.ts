import assert from "node:assert/strict";
import test from "node:test";

import { getGeoJsonSource, setGeoJsonSourceData } from "@/components/dashboard/maplibre-utils";

test("getGeoJsonSource preserves the MapLibre source binding", () => {
  const source = {
    data: null as unknown,
    setData(data: unknown) {
      this.data = data;
    },
  };

  const wrapped = getGeoJsonSource(source);
  wrapped?.setData({ type: "FeatureCollection", features: [] });

  assert.deepEqual(source.data, { type: "FeatureCollection", features: [] });
});

test("setGeoJsonSourceData is a no-op until the source exists", () => {
  assert.doesNotThrow(() => {
    setGeoJsonSourceData(
      {
        getSource: () => undefined,
      },
      "missing",
      { type: "FeatureCollection", features: [] },
    );
  });
});
