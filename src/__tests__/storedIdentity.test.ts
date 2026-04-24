import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getStoredIdentity, setStoredIdentity, clearStoredIdentity, getOrCreateParticipantToken } from '../lib/storedIdentity'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length
    },
  }
})()

global.localStorage = localStorageMock as any

beforeEach(() => {
  localStorageMock.clear()
})

describe('getStoredIdentity', () => {
  it('returns null when nothing is stored', () => {
    expect(getStoredIdentity('abc')).toBeNull()
  })

  it('returns null when only name is stored', () => {
    localStorage.setItem('name-abc', 'Alice')
    expect(getStoredIdentity('abc')).toBeNull()
  })

  it('returns null when only role is stored', () => {
    localStorage.setItem('role-abc', 'voter')
    expect(getStoredIdentity('abc')).toBeNull()
  })

  it('returns name and role when both are stored', () => {
    localStorage.setItem('name-abc', 'Alice')
    localStorage.setItem('role-abc', 'voter')
    expect(getStoredIdentity('abc')).toEqual({ name: 'Alice', role: 'voter' })
  })

  it('returns spectator role correctly', () => {
    localStorage.setItem('name-abc', 'Bob')
    localStorage.setItem('role-abc', 'spectator')
    expect(getStoredIdentity('abc')).toEqual({ name: 'Bob', role: 'spectator' })
  })
})

describe('setStoredIdentity', () => {
  it('writes name and role to localStorage', () => {
    setStoredIdentity('abc', 'Alice', 'voter')
    expect(localStorage.getItem('name-abc')).toBe('Alice')
    expect(localStorage.getItem('role-abc')).toBe('voter')
  })
})

describe('clearStoredIdentity', () => {
  it('removes both keys', () => {
    localStorage.setItem('name-abc', 'Alice')
    localStorage.setItem('role-abc', 'voter')
    clearStoredIdentity('abc')
    expect(localStorage.getItem('name-abc')).toBeNull()
    expect(localStorage.getItem('role-abc')).toBeNull()
  })

  it('does not throw when keys do not exist', () => {
    expect(() => clearStoredIdentity('abc')).not.toThrow()
  })
})

describe('getOrCreateParticipantToken', () => {
  it('creates and stores a token on first call', () => {
    const token = getOrCreateParticipantToken('abc')
    expect(token).toBeTruthy()
    expect(localStorage.getItem('token-abc')).toBe(token)
  })

  it('returns the same token on subsequent calls', () => {
    const token1 = getOrCreateParticipantToken('abc')
    const token2 = getOrCreateParticipantToken('abc')
    expect(token1).toBe(token2)
  })

  it('returns different tokens for different rooms', () => {
    const t1 = getOrCreateParticipantToken('room-a')
    const t2 = getOrCreateParticipantToken('room-b')
    expect(t1).not.toBe(t2)
  })
})

describe('clearStoredIdentity (token)', () => {
  it('also removes the participant token', () => {
    localStorage.setItem('name-abc', 'Alice')
    localStorage.setItem('role-abc', 'voter')
    localStorage.setItem('token-abc', 'some-token')
    clearStoredIdentity('abc')
    expect(localStorage.getItem('token-abc')).toBeNull()
  })
})
