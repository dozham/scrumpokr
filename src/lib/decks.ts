import type { Card, DeckType } from './types'

const DECK_VALUES: Record<Exclude<DeckType, 'custom'>, Card[]> = {
  fibonacci: [1, 2, 3, 5, 8, 13, 21, '?', '☕'],
  'powers-of-2': [1, 2, 4, 8, 16, 32, '?'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
}

export function getCards(deck: DeckType, customCards?: Card[]): Card[] {
  if (deck === 'custom') {
    if (!customCards || customCards.length === 0) {
      throw new Error('Custom deck requires customCards')
    }
    return customCards
  }
  return DECK_VALUES[deck]
}

export const DECK_LABELS: Record<DeckType, string> = {
  fibonacci: 'Fibonacci',
  'powers-of-2': 'Powers of 2',
  tshirt: 'T-Shirt Sizes',
  custom: 'Custom',
}
