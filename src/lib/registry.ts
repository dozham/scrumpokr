import { Room } from './room'
import type { Card, DeckType } from './types'

// Store on globalThis so the Map is shared across Next.js's module isolation boundary.
// Next.js (Turbopack) compiles API routes in a separate module context from the custom
// server.ts, so a plain `const rooms = new Map()` would produce two different Maps.
declare global {
  // eslint-disable-next-line no-var
  var __scrumpokrRooms: Map<string, Room> | undefined
}
const rooms: Map<string, Room> =
  globalThis.__scrumpokrRooms ?? (globalThis.__scrumpokrRooms = new Map())

const ROOM_TTL_MS = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

export function createRoom(deck: DeckType, customCards?: Card[], hostOnlyReveal = false): Room {
  const room = new Room(deck, customCards, hostOnlyReveal)
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
