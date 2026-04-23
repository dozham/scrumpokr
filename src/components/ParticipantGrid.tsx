import type { Card, ParticipantSnapshot } from '@/lib/types'

interface Props {
  participants: ParticipantSnapshot[]
  votes?: Record<string, Card>
  phase: 'voting' | 'revealed'
}

export function ParticipantGrid({ participants, votes, phase }: Props) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Participants ({participants.length})
      </p>
      <div className="flex flex-wrap gap-4">
        {participants.map(p => (
          <div key={p.id} className="flex flex-col items-center gap-1.5">
            <CardFace p={p} phase={phase} votes={votes} />
            <span className="text-xs text-gray-400 max-w-[52px] truncate text-center leading-tight">
              {p.name}{p.isHost ? ' ★' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CardFace({
  p,
  phase,
  votes,
}: {
  p: ParticipantSnapshot
  phase: 'voting' | 'revealed'
  votes?: Record<string, Card>
}) {
  if (p.role === 'spectator') {
    return (
      <div className="w-12 h-16 rounded-lg bg-gray-800 border border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-lg">
        👁
      </div>
    )
  }

  if (phase === 'revealed' && votes) {
    const card = votes[p.id]
    return (
      <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center font-bold text-base ${
        card !== undefined
          ? 'bg-green-800 border-green-500 text-white'
          : 'bg-gray-800 border-gray-600 text-gray-500'
      }`}>
        {card !== undefined ? String(card) : '—'}
      </div>
    )
  }

  return (
    <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-lg ${
      p.hasVoted
        ? 'bg-green-900 border-green-600 text-green-300'
        : 'bg-gray-800 border-dashed border-gray-600 text-gray-600'
    }`}>
      {p.hasVoted ? '✓' : '…'}
    </div>
  )
}
