import { EventEmitter } from 'events'
import type { RoomStoreAdapter, StoredRoomState } from './adapter'

const ROOM_TTL_MS = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

export class InMemoryAdapter implements RoomStoreAdapter {
  private rooms = new Map<string, StoredRoomState>()
  private emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(200)
  }

  async readRoom(id: string): Promise<StoredRoomState | null> {
    return this.rooms.get(id) ?? null
  }

  async writeRoom(id: string, state: StoredRoomState): Promise<void> {
    this.rooms.set(id, state)
  }

  async deleteRoom(id: string): Promise<void> {
    this.rooms.delete(id)
  }

  async publish(roomId: string, state: StoredRoomState): Promise<void> {
    this.emitter.emit(roomId, state)
  }

  subscribe(roomId: string, cb: (state: StoredRoomState) => void): () => void {
    this.emitter.on(roomId, cb)
    return () => this.emitter.off(roomId, cb)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [id, state] of this.rooms) {
      if (now - state.lastActivityAt > ROOM_TTL_MS) this.rooms.delete(id)
    }
  }

  startCleanup(): void {
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS)
  }
}
