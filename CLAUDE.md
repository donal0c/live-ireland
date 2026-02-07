# Live Ireland — Real-Time National Dashboard

## Project Overview

A real-time national dashboard showing Ireland's critical infrastructure and environmental status at a glance. Combines no-auth, real-time public data feeds into a unified app with 4 tabs:

1. **Grid & Energy** — EirGrid demand/generation, wind percentage, SEMO market prices, ESB outage map, Gas Networks pressure
2. **Weather & Water** — Met Eireann observations & warnings, OPW water levels, Marine Institute sea state, air quality
3. **Transport** — Irish Rail & Luas real-time, TII traffic flow, Dublin Bikes, NTA GTFS-R vehicle positions
4. **Outages & Alerts** — ESB outage map, Met Eireann warnings, OPW flood alerts, road incidents

## Session Start

Always run at session start:
```bash
bd ready
bd list
```
Then `bd show <issue-id>` on any in-progress or ready issues to understand current state.

## Key Data Source APIs (all free, no auth)

| API | Endpoint | Update Freq | Notes |
|-----|----------|-------------|-------|
| EirGrid Smart Grid | `https://www.smartgriddashboard.com/DashboardService.svc/` | ~5 min | Demand, generation, wind, frequency, interconnectors |
| SEMO Market Data | `https://reports.sem-o.com/` | ~30 min | Day-ahead & intraday electricity prices |
| Met Eireann Observations | `https://prodapi.metweb.ie/observations/{station}/today` | ~1 hr | 25 weather stations, no auth. Station slugs: use `dublinairport` not `dublin-airport`, `cork` not `cork-airport` |
| Met Eireann Warnings | `prodapi.metweb.ie/warnings/active` (recommended, categorized) / `met.ie/Open_Data/json/warning_IRELAND.json` (national only) | As issued | Active weather warnings, GeoJSON |
| OPW Water Levels | `http://waterlevel.ie/geojson/latest/` | ~15 min | 537 stations, GeoJSON |
| Marine Institute ERDDAP | `https://erddap.marine.ie/erddap/` | Varies | 86 datasets, sea temp, waves, buoys |
| EPA Air Quality | `https://airquality.ie/assets/php/get-monitors.php` | ~15 min | 114 stations, PM10/PM2.5/NO2/O3/SO2/CO. Requires `Referer: https://airquality.ie/` header. 3-5s response — cache server-side. |
| EEA Air Quality | `https://dis2datalake.blob.core.windows.net/airquality-derivated/AQI-noRunningMeans/current/{code}.json` | ~1 hr | 70 Irish stations (EEA codes). Static CDN, no auth. Hourly AQI + concentrations. |
| Irish Rail API | `http://api.irishrail.ie/realtime/realtime.asmx` | ~90 sec | Train positions, station data |
| Luas RTPI | `https://luasforecasts.rpa.ie/xml/get.ashx?action=forecast&stop=...` | ~30 sec | Tram arrival forecasts |
| TII Traffic | TII DATEX II feeds / TMU sites JSON at `data.tii.ie` | ~5 min | DATEX II feeds stale/broken; TMU sites JSON is the working endpoint |
| Dublin Bikes | Cyclocity GBFS v2.3 `https://api.cyclocity.fr/contracts/dublin/gbfs/v2/station_status.json` | ~5 min | Station availability — No auth needed (GBFS) |
| NTA GTFS-R | `https://api.nationaltransport.ie/` | ~30 sec | Real-time bus/rail positions (free API key) |
| ESB Outage Map | `https://www.esbnetworks.ie/` | As updated | Power cut locations and ETAs |
| Gas Networks Map | `https://www.gasnetworks.ie/api/v1/map` | ~1 hr | LIVE entry point flows (kWh), pressures (BAR), calorific values at 4 entry points + 21 strategic points. No auth. Other `/api/v1/` endpoints return 403. |
| ENTSOG (Gas Flows) | `https://transparency.entsog.eu/api/v1/operationalData?operatorKey=IE-TSO-0002` | Daily | Physical flows, nominations (same-day), capacity for GNI. No auth. D-2 for actuals, D+0 for nominations. |
| Gas Networks Static | `https://www.gasnetworks.ie/sites/default/files/2025-11/Gas_Supply.json` | Historical | Daily supply/demand CSV/JSON. Ends 2025-09-30. Also available via CSO PxStat (NGSD01/NGSD02). |

## API Verification Notes (2026-02-07)

### Known Issues
- **EirGrid rate limiting**: Add 5-second delays between requests to avoid 503 errors
- **EirGrid date formats**: Three different formats across sub-APIs (dd-MMM-yyyy, dd-MM-yyyy, dd-MMM-YYYY uppercase)
- **SEMO dynamic endpoint**: `Date` param is ignored; use `sort_by=StartTime&order_by=DESC`
- **Met Eireann station slugs**: `-airport` suffix breaks; use city name only (e.g., `cork` not `cork-airport`)
- **OPW waterlevel.ie**: Use HTTPS directly; 457 stations with 1,992 sensor features
- **ERDDAP queries**: Must URL-encode `>=` and `<=` operators
- **Luas SIRI feed**: Requires auth — use forecast XML instead

### Workarounds Found
- **Gas Networks**: `/api/v1/map` endpoint WORKS (live hourly data). All other `/api/v1/` endpoints return 403. Supplement with ENTSOG API for daily physical flows and nominations.

### Non-functional APIs
- **EPA Air Quality**: NOT actually blocked — requires `Referer: https://airquality.ie/` header. Without it, returns FORBIDDEN. With it, returns full JSON for 114 stations.
- **Dublin Parking** (`opendata.dublincity.ie`): Hostname decommissioned
- **TII DATEX II travel times**: Stale data from 2021; VDS returns 403

