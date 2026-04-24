# Persistent Participants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Participants stay in the room permanently once they join — reconnections restore their existing slot (vote, host status) instead of creating a new participant entry.

**Architecture:** A stable `token` (nanoid, stored in localStorage) is generated once per participant per room and sent as a WebSocket query param on every connection. The server matches incoming connections by token: if the token belongs to an existing participant, it updates their WebSocket reference; otherwise it creates a new participant. On disconnect, participants are no longer removed from the room — they simply stay, so other participants see no change.

**Tech Stack:** Next.js 16, React 19, TypeScript, `nanoid`, `ws` WebSocket library. No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `src/lib/storedIdentity.ts` | Add `getOrCreateParticipantToken(roomId)`, update `clearStoredIdentity` to also remove token |
| `src/__tests__/storedIdentity.test.ts` | Add tests for the new function |
| `src/lib/types.ts` | Add `token: string` to `Participant` interface |
| `src/lib/room.ts` | Add `tokens` map, update `addParticipant` signature to require token, add `reconnectParticipant` method |
| `src/__tests__/room.test.ts` | Update existing `addParticipant` calls to pass token; add tests for `reconnectParticipant` |
| `src/ws/handler.ts` | Read token from URL params, use reconnect-or-create logic, remove `removeParticipant` from close handler |
| `src/app/room/[id]/RoomClient.tsx` | Read token via `getOrCreateParticipantToken`, append to WebSocket URL |
| `src/app/page.tsx` | Call `getOrCreateParticipantToken` after creating room |
| `src/app/join/[id]/JoinForm.tsx` | Call `getOrCreateParticipantToken` on join |

---

### Task 1: Add participant token to storedIdentity

**Files:**
- Modify: `src/lib/storedIdentity.ts`
- Modify: `src/__tests__/storedIdentity.test.ts`

**Context:** `storedIdentity.ts` currently stores `name-{roomId}` and `role-{roomId}` in localStorage. We need a third key, `token-{roomId}`, that is created once per room on first join and reused forever. `clearStoredIdentity` (called when someone clicks "Join as someone new") must also clear the token so the fresh join gets a new participant slot.

`nanoid` is already a dependency — it's used in `src/lib/room.ts`.

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/storedIdentity.test.ts` after the existing imports:

```ts
import { getStoredIdentity, setStoredIdentity, clearStoredIdentity, getOrCreateParticipantToken } from '../lib/storedIdentity'
```

Add these test blocks after the existing `clearStoredIdentity` describe block:

```ts
describe('getOrCreateParticipantToken', () => {
  it('creates and stores a token on first call', () => {
    const token = getOrCreateParticipantToken('abc')
    expect(token).toBeTruthy()
    expect(localStorage.getItem('token-abc')).toBe(token)
  })

  it('returns the same token on subsequent calls', () => {
    const token1 = getOrCreateParticipantToken('abc')
    const token2 = getOrCreateParticipantToken('abc')
    expect(token1).toBe(token2)
  })

  it('returns different tokens for different rooms', () => {
    const t1 = getOrCreateParticipantToken('room-a')
    const t2 = getOrCreateParticipantToken('room-b')
    expect(t1).not.toBe(t2)
  })
})

