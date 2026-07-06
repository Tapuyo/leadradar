# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

LeadRadar is a B2B lead generation SaaS. It scans multiple sources (Mapbox, Google Places, Craigslist, custom sites), scores leads, visualizes them as a 3D mind map, and generates AI-powered cold emails via Claude.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run start    # Serve production build
```

No test runner or linter is configured.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `MAPBOX_SECRET_TOKEN` (server-only, sk.* prefix)
- `ANTHROPIC_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_HAS_MAPBOX` (boolean flag, derived from whether secret token is set)

## Architecture

### Routing

- `app/page.tsx` — root redirect: authenticated → `/dashboard`, unauthenticated → `/login`
- `app/(auth)/` — login and signup pages (Supabase Auth, client components)
- `app/(dashboard)/` — protected routes; layout enforces auth redirect
- `app/api/` — all backend endpoints

### Key API Routes

| Route | Purpose |
|---|---|
| `POST /api/scan` | **SSE streaming** — runs multi-source lead scan, emits real-time logs |
| `POST /api/generate-email` | Calls Claude Sonnet to write a cold outreach email |
| `GET/POST /api/services` | List or create services for the current company |
| `GET /api/leads` | Query leads with filters (`service_id`, `status`, `source`, `min_score`) |
| `PATCH /api/leads/[id]` | Update lead status |
| `GET/PATCH /api/company` | Fetch or update the current user's company |

`/api/scan` returns Server-Sent Events — handle with `EventSource` or `ReadableStream`, not `fetch().json()`.

### Data Flow (Scanning)

`/api/scan` → `lib/scanRunner.ts` orchestrates:
1. Parallel scrapers: `lib/scrapers/mapboxSearch.ts`, `googlePlaces.ts`, `craigslist.ts`, `customSite.ts`
2. `lib/normalizer.ts` — standardizes raw lead fields
3. `lib/scrapers/mapboxGeocode.ts` — fills missing coordinates
4. `lib/deduplication.ts` — fuzzy dedup against existing leads (name/address/phone/email)
5. `lib/scoring.ts` — scores leads (keywords 50%, contact 10–20%, source 7–15%, description 15%)
6. Assigns 3D node positions, inserts into Supabase

### Supabase Clients

- `lib/supabase/client.ts` — browser client (anon key)
- `lib/supabase/server.ts` — server client (cookie-based, anon key); use this in Server Components and API routes
- API routes that write leads use the **service role key** directly for elevated permissions

### Core Data Types (`types/index.ts`)

- `Company` — one per user, holds `map_provider` preference (`'mapbox'|'google'`)
- `Service` — lead scan configuration (keywords, target cities/states, source toggles, schedule)
- `Lead` — result record with score, status (`'new'|'seen'|'archived'`), source, 3D position, matched keywords

### Frontend Architecture

Dashboard (`app/(dashboard)/dashboard/page.tsx`) is a single large client component with three panels:
- **Left**: `ServicesList` + `ServiceForm`
- **Center**: `MindMapCanvas` (Three.js — bloom post-processing, raycaster click detection, CSS2D labels, orbit controls)
- **Right**: `LeadsList` + lead status filters
- **Bottom overlay**: `ScanLog` (SSE-fed real-time log), `BottomSheet` → `LeadDetail` → `EmailGenerator`

### Styling

Tailwind CSS v4 (PostCSS plugin, not `tailwind.config.*`). Dark-only theme hardcoded in `globals.css`: background `#0a0a1a`, text `#e8edf5`, accent `#2563eb`. Fonts: Inter (body), Space Grotesk (headings) as CSS variables.

### Build Config

`next.config.ts` marks `puppeteer` and `cheerio` as `serverExternalPackages` — they run only in API routes, never bundled for the browser.
