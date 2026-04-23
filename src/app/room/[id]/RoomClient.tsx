'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ServerMessage, Card, DeckType, ParticipantSnapshot, RoundResult } from '@/lib/types'
import { getCards } from '@/lib/decks'
import { CardPicker } from '@/components/CardPicker'
import { ParticipantGrid } from '@/components/ParticipantGrid'
import { ResultsSummary } from '@/components/ResultsSummary'
import { VotingHistory } from '@/components/VotingHistory'

interface RoomState {
  phase: 'voting' | 'revealed'
  deck: DeckType
  customCards?: Card[]
  currentStory?: string
  participants: ParticipantSnapshot[]
  votes?: Record<string, Card>
  history: RoundResult[]
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
    const name = sessionStorage.getItem(`name-${roomId}`)
    const role = sessionStorage.getItem(`role-${roomId}`) as 'voter' | 'spectator' | null
    if (!name || !role) {
      router.replace(`/join/${roomId}`)
      return
    }

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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Connecting…</p>
      </div>
    )
  }

  const me = roomState.participants.find(p => p.id === roomState.yourId)
  const isHost = me?.isHost ?? false
  const isSpectator = me?.role === 'spectator'
  const cards = getCards(roomState.deck, roomState.customCards)
  const participantNames = Object.fromEntries(roomState.participants.map(p => [p.id, p.name]))

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <a href="/" className="font-bold text-lg hover:text-indigo-400 transition-colors">scrumpokr</a>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-400">Room: <span className="text-white font-mono">{roomId}</span></span>
          <button
            onClick={copyLink}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 text-gray-300 transition-colors text-xs"
          >
            {copied ? '✓ Copied!' : '📋 Copy invite link'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Current Story</p>
          {editingStory && isHost ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={story}
                onChange={e => setStory(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetStory()}
                placeholder="e.g. As a user, I can reset my password"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={handleSetStory} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors">Save</button>
              <button onClick={() => { setEditingStory(false); setStory(roomState.currentStory ?? '') }} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-300 transition-colors">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className={`text-sm ${roomState.currentStory ? 'text-white' : 'text-gray-500 italic'}`}>
                {roomState.currentStory ?? 'No story set'}
              </p>
              {isHost && (
                <button onClick={() => setEditingStory(true)} className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0 transition-colors">
                  {roomState.currentStory ? 'Edit' : '+ Set story'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <ParticipantGrid participants={roomState.participants} votes={roomState.votes} phase={roomState.phase} />
        </div>

        {roomState.phase === 'revealed' && roomState.votes && (
          <ResultsSummary votes={roomState.votes} participants={roomState.participants} />
        )}

        {!isSpectator && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <CardPicker cards={cards} selected={myVote} disabled={roomState.phase === 'revealed'} onSelect={handleVote} />
          </div>
        )}

        {isHost && (
          <div>
            {roomState.phase === 'voting' ? (
              <button onClick={handleReveal} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">Reveal Cards</button>
            ) : (
              <button onClick={handleReset} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">Next Round</button>
            )}
          </div>
        )}

        {roomState.history.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <VotingHistory history={roomState.history} participantNames={participantNames} />
          </div>
        )}
      </main>
    </div>
  )
}
