# Verdict Selection, Richer Stats & Self-Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual verdict selection when no consensus is reached, enrich the stats row (Avg/Median/Min/Max/Most Voted), and highlight the current user's card in the participant grid.

**Architecture:** Server-side `selectedVerdict` state on `Room` with a new `select_verdict` client message; `verdictSource` stored in `RoundResult` history so round icons are deterministic. All UI changes are in leaf components (`ResultsSummary`, `VotingHistory`, `ParticipantGrid`) wired together in `RoomClient`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, `ws` WebSocket library. No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `verdictSource` to `RoundResult`; add `select_verdict` to `ClientMessage`; add `selectedVerdict` to `room_state` |
| `src/lib/room.ts` | Add `selectedVerdict` field; add `selectVerdict()` method; update `reset()` to set `verdictSource` and use `selectedVerdict` |
| `src/__tests__/room.test.ts` | Add tests for `selectVerdict` and `verdictSource` in `reset()` |
| `src/ws/handler.ts` | Handle `select_verdict` message; include `selectedVerdict` in `buildRoomState` |
| `src/components/ResultsSummary.tsx` | Add Median + Most Voted stats; verdict picker UI |
| `src/components/VotingHistory.tsx` | Icon prefix per round using `verdictSource` |
| `src/components/ParticipantGrid.tsx` | Add `yourId` prop; ring highlight + bold name for self |
| `src/app/room/[id]/RoomClient.tsx` | Pass `selectedVerdict`, `onSelectVerdict`, `yourId` to components; add `handleSelectVerdict` |

---

### Task 1: Types and Room model

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/room.ts`
- Modify: `src/__tests__/room.test.ts`

**Context:** `RoundResult` gains a required `verdictSource: 'natural' | 'selected' | 'none'` field set at reset time — this makes history icons deterministic regardless of how many voters were in the room. `Room` gains `selectedVerdict` state and a `selectVerdict()` method. `reset()` consults both natural consensus and the selected verdict when writing to history. No existing tests construct `RoundResult` directly (only read from `room.history`), so making `verdictSource` required doesn't break them.

- [ ] **Step 1: Write failing tests**

Add these blocks to `src/__tests__/room.test.ts` after the existing `reset` describe block:

```ts
  describe('selectVerdict', () => {
    it('sets selectedVerdict to a card value', () => {
      const room = new Room('fibonacci')
      room.selectVerdict(5)
      expect(room.selectedVerdict).toBe(5)
    })

    it('sets selectedVerdict to NO_CONSENSUS', () => {
      const room = new Room('fibonacci')
      room.selectVerdict('NO_CONSENSUS')
      expect(room.selectedVerdict).toBe('NO_CONSENSUS')
    })
  })

  describe('reset verdictSource', () => {
    it('verdictSource is natural when all voters agree', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      const p2 = room.addParticipant('Bob', 'voter', mockWs(), 'tok-2')
      room.castVote(p1.id, 5)
      room.castVote(p2.id, 5)
      room.reveal('Alice')
      room.reset('Alice')
      expect(room.history[0].verdictSource).toBe('natural')
      expect(room.history[0].consensus).toBe(5)
    })

    it('verdictSource is selected when manual verdict chosen', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      const p2 = room.addParticipant('Bob', 'voter', mockWs(), 'tok-2')
      room.castVote(p1.id, 3)
      room.castVote(p2.id, 5)
      room.reveal('Alice')
      room.selectVerdict(5)
      room.reset('Alice')
      expect(room.history[0].verdictSource).toBe('selected')
      expect(room.history[0].consensus).toBe(5)
    })

    it('verdictSource is none when no verdict selected', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      const p2 = room.addParticipant('Bob', 'voter', mockWs(), 'tok-2')
      room.castVote(p1.id, 3)
      room.castVote(p2.id, 5)
      room.reveal('Alice')
      room.reset('Alice')
      expect(room.history[0].verdictSource).toBe('none')
      expect(room.history[0].consensus).toBeUndefined()
    })

    it('verdictSource is none when NO_CONSENSUS explicitly selected', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      const p2 = room.addParticipant('Bob', 'voter', mockWs(), 'tok-2')
      room.castVote(p1.id, 3)
      room.castVote(p2.id, 5)
      room.reveal('Alice')
      room.selectVerdict('NO_CONSENSUS')
      room.reset('Alice')
      expect(room.history[0].verdictSource).toBe('none')
      expect(room.history[0].consensus).toBeUndefined()
    })

    it('clears selectedVerdict after reset', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      room.castVote(p.id, 5)
      room.reveal('Alice')
      room.selectVerdict(3)
      room.reset('Alice')
      expect(room.selectedVerdict).toBeUndefined()
    })
  })
