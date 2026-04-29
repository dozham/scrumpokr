import Redis from 'ioredis'
import type { RoomStoreAdapter, StoredRoomState } from './adapter'

const KEY_PREFIX = 'scrumpokr:room:'
const CHANNEL_PREFIX = 'scrumpokr:room:'
const ROOM_TTL_SECONDS = 24 * 60 * 60

export class RedisAdapter implements RoomStoreAdapter {
  private client: Redis
  private subscriber: Redis
  private subscriptions = new Map<string, Set<(state: StoredRoomState) => void>>()

  constructor(url: string) {
    this.client = new Redis(url, { lazyConnect: false })
    this.subscriber = new Redis(url, { lazyConnect: false })
    this.subscriber.on('message', (channel: string, message: string) => {
      const callbacks = this.subscriptions.get(channel)
      if (!callbacks) return
      const state = JSON.parse(message) as StoredRoomState
      for (const cb of callbacks) cb(state)
    })
  }

  async readRoom(id: string): Promise<StoredRoomState | null> {
    const data = await this.client.get(`${KEY_PREFIX}${id}`)
    if (!data) return null
    return JSON.parse(data) as StoredRoomState
  }

  async writeRoom(id: string, state: StoredRoomState): Promise<void> {
    await this.client.set(`${KEY_PREFIX}${id}`, JSON.stringify(state), 'EX', ROOM_TTL_SECONDS)
  }

  async deleteRoom(id: string): Promise<void> {
    await this.client.del(`${KEY_PREFIX}${id}`)
  }

  async publish(roomId: string, state: StoredRoomState): Promise<void> {
    await this.client.publish(`${CHANNEL_PREFIX}${roomId}`, JSON.stringify(state))
  }

  subscribe(roomId: string, cb: (state: StoredRoomState) => void): () => void {
    const channel = `${CHANNEL_PREFIX}${roomId}`
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set())
      this.subscriber.subscribe(channel)
    }
    this.subscriptions.get(channel)!.add(cb)
    return () => {
      const set = this.subscriptions.get(channel)
      if (!set) return
      set.delete(cb)
      if (set.size === 0) {
        this.subscriptions.delete(channel)
        this.subscriber.unsubscribe(channel)
      }
    }
  }

  startCleanup(): void {
    // Redis TTL on writeRoom handles expiry; no polling needed
  }
}
