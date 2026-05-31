---
name: shared-room-joke-design
description: Sync a shared joke to all room participants via room_state; each user reveals independently
metadata:
  type: project
---

# Shared Room Joke — Design Spec

## Summary

Display the same joke to every participant in a room. The joke is fetched server-side when the room is created and stored in the `Room` object. It is distributed to all clients via the existing `room_state` broadcast. Any participant can request a new joke via a `request_joke` WebSocket message. Joke fetch failures never block room creation or any other functionality.

The answer reveal is per-user (local state only) — clicking "reveal answer" on one client has no effect on others.

## Data Model

**`src/lib/room.ts`**

Add one field to `Room`:

```ts
joke: { question: string; answer: string } | null = null
```

**`src/lib/types.ts`**

Add `joke` to the `room_state` ServerMessage (optional — absent when `null`):

```ts
joke?: { question: string; answer: string }
```

Add `request_joke` to `ClientMessage`:

```ts
| { type: 'request_joke' }
```

## Room Creation (`POST /api/rooms`)

After `createRoom(...)` returns, fire a best-effort joke fetch in the background:

```ts
fetchJokeForRoom(room)  // non-blocking, fire-and-forget
```

`fetchJokeForRoom` wraps the teehee.dev call with a 3-second `AbortController` timeout. On success it sets `room.joke`. On any failure (network error, non-OK status, timeout, bad shape) it leaves `room.joke = null` and returns silently. Room creation returns the `roomId` immediately, before the fetch settles.

The joke will arrive in the first `room_state` broadcast once a participant connects (if the fetch settled in time) or in a subsequent broadcast if it settles later. Clients that connect before the fetch settles receive `joke: undefined` in `room_state` and render the JokeBox in its empty/loading state.

## WebSocket Handler (`src/ws/handler.ts`)

Add a `request_joke` case:

```ts
case 'request_joke': {
  fetchJokeForRoom(room).then(() => broadcastRoomStateAll(room))
  break
}
```

`fetchJokeForRoom` is shared with the API route. If the fetch fails, `room.joke` is unchanged and no broadcast is sent (the room is already in a consistent state).

## `fetchJokeForRoom` Helper (`src/lib/fetchJoke.ts`)

A thin module extracted so both the API route and the WS handler can import it:

```ts
export async function fetchJokeForRoom(room: Room): Promise<void>
```

Internally uses a 3-second `AbortController` timeout. Validates that the response has `string` fields `question` and `answer`. Swallows all errors.

## Frontend

### `JokeBox` component (`src/components/JokeBox.tsx`)

Add a controlled mode via optional props:

```ts
interface JokeBoxProps {
  joke?: { question: string; answer: string } | null
  onRefresh?: () => void
}
```

**Controlled mode** (room page): `joke` and `onRefresh` are passed in. The component renders the joke from props and calls `onRefresh` when the refresh button is clicked. No internal fetch.

**Standalone mode** (home page): props are omitted. Component behaves exactly as today — fetches internally, manages its own loading/error state.

The `revealed` state stays local in both modes. In controlled mode there are three states:
- `joke === undefined`: first `room_state` not yet received — show a loading spinner
- `joke === null`: `room_state` received but server has no joke — show a soft "no joke loaded" fallback with the refresh button
- `joke` is an object: render question + reveal-answer button as normal

### `RoomClient` (`src/app/room/[id]/RoomClient.tsx`)

- Add `joke` to the `RoomState` interface: `joke: { question: string; answer: string } | null | undefined` (undefined = waiting for first room_state, null = no joke on server)
- Populate it from the `room_state` message
- Render `<JokeBox joke={roomState.joke} onRefresh={sendRequestJoke} />` below the main room UI
- `sendRequestJoke` sends `{ type: 'request_joke' }` over the WebSocket

### `buildRoomState` (`src/ws/handler.ts`)

Include `joke: room.joke` in the returned object (pass `null` as-is, not coerced to `undefined`).

## Error Handling

- Fetch failure on room creation: `room.joke` stays `null`, room is created normally.
- Fetch failure on `request_joke`: `room.joke` unchanged, no broadcast. Client sees no change (refresh button re-enables, joke stays as-is).
- `joke` field absent in `room_state` JSON: this should not happen since `buildRoomState` always includes it, but treat as `null` defensively on the client.

## Testing

No new server tests needed — `fetchJokeForRoom` is a fire-and-forget wrapper around an external API with no meaningful testable logic beyond what the existing unit test suite already covers. Manual verification via the dev server is sufficient.
