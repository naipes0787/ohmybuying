# Local Docker stack

A Supabase-compatible backend running entirely on your machine. Same APIs as a hosted Supabase project, so the app's `@supabase/supabase-js` code works unchanged.

## Services

| Service  | Image                        | Host port | What it does                                  |
| -------- | ---------------------------- | --------- | --------------------------------------------- |
| db       | postgres:15-alpine           | 54322     | Postgres 15 + Supabase-style roles            |
| auth     | supabase/gotrue              | (kong)    | GoTrue — email/password auth, JWT issuer      |
| rest     | postgrest/postgrest          | (kong)    | PostgREST — REST API over `public` schema     |
| kong     | kong:3.4                     | 8000      | Single entrypoint at `/auth/v1` and `/rest/v1`|
| studio   | supabase/studio              | 54323     | Web UI for the DB                             |
| meta     | supabase/postgres-meta       | (studio)  | Backs Studio                                  |
| migrate  | postgres:15-alpine (oneshot) | —         | Applies `db/migrate/schema.sql` on first boot |

## Usage

```bash
docker compose up -d        # boot
docker compose logs -f      # tail logs
docker compose ps           # status

docker compose down         # stop, keep data
docker compose down -v      # stop and wipe the volume (clean slate)
```

## Connection details

The app's `.env.local` (root) is already wired to:

```
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=<the anon key in docker/.env>
```

Direct Postgres connection (psql, DBeaver, etc.):

```
host: localhost
port: 54322
db:   postgres
user: postgres
pass: postgres
```

## How the schema is applied

1. On first boot of `db`, `db/init/00-roles.sql` runs via the standard `docker-entrypoint-initdb.d` mechanism. It creates the Supabase-compatible roles (`anon`, `authenticated`, `service_role`, `authenticator`, `supabase_auth_admin`) and the empty `auth` schema owned by `supabase_auth_admin`.
2. `auth` (GoTrue) starts and runs its own migrations against the `auth` schema. This creates `auth.users`, `auth.sessions`, the `auth.uid()` / `auth.jwt()` / `auth.role()` helpers, and the rest of the auth tables.
3. The one-shot `migrate` service waits for `auth.users` to exist, then applies `db/migrate/schema.sql` (an idempotent version of `supabase/schema.sql`). The `rest` service waits for `migrate` to finish before booting.

This split is necessary because our app schema FKs to `auth.users` and references `auth.uid()`, both of which only exist after GoTrue runs.

## Known limitations vs. hosted Supabase

- No Realtime, no Storage, no Edge Functions in this stack — add them if you need them.
- Email confirmation is auto-confirmed (`GOTRUE_MAILER_AUTOCONFIRM=true`). Sign up = signed in immediately.
- The JWT signing keys in `.env` are the standard Supabase local-dev keys. Public knowledge. Local use only.
