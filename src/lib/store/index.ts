import { InMemoryAdapter } from './memory'
import type { RoomStoreAdapter } from './adapter'

declare global {
  // eslint-disable-next-line no-var
  var __scrumpokrAdapter: RoomStoreAdapter | undefined
}

export function getAdapter(): RoomStoreAdapter {
  if (!globalThis.__scrumpokrAdapter) {
    globalThis.__scrumpokrAdapter = new InMemoryAdapter()
  }
  return globalThis.__scrumpokrAdapter
}

export type { StoredRoomState, RoomStoreAdapter } from './adapter'
