# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev        # Start dev server (tsx watch server.ts — auto-restarts on changes)
npm run build      # Production Next.js build
npm test           # Run all tests once (Vitest)
npm run test:watch # Run tests in watch mode
npx tsc --noEmit   # Type-check without emitting
```

To run a single test file:
```bash
npx vitest run src/__tests__/room.test.ts
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for a full description with Mermaid diagrams covering:
- System overview (HTTP server, Next.js, WebSocket, Room registry)
- WebSocket message flow (sequence diagram)
- `Room` class fields
- Reconnection model
- Frontend state ownership

### Key points

- `npm run dev` is `tsx watch server.ts`, **not** `next dev`. The custom server attaches WebSockets to the same HTTP port as Next.js.
- All room state is in-memory (`globalThis.__scrumpokrRooms`). The `globalThis` store is necessary because Turbopack isolates the API route module from `server.ts`.
- After every mutation, `broadcastRoomStateAll()` sends a full personalised `room_state` snapshot to every connected participant. Clients replace their entire local state on receipt.
- Tests cover server-side logic only (`src/__tests__/`). There are no component tests.
