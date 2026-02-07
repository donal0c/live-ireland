# Live Ireland

Live Ireland is a real-time national dashboard for Ireland that brings critical public infrastructure feeds into one interface.

## What the app does

The dashboard is split into four live-operational tabs:

- **Grid & Energy**: National electricity demand, generation mix, wind share, grid frequency, and market context.
- **Weather & Water**: Weather conditions and warnings with national water-level monitoring.
- **Transport**: Rail, tram, and traffic telemetry.
- **Outages & Alerts**: Power outages and active incidents/warnings.

The goal is to provide a single, fast view of Ireland's current infrastructure status using no-auth public data sources.

## Current phase

Phase 1 and Phase 2 backend foundation are complete:

- Next.js 16 + React 19 + Turbopack
- Tailwind CSS v4 + Lightning CSS processing
- shadcn/ui base system
- Tremor dashboard component integration
- TanStack Query provider setup
- Zustand UI store skeleton
- Responsive dashboard shell and routing
- Dark/light theme toggle
- Basic loading and route-level error boundaries
- Biome linting/formatting and strict TypeScript configuration
- Hono API server with tRPC v11 router
- SSE subscriptions via `httpSubscriptionLink`
- EirGrid demand poller with fan-out channel
- Health and metrics endpoints
- Multi-source adapter runtime (retry, polling cadence, per-adapter health)
- Optional Valkey/Upstash cache + pub/sub hooks
- Supabase Timescale migration scaffold
- Fly.io Dublin deployment skeleton (`fly.api.toml`)

## Tech stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling/UI**: Tailwind CSS v4, shadcn/ui, Tremor
- **State/Data**: Zustand, TanStack Query
- **Quality**: Biome, strict TypeScript

## Routes

- `/grid-energy`
- `/weather-water`
- `/transport`
- `/outages-alerts`

## Getting started

```bash
npm install
npm run dev
npm run dev:api
```

Open [http://localhost:3000](http://localhost:3000).

The frontend expects the API at `http://localhost:8787` by default.
Configure via `.env` using `.env.example` as a template.

## Adapter health endpoints

- `GET /adapters/health` - per-adapter run state and timings
- `GET /trpc/dashboard.adapterStatuses` - same data over tRPC

## Cloud provisioning (Phase 2b)

Provisioning helpers are available in `/Users/donalocallaghan/workspace/vibes/Live_Ireland/scripts/provision`:

- `check-cloud-prereqs.sh`
- `apply-supabase.sh`
- `deploy-fly-api.sh`
- `x2c-runbook.md`

## Quality checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Research and decisions

This repository follows the recommendations in:

- `../ideas_and_research/technology_stack/08_recommended_stack.md`

Data-source research and broader architecture context are indexed in:

- `/Users/donalocallaghan/workspace/vibes/Live_Ireland/CLAUDE.md`
