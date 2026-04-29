# Horizontal Scaling via Redis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move room state out of process memory into a swappable store (Redis or in-memory) so multiple server instances can coordinate via pub/sub, enabling horizontal scaling on GCP Cloud Run.

**Architecture:** A `RoomStoreAdapter` interface (read/write/publish/subscribe) is implemented by `InMemoryAdapter` (EventEmitter-based, default) and `RedisAdapter` (ioredis-based, activated via env var). Pure functions in `roomFns.ts` replace the `Room` class. `handler.ts` uses the adapter + a per-instance connection map (`Map<roomId, Map<participantId, WebSocket>>`); every mutation writes state to the adapter and publishes it, triggering `broadcastToLocalClients` on all subscribed instances.

**Tech Stack:** Node.js, TypeScript, ws, ioredis, Next.js 16 App Router, Vitest 4

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types.ts` | Modify | Add `StoredParticipant` type |
| `src/lib/store/adapter.ts` | Create | `StoredRoomState` type + `RoomStoreAdapter` interface |
| `src/lib/store/memory.ts` | Create | `InMemoryAdapter` — Map + EventEmitter |
| `src/lib/store/index.ts` | Create | `getAdapter()` singleton, env-var selection |
| `src/lib/roomFns.ts` | Create | Pure stateless room mutation functions |
| `src/__tests__/roomFns.test.ts` | Create | Tests for pure room functions |
| `src/__tests__/store/memory.test.ts` | Create | Tests for InMemoryAdapter |
| `src/app/api/rooms/route.ts` | Modify | Use `getAdapter()` instead of registry |
| `src/ws/handler.ts` | Modify | Use adapter + per-instance connection map |
| `server.ts` | Modify | Use `getAdapter().startCleanup()` |
| `src/lib/room.ts` | Delete | Replaced by `roomFns.ts` |
| `src/lib/registry.ts` | Delete | Replaced by adapter |
| `src/__tests__/room.test.ts` | Delete | Replaced by `roomFns.test.ts` |
| `src/__tests__/registry.test.ts` | Delete | Replaced by `store/memory.test.ts` |
| `src/lib/store/redis.ts` | Create | `RedisAdapter` — ioredis commands + subscriber |
| `docker-compose.yml` | Modify | Add Redis service + env vars for app |

---

## Task 1: Add `StoredParticipant` type + adapter interface

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/store/adapter.ts`

- [ ] **Step 1: Add `StoredParticipant` to `src/lib/types.ts`**

Add after the `Participant` interface (after line 13):

```ts
export interface StoredParticipant {
  id: string
  name: string
  role: 'voter' | 'spectator'
  isHost: boolean
  token: string
}
```

- [ ] **Step 2: Create `src/lib/store/adapter.ts`**

```ts
import type { Card, DeckType, RoundResult, EventLogEntry, StoredParticipant } from '@/lib/types'

export interface StoredRoomState {
  id: string
  deck: DeckType
  customCards?: Card[]
  hostOnlyReveal: boolean
  phase: 'voting' | 'revealed'
  currentStory?: string
  selectedVerdict?: Card | 'NO_CONSENSUS'
  votes: Record<string, Card>
  participants: StoredParticipant[]
  tokens: Record<string, string>
  history: RoundResult[]
  eventLog: EventLogEntry[]
  createdAt: number
  lastActivityAt: number
}

export interface RoomStoreAdapter {
  readRoom(id: string): Promise<StoredRoomState | null>
  writeRoom(id: string, state: StoredRoomState): Promise<void>
  deleteRoom(id: string): Promise<void>
  publish(roomId: string, state: StoredRoomState): Promise<void>
  subscribe(roomId: string, cb: (state: StoredRoomState) => void): () => void
  startCleanup(): void
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all existing tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/store/adapter.ts
git commit -m "feat: add StoredParticipant type and RoomStoreAdapter interface"
```

---

## Task 2: Pure room functions (TDD)

**Files:**
- Create: `src/lib/roomFns.ts`
- Create: `src/__tests__/roomFns.test.ts`

