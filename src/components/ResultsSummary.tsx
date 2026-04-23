import type { Card, ParticipantSnapshot } from '@/lib/types'

interface Props {
  votes: Record<string, Card>
  participants: ParticipantSnapshot[]
}

export function ResultsSummary({ votes, participants }: Props) {
  const voterIds = participants.filter(p => p.role === 'voter').map(p => p.id)
  const numeric = voterIds
    .map(id => votes[id])
    .filter((c): c is number => typeof c === 'number')

  const avg = numeric.length > 0
    ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1)
    : '—'
  const min = numeric.length > 0 ? Math.min(...numeric) : '—'
  const max = numeric.length > 0 ? Math.max(...numeric) : '—'

  const allCards = voterIds.map(id => votes[id]).filter(c => c !== undefined)
  const consensus =
    allCards.length === voterIds.length && voterIds.length > 0 && new Set(allCards.map(String)).size === 1
      ? allCards[0]
      : undefined

  return (
    <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-6 text-sm flex-wrap">
      <span className="text-gray-400">Avg: <strong className="text-white">{avg}</strong></span>
      <span className="text-gray-400">Min: <strong className="text-white">{String(min)}</strong></span>
      <span className="text-gray-400">Max: <strong className="text-white">{String(max)}</strong></span>
      {consensus !== undefined && (
        <span className="text-green-400 font-semibold ml-auto">
          ✓ Consensus: {String(consensus)}
        </span>
      )}
    </div>
  )
}
