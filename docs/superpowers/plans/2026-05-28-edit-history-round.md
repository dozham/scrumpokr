# Edit History Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any participant to edit the story title and verdict of any past round directly from the voting history list.

**Architecture:** A new `edit_round` client message triggers `room.editRound()`, which mutates the history entry in place and broadcasts the updated room state to all participants. The `VotingHistory` component gains inline edit mode (pencil icon → form row) and an `onEditRound` callback prop wired up in `RoomClient`.

**Tech Stack:** TypeScript, React (Next.js App Router client component), WebSocket (ws library), Vitest

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/lib/types.ts` | Add `edit_round` to `ClientMessage` |
| Modify | `src/lib/room.ts` | Add `editRound()` method |
| Modify | `src/ws/handler.ts` | Add `case 'edit_round'` |
| Modify | `src/__tests__/room.test.ts` | Tests for `editRound()` |
| Modify | `src/components/VotingHistory.tsx` | Add edit state, form row, pencil button |
| Modify | `src/app/room/[id]/RoomClient.tsx` | Add `handleEditRound`, pass to `VotingHistory` |

---

### Task 1: Extend the `ClientMessage` type

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add `edit_round` to `ClientMessage`**

In `src/lib/types.ts`, append one entry to the `ClientMessage` union (after the existing `select_verdict` line):

```ts
export type ClientMessage =
  | { type: 'vote'; card: Card }
  | { type: 'reveal' }
  | { type: 'reset' }
  | { type: 'set_story'; title: string }
  | { type: 'select_verdict'; card: Card | 'NO_CONSENSUS' }
  | { type: 'edit_round'; index: number; story: string; verdict: Card | 'NO_CONSENSUS' | null }
```

- [ ] **Step 2: Verify the type-checker is happy**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add edit_round to ClientMessage type"
```

---

### Task 2: Add `editRound()` to the `Room` class (TDD)

**Files:**
- Modify: `src/__tests__/room.test.ts`
- Modify: `src/lib/room.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe('editRound', ...)` block at the bottom of `src/__tests__/room.test.ts`, before the closing `})` of the outer `describe('Room', ...)`:

```ts
describe('editRound', () => {
  function roundedRoom() {
    const room = new Room('fibonacci')
    const p1 = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
    const p2 = room.addParticipant('Bob', 'voter', mockWs(), 'tok-2')
    room.setStory('Original')
    room.castVote(p1.id, 3)
    room.castVote(p2.id, 5)
    room.reveal('Alice')
    room.reset('Alice')
    return room
  }

  it('updates the story title of a past round', () => {
    const room = roundedRoom()
    room.editRound(0, 'New Title', null)
    expect(room.history[0].story).toBe('New Title')
  })

  it('clears story when empty string is passed', () => {
    const room = roundedRoom()
    room.editRound(0, '', null)
    expect(room.history[0].story).toBeUndefined()
  })

  it('sets consensus and verdictSource to selected when verdict is a Card', () => {
    const room = roundedRoom()
    room.editRound(0, 'Story', 5)
    expect(room.history[0].consensus).toBe(5)
    expect(room.history[0].verdictSource).toBe('selected')
  })

  it('accepts a custom string verdict', () => {
    const room = roundedRoom()
    room.editRound(0, 'Story', 'M')
    expect(room.history[0].consensus).toBe('M')
    expect(room.history[0].verdictSource).toBe('selected')
  })

  it('clears consensus and sets verdictSource to none when verdict is NO_CONSENSUS', () => {
    const room = roundedRoom()
    room.editRound(0, 'Story', 'NO_CONSENSUS')
    expect(room.history[0].consensus).toBeUndefined()
    expect(room.history[0].verdictSource).toBe('none')
  })

  it('clears consensus and sets verdictSource to none when verdict is null', () => {
    const room = roundedRoom()
    room.editRound(0, 'Story', null)
    expect(room.history[0].consensus).toBeUndefined()
    expect(room.history[0].verdictSource).toBe('none')
  })

  it('is a no-op when index is out of range', () => {
    const room = roundedRoom()
    expect(() => room.editRound(99, 'Story', null)).not.toThrow()
    expect(room.history).toHaveLength(1)
  })

  it('does not affect other history entries', () => {
    const room = roundedRoom()
    // second round
    const p = room.addParticipant('Carol', 'voter', mockWs(), 'tok-3')
    room.castVote(p.id, 8)
    room.reveal('Carol')
    room.reset('Carol')
    room.editRound(0, 'Changed', 3)
    expect(room.history[1].story).toBeUndefined()
    expect(room.history[1].consensus).toBe(8)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/__tests__/room.test.ts
```