- [ ] **Step 1: Write the failing tests in `src/__tests__/roomFns.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  createRoom,
  addParticipant,
  reconnectParticipant,
  removeParticipant,
  castVote,
  reveal,
  selectVerdict,
  reset,
  setStory,
  toParticipantSnapshots,
} from '../lib/roomFns'
import type { StoredRoomState } from '../lib/store/adapter'

function makeRoom(overrides?: Partial<StoredRoomState>): StoredRoomState {
  return createRoom('test-room', 'fibonacci', undefined, false, 1000)
}

describe('createRoom', () => {
  it('creates a room with given id and voting phase', () => {
    const state = makeRoom()
    expect(state.id).toBe('test-room')
    expect(state.deck).toBe('fibonacci')
    expect(state.phase).toBe('voting')
    expect(state.history).toEqual([])
    expect(state.participants).toEqual([])
  })
})

describe('addParticipant', () => {
  it('first voter becomes host', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const p = s1.participants.find(p => p.id === id)!
    expect(p.isHost).toBe(true)
  })

  it('second voter is not host', () => {
    const state = makeRoom()
    const { state: s1 } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const { state: s2, id: bobId } = addParticipant(s1, 'Bob', 'voter', 'tok-bob')
    const bob = s2.participants.find(p => p.id === bobId)!
    expect(bob.isHost).toBe(false)
  })

  it('spectator is never host even when first to join', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Dave', 'spectator', 'tok-dave')
    const p = s1.participants.find(p => p.id === id)!
    expect(p.isHost).toBe(false)
  })

  it('voter becomes host when spectator joined first', () => {
    const state = makeRoom()
    const { state: s1 } = addParticipant(state, 'Dave', 'spectator', 'tok-dave')
    const { state: s2, id: aliceId } = addParticipant(s1, 'Alice', 'voter', 'tok-alice')
    const alice = s2.participants.find(p => p.id === aliceId)!
    expect(alice.isHost).toBe(true)
  })

  it('stores token in tokens map', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    expect(s1.tokens['tok-1']).toBe(id)
  })
})

describe('reconnectParticipant', () => {
  it('returns null for an unknown token', () => {
    const state = makeRoom()
    expect(reconnectParticipant(state, 'unknown')).toBeNull()
  })

  it('returns updated state for a known token', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const result = reconnectParticipant(s1, 'tok-1')
    expect(result).not.toBeNull()
    expect(result!.tokens['tok-1']).toBe(id)
  })

  it('preserves vote on reconnect', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const s2 = castVote(s1, id, 5)
    const s3 = reconnectParticipant(s2, 'tok-1')!
    expect(s3.votes[id]).toBe(5)
  })

  it('preserves host status on reconnect', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const s2 = reconnectParticipant(s1, 'tok-1')!
    const p = s2.participants.find(p => p.id === id)!
    expect(p.isHost).toBe(true)
  })
})

describe('removeParticipant', () => {
  it('removes participant and their vote', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = castVote(s1, id, 5)
    const s3 = removeParticipant(s2, id)
    expect(s3.participants.some(p => p.id === id)).toBe(false)
    expect(s3.votes[id]).toBeUndefined()
  })

  it('promotes next voter when host leaves', () => {
    const state = makeRoom()
    const { state: s1, id: hostId } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const { state: s2, id: bobId } = addParticipant(s1, 'Bob', 'voter', 'tok-bob')
    const s3 = removeParticipant(s2, hostId)
    const bob = s3.participants.find(p => p.id === bobId)!
    expect(bob.isHost).toBe(true)
  })

  it('does not crash when last participant leaves', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    expect(() => removeParticipant(s1, id)).not.toThrow()
  })
})

describe('castVote', () => {
  it('records vote for voter in voting phase', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = castVote(s1, id, 5)
    expect(s2.votes[id]).toBe(5)
  })

  it('ignores vote from spectator', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Dave', 'spectator', 'tok-dave')
    const s2 = castVote(s1, id, 5)
    expect(s2.votes[id]).toBeUndefined()
  })

  it('ignores vote when phase is revealed', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = reveal(s1, 'Alice')
    const s3 = castVote(s2, id, 5)
    expect(s3.votes[id]).toBeUndefined()
  })

  it('allows changing vote during voting phase', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = castVote(s1, id, 3)
    const s3 = castVote(s2, id, 5)
    expect(s3.votes[id]).toBe(5)
  })
})

describe('reveal', () => {
  it('sets phase to revealed', () => {
    const state = makeRoom()
    const s1 = reveal(state, 'Alice')
    expect(s1.phase).toBe('revealed')
  })

  it('logs reveal event', () => {
    const state = makeRoom()
    const s1 = reveal(state, 'Alice')
    expect(s1.eventLog).toHaveLength(1)
    expect(s1.eventLog[0]).toMatchObject({ type: 'revealed', actorName: 'Alice' })
  })
})

describe('reset', () => {
  it('is a no-op when phase is voting', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = castVote(s1, id, 5)
    const s3 = reset(s2, 'Alice')
    expect(s3.history).toHaveLength(0)
    expect(s3.votes[id]).toBe(5)
    expect(s3.phase).toBe('voting')
  })

  it('saves round to history with votes and resets state', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    let s = setStory(s1, 'Story 1')
    s = castVote(s, id, 5)
    s = reveal(s, 'Alice')
    const s2 = reset(s, 'Alice')
    expect(s2.history).toHaveLength(1)
    expect(s2.history[0].story).toBe('Story 1')
    expect(s2.history[0].votes[id]).toBe(5)
    expect(s2.votes).toEqual({})
    expect(s2.phase).toBe('voting')
    expect(s2.currentStory).toBeUndefined()
  })

  it('sets consensus when all voters vote the same', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 5)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].consensus).toBe(5)
  })

  it('consensus is undefined when voters disagree', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 3)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].consensus).toBeUndefined()
  })

  it('logs reset event', () => {
    const state = makeRoom()
    let s = reveal(state, 'Alice')
    s = reset(s, 'Bob')
    expect(s.eventLog).toHaveLength(2)
    expect(s.eventLog[1]).toMatchObject({ type: 'reset', actorName: 'Bob' })
  })

  it('records verdictSource natural when all voters agree', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 5)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].verdictSource).toBe('natural')
    expect(s3.history[0].consensus).toBe(5)
  })

  it('records verdictSource selected when selectedVerdict is a Card and no natural consensus', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 3)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    s = selectVerdict(s, 5)
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].verdictSource).toBe('selected')
    expect(s3.history[0].consensus).toBe(5)
  })

  it('records verdictSource none when selectedVerdict is NO_CONSENSUS', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 3)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    s = selectVerdict(s, 'NO_CONSENSUS')
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].verdictSource).toBe('none')
    expect(s3.history[0].consensus).toBeUndefined()
  })

  it('records verdictSource none when no selectedVerdict and voters disagree', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 3)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].verdictSource).toBe('none')
    expect(s3.history[0].consensus).toBeUndefined()
  })

  it('clears selectedVerdict after reset', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    let s = castVote(s1, id, 5)
    s = reveal(s, 'Alice')
    s = selectVerdict(s, 5)
    const s2 = reset(s, 'Alice')
    expect(s2.selectedVerdict).toBeUndefined()
  })

  it('natural consensus takes precedence over selectedVerdict', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 5)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    s = selectVerdict(s, 3)
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].verdictSource).toBe('natural')
    expect(s3.history[0].consensus).toBe(5)
  })
})

describe('selectVerdict', () => {
  it('stores a card verdict', () => {
    const state = makeRoom()
    const s1 = selectVerdict(state, 5)
    expect(s1.selectedVerdict).toBe(5)
  })

  it('stores NO_CONSENSUS', () => {
    const state = makeRoom()
    const s1 = selectVerdict(state, 'NO_CONSENSUS')
    expect(s1.selectedVerdict).toBe('NO_CONSENSUS')
  })

  it('can be overwritten', () => {
    const state = makeRoom()
    const s1 = selectVerdict(state, 3)
    const s2 = selectVerdict(s1, 8)
    expect(s2.selectedVerdict).toBe(8)
  })
})

describe('toParticipantSnapshots', () => {
  it('marks hasVoted true for voters who voted', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = castVote(s1, id, 5)
    const snapshots = toParticipantSnapshots(s2)
    expect(snapshots.find(s => s.id === id)?.hasVoted).toBe(true)
  })

  it('marks hasVoted false for voters who did not vote', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const snapshots = toParticipantSnapshots(s1)
    expect(snapshots.find(s => s.id === id)?.hasVoted).toBe(false)
  })

  it('marks hasVoted false for spectators', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Dave', 'spectator', 'tok-dave')
    const snapshots = toParticipantSnapshots(s1)
    expect(snapshots.find(s => s.id === id)?.hasVoted).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/roomFns.test.ts`
