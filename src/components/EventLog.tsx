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
        return <><span className="font-semibold text-white">{entry.actorName}</span> revealed the votes</>
      case 'reset':
        return <><span className="font-semibold text-white">{entry.actorName}</span> started a new round</>
      default:
        return <><span className="font-semibold text-white">{entry.actorName}</span> performed {entry.type}</>
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/30">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Event Log</h3>
      </div>
      <div className="divide-y divide-gray-800 max-h-48 overflow-y-auto">
        {[...entries].reverse().map((entry, i) => (
          <div key={i} className="px-4 py-2 flex items-center justify-between gap-4 text-sm">
            <p className="text-gray-400 truncate">
              {getEntryText(entry)}
            </p>
            <time className="text-xs text-gray-500 tabular-nums shrink-0">
              {formatTimestamp(entry.timestamp)}
            </time>
          </div>
        ))}
      </div>
    </div>
  )
}
