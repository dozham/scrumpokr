import { describe, it, expect } from 'vitest'
import { getCards } from '../lib/decks'

describe('getCards', () => {
  it('returns fibonacci cards', () => {
    expect(getCards('fibonacci')).toEqual([1, 2, 3, 5, 8, 13, 21, '?', '☕'])
  })

  it('returns powers-of-2 cards', () => {
    expect(getCards('powers-of-2')).toEqual([1, 2, 4, 8, 16, 32, '?'])
  })

  it('returns tshirt cards', () => {
    expect(getCards('tshirt')).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
  })

  it('returns custom cards when provided', () => {
    expect(getCards('custom', [1, 2, 4])).toEqual([1, 2, 4])
  })

  it('throws when custom deck has no cards', () => {
    expect(() => getCards('custom')).toThrow('Custom deck requires customCards')
    expect(() => getCards('custom', [])).toThrow('Custom deck requires customCards')
  })
})