Expected: FAIL — `../lib/roomFns` not found

- [ ] **Step 3: Create `src/lib/roomFns.ts`**

```ts
import { nanoid } from 'nanoid'
import type { Card, DeckType, ParticipantSnapshot } from './types'
import type { StoredRoomState } from './store/adapter'

export function createRoom(
  id: string,
  deck: DeckType,
  customCards?: Card[],
  hostOnlyReveal = false,
  now = Date.now(),
): StoredRoomState {
  return {
    id,
    deck,
    customCards,
    hostOnlyReveal,
    phase: 'voting',
    votes: {},
    participants: [],
    tokens: {},
    history: [],
    eventLog: [],
    createdAt: now,
    lastActivityAt: now,
  }
}

export function addParticipant(
  state: StoredRoomState,
  name: string,
  role: 'voter' | 'spectator',
  token: string,
): { state: StoredRoomState; id: string } {
  const id = nanoid(8)
  const isHost = role === 'voter' && !state.participants.some(p => p.isHost)
  return {
    state: {
      ...state,
      participants: [...state.participants, { id, name, role, isHost, token }],
      tokens: { ...state.tokens, [token]: id },
      lastActivityAt: Date.now(),
    },
    id,
  }
}

export function reconnectParticipant(
  state: StoredRoomState,
  token: string,
): StoredRoomState | null {
  const participantId = state.tokens[token]
  if (!participantId) return null
  if (!state.participants.some(p => p.id === participantId)) return null
  return { ...state, lastActivityAt: Date.now() }
}

export function removeParticipant(state: StoredRoomState, id: string): StoredRoomState {
  const p = state.participants.find(p => p.id === id)
  if (!p) return state
  let remaining = state.participants.filter(p => p.id !== id)
  if (p.isHost) {
    const next = remaining.find(r => r.role === 'voter')
    if (next) remaining = remaining.map(r => r.id === next.id ? { ...r, isHost: true } : r)
  }
  const newTokens = { ...state.tokens }
  delete newTokens[p.token]
  const newVotes = { ...state.votes }
  delete newVotes[id]
  return { ...state, participants: remaining, tokens: newTokens, votes: newVotes, lastActivityAt: Date.now() }
}

export function castVote(state: StoredRoomState, participantId: string, card: Card): StoredRoomState {
  const p = state.participants.find(p => p.id === participantId)
  if (!p || p.role !== 'voter' || state.phase !== 'voting') return state
  return { ...state, votes: { ...state.votes, [participantId]: card }, lastActivityAt: Date.now() }
}

export function reveal(state: StoredRoomState, actorName: string): StoredRoomState {
  return {
    ...state,
    phase: 'revealed',
    eventLog: [...state.eventLog, { type: 'revealed', actorName, timestamp: Date.now() }],
    lastActivityAt: Date.now(),
  }
}

export function selectVerdict(state: StoredRoomState, card: Card | 'NO_CONSENSUS'): StoredRoomState {
  return { ...state, selectedVerdict: card, lastActivityAt: Date.now() }
}

export function reset(state: StoredRoomState, actorName: string): StoredRoomState {
  if (state.phase !== 'revealed') return state
  const naturalConsensus = computeConsensus(state)
  let consensus: Card | undefined
  let verdictSource: 'natural' | 'selected' | 'none'
  if (naturalConsensus !== undefined) {
    consensus = naturalConsensus
    verdictSource = 'natural'
  } else if (state.selectedVerdict !== undefined && state.selectedVerdict !== 'NO_CONSENSUS') {
    consensus = state.selectedVerdict
    verdictSource = 'selected'
  } else {
    consensus = undefined
    verdictSource = 'none'
  }
  return {
    ...state,
    phase: 'voting',
    votes: {},
    currentStory: undefined,
    selectedVerdict: undefined,
    history: [
      ...state.history,
      { story: state.currentStory, votes: state.votes, consensus, verdictSource, timestamp: Date.now() },
    ],
    eventLog: [...state.eventLog, { type: 'reset', actorName, timestamp: Date.now() }],
    lastActivityAt: Date.now(),
  }
}

export function setStory(state: StoredRoomState, title: string): StoredRoomState {
  return { ...state, currentStory: title, lastActivityAt: Date.now() }
}

export function toParticipantSnapshots(state: StoredRoomState): ParticipantSnapshot[] {
  return state.participants.map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    isHost: p.isHost,
    hasVoted: p.id in state.votes,
  }))
}

function computeConsensus(state: StoredRoomState): Card | undefined {
  const voters = state.participants.filter(p => p.role === 'voter')
  if (voters.length === 0) return undefined
  const cards = voters.map(v => state.votes[v.id]).filter((c): c is Card => c !== undefined)
  if (cards.length !== voters.length) return undefined
  return new Set(cards.map(String)).size === 1 ? cards[0] : undefined
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/roomFns.test.ts`
Expected: all tests in roomFns.test.ts pass

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests pass (roomFns.test.ts new + existing tests unchanged)

