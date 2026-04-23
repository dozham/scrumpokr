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
      <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-3">Your Vote</p>
      <div className="flex flex-wrap gap-2">
        {cards.map(card => (
          <button
            key={String(card)}
            onClick={() => !disabled && onSelect(card)}
            disabled={disabled}
            className={`w-12 h-16 rounded-lg text-sm font-bold border-2 transition-all ${
              selected !== undefined && String(selected) === String(card)
                ? 'bg-sky-500 dark:bg-indigo-600 border-sky-400 dark:border-indigo-400 text-white scale-105 shadow-lg shadow-sky-200 dark:shadow-indigo-900'
                : disabled
                ? 'bg-sky-50 dark:bg-gray-800 border-sky-200 dark:border-gray-700 text-slate-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-white dark:bg-gray-800 border-sky-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:border-sky-500 dark:hover:border-indigo-500 hover:scale-105 cursor-pointer'
            }`}
          >
            {String(card)}
          </button>
        ))}
      </div>
    </div>
  )
}
