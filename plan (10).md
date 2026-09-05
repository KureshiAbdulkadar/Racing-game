# PLAN.md — Pixel Racer (Working Title)

A pixel-art multiplayer car racing game built with Next.js, targeting 90+ FPS on desktop and mobile browsers, with room-code based friend lobbies and a PostgreSQL-backed persistence layer.

---

## 1. Product Vision

A fast, low-latency, top-down pixel-art racing game that runs entirely in the browser. Feel reference: the arcade snap of *Micro Machines* and *Retro City Rampage*, the multiplayer intimacy of *Skribbl.io* (join by code), and the polish discipline of EA / Codemasters (input latency, tuning curves, feedback loops).

**Core pillars**
1. **Instant** — no install, no login required to play, ready in under 3 seconds.
2. **Buttery** — locked 90+ FPS, sub-50ms input-to-pixel latency.
3. **Social** — 6-character room code, up to 8 players, spectator mode.
4. **Ownable** — cars, liveries, and profile persist across sessions once the player signs in.

**Non-goals (v1)**
- Open-world / free-roam
- In-app purchases
- Ranked matchmaking (unranked lobbies only)
- Native mobile apps

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js 15 (App Router)** | SSR marketing pages, edge routing for lobby APIs, React 19 server actions |
| Rendering | **PixiJS 8 (WebGL2, WebGPU fallback→canvas)** | Battle-tested 2D renderer, hits 120 FPS on midrange hardware, sprite batching |
| Game loop | **Custom fixed-timestep** (60 Hz simulation / uncapped render) | Deterministic physics for netcode, decoupled render for 90+ FPS |
| Physics | **Rapier2D (WASM)** | Deterministic, small footprint, ideal for arcade car handling |
| State | **Zustand** (UI) + **ECS via `bitecs`** (game world) | UI and simulation stay separate; ECS scales cleanly |
| Netcode | **WebSockets via `partykit`** or **Socket.IO** on a Node worker | Rooms map 1:1 to WS rooms, ~30 Hz snapshot rate with client prediction |
| Database | **PostgreSQL 16** (Neon / Supabase / self-hosted) | Relational integrity for profiles, cars, race history |
| ORM | **Drizzle ORM** | Type-safe, edge-compatible, migration-first |
| Auth | **Auth.js (NextAuth v5)** — Google + Guest sessions | Guests can play instantly; upgrade to full account later |
| Asset pipeline | **Aseprite → JSON spritesheets** built via `TexturePacker` in CI | Standard indie pixel-art workflow |
| Audio | **Howler.js** with sprite-sheet mp3/webm | Low-latency, mobile-safe |
| Hosting | **Vercel** (web) + **Fly.io / Railway** (game server) | Web on the edge, WS server in a region close to majority of players |

---

## 3. Visual & Art Direction

**Style:** Top-down pixel art, 3/4 perspective cars, 32×32 tile world, 2x pixel-perfect scaling.

**Color theming**
A single design-token file drives every color in the game and UI. Themes are swappable at runtime (Neon Night, Sunset Coast, Retro Arcade, Monochrome).

```
/design-tokens/theme.ts
```

| Token | Neon Night | Sunset Coast | Retro Arcade |
|---|---|---|---|
| `--bg-0` (deep bg) | `#0A0A14` | `#1A0F1F` | `#1D1D1D` |
| `--bg-1` (surface) | `#141428` | `#2D1A2E` | `#2A2A2A` |
| `--accent` | `#00E5FF` | `#FF6B35` | `#F07C00` |
| `--accent-2` | `#FF00A8` | `#FFB84D` | `#FFD400` |
| `--track` | `#1F2937` | `#3A2438` | `#333333` |
| `--grass` | `#0B3D2E` | `#4A2545` | `#2E4A2E` |
| `--danger` | `#FF3860` | `#FF3860` | `#FF3860` |
| `--text` | `#F5F5FA` | `#FFE8D6` | `#F0F0F0` |

**Typography (UI)**
- Display / HUD: **"Press Start 2P"** or **"VT323"** (pixel display)
- Body / menus: **"Geist Mono"** (readable modern mono to balance the pixel display font)

