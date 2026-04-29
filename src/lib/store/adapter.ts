import type { Card, DeckType, RoundResult, EventLogEntry, StoredParticipant } from '@/lib/types'

export interface StoredRoomState {
  id: string
  deck: DeckType
  customCards?: Card[]
  hostOnlyReveal: boolean
  phase: 'voting' | 'revealed'
  currentStory?: string
  selectedVerdict?: Card | 'NO_CONSENSUS'
  votes: Record<string, Card>
  participants: StoredParticipant[]
  tokens: Record<string, string>
  history: RoundResult[]
  eventLog: EventLogEntry[]
  createdAt: number
  lastActivityAt: number
}

export interface RoomStoreAdapter {
  readRoom(id: string): Promise<StoredRoomState | null>
  writeRoom(id: string, state: StoredRoomState): Promise<void>
  deleteRoom(id: string): Promise<void>
  publish(roomId: string, state: StoredRoomState): Promise<void>
  subscribe(roomId: string, cb: (state: StoredRoomState) => void): () => void
  startCleanup(): void
}
