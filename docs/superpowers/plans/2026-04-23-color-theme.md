# Color Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dark/light theme switching — dark stays as-is, light is a colorful sky-blue palette inspired by Miro.

**Architecture:** Tailwind v4's `@custom-variant dark` directive wires the `dark:` prefix to `data-theme="dark"` on `<html>`. A `ThemeProvider` client component reads `localStorage` on mount and sets that attribute. All components get light-mode classes added alongside their existing dark-mode ones using `dark:` prefix.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, TypeScript. No new dependencies.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/globals.css` | Modify | Register `@custom-variant dark` using `data-theme` attribute |
| `src/components/ThemeProvider.tsx` | Create | Context + localStorage + `data-theme` setter + `useTheme()` hook |
| `src/components/ThemeToggle.tsx` | Create | ☀️/🌙 button that calls `toggleTheme()` |
| `src/app/layout.tsx` | Modify | Static `data-theme="dark"` on `<html>`, wrap children in `<ThemeProvider>` |
| `src/components/CardPicker.tsx` | Modify | Add light-mode classes |
| `src/components/ParticipantGrid.tsx` | Modify | Add light-mode classes + per-participant badge color cycling |
| `src/components/ResultsSummary.tsx` | Modify | Add light-mode classes |
| `src/components/VotingHistory.tsx` | Modify | Add light-mode classes |
| `src/components/EventLog.tsx` | Modify | Add light-mode classes |
| `src/app/page.tsx` | Modify | Add light-mode classes + `<ThemeToggle>` |
| `src/app/join/[id]/JoinForm.tsx` | Modify | Add light-mode classes + `<ThemeToggle>` |
| `src/app/room/[id]/RoomClient.tsx` | Modify | Add light-mode classes + `<ThemeToggle>` in header |

**Color mapping (light → dark equivalent):**
- `bg-sky-50` / `dark:bg-gray-950` — page background
- `bg-white` / `dark:bg-gray-900` — panel / card surface
- `bg-sky-50` / `dark:bg-gray-800` — secondary surface, inputs
- `border-sky-200` / `dark:border-gray-800` — panel borders
- `border-sky-300` / `dark:border-gray-700` — input borders
- `text-slate-900` / `dark:text-white` — primary text
- `text-sky-600` / `dark:text-gray-400` — label / secondary text
- `text-slate-500` / `dark:text-gray-500` — muted text
- `bg-sky-500` / `dark:bg-indigo-600` — accent buttons
- `hover:bg-sky-400` / `dark:hover:bg-indigo-500` — accent hover
- `focus:ring-sky-500` / `dark:focus:ring-indigo-500` — focus ring
- `shadow-sky-200` / `dark:shadow-indigo-900` — card shadows

---

### Task 1: Wire Tailwind dark variant to `data-theme` attribute

**Files:**
- Modify: `src/app/globals.css`

**Context:** Tailwind v4 uses `@custom-variant` (not `@variant`) to override built-in variants. This replaces the default `prefers-color-scheme` media query with an explicit `data-theme="dark"` attribute check. After this change, any `dark:` class only applies when an ancestor element has `data-theme="dark"`.

**Note for AGENTS.md compliance:** Read `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` before making changes.

- [ ] **Step 1: Update globals.css**

Replace the file contents with:

```css
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

- [ ] **Step 2: Verify build still works**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no CSS errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "chore: configure dark variant to use data-theme attribute"
```

---

### Task 2: ThemeProvider component

**Files:**
- Create: `src/components/ThemeProvider.tsx`

**Context:** This is a client component that holds theme state. It reads `localStorage` on mount (SSR-safe because `useEffect` only runs in the browser). It exposes a React context with `theme` and `toggleTheme`. The `<html>` element starts with `data-theme="dark"` (set statically in layout.tsx in Task 4), so new users see the dark theme immediately with zero flash. If they previously chose light, the effect on mount flips the attribute.

No unit tests — this component's behavior is verified visually in Task 11.