- [ ] **Step 6: Commit**

```bash
git add src/lib/roomFns.ts src/__tests__/roomFns.test.ts
git commit -m "feat: add pure room mutation functions with tests"
```

---

## Task 3: InMemoryAdapter + getAdapter() (TDD)

**Files:**
- Create: `src/lib/store/memory.ts`
- Create: `src/lib/store/index.ts`
- Create: `src/__tests__/store/memory.test.ts`

- [ ] **Step 1: Write failing tests in `src/__tests__/store/memory.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { InMemoryAdapter } from '../../lib/store/memory'
import type { StoredRoomState } from '../../lib/store/adapter'

afterEach(() => {
  vi.useRealTimers()
})

function makeState(id: string, lastActivityAt = Date.now()): StoredRoomState {
  return {
    id,
    deck: 'fibonacci',
    hostOnlyReveal: false,
    phase: 'voting',
    votes: {},
    participants: [],
    tokens: {},
    history: [],
    eventLog: [],
    createdAt: lastActivityAt,
    lastActivityAt,
  }
}

describe('InMemoryAdapter', () => {
  it('readRoom returns null for unknown room', async () => {
    const adapter = new InMemoryAdapter()
    expect(await adapter.readRoom('no-such-room')).toBeNull()
  })

  it('writeRoom then readRoom returns the state', async () => {
    const adapter = new InMemoryAdapter()
    const state = makeState('room-1')
    await adapter.writeRoom('room-1', state)
    expect(await adapter.readRoom('room-1')).toEqual(state)
  })

  it('deleteRoom removes the room', async () => {
    const adapter = new InMemoryAdapter()
    const state = makeState('room-1')
    await adapter.writeRoom('room-1', state)
    await adapter.deleteRoom('room-1')
    expect(await adapter.readRoom('room-1')).toBeNull()
  })

  it('subscribe callback is called when publish fires', async () => {
    const adapter = new InMemoryAdapter()
    const state = makeState('room-1')
    const received: StoredRoomState[] = []
    adapter.subscribe('room-1', s => received.push(s))
    await adapter.publish('room-1', state)
    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(state)
  })

  it('unsubscribe stops callbacks', async () => {
    const adapter = new InMemoryAdapter()
    const state = makeState('room-1')
    const received: StoredRoomState[] = []
    const unsub = adapter.subscribe('room-1', s => received.push(s))
    unsub()
    await adapter.publish('room-1', state)
    expect(received).toHaveLength(0)
  })

  it('cleanup removes rooms idle longer than 24h', () => {
    vi.useFakeTimers()
    const adapter = new InMemoryAdapter()
    const old = makeState('old-room', Date.now() - 25 * 60 * 60 * 1000)
    adapter['rooms'].set('old-room', old)
    adapter.cleanup()
    expect(adapter['rooms'].has('old-room')).toBe(false)
  })

  it('cleanup keeps rooms active within 24h', () => {
    vi.useFakeTimers()
    const adapter = new InMemoryAdapter()
    const fresh = makeState('fresh-room', Date.now())
    adapter['rooms'].set('fresh-room', fresh)
    adapter.cleanup()
    expect(adapter['rooms'].has('fresh-room')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/store/memory.test.ts`
