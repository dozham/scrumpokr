"use client"

import { useState } from 'react'
import type { RoundResult, Card } from '@/lib/types'

interface Props {
  history: RoundResult[]
  participantNames: Record<string, string>
  onEditRound: (index: number, story: string, verdict: Card | 'NO_CONSENSUS' | null) => void
}

interface EditState {
  story: string
  selectedChip: Card | 'NO_CONSENSUS' | null
  customInput: string
}

function initEditState(round: RoundResult): EditState {
  const votedStrings = Object.values(round.votes).map(String)
  if (round.consensus !== undefined) {
    if (votedStrings.includes(String(round.consensus))) {
      return { story: round.story ?? '', selectedChip: round.consensus, customInput: '' }
    }
    return { story: round.story ?? '', selectedChip: null, customInput: String(round.consensus) }
  }
  return { story: round.story ?? '', selectedChip: 'NO_CONSENSUS', customInput: '' }
}

function verdictIcon(round: RoundResult): string {
  if (round.verdictSource === 'natural') return '🎉'
  if (round.verdictSource === 'selected') return '✓'
  if (round.verdictSource === 'none') return '✗'
  return round.consensus !== undefined ? '🎉' : '✗'
}

export function VotingHistory({ history, participantNames, onEditRound }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editState, setEditState] = useState<EditState>({ story: '', selectedChip: null, customInput: '' })

  if (history.length === 0) return null

  function startEdit(i: number) {
    setEditingIndex(i)
    setEditState(initEditState(history[i]))
  }

  function cancelEdit() {
    setEditingIndex(null)
  }

  function saveEdit(i: number, state: EditState) {
    let verdict: Card | 'NO_CONSENSUS' | null
    if (state.customInput.trim() !== '') {
      const raw = state.customInput.trim()
      const num = Number(raw)
      verdict = isNaN(num) ? raw : num
    } else {
      verdict = state.selectedChip
    }
    onEditRound(i, state.story, verdict)
    setEditingIndex(null)
  }

  return (
    <div>
      <p className="text-xs font-medium text-sky-600 dark:text-gray-400 uppercase tracking-wider mb-3">
        History ({history.length} {history.length === 1 ? 'round' : 'rounds'})
      </p>
      <div className="space-y-2">
        {[...history].reverse().map((round, reversedI) => {
          const i = history.length - 1 - reversedI
          const uniqueVotedCards = [...new Map(Object.values(round.votes).map(c => [String(c), c])).values()]

          if (editingIndex === i) {
            return (
              <div
                key={i}
                className="bg-sky-50 dark:bg-gray-800 border border-sky-300 dark:border-gray-600 rounded-lg px-4 py-3 space-y-3 text-sm"
              >
                <input
                  autoFocus
                  value={editState.story}
                  onChange={e => setEditState(s => ({ ...s, story: e.target.value }))}
                  onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                  placeholder="Story title"
                  className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-sky-300 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-indigo-500"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-sky-600 dark:text-gray-400">Verdict:</span>
                  {uniqueVotedCards.map(v => {
                    const active = String(editState.selectedChip) === String(v) && editState.customInput === ''
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setEditState(s => ({ ...s, selectedChip: v, customInput: '' }))}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          active
                            ? 'bg-sky-500 dark:bg-indigo-600 text-white'
                            : 'bg-sky-100 dark:bg-gray-700 text-sky-700 dark:text-gray-200 hover:bg-sky-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {String(v)}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setEditState(s => ({ ...s, selectedChip: 'NO_CONSENSUS', customInput: '' }))}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      editState.selectedChip === 'NO_CONSENSUS' && editState.customInput === ''
                        ? 'bg-slate-500 dark:bg-gray-500 text-white'
                        : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    No consensus
                  </button>
                  <input
                    value={editState.customInput}
                    onChange={e => setEditState(s => ({ ...s, customInput: e.target.value, selectedChip: null }))}
                    placeholder="Custom…"
                    className="w-24 px-2 py-0.5 bg-white dark:bg-gray-900 border border-sky-300 dark:border-gray-700 rounded-full text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-3 py-1 text-xs rounded-lg bg-sky-50 dark:bg-gray-700 hover:bg-sky-100 dark:hover:bg-gray-600 text-slate-600 dark:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(i, editState)}
                    className="px-3 py-1 text-xs rounded-lg bg-sky-500 dark:bg-indigo-600 hover:bg-sky-400 dark:hover:bg-indigo-500 text-white font-medium transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={i}
              className="bg-sky-50 dark:bg-gray-800 border border-sky-200 dark:border-transparent rounded-lg px-4 py-2.5 flex items-start justify-between gap-4 text-sm"
            >
              <span className="text-slate-700 dark:text-gray-300 truncate">
                {verdictIcon(round)}{' '}
                {round.story ?? <em className="text-slate-400 dark:text-gray-500">Untitled</em>}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                {round.consensus !== undefined ? (
                  <span className="text-emerald-600 dark:text-green-400 font-semibold">
                    → {String(round.consensus)}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-gray-500 text-xs">
                    {Object.entries(round.votes)
                      .map(([id, card]) => `${participantNames[id] ?? 'Unknown'}: ${String(card)}`)
                      .join(', ')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  aria-label="Edit round"
                  className="text-slate-400 dark:text-gray-500 hover:text-sky-500 dark:hover:text-indigo-400 transition-colors"
                >
                  ✏️
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
