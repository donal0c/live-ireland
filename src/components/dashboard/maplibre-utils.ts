export type GeoJsonSourceReader = {
  getSource: (id: string) => unknown;
};

export type GeoJsonSourceLike = {
  setData: (data: unknown) => void;
};

export const getGeoJsonSource = (source: unknown): GeoJsonSourceLike | null => {
  if (!source || typeof source !== "object" || !("setData" in source)) {
    return null;
  }

  const setData = (source as { setData?: unknown }).setData;
  if (typeof setData !== "function") {
    return null;
  }

  return {
    setData: (data: unknown) => {
      setData.call(source, data);
    },
  };
};

export const setGeoJsonSourceData = (
  map: GeoJsonSourceReader | null | undefined,
  sourceId: string,
  data: unknown,
) => {
  const source = getGeoJsonSource(map?.getSource(sourceId));
  source?.setData(data);
};
