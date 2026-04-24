import { nanoid } from 'nanoid'
import type { WebSocket } from 'ws'
import type { Card, DeckType, Participant, ParticipantSnapshot, RoundResult, EventLogEntry } from './types'

export class Room {
  readonly id: string
  readonly deck: DeckType
  readonly customCards?: Card[]
  readonly hostOnlyReveal: boolean
  phase: 'voting' | 'revealed' = 'voting'
  currentStory?: string
  votes = new Map<string, Card>()
  participants = new Map<string, Participant>()
  tokens = new Map<string, string>()
  history: RoundResult[] = []
  eventLog: EventLogEntry[] = []
  readonly createdAt: number
  lastActivityAt: number

  constructor(deck: DeckType, customCards?: Card[], hostOnlyReveal = false) {
    this.id = nanoid(8)
    this.deck = deck
    this.customCards = customCards
    this.hostOnlyReveal = hostOnlyReveal
    this.createdAt = Date.now()
    this.lastActivityAt = Date.now()
  }

  addParticipant(name: string, role: 'voter' | 'spectator', ws: WebSocket, token: string): Participant {
    const participant: Participant = {
      id: nanoid(8),
      name,
      role,
      isHost: role === 'voter' && !this.hasHost(),
      ws,
      token,
    }
    this.participants.set(participant.id, participant)
    this.tokens.set(token, participant.id)
    this.lastActivityAt = Date.now()
    return participant
  }

  reconnectParticipant(token: string, ws: WebSocket): Participant | null {
    const participantId = this.tokens.get(token)
    if (!participantId) return null
    const participant = this.participants.get(participantId)
    if (!participant) return null
    participant.ws = ws
    this.lastActivityAt = Date.now()
    return participant
  }

  removeParticipant(id: string): void {
    const p = this.participants.get(id)
    this.participants.delete(id)
    this.votes.delete(id)
    if (p) this.tokens.delete(p.token)
    this.lastActivityAt = Date.now()
    if (p?.isHost) this.promoteNextHost()
  }

  castVote(participantId: string, card: Card): void {
    const p = this.participants.get(participantId)
    if (!p || p.role !== 'voter' || this.phase !== 'voting') return
    this.votes.set(participantId, card)
    this.lastActivityAt = Date.now()
  }

  reveal(actorName: string): void {
    this.phase = 'revealed'
    this.eventLog.push({ type: 'revealed', actorName, timestamp: Date.now() })
    this.lastActivityAt = Date.now()
  }

  reset(actorName: string): void {
    if (this.phase !== 'revealed') return
    const votesObj: Record<string, Card> = Object.fromEntries(this.votes)
    this.history.push({
      story: this.currentStory,
      votes: votesObj,
      consensus: this.computeConsensus(),
      timestamp: Date.now(),
    })
    this.eventLog.push({ type: 'reset', actorName, timestamp: Date.now() })
    this.votes.clear()
    this.phase = 'voting'
    this.currentStory = undefined
    this.lastActivityAt = Date.now()
  }

  setStory(title: string): void {
    this.currentStory = title
    this.lastActivityAt = Date.now()
  }

  toParticipantSnapshots(): ParticipantSnapshot[] {
    return Array.from(this.participants.values()).map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      isHost: p.isHost,
      hasVoted: this.votes.has(p.id),
    }))
  }

  private computeConsensus(): Card | undefined {
    const voters = Array.from(this.participants.values()).filter(p => p.role === 'voter')
    if (voters.length === 0) return undefined
    const cards = voters.map(v => this.votes.get(v.id)).filter((c): c is Card => c !== undefined)
    if (cards.length !== voters.length) return undefined
    return new Set(cards.map(String)).size === 1 ? cards[0] : undefined
  }

  private hasHost(): boolean {
    return Array.from(this.participants.values()).some(p => p.isHost)
  }

  private promoteNextHost(): void {
    const next = Array.from(this.participants.values()).find(p => p.role === 'voter')
    if (next) next.isHost = true
  }
}