```

- [ ] **Step 2: Run tests and verify new ones fail**

```bash
npm test 2>&1 | tail -20
```

Expected: failures on `selectVerdict` and `verdictSource` tests.

- [ ] **Step 3: Update types.ts**

Replace `src/lib/types.ts` with:

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
  token: string
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
  verdictSource: 'natural' | 'selected' | 'none'
  timestamp: number
}

export interface EventLogEntry {
  type: 'revealed' | 'reset'
  actorName: string
  timestamp: number
}

export type ClientMessage =
  | { type: 'vote'; card: Card }
  | { type: 'reveal' }
  | { type: 'reset' }
  | { type: 'set_story'; title: string }
  | { type: 'select_verdict'; card: Card | 'NO_CONSENSUS' }

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
      hostOnlyReveal: boolean
      eventLog: EventLogEntry[]
      selectedVerdict?: Card | 'NO_CONSENSUS'
      yourId: string
    }
  | { type: 'participant_joined'; id: string; name: string; role: 'voter' | 'spectator' }
  | { type: 'vote_cast'; participantId: string }
  | { type: 'votes_revealed'; votes: Record<string, Card> }
  | { type: 'round_reset' }
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
  selectedVerdict: Card | 'NO_CONSENSUS' | undefined = undefined
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

  selectVerdict(card: Card | 'NO_CONSENSUS'): void {
    this.selectedVerdict = card
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
    const naturalConsensus = this.computeConsensus()

    let consensus: Card | undefined
    let verdictSource: 'natural' | 'selected' | 'none'
    if (naturalConsensus !== undefined) {
      consensus = naturalConsensus
      verdictSource = 'natural'
    } else if (this.selectedVerdict !== undefined && this.selectedVerdict !== 'NO_CONSENSUS') {
      consensus = this.selectedVerdict as Card
      verdictSource = 'selected'
    } else {
      consensus = undefined
      verdictSource = 'none'
    }

    this.history.push({
      story: this.currentStory,
      votes: votesObj,
      consensus,
      verdictSource,
      timestamp: Date.now(),
    })
    this.eventLog.push({ type: 'reset', actorName, timestamp: Date.now() })
    this.votes.clear()
    this.selectedVerdict = undefined
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

- [ ] **Step 5: Run all tests and verify they pass**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass (including new ones).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/room.ts src/__tests__/room.test.ts
git commit -m "feat: add verdict selection and verdictSource to Room"
```

---

### Task 2: WebSocket handler

**Files:**
- Modify: `src/ws/handler.ts`

**Context:** Two changes: handle the `select_verdict` client message, and include `room.selectedVerdict` in `buildRoomState` so all clients see the current selection. No unit tests — verify manually with the dev server in Task 6.

- [ ] **Step 1: Add `select_verdict` case to the message switch**

In `src/ws/handler.ts`, add this case after the `set_story` case (before the closing `}` of the switch):

```ts
        case 'select_verdict': {
          room.selectVerdict(msg.card)
          broadcastRoomStateAll(room)
          break
        }
```

- [ ] **Step 2: Add `selectedVerdict` to `buildRoomState`**

Update `buildRoomState` in `src/ws/handler.ts`:

```ts
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
    selectedVerdict: room.selectedVerdict,
    yourId,
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/ws/handler.ts
git commit -m "feat: handle select_verdict in WS handler"
```

---

### Task 3: ResultsSummary — stats and verdict picker

**Files:**
- Modify: `src/components/ResultsSummary.tsx`

**Context:** Current props are `votes` and `participants`. New props: `selectedVerdict?: Card | 'NO_CONSENSUS'` and `onSelectVerdict: (v: Card | 'NO_CONSENSUS') => void`. The stats row gains Median and Most Voted. When revealed with no natural consensus, a verdict row appears below the stats. The verdict row shows unique voted values as pill buttons plus a "No consensus" button — the selected one is highlighted amber (card) or muted slate (no consensus). Clicking any button calls `onSelectVerdict`. Participants can change their mind by clicking a different option.

