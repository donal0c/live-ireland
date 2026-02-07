# Live Ireland

Live Ireland is a local-first, real-time national dashboard for Ireland that combines public infrastructure feeds into one operational view.

## What the app does

The dashboard ships four live tabs:

- **Grid & Energy**: EirGrid demand/generation/frequency/wind, interconnection, CO2 intensity, SEMO market context, gas demand, and outage overlays.
- **Weather & Water**: Met Eireann observations and warnings, OPW water levels, EPA monitoring sites, and radar/map overlays.
- **Transport**: Irish Rail train positions and departures, Luas forecasts, Dublin Bikes availability, and TII traffic sites.
- **Outages & Alerts**: ESB outages, warning/incident summaries, and timeline views for active disruption signals.

## Local-first architecture

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind v4, Tremor
- **API**: Hono + tRPC v11 on `http://localhost:8787`
- **Realtime**: SSE subscriptions for dashboard streams
- **Data adapters**: per-source polling runtime with adapter health reporting
- **Optional local infra**: Redis/Valkey via Docker Compose for cache/pubsub

## Routes

- `/grid-energy`
- `/weather-water`
- `/transport`
- `/outages-alerts`

## Quick start (fully local)

```bash
npm install
npm run infra:up
npm run dev:local
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env` and keep local values (for example `REDIS_URL=redis://localhost:6379`).

Stop local infra with:

```bash
npm run infra:down
```

## API operational endpoints

- `GET /health` - API liveness + uptime
- `GET /health/ready` - adapter readiness summary
- `GET /metrics` - basic API metrics
- `GET /adapters/health` - detailed adapter run state
- `GET /trpc/dashboard.adapterStatuses` - adapter status via tRPC

## Production-readiness work in progress

Phase 10 hardening currently includes:

- security headers and CSP on web responses
- API request IDs, rate limiting, and secure response headers
- SSE auto-reconnect with stale-data signaling in live panels
- route-level loading/error boundaries and fallback UI states

## Quality checks

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run audit:deps
# with dev stack running in another terminal:
npm run a11y:scan
```

## Research and decisions

This repository follows:

- `../ideas_and_research/technology_stack/08_recommended_stack.md`

Broader data-source research is indexed in:

- `/Users/donalocallaghan/workspace/vibes/Live_Ireland/CLAUDE.md`