## Research Reports

Detailed research for each data domain is in `../ideas_and_research/`. The most relevant reports:

### Primary (core data sources for this app)
| Report | Path | Key Content |
|--------|------|------------|
| Energy Infrastructure | `../ideas_and_research/ireland_data/ireland-energy-infrastructure-data-sources.md` | **PRIMARY** — EirGrid APIs (detailed endpoints), SEMO, ESB outages, grid topology |
| Energy General | `../ideas_and_research/ireland_data/ireland-energy-data-sources.md` | Gas Networks, SEAI, CSO energy tables |
| Transport | `../ideas_and_research/ireland_data/ireland-transport-data-sources.md` | Irish Rail, Luas, NTA GTFS-R, TII, Dublin Bikes, parking |
| Environmental | `../ideas_and_research/ireland_data/ireland-environmental-data-sources.md` | Met Eireann, OPW water levels, EPA air quality, marine |
| Open Data Overview | `../ideas_and_research/ireland_data/ireland-open-data-report.md` | CSO PxStat API patterns, data.gov.ie CKAN, code examples |

### Secondary (supporting data, map boundaries)
| Report | Path | Key Content |
|--------|------|------------|
| GIS & Boundaries | `../ideas_and_research/ireland_data/ireland-gis-data-sources.md` | Tailte Eireann boundaries, GeoHive, county/ED/townland GeoJSON |
| Crime & Justice | `../ideas_and_research/ireland_data/ireland-crime-justice-data-sources.md` | Road safety data (for transport tab context) |

### Technology Stack
| Report | Path | Key Content |
|--------|------|------------|
| Stack Index | `../ideas_and_research/technology_stack/00_index.md` | Navigation for all tech decisions |
| Recommended Stack | `../ideas_and_research/technology_stack/08_recommended_stack.md` | **Single source of truth** — all final tech choices |
| Frontend Frameworks | `../ideas_and_research/technology_stack/01_frontend_meta_frameworks.md` | Next.js 16 analysis |
| Data Visualization | `../ideas_and_research/technology_stack/02_data_visualization_libraries.md` | ECharts 6, Recharts, Chart.js analysis |
| Maps & Geospatial | `../ideas_and_research/technology_stack/03_maps_and_geospatial.md` | MapLibre GL JS, deck.gl, PMTiles, Ireland GIS |
| Dashboard UI | `../ideas_and_research/technology_stack/04_dashboard_ui_components.md` | shadcn/ui, Tremor, AG Grid |
| Python Stack | `../ideas_and_research/technology_stack/05_python_dashboarding_stack.md` | FastAPI, Polars, DuckDB |
| Real-Time Infra | `../ideas_and_research/technology_stack/06_realtime_data_infrastructure.md` | SSE, tRPC, Hono, databases, deployment |
| Emerging Tech | `../ideas_and_research/technology_stack/07_bleeding_edge_emerging.md` | WebGPU, WASM, AI integration |

### GenUI (later phases — AI-powered UI generation)
| Report | Path | Key Content |
|--------|------|------------|
| GenUI Index | `../ideas_and_research/genui/genui-index.md` | Executive summary, framework comparison, recommended stacks |
| GenUI Frameworks | `../ideas_and_research/genui/genui-frameworks.md` | Vercel AI SDK, CopilotKit, LangGraph, Mastra |
| GenUI Dashboards | `../ideas_and_research/genui/genui-dashboards.md` | AI-powered dashboard patterns, case studies |
| AG-UI Protocol | `../ideas_and_research/genui/genui-protocol-ag-ui.md` | Agent-to-frontend communication |
| A2UI Protocol | `../ideas_and_research/genui/genui-protocol-a2ui.md` | Declarative agent-generated UI |
| GenUI Models | `../ideas_and_research/genui/genui-models.md` | LLM selection for GenUI |

## Tech Stack (from recommended stack research)

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS v4 + shadcn/ui + Tremor
- **Charts**: ECharts 6.0 (primary — gauges, streaming time-series) + Recharts (via Tremor)
- **Streaming Analytics**: Perspective 4.0 (WASM engine for real-time grid data pivoting)
- **Maps**: MapLibre GL JS v5 + deck.gl v9.2 (grid topology, wind farms, transport tracking)
- **Real-Time**: SSE via tRPC v11 (5-second intervals polling EirGrid -> Valkey pub/sub -> SSE fan-out)
- **Backend**: Hono (API layer) + tRPC v11 (type-safe subscriptions)
- **Database**: Supabase (Postgres + TimescaleDB) + Valkey (cache/pub-sub)
- **Historical Data**: DuckDB-WASM + Parquet files on Cloudflare R2
- **Deploy**: Fly.io Dublin (API/ingestion) + Cloudflare Pages (frontend) + Cloudflare R2 (static data)
- **Cost**: ~$45-70/month

## Special Considerations

- This dashboard has the **highest real-time requirements** of all 7 app concepts
- ECharts 6's matrix coordinate system is ideal for multi-panel energy displays
- `appendData()` for streaming without full re-renders
- Perspective 4.0 for user-configurable real-time data explorer
- EirGrid API is undocumented — cache aggressively, build adapter layer
- NTA GTFS-R uses Protocol Buffers — deserialize with `protobufjs`
- Consider WebSocket proxy for NTA to avoid per-client API polling

## Parent Project

This app is part of the **Irish Public Data Dashboards** project. The parent epic tracking all 7 app ideas is in `../ideas_and_research/` (beads issue `ideas_and_research-7vf`).
