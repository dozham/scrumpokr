import type { EventLogEntry } from '@/lib/types'

interface Props {
  entries: EventLogEntry[]
}

export function EventLog({ entries }: Props) {
  if (entries.length === 0) return null

  function formatTimestamp(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function getEntryText(entry: EventLogEntry) {
    switch (entry.type) {
      case 'revealed':
        return <><span className="font-semibold text-[#2a2380]">{entry.actorName}</span> revealed the votes</>
      case 'reset':
        return <><span className="font-semibold text-[#2a2380]">{entry.actorName}</span> started a new round</>
      default:
        return <><span className="font-semibold text-[#2a2380]">{entry.actorName}</span> performed {entry.type}</>
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#2a2380] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a2380] bg-[#fff8b3]/30">
        <h3 className="text-xs font-bold text-[#2a2380]/70 uppercase tracking-wider">Event Log</h3>
      </div>
      <div className="divide-y divide-[#2a2380] max-h-48 overflow-y-auto">
        {[...entries].reverse().map((entry, i) => (
          <div key={i} className="px-4 py-2 flex items-center justify-between gap-4 text-sm">
            <p className="text-[#2a2380]/70 truncate">
              {getEntryText(entry)}
            </p>
            <time className="text-xs text-[#2a2380]/60 tabular-nums shrink-0">
              {formatTimestamp(entry.timestamp)}
            </time>
          </div>
        ))}
      </div>
    </div>
  )
}
