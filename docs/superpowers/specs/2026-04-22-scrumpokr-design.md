# Scrumpokr — Design Spec

**Date:** 2026-04-22  
**Status:** Approved

## Overview

A modern public SaaS scrum poker tool. Teams create a room, share a link, and vote on story points in real time. No accounts required — participants join with a display name. Hosted as a single Docker container.

---

## Product Decisions

| Decision | Choice |
|---|---|
| Deployment model | Public SaaS |
| Authentication | None — join with name + shareable link |
| Card decks | Fibonacci, Powers of 2, T-shirt sizes, Custom (all selectable at room creation) |
| Features (v1) | Core voting, voting history, spectator mode |
| Excluded (v1) | Timer, issue queue, export, Jira/Linear integration |

---

## Architecture

One Docker container. A single `server.ts` entry point creates a Node.js `http.Server`, attaches the Next.js request handler for HTTP, and attaches a `ws` WebSocketServer to the same server. Room state lives in an in-memory `Map<roomId, Room>` — no database.

```
Browser ──HTTP──▶  server.ts (Node.js http.Server)
Browser ──WS───▶      ├── Next.js handler  (SSR + /api/rooms)
                       ├── WebSocketServer  (ws library)
                       └── Room Registry    (Map in memory)
```

**Why no database:** Sessions are ephemeral by design. Rooms expire after 24h of inactivity. A database would add ops complexity with no user-facing benefit in v1.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router |
| Language | TypeScript (strict) |
| WebSockets | `ws` library |
| UI | Tailwind CSS + shadcn/ui |
| ID generation | `nanoid` (short room IDs, e.g. `xk92p`) |
| Testing | Vitest (unit tests for room logic) |
| Container | Docker, `node:alpine` base |

---

## Data Model

```ts
type DeckType = 'fibonacci' | 'powers-of-2' | 'tshirt' | 'custom'
type Card = string | number

interface Participant {
  id: string          // nanoid
  name: string
  role: 'voter' | 'spectator'
  isHost: boolean
  ws: WebSocket
}

interface RoundResult {
  story?: string
  votes: Record<participantId, Card>  // id → card (name stored in Participant)
  consensus?: Card                     // auto-set when all voters agree; else undefined
  timestamp: number
}

interface RoomState {
  id: string
  deck: DeckType
  customCards?: Card[]
  phase: 'voting' | 'revealed'
  currentStory?: string
  votes: Map<participantId, Card>
  participants: Map<participantId, Participant>
  history: RoundResult[]
  createdAt: number
  lastActivityAt: number
}
```

**Deck values:**
- Fibonacci: `[1, 2, 3, 5, 8, 13, 21, '?', '☕']`
- Powers of 2: `[1, 2, 4, 8, 16, 32, '?']`
- T-shirt: `['XS', 'S', 'M', 'L', 'XL', 'XXL']`
- Custom: array of strings/numbers provided at room creation

---

## WebSocket Protocol

All messages are JSON. Client connects via `ws://host/ws?roomId=X&name=Y&role=voter|spectator`.

**Client → Server:**

| Type | Payload | Who |
|---|---|---|
| `vote` | `{ card: Card }` | voters |
| `reveal` | — | host only |
| `reset` | — | host only |
| `set_story` | `{ title: string }` | host only |

Name and role are passed as query params on the WebSocket upgrade request (`?roomId=X&name=Y&role=voter`), so no explicit `join` message is needed.

**Server → Client (broadcast):**

| Type | Payload |
|---|---|
| `room_state` | Full snapshot sent on join and after any state change |
| `participant_joined` | `{ id, name, role }` |
| `participant_left` | `{ id }` |
| `vote_cast` | `{ participantId }` — presence only, not the value |
| `votes_revealed` | `{ votes: Record<id, Card> }` |
| `round_reset` | `{}` |

**`room_state` shape** (sent on join, includes full current state):
```ts
{
  type: 'room_state',
  phase: 'voting' | 'revealed',
  deck: DeckType,
  customCards?: Card[],
  currentStory?: string,
  participants: Array<{ id, name, role, isHost, hasVoted: boolean }>,
  votes?: Record<participantId, Card>,  // only present in 'revealed' phase
  history: RoundResult[],
  yourId: string
}
```

During voting phase, `votes` is omitted from broadcasts — only `vote_cast` events reveal that someone has voted (not what they voted).

---

## Room Lifecycle

1. **Create** — `POST /api/rooms` with `{ deck, customCards? }` → returns `{ roomId }`. Host redirected to `/room/[id]`.
2. **Join** — Participants visit `/join/[id]`, enter a name, choose voter or spectator, then connect via WS.
3. **Voting** — Host optionally sets a story title. Voters pick a card. `vote_cast` broadcasts presence.
4. **Reveal** — Host sends `reveal`. All votes are broadcast. Stats shown (avg, min, max).
5. **Reset** — Host sends `reset`. Current round saved to `history`. Phase returns to `voting`.
6. **Expiry** — A cleanup interval runs every 5 minutes and removes rooms with `lastActivityAt` older than 24h.
7. **Host promotion** — If the host disconnects, the next voter in the participants Map becomes host.

---

## URL Structure

| Path | Purpose |
|---|---|
| `/` | Landing page — create room, choose deck |
| `/join/[id]` | Enter name and role before joining |
| `/room/[id]` | Live poker room |
| `/api/rooms` | `POST` — create room |

---

## File Structure

```
scrumpokr/
├── server.ts                  ← entry point: http.Server + Next.js + WS
├── src/
│   ├── app/
│   │   ├── page.tsx           ← landing page
│   │   ├── join/[id]/
│   │   │   └── page.tsx       ← join form
│   │   ├── room/[id]/
│   │   │   └── page.tsx       ← poker room
│   │   └── api/rooms/
│   │       └── route.ts       ← POST /api/rooms
│   ├── lib/
│   │   ├── room.ts            ← Room class (state + methods)
│   │   ├── registry.ts        ← Map<roomId, Room> + cleanup interval
│   │   ├── decks.ts           ← card values per deck type
│   │   └── types.ts           ← shared TypeScript types
│   ├── ws/
│   │   └── handler.ts         ← WebSocket message router
│   └── components/
│       ├── CardPicker.tsx
│       ├── ParticipantGrid.tsx
│       ├── ResultsSummary.tsx
│       └── VotingHistory.tsx
├── Dockerfile
└── docker-compose.yml
```

---

## UI Screens

**Landing (`/`):** Name input, deck selector (Fibonacci / Powers of 2 / T-shirt / Custom), "Create Room" button. Custom deck shows a text input for comma-separated values.

**Join (`/join/[id]`):** Display name input, voter/spectator toggle, "Join Room" button.

**Room (`/room/[id]`):**
- Top bar: logo, room code, copy-link button
- Current story (editable by host inline)
- Participant grid: face-down cards during voting (✓ if voted), revealed values after reveal, spectators shown with eye icon
- Card picker: current deck's cards, selected card highlighted
- Stats bar (revealed phase): avg, min, max; consensus value shown automatically when all voters pick the same card
- Voting history: list of past rounds with story title and consensus/votes
- Host controls: "Reveal Cards" / "Next Round" button

---

## Out of Scope (v1)

- Countdown timer
- Issue/story queue management
- CSV export
- Jira / Linear integration
- Persistent rooms across server restarts
- Mobile-specific optimizations