Non-numeric votes (e.g. t-shirt sizes) are excluded from Avg/Median/Min/Max but included in Most Voted.

- [ ] **Step 1: Replace ResultsSummary.tsx**

```tsx
import type { Card, ParticipantSnapshot } from '@/lib/types'

interface Props {
  votes: Record<string, Card>
  participants: ParticipantSnapshot[]
  selectedVerdict?: Card | 'NO_CONSENSUS'
  onSelectVerdict: (v: Card | 'NO_CONSENSUS') => void
}

export function ResultsSummary({ votes, participants, selectedVerdict, onSelectVerdict }: Props) {
  const voterIds = participants.filter(p => p.role === 'voter').map(p => p.id)
  const allCards = voterIds.map(id => votes[id]).filter(c => c !== undefined)
  const numeric = allCards.filter((c): c is number => typeof c === 'number')

  const hasAllVoted = allCards.length === voterIds.length && voterIds.length > 0
  const naturalConsensus =
    hasAllVoted && new Set(allCards.map(String)).size === 1 ? allCards[0] : undefined

  const avg = numeric.length > 0
    ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1)
    : '—'

  const median = (() => {
    if (numeric.length === 0) return '—'
    const sorted = [...numeric].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1)
      : String(sorted[mid])
  })()

  const min = numeric.length > 0 ? Math.min(...numeric) : '—'
  const max = numeric.length > 0 ? Math.max(...numeric) : '—'

  const mostVoted = (() => {
    if (allCards.length === 0) return '—'
    const counts = new Map<string, number>()
    for (const c of allCards) {
      const key = String(c)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const maxCount = Math.max(...counts.values())
    return [...counts.entries()]
      .filter(([, count]) => count === maxCount)
      .map(([key]) => key)
      .join(' / ')
  })()

  const uniqueVoted = [...new Map(allCards.map(c => [String(c), c])).values()]

  return (
    <div className="bg-sky-50 dark:bg-gray-800 border border-sky-200 dark:border-transparent rounded-xl px-4 py-3 flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-6 flex-wrap">
        <span className="text-sky-600 dark:text-gray-400">Avg: <strong className="text-slate-900 dark:text-white">{avg}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Median: <strong className="text-slate-900 dark:text-white">{median}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Min: <strong className="text-slate-900 dark:text-white">{String(min)}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Max: <strong className="text-slate-900 dark:text-white">{String(max)}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Most Voted: <strong className="text-slate-900 dark:text-white">{mostVoted}</strong></span>
        {naturalConsensus !== undefined && (
          <span className="text-emerald-600 dark:text-green-400 font-semibold ml-auto">
            🎉 Consensus: {String(naturalConsensus)}
          </span>
        )}
      </div>

      {naturalConsensus === undefined && allCards.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-sky-200 dark:border-gray-700">
          <span className="text-sky-600 dark:text-gray-400 text-xs shrink-0">Verdict:</span>
          {uniqueVoted.map(card => (
            <button
              key={String(card)}
              onClick={() => onSelectVerdict(card)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                selectedVerdict !== 'NO_CONSENSUS' && String(selectedVerdict) === String(card)
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                  : 'bg-white dark:bg-gray-700 border-sky-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 hover:bg-sky-100 dark:hover:bg-gray-600'
              }`}
            >
              {String(card)}
            </button>
          ))}
          <button
            onClick={() => onSelectVerdict('NO_CONSENSUS')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
              selectedVerdict === 'NO_CONSENSUS'
                ? 'bg-slate-200 dark:bg-gray-600 text-slate-600 dark:text-gray-300 border-slate-300 dark:border-gray-500'
                : 'bg-white dark:bg-gray-700 border-sky-300 dark:border-gray-600 text-slate-400 dark:text-gray-400 hover:bg-sky-100 dark:hover:bg-gray-600'
            }`}
          >
            No consensus
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: TypeScript will complain that `<ResultsSummary>` in `RoomClient.tsx` is missing the new props. That is expected — it will be fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/components/ResultsSummary.tsx
git commit -m "feat: add median/most-voted stats and verdict picker to ResultsSummary"
```

---

### Task 4: VotingHistory — round icons

**Files:**
- Modify: `src/components/VotingHistory.tsx`

