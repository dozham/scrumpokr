'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DeckType, Card } from '@/lib/types'
import { DECK_LABELS } from '@/lib/decks'
import { setStoredIdentity } from '@/lib/storedIdentity'

const DECKS: DeckType[] = ['fibonacci', 'powers-of-2', 'tshirt', 'custom']

export default function HomePage() {
  const router = useRouter()
  const [deck, setDeck] = useState<DeckType>('fibonacci')
  const [customCards, setCustomCards] = useState('')
  const [hostName, setHostName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

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
        body: JSON.stringify({ deck, customCards: parsedCustom }),
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
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-2xl shadow-xl border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-1">scrumpokr</h1>
        <p className="text-gray-400 mb-8">Real-time planning poker for agile teams.</p>

        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your name</label>
            <input
              type="text"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              placeholder="e.g. Alice"
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Card deck</label>
            <div className="grid grid-cols-2 gap-2">
              {DECKS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDeck(d)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    deck === d
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {DECK_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {deck === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Card values <span className="text-gray-500">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={customCards}
                onChange={e => setCustomCards(e.target.value)}
                placeholder="e.g. 1, 2, 4, 8, 16"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={creating || !hostName.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {creating ? 'Creating…' : 'Create Room'}
          </button>
        </form>
      </div>
    </main>
  )
}
