# Sticky Rooms Design

**Date:** 2026-06-03  
**Status:** Approved

## Problem

Every planning session requires creating a new room and resharing the link. Teams want a single, stable URL they can bookmark and reuse each sprint.

## Goal

Give rooms a permanent URL. When a team returns to their bookmarked `/room/{id}` after a deploy or expiry, the room is automatically recreated with the same settings (fresh state — no votes, participants, or history carried over).

## Out of scope

- Persisting room state (votes, history, participants) across sessions
- Horizontal scaling / WebSocket fanout
- Custom or human-readable room slugs

## Solution

Firestore as a write-through config store. In-memory `Room` objects remain the live source of truth for all real-time state. Firestore is only consulted when a room is missing from memory.

## Firestore document

Collection: `rooms`  
Document ID: `{roomId}` (the existing `nanoid(8)` ID)

```
{
  deck:           'fibonacci' | 'powers-of-2' | 'tshirt' | 'custom'
  customCards?:   string[]
  hostOnlyReveal: boolean
  createdAt:      Timestamp   ← used for TTL policy (1 year)
}
```

A Firestore document TTL policy on `createdAt` (1 year) handles cleanup — no application code needed.

## Data flow

### Room creation

```
POST /api/rooms
  → createRoom()           # in-memory Room, same as today
  → saveRoomConfig(room)   # fire-and-forget Firestore write
  → return { roomId }
```

If `saveRoomConfig` fails, log the error and continue. The room is usable for this session; the URL just won't survive a cold start.

### Room access (WebSocket connect)

```
WS /ws?roomId=…
  → getOrRestoreRoom(id)
      1. Check in-memory Map  →  hit: return Room
      2. Check Firestore      →  hit: new Room(config), insert into Map, return
      3. Miss                 →  return undefined → WS closes with error (same as today)
```

### Room expiry

`startCleanup()` evicts rooms from memory after 24h of inactivity — unchanged. The Firestore config is untouched, so the URL remains valid. The next visit recreates the room in memory.

## Components touched

| File | Change |
|------|--------|
| `src/lib/firestore.ts` | New. Firestore client + `saveRoomConfig` + `getRoomConfig` |
| `src/lib/registry.ts` | `getRoom` → async `getOrRestoreRoom` (memory → Firestore fallback) |
| `src/app/api/rooms/route.ts` | Fire-and-forget `saveRoomConfig` after `createRoom()` |
| `src/ws/handler.ts` | Await `getOrRestoreRoom` instead of sync `getRoom` |

## Auth

**Cloud Run:** Application Default Credentials via workload identity — no secrets to manage. The Cloud Run service account needs the `roles/datastore.user` IAM role on the Firestore project.

**Local dev:** `gcloud auth application-default login`. Alternatively, point `GOOGLE_APPLICATION_CREDENTIALS` at a service account JSON key.

## Error handling

| Scenario | Behaviour |
|----------|-----------|
| Firestore write fails on creation | Log error, return room ID normally |
| Firestore read fails on cold-start lookup | Treat as room-not-found; WS closes with error |
| Room ID never existed in Firestore | Same room-not-found path |

## Dependencies

- `firebase-admin` npm package (includes Firestore SDK, uses ADC automatically)
