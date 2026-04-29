import { describe, it, expect, vi, afterEach } from 'vitest'
import { InMemoryAdapter } from '../../lib/store/memory'
import type { StoredRoomState } from '../../lib/store/adapter'

afterEach(() => {
  vi.useRealTimers()
})

function makeState(id: string, lastActivityAt = Date.now()): StoredRoomState {
  return {
    id,
    deck: 'fibonacci',
    hostOnlyReveal: false,
    phase: 'voting',
    votes: {},
    participants: [],
    tokens: {},
    history: [],
    eventLog: [],
    createdAt: lastActivityAt,
    lastActivityAt,
  }
}

describe('InMemoryAdapter', () => {
  it('readRoom returns null for unknown room', async () => {
    const adapter = new InMemoryAdapter()
    expect(await adapter.readRoom('no-such-room')).toBeNull()
  })

  it('writeRoom then readRoom returns the state', async () => {
    const adapter = new InMemoryAdapter()
    const state = makeState('room-1')
    await adapter.writeRoom('room-1', state)
    expect(await adapter.readRoom('room-1')).toEqual(state)
  })

  it('deleteRoom removes the room', async () => {
    const adapter = new InMemoryAdapter()
    const state = makeState('room-1')
    await adapter.writeRoom('room-1', state)
    await adapter.deleteRoom('room-1')
    expect(await adapter.readRoom('room-1')).toBeNull()
  })

  it('subscribe callback is called when publish fires', async () => {
    const adapter = new InMemoryAdapter()
    const state = makeState('room-1')
    const received: StoredRoomState[] = []
    adapter.subscribe('room-1', s => received.push(s))
    await adapter.publish('room-1', state)
    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(state)
  })

  it('unsubscribe stops callbacks', async () => {
    const adapter = new InMemoryAdapter()
    const state = makeState('room-1')
    const received: StoredRoomState[] = []
    const unsub = adapter.subscribe('room-1', s => received.push(s))
    unsub()
    await adapter.publish('room-1', state)
    expect(received).toHaveLength(0)
  })

  it('cleanup removes rooms idle longer than 24h', () => {
    vi.useFakeTimers()
    const adapter = new InMemoryAdapter()
    const old = makeState('old-room', Date.now() - 25 * 60 * 60 * 1000)
    adapter['rooms'].set('old-room', old)
    adapter.cleanup()
    expect(adapter['rooms'].has('old-room')).toBe(false)
  })

  it('cleanup keeps rooms active within 24h', () => {
    vi.useFakeTimers()
    const adapter = new InMemoryAdapter()
    const fresh = makeState('fresh-room', Date.now())
    adapter['rooms'].set('fresh-room', fresh)
    adapter.cleanup()
    expect(adapter['rooms'].has('fresh-room')).toBe(true)
  })
})
