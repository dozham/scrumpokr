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
      <p className="text-xs font-medium text-[#2a2380]/70 uppercase tracking-wider mb-3">Your Vote</p>
      <div className="flex flex-wrap gap-2">
        {cards.map(card => (
          <button
            key={String(card)}
            onClick={() => !disabled && onSelect(card)}
            disabled={disabled}
            className={`w-12 h-16 rounded-lg text-sm font-bold border-2 transition-all ${
              selected !== undefined && String(selected) === String(card)
                ? 'bg-[#ea2a84] text-white border-[#ea2a84] text-white scale-105 shadow-lg shadow-[#ea2a84]/50'
                : disabled
                ? 'bg-[#fff8b3] border-[#2a2380] text-[#2a2380]/60 cursor-not-allowed'
                : 'bg-[#fff8b3] border-[#2a2380] text-[#2a2380] hover:border-[#ea2a84] hover:scale-105 cursor-pointer'
            }`}
          >
            {String(card)}
          </button>
        ))}
      </div>
    </div>
  )
}
