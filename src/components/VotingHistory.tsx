import type { RoundResult } from '@/lib/types'

interface Props {
  history: RoundResult[]
  participantNames: Record<string, string>
}

export function VotingHistory({ history, participantNames }: Props) {
  if (history.length === 0) return null

  return (
    <div>
      <p className="text-xs font-medium text-[#2a2380]/70 uppercase tracking-wider mb-3">
        History ({history.length} {history.length === 1 ? 'round' : 'rounds'})
      </p>
      <div className="space-y-2">
        {[...history].reverse().map((round, i) => (
          <div
            key={i}
            className="bg-[#fff8b3] rounded-lg px-4 py-2.5 flex items-start justify-between gap-4 text-sm"
          >
            <span className="text-[#2a2380]/80 truncate">
              {round.story ?? <em className="text-[#2a2380]/60">Untitled</em>}
            </span>
            <span className="shrink-0 text-right">
              {round.consensus !== undefined ? (
                <span className="text-[#7ab840] font-semibold">→ {String(round.consensus)}</span>
              ) : (
                <span className="text-[#2a2380]/60 text-xs">
                  {Object.entries(round.votes)
                    .map(([id, card]) => `${participantNames[id] ?? 'Unknown'}: ${String(card)}`)
                    .join(', ')}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
