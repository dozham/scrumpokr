import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRoom, getRoom, deleteRoom, startCleanup } from '../lib/registry'

afterEach(() => {
  vi.useRealTimers()
})

describe('registry', () => {
  it('creates a room and retrieves it by id', () => {
    const room = createRoom('fibonacci')
    expect(getRoom(room.id)).toBe(room)
    deleteRoom(room.id)
  })

  it('returns undefined for unknown room id', () => {
    expect(getRoom('no-such-room')).toBeUndefined()
  })

  it('deleteRoom removes the room', () => {
    const room = createRoom('fibonacci')
    deleteRoom(room.id)
    expect(getRoom(room.id)).toBeUndefined()
  })

  it('startCleanup removes rooms idle longer than 24h', () => {
    vi.useFakeTimers()
    const room = createRoom('fibonacci')
    room.lastActivityAt = Date.now() - 25 * 60 * 60 * 1000
    const interval = startCleanup()
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(getRoom(room.id)).toBeUndefined()
    clearInterval(interval)
  })

  it('startCleanup keeps rooms active within 24h', () => {
    vi.useFakeTimers()
    const room = createRoom('fibonacci')
    const interval = startCleanup()
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(getRoom(room.id)).toBe(room)
    clearInterval(interval)
    deleteRoom(room.id)
  })
})
