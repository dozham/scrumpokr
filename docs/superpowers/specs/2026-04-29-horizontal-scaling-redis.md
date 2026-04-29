# Horizontal Scaling via Redis: Design Spec

**Date:** 2026-04-29
**Status:** Approved

## Goal

Make ScrumPokr horizontally scalable by moving room state out of process memory into a shared store (Redis), while keeping a swappable in-memory backend for local development and testing.

---

## Data Layer

### Abstraction Interface

`src/lib/store/adapter.ts` defines `RoomStoreAdapter`:

```ts
export interface RoomStoreAdapter {
  readRoom(id: string): Promise<RoomState | null>
  writeRoom(id: string, state: RoomState): Promise<void>
  deleteRoom(id: string): Promise<void>
  publish(roomId: string, state: RoomState): Promise<void>
  subscribe(roomId: string, cb: (state: RoomState) => void): () => void
  startCleanup(): void
}
```

### `RoomState` type

A new `RoomState` type (serializable, no `ws` references) mirrors the current `Room` class fields:

| field | type |
|-------|------|
| `id` | `string` |
| `phase` | `'voting' \| 'revealed'` |
| `deck` | `DeckType` |
| `customCards` | `Card[] \| undefined` |
| `currentStory` | `string \| undefined` |
| `participants` | `StoredParticipant[]` |
| `votes` | `Record<string, Card>` |
| `history` | `RoundResult[]` |
| `hostOnlyReveal` | `boolean` |
| `eventLog` | `EventLogEntry[]` |
| `selectedVerdict` | `Card \| 'NO_CONSENSUS' \| undefined` |
| `tokens` | `Record<string, string>` (token → participantId) |
| `lastActivityAt` | `number` (epoch ms) |

`StoredParticipant` is `Participant` without the `ws` field.

### `InMemoryAdapter` (`src/lib/store/memory.ts`)

- State: `Map<string, RoomState>`
- Pub/sub: Node.js `EventEmitter` (keyed by roomId)
- `startCleanup()`: `setInterval` every 5 minutes, deletes rooms where `lastActivityAt` is older than 24 hours
- Default adapter (zero config)

### `RedisAdapter` (`src/lib/store/redis.ts`)

- Two `ioredis` connections: one for commands, one subscribe-only
- `writeRoom`: `SET scrumpokr:room:<id> <json> EX 86400`
- `readRoom`: `GET` + JSON parse
- `deleteRoom`: `DEL`
- `publish`: `PUBLISH scrumpokr:room:<id> <json>`
- `subscribe`: `SUBSCRIBE scrumpokr:room:<id>`, calls `cb` on each message; returns unsubscribe function
- `startCleanup()`: no-op (TTL handles expiry)

### Adapter Selection

`src/lib/store/index.ts` exports `getAdapter()`:
- Reads `ROOM_STORE_ADAPTER` env var (`memory` | `redis`)
- Defaults to `memory`
- Singleton: initialised once, reused

---

## Pure Room Functions

`src/lib/roomFns.ts` contains stateless mutation functions. Each takes the current `RoomState` and inputs, returns a new `RoomState`:

```ts
castVote(state, participantId, card): RoomState
reveal(state, actorName): RoomState
reset(state, actorName): RoomState
setStory(state, title): RoomState
selectVerdict(state, card): RoomState
addParticipant(state, name, role, token): { state: RoomState; id: string }
reconnectParticipant(state, token): RoomState | null
```

Logic is ported directly from the current `Room` class methods. Every mutation function updates `lastActivityAt` to `Date.now()`. Existing tests migrate to test these functions.

The `Room` class and `src/lib/registry.ts` are removed.

---

## Handler Refactor (`src/ws/handler.ts`)

### Per-instance connection map

```ts
const connections = new Map<string, Map<string, WebSocket>>()
// connections.get(roomId)?.get(participantId) → live WebSocket
```

WebSocket references never leave the process.

### On connect

1. Read `RoomState` from adapter (or 1008 close if not found)
2. Apply `addParticipant` or `reconnectParticipant` → new state
3. Write new state to adapter
4. Publish new state
5. Register `adapter.subscribe(roomId, broadcastToLocalClients)` if first client in this room on this instance
6. Add ws to `connections`
7. Send initial personalised `room_state` to new client
8. Broadcast `participant_joined` to other local clients (reconnects skip this)

### On message

1. Read current `RoomState` from adapter
2. Apply appropriate pure function → new state
3. Write new state to adapter
4. `adapter.publish(roomId, newState)` — triggers `broadcastToLocalClients` on every instance (including this one) via subscription callback

### On disconnect

- Remove from `connections`
- If room has no more local clients, call the unsubscribe function returned by `adapter.subscribe`

### `broadcastToLocalClients(roomId, state)`

Iterates `connections.get(roomId)`, sends personalised `room_state` to each (same `buildRoomState` personalisation as today).

---

## Infrastructure

### Environment Variables

| Var | Default | Notes |
|-----|---------|-------|
| `ROOM_STORE_ADAPTER` | `memory` | `redis` activates RedisAdapter |
| `REDIS_URL` | — | Required when adapter is `redis` |

### `server.ts`

- Call `getAdapter().startCleanup()` instead of current `startCleanup()`
- Remove `globalThis.__scrumpokrRooms` bootstrap

### `docker-compose.yml`

Adds a `redis` service. The `app` service gains:
```yaml
environment:
  ROOM_STORE_ADAPTER: redis
  REDIS_URL: redis://redis:6379
```

### GCP Cloud Run

Set `ROOM_STORE_ADAPTER=redis` and `REDIS_URL` (Cloud Memorystore) as Cloud Run environment variables/secrets. No code changes between environments.

### WebSocket sticky sessions

Not required. Pub/sub ensures every instance broadcasts fresh state to its local clients regardless of which instance handled the mutation.

---

## Migration Path

1. Implement abstraction + `InMemoryAdapter` — all existing tests stay green, zero behaviour change
2. Add pure functions in `roomFns.ts`, migrate tests
3. Refactor `handler.ts` to use adapter + connection map (still `InMemoryAdapter`)
4. Add `RedisAdapter` — testable locally via Docker Compose
5. Deploy to Cloud Run with `ROOM_STORE_ADAPTER=redis`

---

## Out of Scope

- Session affinity / sticky routing (pub/sub makes it unnecessary)
- Redis cluster/sentinel
- Persistence across Redis restarts (rooms are ephemeral by design)
- Presence / online indicators beyond current behaviour
