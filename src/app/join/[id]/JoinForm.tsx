'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredIdentity, setStoredIdentity, clearStoredIdentity } from '@/lib/storedIdentity'
import type { StoredIdentity } from '@/lib/storedIdentity'
import { getRandomName } from '@/lib/names'

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
      <main className="min-h-screen flex items-center justify-center bg-[#ffeb00] px-4">
        <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-xl shadow-[#2a2380]/10 border border-[#2a2380]">
          <h1 className="text-2xl font-bold text-[#2a2380] mb-1">Welcome back!</h1>
          <p className="text-[#2a2380]/70 mb-6">
            You previously joined this room as{' '}
            <span className="text-[#2a2380] font-semibold">{saved.name}</span>{' '}
            ({saved.role}).
          </p>
          <div className="space-y-3">
            <button
              onClick={handleRejoin}
              className="w-full py-3 bg-[#ea2a84] text-white hover:bg-[#d42074] text-white font-semibold rounded-lg transition-colors"
            >
              Rejoin as {saved.name}
            </button>
            <button
              onClick={handleNewUser}
              className="w-full py-3 bg-[#fff8b3] hover:bg-[#fff066] border border-[#2a2380] text-[#2a2380]/80 font-medium rounded-lg transition-colors"
            >
              Join as someone new
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 text-[#2a2380]/60 hover:text-[#2a2380]/80 text-sm transition-colors"
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
      <div className="min-h-screen bg-[#ffeb00] flex items-center justify-center">
        <p className="text-[#2a2380]/70 animate-pulse">Loading…</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#ffeb00] px-4">
      <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-xl shadow-[#2a2380]/10 border border-[#2a2380]">
        <h1 className="text-2xl font-bold text-[#2a2380] mb-1">Join Room</h1>
        <p className="text-[#2a2380]/70 mb-6">You've been invited to a planning poker session.</p>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#2a2380]/80 mb-1">Your name</label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Bob"
                required
                autoFocus
                className="w-full pl-3 pr-10 py-2 bg-[#fff8b3] border border-[#2a2380] rounded-lg text-[#2a2380] placeholder-[#2a2380]/50 focus:outline-none focus:ring-2 focus:ring-[#ea2a84]"
              />
              <button
                type="button"
                onClick={handleRandomName}
                title="Generate random name"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#2a2380]/70 hover:text-[#2a2380] hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(241,91,36,0.5)] transition-all cursor-pointer text-xl leading-none"
              >
                🎲
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2a2380]/80 mb-2">Join as</label>
            <div className="flex gap-2">
              {(['voter', 'spectator'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    role === r
                      ? 'bg-[#ea2a84] text-white border-[#ea2a84] text-white'
                      : 'bg-[#fff8b3] border-[#2a2380] text-[#2a2380]/80 hover:border-[#ea2a84]'
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
            className="w-full py-3 bg-[#ea2a84] text-white hover:bg-[#d42074] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            Join Room
          </button>
        </form>
      </div>
    </main>
  )
}
