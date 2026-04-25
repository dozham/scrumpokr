import type { RoundResult } from '@/lib/types'

interface Props {
  history: RoundResult[]
  participantNames: Record<string, string>
}

function verdictIcon(round: RoundResult): string {
  if (round.verdictSource === 'natural') return '🎉'
  if (round.verdictSource === 'selected') return '✓'
  if (round.verdictSource === 'none') return '✗'
  // backward compat: old entries have no verdictSource
  return round.consensus !== undefined ? '🎉' : '✗'
}

export function VotingHistory({ history, participantNames }: Props) {
  if (history.length === 0) return null

  return (
    <div>
      <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-3">
        History ({history.length} {history.length === 1 ? 'round' : 'rounds'})
      </p>
      <div className="space-y-2">
        {[...history].reverse().map((round, i) => (
          <div
            key={i}
            className="bg-sky-50 dark:bg-gray-800 border border-sky-200 dark:border-transparent rounded-lg px-4 py-2.5 flex items-start justify-between gap-4 text-sm"
          >
            <span className="text-slate-700 dark:text-gray-300 truncate">
              {verdictIcon(round)}{' '}
              {round.story ?? <em className="text-slate-400 dark:text-gray-500">Untitled</em>}
            </span>
            <span className="shrink-0 text-right">
              {round.consensus !== undefined ? (
                <span className="text-emerald-600 dark:text-green-400 font-semibold">→ {String(round.consensus)}</span>
              ) : (
                <span className="text-slate-400 dark:text-gray-500 text-xs">
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
