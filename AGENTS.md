# Agent Instructions — Live Ireland

This project builds a **real-time national dashboard** for Ireland (energy grid, weather, transport, outages). It is part of the broader Irish Public Data Dashboards initiative.

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Research Context

All data source research and technology stack decisions live in `../ideas_and_research/`. Key files:
- `../ideas_and_research/technology_stack/08_recommended_stack.md` — **Start here** for all tech decisions
- `../ideas_and_research/ireland_data/ireland-energy-infrastructure-data-sources.md` — EirGrid/SEMO API details
- `../ideas_and_research/ireland_data/ireland-transport-data-sources.md` — Transport API details
- `../ideas_and_research/ireland_data/ireland-environmental-data-sources.md` — Weather/water/air APIs
- See `CLAUDE.md` for the full linked research index

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

