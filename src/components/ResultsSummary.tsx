'use client'

import { useState } from 'react'
import type { Card, ParticipantSnapshot } from '@/lib/types'

interface Props {
  votes: Record<string, Card>
  participants: ParticipantSnapshot[]
  selectedVerdict?: Card | 'NO_CONSENSUS'
  onSelectVerdict?: (v: Card | 'NO_CONSENSUS') => void
}

export function ResultsSummary({ votes, participants, selectedVerdict, onSelectVerdict = () => {} }: Props) {
  const [picking, setPicking] = useState(false)

  const voterIds = participants.filter(p => p.role === 'voter').map(p => p.id)
  const allVoterCards = voterIds.map(id => votes[id]).filter((c): c is Card => c !== undefined)
  const numeric = allVoterCards.filter((c): c is number => typeof c === 'number')

  const avg = numeric.length > 0
    ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1)
    : '—'

  let median = '—'
  if (numeric.length > 0) {
    const sorted = [...numeric].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const medianVal = sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
    median = medianVal.toFixed(1)
  }

  const min = numeric.length > 0 ? String(Math.min(...numeric)) : '—'
  const max = numeric.length > 0 ? String(Math.max(...numeric)) : '—'

  let mostVoted = '—'
  if (allVoterCards.length > 0) {
    const freq = new Map<string, number>()
    for (const c of allVoterCards) {
      const k = String(c)
      freq.set(k, (freq.get(k) ?? 0) + 1)
    }
    const maxCount = Math.max(...freq.values())
    const winners = [...freq.entries()].filter(([, n]) => n === maxCount).map(([k]) => k)
    mostVoted = winners.join(' / ')
  }

  const naturalConsensus =
    allVoterCards.length === voterIds.length && voterIds.length > 0 && new Set(allVoterCards.map(String)).size === 1
      ? allVoterCards[0]
      : undefined

  const uniqueVotedValues = [...new Map(allVoterCards.map(c => [String(c), c])).values()]

  const showPicker = selectedVerdict === undefined || picking

  return (
    <div className="bg-sky-50 dark:bg-gray-800 border border-sky-200 dark:border-transparent rounded-xl px-4 py-3 text-sm">
      <div className="flex items-center gap-6 flex-wrap">
        <span className="text-sky-600 dark:text-gray-400">Avg: <strong className="text-slate-900 dark:text-white">{avg}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Median: <strong className="text-slate-900 dark:text-white">{median}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Min: <strong className="text-slate-900 dark:text-white">{min}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Max: <strong className="text-slate-900 dark:text-white">{max}</strong></span>
        <span className="text-sky-600 dark:text-gray-400">Most Voted: <strong className="text-slate-900 dark:text-white">{mostVoted}</strong></span>
        {naturalConsensus !== undefined && (
          <span className="text-emerald-600 dark:text-green-400 font-semibold ml-auto">
            🎉 Consensus: {String(naturalConsensus)}
          </span>
        )}
      </div>

      {naturalConsensus === undefined && (
        <div className="mt-3 pt-3 border-t border-sky-200 dark:border-gray-700">
          {showPicker ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-sky-600 dark:text-gray-400">Pick verdict:</span>
              {uniqueVotedValues.map(v => (
                <button
                  key={String(v)}
                  onClick={() => { onSelectVerdict(v); setPicking(false) }}
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 dark:bg-gray-700 text-sky-700 dark:text-gray-200 hover:bg-sky-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {String(v)}
                </button>
              ))}
              <button
                onClick={() => { onSelectVerdict('NO_CONSENSUS'); setPicking(false) }}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
              >
                No consensus
              </button>
            </div>
          ) : selectedVerdict === 'NO_CONSENSUS' ? (
            <button
              onClick={() => setPicking(true)}
              className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
            >
              ✗ No consensus
            </button>
          ) : (
            <button
              onClick={() => setPicking(true)}
              className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
            >
              ✓ Verdict: {String(selectedVerdict)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
