# Scrumpokr Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time public SaaS scrum poker tool where teams create a room, share a link, and vote on story points — no accounts required.

**Architecture:** Single Docker container. A `server.ts` entry point creates a Node.js `http.Server`, attaches Next.js request handling for HTTP routes, and attaches a `ws` WebSocketServer to the same port. Room state is in-memory (no database); rooms expire after 24h of inactivity.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, `ws` library, Tailwind CSS, `nanoid`, Vitest, Docker.

---

## File Map

| File | Responsibility |
|---|---|
| `server.ts` | Entry point: creates http.Server, attaches Next.js + WebSocket + starts cleanup |
| `src/lib/types.ts` | All shared types: Card, DeckType, Participant, RoundResult, WS message shapes |
| `src/lib/decks.ts` | `getCards(deck, customCards?)` + `DECK_LABELS` constant |
| `src/lib/room.ts` | `Room` class: addParticipant, castVote, reveal, reset, setStory, toParticipantSnapshots |
| `src/lib/registry.ts` | Singleton `Map<roomId, Room>` + `createRoom()` + `getRoom()` + `startCleanup()` |
| `src/ws/handler.ts` | `attachWebSocket(server)`: handles upgrade, routes client messages, broadcasts |
| `src/app/api/rooms/route.ts` | `POST /api/rooms` → creates room, returns `{ roomId }` |
| `src/app/layout.tsx` | Root layout with Tailwind + Inter font |
| `src/app/page.tsx` | Landing page: name input, deck selector, Create Room button |
| `src/app/join/[id]/page.tsx` | Server component: extracts id, renders JoinForm |
| `src/app/join/[id]/JoinForm.tsx` | Client component: name input, voter/spectator toggle |
| `src/app/room/[id]/page.tsx` | Server component: extracts id, renders RoomClient |
| `src/app/room/[id]/RoomClient.tsx` | Client component: WS connection, full game UI |
| `src/components/CardPicker.tsx` | Card grid with selection highlight |
| `src/components/ParticipantGrid.tsx` | Participant cards (face-down / revealed / spectator) |
| `src/components/ResultsSummary.tsx` | Avg / min / max / consensus display |
| `src/components/VotingHistory.tsx` | Completed rounds list |
| `src/__tests__/decks.test.ts` | Unit tests for getCards |
| `src/__tests__/room.test.ts` | Unit tests for Room class |
| `src/__tests__/registry.test.ts` | Unit tests for registry + cleanup |
| `Dockerfile` | Multi-stage build; runs `tsx server.ts` in production |
| `docker-compose.yml` | Single service on port 3000 |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (via create-next-app + manual edits)
- Create: `vitest.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Scaffold Next.js app**

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack \
  --yes
```

