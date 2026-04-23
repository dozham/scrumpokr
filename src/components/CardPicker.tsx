import type { Card } from '@/lib/types'

interface Props {
  cards: Card[]
  selected?: Card
  disabled?: boolean
  onSelect: (card: Card) => void
}

export function CardPicker({ cards, selected, disabled, onSelect }: Props) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Your Vote</p>
      <div className="flex flex-wrap gap-2">
        {cards.map(card => (
          <button
            key={String(card)}
            onClick={() => !disabled && onSelect(card)}
            disabled={disabled}
            className={`w-12 h-16 rounded-lg text-sm font-bold border-2 transition-all ${
              selected !== undefined && String(selected) === String(card)
                ? 'bg-indigo-600 border-indigo-400 text-white scale-105 shadow-lg shadow-indigo-900'
                : disabled
                ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-800 border-gray-700 text-gray-200 hover:border-indigo-500 hover:scale-105 cursor-pointer'
            }`}
          >
            {String(card)}
          </button>
        ))}
      </div>
    </div>
  )
}
