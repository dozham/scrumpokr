# Shared Room Joke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store a shared joke in every room, sync it to all participants via `room_state`, and give `JokeBox` a controlled mode for use in the room page.

**Architecture:** A `fetchJokeForRoom` helper is imported by both the API route (fire-and-forget on room creation) and the WS handler (on `request_joke` message). The joke field flows through the existing `broadcastRoomStateAll` path to every client. `JokeBox` gains optional `joke` + `onRefresh` props; when provided it renders from props instead of fetching internally.

**Tech Stack:** Node.js global `fetch`, TypeScript, React, Tailwind CSS, existing WebSocket message infrastructure (`src/ws/handler.ts`)

---

### Task 1: Add `joke` field to Room and types

**Files:**
- Modify: `src/lib/room.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add `joke` field to `Room` class**

In `src/lib/room.ts`, add one line after `lastActivityAt: number` (line 19):

```ts
  joke: { question: string; answer: string } | null = null
```

The full field-declaration block becomes:

```ts
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
  joke: { question: string; answer: string } | null = null
```

- [ ] **Step 2: Add `joke` to the `room_state` ServerMessage**

In `src/lib/types.ts`, add `joke: { question: string; answer: string } | null` as the last field of the `room_state` variant (after `selectedVerdict?`):

```ts
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
      joke: { question: string; answer: string } | null
    }
  | { type: 'participant_joined'; id: string; name: string; role: 'voter' | 'spectator' }
  | { type: 'vote_cast'; participantId: string }
  | { type: 'votes_revealed'; votes: Record<string, Card> }
  | { type: 'round_reset' }
```

- [ ] **Step 3: Add `request_joke` to `ClientMessage`**

In `src/lib/types.ts`, append one variant to `ClientMessage`:

```ts
export type ClientMessage =
  | { type: 'vote'; card: Card }
  | { type: 'reveal' }
  | { type: 'reset' }
  | { type: 'set_story'; title: string }
  | { type: 'select_verdict'; card: Card | 'NO_CONSENSUS' }
  | { type: 'edit_round'; index: number; story: string; verdict: Card | 'NO_CONSENSUS' | null }
  | { type: 'request_joke' }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: One error in `src/ws/handler.ts` — `buildRoomState` is missing `joke` in its return object. All other files clean. This error is expected and will be fixed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/lib/room.ts src/lib/types.ts
git commit -m "feat: add joke field to Room and message types"
```

---

### Task 2: Create `fetchJokeForRoom` helper

**Files:**
- Create: `src/lib/fetchJoke.ts`

- [ ] **Step 1: Create the file**

```ts
import type { Room } from './room'

export async function fetchJokeForRoom(room: Room): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch('https://teehee.dev/api/joke', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) return
    const data: unknown = await res.json()
    if (
      typeof data !== 'object' ||
      data === null ||
      typeof (data as Record<string, unknown>).question !== 'string' ||
      typeof (data as Record<string, unknown>).answer !== 'string'
    ) return
    room.joke = {
      question: (data as Record<string, unknown>).question as string,
      answer: (data as Record<string, unknown>).answer as string,
    }
  } catch {
    // swallow all errors — joke is optional
  } finally {
    clearTimeout(timeout)
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: Same single error in `buildRoomState` as before (still unfixed). No new errors from the new file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/fetchJoke.ts
git commit -m "feat: add fetchJokeForRoom helper with 3s timeout"
```

---

### Task 3: Wire API route and WS handler

**Files:**
- Modify: `src/app/api/rooms/route.ts`
- Modify: `src/ws/handler.ts`

- [ ] **Step 1: Fire-and-forget fetch on room creation**

In `src/app/api/rooms/route.ts`, add the import at the top (after the existing imports):

```ts
import { fetchJokeForRoom } from '@/lib/fetchJoke'
```

Insert `void fetchJokeForRoom(room)` between `createRoom(...)` and `return`:

```ts
  const room = createRoom(
    deck as DeckType,
    customCards as Card[] | undefined,
    !!hostOnlyReveal
  )
  void fetchJokeForRoom(room)
  return NextResponse.json({ roomId: room.id })
```

- [ ] **Step 2: Add `joke` to `buildRoomState`**

In `src/ws/handler.ts`, update `buildRoomState` to include `joke: room.joke`:

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
    yourId,
    selectedVerdict: room.selectedVerdict,
    joke: room.joke,
  }
}
```

- [ ] **Step 3: Handle `request_joke` message**

In `src/ws/handler.ts`, add the import at the top (after the existing imports):

```ts
import { fetchJokeForRoom } from '@/lib/fetchJoke'
```

Add the new case inside `ws.on('message', ...)` switch, after the `'edit_round'` case:

```ts
        case 'request_joke': {
          fetchJokeForRoom(room).then(() => broadcastRoomStateAll(room)).catch(() => {})
          break
        }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Lint**

Run: `npx eslint src/app/api/rooms/route.ts src/ws/handler.ts`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/rooms/route.ts src/ws/handler.ts
git commit -m "feat: wire joke fetch to room creation and request_joke WS handler"
```

---

### Task 4: Update JokeBox with controlled mode

**Files:**
- Modify: `src/components/JokeBox.tsx`

The controlled mode accepts `joke` and `onRefresh` props. When present, the component renders from props (no internal fetch). Reveal state is tracked by question text so it resets automatically when the joke changes.

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useState, useEffect } from 'react'

