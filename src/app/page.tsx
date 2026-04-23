'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DeckType, Card } from '@/lib/types'
import { DECK_LABELS } from '@/lib/decks'
import { setStoredIdentity } from '@/lib/storedIdentity'
import { getRandomName } from '@/lib/names'

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
        body: JSON.stringify({
          deck,
          customCards: parsedCustom,
          hostOnlyReveal,
        }),
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
    <main className="min-h-screen flex items-center justify-center bg-[#ffeb00] px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl shadow-[#2a2380]/10 border border-[#2a2380]">
        <h1 className="text-3xl font-bold text-[#2a2380] mb-1">🃏 ScrumPokr</h1>
        <p className="text-[#2a2380]/70 mb-8">Real-time planning poker for agile teams.</p>

        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#2a2380]/80 mb-1">Your name</label>
            <div className="relative">
              <input
                type="text"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                placeholder="e.g. Alice"
                required
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
            <label className="block text-sm font-medium text-[#2a2380]/80 mb-2">Card deck</label>
            <div className="grid grid-cols-2 gap-2">
              {DECKS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDeck(d)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    deck === d
                      ? 'bg-[#ea2a84] text-white border-[#ea2a84] text-white'
                      : 'bg-[#fff8b3] border-[#2a2380] text-[#2a2380]/80 hover:border-[#ea2a84]'
                  }`}
                >
                  {DECK_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#fff8b3]/50 p-3 rounded-lg border border-[#2a2380]/50">
            <input
              type="checkbox"
              id="hostOnlyReveal"
              checked={hostOnlyReveal}
              onChange={e => setHostOnlyReveal(e.target.checked)}
              className="w-4 h-4 rounded border-[#2a2380] text-[#ea2a84] focus:ring-[#ea2a84] bg-white"
            />
            <label htmlFor="hostOnlyReveal" className="text-sm font-medium text-[#2a2380]/80 cursor-pointer select-none">
              Restrict reveals and resets to host only
            </label>
          </div>

          {deck === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-[#2a2380]/80 mb-1">
                Card values <span className="text-[#2a2380]/60">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={customCards}
                onChange={e => setCustomCards(e.target.value)}
                placeholder="e.g. 1, 2, 4, 8, 16"
                className="w-full px-3 py-2 bg-[#fff8b3] border border-[#2a2380] rounded-lg text-[#2a2380] placeholder-[#2a2380]/50 focus:outline-none focus:ring-2 focus:ring-[#ea2a84]"
              />
            </div>
          )}

          {error && <p className="text-[#f15b24] text-sm">{error}</p>}

          <button
            type="submit"
            disabled={creating || !hostName.trim()}
            className="w-full py-3 bg-[#ea2a84] text-white hover:bg-[#d42074] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {creating ? 'Creating…' : 'Create Room'}
          </button>
        </form>
      </div>
    </main>
  )
}
