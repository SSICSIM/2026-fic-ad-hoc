# Fearmonger Union — Summit Register

A lightweight, staff-only roster manager for the Fictional AdHoc committee, with
an existing crisis-note tracker alongside it. The register starts empty: enter
your committee's own agents and Groundskeepers in the control panel.

## Workspace

- `/mechanics` — Groundskeeper rankings with All / Signed / Unsigned filters,
  grouped and single-agent rosters, an automatic movement log, and agent rankings.
- `/control-panel` — add or edit agents and Groundskeepers, assign representation,
  and build an agent's complete roster with checkboxes.
- `/crisis` — the existing crisis notes, periods, staff notes, and analytics.
- `/login` — shared staff-password login. `/` opens the register.

Add agents first, then Groundskeepers, then select **Build rosters**. Agents are
also the crisis tracker's characters; there is no duplicate delegate database.
A keeper can have one ongoing representative, or be unsigned. Temporary MSI gigs
and private rapport remain outside the roster manager.

Change an agent in the register to sign, drop, or transfer a keeper. The roster
and movement log save together. **Edit ranking** supports dragging and up/down
buttons, followed by **Save order** or **Cancel**. Keeper ranks are global, including
inside filters and individual agent rosters. Agent rankings are manually assigned.
Entries with history or crisis notes cannot be removed; unused entries can be
removed from the control panel.

## Stack and structure

- `backend/` — FastAPI, SQLAlchemy, Alembic, and Postgres.
- `frontend/` — Next.js App Router, React Query, Tailwind v4, and existing shadcn/ui
  components. Nunito Sans is bundled locally with its OFL license; no font download
  is needed during builds or at runtime.
- `docker-compose.yml` — Postgres, backend, and frontend development services.

The mechanics workspace adds only `GET /api/mechanics` and `POST /api/mechanics`.
The GET returns one shared snapshot. The POST accepts typed actions for editing
entries, setting representation/rosters, ordering, and removing unused entries.
Each action carries the revision it was edited against. Database locking rejects
stale concurrent edits and keeps assignment changes and movement entries atomic.
The frontend refreshes every 15 seconds while visible, on focus, and after saves.

## Running locally

```bash
cp .env.example .env
# Fill in SITE_PASSWORD, NEXTAUTH_SECRET, and ADMIN_API_TOKEN in .env.
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000 (development API docs at `/docs`)

The backend applies Alembic migrations at startup. The roster migration preserves
existing characters and crisis notes; existing characters become agents initially
ordered by name. It does not insert sample rosters or fictional assignments.

See [environment setup](docs/development.md) for authentication, environment
variables, request routing, and running services outside Docker.

## Checks

```bash
cd frontend
npm ci
npm run typecheck
npm run build
```

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests -q
```

API tests use an in-memory database by default. To exercise real Postgres row
locks as well, set `TEST_DATABASE_URL` to a disposable Postgres database. Tests
create and remove an isolated schema per case; the test user needs schema-creation
permission. The Postgres-only check submits two simultaneous staff edits and
verifies only one can commit.
