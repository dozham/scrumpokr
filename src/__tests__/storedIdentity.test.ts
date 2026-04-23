import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getStoredIdentity, setStoredIdentity, clearStoredIdentity } from '../lib/storedIdentity'

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

// @ts-expect-error - Setting mock localStorage
global.localStorage = localStorageMock

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
