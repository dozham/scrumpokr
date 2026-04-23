# Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist user name/role in `localStorage` so returning users see a welcome-back screen instead of having to re-enter their details.

**Architecture:** Extract a small `storedIdentity` helper that encapsulates all localStorage reads/writes/clears. `JoinForm` gains a welcome-back screen that renders when a saved identity is found. `RoomClient` switches its read from `sessionStorage` to `localStorage` via the same helper.

**Tech Stack:** React 19, Next.js 16, TypeScript, Vitest (jsdom per-file env for localStorage tests)

---

### Task 1: Extract `storedIdentity` helper and tests

**Files:**
- Create: `src/lib/storedIdentity.ts`
- Create: `src/__tests__/storedIdentity.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/storedIdentity.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { getStoredIdentity, setStoredIdentity, clearStoredIdentity } from '../lib/storedIdentity'

beforeEach(() => localStorage.clear())

describe('getStoredIdentity', () => {
  it('returns null when nothing is stored', () => {
    expect(getStoredIdentity('abc')).toBeNull()
  })

  it('returns null when only name is stored', () => {
    localStorage.setItem('name-abc', 'Alice')
    expect(getStoredIdentity('abc')).toBeNull()
  })

  it('returns null when only role is stored', () => {
    localStorage.setItem('role-abc', 'voter')
    expect(getStoredIdentity('abc')).toBeNull()
  })

  it('returns name and role when both are stored', () => {
    localStorage.setItem('name-abc', 'Alice')
    localStorage.setItem('role-abc', 'voter')
    expect(getStoredIdentity('abc')).toEqual({ name: 'Alice', role: 'voter' })
  })

  it('returns spectator role correctly', () => {
    localStorage.setItem('name-abc', 'Bob')
    localStorage.setItem('role-abc', 'spectator')
    expect(getStoredIdentity('abc')).toEqual({ name: 'Bob', role: 'spectator' })
  })
})

describe('setStoredIdentity', () => {
  it('writes name and role to localStorage', () => {
    setStoredIdentity('abc', 'Alice', 'voter')
    expect(localStorage.getItem('name-abc')).toBe('Alice')
    expect(localStorage.getItem('role-abc')).toBe('voter')
  })
})

describe('clearStoredIdentity', () => {
  it('removes both keys', () => {
    localStorage.setItem('name-abc', 'Alice')
    localStorage.setItem('role-abc', 'voter')
    clearStoredIdentity('abc')
    expect(localStorage.getItem('name-abc')).toBeNull()
    expect(localStorage.getItem('role-abc')).toBeNull()
  })

  it('does not throw when keys do not exist', () => {
    expect(() => clearStoredIdentity('abc')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- storedIdentity
```

Expected: FAIL — `storedIdentity` module not found.

- [ ] **Step 3: Write the helper**

Create `src/lib/storedIdentity.ts`:

```ts
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
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- storedIdentity
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storedIdentity.ts src/__tests__/storedIdentity.test.ts
git commit -m "feat: add storedIdentity helper for localStorage persistence"
```

---

### Task 2: Add welcome-back screen to `JoinForm`

**Files:**
- Modify: `src/app/join/[id]/JoinForm.tsx`

- [ ] **Step 1: Replace the file contents**

The new `JoinForm` checks localStorage on mount. If a saved identity exists it renders the welcome-back screen; otherwise the normal form. On submit it uses `setStoredIdentity` instead of raw `sessionStorage`.

Replace the entire contents of `src/app/join/[id]/JoinForm.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredIdentity, setStoredIdentity, clearStoredIdentity } from '@/lib/storedIdentity'

interface Props {
  roomId: string
}

export function JoinForm({ roomId }: Props) {
  const router = useRouter()
  const saved = getStoredIdentity(roomId)
  const [showForm, setShowForm] = useState(saved === null)
  const [name, setName] = useState('')
  const [role, setRole] = useState<'voter' | 'spectator'>('voter')

  function handleRejoin() {
    router.push(`/room/${roomId}`)
  }

  function handleNewUser() {
    clearStoredIdentity(roomId)
    setShowForm(true)
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setStoredIdentity(roomId, name.trim(), role)
    router.push(`/room/${roomId}`)
  }

  if (!showForm && saved) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-sm p-8 bg-gray-900 rounded-2xl shadow-xl border border-gray-800">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back!</h1>
          <p className="text-gray-400 mb-6">
            You previously joined this room as{' '}
            <span className="text-white font-semibold">{saved.name}</span>{' '}
            ({saved.role}).
          </p>
          <div className="space-y-3">
            <button
              onClick={handleRejoin}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
            >
              Rejoin as {saved.name}
            </button>
            <button
              onClick={handleNewUser}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
            >
              Join as someone new
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              ← Create a room
            </button>
          </div>
        </div>
      </main>
    )
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

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all existing tests PASS (no component tests exist for JoinForm so this is a visual check).

- [ ] **Step 3: Commit**

```bash
git add src/app/join/[id]/JoinForm.tsx
git commit -m "feat: show welcome-back screen when returning to a previously joined room"
```

---

### Task 3: Update `RoomClient` to read from `localStorage`

**Files:**
- Modify: `src/app/room/[id]/RoomClient.tsx`

- [ ] **Step 1: Update the import and localStorage read**

In `src/app/room/[id]/RoomClient.tsx`, replace the top of the `useEffect` (lines 33–38) that reads from `sessionStorage`:

Find:
```ts
    const name = sessionStorage.getItem(`name-${roomId}`)
    const role = sessionStorage.getItem(`role-${roomId}`) as 'voter' | 'spectator' | null
```

Replace with (and add the import at the top of the file):

```ts
import { getStoredIdentity } from '@/lib/storedIdentity'
```

Then in the `useEffect`, replace the two `sessionStorage.getItem` lines and the `if (!name || !role)` block:

```ts
    const identity = getStoredIdentity(roomId)
    if (!identity) {
      router.replace(`/join/${roomId}`)
      return
    }
    const { name, role } = identity
```

The full updated `useEffect` should look like:

```ts
  useEffect(() => {
    const identity = getStoredIdentity(roomId)
    if (!identity) {
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
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/room/[id]/RoomClient.tsx
git commit -m "feat: read stored identity from localStorage in RoomClient"
```