describe('clearStoredIdentity (token)', () => {
  it('also removes the participant token', () => {
    localStorage.setItem('name-abc', 'Alice')
    localStorage.setItem('role-abc', 'voter')
    localStorage.setItem('token-abc', 'some-token')
    clearStoredIdentity('abc')
    expect(localStorage.getItem('token-abc')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm test 2>&1 | tail -20
```

Expected: failures mentioning `getOrCreateParticipantToken is not a function`.

- [ ] **Step 3: Implement the changes**

Replace `src/lib/storedIdentity.ts` with:

```ts
import { nanoid } from 'nanoid'

export interface StoredIdentity {
  name: string
  role: 'voter' | 'spectator'
}

export function getStoredIdentity(roomId: string): StoredIdentity | null {
  const name = localStorage.getItem(`name-${roomId}`)
  const role = localStorage.getItem(`role-${roomId}`) as 'voter' | 'spectator' | null
  if (!name || !role) return null
  return { name, role }
}

export function setStoredIdentity(roomId: string, name: string, role: 'voter' | 'spectator'): void {
  localStorage.setItem(`name-${roomId}`, name)
  localStorage.setItem(`role-${roomId}`, role)
}

export function clearStoredIdentity(roomId: string): void {
  localStorage.removeItem(`name-${roomId}`)
  localStorage.removeItem(`role-${roomId}`)
  localStorage.removeItem(`token-${roomId}`)
}

export function getOrCreateParticipantToken(roomId: string): string {
  const existing = localStorage.getItem(`token-${roomId}`)
  if (existing) return existing
  const token = nanoid(16)
  localStorage.setItem(`token-${roomId}`, token)
  return token
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storedIdentity.ts src/__tests__/storedIdentity.test.ts
git commit -m "feat: add participant token to storedIdentity"
```

---

### Task 2: Add token and reconnect logic to Room

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/room.ts`
- Modify: `src/__tests__/room.test.ts`

**Context:** `Participant` needs a `token` field. `Room` needs a `tokens: Map<string, string>` (token → participantId) for O(1) lookup. `addParticipant` gains a required `token` parameter. New method `reconnectParticipant(token, ws)` finds the participant by token, swaps their WebSocket, and returns them (or `null` if the token is unknown). Existing tests call `addParticipant` without a token and must be updated to compile.

- [ ] **Step 1: Write new failing tests**

Add these blocks to `src/__tests__/room.test.ts` after the existing `addParticipant` describe block:

```ts
  describe('addParticipant (token)', () => {
    it('stores token in the tokens map', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      expect(room.tokens.get('tok-1')).toBe(p.id)
    })
  })

  describe('reconnectParticipant', () => {
    it('returns null for an unknown token', () => {
      const room = new Room('fibonacci')
      expect(room.reconnectParticipant('unknown', mockWs())).toBeNull()
    })

    it('updates the ws reference and returns the participant', () => {
      const room = new Room('fibonacci')
      const ws2 = mockWs()
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      const restored = room.reconnectParticipant('tok-1', ws2)
      expect(restored).toBe(p)
      expect(p.ws).toBe(ws2)
    })

    it('preserves vote on reconnect', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      room.castVote(p.id, 5)
      room.reconnectParticipant('tok-1', mockWs())
      expect(room.votes.get(p.id)).toBe(5)
    })

    it('preserves host status on reconnect', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      expect(p.isHost).toBe(true)
      room.reconnectParticipant('tok-1', mockWs())
      expect(p.isHost).toBe(true)
    })
  })
```

- [ ] **Step 2: Run tests and verify the new ones fail**

```bash
npm test 2>&1 | tail -20
```

Expected: TypeScript errors because `addParticipant` now needs a 4th arg, and `reconnectParticipant` doesn't exist yet.

- [ ] **Step 3: Update types.ts**

Add `token: string` to the `Participant` interface in `src/lib/types.ts`:

```ts
export interface Participant {
  id: string
  name: string
  role: 'voter' | 'spectator'
  isHost: boolean
  ws: WebSocket
  token: string
}
```

- [ ] **Step 4: Update room.ts**

Replace `src/lib/room.ts` with:

```ts
import { nanoid } from 'nanoid'
import type { WebSocket } from 'ws'
import type { Card, DeckType, Participant, ParticipantSnapshot, RoundResult, EventLogEntry } from './types'

export class Room {
  readonly id: string
  readonly deck: DeckType
  readonly customCards?: Card[]
  readonly hostOnlyReveal: boolean
  phase: 'voting' | 'revealed' = 'voting'
  currentStory?: string
  votes = new Map<string, Card>()
  participants = new Map<string, Participant>()
  tokens = new Map<string, string>()
  history: RoundResult[] = []
  eventLog: EventLogEntry[] = []
  readonly createdAt: number
  lastActivityAt: number

  constructor(deck: DeckType, customCards?: Card[], hostOnlyReveal = false) {
    this.id = nanoid(8)
    this.deck = deck
    this.customCards = customCards
    this.hostOnlyReveal = hostOnlyReveal
    this.createdAt = Date.now()
    this.lastActivityAt = Date.now()
  }

  addParticipant(name: string, role: 'voter' | 'spectator', ws: WebSocket, token: string): Participant {
    const participant: Participant = {
      id: nanoid(8),
      name,
      role,
      isHost: role === 'voter' && !this.hasHost(),
      ws,
      token,
    }
    this.participants.set(participant.id, participant)
    this.tokens.set(token, participant.id)
    this.lastActivityAt = Date.now()
    return participant
  }

  reconnectParticipant(token: string, ws: WebSocket): Participant | null {
    const participantId = this.tokens.get(token)
    if (!participantId) return null
    const participant = this.participants.get(participantId)
    if (!participant) return null
    participant.ws = ws
    this.lastActivityAt = Date.now()
    return participant
  }

  removeParticipant(id: string): void {
    const p = this.participants.get(id)
    this.participants.delete(id)
    this.votes.delete(id)
    if (p) this.tokens.delete(p.token)
    this.lastActivityAt = Date.now()
    if (p?.isHost) this.promoteNextHost()
  }

  castVote(participantId: string, card: Card): void {
    const p = this.participants.get(participantId)
    if (!p || p.role !== 'voter' || this.phase !== 'voting') return
    this.votes.set(participantId, card)
    this.lastActivityAt = Date.now()
  }

  reveal(actorName: string): void {
    this.phase = 'revealed'
    this.eventLog.push({ type: 'revealed', actorName, timestamp: Date.now() })
    this.lastActivityAt = Date.now()
  }

  reset(actorName: string): void {
    if (this.phase !== 'revealed') return
    const votesObj: Record<string, Card> = Object.fromEntries(this.votes)
    this.history.push({
      story: this.currentStory,
      votes: votesObj,
      consensus: this.computeConsensus(),
      timestamp: Date.now(),
    })
    this.eventLog.push({ type: 'reset', actorName, timestamp: Date.now() })
    this.votes.clear()
    this.phase = 'voting'
    this.currentStory = undefined
    this.lastActivityAt = Date.now()
  }

  setStory(title: string): void {
    this.currentStory = title
    this.lastActivityAt = Date.now()
  }

  toParticipantSnapshots(): ParticipantSnapshot[] {
    return Array.from(this.participants.values()).map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      isHost: p.isHost,
      hasVoted: this.votes.has(p.id),
    }))
  }

  private computeConsensus(): Card | undefined {
    const voters = Array.from(this.participants.values()).filter(p => p.role === 'voter')
    if (voters.length === 0) return undefined
    const cards = voters.map(v => this.votes.get(v.id)).filter((c): c is Card => c !== undefined)
    if (cards.length !== voters.length) return undefined
    return new Set(cards.map(String)).size === 1 ? cards[0] : undefined
  }

  private hasHost(): boolean {
    return Array.from(this.participants.values()).some(p => p.isHost)
  }

  private promoteNextHost(): void {
    const next = Array.from(this.participants.values()).find(p => p.role === 'voter')
    if (next) next.isHost = true
  }
}
```

- [ ] **Step 5: Update existing room tests to pass a token**

In `src/__tests__/room.test.ts`, every call to `room.addParticipant(name, role, mockWs())` must gain a 4th argument. Replace every occurrence of:

```ts
room.addParticipant('Alice', 'voter', mockWs())
```
with:
```ts
room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
```

And similarly:
- `room.addParticipant('Bob', 'voter', mockWs())` → `room.addParticipant('Bob', 'voter', mockWs(), 'tok-bob')`
- `room.addParticipant('Dave', 'spectator', mockWs())` → `room.addParticipant('Dave', 'spectator', mockWs(), 'tok-dave')`

There are approximately 20 such calls in the file. Update all of them. Each token string just needs to be unique within its test — use descriptive strings like `'tok-alice'`, `'tok-bob'`, `'tok-dave'`.

- [ ] **Step 6: Run all tests and verify they pass**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/room.ts src/__tests__/room.test.ts
git commit -m "feat: add token-based reconnect to Room"
```

---

### Task 3: Update WebSocket handler

**Files:**
- Modify: `src/ws/handler.ts`

**Context:** The handler currently calls `room.removeParticipant` in the `close` event — this is what causes participants to disappear. The new logic: read `token` from the URL params; if it matches an existing participant, call `reconnectParticipant` (restores their slot); otherwise call `addParticipant`. On close, just clean up the heartbeat set — the participant stays in the room.

`nanoid` must be imported as a fallback for connections that arrive without a token (shouldn't happen with the updated client, but safe to handle).

No automated tests for handler.ts — verify manually by running the dev server (Step 4).

- [ ] **Step 1: Replace handler.ts**

```ts
import { nanoid } from 'nanoid'
import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { IncomingMessage } from 'http'
import { getRoom } from '@/lib/registry'
import type { ClientMessage, ServerMessage } from '@/lib/types'
import type { Room } from '@/lib/room'

const HEARTBEAT_INTERVAL_MS = 25_000

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true })

  const alive = new Set<WebSocket>()
  const heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (!alive.has(client)) {
        client.terminate()
        continue
      }
      alive.delete(client)
      client.ping()
    }
  }, HEARTBEAT_INTERVAL_MS)
  wss.on('close', () => clearInterval(heartbeatInterval))

  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/ws')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    }
  })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://localhost`)
    const roomId = url.searchParams.get('roomId')
    const name = url.searchParams.get('name')?.trim()
    const role = url.searchParams.get('role') as 'voter' | 'spectator' | null
    const token = url.searchParams.get('token') ?? nanoid(16)

    if (!roomId || !name || !role || !['voter', 'spectator'].includes(role)) {
      ws.close(1008, 'Missing required params')
      return
    }
    if (name.length > 64) {
      ws.close(1008, 'Name too long')
      return
    }

    const room = getRoom(roomId)
    if (!room) {
      ws.close(1008, 'Room not found')
      return
    }

    const reconnected = room.reconnectParticipant(token, ws)
    const participant = reconnected ?? room.addParticipant(name, role, ws, token)

    alive.add(ws)
    ws.on('pong', () => alive.add(ws))

    broadcastRoomStateAll(room)
    if (!reconnected) {
      broadcastExcept(room, ws, {
        type: 'participant_joined',
        id: participant.id,
        name: participant.name,
        role: participant.role,
      })
    }

    ws.on('message', (data) => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }

      switch (msg.type) {
        case 'vote': {
          if (participant.role !== 'voter' || room.phase !== 'voting') break
          room.castVote(participant.id, msg.card)
          broadcastAll(room, { type: 'vote_cast', participantId: participant.id })
          broadcastRoomStateAll(room)
          break
        }
        case 'reveal': {
          if (room.hostOnlyReveal && !participant.isHost) return
          room.reveal(participant.name)
          broadcastAll(room, {
            type: 'votes_revealed',
            votes: Object.fromEntries(room.votes),
          })
          broadcastRoomStateAll(room)
          break
        }
        case 'reset': {
          if ((room.hostOnlyReveal && !participant.isHost) || room.phase !== 'revealed') break
          room.reset(participant.name)
          broadcastAll(room, { type: 'round_reset' })
          broadcastRoomStateAll(room)
          break
        }
        case 'set_story': {
          if (!participant.isHost) return
          room.setStory(msg.title)
          broadcastRoomStateAll(room)
          break
        }
      }
    })

    ws.on('close', () => {
      alive.delete(ws)
    })
  })
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function broadcastAll(room: Room, msg: ServerMessage): void {
  for (const p of room.participants.values()) {
    send(p.ws, msg)
  }
}

