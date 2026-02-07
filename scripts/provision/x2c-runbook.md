# Phase 2b Cloud Provisioning Runbook

## 1. Prerequisites

Set these environment variables:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `FLY_API_TOKEN`
- `FLY_APP_NAME`

Optional (for runtime integration):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 2. Verify prerequisites

```bash
./scripts/provision/check-cloud-prereqs.sh
```

## 3. Apply Supabase migrations

```bash
./scripts/provision/apply-supabase.sh
```

## 4. Deploy API to Fly (Dublin)

```bash
./scripts/provision/deploy-fly-api.sh
```

## 5. Verify health

```bash
curl -sS https://$FLY_APP_NAME.fly.dev/health
curl -sS https://$FLY_APP_NAME.fly.dev/adapters/health
```
