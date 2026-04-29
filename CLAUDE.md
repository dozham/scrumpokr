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
npx vitest run src/__tests__/roomFns.test.ts
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for a full description with Mermaid diagrams covering:
- System overview (HTTP server, Next.js, WebSocket, store adapter)
- WebSocket message flow (sequence diagram)
- `StoredRoomState` fields
- Reconnection model
- Frontend state ownership

### Key points

- `npm run dev` is `tsx watch server.ts`, **not** `next dev`. The custom server attaches WebSockets to the same HTTP port as Next.js.
- Room state is stored via `getAdapter()` (`src/lib/store/index.ts`). The adapter is a `globalThis.__scrumpokrAdapter` singleton — the `globalThis` trick is necessary because Turbopack isolates the API route module from `server.ts`. Default is `InMemoryAdapter`; set `ROOM_STORE_ADAPTER=redis` + `REDIS_URL` to use Redis.
- Room mutations are pure functions in `src/lib/roomFns.ts` (take/return `StoredRoomState`). WebSocket references are kept in a per-instance `roomConnections` map in `handler.ts` and never serialized.
- After every mutation, `handler.ts` writes the new state to the adapter and calls `adapter.publish()`. All subscribed instances receive the state and call `broadcastToLocalClients()`, sending a personalised `room_state` snapshot to each local WebSocket.
- Tests cover server-side logic only (`src/__tests__/`). There are no component tests.
