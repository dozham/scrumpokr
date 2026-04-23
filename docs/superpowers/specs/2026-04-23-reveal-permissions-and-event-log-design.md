# Reveal Permissions & Event Log Design

**Date:** 2026-04-23  
**Status:** Approved

## Goal

By default, any participant (voter or spectator) can reveal votes and start the next round. Room creators can opt into host-only reveal mode. All reveal/reset actions are recorded in a room-level event log visible to all participants.

## Room Creation Option

`page.tsx` gains a toggle below the deck picker: **"Restrict reveals to host only"** — off by default. When submitted, `hostOnlyReveal: boolean` is sent to `POST /api/rooms`.

## Server Changes

### Room model (`src/lib/room.ts`)
- New `readonly hostOnlyReveal: boolean` property, set in constructor from parameter (default `false`).
- New `eventLog: EventLogEntry[]` array (empty on construction).
- On `reveal()`: push `{ type: 'revealed', actorName: string, timestamp: number }`.
- On `reset()`: push `{ type: 'reset', actorName: string, timestamp: number }`.
- Both methods accept `actorName: string` parameter.

### Types (`src/lib/types.ts`)
- New exported type:
  ```ts
  export interface EventLogEntry {
    type: string
    actorName: string
    timestamp: number
  }
  ```
- `ClientMessage`: no change (reveal/reset messages already exist).
- `ServerMessage` `room_state`: add `hostOnlyReveal: boolean` and `eventLog: EventLogEntry[]` fields.

### API route (`src/app/api/rooms/route.ts`)
- Accept `hostOnlyReveal?: boolean` from request body, pass to `Room` constructor.

### WS handler (`src/ws/handler.ts`)
- `reveal` handler: remove the `if (!participant.isHost) return` guard. Replace with `if (room.hostOnlyReveal && !participant.isHost) return`.
- `reset` handler: same change.
- Pass `participant.name` to `room.reveal(name)` and `room.reset(name)`.
- Include `hostOnlyReveal` and `eventLog` in `buildRoomState`.

## Client Changes

### `RoomClient.tsx`
- `RoomState` gains `hostOnlyReveal: boolean` and `eventLog: EventLogEntry[]`.
- Reveal/Reset buttons: shown when `!room.hostOnlyReveal || isHost` (previously only when `isHost`).
- Import and render `<EventLog entries={roomState.eventLog} />` below `<VotingHistory>`.

### `EventLog` component (`src/components/EventLog.tsx`)
New component. Renders a list of log entries with human-readable text:
- `type === 'revealed'` → `"{actorName} revealed the votes"`
- Any other type → `"{actorName} performed {type}"` (future-proof fallback)
- Timestamps shown as relative time or HH:MM.
- Styled to match existing `VotingHistory` panel (dark card, same padding/border).

## Files Changed

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `EventLogEntry`; extend `room_state` server message |
| `src/lib/room.ts` | Add `hostOnlyReveal`, `eventLog`, update `reveal`/`reset` signatures |
| `src/app/api/rooms/route.ts` | Accept `hostOnlyReveal` param |
| `src/ws/handler.ts` | Update reveal/reset auth; pass actor name; include log in state |
| `src/app/page.tsx` | Add host-only reveal toggle |
| `src/app/room/[id]/RoomClient.tsx` | Update state type, button logic, render EventLog |
| `src/components/EventLog.tsx` | Create new component |

## Out of Scope

- Persisting event log across server restarts
- More event types (joins, leaves, story changes) — structure supports them but they are not added now
- Filtering or paginating the event log
