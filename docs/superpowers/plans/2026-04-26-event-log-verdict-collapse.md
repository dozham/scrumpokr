# Event Log: Verdict Display & Collapsible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the round verdict inline with "started a new round" entries, and make the event log collapsible (collapsed by default).

**Architecture:** `EventLog` gains a new `history: RoundResult[]` prop and `'use client'` + `useState` for collapse. Reset events are correlated to history entries by iterating the reversed entry list and counting reset events seen (Nth reset seen in reverse = `history[history.length - 1 - N]`). `RoomClient` passes `history={roomState.history}`.

**Tech Stack:** React 19, Next.js 16 App Router, TypeScript, Tailwind CSS 4, Vitest 4

---

## File Map

| File | Change |
|------|--------|
| `src/components/EventLog.tsx` | Add `'use client'`, `useState` collapse, `history` prop, verdict suffix logic |
| `src/app/room/[id]/RoomClient.tsx` | Pass `history={roomState.history}` to `<EventLog>` |

---

## Task 1: Update EventLog

**Files:**
- Modify: `src/components/EventLog.tsx`

- [ ] **Step 1: Replace the full contents of `src/components/EventLog.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { EventLogEntry, RoundResult } from '@/lib/types'

interface Props {
  entries: EventLogEntry[]
  history: RoundResult[]
}

function verdictSuffix(round: RoundResult): string {
  const { verdictSource, consensus } = round
  if (verdictSource === 'natural' || (verdictSource === undefined && consensus !== undefined)) {
    return ` · 🎉 ${String(consensus)}`
  }
  if (verdictSource === 'selected') {
    return ` · ✓ ${String(consensus)}`
  }
  return ' · ✗ No consensus'
}

export function EventLog({ entries, history }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  if (entries.length === 0) return null

  function formatTimestamp(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Correlate reset events (reversed) to history entries.
  // The Nth reset encountered in reverse = history[history.length - 1 - N].
  const displayEntries: { entry: EventLogEntry; round?: RoundResult }[] = []
  let resetCount = 0
  for (const entry of [...entries].reverse()) {
    if (entry.type === 'reset') {
      const idx = history.length - 1 - resetCount
      displayEntries.push({ entry, round: idx >= 0 ? history[idx] : undefined })
      resetCount++
    } else {
      displayEntries.push({ entry })
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 overflow-hidden">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full px-4 py-3 border-b border-sky-200 dark:border-gray-800 bg-sky-50 dark:bg-gray-800/30 flex items-center justify-between hover:bg-sky-100 dark:hover:bg-gray-800/50 transition-colors"
      >
        <h3 className="text-xs font-bold text-sky-600 dark:text-gray-400 uppercase tracking-wider">
          Event Log ({entries.length})
        </h3>
        <span className="text-sky-400 dark:text-gray-500 text-xs">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && (
        <div className="divide-y divide-sky-100 dark:divide-gray-800 max-h-48 overflow-y-auto">
          {displayEntries.map(({ entry, round }, i) => (
            <div key={i} className="px-4 py-2 flex items-center justify-between gap-4 text-sm">
              <p className="text-slate-500 dark:text-gray-400 truncate">
                {entry.type === 'revealed' ? (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-white">{entry.actorName}</span>
                    {' revealed the votes'}
                  </>
                ) : entry.type === 'reset' ? (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-white">{entry.actorName}</span>
                    {' started a new round'}
                    {round && (
                      <span className="text-slate-400 dark:text-gray-500">{verdictSuffix(round)}</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-white">{entry.actorName}</span>
                    {' performed '}
                    {entry.type}
                  </>
                )}
              </p>
              <time className="text-xs text-slate-400 dark:text-gray-500 tabular-nums shrink-0">
                {formatTimestamp(entry.timestamp)}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 1 error in `RoomClient.tsx` — `history` prop missing (fixed in Task 2), no other errors

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 60/60 pass

- [ ] **Step 4: Commit**

```bash
git add src/components/EventLog.tsx
git commit -m "feat: collapsible event log with verdict inline on reset events"
```

---

## Task 2: Wire history prop in RoomClient

**Files:**
- Modify: `src/app/room/[id]/RoomClient.tsx`

- [ ] **Step 1: Pass `history` to `<EventLog>`**

Find this in `src/app/room/[id]/RoomClient.tsx`:
```tsx
        <EventLog entries={roomState.eventLog} />
```

Replace with:
```tsx
        <EventLog entries={roomState.eventLog} history={roomState.history} />
```

- [ ] **Step 2: Verify TypeScript compiles clean**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 60/60 pass

- [ ] **Step 4: Commit**

```bash
git add src/app/room/[id]/RoomClient.tsx
git commit -m "feat: pass history to EventLog for verdict display"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|-----------------|------|
| Verdict inline with reset event | Task 1 — `verdictSuffix(round)` appended to reset text |
| `verdictSource === 'natural'` → `· 🎉 X` | Task 1 — `verdictSuffix` |
| `verdictSource === 'selected'` → `· ✓ X` | Task 1 — `verdictSuffix` |
| `verdictSource === 'none'` → `· ✗ No consensus` | Task 1 — `verdictSuffix` |
| Backward compat (no `verdictSource`) | Task 1 — `verdictSuffix` fallback |
| Suffix muted color | Task 1 — `text-slate-400 dark:text-gray-500` on suffix span |
| Collapsible, collapsed by default | Task 1 — `useState(false)`, body only shown when `isOpen` |
| Header shows entry count | Task 1 — `Event Log ({entries.length})` |
| Chevron ▶/▼ | Task 1 — conditional icon in button |
| `history: RoundResult[]` new prop | Task 1 |
| `RoomClient` passes `history` | Task 2 |