**Context:** Each round in history now shows an icon based on `verdictSource`: 🎉 natural consensus, ✓ manually selected verdict, ✗ no consensus. Old rounds without `verdictSource` (backward compat): treat `consensus !== undefined` as natural, else none. Selected verdict consensus shown in amber to distinguish from natural consensus.

- [ ] **Step 1: Replace VotingHistory.tsx**

```tsx
import type { RoundResult } from '@/lib/types'

interface Props {
  history: RoundResult[]
  participantNames: Record<string, string>
}

function getRoundIcon(round: RoundResult): string {
  const src = round.verdictSource
  if (!src) return round.consensus !== undefined ? '🎉' : '✗'
  if (src === 'natural') return '🎉'
  if (src === 'selected') return '✓'
  return '✗'
}

export function VotingHistory({ history, participantNames }: Props) {
  if (history.length === 0) return null

  return (
    <div>
      <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-3">
        History ({history.length} {history.length === 1 ? 'round' : 'rounds'})
      </p>
      <div className="space-y-2">
        {[...history].reverse().map((round, i) => (
          <div
            key={i}
            className="bg-sky-50 dark:bg-gray-800 border border-sky-200 dark:border-transparent rounded-lg px-4 py-2.5 flex items-start justify-between gap-4 text-sm"
          >
            <div className="flex items-start gap-2 min-w-0">
              <span className="shrink-0 mt-0.5 text-base leading-none">{getRoundIcon(round)}</span>
              <span className="text-slate-700 dark:text-gray-300 truncate">
                {round.story ?? <em className="text-slate-400 dark:text-gray-500">Untitled</em>}
              </span>
            </div>
            <span className="shrink-0 text-right">
              {round.consensus !== undefined ? (
                <span className={`font-semibold ${
                  round.verdictSource === 'selected'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-green-400'
                }`}>
                  → {String(round.consensus)}
                </span>
              ) : (
                <span className="text-slate-400 dark:text-gray-500 text-xs">
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

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in this file (the RoomClient errors from Task 3 may still be present).

- [ ] **Step 3: Commit**

```bash
git add src/components/VotingHistory.tsx
git commit -m "feat: add round icons to VotingHistory (natural/selected/none)"
```

---

### Task 5: ParticipantGrid — self-highlight

**Files:**
- Modify: `src/components/ParticipantGrid.tsx`

**Context:** A new required prop `yourId: string` identifies the current user. Their card face gets `ring-2 ring-sky-400 dark:ring-indigo-400 ring-offset-1 dark:ring-offset-gray-900` added. Their name label gets `font-semibold` added. All other participants are visually unchanged.

- [ ] **Step 1: Replace ParticipantGrid.tsx**

```tsx
import type { Card, ParticipantSnapshot } from '@/lib/types'