Expected: FAIL — `../../lib/store/memory` not found

- [ ] **Step 3: Create `src/lib/store/memory.ts`**

```ts
import { EventEmitter } from 'events'
import type { RoomStoreAdapter, StoredRoomState } from './adapter'

const ROOM_TTL_MS = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

export class InMemoryAdapter implements RoomStoreAdapter {
  private rooms = new Map<string, StoredRoomState>()
  private emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(200)
  }

  async readRoom(id: string): Promise<StoredRoomState | null> {
    return this.rooms.get(id) ?? null
  }

  async writeRoom(id: string, state: StoredRoomState): Promise<void> {
    this.rooms.set(id, state)
  }

  async deleteRoom(id: string): Promise<void> {
    this.rooms.delete(id)
  }

  async publish(roomId: string, state: StoredRoomState): Promise<void> {
    this.emitter.emit(roomId, state)
  }

  subscribe(roomId: string, cb: (state: StoredRoomState) => void): () => void {
    this.emitter.on(roomId, cb)
    return () => this.emitter.off(roomId, cb)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [id, state] of this.rooms) {
      if (now - state.lastActivityAt > ROOM_TTL_MS) this.rooms.delete(id)
    }
  }

  startCleanup(): void {
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS)
  }
}
```

- [ ] **Step 4: Create `src/lib/store/index.ts`**

```ts
import { InMemoryAdapter } from './memory'
import type { RoomStoreAdapter } from './adapter'

declare global {
  // eslint-disable-next-line no-var
  var __scrumpokrAdapter: RoomStoreAdapter | undefined
}

export function getAdapter(): RoomStoreAdapter {
  if (!globalThis.__scrumpokrAdapter) {
    globalThis.__scrumpokrAdapter = new InMemoryAdapter()
  }
  return globalThis.__scrumpokrAdapter
}

export type { StoredRoomState, RoomStoreAdapter } from './adapter'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/__tests__/store/memory.test.ts`
Expected: all tests pass

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/store/memory.ts src/lib/store/index.ts src/__tests__/store/memory.test.ts
git commit -m "feat: add InMemoryAdapter and getAdapter() singleton"
```

---

## Task 4: Refactor API route to use adapter

**Files:**
- Modify: `src/app/api/rooms/route.ts`

- [ ] **Step 1: Replace the full contents of `src/app/api/rooms/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getAdapter } from '@/lib/store'
import { createRoom } from '@/lib/roomFns'
import type { Card, DeckType } from '@/lib/types'