Expected: project files created, `npm install` run automatically.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install ws nanoid
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install --save-dev @types/ws vitest @vitejs/plugin-react tsx
```

- [ ] **Step 4: Update `package.json` scripts**

Open `package.json` and replace the `scripts` section with:

```json
"scripts": {
  "dev": "tsx watch server.ts",
  "build": "next build",
  "start": "tsx server.ts",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 6: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'scrumpokr',
  description: 'Real-time planning poker for agile teams',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 7: Verify Next.js starts**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Vitest and tsx"
```

---

## Task 2: Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create `src/lib/types.ts`**

```ts
import type { WebSocket } from 'ws'

export type DeckType = 'fibonacci' | 'powers-of-2' | 'tshirt' | 'custom'
export type Card = string | number

export interface Participant {
  id: string
  name: string
  role: 'voter' | 'spectator'
  isHost: boolean
  ws: WebSocket
}

export interface ParticipantSnapshot {
  id: string
  name: string
  role: 'voter' | 'spectator'
  isHost: boolean
  hasVoted: boolean
}

export interface RoundResult {
  story?: string
  votes: Record<string, Card>
  consensus?: Card
  timestamp: number
}

export type ClientMessage =
  | { type: 'vote'; card: Card }
  | { type: 'reveal' }
  | { type: 'reset' }
  | { type: 'set_story'; title: string }

export type ServerMessage =
  | {
      type: 'room_state'
      phase: 'voting' | 'revealed'
      deck: DeckType
      customCards?: Card[]
      currentStory?: string
      participants: ParticipantSnapshot[]
      votes?: Record<string, Card>
      history: RoundResult[]
      yourId: string
    }
  | { type: 'participant_joined'; id: string; name: string; role: 'voter' | 'spectator' }
  | { type: 'participant_left'; id: string }
  | { type: 'vote_cast'; participantId: string }
  | { type: 'votes_revealed'; votes: Record<string, Card> }
  | { type: 'round_reset' }
```

- [ ] **Step 2: Verify TypeScript accepts the file**

```bash
npx tsc --noEmit
```

Expected: no errors (or only unrelated pre-existing errors from scaffolding).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared types"
```

---

## Task 3: Decks

**Files:**
- Create: `src/lib/decks.ts`
- Create: `src/__tests__/decks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/decks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getCards } from '../lib/decks'

describe('getCards', () => {
  it('returns fibonacci cards', () => {
    expect(getCards('fibonacci')).toEqual([1, 2, 3, 5, 8, 13, 21, '?', '☕'])
  })

  it('returns powers-of-2 cards', () => {
    expect(getCards('powers-of-2')).toEqual([1, 2, 4, 8, 16, 32, '?'])
  })

  it('returns tshirt cards', () => {
    expect(getCards('tshirt')).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
  })

  it('returns custom cards when provided', () => {
    expect(getCards('custom', [1, 2, 4])).toEqual([1, 2, 4])
  })

  it('throws when custom deck has no cards', () => {
    expect(() => getCards('custom')).toThrow('Custom deck requires customCards')
    expect(() => getCards('custom', [])).toThrow('Custom deck requires customCards')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- src/__tests__/decks.test.ts
```

Expected: FAIL — `Cannot find module '../lib/decks'`

- [ ] **Step 3: Implement `src/lib/decks.ts`**

```ts
import type { Card, DeckType } from './types'

const DECK_VALUES: Record<Exclude<DeckType, 'custom'>, Card[]> = {
  fibonacci: [1, 2, 3, 5, 8, 13, 21, '?', '☕'],
  'powers-of-2': [1, 2, 4, 8, 16, 32, '?'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
}

export function getCards(deck: DeckType, customCards?: Card[]): Card[] {
  if (deck === 'custom') {
    if (!customCards || customCards.length === 0) {
      throw new Error('Custom deck requires customCards')
    }
    return customCards
  }
  return DECK_VALUES[deck]
}

export const DECK_LABELS: Record<DeckType, string> = {
  fibonacci: 'Fibonacci',
  'powers-of-2': 'Powers of 2',
  tshirt: 'T-Shirt Sizes',
  custom: 'Custom',
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- src/__tests__/decks.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/decks.ts src/__tests__/decks.test.ts
git commit -m "feat: add deck values and getCards"
```

---

## Task 4: Room Class

**Files:**
- Create: `src/lib/room.ts`
- Create: `src/__tests__/room.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/room.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Room } from '../lib/room'
import type { WebSocket } from 'ws'

const mockWs = () => ({}) as WebSocket

describe('Room', () => {
  it('creates a room with a generated id and voting phase', () => {
    const room = new Room('fibonacci')
    expect(room.id).toBeTruthy()
    expect(room.deck).toBe('fibonacci')
    expect(room.phase).toBe('voting')
    expect(room.history).toEqual([])
  })

  describe('addParticipant', () => {
    it('first voter becomes host', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs())
      expect(p.isHost).toBe(true)
    })

    it('second voter is not host', () => {
      const room = new Room('fibonacci')
      room.addParticipant('Alice', 'voter', mockWs())
      const p2 = room.addParticipant('Bob', 'voter', mockWs())
      expect(p2.isHost).toBe(false)
    })

    it('spectator is never host even when first to join', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Dave', 'spectator', mockWs())
      expect(p.isHost).toBe(false)
    })

    it('voter becomes host when spectator joined first', () => {
      const room = new Room('fibonacci')
      room.addParticipant('Dave', 'spectator', mockWs())
      const voter = room.addParticipant('Alice', 'voter', mockWs())
      expect(voter.isHost).toBe(true)
    })

    it('stores participant in participants map', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs())
      expect(room.participants.get(p.id)).toBe(p)
    })
  })

  describe('removeParticipant', () => {
    it('removes participant and their vote', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs())
      room.castVote(p.id, 5)
      room.removeParticipant(p.id)
      expect(room.participants.has(p.id)).toBe(false)
      expect(room.votes.has(p.id)).toBe(false)
    })

    it('promotes next voter when host leaves', () => {
      const room = new Room('fibonacci')
      const host = room.addParticipant('Alice', 'voter', mockWs())
      const bob = room.addParticipant('Bob', 'voter', mockWs())
      room.removeParticipant(host.id)
      expect(bob.isHost).toBe(true)
    })

    it('does not crash when last participant leaves', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs())
      expect(() => room.removeParticipant(p.id)).not.toThrow()
    })
  })

  describe('castVote', () => {
    it('records vote for voter in voting phase', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs())
      room.castVote(p.id, 5)
      expect(room.votes.get(p.id)).toBe(5)
    })

    it('ignores vote from spectator', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Dave', 'spectator', mockWs())
      room.castVote(p.id, 5)
      expect(room.votes.has(p.id)).toBe(false)
    })

    it('ignores vote when phase is revealed', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs())
      room.reveal()
      room.castVote(p.id, 5)
      expect(room.votes.has(p.id)).toBe(false)
    })

    it('allows changing vote during voting phase', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs())
      room.castVote(p.id, 3)
      room.castVote(p.id, 5)
      expect(room.votes.get(p.id)).toBe(5)
    })
  })

  describe('reveal', () => {
    it('sets phase to revealed', () => {
      const room = new Room('fibonacci')
      room.reveal()
      expect(room.phase).toBe('revealed')
    })
  })

  describe('reset', () => {
    it('saves round to history with votes and resets state', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs())
      room.setStory('Story 1')
      room.castVote(p.id, 5)
      room.reveal()
      room.reset()
      expect(room.history).toHaveLength(1)
      expect(room.history[0].story).toBe('Story 1')
      expect(room.history[0].votes[p.id]).toBe(5)
      expect(room.votes.size).toBe(0)
      expect(room.phase).toBe('voting')
      expect(room.currentStory).toBeUndefined()
    })

    it('sets consensus when all voters vote the same', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs())
      const p2 = room.addParticipant('Bob', 'voter', mockWs())
      room.castVote(p1.id, 5)
      room.castVote(p2.id, 5)
      room.reveal()
      room.reset()
      expect(room.history[0].consensus).toBe(5)
    })

    it('consensus is undefined when voters disagree', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs())
      const p2 = room.addParticipant('Bob', 'voter', mockWs())
      room.castVote(p1.id, 3)
      room.castVote(p2.id, 5)
      room.reveal()
      room.reset()
      expect(room.history[0].consensus).toBeUndefined()
    })

    it('consensus is undefined when not all voters voted', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs())
      room.addParticipant('Bob', 'voter', mockWs())
      room.castVote(p1.id, 5)
      room.reveal()
      room.reset()
      expect(room.history[0].consensus).toBeUndefined()
    })
  })

  describe('toParticipantSnapshots', () => {
    it('marks hasVoted true for voters who voted', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs())
      room.castVote(p.id, 5)
      const snapshots = room.toParticipantSnapshots()
      expect(snapshots.find(s => s.id === p.id)?.hasVoted).toBe(true)
    })

    it('marks hasVoted false for voters who did not vote', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs())
      const snapshots = room.toParticipantSnapshots()
      expect(snapshots.find(s => s.id === p.id)?.hasVoted).toBe(false)
    })

    it('marks hasVoted false for spectators', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Dave', 'spectator', mockWs())
      const snapshots = room.toParticipantSnapshots()
      expect(snapshots.find(s => s.id === p.id)?.hasVoted).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- src/__tests__/room.test.ts
```

Expected: FAIL — `Cannot find module '../lib/room'`

- [ ] **Step 3: Implement `src/lib/room.ts`**

```ts
import { nanoid } from 'nanoid'
import type { WebSocket } from 'ws'
import type { Card, DeckType, Participant, ParticipantSnapshot, RoundResult } from './types'

export class Room {
  readonly id: string
  readonly deck: DeckType
  readonly customCards?: Card[]
  phase: 'voting' | 'revealed' = 'voting'
  currentStory?: string
  votes = new Map<string, Card>()
  participants = new Map<string, Participant>()
  history: RoundResult[] = []
  readonly createdAt: number
  lastActivityAt: number

  constructor(deck: DeckType, customCards?: Card[]) {
    this.id = nanoid(8)
    this.deck = deck
    this.customCards = customCards
    this.createdAt = Date.now()
    this.lastActivityAt = Date.now()
  }

  addParticipant(name: string, role: 'voter' | 'spectator', ws: WebSocket): Participant {
    const participant: Participant = {
      id: nanoid(8),
      name,
      role,
      isHost: role === 'voter' && !this.hasHost(),
      ws,
    }
    this.participants.set(participant.id, participant)
    this.lastActivityAt = Date.now()
    return participant
  }

  removeParticipant(id: string): void {
    const p = this.participants.get(id)
    this.participants.delete(id)
    this.votes.delete(id)
    this.lastActivityAt = Date.now()
    if (p?.isHost) this.promoteNextHost()
  }

  castVote(participantId: string, card: Card): void {
    const p = this.participants.get(participantId)
    if (!p || p.role !== 'voter' || this.phase !== 'voting') return
    this.votes.set(participantId, card)
    this.lastActivityAt = Date.now()
  }

  reveal(): void {
    this.phase = 'revealed'
    this.lastActivityAt = Date.now()
  }

  reset(): void {
    const votesObj: Record<string, Card> = Object.fromEntries(this.votes)
    this.history.push({
      story: this.currentStory,
      votes: votesObj,
      consensus: this.computeConsensus(),
      timestamp: Date.now(),
    })
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

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- src/__tests__/room.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/room.ts src/__tests__/room.test.ts
git commit -m "feat: add Room class with full lifecycle"
```

---

## Task 5: Registry

**Files:**
- Create: `src/lib/registry.ts`
- Create: `src/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/registry.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRoom, getRoom, deleteRoom, startCleanup } from '../lib/registry'

afterEach(() => {
  vi.useRealTimers()
})

describe('registry', () => {
  it('creates a room and retrieves it by id', () => {
    const room = createRoom('fibonacci')
    expect(getRoom(room.id)).toBe(room)
    deleteRoom(room.id)
  })

  it('returns undefined for unknown room id', () => {
    expect(getRoom('no-such-room')).toBeUndefined()
  })

  it('deleteRoom removes the room', () => {
    const room = createRoom('fibonacci')
    deleteRoom(room.id)
    expect(getRoom(room.id)).toBeUndefined()
  })

  it('startCleanup removes rooms idle longer than 24h', () => {
    vi.useFakeTimers()
    const room = createRoom('fibonacci')
    room.lastActivityAt = Date.now() - 25 * 60 * 60 * 1000
    const interval = startCleanup()
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(getRoom(room.id)).toBeUndefined()
    clearInterval(interval)
  })

  it('startCleanup keeps rooms active within 24h', () => {
    vi.useFakeTimers()
    const room = createRoom('fibonacci')
    const interval = startCleanup()
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(getRoom(room.id)).toBe(room)
    clearInterval(interval)
    deleteRoom(room.id)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- src/__tests__/registry.test.ts
```

Expected: FAIL — `Cannot find module '../lib/registry'`

- [ ] **Step 3: Implement `src/lib/registry.ts`**

```ts
import { Room } from './room'
import type { Card, DeckType } from './types'

const rooms = new Map<string, Room>()

const ROOM_TTL_MS = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

export function createRoom(deck: DeckType, customCards?: Card[]): Room {
  const room = new Room(deck, customCards)
  rooms.set(room.id, room)
  return room
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id)
}

export function deleteRoom(id: string): void {
  rooms.delete(id)
}

export function startCleanup(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const now = Date.now()
    for (const [id, room] of rooms) {
      if (now - room.lastActivityAt > ROOM_TTL_MS) {
        rooms.delete(id)
      }
    }
  }, CLEANUP_INTERVAL_MS)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- src/__tests__/registry.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests (decks + room + registry) pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/registry.ts src/__tests__/registry.test.ts
git commit -m "feat: add room registry with 24h cleanup"
```

---

## Task 6: API Route

**Files:**
- Create: `src/app/api/rooms/route.ts`

- [ ] **Step 1: Create `src/app/api/rooms/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createRoom } from '@/lib/registry'
import type { Card, DeckType } from '@/lib/types'

const VALID_DECKS: DeckType[] = ['fibonacci', 'powers-of-2', 'tshirt', 'custom']

export async function POST(req: NextRequest) {
  const body = await req.json()
  const deck = body.deck as DeckType
  const customCards = body.customCards as Card[] | undefined

  if (!VALID_DECKS.includes(deck)) {
    return NextResponse.json({ error: 'Invalid deck' }, { status: 400 })
  }
  if (deck === 'custom' && (!customCards || customCards.length === 0)) {
    return NextResponse.json({ error: 'Custom deck requires customCards' }, { status: 400 })
  }

  const room = createRoom(deck, customCards)
  return NextResponse.json({ roomId: room.id })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/rooms/route.ts
git commit -m "feat: add POST /api/rooms route"
```

---

## Task 7: WebSocket Handler

**Files:**
- Create: `src/ws/handler.ts`

- [ ] **Step 1: Create `src/ws/handler.ts`**

```ts
import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { IncomingMessage } from 'http'
import { getRoom } from '@/lib/registry'
import type { ClientMessage, ServerMessage, ParticipantSnapshot, RoundResult, Card, DeckType } from '@/lib/types'
import type { Room } from '@/lib/room'

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://localhost`)
    const roomId = url.searchParams.get('roomId')
    const name = url.searchParams.get('name')?.trim()
    const role = url.searchParams.get('role') as 'voter' | 'spectator' | null

    if (!roomId || !name || !role || !['voter', 'spectator'].includes(role)) {
      ws.close(1008, 'Missing required params')
      return
    }

    const room = getRoom(roomId)
    if (!room) {
      ws.close(1008, 'Room not found')
      return
    }

    const participant = room.addParticipant(name, role, ws)

    sendRoomState(ws, room, participant.id)
    broadcastExcept(room, ws, {
      type: 'participant_joined',
      id: participant.id,
      name: participant.name,
      role: participant.role,
    })

    ws.on('message', (data) => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }

      switch (msg.type) {
        case 'vote': {
          room.castVote(participant.id, msg.card)
          broadcastAll(room, { type: 'vote_cast', participantId: participant.id })
          broadcastRoomStateAll(room)
          break
        }
        case 'reveal': {
          if (!participant.isHost) return
          room.reveal()
          broadcastAll(room, {
            type: 'votes_revealed',
            votes: Object.fromEntries(room.votes),
          })
          broadcastRoomStateAll(room)
          break
        }
        case 'reset': {
          if (!participant.isHost) return
          room.reset()
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
      room.removeParticipant(participant.id)
      broadcastAll(room, { type: 'participant_left', id: participant.id })
      broadcastRoomStateAll(room)
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

function sendRoomState(ws: WebSocket, room: Room, yourId: string): void {
  send(ws, buildRoomState(room, yourId))
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
    yourId,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ws/handler.ts
git commit -m "feat: add WebSocket handler with message routing"
```

---

## Task 8: Custom Server Entry Point

**Files:**
- Create: `server.ts`

- [ ] **Step 1: Create `server.ts`**

```ts
import { createServer } from 'http'
import next from 'next'
import { attachWebSocket } from './src/ws/handler'
import { startCleanup } from './src/lib/registry'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res))

  attachWebSocket(server)
  startCleanup()

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
```

- [ ] **Step 2: Verify dev server starts**

```bash
npm run dev
```

Expected: output `> Ready on http://localhost:3000`. Visit `http://localhost:3000` — Next.js default page loads. Press Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat: add custom server with Next.js + WebSocket on same port"
```

---

## Task 9: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DeckType, Card } from '@/lib/types'
import { DECK_LABELS } from '@/lib/decks'

const DECKS: DeckType[] = ['fibonacci', 'powers-of-2', 'tshirt', 'custom']

export default function HomePage() {
  const router = useRouter()
  const [deck, setDeck] = useState<DeckType>('fibonacci')
  const [customCards, setCustomCards] = useState('')
  const [hostName, setHostName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!hostName.trim()) return
    if (deck === 'custom' && !customCards.trim()) {
      setError('Enter at least one card value.')
      return
    }
    setError('')
    setCreating(true)

    const parsedCustom: Card[] | undefined =
      deck === 'custom'
        ? customCards.split(',').map(s => s.trim()).filter(Boolean)
        : undefined

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck, customCards: parsedCustom }),
      })
      const { roomId } = await res.json()
      sessionStorage.setItem(`name-${roomId}`, hostName.trim())
      sessionStorage.setItem(`role-${roomId}`, 'voter')
      router.push(`/room/${roomId}`)
    } catch {
      setError('Failed to create room. Try again.')
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-2xl shadow-xl border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-1">scrumpokr</h1>
        <p className="text-gray-400 mb-8">Real-time planning poker for agile teams.</p>

        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your name</label>
            <input
              type="text"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              placeholder="e.g. Alice"
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Card deck</label>
            <div className="grid grid-cols-2 gap-2">
              {DECKS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDeck(d)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    deck === d
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {DECK_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {deck === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Card values <span className="text-gray-500">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={customCards}
                onChange={e => setCustomCards(e.target.value)}
                placeholder="e.g. 1, 2, 4, 8, 16"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={creating || !hostName.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {creating ? 'Creating…' : 'Create Room'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Start dev server and verify the landing page renders**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify: name input, 4 deck buttons (Fibonacci selected), Create Room button. Select Custom — verify a text input appears. Press Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add landing page with deck selector"
```

---

## Task 10: Join Page

**Files:**
- Create: `src/app/join/[id]/page.tsx`
- Create: `src/app/join/[id]/JoinForm.tsx`

- [ ] **Step 1: Create `src/app/join/[id]/page.tsx`**

```tsx
import { JoinForm } from './JoinForm'

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JoinForm roomId={id} />
}
```

- [ ] **Step 2: Create `src/app/join/[id]/JoinForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  roomId: string
}

export function JoinForm({ roomId }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [role, setRole] = useState<'voter' | 'spectator'>('voter')

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    sessionStorage.setItem(`name-${roomId}`, name.trim())
    sessionStorage.setItem(`role-${roomId}`, role)
    router.push(`/room/${roomId}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm p-8 bg-gray-900 rounded-2xl shadow-xl border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-1">Join Room</h1>
        <p className="text-gray-400 mb-6">You've been invited to a planning poker session.</p>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Bob"
              required
              autoFocus
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Join as</label>
            <div className="flex gap-2">
              {(['voter', 'spectator'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    role === r
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {r === 'voter' ? '🗳 Voter' : '👁 Spectator'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            Join Room
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/join/
git commit -m "feat: add join page with name and role selection"
```

---

## Task 11: UI Components

**Files:**
- Create: `src/components/CardPicker.tsx`
- Create: `src/components/ParticipantGrid.tsx`
- Create: `src/components/ResultsSummary.tsx`
- Create: `src/components/VotingHistory.tsx`

- [ ] **Step 1: Create `src/components/CardPicker.tsx`**

```tsx
import type { Card } from '@/lib/types'

interface Props {
  cards: Card[]
  selected?: Card
  disabled?: boolean
  onSelect: (card: Card) => void
}

export function CardPicker({ cards, selected, disabled, onSelect }: Props) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Your Vote</p>
      <div className="flex flex-wrap gap-2">
        {cards.map(card => (
          <button
            key={String(card)}
            onClick={() => !disabled && onSelect(card)}
            disabled={disabled}
            className={`w-12 h-16 rounded-lg text-sm font-bold border-2 transition-all ${
              selected !== undefined && String(selected) === String(card)
                ? 'bg-indigo-600 border-indigo-400 text-white scale-105 shadow-lg shadow-indigo-900'
                : disabled
                ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-800 border-gray-700 text-gray-200 hover:border-indigo-500 hover:scale-105 cursor-pointer'
            }`}
          >
            {String(card)}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/ParticipantGrid.tsx`**

```tsx
import type { Card, ParticipantSnapshot } from '@/lib/types'

interface Props {
  participants: ParticipantSnapshot[]
  votes?: Record<string, Card>
  phase: 'voting' | 'revealed'
}

export function ParticipantGrid({ participants, votes, phase }: Props) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Participants ({participants.length})
      </p>
      <div className="flex flex-wrap gap-4">
        {participants.map(p => (
          <div key={p.id} className="flex flex-col items-center gap-1.5">
            <CardFace p={p} phase={phase} votes={votes} />
            <span className="text-xs text-gray-400 max-w-[52px] truncate text-center leading-tight">
              {p.name}{p.isHost ? ' ★' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CardFace({
  p,
  phase,
  votes,
}: {
  p: ParticipantSnapshot
  phase: 'voting' | 'revealed'
  votes?: Record<string, Card>
}) {
  if (p.role === 'spectator') {
    return (
      <div className="w-12 h-16 rounded-lg bg-gray-800 border border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-lg">
        👁
      </div>
    )
  }

  if (phase === 'revealed' && votes) {
    const card = votes[p.id]
    return (
      <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center font-bold text-base ${
        card !== undefined
          ? 'bg-green-800 border-green-500 text-white'
          : 'bg-gray-800 border-gray-600 text-gray-500'
      }`}>
        {card !== undefined ? String(card) : '—'}
      </div>
    )
  }

  return (
    <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-lg ${
      p.hasVoted
        ? 'bg-green-900 border-green-600 text-green-300'
        : 'bg-gray-800 border-dashed border-gray-600 text-gray-600'
    }`}>
      {p.hasVoted ? '✓' : '…'}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/ResultsSummary.tsx`**

```tsx
import type { Card, ParticipantSnapshot } from '@/lib/types'

interface Props {
  votes: Record<string, Card>
  participants: ParticipantSnapshot[]
}

export function ResultsSummary({ votes, participants }: Props) {
  const voterIds = participants.filter(p => p.role === 'voter').map(p => p.id)
  const numeric = voterIds
    .map(id => votes[id])
    .filter((c): c is number => typeof c === 'number')

  const avg = numeric.length > 0
    ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1)
    : '—'
  const min = numeric.length > 0 ? Math.min(...numeric) : '—'
  const max = numeric.length > 0 ? Math.max(...numeric) : '—'

  const allCards = voterIds.map(id => votes[id]).filter(c => c !== undefined)
  const consensus =
    allCards.length === voterIds.length && voterIds.length > 0 && new Set(allCards.map(String)).size === 1
      ? allCards[0]
      : undefined

  return (
    <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-6 text-sm flex-wrap">
      <span className="text-gray-400">Avg: <strong className="text-white">{avg}</strong></span>
      <span className="text-gray-400">Min: <strong className="text-white">{String(min)}</strong></span>
      <span className="text-gray-400">Max: <strong className="text-white">{String(max)}</strong></span>
      {consensus !== undefined && (
        <span className="text-green-400 font-semibold ml-auto">
          ✓ Consensus: {String(consensus)}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/VotingHistory.tsx`**

```tsx
import type { RoundResult } from '@/lib/types'

interface Props {
  history: RoundResult[]
  participantNames: Record<string, string>
}

export function VotingHistory({ history, participantNames }: Props) {
  if (history.length === 0) return null

  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        History ({history.length} {history.length === 1 ? 'round' : 'rounds'})
      </p>
      <div className="space-y-2">
        {[...history].reverse().map((round, i) => (
          <div
            key={i}
            className="bg-gray-800 rounded-lg px-4 py-2.5 flex items-start justify-between gap-4 text-sm"
          >
            <span className="text-gray-300 truncate">
              {round.story ?? <em className="text-gray-500">Untitled</em>}
            </span>
            <span className="shrink-0 text-right">
              {round.consensus !== undefined ? (
                <span className="text-green-400 font-semibold">→ {String(round.consensus)}</span>
              ) : (
                <span className="text-gray-500 text-xs">
                  {Object.entries(round.votes)
                    .map(([id, card]) => `${participantNames[id] ?? 'Unknown'}: ${String(card)}`)
                    .join(', ')}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add CardPicker, ParticipantGrid, ResultsSummary, VotingHistory components"
```

---

## Task 12: Room Page

**Files:**
- Create: `src/app/room/[id]/page.tsx`
- Create: `src/app/room/[id]/RoomClient.tsx`

- [ ] **Step 1: Create `src/app/room/[id]/page.tsx`**

```tsx
import { RoomClient } from './RoomClient'

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RoomClient roomId={id} />
}
```

- [ ] **Step 2: Create `src/app/room/[id]/RoomClient.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ServerMessage, Card, DeckType, ParticipantSnapshot, RoundResult } from '@/lib/types'
import { getCards } from '@/lib/decks'
import { CardPicker } from '@/components/CardPicker'
import { ParticipantGrid } from '@/components/ParticipantGrid'
import { ResultsSummary } from '@/components/ResultsSummary'
import { VotingHistory } from '@/components/VotingHistory'

interface RoomState {
  phase: 'voting' | 'revealed'
  deck: DeckType
  customCards?: Card[]
  currentStory?: string
  participants: ParticipantSnapshot[]
  votes?: Record<string, Card>
  history: RoundResult[]
  yourId: string
}

export function RoomClient({ roomId }: { roomId: string }) {
  const router = useRouter()
  const wsRef = useRef<WebSocket | null>(null)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [myVote, setMyVote] = useState<Card | undefined>()
  const [story, setStory] = useState('')
  const [editingStory, setEditingStory] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const name = sessionStorage.getItem(`name-${roomId}`)
    const role = sessionStorage.getItem(`role-${roomId}`) as 'voter' | 'spectator' | null
    if (!name || !role) {
      router.replace(`/join/${roomId}`)
      return
    }

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(
      `${proto}://${window.location.host}/ws?roomId=${roomId}&name=${encodeURIComponent(name)}&role=${role}`
    )
    wsRef.current = ws

    ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string) as ServerMessage
      if (msg.type === 'room_state') {
        setRoomState(msg)
        setStory(msg.currentStory ?? '')
        if (msg.phase === 'voting') {
          // Votes are hidden during voting — preserve local myVote
        } else if (msg.votes) {
          setMyVote(msg.votes[msg.yourId])
        }
      }
    }

    ws.onclose = (e) => {
      if (e.code === 1008 && e.reason === 'Room not found') {
        router.replace('/')
      }
    }

    return () => ws.close()
  }, [roomId, router])

  function sendMsg(msg: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }

  function handleVote(card: Card) {
    setMyVote(card)
    sendMsg({ type: 'vote', card })
  }

  function handleReveal() {
    sendMsg({ type: 'reveal' })
  }

  function handleReset() {
    setMyVote(undefined)
    sendMsg({ type: 'reset' })
  }

  function handleSetStory() {
    sendMsg({ type: 'set_story', title: story })
    setEditingStory(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!roomState) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Connecting…</p>
      </div>
    )
  }

  const me = roomState.participants.find(p => p.id === roomState.yourId)
  const isHost = me?.isHost ?? false
  const isSpectator = me?.role === 'spectator'
  const cards = getCards(roomState.deck, roomState.customCards)
  const participantNames = Object.fromEntries(roomState.participants.map(p => [p.id, p.name]))

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <a href="/" className="font-bold text-lg hover:text-indigo-400 transition-colors">
          scrumpokr
        </a>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-400">
            Room: <span className="text-white font-mono">{roomId}</span>
          </span>
          <button
            onClick={copyLink}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 text-gray-300 transition-colors text-xs"
          >
            {copied ? '✓ Copied!' : '📋 Copy invite link'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {/* Current story */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Current Story
          </p>
          {editingStory && isHost ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={story}
                onChange={e => setStory(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetStory()}
                placeholder="e.g. As a user, I can reset my password"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSetStory}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { setEditingStory(false); setStory(roomState.currentStory ?? '') }}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className={`text-sm ${roomState.currentStory ? 'text-white' : 'text-gray-500 italic'}`}>
                {roomState.currentStory ?? 'No story set'}
              </p>
              {isHost && (
                <button
                  onClick={() => setEditingStory(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0 transition-colors"
                >
                  {roomState.currentStory ? 'Edit' : '+ Set story'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <ParticipantGrid
            participants={roomState.participants}
            votes={roomState.votes}
            phase={roomState.phase}
          />
        </div>

        {/* Results summary */}
        {roomState.phase === 'revealed' && roomState.votes && (
          <ResultsSummary votes={roomState.votes} participants={roomState.participants} />
        )}

        {/* Card picker (voters only) */}
        {!isSpectator && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <CardPicker
              cards={cards}
              selected={myVote}
              disabled={roomState.phase === 'revealed'}
              onSelect={handleVote}
            />
          </div>
        )}

        {/* Host controls */}
        {isHost && (
          <div>
            {roomState.phase === 'voting' ? (
              <button
                onClick={handleReveal}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
              >
                Reveal Cards
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
              >
                Next Round
              </button>
            )}
          </div>
        )}

        {/* Voting history */}
        {roomState.history.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <VotingHistory history={roomState.history} participantNames={participantNames} />
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Start dev server and do a full end-to-end smoke test**

```bash
npm run dev
```

1. Open `http://localhost:3000` — enter a name, pick Fibonacci, click "Create Room"
2. Verify you land on `/room/[id]` with the participant grid showing your name with a star (★)
3. Open the same URL in a second browser tab, go through `/join/[id]`, enter a different name as a voter
4. Verify both tabs show both participants
5. Vote on both tabs — verify the ✓ indicator appears on the other tab
6. Click "Reveal Cards" — verify both cards flip and stats appear
7. Click "Next Round" — verify phase resets and history entry appears
8. Press Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/app/room/
git commit -m "feat: add room page with full poker game UI"
```

---

## Task 13: Docker

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.next
.git
docs
*.md
.superpowers
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
```

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
```

- [ ] **Step 4: Build and run the Docker container**

```bash
docker compose up --build
```

Expected: container builds and starts, output shows `> Ready on http://localhost:3000`.

- [ ] **Step 5: Smoke test the Docker container**

Open `http://localhost:3000` in a browser. Create a room, join with two tabs, cast votes, reveal. Verify the full flow works inside Docker.

- [ ] **Step 6: Stop the container**

```bash
docker compose down
```

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "feat: add Dockerfile and docker-compose"
```

---

## Self-Review Checklist

The following spec requirements are covered:

| Requirement | Task |
|---|---|
| Public SaaS, no accounts | Task 9 (landing), Task 10 (join) — sessionStorage name flow |
| Fibonacci / Powers of 2 / T-shirt / Custom decks | Task 3 (decks.ts), Task 9 (deck selector) |
| No-account join by name + link | Task 10 (JoinForm), Task 7 (WS upgrade params) |
| Voting history | Task 4 (Room.reset saves history), Task 11 (VotingHistory component) |
| Spectator mode | Task 4 (Room.addParticipant role), Task 7 (spectator cannot vote), Task 11 (ParticipantGrid eye icon) |
| Votes hidden during voting phase | Task 7 (handler omits votes in room_state), Task 4 (castVote checks phase) |
| Reveal cards | Task 7 (reveal message), Task 12 (Reveal Cards button) |
| Host-only reveal/reset/set_story | Task 7 (participant.isHost guard) |
| Host promotion on disconnect | Task 4 (Room.promoteNextHost) |
| Room expiry after 24h inactivity | Task 5 (registry.ts cleanup interval) |
| Stats (avg, min, max, consensus) | Task 11 (ResultsSummary component) |
| Docker container | Task 13 |