const BADGE_COLORS = [
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

interface Props {
  participants: ParticipantSnapshot[]
  votes?: Record<string, Card>
  phase: 'voting' | 'revealed'
  yourId: string
}

export function ParticipantGrid({ participants, votes, phase, yourId }: Props) {
  return (
    <div>
      <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-3">
        Participants ({participants.length})
      </p>
      <div className="flex flex-wrap gap-4">
        {participants.map((p, i) => {
          const isYou = p.id === yourId
          return (
            <div key={p.id} className="flex flex-col items-center gap-1.5">
              <CardFace p={p} phase={phase} votes={votes} isYou={isYou} />
              <span className={`text-xs max-w-[52px] truncate text-center leading-tight px-1.5 py-0.5 rounded-full dark:px-0 dark:py-0 dark:rounded-none dark:bg-transparent dark:text-gray-400 ${BADGE_COLORS[i % BADGE_COLORS.length]}${isYou ? ' font-semibold' : ''}`}>
                {p.name}{p.isHost ? ' ★' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CardFace({
  p,
  phase,
  votes,
  isYou,
}: {
  p: ParticipantSnapshot
  phase: 'voting' | 'revealed'
  votes?: Record<string, Card>
  isYou: boolean
}) {
  const ring = isYou ? ' ring-2 ring-sky-400 dark:ring-indigo-400 ring-offset-1 dark:ring-offset-gray-900' : ''

  if (p.role === 'spectator') {
    return (
      <div className={`w-12 h-16 rounded-lg bg-sky-50 dark:bg-gray-800 border border-dashed border-sky-300 dark:border-gray-600 flex items-center justify-center text-sky-400 dark:text-gray-500 text-lg${ring}`}>
        👁
      </div>
    )
  }

  if (phase === 'revealed' && votes) {
    const card = votes[p.id]
    return (
      <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center font-bold text-base${ring} ${
        card !== undefined
          ? 'bg-sky-100 dark:bg-green-800 border-sky-400 dark:border-green-500 text-sky-800 dark:text-white'
          : 'bg-sky-50 dark:bg-gray-800 border-sky-200 dark:border-gray-600 text-slate-400 dark:text-gray-500'
      }`}>
        {card !== undefined ? String(card) : '—'}
      </div>
    )
  }

  return (
    <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-lg${ring} ${
      p.hasVoted
        ? 'bg-sky-100 dark:bg-green-900 border-sky-400 dark:border-green-600 text-sky-700 dark:text-green-300'
        : 'bg-sky-50 dark:bg-gray-800 border-dashed border-sky-200 dark:border-gray-600 text-slate-300 dark:text-gray-600'
    }`}>
      {p.hasVoted ? '✓' : '…'}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: TypeScript will report `<ParticipantGrid>` in `RoomClient.tsx` is missing `yourId`. That will be fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/components/ParticipantGrid.tsx
git commit -m "feat: highlight current user's card in ParticipantGrid"
```

---

### Task 6: RoomClient wiring

**Files:**
- Modify: `src/app/room/[id]/RoomClient.tsx`

**Context:** `RoomState` must include `selectedVerdict`. A new `handleSelectVerdict` function sends `select_verdict` via WebSocket. `<ResultsSummary>` gets `selectedVerdict` and `onSelectVerdict` props. `<ParticipantGrid>` gets `yourId`. This task resolves all remaining TypeScript errors from Tasks 3 and 5.

- [ ] **Step 1: Add `selectedVerdict` to the `RoomState` interface**

In `src/app/room/[id]/RoomClient.tsx`, update the `RoomState` interface to add `selectedVerdict`:

```ts
interface RoomState {
  phase: 'voting' | 'revealed'
  deck: DeckType
  customCards?: Card[]
  currentStory?: string
  participants: ParticipantSnapshot[]
  votes?: Record<string, Card>
  history: RoundResult[]
  hostOnlyReveal: boolean
  eventLog: EventLogEntry[]
  selectedVerdict?: Card | 'NO_CONSENSUS'
  yourId: string
}
```

- [ ] **Step 2: Add `handleSelectVerdict` function**

Add this after `handleReset`:

```ts
function handleSelectVerdict(card: Card | 'NO_CONSENSUS') {
  sendMsg({ type: 'select_verdict', card })
}
```

- [ ] **Step 3: Update `<ResultsSummary>` usage**

Find the `<ResultsSummary>` JSX in the render and update it:

```tsx
{roomState.phase === 'revealed' && roomState.votes && (
  <ResultsSummary
    votes={roomState.votes}
    participants={roomState.participants}
    selectedVerdict={roomState.selectedVerdict}
    onSelectVerdict={handleSelectVerdict}
  />
)}
```

- [ ] **Step 4: Update `<ParticipantGrid>` usage**

Find the `<ParticipantGrid>` JSX and add `yourId`:

```tsx
<ParticipantGrid
  participants={roomState.participants}
  votes={roomState.votes}
  phase={roomState.phase}
  yourId={roomState.yourId}
/>
```

- [ ] **Step 5: Verify TypeScript — no errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Manual smoke test**

Start the dev server:

```bash
npm run dev
```

Test checklist:
1. Create a room, join with two browser tabs
2. Both vote different values → reveal → stats row shows Avg, Median, Min, Max, Most Voted correctly
3. Verdict row appears below stats: pill buttons for each voted value + "No consensus" button
4. Click a card value in one tab → all tabs see it highlighted in amber
5. Click "No consensus" → all tabs see it highlighted in slate
6. Click another card value to change → selection updates everywhere
7. Click "Next Round" → history shows ✓ icon for selected verdict in amber
8. New round: both vote same value → 🎉 Consensus (no verdict picker shown)
9. History shows 🎉 for natural consensus round
10. Your card in the participants grid has a sky ring; your name is bold

- [ ] **Step 8: Commit**

```bash
git add "src/app/room/[id]/RoomClient.tsx"
git commit -m "feat: wire verdict selection and self-highlight into RoomClient"
```
