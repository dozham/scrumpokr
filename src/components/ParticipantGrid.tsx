import type { Card, ParticipantSnapshot } from '@/lib/types'

interface Props {
  participants: ParticipantSnapshot[]
  votes?: Record<string, Card>
  phase: 'voting' | 'revealed'
}

export function ParticipantGrid({ participants, votes, phase }: Props) {
  return (
    <div>
      <p className="text-xs font-medium text-[#2a2380]/70 uppercase tracking-wider mb-3">
        Participants ({participants.length})
      </p>
      <div className="flex flex-wrap gap-4">
        {participants.map(p => (
          <div key={p.id} className="flex flex-col items-center gap-1.5">
            <CardFace p={p} phase={phase} votes={votes} />
            <span className="text-xs text-[#2a2380]/70 max-w-[52px] truncate text-center leading-tight">
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
      <div className="w-12 h-16 rounded-lg bg-[#fff8b3] border border-dashed border-[#2a2380] flex items-center justify-center text-[#2a2380]/60 text-lg">
        👁
      </div>
    )
  }

  if (phase === 'revealed' && votes) {
    const card = votes[p.id]
    return (
      <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center font-bold text-base ${
        card !== undefined
          ? 'bg-[#7ab840] text-white border-[#2a2380] text-white'
          : 'bg-[#fff8b3] border-[#2a2380] text-[#2a2380]/60'
      }`}>
        {card !== undefined ? String(card) : '—'}
      </div>
    )
  }

  return (
    <div className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-lg ${
      p.hasVoted
        ? 'bg-[#7ab840] text-white/80 border-[#2a2380] text-white'
        : 'bg-[#fff8b3] border-dashed border-[#2a2380] text-[#2a2380]/50'
    }`}>
      {p.hasVoted ? '✓' : '…'}
    </div>
  )
}