const VALID_DECKS: DeckType[] = ['fibonacci', 'powers-of-2', 'tshirt', 'custom']

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { deck, customCards, hostOnlyReveal } = body as {
    deck: unknown
    customCards: unknown
    hostOnlyReveal: unknown
  }

  if (typeof deck !== 'string' || !VALID_DECKS.includes(deck as DeckType)) {
    return NextResponse.json({ error: 'Invalid deck' }, { status: 400 })
  }
  if (customCards !== undefined && !Array.isArray(customCards)) {
    return NextResponse.json({ error: 'customCards must be an array' }, { status: 400 })
  }
  if (deck === 'custom' && (!Array.isArray(customCards) || customCards.length === 0)) {
    return NextResponse.json({ error: 'Custom deck requires customCards' }, { status: 400 })
  }

  const state = createRoom(
    nanoid(8),
    deck as DeckType,
    customCards as Card[] | undefined,
    !!hostOnlyReveal,
  )
  await getAdapter().writeRoom(state.id, state)
  return NextResponse.json({ roomId: state.id })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/api/rooms/route.ts
git commit -m "feat: refactor API route to use adapter"
```

---

## Task 5: Refactor handler.ts to use adapter + connection map

**Files:**
- Modify: `src/ws/handler.ts`

- [ ] **Step 1: Replace the full contents of `src/ws/handler.ts`**

```ts
import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { IncomingMessage } from 'http'
import { getAdapter } from '@/lib/store'
import type { StoredRoomState } from '@/lib/store/adapter'
import type { ClientMessage, ServerMessage } from '@/lib/types'
import {
  addParticipant,
  reconnectParticipant,
  castVote,
  reveal,
  reset,
  setStory,
  selectVerdict,
  toParticipantSnapshots,
} from '@/lib/roomFns'

const HEARTBEAT_INTERVAL_MS = 25_000

// Per-instance maps — never shared across processes
const roomConnections = new Map<string, Map<string, WebSocket>>()
const roomSubscriptions = new Map<string, () => void>()

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

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://localhost`)
    const roomId = url.searchParams.get('roomId')
    const name = url.searchParams.get('name')?.trim()
    const role = url.searchParams.get('role') as 'voter' | 'spectator' | null
    const token = url.searchParams.get('token')

    if (!roomId || !name || !role || !token || !['voter', 'spectator'].includes(role)) {
      ws.close(1008, 'Missing required params')
      return
    }
    if (name.length > 64) {
      ws.close(1008, 'Name too long')
      return
    }

    const adapter = getAdapter()
    let state = await adapter.readRoom(roomId)
    if (!state) {
      ws.close(1008, 'Room not found')
      return
    }

    const existingParticipantId = state.tokens[token]
    const previousWs = existingParticipantId
      ? roomConnections.get(roomId)?.get(existingParticipantId) ?? null
      : null

    let participantId: string
    let isReconnect: boolean

    const reconnected = reconnectParticipant(state, token)
    if (reconnected) {
      state = reconnected
      participantId = existingParticipantId
      isReconnect = true
    } else {
      const result = addParticipant(state, name, role, token)
      state = result.state
      participantId = result.id
      isReconnect = false
    }

    if (previousWs && previousWs !== ws) {
      previousWs.close(1000, 'replaced by reconnect')
    }

    await adapter.writeRoom(roomId, state)

    if (!roomConnections.has(roomId)) roomConnections.set(roomId, new Map())
    roomConnections.get(roomId)!.set(participantId, ws)

    if (!roomSubscriptions.has(roomId)) {
      const unsub = adapter.subscribe(roomId, (newState) => {
        broadcastToLocalClients(roomId, newState)
      })
      roomSubscriptions.set(roomId, unsub)
    }

    alive.add(ws)
    ws.on('pong', () => alive.add(ws))

    await adapter.publish(roomId, state)

    if (!isReconnect) {
      const participant = state.participants.find(p => p.id === participantId)!
      broadcastLocalMsgExcept(roomId, ws, {
        type: 'participant_joined',
        id: participant.id,
        name: participant.name,
        role: participant.role,
      })
    }

    ws.on('message', async (data) => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }

      const current = await adapter.readRoom(roomId)
      if (!current) return
      const participant = current.participants.find(p => p.id === participantId)
      if (!participant) return

      switch (msg.type) {
        case 'vote': {
          if (participant.role !== 'voter' || current.phase !== 'voting') break
          const next = castVote(current, participantId, msg.card)
          await adapter.writeRoom(roomId, next)
          broadcastLocalMsg(roomId, { type: 'vote_cast', participantId })
          await adapter.publish(roomId, next)
          break
        }
        case 'reveal': {
          if (current.hostOnlyReveal && !participant.isHost) break
          const next = reveal(current, participant.name)
          await adapter.writeRoom(roomId, next)
          broadcastLocalMsg(roomId, { type: 'votes_revealed', votes: next.votes })
          await adapter.publish(roomId, next)
          break
        }
        case 'reset': {
          if ((current.hostOnlyReveal && !participant.isHost) || current.phase !== 'revealed') break
          const next = reset(current, participant.name)
          await adapter.writeRoom(roomId, next)
          broadcastLocalMsg(roomId, { type: 'round_reset' })
          await adapter.publish(roomId, next)
          break
        }
        case 'set_story': {
          const next = setStory(current, msg.title)
          await adapter.writeRoom(roomId, next)
          await adapter.publish(roomId, next)
          break
        }
        case 'select_verdict': {
          if (current.phase !== 'revealed') break
          const next = selectVerdict(current, msg.card)
          await adapter.writeRoom(roomId, next)
          await adapter.publish(roomId, next)
          break
        }
      }
    })

    ws.on('close', () => {
      alive.delete(ws)
      const clients = roomConnections.get(roomId)
      if (clients) {
        clients.delete(participantId)
        if (clients.size === 0) {
          roomConnections.delete(roomId)
          const unsub = roomSubscriptions.get(roomId)
          if (unsub) {
            unsub()
            roomSubscriptions.delete(roomId)
          }
        }
      }
    })
  })
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function broadcastToLocalClients(roomId: string, state: StoredRoomState): void {
  const clients = roomConnections.get(roomId)
  if (!clients) return
  for (const [pId, ws] of clients) send(ws, buildRoomState(state, pId))
}

