# Architecture

## Overview

ScrumPokr is a real-time planning poker app. All game state lives in-memory on the server; clients receive full state snapshots over WebSocket after every mutation.

## System Diagram

```mermaid
graph TD
    subgraph Browser["Browser (per participant)"]
        RC["RoomClient.tsx\n(WebSocket owner, roomState)"]
        PG["ParticipantGrid"]
        RS["ResultsSummary"]
        VH["VotingHistory"]
        EL["EventLog"]
        RC --> PG
        RC --> RS
        RC --> VH
        RC --> EL
    end

    subgraph Server["Node.js Process (server.ts)"]
        HTTP["HTTP Server"]
        NXT["Next.js Handler\n(pages + API routes)"]
        WSS["WebSocket Server\n(src/ws/handler.ts)"]
        REG["Room Registry\nglobalThis.__scrumpokrRooms"]
        ROOM["Room instance\n(src/lib/room.ts)"]

        HTTP --> NXT
        HTTP --> WSS
        WSS --> REG
        REG --> ROOM
    end

    RC -- "WS upgrade /ws?roomId=&name=&role=&token=" --> WSS
    RC -- "POST /api/rooms" --> NXT
    NXT -- "createRoom()" --> REG
    WSS -- "broadcastRoomStateAll()" --> RC
```

## Custom Server

The app does **not** use `next dev`. `server.ts` creates a single HTTP server that:
1. Passes all HTTP requests to Next.js (`app.getRequestHandler()`)
2. Attaches the WebSocket server to the **same port** via `attachWebSocket(server)`
3. Starts periodic room cleanup via `startCleanup()`

`npm run dev` runs `tsx watch server.ts`, which auto-restarts the entire Node.js process on any change to server-side files. Next.js HMR handles client-side file changes separately.

## Global Room Store

Rooms are stored in `Map<string, Room>` on `globalThis.__scrumpokrRooms`. The `globalThis` trick is necessary because Next.js (Turbopack) compiles the `/api/rooms` route in a separate module context from `server.ts` — a plain module-level `Map` would produce two disconnected maps.

Rooms expire after 24 hours of inactivity (checked every 5 minutes by `startCleanup()`).

## WebSocket Message Flow

```mermaid
sequenceDiagram
    participant C as Client (RoomClient)
    participant H as handler.ts
    participant R as Room

    C->>H: connect /ws?roomId=…&token=…
    H->>R: reconnectParticipant(token, ws) or addParticipant()
    H-->>C: room_state (full snapshot, yourId personalised)

    Note over C,R: Voting phase
    C->>H: { type: "vote", card: 5 }
    H->>R: castVote(participantId, 5)
    H-->>C: vote_cast + room_state (to all)

    C->>H: { type: "reveal" }
    H->>R: reveal(actorName)
    H-->>C: votes_revealed + room_state (to all)

    Note over C,R: Revealed phase
    C->>H: { type: "select_verdict", card: 5 }
    H->>R: selectVerdict(5)
    H-->>C: room_state (to all, selectedVerdict: 5)

    C->>H: { type: "reset" }
    H->>R: reset(actorName)  [saves to history, clears votes]
    H-->>C: round_reset + room_state (to all)
```

### Client → Server messages (`ClientMessage`)

| type | payload | effect |
|------|---------|--------|
| `vote` | `card: Card` | Cast or change vote (voting phase only) |
| `reveal` | — | Flip all cards |
| `reset` | — | Save round to history, start new round |
| `set_story` | `title: string` | Update current story title |
| `select_verdict` | `card: Card \| 'NO_CONSENSUS'` | Pick final verdict (revealed phase only) |

### Server → Client messages (`ServerMessage`)

| type | when sent | notes |
|------|-----------|-------|
| `room_state` | After every mutation | Full snapshot; `yourId` is personalised per recipient |
| `participant_joined` | On new join | Broadcast to all except the joiner |
| `vote_cast` | After a vote | Lightweight; carries only `participantId` |
| `votes_revealed` | On reveal | Carries full `votes` map |
| `round_reset` | On reset | Signals clients to clear local `myVote` state |

## Room Class (`src/lib/room.ts`)

Single source of truth for all game state. Key fields:

| field | type | notes |
|-------|------|-------|
| `phase` | `'voting' \| 'revealed'` | |
| `votes` | `Map<participantId, Card>` | Cleared on `reset()` |
| `participants` | `Map<participantId, Participant>` | Holds live `ws` reference |
| `history` | `RoundResult[]` | Append-only; written on `reset()` |
| `selectedVerdict` | `Card \| 'NO_CONSENSUS' \| undefined` | Cleared on `reset()` |
| `eventLog` | `EventLogEntry[]` | Append-only; `'revealed'` and `'reset'` entries |

`reset()` derives `verdictSource` (`'natural'` / `'selected'` / `'none'`) before writing to history, so history icons are deterministic regardless of who was in the room at display time.

## Reconnection

Each client stores a per-room `token` (16-char random string) in `localStorage`. On reconnect, the same token is sent in the WS URL. `Room.reconnectParticipant(token, newWs)` swaps the `ws` reference and closes the old socket, preserving host status, votes, and identity across page reloads.

## Frontend State

`RoomClient.tsx` owns the WebSocket lifecycle and all room state (`useState<RoomState>`). It replaces the entire `roomState` on every incoming `room_state` message. Child components are pure display and receive slices as props.

`ResultsSummary` applies an **optimistic update** for verdict selection — it updates `roomState.selectedVerdict` locally before the server confirms — so the badge appears immediately on click.