- [ ] **Step 1: Create ThemeProvider.tsx**

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: 'dark',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored === 'light') {
      setTheme('light')
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ThemeProvider.tsx
git commit -m "feat: add ThemeProvider with localStorage persistence"
```

---

### Task 3: ThemeToggle component

**Files:**
- Create: `src/components/ThemeToggle.tsx`

**Context:** A small button that renders ☀️ in dark mode and 🌙 in light mode. Uses `useTheme()` from `ThemeProvider`. Must be `'use client'` because it uses the context hook.

- [ ] **Step 1: Create ThemeToggle.tsx**

```tsx
'use client'

import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-1.5 rounded-md text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-sky-100 dark:hover:bg-gray-800 transition-colors text-lg leading-none"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ThemeToggle.tsx
git commit -m "feat: add ThemeToggle button component"
```

---

### Task 4: Integrate ThemeProvider into layout

**Files:**
- Modify: `src/app/layout.tsx`

**Context:** `layout.tsx` is a server component. `ThemeProvider` is a client component — it can wrap server-rendered children without issues (standard Next.js pattern). We set `data-theme="dark"` statically so the initial HTML is always dark, preventing any flash.

- [ ] **Step 1: Update layout.tsx**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ScrumPokr',
  description: 'Real-time planning poker for agile teams',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className={`${inter.className} bg-sky-50 dark:bg-gray-950 text-slate-900 dark:text-white antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Start dev server and verify dark mode still looks correct**

```bash
npm run dev
```

Open http://localhost:3000 — app should look identical to before (dark theme active by default). No visual change yet.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: integrate ThemeProvider into root layout"
```

---

### Task 5: Update CardPicker component

**Files:**
- Modify: `src/components/CardPicker.tsx`

**Context:** The card picker has three visual states: selected, disabled, and default. Each needs light-mode variants. Selected card uses sky-500 in light mode instead of indigo-600.

- [ ] **Step 1: Replace CardPicker.tsx**

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
      <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-3">Your Vote</p>
      <div className="flex flex-wrap gap-2">
        {cards.map(card => (
          <button
            key={String(card)}
            onClick={() => !disabled && onSelect(card)}
            disabled={disabled}
            className={`w-12 h-16 rounded-lg text-sm font-bold border-2 transition-all ${
              selected !== undefined && String(selected) === String(card)
                ? 'bg-sky-500 dark:bg-indigo-600 border-sky-400 dark:border-indigo-400 text-white scale-105 shadow-lg shadow-sky-200 dark:shadow-indigo-900'
                : disabled
                ? 'bg-sky-50 dark:bg-gray-800 border-sky-200 dark:border-gray-700 text-slate-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-white dark:bg-gray-800 border-sky-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:border-sky-500 dark:hover:border-indigo-500 hover:scale-105 cursor-pointer'
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

- [ ] **Step 2: Commit**

```bash
git add src/components/CardPicker.tsx
git commit -m "feat: add light theme to CardPicker"
```

---

### Task 6: Update ParticipantGrid with badge color cycling

**Files:**
- Modify: `src/components/ParticipantGrid.tsx`

**Context:** In light mode, participant name labels become colored pills that cycle through 5 colors (sky, violet, emerald, amber, rose) by index. In dark mode, they revert to plain `text-gray-400` using `dark:` overrides. The card faces (voted/revealed states) also switch to sky-blue tones in light mode.

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
}

export function ParticipantGrid({ participants, votes, phase }: Props) {
  return (
    <div>
      <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-3">
        Participants ({participants.length})
      </p>
      <div className="flex flex-wrap gap-4">
        {participants.map((p, i) => (
          <div key={p.id} className="flex flex-col items-center gap-1.5">
            <CardFace p={p} phase={phase} votes={votes} />
            <span className={`text-xs max-w-[52px] truncate text-center leading-tight px-1.5 py-0.5 rounded-full dark:px-0 dark:py-0 dark:rounded-none dark:bg-transparent dark:text-gray-400 ${BADGE_COLORS[i % BADGE_COLORS.length]}`}>
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
      <div className="w-12 h-16 rounded-lg bg-sky-50 dark:bg-gray-800 border border-dashed border-sky-300 dark:border-gray-600 flex items-center justify-center text-sky-400 dark:text-gray-500 text-lg">
        👁
      </div>
    )
  }

  if (phase === 'revealed' && votes) {
    const card = votes[p.id]
    return (
      <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center font-bold text-base ${
        card !== undefined
          ? 'bg-sky-100 dark:bg-green-800 border-sky-400 dark:border-green-500 text-sky-800 dark:text-white'
          : 'bg-sky-50 dark:bg-gray-800 border-sky-200 dark:border-gray-600 text-slate-400 dark:text-gray-500'
      }`}>
        {card !== undefined ? String(card) : '—'}
      </div>
    )
  }

  return (
    <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-lg ${
      p.hasVoted
        ? 'bg-sky-100 dark:bg-green-900 border-sky-400 dark:border-green-600 text-sky-700 dark:text-green-300'
        : 'bg-sky-50 dark:bg-gray-800 border-dashed border-sky-200 dark:border-gray-600 text-slate-300 dark:text-gray-600'
    }`}>
      {p.hasVoted ? '✓' : '…'}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ParticipantGrid.tsx
git commit -m "feat: add light theme and badge color cycling to ParticipantGrid"
```

---

### Task 7: Update ResultsSummary, VotingHistory, and EventLog

**Files:**
- Modify: `src/components/ResultsSummary.tsx`
- Modify: `src/components/VotingHistory.tsx`
- Modify: `src/components/EventLog.tsx`

**Context:** These are pure display components. ResultsSummary adds a border in light mode since it relies on background contrast. VotingHistory rounds become sky-tinted. EventLog header and dividers switch to sky tones.

- [ ] **Step 1: Replace ResultsSummary.tsx**

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
    <div className="bg-sky-50 dark:bg-gray-800 border border-sky-200 dark:border-transparent rounded-xl px-4 py-3 flex items-center gap-6 text-sm flex-wrap">
      <span className="text-sky-600 dark:text-gray-400">Avg: <strong className="text-slate-900 dark:text-white">{avg}</strong></span>
      <span className="text-sky-600 dark:text-gray-400">Min: <strong className="text-slate-900 dark:text-white">{String(min)}</strong></span>
      <span className="text-sky-600 dark:text-gray-400">Max: <strong className="text-slate-900 dark:text-white">{String(max)}</strong></span>
      {consensus !== undefined && (
        <span className="text-emerald-600 dark:text-green-400 font-semibold ml-auto">
           🎉 Consensus: {String(consensus)}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace VotingHistory.tsx**

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

- [ ] **Step 3: Replace EventLog.tsx**

```tsx
import type { EventLogEntry } from '@/lib/types'

interface Props {
  entries: EventLogEntry[]
}

export function EventLog({ entries }: Props) {
  if (entries.length === 0) return null

  function formatTimestamp(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function getEntryText(entry: EventLogEntry) {
    switch (entry.type) {
      case 'revealed':
        return <><span className="font-semibold text-slate-900 dark:text-white">{entry.actorName}</span> revealed the votes</>
      case 'reset':
        return <><span className="font-semibold text-slate-900 dark:text-white">{entry.actorName}</span> started a new round</>
      default:
        return <><span className="font-semibold text-slate-900 dark:text-white">{entry.actorName}</span> performed {entry.type}</>
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-sky-200 dark:border-gray-800 bg-sky-50 dark:bg-gray-800/30">
        <h3 className="text-xs font-bold text-sky-600 dark:text-gray-400 uppercase tracking-wider">Event Log</h3>
      </div>
      <div className="divide-y divide-sky-100 dark:divide-gray-800 max-h-48 overflow-y-auto">
        {[...entries].reverse().map((entry, i) => (
          <div key={i} className="px-4 py-2 flex items-center justify-between gap-4 text-sm">
            <p className="text-slate-500 dark:text-gray-400 truncate">
              {getEntryText(entry)}
            </p>
            <time className="text-xs text-slate-400 dark:text-gray-500 tabular-nums shrink-0">
              {formatTimestamp(entry.timestamp)}
            </time>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ResultsSummary.tsx src/components/VotingHistory.tsx src/components/EventLog.tsx
git commit -m "feat: add light theme to ResultsSummary, VotingHistory, EventLog"
```

---

### Task 8: Update home page (page.tsx)

**Files:**
- Modify: `src/app/page.tsx`

**Context:** The home page has no header bar, so `ThemeToggle` is placed `fixed top-3 right-4`. All `indigo-` accents become `sky-` in light mode.

- [ ] **Step 1: Replace page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DeckType, Card } from '@/lib/types'
import { DECK_LABELS } from '@/lib/decks'
import { setStoredIdentity } from '@/lib/storedIdentity'
import { getRandomName } from '@/lib/names'
import { ThemeToggle } from '@/components/ThemeToggle'

const DECKS: DeckType[] = ['fibonacci', 'powers-of-2', 'tshirt', 'custom']

export default function HomePage() {
  const router = useRouter()
  const [deck, setDeck] = useState<DeckType>('fibonacci')
  const [customCards, setCustomCards] = useState('')
  const [hostName, setHostName] = useState('')
  const [hostOnlyReveal, setHostOnlyReveal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  function handleRandomName() {
    setHostName(getRandomName())
  }

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
        body: JSON.stringify({ deck, customCards: parsedCustom, hostOnlyReveal }),
      })
      const { roomId } = await res.json()
      setStoredIdentity(roomId, hostName.trim(), 'voter')
      sessionStorage.setItem(`active-${roomId}`, '1')
      router.push(`/room/${roomId}`)
    } catch {
      setError('Failed to create room. Try again.')
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-sky-50 dark:bg-gray-950 px-4">
      <div className="fixed top-3 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-sky-200 dark:border-gray-800">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">🃏 ScrumPokr</h1>
        <p className="text-slate-500 dark:text-gray-400 mb-8">Real-time planning poker for agile teams.</p>

        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Your name</label>
            <div className="relative">
              <input
                type="text"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                placeholder="e.g. Alice"
                required
                className="w-full pl-3 pr-10 py-2 bg-white dark:bg-gray-800 border border-sky-300 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleRandomName}
                title="Generate random name"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white hover:scale-110 transition-all cursor-pointer text-xl leading-none"
              >
                🎲
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Card deck</label>
            <div className="grid grid-cols-2 gap-2">
              {DECKS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDeck(d)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    deck === d
                      ? 'bg-sky-500 dark:bg-indigo-600 border-sky-400 dark:border-indigo-500 text-white'
                      : 'bg-white dark:bg-gray-800 border-sky-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 hover:border-sky-400 dark:hover:border-gray-500'
                  }`}
                >
                  {DECK_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-sky-50 dark:bg-gray-800/50 p-3 rounded-lg border border-sky-200 dark:border-gray-700/50">
            <input
              type="checkbox"
              id="hostOnlyReveal"
              checked={hostOnlyReveal}
              onChange={e => setHostOnlyReveal(e.target.checked)}
              className="w-4 h-4 rounded border-sky-300 dark:border-gray-700 text-sky-500 dark:text-indigo-600 focus:ring-sky-500 dark:focus:ring-indigo-500 bg-white dark:bg-gray-900"
            />
            <label htmlFor="hostOnlyReveal" className="text-sm font-medium text-slate-700 dark:text-gray-300 cursor-pointer select-none">
              Restrict reveals and resets to host only
            </label>
          </div>

          {deck === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Card values <span className="text-slate-400 dark:text-gray-500">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={customCards}
                onChange={e => setCustomCards(e.target.value)}
                placeholder="e.g. 1, 2, 4, 8, 16"
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-sky-300 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-indigo-500"
              />
            </div>
          )}

          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={creating || !hostName.trim()}
            className="w-full py-3 bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {creating ? 'Creating…' : 'Create Room'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add light theme and ThemeToggle to home page"
```

---

### Task 9: Update JoinForm

**Files:**
- Modify: `src/app/join/[id]/JoinForm.tsx`

**Context:** JoinForm has three screens: loading spinner, welcome-back, and the join form itself. All three need light-mode classes. Like page.tsx, there is no header bar, so `ThemeToggle` is `fixed top-3 right-4`. The welcome-back "Rejoin" button uses the accent color; the secondary button uses a neutral style.

- [ ] **Step 1: Replace JoinForm.tsx**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredIdentity, setStoredIdentity, clearStoredIdentity } from '@/lib/storedIdentity'
import type { StoredIdentity } from '@/lib/storedIdentity'
import { getRandomName } from '@/lib/names'
import { ThemeToggle } from '@/components/ThemeToggle'

interface Props {
  roomId: string
}

export function JoinForm({ roomId }: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState<StoredIdentity | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState<'voter' | 'spectator'>('voter')

  useEffect(() => {
    const identity = getStoredIdentity(roomId)
    setSaved(identity)
    setShowForm(identity === null)
  }, [roomId])

  function handleRejoin() {
    sessionStorage.setItem(`active-${roomId}`, '1')
    router.push(`/room/${roomId}`)
  }

  function handleNewUser() {
    clearStoredIdentity(roomId)
    setSaved(null)
    setShowForm(true)
  }

  function handleRandomName() {
    setName(getRandomName())
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setStoredIdentity(roomId, name.trim(), role)
    sessionStorage.setItem(`active-${roomId}`, '1')
    router.push(`/room/${roomId}`)
  }

  if (!showForm && saved) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-sky-50 dark:bg-gray-950 px-4">
        <div className="fixed top-3 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-sky-200 dark:border-gray-800">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Welcome back!</h1>
          <p className="text-slate-500 dark:text-gray-400 mb-6">
            You previously joined this room as{' '}
            <span className="text-slate-900 dark:text-white font-semibold">{saved.name}</span>{' '}
            ({saved.role}).
          </p>
          <div className="space-y-3">
            <button
              onClick={handleRejoin}
              className="w-full py-3 bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
            >
              Rejoin as {saved.name}
            </button>
            <button
              onClick={handleNewUser}
              className="w-full py-3 bg-sky-50 dark:bg-gray-800 hover:bg-sky-100 dark:hover:bg-gray-700 border border-sky-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 font-medium rounded-lg transition-colors"
            >
              Join as someone new
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 text-sm transition-colors"
            >
              ← Create a room
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (!showForm) {
    return (
      <div className="min-h-screen bg-sky-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-slate-400 dark:text-gray-400 animate-pulse">Loading…</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-sky-50 dark:bg-gray-950 px-4">
      <div className="fixed top-3 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-sky-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Join Room</h1>
        <p className="text-slate-500 dark:text-gray-400 mb-6">You've been invited to a planning poker session.</p>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Your name</label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Bob"
                required
                autoFocus
                className="w-full pl-3 pr-10 py-2 bg-white dark:bg-gray-800 border border-sky-300 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleRandomName}
                title="Generate random name"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white hover:scale-110 transition-all cursor-pointer text-xl leading-none"
              >
                🎲
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Join as</label>
            <div className="flex gap-2">
              {(['voter', 'spectator'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    role === r
                      ? 'bg-sky-500 dark:bg-indigo-600 border-sky-400 dark:border-indigo-500 text-white'
                      : 'bg-white dark:bg-gray-800 border-sky-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 hover:border-sky-400 dark:hover:border-gray-500'
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
            className="w-full py-3 bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            Join Room
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/join/[id]/JoinForm.tsx
git commit -m "feat: add light theme and ThemeToggle to JoinForm"
```

---

### Task 10: Update RoomClient

**Files:**
- Modify: `src/app/room/[id]/RoomClient.tsx`

**Context:** RoomClient has a proper header bar, so `ThemeToggle` goes alongside the "Copy invite link" button. The "Connecting…" screen also needs the background updated. All panels, inputs, and buttons follow the same light/dark mapping.

- [ ] **Step 1: Replace RoomClient.tsx**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ServerMessage, Card, DeckType, ParticipantSnapshot, RoundResult, EventLogEntry } from '@/lib/types'
import { getCards } from '@/lib/decks'
import { getStoredIdentity } from '@/lib/storedIdentity'
import { CardPicker } from '@/components/CardPicker'
import { ParticipantGrid } from '@/components/ParticipantGrid'
import { ResultsSummary } from '@/components/ResultsSummary'
import { VotingHistory } from '@/components/VotingHistory'
import { EventLog } from '@/components/EventLog'
import { ThemeToggle } from '@/components/ThemeToggle'

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
    const identity = getStoredIdentity(roomId)
    if (!identity || !sessionStorage.getItem(`active-${roomId}`)) {
      router.replace(`/join/${roomId}`)
      return
    }
    const { name, role } = identity

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
        if (msg.phase === 'revealed' && msg.votes) {
          setMyVote(msg.votes[msg.yourId])
        }
      } else if (msg.type === 'round_reset') {
        setMyVote(undefined)
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

  function handleReveal() { sendMsg({ type: 'reveal' }) }

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
      <div className="min-h-screen bg-sky-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-slate-400 dark:text-gray-400 animate-pulse">Connecting…</p>
      </div>
    )
  }

  const me = roomState.participants.find(p => p.id === roomState.yourId)
  const isHost = me?.isHost ?? false
  const isSpectator = me?.role === 'spectator'
  const cards = getCards(roomState.deck, roomState.customCards)
  const participantNames = Object.fromEntries(roomState.participants.map(p => [p.id, p.name]))

  return (
    <div className="min-h-screen bg-sky-50 dark:bg-gray-950 text-slate-900 dark:text-white">
      <header className="border-b border-sky-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-6 py-3 flex items-center justify-between">
        <a href="/" className="font-bold text-lg text-slate-800 dark:text-white hover:text-sky-500 dark:hover:text-indigo-400 transition-colors">🃏 ScrumPokr</a>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-sky-600 dark:text-gray-400">Room: <span className="text-slate-900 dark:text-white font-mono">{roomId}</span></span>
          <button
            onClick={copyLink}
            className="px-3 py-1 bg-white dark:bg-gray-800 hover:bg-sky-50 dark:hover:bg-gray-700 rounded-md border border-sky-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 transition-colors text-xs"
          >
            {copied ? '✓ Copied!' : '📋 Copy invite link'}
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 p-4">
          <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-2">Current Story</p>
          {editingStory && isHost ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={story}
                onChange={e => setStory(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetStory()}
                placeholder="e.g. As a user, I can reset my password"
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-sky-300 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-indigo-500"
              />
              <button onClick={handleSetStory} className="px-3 py-2 bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors">Save</button>
              <button onClick={() => { setEditingStory(false); setStory(roomState.currentStory ?? '') }} className="px-3 py-2 bg-sky-50 dark:bg-gray-800 hover:bg-sky-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-slate-600 dark:text-gray-300 transition-colors">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className={`text-sm ${roomState.currentStory ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-gray-500 italic'}`}>
                {roomState.currentStory ?? 'No story set'}
              </p>
              {isHost && (
                <button onClick={() => setEditingStory(true)} className="text-xs text-sky-500 dark:text-indigo-400 hover:text-sky-600 dark:hover:text-indigo-300 shrink-0 transition-colors">
                  {roomState.currentStory ? 'Edit' : '+ Set story'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 p-4">
          <ParticipantGrid participants={roomState.participants} votes={roomState.votes} phase={roomState.phase} />
        </div>

        {roomState.phase === 'revealed' && roomState.votes && (
          <ResultsSummary votes={roomState.votes} participants={roomState.participants} />
        )}

        {!isSpectator && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 p-4">
            <CardPicker cards={cards} selected={myVote} disabled={roomState.phase === 'revealed'} onSelect={handleVote} />
          </div>
        )}

        {(!roomState.hostOnlyReveal || isHost) && (
          <div>
            {roomState.phase === 'voting' ? (
              <button onClick={handleReveal} className="w-full py-3 bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">Reveal Cards</button>
            ) : (
              <button onClick={handleReset} className="w-full py-3 bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">Next Round</button>
            )}
          </div>
        )}

        {roomState.history.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 p-4">
            <VotingHistory history={roomState.history} participantNames={participantNames} />
          </div>
        )}

        <EventLog entries={roomState.eventLog} />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify the full app builds and runs**

```bash
npm run build 2>&1 | tail -30
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Run the dev server and do a full manual smoke test**

```bash
npm run dev
```

Test checklist:
1. Open http://localhost:3000 — should be dark by default
2. Click ☀️ button — entire page switches to sky-blue light theme
3. Refresh — light theme persists (stored in localStorage)
4. Click 🌙 — switches back to dark
5. Navigate to `/join/[any-id]` — toggle works there too
6. Create a room — room page has toggle in header, all panels in light mode look correct
7. Vote on a card — selected card shows sky-500 in light mode
8. Reveal — green cards in dark, sky-blue cards in light

- [ ] **Step 4: Commit**

```bash
git add src/app/room/[id]/RoomClient.tsx
git commit -m "feat: add light theme and ThemeToggle to RoomClient"
```
