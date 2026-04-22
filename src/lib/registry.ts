import { Room } from './room'
import type { Card, DeckType } from './types'

const rooms = new Map<string, Room>()

const ROOM_TTL_MS = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

export function createRoom(deck: DeckType, customCards?: Card[]): Room {
  const room = new Room(deck, customCards)
  rooms.set(room.id, room)
  return room
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id)
}

export function deleteRoom(id: string): void {
  rooms.delete(id)
}

export function startCleanup(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const now = Date.now()
    for (const [id, room] of rooms) {
      if (now - room.lastActivityAt > ROOM_TTL_MS) {
        rooms.delete(id)
      }
    }
  }, CLEANUP_INTERVAL_MS)
}
