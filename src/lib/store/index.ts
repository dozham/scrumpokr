import { InMemoryAdapter } from './memory'
import type { RoomStoreAdapter } from './adapter'

declare global {
  // eslint-disable-next-line no-var
  var __scrumpokrAdapter: RoomStoreAdapter | undefined
}

function createAdapter(): RoomStoreAdapter {
  if (process.env.ROOM_STORE_ADAPTER === 'redis') {
    const url = process.env.REDIS_URL
    if (!url) throw new Error('REDIS_URL is required when ROOM_STORE_ADAPTER=redis')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RedisAdapter } = require('./redis') as { RedisAdapter: new (url: string) => RoomStoreAdapter }
    return new RedisAdapter(url)
  }
  return new InMemoryAdapter()
}

export function getAdapter(): RoomStoreAdapter {
  if (!globalThis.__scrumpokrAdapter) {
    globalThis.__scrumpokrAdapter = createAdapter()
  }
  return globalThis.__scrumpokrAdapter
}

export type { StoredRoomState, RoomStoreAdapter } from './adapter'
