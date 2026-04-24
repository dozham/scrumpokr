import type { WebSocket } from 'ws'

export type DeckType = 'fibonacci' | 'powers-of-2' | 'tshirt' | 'custom'
export type Card = string | number

export interface Participant {
  id: string
  name: string
  role: 'voter' | 'spectator'
  isHost: boolean
  ws: WebSocket
  token: string
}

export interface ParticipantSnapshot {
  id: string
  name: string
  role: 'voter' | 'spectator'
  isHost: boolean
  hasVoted: boolean
}

export interface RoundResult {
  story?: string
  votes: Record<string, Card>
  consensus?: Card
  timestamp: number
}

export interface EventLogEntry {
  type: 'revealed' | 'reset'
  actorName: string
  timestamp: number
}

export type ClientMessage =
  | { type: 'vote'; card: Card }
  | { type: 'reveal' }
  | { type: 'reset' }
  | { type: 'set_story'; title: string }

export type ServerMessage =
  | {
      type: 'room_state'
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
  | { type: 'participant_joined'; id: string; name: string; role: 'voter' | 'spectator' }
  | { type: 'vote_cast'; participantId: string }
  | { type: 'votes_revealed'; votes: Record<string, Card> }
  | { type: 'round_reset' }