**Art constraints**
- 32 colors per palette max (per-theme)
- Cars: 16×24 sprite, 16 rotation angles baked
- No sub-pixel movement in render (round to integer screen coords)
- One shared shadow style, one shared skid decal

---

## 4. Performance Target: 90+ FPS

Hitting 90+ consistently is a discipline, not a feature. Enforced by budget and CI:

**Frame budget @ 90 FPS = 11.1 ms**

| Slice | Budget |
|---|---|
| Input + netcode reconcile | 1.0 ms |
| ECS systems (physics, AI, collisions) | 4.0 ms |
| Render (PixiJS draw calls) | 4.5 ms |
| UI (React overlay) | 1.0 ms |
| Slack | 0.6 ms |

**Techniques**
- **Fixed-timestep simulation at 60 Hz**, render interpolated between the last two states — render can run at 90/120/144 uncapped without breaking physics.
- **Sprite batching**: one texture atlas per scene, all cars share one atlas.
- **Object pooling**: particles, skid marks, projectiles never `new` at runtime.
- **No React re-renders during play** — HUD is a Pixi layer, React only for menus and modals.
- **WebGL2 first, WebGPU when available**, canvas2d fallback for old devices (degrades gracefully to 60 FPS cap).
- **Web Worker for netcode** — WS parsing and delta application off the main thread.
- **`requestAnimationFrame`** locked; `performance.now()` for delta.
- **CI perf gate**: Playwright + `performance.measure` runs a 30s benchmark race; fails PR if p95 frame time > 12ms on the reference machine.

---

## 5. Game Flow (User Journey)

```
┌─────────────────────┐
│   Splash / Logo     │  ~1.2s, preloads core atlas
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│    Start Screen     │  [PLAY]  [CUSTOMIZE]  [SETTINGS]
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌──────────┐  ┌──────────────┐
│ CUSTOMIZE│  │     PLAY     │  → [QUICK RACE] [PLAY WITH FRIENDS]
│  - Car   │  └──────┬───────┘
│  - Color │         │
│  - Name  │    ┌────┴────┐
│  - Decal │    ▼         ▼
└─────┬────┘  ┌──────┐ ┌──────────────────┐
      │       │ Solo │ │ Room Code Screen │
      │       │  vs  │ │  [CREATE ROOM]   │
      │       │ Bots │ │  [JOIN: _ _ _ _ _ _] │
      │       └──┬───┘ └────────┬─────────┘
      │          │              │
      │          ▼              ▼
      │    ┌──────────┐   ┌────────────┐
      └───►│  LOBBY   │◄──│  Room Code │  (host sees code, shares it)
           │ (waiting)│   │  Displayed │
           └────┬─────┘   └────────────┘
                ▼
           ┌──────────┐
           │  Track   │  countdown 3-2-1-GO
           │ Selection│
           └────┬─────┘
                ▼
           ┌──────────┐
           │   RACE   │  90+ FPS gameplay
           └────┬─────┘
                ▼
           ┌──────────┐
           │ Results  │  → [REMATCH]  [BACK TO LOBBY]  [EXIT]
           └──────────┘
```

**Screens (Next.js routes)**
| Route | Purpose |
|---|---|
| `/` | Splash + Start screen |
| `/customize` | Car customization |
| `/play` | Mode selection (Quick Race / Friends) |
| `/room/new` | Host creates room, gets code |
| `/room/[code]` | Lobby (WS-connected) |
| `/race/[matchId]` | Live race (Pixi canvas fullscreen) |
| `/results/[matchId]` | Post-race stats, XP awarded |
| `/settings` | Volume, controls, theme, quality preset |
| `/profile` | Stats, unlocks, race history (requires auth) |

---

## 6. Customization

The customize screen lets a player set:

| Field | Storage | Notes |
|---|---|---|
| Display name | `users.display_name` | 3–16 chars, profanity filter |
| Car body | `player_cars.body_id` | Sedan / Muscle / Buggy / Kart (v1: 4 bodies) |
| Primary color | `player_cars.primary_hex` | HSV picker, snapped to 32-color palette |
| Secondary color | `player_cars.secondary_hex` | Same |
| Decal | `player_cars.decal_id` | Stripe, Flame, Number, None |
| Number | `player_cars.race_number` | 00–99 |
| Horn sound | `player_cars.horn_id` | 6 options |
| Trail effect | `player_cars.trail_id` | Unlocked via XP |

