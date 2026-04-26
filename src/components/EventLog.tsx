'use client'

import { useState } from 'react'
import type { EventLogEntry, RoundResult } from '@/lib/types'

interface Props {
  entries: EventLogEntry[]
  history: RoundResult[]
}

function verdictSuffix(round: RoundResult): string {
  const { verdictSource, consensus } = round
  if (verdictSource === 'natural' || (verdictSource === undefined && consensus !== undefined)) {
    return ` · 🎉 ${String(consensus)}`
  }
  if (verdictSource === 'selected') {
    return ` · ✓ ${String(consensus)}`
  }
  return ' · ✗ No consensus'
}

export function EventLog({ entries, history }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  if (entries.length === 0) return null

  function formatTimestamp(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Correlate reset events (reversed) to history entries.
  // The Nth reset encountered in reverse = history[history.length - 1 - N].
  const displayEntries: { entry: EventLogEntry; round?: RoundResult }[] = []
  let resetCount = 0
  for (const entry of [...entries].reverse()) {
    if (entry.type === 'reset') {
      const idx = history.length - 1 - resetCount
      displayEntries.push({ entry, round: idx >= 0 ? history[idx] : undefined })
      resetCount++
    } else {
      displayEntries.push({ entry })
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-sky-200 dark:border-gray-800 overflow-hidden">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full px-4 py-3 border-b border-sky-200 dark:border-gray-800 bg-sky-50 dark:bg-gray-800/30 flex items-center justify-between hover:bg-sky-100 dark:hover:bg-gray-800/50 transition-colors"
      >
        <h3 className="text-xs font-bold text-sky-600 dark:text-gray-400 uppercase tracking-wider">
          Event Log ({entries.length})
        </h3>
        <span className="text-sky-400 dark:text-gray-500 text-xs">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && (
        <div className="divide-y divide-sky-100 dark:divide-gray-800 max-h-48 overflow-y-auto">
          {displayEntries.map(({ entry, round }, i) => (
            <div key={i} className="px-4 py-2 flex items-center justify-between gap-4 text-sm">
              <p className="text-slate-500 dark:text-gray-400 truncate">
                {entry.type === 'revealed' ? (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-white">{entry.actorName}</span>
                    {' revealed the votes'}
                  </>
                ) : entry.type === 'reset' ? (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-white">{entry.actorName}</span>
                    {' started a new round'}
                    {round && (
                      <span className="text-slate-400 dark:text-gray-500">{verdictSuffix(round)}</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-white">{entry.actorName}</span>
                    {' performed '}
                    {entry.type}
                  </>
                )}
              </p>
              <time className="text-xs text-slate-400 dark:text-gray-500 tabular-nums shrink-0">
                {formatTimestamp(entry.timestamp)}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
