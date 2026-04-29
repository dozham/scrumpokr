import { nanoid } from 'nanoid'
import type { Card, DeckType, ParticipantSnapshot } from './types'
import type { StoredRoomState } from './store/adapter'

export function createRoom(
  id: string,
  deck: DeckType,
  customCards?: Card[],
  hostOnlyReveal = false,
  now = Date.now(),
): StoredRoomState {
  return {
    id,
    deck,
    customCards,
    hostOnlyReveal,
    phase: 'voting',
    votes: {},
    participants: [],
    tokens: {},
    history: [],
    eventLog: [],
    createdAt: now,
    lastActivityAt: now,
  }
}

export function addParticipant(
  state: StoredRoomState,
  name: string,
  role: 'voter' | 'spectator',
  token: string,
): { state: StoredRoomState; id: string } {
  const id = nanoid(8)
  const isHost = role === 'voter' && !state.participants.some(p => p.isHost)
  return {
    state: {
      ...state,
      participants: [...state.participants, { id, name, role, isHost, token }],
      tokens: { ...state.tokens, [token]: id },
      lastActivityAt: Date.now(),
    },
    id,
  }
}

export function reconnectParticipant(
  state: StoredRoomState,
  token: string,
): StoredRoomState | null {
  const participantId = state.tokens[token]
  if (!participantId) return null
  if (!state.participants.some(p => p.id === participantId)) return null
  return { ...state, lastActivityAt: Date.now() }
}

export function removeParticipant(state: StoredRoomState, id: string): StoredRoomState {
  const p = state.participants.find(p => p.id === id)
  if (!p) return state
  let remaining = state.participants.filter(p => p.id !== id)
  if (p.isHost) {
    const next = remaining.find(r => r.role === 'voter')
    if (next) remaining = remaining.map(r => r.id === next.id ? { ...r, isHost: true } : r)
  }
  const newTokens = { ...state.tokens }
  delete newTokens[p.token]
  const newVotes = { ...state.votes }
  delete newVotes[id]
  return { ...state, participants: remaining, tokens: newTokens, votes: newVotes, lastActivityAt: Date.now() }
}

export function castVote(state: StoredRoomState, participantId: string, card: Card): StoredRoomState {
  const p = state.participants.find(p => p.id === participantId)
  if (!p || p.role !== 'voter' || state.phase !== 'voting') return state
  return { ...state, votes: { ...state.votes, [participantId]: card }, lastActivityAt: Date.now() }
}

export function reveal(state: StoredRoomState, actorName: string): StoredRoomState {
  return {
    ...state,
    phase: 'revealed',
    eventLog: [...state.eventLog, { type: 'revealed', actorName, timestamp: Date.now() }],
    lastActivityAt: Date.now(),
  }
}

export function selectVerdict(state: StoredRoomState, card: Card | 'NO_CONSENSUS'): StoredRoomState {
  return { ...state, selectedVerdict: card, lastActivityAt: Date.now() }
}

export function reset(state: StoredRoomState, actorName: string): StoredRoomState {
  if (state.phase !== 'revealed') return state
  const naturalConsensus = computeConsensus(state)
  let consensus: Card | undefined
  let verdictSource: 'natural' | 'selected' | 'none'
  if (naturalConsensus !== undefined) {
    consensus = naturalConsensus
    verdictSource = 'natural'
  } else if (state.selectedVerdict !== undefined && state.selectedVerdict !== 'NO_CONSENSUS') {
    consensus = state.selectedVerdict
    verdictSource = 'selected'
  } else {
    consensus = undefined
    verdictSource = 'none'
  }
  return {
    ...state,
    phase: 'voting',
    votes: {},
    currentStory: undefined,
    selectedVerdict: undefined,
    history: [
      ...state.history,
      { story: state.currentStory, votes: state.votes, consensus, verdictSource, timestamp: Date.now() },
    ],
    eventLog: [...state.eventLog, { type: 'reset', actorName, timestamp: Date.now() }],
    lastActivityAt: Date.now(),
  }
}

export function setStory(state: StoredRoomState, title: string): StoredRoomState {
  return { ...state, currentStory: title, lastActivityAt: Date.now() }
}

export function toParticipantSnapshots(state: StoredRoomState): ParticipantSnapshot[] {
  return state.participants.map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    isHost: p.isHost,
    hasVoted: p.id in state.votes,
  }))
}

function computeConsensus(state: StoredRoomState): Card | undefined {
  const voters = state.participants.filter(p => p.role === 'voter')
  if (voters.length === 0) return undefined
  const cards = voters.map(v => state.votes[v.id]).filter((c): c is Card => c !== undefined)
  if (cards.length !== voters.length) return undefined
  return new Set(cards.map(String)).size === 1 ? cards[0] : undefined
}
