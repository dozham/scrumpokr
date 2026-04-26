# Verdict Selection, Richer Stats & Self-Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual verdict picking after reveal, expand the stats row (Avg/Median/Min/Max/Most Voted), and highlight the current user's card in the participant grid.

**Architecture:** Server-side state (`selectedVerdict`) is stored on the `Room` object and cleared on `reset()`; verdict selection is broadcast via the existing `broadcastRoomStateAll` path. UI changes are confined to three components (`ResultsSummary`, `VotingHistory`, `ParticipantGrid`) wired together in `RoomClient`.

**Tech Stack:** TypeScript, Next.js 16 App Router, React 19, WebSocket (`ws`), Tailwind CSS 4, Vitest 4

---

## File Map

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `select_verdict` to `ClientMessage`; `selectedVerdict` to `room_state`; `verdictSource` to `RoundResult` |
| `src/lib/room.ts` | Add `selectedVerdict` field; `selectVerdict()` method; update `reset()` |
| `src/ws/handler.ts` | Handle `select_verdict` message; include `selectedVerdict` in `buildRoomState` |
| `src/components/ResultsSummary.tsx` | Richer stats row (Median + Most Voted) + verdict picker UI |
| `src/components/VotingHistory.tsx` | Icon prefix per round using `verdictSource` |
| `src/components/ParticipantGrid.tsx` | Add `yourId` prop; ring + bold-name highlight for self |
| `src/app/room/[id]/RoomClient.tsx` | Add `selectedVerdict` to `RoomState`; wire `handleSelectVerdict`; pass new props |
| `src/__tests__/room.test.ts` | Tests for `selectVerdict()` and updated `reset()` |

---

## Task 1: Update Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add `verdictSource` to `RoundResult`, `select_verdict` to `ClientMessage`, and `selectedVerdict` to the `room_state` ServerMessage**

Replace the contents of `src/lib/types.ts` with:

```typescript
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
  verdictSource?: 'natural' | 'selected' | 'none'
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
      yourId: string
      selectedVerdict?: Card | 'NO_CONSENSUS'
    }
  | { type: 'participant_joined'; id: string; name: string; role: 'voter' | 'spectator' }
  | { type: 'vote_cast'; participantId: string }
  | { type: 'votes_revealed'; votes: Record<string, Card> }
  | { type: 'round_reset' }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or only pre-existing errors unrelated to types.ts)

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add select_verdict message, selectedVerdict to room_state, verdictSource to RoundResult"
```

---

## Task 2: Update Room Model

**Files:**
- Modify: `src/lib/room.ts`
- Test: `src/__tests__/room.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/room.test.ts` (before the closing `}` of the outer `describe('Room', ...)` block):

