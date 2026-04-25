import type { Card, ParticipantSnapshot } from '@/lib/types'

const BADGE_COLORS = [
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

interface Props {
  participants: ParticipantSnapshot[]
  votes?: Record<string, Card>
  phase: 'voting' | 'revealed'
  yourId: string
}

export function ParticipantGrid({ participants, votes, phase, yourId }: Props) {
  return (
    <div>
      <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-3">
        Participants ({participants.length})
      </p>
      <div className="flex flex-wrap gap-4">
        {participants.map((p, i) => (
          <div key={p.id} className="flex flex-col items-center gap-1.5">
            <CardFace p={p} phase={phase} votes={votes} isYou={p.id === yourId} />
            <span className={`text-xs max-w-[52px] truncate text-center leading-tight px-1.5 py-0.5 rounded-full dark:px-0 dark:py-0 dark:rounded-none dark:bg-transparent dark:text-gray-400 ${BADGE_COLORS[i % BADGE_COLORS.length]} ${p.id === yourId ? 'font-semibold' : ''}`}>
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
  isYou,
}: {
  p: ParticipantSnapshot
  phase: 'voting' | 'revealed'
  votes?: Record<string, Card>
  isYou: boolean
}) {
  const ringClass = isYou ? 'ring-2 ring-sky-400 dark:ring-indigo-400' : ''

  if (p.role === 'spectator') {
    return (
      <div className={`w-12 h-16 rounded-lg bg-sky-50 dark:bg-gray-800 border border-dashed border-sky-300 dark:border-gray-600 flex items-center justify-center text-sky-400 dark:text-gray-500 text-lg ${ringClass}`}>
        👁
      </div>
    )
  }

  if (phase === 'revealed' && votes) {
    const card = votes[p.id]
    return (
      <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center font-bold text-base ${ringClass} ${
        card !== undefined
          ? 'bg-sky-100 dark:bg-green-800 border-sky-400 dark:border-green-500 text-sky-800 dark:text-white'
          : 'bg-sky-50 dark:bg-gray-800 border-sky-200 dark:border-gray-600 text-slate-400 dark:text-gray-500'
      }`}>
        {card !== undefined ? String(card) : '—'}
      </div>
    )
  }

  return (
    <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-lg ${ringClass} ${
      p.hasVoted
        ? 'bg-sky-100 dark:bg-green-900 border-sky-400 dark:border-green-600 text-sky-700 dark:text-green-300'
        : 'bg-sky-50 dark:bg-gray-800 border-dashed border-sky-200 dark:border-gray-600 text-slate-300 dark:text-gray-600'
    }`}>
      {p.hasVoted ? '✓' : '…'}
    </div>
  )
}
