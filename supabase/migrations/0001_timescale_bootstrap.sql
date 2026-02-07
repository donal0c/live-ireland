-- TimescaleDB bootstrap for Live Ireland real-time metrics.
create extension if not exists timescaledb;

create table if not exists grid_demand_readings (
  observed_at timestamptz not null,
  source_updated_at timestamptz,
  demand_mw numeric not null,
  region text not null,
  field_name text not null,
  created_at timestamptz not null default now()
);

select create_hypertable(
  'grid_demand_readings',
  by_range('observed_at'),
  if_not_exists => true
);

create index if not exists idx_grid_demand_readings_observed_at_desc
  on grid_demand_readings (observed_at desc);