Colors are applied at runtime by swapping palette indices on the car sprite (single sprite, tinted via shader) — this is the classic technique used in *NBA Jam*, *Rock N' Roll Racing*, etc.

---

## 7. Multiplayer & Room Codes

**Design**
- 6-character alphanumeric code, uppercase, no ambiguous chars (no `0/O`, `1/I/L`).
- Code space: `32^6 ≈ 1.07B` — collisions are practically zero.
- Codes live for 24h after last activity, then recycled.
- Room capacity: 2–8 players + up to 4 spectators.

**Netcode model**
- **Authoritative server** (Node process running the same simulation code as the client).
- **Client-side prediction** for local player, **entity interpolation** for remote players (~100ms buffer).
- **Snapshot rate:** 30 Hz server → client; **input rate:** 60 Hz client → server.
- **Reconciliation:** on server correction, replay unacknowledged inputs.
- **Lag compensation:** server rewinds by RTT/2 for collision resolution.

**Room lifecycle**
```
CREATE → WAITING → COUNTDOWN → RACING → FINISHED → (REMATCH | CLOSED)
```

**API surface**
```
POST /api/room                    → { code, hostToken }
GET  /api/room/:code              → { status, players, trackId, hostName }
POST /api/room/:code/join         → { playerToken, wsUrl }
POST /api/room/:code/start        → 204  (host only)
DELETE /api/room/:code            → 204  (host only)
WS   /ws/room/:code?token=...     → real-time game channel
```

---

## 8. Database Schema (PostgreSQL)