```typescript
  describe('selectVerdict', () => {
    it('stores a card verdict', () => {
      const room = new Room('fibonacci')
      room.selectVerdict(5)
      expect(room.selectedVerdict).toBe(5)
    })

    it('stores NO_CONSENSUS', () => {
      const room = new Room('fibonacci')
      room.selectVerdict('NO_CONSENSUS')
      expect(room.selectedVerdict).toBe('NO_CONSENSUS')
    })

    it('can be overwritten', () => {
      const room = new Room('fibonacci')
      room.selectVerdict(3)
      room.selectVerdict(8)
      expect(room.selectedVerdict).toBe(8)
    })
  })

  describe('reset() verdictSource', () => {
    it('records verdictSource natural when all voters agree', () => {
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

    it('records verdictSource selected when selectedVerdict is a Card and no natural consensus', () => {
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

    it('records verdictSource none when selectedVerdict is NO_CONSENSUS', () => {
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

    it('records verdictSource none when no selectedVerdict and voters disagree', () => {
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

    it('clears selectedVerdict after reset', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      room.castVote(p.id, 5)
      room.reveal('Alice')
      room.selectVerdict(5)
      room.reset('Alice')
      expect(room.selectedVerdict).toBeUndefined()
    })

    it('natural consensus takes precedence over selectedVerdict', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      const p2 = room.addParticipant('Bob', 'voter', mockWs(), 'tok-2')
      room.castVote(p1.id, 5)
      room.castVote(p2.id, 5)
      room.reveal('Alice')
      room.selectVerdict(3)
      room.reset('Alice')
      expect(room.history[0].verdictSource).toBe('natural')
      expect(room.history[0].consensus).toBe(5)
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `room.selectVerdict is not a function` and `room.selectedVerdict` undefined

- [ ] **Step 3: Implement `selectedVerdict` field, `selectVerdict()`, and updated `reset()` in room.ts**

Replace `src/lib/room.ts` with:

```typescript
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
  selectedVerdict: Card | 'NO_CONSENSUS' | undefined
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

  selectVerdict(card: Card | 'NO_CONSENSUS'): void {
    this.selectedVerdict = card
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
      consensus = this.selectedVerdict
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
    this.phase = 'voting'
    this.currentStory = undefined
    this.selectedVerdict = undefined
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests pass including the new selectVerdict and verdictSource tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/room.ts src/__tests__/room.test.ts
git commit -m "feat: add selectVerdict method and verdictSource to RoundResult"
```

---

## Task 3: Update WebSocket Handler

**Files:**
- Modify: `src/ws/handler.ts`

- [ ] **Step 1: Handle `select_verdict` and include `selectedVerdict` in `buildRoomState`**

Replace `src/ws/handler.ts` with:

```typescript
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
    const token = url.searchParams.get('token')

    if (!roomId || !name || !role || !token || !['voter', 'spectator'].includes(role)) {
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

    const existingId = room.tokens.get(token)
    const previousWs = existingId ? room.participants.get(existingId)?.ws ?? null : null

    const reconnected = room.reconnectParticipant(token, ws)
    const participant = reconnected ?? room.addParticipant(name, role, ws, token)

    if (previousWs && previousWs !== ws) {
      previousWs.close(1000, 'replaced by reconnect')
    }

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
          room.setStory(msg.title)
          broadcastRoomStateAll(room)
          break
        }
        case 'select_verdict': {
          if (room.phase !== 'revealed') break
          room.selectVerdict(msg.card)
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
    selectedVerdict: room.selectedVerdict,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/ws/handler.ts
git commit -m "feat: handle select_verdict in WebSocket handler"
```

---

## Task 4: Richer Stats + Verdict Picker in ResultsSummary

**Files:**
- Modify: `src/components/ResultsSummary.tsx`

- [ ] **Step 1: Replace ResultsSummary with richer stats and verdict picker**

Replace the full contents of `src/components/ResultsSummary.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import type { Card, ParticipantSnapshot } from '@/lib/types'

interface Props {
  votes: Record<string, Card>
  participants: ParticipantSnapshot[]
  selectedVerdict?: Card | 'NO_CONSENSUS'
  onSelectVerdict: (v: Card | 'NO_CONSENSUS') => void
}

export function ResultsSummary({ votes, participants, selectedVerdict, onSelectVerdict }: Props) {
  const [picking, setPicking] = useState(false)

  const voterIds = participants.filter(p => p.role === 'voter').map(p => p.id)
  const allVoterCards = voterIds.map(id => votes[id]).filter((c): c is Card => c !== undefined)
  const numeric = allVoterCards.filter((c): c is number => typeof c === 'number')

  const avg = numeric.length > 0
    ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1)
    : '—'

  let median = '—'
  if (numeric.length > 0) {
    const sorted = [...numeric].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const medianVal = sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
    median = medianVal.toFixed(1)
  }

  const min = numeric.length > 0 ? String(Math.min(...numeric)) : '—'
  const max = numeric.length > 0 ? String(Math.max(...numeric)) : '—'

  let mostVoted = '—'
  if (allVoterCards.length > 0) {
    const freq = new Map<string, number>()
    for (const c of allVoterCards) {
      const k = String(c)
      freq.set(k, (freq.get(k) ?? 0) + 1)
    }
    const maxCount = Math.max(...freq.values())
    const winners = [...freq.entries()].filter(([, n]) => n === maxCount).map(([k]) => k)
    mostVoted = winners.join(' / ')
  }

  const naturalConsensus =
    allVoterCards.length === voterIds.length && voterIds.length > 0 && new Set(allVoterCards.map(String)).size === 1
      ? allVoterCards[0]
      : undefined

  const uniqueVotedValues = [...new Map(allVoterCards.map(c => [String(c), c])).values()]

  const showPicker = selectedVerdict === undefined || picking

  return (
    <div className="bg-sky-50 dark:bg-gray-800 border border-sky-200 dark:border-transparent rounded-xl px-4 py-3 text-sm">
      <div className="flex items-center gap-6 flex-wrap">
        <span className="text-sky-600 dark:text-gray-400">Avg: <strong className="text-slate-900 dark:text-white">{avg}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Median: <strong className="text-slate-900 dark:text-white">{median}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Min: <strong className="text-slate-900 dark:text-white">{min}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Max: <strong className="text-slate-900 dark:text-white">{max}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Most Voted: <strong className="text-slate-900 dark:text-white">{mostVoted}</strong></span>
        {naturalConsensus !== undefined && (
          <span className="text-emerald-600 dark:text-green-400 font-semibold ml-auto">
            🎉 Consensus: {String(naturalConsensus)}
          </span>
        )}
      </div>

      {naturalConsensus === undefined && (
        <div className="mt-3 pt-3 border-t border-sky-200 dark:border-gray-700">
          {showPicker ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-sky-600 dark:text-gray-400">Pick verdict:</span>
              {uniqueVotedValues.map(v => (
                <button
                  key={String(v)}
                  onClick={() => { onSelectVerdict(v); setPicking(false) }}
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 dark:bg-gray-700 text-sky-700 dark:text-gray-200 hover:bg-sky-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {String(v)}
                </button>
              ))}
              <button
                onClick={() => { onSelectVerdict('NO_CONSENSUS'); setPicking(false) }}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
              >
                No consensus
              </button>
            </div>
          ) : selectedVerdict === 'NO_CONSENSUS' ? (
            <button
              onClick={() => setPicking(true)}
              className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
            >
              ✗ No consensus
            </button>
          ) : (
            <button
              onClick={() => setPicking(true)}
              className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
            >
              ✓ Verdict: {String(selectedVerdict)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ResultsSummary.tsx
git commit -m "feat: add Median/Most Voted stats and verdict picker to ResultsSummary"
```

---

## Task 5: VotingHistory Icons

**Files:**
- Modify: `src/components/VotingHistory.tsx`

- [ ] **Step 1: Add `verdictSource`-based icon prefix to each history row**

Replace the full contents of `src/components/VotingHistory.tsx` with:

```tsx
import type { RoundResult } from '@/lib/types'

interface Props {
  history: RoundResult[]
  participantNames: Record<string, string>
}

function verdictIcon(round: RoundResult): string {
  if (round.verdictSource === 'natural') return '🎉'
  if (round.verdictSource === 'selected') return '✓'
  if (round.verdictSource === 'none') return '✗'
  // backward compat: old entries have no verdictSource
  return round.consensus !== undefined ? '🎉' : '✗'
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
            <span className="text-slate-700 dark:text-gray-300 truncate">
              {verdictIcon(round)}{' '}
              {round.story ?? <em className="text-slate-400 dark:text-gray-500">Untitled</em>}
            </span>
            <span className="shrink-0 text-right">
              {round.consensus !== undefined ? (
                <span className="text-emerald-600 dark:text-green-400 font-semibold">→ {String(round.consensus)}</span>
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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/VotingHistory.tsx
git commit -m "feat: add verdict icon prefix to VotingHistory rows"
```

---

## Task 6: ParticipantGrid Self-Highlight

**Files:**
- Modify: `src/components/ParticipantGrid.tsx`

- [ ] **Step 1: Add `yourId` prop and apply ring + bold-name highlight to the current user's card**

Replace the full contents of `src/components/ParticipantGrid.tsx` with:

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
        {participants.map((p, i) => (
          <div key={p.id} className="flex flex-col items-center gap-1.5">
            <CardFace p={p} phase={phase} votes={votes} isYou={p.id === yourId} />
            <span className={`text-xs max-w-[52px] truncate text-center leading-tight px-1.5 py-0.5 rounded-full dark:px-0 dark:py-0 dark:rounded-none dark:bg-transparent dark:text-gray-400 ${BADGE_COLORS[i % BADGE_COLORS.length]} ${p.id === yourId ? 'font-semibold' : ''}`}>
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
  isYou,
}: {
  p: ParticipantSnapshot
  phase: 'voting' | 'revealed'
  votes?: Record<string, Card>
  isYou: boolean
}) {
  const ringClass = isYou ? 'ring-2 ring-sky-400 dark:ring-indigo-400' : ''

  if (p.role === 'spectator') {
    return (
      <div className={`w-12 h-16 rounded-lg bg-sky-50 dark:bg-gray-800 border border-dashed border-sky-300 dark:border-gray-600 flex items-center justify-center text-sky-400 dark:text-gray-500 text-lg ${ringClass}`}>
        👁
      </div>
    )
  }

  if (phase === 'revealed' && votes) {
    const card = votes[p.id]
    return (
      <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center font-bold text-base ${ringClass} ${
        card !== undefined
          ? 'bg-sky-100 dark:bg-green-800 border-sky-400 dark:border-green-500 text-sky-800 dark:text-white'
          : 'bg-sky-50 dark:bg-gray-800 border-sky-200 dark:border-gray-600 text-slate-400 dark:text-gray-500'
      }`}>
        {card !== undefined ? String(card) : '—'}
      </div>
    )
  }

  return (
    <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-lg ${ringClass} ${
      p.hasVoted
        ? 'bg-sky-100 dark:bg-green-900 border-sky-400 dark:border-green-600 text-sky-700 dark:text-green-300'
        : 'bg-sky-50 dark:bg-gray-800 border-dashed border-sky-200 dark:border-gray-600 text-slate-300 dark:text-gray-600'
    }`}>
      {p.hasVoted ? '✓' : '…'}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ParticipantGrid.tsx
git commit -m "feat: highlight current user's card in ParticipantGrid"
```

---

## Task 7: Wire Up RoomClient

**Files:**
- Modify: `src/app/room/[id]/RoomClient.tsx`

- [ ] **Step 1: Add `selectedVerdict` to `RoomState`, add `handleSelectVerdict`, and pass new props to components**

Replace the full contents of `src/app/room/[id]/RoomClient.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ServerMessage,
  Card,
  DeckType,
  ParticipantSnapshot,
  RoundResult,
  EventLogEntry,
} from "@/lib/types";
import { getCards } from "@/lib/decks";
import {
  getStoredIdentity,
  getOrCreateParticipantToken,
} from "@/lib/storedIdentity";
import { CardPicker } from "@/components/CardPicker";
import { ParticipantGrid } from "@/components/ParticipantGrid";
import { ResultsSummary } from "@/components/ResultsSummary";
import { VotingHistory } from "@/components/VotingHistory";
import { EventLog } from "@/components/EventLog";
import { ThemeToggle } from "@/components/ThemeToggle";

interface RoomState {
  phase: "voting" | "revealed";
  deck: DeckType;
  customCards?: Card[];
  currentStory?: string;
  participants: ParticipantSnapshot[];
  votes?: Record<string, Card>;
  history: RoundResult[];
  hostOnlyReveal: boolean;
  eventLog: EventLogEntry[];
  yourId: string;
  selectedVerdict?: Card | "NO_CONSENSUS";
}

export function RoomClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [myVote, setMyVote] = useState<Card | undefined>();
  const myVoteRef = useRef<Card | undefined>(undefined);
  myVoteRef.current = myVote;
  const [story, setStory] = useState("");
  const [editingStory, setEditingStory] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const identity = getStoredIdentity(roomId);
    if (!identity || !sessionStorage.getItem(`active-${roomId}`)) {
      router.replace(`/join/${roomId}`);
      return;
    }
    const { name, role } = identity;
    const token = getOrCreateParticipantToken(roomId);

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      let voteRestored = false;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        `${proto}://${window.location.host}/ws?roomId=${roomId}&name=${encodeURIComponent(name)}&role=${role}&token=${token}`,
      );
      wsRef.current = ws;

      ws.onmessage = (event: MessageEvent) => {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === "room_state") {
          if (
            !voteRestored &&
            msg.phase === "voting" &&
            myVoteRef.current !== undefined
          ) {
            voteRestored = true;
            ws.send(JSON.stringify({ type: "vote", card: myVoteRef.current }));
          }
          setRoomState(msg);
          setStory(msg.currentStory ?? "");
          if (msg.phase === "revealed" && msg.votes) {
            setMyVote(msg.votes[msg.yourId]);
          }
        } else if (msg.type === "round_reset") {
          setMyVote(undefined);
        }
      };

      ws.onclose = (e) => {
        if (e.code === 1008 && e.reason === "Room not found") {
          router.replace("/");
          return;
        }
        if (!closed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [roomId, router]);

  function sendMsg(msg: object) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function handleVote(card: Card) {
    setMyVote(card);
    sendMsg({ type: "vote", card });
  }

  function handleReveal() {
    sendMsg({ type: "reveal" });
  }

  function handleReset() {
    setMyVote(undefined);
    sendMsg({ type: "reset" });
  }

  function handleSetStory() {
    sendMsg({ type: "set_story", title: story });
    setEditingStory(false);
  }

  function handleSelectVerdict(v: Card | "NO_CONSENSUS") {
    sendMsg({ type: "select_verdict", card: v });
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!roomState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400 dark:text-gray-400 animate-pulse">
          Connecting…
        </p>
      </div>
    );
  }

  const me = roomState.participants.find((p) => p.id === roomState.yourId);
  const isHost = me?.isHost ?? false;
  const isSpectator = me?.role === "spectator";
  const cards = getCards(roomState.deck, roomState.customCards);
  const participantNames = Object.fromEntries(
    roomState.participants.map((p) => [p.id, p.name]),
  );

  return (
    <div className="min-h-screen text-slate-900 dark:text-white">
      <header className="border-b border-sky-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-6 py-3 flex items-center justify-between">
        <a
          href="/"
          className="font-bold text-lg text-slate-800 dark:text-white hover:text-sky-500 dark:hover:text-indigo-400 transition-colors"
        >
          🃏 ScrumPokr
        </a>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-sky-600 dark:text-gray-400">
            Room:{" "}
            <span className="text-slate-900 dark:text-white font-mono">
              {roomId}
            </span>
          </span>
          <span className="text-slate-400 dark:text-gray-500 hidden sm:inline">
            ·
          </span>
          <span className="text-slate-500 dark:text-gray-400 hidden sm:inline">
            Joined as:{" "}
            <span className="text-slate-800 dark:text-white font-medium">
              {me?.name}
            </span>
          </span>
          <button
            onClick={copyLink}
            className="px-3 py-1 bg-white dark:bg-gray-800 hover:bg-sky-50 dark:hover:bg-gray-700 rounded-md border border-sky-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 transition-colors text-xs"
          >
            {copied ? "✓ Copied!" : "📋 Copy invite link"}
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 p-4">
          <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-2">
            Current Story
          </p>
          {editingStory ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={story}
                onChange={(e) => setStory(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetStory()}
                placeholder="e.g. As a user, I can reset my password"
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-sky-300 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-indigo-500"
              />
              <button
                onClick={handleSetStory}
                className="px-3 py-2 bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingStory(false);
                  setStory(roomState.currentStory ?? "");
                }}
                className="px-3 py-2 bg-sky-50 dark:bg-gray-800 hover:bg-sky-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-slate-600 dark:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p
                className={`text-sm ${roomState.currentStory ? "text-slate-800 dark:text-white" : "text-slate-400 dark:text-gray-500 italic"}`}
              >
                {roomState.currentStory ?? "No story set"}
              </p>
              <button
                onClick={() => setEditingStory(true)}
                className="text-xs text-sky-500 dark:text-indigo-400 hover:text-sky-600 dark:hover:text-indigo-300 shrink-0 transition-colors"
              >
                {roomState.currentStory ? "Edit" : "+ Set story"}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 p-4">
          <ParticipantGrid
            participants={roomState.participants}
            votes={roomState.votes}
            phase={roomState.phase}
            yourId={roomState.yourId}
          />
        </div>

        {roomState.phase === "revealed" && roomState.votes && (
          <ResultsSummary
            votes={roomState.votes}
            participants={roomState.participants}
            selectedVerdict={roomState.selectedVerdict}
            onSelectVerdict={handleSelectVerdict}
          />
        )}

        {!isSpectator && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 p-4">
            <CardPicker
              cards={cards}
              selected={myVote}
              disabled={roomState.phase === "revealed"}
              onSelect={handleVote}
            />
          </div>
        )}

        {(!roomState.hostOnlyReveal || isHost) && (
          <div>
            {roomState.phase === "voting" ? (
              <button
                onClick={handleReveal}
                className="w-full py-3 bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
              >
                Reveal Cards
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="w-full py-3 bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
              >
                Next Round
              </button>
            )}
          </div>
        )}

        {roomState.history.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 p-4">
            <VotingHistory
              history={roomState.history}
              participantNames={participantNames}
            />
          </div>
        )}

        <EventLog entries={roomState.eventLog} />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/room/[id]/RoomClient.tsx
git commit -m "feat: wire selectedVerdict and yourId through RoomClient"
```

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|-----------------|------|
| Verdict picker appears only when no natural consensus | Task 4 — `naturalConsensus === undefined` guard |
| Natural consensus shows `🎉 Consensus: X` instead of picker | Task 4 — early return with existing display |
| "Pick verdict:" label + pill per unique voted value | Task 4 — picker render branch |
| "No consensus" pill | Task 4 — picker render branch |
| Card selected → amber badge, click → returns to picker | Task 4 — badge branch + `setPicking(true)` |
| No consensus selected → muted badge, click → returns to picker | Task 4 — NO_CONSENSUS badge branch |
| `selectedVerdict?: Card \| 'NO_CONSENSUS'` prop on ResultsSummary | Task 4 |
| `onSelectVerdict` prop on ResultsSummary | Task 4 |
| `select_verdict` ClientMessage type | Task 1 |
| `selectedVerdict` in room_state ServerMessage | Task 1 |
| `verdictSource` in RoundResult | Task 1 |
| `Room.selectedVerdict` field | Task 2 |
| `Room.selectVerdict()` method | Task 2 |
| `reset()` verdictSource logic (natural/selected/none) | Task 2 |
| `selectedVerdict` cleared after `reset()` | Task 2 |
| Handler handles `select_verdict`, phase guard | Task 3 |
| `buildRoomState` includes `selectedVerdict` | Task 3 |
| Stats row: Avg → Median → Min → Max → Most Voted | Task 4 |
| Avg: numeric only, 1 decimal | Task 4 |
| Median: numeric only, 1 decimal, average middle two if even | Task 4 |
| Min/Max: numeric only | Task 4 |
| Most Voted: all votes, ties as `3 / 5` | Task 4 |
| All stats show `—` when no applicable votes | Task 4 |
| VotingHistory: 🎉/✓/✗ icon prefix per round | Task 5 |
| VotingHistory backward compat for missing verdictSource | Task 5 |
| ParticipantGrid `yourId` prop | Task 6 |
| Self card: `ring-2 ring-sky-400 dark:ring-indigo-400` | Task 6 |
| Self name: `font-semibold` | Task 6 |
| RoomClient passes `yourId` to ParticipantGrid | Task 7 |
| RoomClient passes `selectedVerdict` + `onSelectVerdict` to ResultsSummary | Task 7 |
| RoomClient sends `select_verdict` message | Task 7 |

All spec requirements are covered. No gaps found.
