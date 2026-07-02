# ohMyBuying

Retro-futuristic shopping list PWA. Web + mobile via a single React codebase.

## Stack

- **Vite + React 18 + TypeScript**
- **Zustand** for state
- **Supabase** (Auth + Postgres + RLS) for backend
- **Tailwind CSS** for styling (CSS variables drive a dark/neon design system)
- **Framer Motion** for transitions and staggered list loads
- **@hello-pangea/dnd** for drag-and-drop item reorder
- **vite-plugin-pwa** (Workbox) for offline + installable PWA

## Setup

You have two options for the backend: a fully local Docker stack (default — no internet needed once images are pulled) or a hosted Supabase project.

### Option A — Local Docker stack (recommended for dev)

A self-contained Supabase-compatible stack runs in Docker: Postgres + GoTrue (auth) + PostgREST + Kong gateway + Studio. The `@supabase/supabase-js` client talks to it identically to a hosted project.

```bash
# 1. Boot the stack (first run pulls ~1.5 GB of images)
cd docker
docker compose up -d
cd ..

# 2. Install deps + copy the docker-mode .env (already filled in)
npm install
cp .env.example .env.local

# 3. Run the app
npm run dev
```

Then open:

- **App** — http://localhost:5173
- **Studio (DB UI)** — http://localhost:54323
- **Postgres** — `localhost:54322` (`postgres` / `postgres`)

To stop and wipe data:

```bash
cd docker
docker compose down -v
```

The schema in `supabase/schema.sql` is applied automatically by the `migrate` service on first boot. The local stack ships with publicly-known dev JWT keys (committed in `docker/.env`) — they're fine for local use only, never deploy them.

### Option B — Hosted Supabase

```bash
npm install
cp .env.example .env.local       # then edit to use your project URL + anon key
npm run dev
```

Run `supabase/schema.sql` against your project (SQL editor → paste → run). It creates `profiles`, `lists`, `items`, `list_items` and enables row-level security so each user only sees their own data.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build (TS check + Vite build)
- `npm run preview` — preview built app (PWA installable here)
- `npm run lint` — `tsc --noEmit`

## Architecture

```
src/
├── components/
│   ├── auth/         # AuthForm, ProtectedRoute
│   ├── lists/        # ListCard (memo), ListGrid, ListCreateModal, EmptyLists
│   ├── items/        # ItemRow (memo), ItemList (DnD), ItemAddPanel
│   ├── layout/       # AppHeader
│   └── ui/           # Button, Input, TextArea, Modal, Logo, LoadingScreen, ScanlineOverlay, GlowBorder, PageTransition
├── lib/              # supabase client, queryHelpers (Promise.all parallel fetches)
├── pages/            # AuthPage, ResetPasswordPage, ListsPage, ListDetailPage (lazy-loaded)
├── stores/           # authStore, listsStore, itemsStore (Zustand, primitive selectors)
├── styles/           # globals.css — CSS vars, base reset, keyframes, utility classes
└── types/            # TypeScript interfaces
```

## Design

Dark canvas (`#0a0a0f`), neon cyan + magenta accents, pixel grid background, optional CRT scanlines. Typography pairs **Space Grotesk** (display) with **IBM Plex Mono** (body), self-hosted via Fontsource (works offline). All colors and fonts go through CSS variables in `:root` so the theme can be reskinned in one file.

## Performance rules applied

- `Promise.all` for all parallel data fetches (`fetchListAndItems`, `ListDetailPage` mount)
- `React.lazy` + `Suspense` for the two protected pages
- `React.memo` on `ListCard` and `ItemRow`
- Stable callbacks via `useCallback` for every list/grid handler
- `useTransition` wraps delete, reorder, auth submit
- Zustand selectors return primitives only
- Manual chunk splits in `vite.config.ts` for `react-vendor`, `supabase`, `motion`, `dnd`, `zustand`
- Self-hosted fonts (no Google Fonts CDN)

## Sharing model — what to know

Lists can be shared by email (owner only). Members get full edit access. A few intentional tradeoffs:

- **An item can belong to multiple lists.** When a member edits an item that also appears on a different list (e.g. an owner's private list), the edit propagates everywhere that item appears. If a user wants per-list isolation, they should re-create the item rather than reuse an existing one. The `ItemAddPanel` shows whether an item is "already on this list", but it does not prevent re-using items across lists.
- **Items keep an author (`user_id`).** Anyone with access to a list containing the item can read, edit, or delete it via RLS. The author field is informational, not a permission boundary.
- **Permanent item delete cascades.** Deleting an item from the edit modal removes it from every list it appears on. The trash/check icon on a row only removes it from the current list.
- **`add_list_member_by_email` is a single atomic RPC.** It checks ownership, looks up the email, and inserts the membership in one transaction. The client never sees a UUID for an account it didn't already have visibility into — this is intentional, to avoid using the share flow as a generic email-existence oracle.

## Password recovery

Users can reset a forgotten password from the sign-in screen ("Forgot password?"):

1. `AuthForm` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })`. The confirmation message is intentionally neutral ("If an account exists…") so the form is not an email-existence oracle.
2. Supabase emails a recovery link back to `<origin>/reset-password`.
3. `ResetPasswordPage` relies on `detectSessionInUrl` (enabled in `src/lib/supabase.ts`) to establish the recovery session, then calls `supabase.auth.updateUser({ password })` to set the new password and redirects to the app.

**Supabase config required** — in the dashboard under **Authentication → URL Configuration → Redirect URLs**, allow-list the `/reset-password` path for every origin you use, otherwise Supabase rejects the `redirectTo` and falls back to the Site URL:

- Production: `https://<your-domain>/reset-password`
- Local dev (optional): `http://localhost:5173/reset-password` (match your Vite port)
- Vercel previews (optional): `https://*.vercel.app/reset-password`

Also set the **Site URL** to your production origin — it is the default redirect when no allowed `redirectTo` matches.

## Production deploy checklist

Before pointing real users at this:

- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel **Production** env (not committed values).
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the `/api/alexa` function. These are server-only — never expose the service-role key to the browser.
- Apply the latest `supabase/schema.sql` to the hosted project (SQL editor → run).
- Configure the auth **Site URL** and add `<your-domain>/reset-password` to the **Redirect URLs** allow list so the password recovery flow works (see [Password recovery](#password-recovery)).
- The committed `vercel.json` ships HSTS, CSP, X-Frame-Options, and Referrer-Policy. If you embed external resources (analytics, fonts), update the `Content-Security-Policy` header.
- The committed `docker/.env` contains publicly-known dev keys for the local Docker stack only. Do not deploy these.