function broadcastLocalMsg(roomId: string, msg: ServerMessage): void {
  const clients = roomConnections.get(roomId)
  if (!clients) return
  for (const [, ws] of clients) send(ws, msg)
}

function broadcastLocalMsgExcept(roomId: string, exclude: WebSocket, msg: ServerMessage): void {
  const clients = roomConnections.get(roomId)
  if (!clients) return
  for (const [, ws] of clients) {
    if (ws !== exclude) send(ws, msg)
  }
}

function buildRoomState(state: StoredRoomState, yourId: string): Extract<ServerMessage, { type: 'room_state' }> {
  return {
    type: 'room_state',
    phase: state.phase,
    deck: state.deck,
    customCards: state.customCards,
    currentStory: state.currentStory,
    participants: toParticipantSnapshots(state),
    votes: state.phase === 'revealed' ? state.votes : undefined,
    history: state.history,
    hostOnlyReveal: state.hostOnlyReveal,
    eventLog: state.eventLog,
    yourId,
    selectedVerdict: state.selectedVerdict,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/ws/handler.ts
git commit -m "feat: refactor WebSocket handler to use adapter and per-instance connection map"
```

---

## Task 6: Update server.ts, delete old files

**Files:**
- Modify: `server.ts`
- Delete: `src/lib/room.ts`, `src/lib/registry.ts`, `src/__tests__/room.test.ts`, `src/__tests__/registry.test.ts`

- [ ] **Step 1: Replace the full contents of `server.ts`**

```ts
import { createServer } from 'http'
import next from 'next'
import { attachWebSocket } from './src/ws/handler'
import { getAdapter } from './src/lib/store'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '8080', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res))

  attachWebSocket(server)
  getAdapter().startCleanup()

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
```

- [ ] **Step 2: Delete old files**

```bash
rm src/lib/room.ts src/lib/registry.ts src/__tests__/room.test.ts src/__tests__/registry.test.ts
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all tests pass (room.test.ts and registry.test.ts are now gone; roomFns.test.ts and store/memory.test.ts cover the same logic)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire getAdapter() into server.ts, remove Room class and registry"
```

---

## Task 7: RedisAdapter

**Files:**
- Create: `src/lib/store/redis.ts`
- Modify: `src/lib/store/index.ts`

- [ ] **Step 1: Install ioredis**

Run: `npm install ioredis`
Expected: ioredis added to dependencies in package.json

- [ ] **Step 2: Create `src/lib/store/redis.ts`**

```ts
import Redis from 'ioredis'
import type { RoomStoreAdapter, StoredRoomState } from './adapter'

const KEY_PREFIX = 'scrumpokr:room:'
const CHANNEL_PREFIX = 'scrumpokr:room:'
const ROOM_TTL_SECONDS = 24 * 60 * 60

export class RedisAdapter implements RoomStoreAdapter {
  private client: Redis
  private subscriber: Redis
  private subscriptions = new Map<string, Set<(state: StoredRoomState) => void>>()

