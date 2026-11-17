# Pixel Racer — Arcade Racing Prototype

A browser-based pixel-style racing experience exploring arcade driving, vehicle customization, and multiplayer lobby concepts.

## Stack

- Next.js 15 and React 19
- TypeScript
- Three.js
- WebSocket server with `ws`
- Drizzle ORM

## Development

```bash
npm install
npm run dev
```

Open the local URL provided by Next.js (usually `http://localhost:3000`).

For the standalone WebSocket server, see `npm run server` and the server-side configuration in `server/`.

```bash
npm run build
```

## Project structure

- `app/` — Next.js routes
- `components/` — interface components
- `game/` — gameplay and audio logic
- `design-tokens/` — visual system
- `db/` — persistence utilities
- `server/` — WebSocket server

## Status

Prototype. Multiplayer reliability, claimed performance numbers, and deployment readiness have **not** been independently verified. Please run a build and browser smoke test before release.

## Portfolio

[More work and case studies](https://tanveerkureshi.com)