```sql
-- =============================================================
-- Extensions
-- =============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =============================================================
-- Users & auth
-- =============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE,                    -- NULL for guests
  display_name    VARCHAR(16) NOT NULL,
  avatar_hue      SMALLINT NOT NULL DEFAULT 0,      -- 0-359
  is_guest        BOOLEAN NOT NULL DEFAULT TRUE,
  xp              INTEGER NOT NULL DEFAULT 0,
  level           SMALLINT NOT NULL DEFAULT 1,
  preferred_theme VARCHAR(24) NOT NULL DEFAULT 'neon-night',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_last_seen ON users(last_seen_at);

CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Cars & customization
-- =============================================================
CREATE TABLE car_bodies (
  id          SMALLINT PRIMARY KEY,
  slug        VARCHAR(24) UNIQUE NOT NULL,          -- 'sedan', 'muscle', 'buggy', 'kart'
  top_speed   SMALLINT NOT NULL,                    -- tuning
  accel       SMALLINT NOT NULL,
  handling    SMALLINT NOT NULL,
  weight      SMALLINT NOT NULL,
  unlock_level SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE decals (
  id           SMALLINT PRIMARY KEY,
  slug         VARCHAR(24) UNIQUE NOT NULL,
  unlock_level SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE player_cars (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_id        SMALLINT NOT NULL REFERENCES car_bodies(id),
  primary_hex    CHAR(7) NOT NULL,                  -- '#RRGGBB'
  secondary_hex  CHAR(7) NOT NULL,
  decal_id       SMALLINT REFERENCES decals(id),
  race_number    SMALLINT NOT NULL CHECK (race_number BETWEEN 0 AND 99),
  horn_id        SMALLINT NOT NULL DEFAULT 1,
  trail_id       SMALLINT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_player_cars_active
  ON player_cars(user_id) WHERE is_active = TRUE;

-- =============================================================
-- Tracks
-- =============================================================
CREATE TABLE tracks (
  id            SMALLINT PRIMARY KEY,
  slug          VARCHAR(32) UNIQUE NOT NULL,
  display_name  VARCHAR(48) NOT NULL,
  difficulty    SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  lap_length_m  INTEGER NOT NULL,
  laps_default  SMALLINT NOT NULL DEFAULT 3,
  data_json     JSONB NOT NULL                     -- tile map, waypoints, spawns
);

-- =============================================================
-- Rooms & matches
-- =============================================================
CREATE TYPE room_status AS ENUM
  ('waiting','countdown','racing','finished','closed');

CREATE TABLE rooms (
  code           CHAR(6) PRIMARY KEY,               -- e.g. 'K7X9Q2'
  host_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         room_status NOT NULL DEFAULT 'waiting',
  track_id       SMALLINT REFERENCES tracks(id),
  laps           SMALLINT NOT NULL DEFAULT 3,
  max_players    SMALLINT NOT NULL DEFAULT 8,
  is_private     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rooms_last_activity ON rooms(last_activity);

CREATE TABLE room_players (
  room_code   CHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  car_id      UUID NOT NULL REFERENCES player_cars(id),
  slot        SMALLINT NOT NULL CHECK (slot BETWEEN 0 AND 7),
  is_ready    BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_code, user_id),
  UNIQUE (room_code, slot)
);

CREATE TABLE matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code     CHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  track_id      SMALLINT NOT NULL REFERENCES tracks(id),
  laps          SMALLINT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  seed          BIGINT NOT NULL                     -- deterministic replay
);

CREATE TABLE match_results (
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  finish_pos    SMALLINT,                            -- NULL = DNF
  best_lap_ms   INTEGER,
  total_time_ms INTEGER,
  xp_awarded    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX idx_match_results_user ON match_results(user_id);

-- =============================================================
-- Telemetry (optional, for tuning)
-- =============================================================
CREATE TABLE perf_samples (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  match_id   UUID REFERENCES matches(id) ON DELETE CASCADE,
  fps_p50    SMALLINT,
  fps_p95    SMALLINT,
  rtt_ms     SMALLINT,
  device_ua  TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Migration policy:** Drizzle-kit generates SQL migrations; every migration is reviewed and committed. No auto-migrate in production.

---

## 9. Gameplay Systems

### 9.1 Car handling model
Arcade, not sim. Two-force model:
- **Longitudinal:** throttle → acceleration curve capped at body's top speed; brake = negative accel; coasting = light drag.
- **Lateral:** steering input rotates heading; grip coefficient shifts based on surface (track / grass / oil) and drift state.
- **Drift:** hold brake + steer → grip drops from `0.95` to `0.55`, awards boost meter.
- **Boost:** consumes meter, +25% top speed for up to 2s.

### 9.2 Track surfaces
Encoded in the tile map's `surfaceMap` layer:
| Surface | Grip | Speed mult |
|---|---|---|
| Track | 1.00 | 1.00 |
| Grass | 0.60 | 0.75 |
| Oil | 0.35 | 1.00 |
| Boost pad | 1.00 | 1.30 (0.5s) |

### 9.3 AI (for solo mode and lobby fill)
- Waypoint-following with lookahead steering.
- Rubber-banding disabled by default (transparent for skilled players); optional in casual mode.
- 3 skill tiers: Rookie / Pro / Legend.

### 9.4 Input
- **Keyboard:** WASD or Arrows, Space = brake/drift, Shift = boost, H = horn.
- **Gamepad:** left stick + triggers (Xinput mapping).
- **Touch (mobile):** virtual stick left, gas/brake right, boost = double-tap gas.

---

## 10. Audio

- **Engine loop** — 3 layered loops (idle / mid / high) crossfaded by RPM.
- **Tire squeal** — triggered when lateral slip exceeds threshold.
- **Impact** — velocity-scaled hit sound.
- **Music** — 4 chiptune tracks (menu, race intro, race, results), 60–120 BPM range.
- All audio through Howler with a single audio sprite per category.
- Mute-first policy on mobile (browser autoplay rules).

---

## 11. Repo & Directory Structure

```
pixel-racer/
├── app/                          # Next.js App Router
│   ├── (marketing)/page.tsx      # /  landing + start
│   ├── customize/page.tsx
│   ├── play/page.tsx
│   ├── room/new/page.tsx
│   ├── room/[code]/page.tsx
│   ├── race/[matchId]/page.tsx
│   ├── results/[matchId]/page.tsx
│   ├── settings/page.tsx
│   ├── profile/page.tsx
│   └── api/
│       ├── room/route.ts
│       ├── room/[code]/route.ts
│       └── auth/[...nextauth]/route.ts
├── game/                         # Framework-agnostic game code
│   ├── engine/
│   │   ├── loop.ts               # fixed-timestep + render
│   │   ├── renderer.ts           # PixiJS wrapper
│   │   ├── input.ts
│   │   └── audio.ts
│   ├── ecs/
│   │   ├── world.ts
│   │   ├── components/
│   │   └── systems/
│   ├── physics/                  # Rapier bindings
│   ├── netcode/
│   │   ├── client.ts
│   │   ├── prediction.ts
│   │   └── snapshot.ts
│   ├── scenes/
│   │   ├── lobby.ts
│   │   ├── race.ts
│   │   └── results.ts
│   └── tracks/                   # JSON + generation
├── server/                       # Standalone WS game server
│   ├── index.ts
│   ├── room.ts                   # authoritative sim
│   └── snapshot.ts
├── design-tokens/
│   └── theme.ts
├── db/
│   ├── schema.ts                 # Drizzle schema
│   ├── migrations/
│   └── seed.ts
├── assets/
│   ├── sprites/                  # .aseprite sources
│   ├── atlas/                    # generated at build
│   └── audio/
├── scripts/
│   ├── build-atlas.ts
│   └── perf-benchmark.ts
├── tests/
│   ├── unit/
│   ├── netcode/
│   └── perf/                     # Playwright FPS gate
├── drizzle.config.ts
├── next.config.ts
└── package.json
```

---

## 12. Milestones

| Phase | Duration | Deliverable |
|---|---|---|
| **0. Foundation** | 1 wk | Next.js app, Pixi canvas rendering a car, 90 FPS proven on reference hardware |
| **1. Single-player core** | 2 wks | One track, drivable car, lap timing, AI opponents, settings |
| **2. Customization + DB** | 1 wk | Postgres wired, car customizer functional, guest accounts |
| **3. Multiplayer alpha** | 2 wks | Rooms + codes, WS server, 2-player race with prediction |
| **4. Netcode hardening** | 1 wk | Lag comp, reconciliation, disconnect handling, 8-player stress test |
| **5. Content pass** | 2 wks | 4 tracks, 4 car bodies, decals, 4 music tracks, all SFX |
| **6. Polish & perf gate** | 1 wk | 90+ FPS on target devices, mobile controls, theming complete |
| **7. Closed beta** | 1 wk | Room-code invites to friends, telemetry dashboards |
| **8. Public launch** | — | Marketing page, share links, launch tweet |

**Total: ~11 weeks to public launch.**

---

## 13. Quality Bar (Definition of Done)

A feature is done when:
- [ ] Runs at 90+ FPS on the reference machine (M2 Air, mid-range Windows laptop, Pixel 7)
- [ ] Zero React re-renders during active gameplay (verified via React Profiler)
- [ ] All colors sourced from theme tokens — grep for hardcoded hex fails CI
- [ ] Netcode paths have at least one Playwright test with induced 100ms latency
- [ ] All new DB tables have Drizzle schema + migration + seed data
- [ ] Assets go through the atlas pipeline (no raw PNGs in `public/`)
- [ ] Reviewed by design + engineering, screenshot in PR

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Browser variance kills 90 FPS on low-end devices | Quality preset auto-selects based on FPS probe in first 3s; caps at 60 if needed |
| WebSocket costs at scale | Rooms are ephemeral; idle rooms closed after 5 min; server sized per-region |
| Cheating via client tampering | Server is authoritative; client-side is prediction only |
| Pixel art asset production is slow | Lock scope to 4 cars + 4 tracks for v1; commission art in parallel with engineering |
| PostgreSQL becomes bottleneck for matches | Match writes are batched at match-end only; real-time state lives in server memory |

---

## 15. Open Questions

1. Do we support **replays**? (Deterministic sim + seed makes it cheap — recommend yes in v1.1.)
2. **Voice chat** in lobby? (Skip v1, revisit if beta demand is high.)
3. **Track editor** for user-generated content? (v2 candidate — huge retention lever.)
4. Hosted region strategy — start with **us-east-1** only, add EU + APAC based on player geography.

---

*Document owner: Darshan / TB Team. Living document — revise at end of each milestone.*