  constructor(url: string) {
    this.client = new Redis(url, { lazyConnect: false })
    this.subscriber = new Redis(url, { lazyConnect: false })
    this.subscriber.on('message', (channel: string, message: string) => {
      const callbacks = this.subscriptions.get(channel)
      if (!callbacks) return
      const state = JSON.parse(message) as StoredRoomState
      for (const cb of callbacks) cb(state)
    })
  }

  async readRoom(id: string): Promise<StoredRoomState | null> {
    const data = await this.client.get(`${KEY_PREFIX}${id}`)
    if (!data) return null
    return JSON.parse(data) as StoredRoomState
  }

  async writeRoom(id: string, state: StoredRoomState): Promise<void> {
    await this.client.set(`${KEY_PREFIX}${id}`, JSON.stringify(state), 'EX', ROOM_TTL_SECONDS)
  }

  async deleteRoom(id: string): Promise<void> {
    await this.client.del(`${KEY_PREFIX}${id}`)
  }

  async publish(roomId: string, state: StoredRoomState): Promise<void> {
    await this.client.publish(`${CHANNEL_PREFIX}${roomId}`, JSON.stringify(state))
  }

  subscribe(roomId: string, cb: (state: StoredRoomState) => void): () => void {
    const channel = `${CHANNEL_PREFIX}${roomId}`
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set())
      this.subscriber.subscribe(channel)
    }
    this.subscriptions.get(channel)!.add(cb)
    return () => {
      const set = this.subscriptions.get(channel)
      if (!set) return
      set.delete(cb)
      if (set.size === 0) {
        this.subscriptions.delete(channel)
        this.subscriber.unsubscribe(channel)
      }
    }
  }

  startCleanup(): void {
    // Redis TTL on writeRoom handles expiry; no polling needed
  }
}
```

- [ ] **Step 3: Update `src/lib/store/index.ts` to select adapter by env var**

```ts
import { InMemoryAdapter } from './memory'
import type { RoomStoreAdapter } from './adapter'

declare global {
  // eslint-disable-next-line no-var
  var __scrumpokrAdapter: RoomStoreAdapter | undefined
}

function createAdapter(): RoomStoreAdapter {
  if (process.env.ROOM_STORE_ADAPTER === 'redis') {
    const url = process.env.REDIS_URL
    if (!url) throw new Error('REDIS_URL is required when ROOM_STORE_ADAPTER=redis')
    const { RedisAdapter } = require('./redis') as { RedisAdapter: new (url: string) => RoomStoreAdapter }
    return new RedisAdapter(url)
  }
  return new InMemoryAdapter()
}

export function getAdapter(): RoomStoreAdapter {
  if (!globalThis.__scrumpokrAdapter) {
    globalThis.__scrumpokrAdapter = createAdapter()
  }
  return globalThis.__scrumpokrAdapter
}

export type { StoredRoomState, RoomStoreAdapter } from './adapter'
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all tests pass (RedisAdapter is not unit tested; it is tested via docker-compose in Task 8)

- [ ] **Step 6: Commit**

```bash
git add src/lib/store/redis.ts src/lib/store/index.ts package.json package-lock.json
git commit -m "feat: add RedisAdapter with ioredis, wire ROOM_STORE_ADAPTER env var"
```

---

## Task 8: Docker Compose + env vars

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Replace the full contents of `docker-compose.yml`**

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - redis
    environment:
      - NODE_ENV=production
      - PORT=3000
      - ROOM_STORE_ADAPTER=redis
      - REDIS_URL=redis://redis:6379
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add Redis service to docker-compose, wire ROOM_STORE_ADAPTER and REDIS_URL"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|-----------------|------|
| `RoomStoreAdapter` interface | Task 1 |
| `StoredRoomState` type (no ws) | Task 1 |
| `StoredParticipant` (Participant minus ws) | Task 1 |
| `InMemoryAdapter` — Map + EventEmitter | Task 3 |
| `getAdapter()` singleton, globalThis | Task 3 |
| Pure room mutation functions, `lastActivityAt` updated | Task 2 |
| Existing tests migrated to pure functions | Task 2 |
| API route uses `getAdapter()` | Task 4 |
| Handler uses adapter + per-instance connection map | Task 5 |
| Subscribe on first local client, unsubscribe on last | Task 5 |
| `server.ts` uses `getAdapter().startCleanup()` | Task 6 |
| `Room` class and `registry.ts` removed | Task 6 |
| `RedisAdapter` — ioredis commands + subscriber | Task 7 |
| `ROOM_STORE_ADAPTER` env var selection | Task 7 |
| `REDIS_URL` required when adapter=redis | Task 7 |
| Redis TTL 24h on writeRoom, startCleanup no-op | Task 7 |
| docker-compose adds Redis service + env vars | Task 8 |
| GCP Cloud Run: set env vars, no code changes | Documented in spec |
