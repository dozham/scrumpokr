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
