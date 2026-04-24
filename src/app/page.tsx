'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DeckType, Card } from '@/lib/types'
import { DECK_LABELS } from '@/lib/decks'
import { setStoredIdentity, getOrCreateParticipantToken } from '@/lib/storedIdentity'
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
      getOrCreateParticipantToken(roomId)
      sessionStorage.setItem(`active-${roomId}`, '1')
      router.push(`/room/${roomId}`)
    } catch {
      setError('Failed to create room. Try again.')
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
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