function broadcastExcept(room: Room, exclude: WebSocket, msg: ServerMessage): void {
  for (const p of room.participants.values()) {
    if (p.ws !== exclude) send(p.ws, msg)
  }
}

function broadcastRoomStateAll(room: Room): void {
  for (const p of room.participants.values()) {
    send(p.ws, buildRoomState(room, p.id))
  }
}

function buildRoomState(room: Room, yourId: string): Extract<ServerMessage, { type: 'room_state' }> {
  return {
    type: 'room_state',
    phase: room.phase,
    deck: room.deck,
    customCards: room.customCards,
    currentStory: room.currentStory,
    participants: room.toParticipantSnapshots(),
    votes: room.phase === 'revealed' ? Object.fromEntries(room.votes) : undefined,
    history: room.history,
    hostOnlyReveal: room.hostOnlyReveal,
    eventLog: room.eventLog,
    yourId,
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ws/handler.ts
git commit -m "feat: use token-based reconnect in WS handler; keep participants on disconnect"
```

---

### Task 4: Update client to send token

**Files:**
- Modify: `src/app/room/[id]/RoomClient.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/join/[id]/JoinForm.tsx`

**Context:** The token must be created (or retrieved) before the room page opens and then sent on every WebSocket connection. `getOrCreateParticipantToken` is idempotent — safe to call multiple times.

In `RoomClient.tsx`, the token is read once at the start of the `useEffect` and captured in the closure so every `connect()` call (including reconnects) uses the same stable token.

In `page.tsx` and `JoinForm.tsx`, `getOrCreateParticipantToken` is called at join time so the token is ready in localStorage before the redirect to the room page.

- [ ] **Step 1: Update RoomClient.tsx**

In `src/app/room/[id]/RoomClient.tsx`:

1. Add import at the top:
```ts
import { getStoredIdentity, getOrCreateParticipantToken } from '@/lib/storedIdentity'
```

2. Inside the `useEffect`, after `const { name, role } = identity`, add:
```ts
const token = getOrCreateParticipantToken(roomId)
```

3. Update the WebSocket URL inside `connect()`:
```ts
const ws = new WebSocket(
  `${proto}://${window.location.host}/ws?roomId=${roomId}&name=${encodeURIComponent(name)}&role=${role}&token=${token}`
)
```

- [ ] **Step 2: Update page.tsx**

In `src/app/page.tsx`:

1. Add `getOrCreateParticipantToken` to the storedIdentity import:
```ts
import { setStoredIdentity, getOrCreateParticipantToken } from '@/lib/storedIdentity'
```

2. In `handleCreate`, after `setStoredIdentity(roomId, hostName.trim(), 'voter')`:
```ts
getOrCreateParticipantToken(roomId)
```

- [ ] **Step 3: Update JoinForm.tsx**

In `src/app/join/[id]/JoinForm.tsx`:

1. Add `getOrCreateParticipantToken` to the storedIdentity import:
```ts
import { getStoredIdentity, setStoredIdentity, clearStoredIdentity, getOrCreateParticipantToken } from '@/lib/storedIdentity'
```

2. In `handleJoin`, after `setStoredIdentity(roomId, name.trim(), role)`:
```ts
getOrCreateParticipantToken(roomId)
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Manual smoke test**

Start the dev server:
```bash
npm run dev
```

Test checklist:
1. Open http://localhost:8080, create a room — check DevTools → Application → Local Storage → `http://localhost:8080` — you should see `token-{roomId}` alongside `name-{roomId}` and `role-{roomId}`
2. Open the room in a second tab — both participants appear in the participant grid
3. Cast a vote in tab 1 — vote indicator appears (✓)
4. Open DevTools → Network → WS connection — close and reopen the connection manually (or wait for a reconnect) — the participant should stay in the grid and vote should persist
5. Click "Join as someone new" in the join flow — verify the token is cleared from localStorage and a new one is created after joining

- [ ] **Step 7: Commit**

```bash
git add src/app/room/[id]/RoomClient.tsx src/app/page.tsx "src/app/join/[id]/JoinForm.tsx"
git commit -m "feat: send participant token in WebSocket URL"
```