type Joke = { question: string; answer: string }

async function loadJoke(signal?: AbortSignal): Promise<Joke> {
  const res = await fetch('https://teehee.dev/api/joke', {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) throw new Error()
  const data = await res.json()
  if (typeof data.question !== 'string' || typeof data.answer !== 'string') throw new Error()
  return { question: data.question, answer: data.answer }
}

interface JokeBoxProps {
  joke?: Joke | null
  onRefresh?: () => void
}

export function JokeBox({ joke: controlledJoke, onRefresh }: JokeBoxProps = {}) {
  const controlled = onRefresh !== undefined

  const [standaloneJoke, setStandaloneJoke] = useState<Joke | null>(null)
  const [standaloneLoading, setStandaloneLoading] = useState(true)
  const [standaloneError, setStandaloneError] = useState(false)
  const [revealedForQuestion, setRevealedForQuestion] = useState<string | null>(null)

  useEffect(() => {
    if (controlled) return
    const controller = new AbortController()
    loadJoke(controller.signal)
      .then(j => setStandaloneJoke(j))
      .catch((e: unknown) => {
        if ((e as { name?: string }).name !== 'AbortError') setStandaloneError(true)
      })
      .finally(() => setStandaloneLoading(false))
    return () => controller.abort()
  }, [controlled])

  async function handleStandaloneRefresh() {
    setStandaloneLoading(true)
    setStandaloneError(false)
    try {
      setStandaloneJoke(await loadJoke())
    } catch {
      setStandaloneError(true)
    } finally {
      setStandaloneLoading(false)
    }
  }

  const joke = controlled ? (controlledJoke ?? null) : standaloneJoke
  const loading = controlled ? false : standaloneLoading
  const error = controlled ? false : standaloneError
  const handleRefresh = controlled ? onRefresh : handleStandaloneRefresh
  const revealed = joke != null && revealedForQuestion === joke.question

  return (
    <div className="w-full p-6 bg-white dark:bg-gray-900 rounded-2xl shadow border border-sky-100 dark:border-gray-800 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-gray-500">Joke&apos;s on me</span>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          title="New joke"
          className="p-1 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 disabled:opacity-40 transition-colors text-base leading-none"
        >
          ↻
        </button>
      </div>
      {loading && (
        <p className="text-sm text-slate-400 dark:text-gray-500 animate-pulse">Loading…</p>
      )}
      {!loading && error && (
        <p className="text-sm text-slate-400 dark:text-gray-500">Couldn&apos;t load a joke. Try refreshing.</p>
      )}
      {!loading && !error && !joke && (
        <p className="text-sm text-slate-400 dark:text-gray-500">No joke loaded yet.</p>
      )}
      {!loading && !error && joke && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed">{joke.question}</p>
          {revealed ? (
            <p className="text-sm text-slate-500 dark:text-gray-400 italic leading-relaxed">{joke.answer}</p>
          ) : (
            <button
              type="button"
              onClick={() => setRevealedForQuestion(joke.question)}
              className="self-start text-xs text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 underline underline-offset-2 transition-colors"
            >
              reveal answer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint and type-check**

Run: `npx eslint src/components/JokeBox.tsx && npx tsc --noEmit && echo "ALL CLEAR"`
Expected: `ALL CLEAR`

- [ ] **Step 3: Commit**

```bash
git add src/components/JokeBox.tsx
git commit -m "feat: add controlled mode to JokeBox"
```

---

### Task 5: Update RoomClient to render shared joke

**Files:**
- Modify: `src/app/room/[id]/RoomClient.tsx`

- [ ] **Step 1: Add `JokeBox` import**

At the top of `src/app/room/[id]/RoomClient.tsx`, add alongside the existing component imports:

```tsx
import { JokeBox } from "@/components/JokeBox";
```

- [ ] **Step 2: Add `joke` to `RoomState` interface**

Update the `RoomState` interface (around line 25) to add `joke` as the last field:

```tsx
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
  joke: { question: string; answer: string } | null;
}
```

- [ ] **Step 3: Add `handleRequestJoke`**

After the `handleEditRound` function (around line 144), add:

```tsx
  function handleRequestJoke() {
    sendMsg({ type: "request_joke" });
  }
```

- [ ] **Step 4: Render JokeBox below EventLog**

In the `<main>` block, the last line before `</main>` is the `<EventLog>` component. Add `<JokeBox>` immediately after it:

```tsx
        <EventLog entries={roomState.eventLog} history={roomState.history} />
        <JokeBox joke={roomState.joke} onRefresh={handleRequestJoke} />
```

- [ ] **Step 5: Lint and type-check**

Run: `npx eslint "src/app/room/[id]/RoomClient.tsx" && npx tsc --noEmit && echo "ALL CLEAR"`
Expected: `ALL CLEAR`

- [ ] **Step 6: Commit**

```bash
git add "src/app/room/[id]/RoomClient.tsx"
git commit -m "feat: render shared joke in room page"
```
