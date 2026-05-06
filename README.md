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
├── pages/            # AuthPage, ListsPage, ListDetailPage (lazy-loaded)
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