Expected: tests in `editRound` fail with `room.editRound is not a function`.

- [ ] **Step 3: Implement `editRound` in `Room`**

Add after the `setStory` method in `src/lib/room.ts`:

```ts
editRound(index: number, story: string, verdict: Card | 'NO_CONSENSUS' | null): void {
  const round = this.history[index]
  if (!round) return
  round.story = story || undefined
  if (verdict !== null && verdict !== 'NO_CONSENSUS') {
    round.consensus = verdict
    round.verdictSource = 'selected'
  } else {
    round.consensus = undefined
    round.verdictSource = 'none'
  }
  this.lastActivityAt = Date.now()
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npx vitest run src/__tests__/room.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/room.test.ts src/lib/room.ts
git commit -m "feat: add editRound() to Room with tests"
```

---

### Task 3: Wire `edit_round` in the WebSocket handler

**Files:**
- Modify: `src/ws/handler.ts`

- [ ] **Step 1: Add the `edit_round` case**

In `src/ws/handler.ts`, add a new `case` after `case 'select_verdict':` inside the `ws.on('message', ...)` switch:

```ts
case 'edit_round': {
  room.editRound(msg.index, msg.story, msg.verdict)
  broadcastRoomStateAll(room)
  break
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ws/handler.ts
git commit -m "feat: handle edit_round message in WebSocket handler"
```

---

### Task 4: Add inline edit UI to `VotingHistory`

**Files:**
- Modify: `src/components/VotingHistory.tsx`

This task rewrites the component to add `"use client"`, edit state, and the form row.

- [ ] **Step 1: Replace `VotingHistory.tsx` with the updated implementation**

Full file content:

```tsx
"use client"

import { useState } from 'react'
import type { RoundResult, Card } from '@/lib/types'

interface Props {
  history: RoundResult[]
  participantNames: Record<string, string>
  onEditRound: (index: number, story: string, verdict: Card | 'NO_CONSENSUS' | null) => void
}

interface EditState {
  story: string
  selectedChip: Card | 'NO_CONSENSUS' | null
  customInput: string
}

function initEditState(round: RoundResult): EditState {
  const votedStrings = Object.values(round.votes).map(String)
  if (round.consensus !== undefined) {
    if (votedStrings.includes(String(round.consensus))) {
      return { story: round.story ?? '', selectedChip: round.consensus, customInput: '' }
    }
    return { story: round.story ?? '', selectedChip: null, customInput: String(round.consensus) }
  }
  return { story: round.story ?? '', selectedChip: 'NO_CONSENSUS', customInput: '' }
}

function verdictIcon(round: RoundResult): string {
  if (round.verdictSource === 'natural') return '🎉'
  if (round.verdictSource === 'selected') return '✓'
  if (round.verdictSource === 'none') return '✗'
  return round.consensus !== undefined ? '🎉' : '✗'
}

export function VotingHistory({ history, participantNames, onEditRound }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editState, setEditState] = useState<EditState>({ story: '', selectedChip: null, customInput: '' })

  if (history.length === 0) return null

  function startEdit(i: number) {
    setEditingIndex(i)
    setEditState(initEditState(history[i]))
  }

  function cancelEdit() {
    setEditingIndex(null)
  }

  function saveEdit(i: number) {
    let verdict: Card | 'NO_CONSENSUS' | null
    if (editState.customInput.trim() !== '') {
      const raw = editState.customInput.trim()
      const num = Number(raw)
      verdict = isNaN(num) ? raw : num
    } else {
      verdict = editState.selectedChip
    }
    onEditRound(i, editState.story, verdict)
    setEditingIndex(null)
  }

  return (
    <div>
      <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-3">
        History ({history.length} {history.length === 1 ? 'round' : 'rounds'})
      </p>
      <div className="space-y-2">
        {[...history].reverse().map((round, reversedI) => {
          const i = history.length - 1 - reversedI
          const uniqueVotedCards = [...new Map(Object.values(round.votes).map(c => [String(c), c])).values()]

          if (editingIndex === i) {
            return (
              <div
                key={i}
                className="bg-sky-50 dark:bg-gray-800 border border-sky-300 dark:border-gray-600 rounded-lg px-4 py-3 space-y-3 text-sm"
              >
                <input
                  autoFocus
                  value={editState.story}
                  onChange={e => setEditState(s => ({ ...s, story: e.target.value }))}
                  onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                  placeholder="Story title"
                  className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-sky-300 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-indigo-500"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-sky-600 dark:text-gray-400">Verdict:</span>
                  {uniqueVotedCards.map(v => {
                    const active = editState.selectedChip === v && editState.customInput === ''
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setEditState(s => ({ ...s, selectedChip: v, customInput: '' }))}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          active
                            ? 'bg-sky-500 dark:bg-indigo-600 text-white'
                            : 'bg-sky-100 dark:bg-gray-700 text-sky-700 dark:text-gray-200 hover:bg-sky-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {String(v)}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setEditState(s => ({ ...s, selectedChip: 'NO_CONSENSUS', customInput: '' }))}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      editState.selectedChip === 'NO_CONSENSUS' && editState.customInput === ''
                        ? 'bg-slate-500 dark:bg-gray-500 text-white'
                        : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    No consensus
                  </button>
                  <input
                    value={editState.customInput}
                    onChange={e => setEditState(s => ({ ...s, customInput: e.target.value, selectedChip: null }))}
                    placeholder="Custom…"
                    className="w-24 px-2 py-0.5 bg-white dark:bg-gray-900 border border-sky-300 dark:border-gray-700 rounded-full text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-3 py-1 text-xs rounded-lg bg-sky-50 dark:bg-gray-700 hover:bg-sky-100 dark:hover:bg-gray-600 text-slate-600 dark:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(i)}
                    className="px-3 py-1 text-xs rounded-lg bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 text-white font-medium transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={i}
              className="bg-sky-50 dark:bg-gray-800 border border-sky-200 dark:border-transparent rounded-lg px-4 py-2.5 flex items-start justify-between gap-4 text-sm"
            >
              <span className="text-slate-700 dark:text-gray-300 truncate">
                {verdictIcon(round)}{' '}
                {round.story ?? <em className="text-slate-400 dark:text-gray-500">Untitled</em>}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                {round.consensus !== undefined ? (
                  <span className="text-emerald-600 dark:text-green-400 font-semibold">
                    → {String(round.consensus)}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-gray-500 text-xs">
                    {Object.entries(round.votes)
                      .map(([id, card]) => `${participantNames[id] ?? 'Unknown'}: ${String(card)}`)
                      .join(', ')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  aria-label="Edit round"
                  className="text-slate-400 dark:text-gray-500 hover:text-sky-500 dark:hover:text-indigo-400 transition-colors"
                >
                  ✏️
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/VotingHistory.tsx
git commit -m "feat: add inline edit form to VotingHistory component"
```

---

### Task 5: Wire `handleEditRound` in `RoomClient`

**Files:**
- Modify: `src/app/room/[id]/RoomClient.tsx`

- [ ] **Step 1: Add `handleEditRound` function**

In `src/app/room/[id]/RoomClient.tsx`, add after `handleSelectVerdict`:

```ts
function handleEditRound(index: number, story: string, verdict: Card | 'NO_CONSENSUS' | null) {
  sendMsg({ type: 'edit_round', index, story, verdict })
}
```

- [ ] **Step 2: Pass `onEditRound` to `VotingHistory`**

Find the existing `<VotingHistory ... />` usage (around line 300) and add the new prop:

```tsx
<VotingHistory
  history={roomState.history}
  participantNames={participantNames}
  onEditRound={handleEditRound}
/>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/room/[id]/RoomClient.tsx
git commit -m "feat: wire edit_round handler into RoomClient"
```

---

### Task 6: Smoke test in the browser

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Create a room and complete a round**

1. Open `http://localhost:3000`, create a room, join as a voter in two tabs.
2. Both tabs vote, reveal, then click **Next Round**.
3. The completed round appears in the history.

- [ ] **Step 3: Edit a past round**

1. Click the ✏️ pencil button on the history row.
2. Change the story title.
3. Pick a verdict chip, then try the custom input field.
4. Click **Save** — verify the row updates immediately in both browser tabs.

- [ ] **Step 4: Verify Cancel**

Click ✏️ again, make changes, then click **Cancel** — row should revert with no change sent.

- [ ] **Step 5: Commit if adjustments were needed; otherwise done**

```bash
git add -p
git commit -m "fix: <describe any adjustments made during smoke test>"
```
